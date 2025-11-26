import { useQuery } from '@tanstack/react-query';
import { useAuth } from './useAuth';
import { getSupabaseClient } from '@/lib/supabaseClient';
import type { ProTier } from '@shared/schema';

interface SubscriptionData {
  tier: ProTier;
  startDate: string | null;
  endDate: string | null;
  autoRenew: boolean;
  isActive: boolean;
  expired?: boolean;
}

// Default free subscription - consistent shape for all consumers
const FREE_SUBSCRIPTION: SubscriptionData = {
  tier: 'free',
  startDate: null,
  endDate: null,
  autoRenew: false,
  isActive: false,
};

export function useSubscription() {
  const { isAuthenticated, user } = useAuth();

  const { data: subscription, isLoading } = useQuery<SubscriptionData>({
    queryKey: ['/api/subscription', user?.id],
    queryFn: async () => {
      if (!isAuthenticated || !user) return FREE_SUBSCRIPTION;
      
      try {
        const supabase = await getSupabaseClient();
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return FREE_SUBSCRIPTION;

        const response = await fetch('/api/subscription', {
          credentials: 'include',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
          },
        });
        
        if (!response.ok) {
          if (response.status === 404) {
            return FREE_SUBSCRIPTION;
          }
          throw new Error('Failed to fetch subscription');
        }
        
        const data = await response.json();
        
        // Ensure all fields are present with defaults
        return {
          tier: data.tier || 'free',
          startDate: data.startDate ?? null,
          endDate: data.endDate ?? null,
          autoRenew: data.autoRenew ?? false,
          isActive: data.isActive ?? false,
          expired: data.expired ?? false,
        };
      } catch (error) {
        console.error('Error fetching subscription:', error);
        return FREE_SUBSCRIPTION;
      }
    },
    enabled: isAuthenticated && !!user,
    staleTime: 5 * 60 * 1000,
  });

  // Use FREE_SUBSCRIPTION as default when data is not yet loaded
  const effectiveSubscription = subscription || FREE_SUBSCRIPTION;
  const tier = effectiveSubscription.tier;
  const isPro = tier !== 'free';
  const isGold = tier === 'gold';
  const isSilver = tier === 'silver';
  const isBronze = tier === 'bronze';

  return {
    subscription: effectiveSubscription,
    tier,
    isPro,
    isGold,
    isSilver,
    isBronze,
    isLoading,
  };
}
