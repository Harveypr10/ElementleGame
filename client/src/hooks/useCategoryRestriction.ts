import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from './useAuth';
import { getSupabaseClient } from '@/lib/supabaseClient';

interface CategoryRestrictionResponse {
  status: 'allowed' | 'restricted' | 'error';
  restrictionDays: number;
  lastChangedAt: string | null;
  message: string | null;
  error?: string;
}

const DEFAULT_RESPONSE: CategoryRestrictionResponse = {
  status: 'restricted',
  restrictionDays: 14,
  lastChangedAt: null,
  message: 'Checking restriction status...',
};

export function useCategoryRestriction() {
  const { isAuthenticated, user } = useAuth();

  const { data, isLoading, isError, refetch } = useQuery<CategoryRestrictionResponse>({
    queryKey: ['/api/category-restriction-status', user?.id],
    queryFn: async () => {
      if (!isAuthenticated || !user) {
        return { ...DEFAULT_RESPONSE, status: 'allowed' as const, message: null };
      }
      
      try {
        const supabase = await getSupabaseClient();
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session?.access_token) {
          return DEFAULT_RESPONSE;
        }

        const response = await fetch('/api/category-restriction-status', {
          credentials: 'include',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
          },
        });

        if (!response.ok) {
          console.error('[useCategoryRestriction] API error:', response.status);
          return DEFAULT_RESPONSE;
        }

        const result = await response.json();
        console.log('[useCategoryRestriction] Got status:', result.status);
        return result;
      } catch (error) {
        console.error('[useCategoryRestriction] Error:', error);
        return DEFAULT_RESPONSE;
      }
    },
    enabled: isAuthenticated && !!user,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    retry: 2,
    retryDelay: 1000,
  });

  const effectiveData = data || DEFAULT_RESPONSE;
  const isAllowed = !isLoading && !isError && effectiveData.status === 'allowed';
  const isRestricted = !isLoading && !isError && effectiveData.status === 'restricted';

  return {
    isLoading: isLoading || (!data && isAuthenticated && !!user),
    isAllowed,
    isRestricted,
    restrictionDays: effectiveData.restrictionDays,
    lastChangedAt: effectiveData.lastChangedAt,
    message: effectiveData.message,
    refetch: () => refetch(),
  };
}

export function useCategoryRestrictionActions() {
  const queryClient = useQueryClient();
  
  const markAsRestricted = (restrictionDays: number) => {
    queryClient.setQueryData(['/api/category-restriction-status'], {
      status: 'restricted',
      restrictionDays,
      lastChangedAt: new Date().toISOString(),
      message: `You can update your categories once every ${restrictionDays} days and Hammie will regenerate your questions.`
    });
  };
  
  const invalidateRestriction = () => {
    queryClient.invalidateQueries({ queryKey: ['/api/category-restriction-status'] });
  };
  
  return { markAsRestricted, invalidateRestriction };
}
