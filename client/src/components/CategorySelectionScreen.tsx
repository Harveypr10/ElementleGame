import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSupabase } from '@/lib/SupabaseProvider';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
import { useAdBannerActive } from '@/components/AdBanner';
import { readLocal, writeLocal, CACHE_KEYS } from '@/lib/localCache';
import { GeneratingQuestionsScreen } from './GeneratingQuestionsScreen';
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
  
  // Force refetch when screen opens with authenticated user
  useEffect(() => {
    if (isOpen && isAuthenticated) {
      console.log('[CategorySelectionScreen] Screen opened - forcing refetch');
      setHasSyncedFromApi(false); // Reset sync flag when screen opens
      refetch();
    }
  }, [isOpen, isAuthenticated, refetch]);

  // Sync UI state from API/cache when data becomes available
  useEffect(() => {
    if (!isOpen || hasSyncedFromApi) return;
    
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
  }, [userCategories, isOpen, isFetched, isError, loadingUserCategories, hasSyncedFromApi, cachedCategoryIds]);

  const saveCategoriesMutation = useMutation({
    mutationFn: async (categoryIds: number[]) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');
      const accessToken = session.access_token;

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
        throw new Error('Failed to save categories');
      }

      // Step 2: Call reset-and-reallocate-user Edge Function
      console.log('[CategorySelectionScreen] Categories saved - calling reset-and-reallocate-user');
      
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
              throw new Error(`reset-and-reallocate-user returned error: ${resetResponse.status}`);
            }
          } catch (err) {
            console.error('[CategorySelectionScreen] reset-and-reallocate-user failed:', err);
            throw err;
          }
        }
      }

      return response.json();
    },
    onSuccess: (_, categoryIds) => {
      // Update cache with newly saved categories
      writeLocal(CACHE_KEYS.PRO_CATEGORIES, categoryIds);
      queryClient.invalidateQueries({ queryKey: ['/api/user/pro-categories'] });
      // Show GeneratingQuestionsScreen instead of immediately calling onGenerate
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
    if (selectedCategories.size < 3) {
      toast({
        title: 'Select More Categories',
        description: 'Please select at least 3 categories to continue.',
        variant: 'destructive',
      });
      return;
    }

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
  if (showGeneratingQuestions && user?.id && profile?.region && profile?.postcode) {
    return (
      <GeneratingQuestionsScreen
        userId={user.id}
        region={profile.region}
        postcode={profile.postcode}
        onComplete={handleGeneratingQuestionsComplete}
      />
    );
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
    </AnimatePresence>
  );
}
