import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getSupabaseClient } from '@/lib/supabaseClient';
import { useAuth } from '@/hooks/useAuth';

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
  const [selectedCategories, setSelectedCategories] = useState<Set<number>>(
    new Set(initialSelectedIds)
  );
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { isAuthenticated } = useAuth();

  const { data: categories = [], isLoading: loadingCategories } = useQuery<Category[]>({
    queryKey: ['/api/categories'],
    queryFn: async () => {
      const response = await fetch('/api/categories');
      if (!response.ok) {
        throw new Error('Failed to fetch categories');
      }
      return await response.json() || [];
    },
    enabled: isOpen,
  });

  const { data: userCategories = [], isLoading: loadingUserCategories } = useQuery<number[]>({
    queryKey: ['/api/user/pro-categories'],
    queryFn: async () => {
      if (!isAuthenticated) return [];
      
      const supabase = await getSupabaseClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return [];

      const response = await fetch('/api/user/pro-categories', {
        credentials: 'include',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });
      
      if (!response.ok) return [];
      const data = await response.json();
      return data.categoryIds || [];
    },
    enabled: isOpen && isAuthenticated,
    staleTime: 0,
    refetchOnMount: 'always',
  });

  useEffect(() => {
    if (isOpen && userCategories.length > 0) {
      setSelectedCategories(new Set(userCategories));
    }
  }, [userCategories, isOpen]);

  const saveCategoriesMutation = useMutation({
    mutationFn: async (categoryIds: number[]) => {
      const supabase = await getSupabaseClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const response = await fetch('/api/user/pro-categories', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ categoryIds }),
      });

      if (!response.ok) {
        throw new Error('Failed to save categories');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/user/pro-categories'] });
      onGenerate();
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: 'Failed to save your category preferences.',
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

  const canGenerate = selectedCategories.size >= 3;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="fixed inset-0 z-[100] bg-background flex flex-col"
          data-testid="category-selection-screen"
        >
          <div className="flex items-center p-4">
            <button
              onClick={onClose}
              className="w-14 h-14 flex items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              data-testid="button-close-categories"
            >
              <ChevronLeft className="h-9 w-9 text-gray-700 dark:text-gray-300" />
            </button>
          </div>

          <div className="flex-1 flex flex-col px-4 pb-8 overflow-hidden">
            <div className="max-w-md mx-auto w-full space-y-6 flex flex-col flex-1">
              <div className="text-center space-y-2">
                <h1 className="text-2xl font-bold text-foreground" data-testid="text-categories-title">
                  Choose Your Categories
                </h1>
                <p className="text-muted-foreground">
                  Select at least 3 categories for your personalised puzzles
                </p>
                <p className="text-sm font-medium text-foreground">
                  {selectedCategories.size} selected
                  {selectedCategories.size < 3 && (
                    <span className="text-muted-foreground"> (need {3 - selectedCategories.size} more)</span>
                  )}
                </p>
              </div>

              <div className="flex-1 overflow-y-auto">
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

              <div className="pt-4">
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
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
