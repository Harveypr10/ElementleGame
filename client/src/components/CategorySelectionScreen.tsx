import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSupabase } from '@/lib/SupabaseProvider';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
import { useAdBannerActive } from '@/components/AdBanner';
import { useSpinnerWithTimeout } from '@/lib/SpinnerProvider';
import { readLocal, writeLocal, CACHE_KEYS } from '@/lib/localCache';
import { GeneratingQuestionsScreen } from './GeneratingQuestionsScreen';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import hamsterImage from '@assets/Question-Hamster-Grey.svg';

interface Category {
  id: number;
  name: string;
  description?: string;
}

interface CategorySelectionScreenProps {
  isOpen: boolean;
  onClose: () => void;
  onGenerate: () => void;
  initialSelectedIds?: number[];
  isRegeneration?: boolean;
}

export function CategorySelectionScreen({
  isOpen,
  onClose,
  onGenerate,
  initialSelectedIds = [],
  isRegeneration = false,
}: CategorySelectionScreenProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { isAuthenticated, user } = useAuth();
  const { profile } = useProfile();
  const adBannerActive = useAdBannerActive();
  const supabase = useSupabase();
  const [showGeneratingQuestions, setShowGeneratingQuestions] = useState(false);
  const [showRestrictionPopup, setShowRestrictionPopup] = useState(false);
  const [restrictionMessage, setRestrictionMessage] = useState("");
  
  // Track if spinner has been managed for this open cycle
  const spinnerManagedRef = useRef(false);
  
  // Ref for retry callback
  const refetchRef = useRef<(() => void) | null>(null);

  // Track if we've synced from API to avoid re-initializing
  const [hasSyncedFromApi, setHasSyncedFromApi] = useState(false);
  
  // Read cached data immediately for instant display
  const cachedCategoryIds = useMemo(() => {
    const cached = readLocal<number[]>(CACHE_KEYS.PRO_CATEGORIES);
    return cached || [];
  }, []);
  
  const cachedCategoriesList = useMemo(() => {
    const cached = readLocal<Category[]>(CACHE_KEYS.CATEGORIES_LIST);
    return cached || [];
  }, []);

  // Initialize with cached categories for instant display
  const [selectedCategories, setSelectedCategories] = useState<Set<number>>(
    () => new Set(cachedCategoryIds.length > 0 ? cachedCategoryIds : initialSelectedIds)
  );

  // Fetch categories list - use cache as initial data for instant display
  const { data: categories = cachedCategoriesList, isLoading: loadingCategories } = useQuery<Category[]>({
    queryKey: ['/api/categories'],
    queryFn: async () => {
      console.log('[CategorySelectionScreen] Fetching categories list from API...');
      const response = await fetch('/api/categories');
      if (!response.ok) {
        throw new Error('Failed to fetch categories');
      }
      const data = await response.json() || [];
      // Cache the list for future instant display
      writeLocal(CACHE_KEYS.CATEGORIES_LIST, data);
      console.log('[CategorySelectionScreen] Categories list fetched:', data.length);
      return data;
    },
    enabled: isOpen,
    initialData: cachedCategoriesList.length > 0 ? cachedCategoriesList : undefined,
    staleTime: 60 * 60 * 1000, // Consider data fresh for 1 hour
  });

  // Fetch user's selected categories - requires auth
  const { data: userCategories, isLoading: loadingUserCategories, refetch, isFetched, isError } = useQuery<number[]>({
    queryKey: ['/api/user/pro-categories'],
    queryFn: async () => {
      console.log('[CategorySelectionScreen] Fetching user categories from API...');
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        console.log('[CategorySelectionScreen] No session available');
        throw new Error('No session');
      }

      const response = await fetch('/api/user/pro-categories', {
        credentials: 'include',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });
      
      if (!response.ok) {
        console.log('[CategorySelectionScreen] Failed to fetch user categories:', response.status);
        throw new Error('Failed to fetch');
      }
      const data = await response.json();
      console.log('[CategorySelectionScreen] API returned categories:', data.categoryIds);
      // Cache the user's selection
      if (data.categoryIds && Array.isArray(data.categoryIds)) {
        writeLocal(CACHE_KEYS.PRO_CATEGORIES, data.categoryIds);
      }
      return data.categoryIds || [];
    },
    enabled: isOpen && isAuthenticated,
    initialData: cachedCategoryIds.length > 0 ? cachedCategoryIds : undefined,
    staleTime: 0, // Always refetch to get latest from server
    retry: 2, // Retry twice on failure
    retryDelay: 500, // Wait 500ms between retries
  });
  
  // Update refetch ref when refetch function changes
  useEffect(() => {
    refetchRef.current = refetch;
  }, [refetch]);
  
  // Callbacks for spinner timeout handling
  const handleRetry = useCallback(() => {
    console.log('[CategorySelectionScreen] Spinner timeout - triggering retry');
    refetchRef.current?.();
    queryClient.invalidateQueries({ queryKey: ['/api/categories'] });
  }, [queryClient]);
  
  const handleTimeout = useCallback(() => {
    console.log('[CategorySelectionScreen] Spinner timeout - failed to load');
    toast({
      title: 'Failed to load',
      description: 'Please try again in a bit.',
      variant: 'destructive',
    });
    onClose();
  }, [toast, onClose]);
  
  // Use spinner with timeout for automatic retry and failure handling
  const spinner = useSpinnerWithTimeout({
    retryDelayMs: 4000,
    timeoutMs: 8000,
    onRetry: handleRetry,
    onTimeout: handleTimeout,
  });
  
  // Check category restriction when screen opens
  useEffect(() => {
    if (!isOpen || !isAuthenticated || !profile) return;
    
    const checkRestriction = async () => {
      try {
        // Get auth token for the request
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) {
          console.log('[CategorySelectionScreen] No session for restriction check');
          return;
        }
        
        // Fetch the category restriction setting
        const response = await fetch('/api/settings/category-restriction-days', {
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
          },
        });
        if (!response.ok) return;
        
        const { days } = await response.json();
        if (days === 0) return; // No restriction
        
        // Check if user has a categoriesLastChangedAt timestamp
        const lastChanged = profile.categoriesLastChangedAt;
        if (!lastChanged) return; // No previous change, allow
        
        const lastChangedDate = new Date(lastChanged);
        const allowedAfter = new Date(lastChangedDate);
        allowedAfter.setDate(allowedAfter.getDate() + days);
        
        if (new Date() < allowedAfter) {
          // User is within restriction window
          setRestrictionMessage(`You can update your categories once every ${days} days and Hammie will regenerate your questions.`);
          setShowRestrictionPopup(true);
        }
      } catch (error) {
        console.error('[CategorySelectionScreen] Error checking restriction:', error);
      }
    };
    
    checkRestriction();
  }, [isOpen, isAuthenticated, profile, supabase]);

  // Force refetch when screen opens with authenticated user
  useEffect(() => {
    if (isOpen && isAuthenticated) {
      console.log('[CategorySelectionScreen] Screen opened - forcing refetch');
      setHasSyncedFromApi(false); // Reset sync flag when screen opens
      spinnerManagedRef.current = false; // Reset spinner management for new open cycle
      refetch();
    }
  }, [isOpen, isAuthenticated, refetch]);
  
  // Manage spinner: show when opening until data is fully synced
  useEffect(() => {
    if (!isOpen) {
      // Screen closed - ensure spinner is hidden and reset ref
      if (spinnerManagedRef.current) {
        spinner.cancel();
        spinnerManagedRef.current = false;
      }
      return;
    }
    
    // Screen is open - show spinner until data is synced
    if (!hasSyncedFromApi && !spinnerManagedRef.current) {
      // Data not yet synced - show spinner immediately with timeout
      console.log('[CategorySelectionScreen] Showing spinner with timeout - waiting for data sync');
      spinner.start(0); // Show immediately, no delay
      spinnerManagedRef.current = true;
    }
    
    // Hide spinner once data is synced
    if (hasSyncedFromApi && spinnerManagedRef.current) {
      console.log('[CategorySelectionScreen] Data synced - completing spinner');
      spinner.complete();
      spinnerManagedRef.current = false;
    }
  }, [isOpen, hasSyncedFromApi, spinner]);

  // Sync UI state from API/cache when data becomes available
  useEffect(() => {
    if (!isOpen || hasSyncedFromApi) return;
    
    // If not authenticated, use cache immediately (query is disabled)
    if (!isAuthenticated) {
      if (cachedCategoryIds.length > 0) {
        console.log('[CategorySelectionScreen] Using cached categories (not authenticated):', cachedCategoryIds);
        setSelectedCategories(new Set(cachedCategoryIds));
      } else {
        console.log('[CategorySelectionScreen] No cached categories (not authenticated)');
      }
      setHasSyncedFromApi(true);
      return;
    }
    
    // Wait for the query to complete (not loading, either fetched or errored)
    if (loadingUserCategories) return;
    
    const apiCategories = userCategories || [];
    
    // If API fetch succeeded with data, use it
    if (isFetched && !isError && apiCategories.length > 0) {
      console.log('[CategorySelectionScreen] Syncing from API:', apiCategories);
      setSelectedCategories(new Set(apiCategories));
      setHasSyncedFromApi(true);
      return;
    }
    
    // If API failed or returned empty, fall back to cache
    if ((isError || (isFetched && apiCategories.length === 0)) && cachedCategoryIds.length > 0) {
      console.log('[CategorySelectionScreen] Using cached categories (API empty/failed):', cachedCategoryIds);
      setSelectedCategories(new Set(cachedCategoryIds));
      setHasSyncedFromApi(true);
      return;
    }
    
    // If both API and cache are empty, mark as synced so button can enable for first-time users
    if (isFetched && apiCategories.length === 0 && cachedCategoryIds.length === 0) {
      console.log('[CategorySelectionScreen] No existing categories (first-time user)');
      setHasSyncedFromApi(true);
    }
  }, [userCategories, isOpen, isFetched, isError, loadingUserCategories, hasSyncedFromApi, cachedCategoryIds, isAuthenticated]);

  const saveCategoriesMutation = useMutation({
    mutationFn: async (categoryIds: number[]) => {
      console.log('[CategorySelectionScreen] Mutation started with categoryIds:', categoryIds);
      
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        console.error('[CategorySelectionScreen] Mutation failed: No session');
        throw new Error('Not authenticated');
      }
      const accessToken = session.access_token;
      console.log('[CategorySelectionScreen] Got session, proceeding to save categories');

      // Step 1: Save categories
      const response = await fetch('/api/user/pro-categories', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ categoryIds }),
      });

      if (!response.ok) {
        console.error('[CategorySelectionScreen] Failed to save categories:', response.status);
        throw new Error('Failed to save categories');
      }
      
      console.log('[CategorySelectionScreen] Categories saved successfully to API');

      // Step 2: Call reset-and-reallocate-user Edge Function
      console.log('[CategorySelectionScreen] Calling reset-and-reallocate-user Edge Function');
      
      if (!accessToken) {
        throw new Error('No access token found');
      }

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || (supabase as any).supabaseUrl;
      if (!supabaseUrl) {
        console.warn('[CategorySelectionScreen] Supabase URL not available; skipping reset-and-reallocate-user');
      } else {
        const functionBaseUrl = supabaseUrl.replace('.supabase.co', '.functions.supabase.co');
        console.log('[CategorySelectionScreen] Function base URL:', functionBaseUrl);
        
        if (user?.id) {
          try {
            const resetPayload = { user_id: user.id };
            const resetResponse = await fetch(`${functionBaseUrl}/reset-and-reallocate-user`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${accessToken}`,
              },
              body: JSON.stringify(resetPayload),
            });
            
            const resetBody = await resetResponse.text();
            console.log('[CategorySelectionScreen] reset-and-reallocate-user status:', resetResponse.status, resetBody);
            
            if (!resetResponse.ok) {
              console.error('[CategorySelectionScreen] reset-and-reallocate-user error:', resetResponse.status, resetBody);
              throw new Error(`reset-and-reallocate-user returned error: ${resetResponse.status}`);
            }
            
            console.log('[CategorySelectionScreen] reset-and-reallocate-user completed successfully');
          } catch (err) {
            console.error('[CategorySelectionScreen] reset-and-reallocate-user failed:', err);
            throw err;
          }
        }
      }

      console.log('[CategorySelectionScreen] Mutation mutationFn completed, returning response');
      return response.json();
    },
    onSuccess: (_, categoryIds) => {
      console.log('[CategorySelectionScreen] onSuccess handler called with categoryIds:', categoryIds);
      // Update cache with newly saved categories
      writeLocal(CACHE_KEYS.PRO_CATEGORIES, categoryIds);
      queryClient.invalidateQueries({ queryKey: ['/api/user/pro-categories'] });
      // Show GeneratingQuestionsScreen instead of immediately calling onGenerate
      console.log('[CategorySelectionScreen] Setting showGeneratingQuestions to true');
      setShowGeneratingQuestions(true);
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to save your category preferences.',
        variant: 'destructive',
      });
    },
  });

  const toggleCategory = (categoryId: number) => {
    setSelectedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(categoryId)) {
        next.delete(categoryId);
      } else {
        next.add(categoryId);
      }
      return next;
    });
  };

  // Check if selected categories differ from saved categories
  const categoriesHaveChanged = useMemo(() => {
    // Don't enable button until we've synced from API/cache
    // This prevents false positives during initial load
    if (!hasSyncedFromApi) return false;
    
    // If we're still loading saved categories, don't allow regeneration yet
    if (loadingUserCategories) return false;
    
    const savedCategories = userCategories || [];
    
    // For first-time category selection (no saved categories yet), allow generation
    if (savedCategories.length === 0) return true;
    
    // Check if the sets are different
    if (selectedCategories.size !== savedCategories.length) return true;
    
    // Check if all saved categories are still selected
    for (const catId of savedCategories) {
      if (!selectedCategories.has(catId)) return true;
    }
    
    return false;
  }, [selectedCategories, userCategories, loadingUserCategories, hasSyncedFromApi]);

  const handleGenerate = () => {
    console.log('[CategorySelectionScreen] handleGenerate called', {
      selectedCount: selectedCategories.size,
      canGenerate,
      categoriesHaveChanged,
      hasSyncedFromApi,
      userId: user?.id,
      profileRegion: profile?.region,
      profilePostcode: profile?.postcode,
    });
    
    if (selectedCategories.size < 3) {
      toast({
        title: 'Select More Categories',
        description: 'Please select at least 3 categories to continue.',
        variant: 'destructive',
      });
      return;
    }

    console.log('[CategorySelectionScreen] Starting mutation with categories:', Array.from(selectedCategories));
    saveCategoriesMutation.mutate(Array.from(selectedCategories));
  };

  // Handler for when GeneratingQuestionsScreen completes
  const handleGeneratingQuestionsComplete = () => {
    console.log('[CategorySelectionScreen] GeneratingQuestionsScreen complete');
    setShowGeneratingQuestions(false);
    // Invalidate queries to refresh data
    queryClient.invalidateQueries({ queryKey: ['/api/user/puzzles'] });
    queryClient.invalidateQueries({ queryKey: ['/api/puzzles'] });
    queryClient.invalidateQueries({ queryKey: ['/api/user/game-attempts/user'] });
    queryClient.invalidateQueries({ queryKey: ['/api/game-attempts/user'] });
    toast({
      title: 'Categories Updated!',
      description: 'Your puzzles are being refreshed with your new preferences.',
    });
    onGenerate(); // Close and return to GameSelectionPage
  };

  // Button only enabled when 3+ categories selected AND they differ from saved categories
  const canGenerate = selectedCategories.size >= 3 && categoriesHaveChanged;

  // Show GeneratingQuestionsScreen after categories are saved
  // Note: postcode can be empty for some users - use empty string as fallback
  if (showGeneratingQuestions && user?.id && profile?.region) {
    console.log('[CategorySelectionScreen] Showing GeneratingQuestionsScreen with:', {
      userId: user.id,
      region: profile.region,
      postcode: profile.postcode || '',
    });
    return (
      <GeneratingQuestionsScreen
        userId={user.id}
        region={profile.region}
        postcode={profile.postcode || ''}
        onComplete={handleGeneratingQuestionsComplete}
      />
    );
  }
  
  // Log if we're trying to show GeneratingQuestionsScreen but can't
  if (showGeneratingQuestions) {
    console.error('[CategorySelectionScreen] Cannot show GeneratingQuestionsScreen - missing data:', {
      showGeneratingQuestions,
      userId: user?.id,
      profileRegion: profile?.region,
      profilePostcode: profile?.postcode,
    });
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          className={`fixed inset-0 z-[100] bg-background flex flex-col ${adBannerActive ? 'pb-[50px]' : ''}`}
          data-testid="category-selection-screen"
        >
          {/* Fixed Header - title centered on full screen */}
          <div className="p-4 flex-shrink-0 relative">
            <button
              onClick={onClose}
              className="absolute left-4 top-4 w-14 h-14 flex items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              data-testid="button-close-categories"
            >
              <ChevronLeft className="h-9 w-9 text-gray-700 dark:text-gray-300" />
            </button>

            <h1 className="text-3xl font-bold text-foreground text-center" data-testid="text-categories-title">
              Select Your<br />Categories
            </h1>
          </div>

          {/* Fixed Hamster and Text Description */}
          <div className="px-4 pb-4 flex-shrink-0">
            <div className="max-w-md mx-auto w-full">
              <div className="flex items-start gap-4">
                {/* Hamster image with natural aspect ratio */}
                <img
                  src={hamsterImage}
                  alt="Hammie"
                  className="w-16 h-auto flex-shrink-0"
                />
                {/* Text boxes - centered text, centered in the remaining space */}
                <div className="flex-1 flex flex-col items-center justify-center text-center space-y-1">
                  <p className="text-base text-muted-foreground">
                    Choose your favourite subjects so Hammie can personalise your puzzles
                  </p>
                  <p className="text-base font-medium text-foreground">
                    {selectedCategories.size} selected (min 3)
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Scrollable Categories Area */}
          <div className="flex-1 overflow-y-auto px-4 scrollbar-hide" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
            <div className="max-w-md mx-auto w-full">
              {/* Categories Grid */}
              {loadingCategories ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2 pb-4">
                  {categories.map((category) => {
                    const isSelected = selectedCategories.has(category.id);
                    
                    return (
                      <button
                        key={category.id}
                        onClick={() => toggleCategory(category.id)}
                        className={`
                          px-4 py-3 rounded-xl text-sm font-medium transition-all
                          ${isSelected 
                            ? 'bg-blue-500 text-white font-bold' 
                            : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                          }
                        `}
                        data-testid={`button-category-${category.id}`}
                      >
                        {category.name}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Fixed Footer Button */}
          <div className="px-4 py-4 flex-shrink-0">
            <div className="max-w-md mx-auto w-full">
              <Button
                onClick={handleGenerate}
                disabled={!canGenerate || saveCategoriesMutation.isPending}
                className={`
                  w-full h-14 text-lg font-bold rounded-full transition-all
                  ${canGenerate 
                    ? 'bg-blue-500 hover:bg-blue-600 text-white' 
                    : 'bg-gray-300 dark:bg-gray-700 text-gray-500 cursor-not-allowed'
                  }
                `}
                data-testid="button-generate"
              >
                {saveCategoriesMutation.isPending ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin mr-2" />
                    Saving...
                  </>
                ) : (
                  isRegeneration ? 'Re-Generate' : 'Generate'
                )}
              </Button>
            </div>
          </div>
        </motion.div>
      )}

      {/* Category Restriction Popup */}
      <AlertDialog open={showRestrictionPopup} onOpenChange={setShowRestrictionPopup}>
        <AlertDialogContent data-testid="alert-category-restriction">
          <AlertDialogHeader>
            <AlertDialogTitle>Change Not Allowed</AlertDialogTitle>
            <AlertDialogDescription>
              {restrictionMessage}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction 
              onClick={() => {
                setShowRestrictionPopup(false);
                onClose();
              }} 
              data-testid="button-dismiss-category-restriction"
            >
              OK
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AnimatePresence>
  );
}
