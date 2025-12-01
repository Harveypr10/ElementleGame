import { useQuery } from '@tanstack/react-query';
import { useAuth } from './useAuth';
import { getSupabaseClient } from '@/lib/supabaseClient';

interface TierMetadata {
  streakSavers: number;
  holidaySavers: number;
  holidayDurationDays: number;
  subscriptionCost: number | null;
  currency: string;
  subscriptionDurationMonths: number | null;
  description: string | null;
  sortOrder: number | null;
}

export interface SubscriptionData {
  tier: 'free' | 'pro';
  tierName: string;
  tierType: 'monthly' | 'annual' | 'lifetime' | 'default';
  tierId: string | null;
  userId: string | null;
  endDate: string | null;
  autoRenew: boolean;
  isActive: boolean;
  isExpired: boolean;
  metadata: TierMetadata | null;
}

const FREE_SUBSCRIPTION: SubscriptionData = {
  tier: 'free',
  tierName: 'Standard',
  tierType: 'default',
  tierId: null,
  userId: null,
  endDate: null,
  autoRenew: false,
  isActive: true, // Standard tier is always active
  isExpired: false,
  metadata: {
    streakSavers: 1,
    holidaySavers: 0,
    holidayDurationDays: 14,
    subscriptionCost: 0,
    currency: 'GBP',
    subscriptionDurationMonths: null,
    description: 'Free tier',
    sortOrder: 0,
  },
};

export function useSubscription() {
  const { isAuthenticated, user } = useAuth();

  const { data: subscription, isLoading, refetch } = useQuery<SubscriptionData>({
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
        
        return {
          tier: data.tier || 'free',
          tierName: data.tierName || 'Standard',
          tierType: data.tierType || 'default',
          tierId: data.tierId ?? null,
          userId: data.userId ?? null,
          endDate: data.endDate ?? null,
          autoRenew: data.autoRenew ?? false,
          isActive: data.isActive ?? false,
          isExpired: data.isExpired ?? false,
          metadata: data.metadata ?? FREE_SUBSCRIPTION.metadata,
        };
      } catch (error) {
        console.error('Error fetching subscription:', error);
        return FREE_SUBSCRIPTION;
      }
    },
    enabled: isAuthenticated && !!user,
    staleTime: 5 * 60 * 1000,
  });

  const effectiveSubscription = subscription || FREE_SUBSCRIPTION;
  const tier = effectiveSubscription.tier;
  const tierName = effectiveSubscription.tierName;
  const tierType = effectiveSubscription.tierType;
  const isPro = tier === 'pro' && effectiveSubscription.isActive;
  const isExpired = effectiveSubscription.isExpired;
  
  const isProMonthly = isPro && tierType === 'monthly';
  const isProAnnual = isPro && tierType === 'annual';
  const isProLifetime = isPro && tierType === 'lifetime';
  
  const isGold = isProLifetime;
  const isSilver = isProAnnual;
  const isBronze = isProMonthly;

  const needsRenewal = tier === 'pro' && isExpired && !effectiveSubscription.isActive;
  const canRenew = isExpired && tierType !== 'lifetime';

  return {
    subscription: effectiveSubscription,
    tier,
    tierName,
    tierType,
    isPro,
    isExpired,
    needsRenewal,
    canRenew,
    isProMonthly,
    isProAnnual,
    isProLifetime,
    isGold,
    isSilver,
    isBronze,
    isLoading,
    refetch,
    streakSavers: effectiveSubscription.metadata?.streakSavers ?? 1,
    holidaySavers: effectiveSubscription.metadata?.holidaySavers ?? 0,
    holidayDurationDays: effectiveSubscription.metadata?.holidayDurationDays ?? 14,
    endDate: effectiveSubscription.endDate,
    autoRenew: effectiveSubscription.autoRenew,
  };
}
