import { useQuery } from '@tanstack/react-query';
import { useAuth } from './useAuth';
import { getSupabaseClient } from '@/lib/supabaseClient';

// Tier metadata returned from the API
interface TierMetadata {
  streakSavers: number;
  holidaySavers: number;
  holidayDurationDays: number;
  subscriptionCost: number | null;
  currency: string | null;
  subscriptionDurationMonths: number | null;
  description: string | null;
}

interface SubscriptionData {
  tier: 'free' | 'pro'; // Display tier
  tierName: string; // Canonical tier name (e.g., 'standard', 'pro_monthly', 'pro_annual', 'pro_lifetime')
  tierId: string | null;
  startDate: string | null;
  endDate: string | null;
  autoRenew: boolean;
  isActive: boolean;
  expired?: boolean;
  metadata: TierMetadata | null;
}

// Default free subscription - consistent shape for all consumers
const FREE_SUBSCRIPTION: SubscriptionData = {
  tier: 'free',
  tierName: 'standard',
  tierId: null,
  startDate: null,
  endDate: null,
  autoRenew: false,
  isActive: false,
  metadata: null,
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
          tierName: data.tierName || 'standard',
          tierId: data.tierId ?? null,
          startDate: data.startDate ?? null,
          endDate: data.endDate ?? null,
          autoRenew: data.autoRenew ?? false,
          isActive: data.isActive ?? false,
          expired: data.expired ?? false,
          metadata: data.metadata ?? null,
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
  const tierName = effectiveSubscription.tierName;
  const isPro = tier !== 'free';
  
  // Specific tier checks based on canonical tier name
  const isProMonthly = tierName === 'pro_monthly';
  const isProAnnual = tierName === 'pro_annual';
  const isProLifetime = tierName === 'pro_lifetime';
  
  // Legacy tier checks (for backward compatibility)
  const isGold = isProLifetime;
  const isSilver = isProAnnual;
  const isBronze = isProMonthly;

  return {
    subscription: effectiveSubscription,
    tier,
    tierName,
    isPro,
    isProMonthly,
    isProAnnual,
    isProLifetime,
    isGold,
    isSilver,
    isBronze,
    isLoading,
    // Expose tier metadata for UI
    streakSavers: effectiveSubscription.metadata?.streakSavers ?? 0,
    holidaySavers: effectiveSubscription.metadata?.holidaySavers ?? 0,
    holidayDurationDays: effectiveSubscription.metadata?.holidayDurationDays ?? 0,
  };
}
