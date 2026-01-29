import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect } from 'react';

interface TierMetadata {
    streakSavers: number;
    holidaySavers: number;
    holidayDurationDays: number;
    subscriptionCost: number | null;
    currency: string;
    description: string | null;
}

export interface SubscriptionData {
    tier: 'free' | 'pro';
    tierName: string;
    tierType: 'monthly' | 'annual' | 'lifetime' | 'default';
    tierId: string | null;
    isActive: boolean;
    isExpired: boolean;
    metadata: TierMetadata | null;
    endDate: string | null;
}

const FREE_SUBSCRIPTION: SubscriptionData = {
    tier: 'free',
    tierName: 'Standard',
    tierType: 'default',
    tierId: null,
    isActive: true,
    isExpired: false,
    metadata: {
        streakSavers: 1,
        holidaySavers: 0,
        holidayDurationDays: 14,
        subscriptionCost: 0,
        currency: 'GBP',
        description: 'Free tier'
    },
    endDate: null
};

export function useSubscription() {
    const { user } = useAuth();

    const { data: subscription, isLoading, refetch } = useQuery({
        queryKey: ['subscription', user?.id],
        queryFn: async () => {
            if (!user) return FREE_SUBSCRIPTION;

            // Get user profile with tier info via join
            const { data: profile, error: profileError } = await supabase
                .from('user_profiles')
                .select(`
          user_tier_id,
          user_tier:user_tier_id (
            id,
            tier,
            tier_type,
            holiday_duration_days,
            streak_savers,
            holiday_savers
          )
        `)
                .eq('id', user.id)
                .single();

            if (profileError || !profile?.user_tier) {
                console.log('[useSubscription] No tier found, using free:', profileError);
                return FREE_SUBSCRIPTION;
            }

            const tierData = profile.user_tier as any;
            const tier = tierData.tier as 'free' | 'pro';
            const tierType = tierData.tier_type as 'monthly' | 'annual' | 'lifetime' | 'default';

            // Use hardcoded metadata for now (TODO: get from tier table or user_subscriptions)
            const metadata: TierMetadata = {
                streakSavers: tierData.streak_savers ?? (tier === 'pro' ? 3 : 1),
                holidaySavers: tierData.holiday_savers ?? (tier === 'pro' ? 2 : 0),
                holidayDurationDays: tierData.holiday_duration_days ?? 14,
                subscriptionCost: null,
                currency: 'GBP',
                description: null
            };

            // Check if subscription is active (if Pro tier)
            let isActive = tier === 'free'; // Free tier is always active
            let expiresAt: string | null = null;

            if (tier === 'pro') {
                // For now, assume Pro tier is active
                // TODO: Check user_subscriptions table for active subscription
                isActive = true;
            }

            return {
                tier,
                tierName: tier === 'pro' ? 'Pro' : 'Standard',
                tierType,
                tierId: tierData.id,
                isActive,
                isExpired: tier === 'pro' && !isActive,
                metadata,
                endDate: expiresAt
            };
        },
        enabled: !!user,
        staleTime: 5 * 60 * 1000 // Cache for 5 minutes
    });

    const effectiveSubscription = subscription || FREE_SUBSCRIPTION;
    const isPro = effectiveSubscription.tier === 'pro' && effectiveSubscription.isActive;

    // Cache Pro Status for UI Polish
    useEffect(() => {
        if (subscription) {
            AsyncStorage.setItem('cached_is_pro', (subscription.tier === 'pro' && subscription.isActive) ? 'true' : 'false');
        }
    }, [subscription]);

    return {
        subscription: effectiveSubscription,
        tier: effectiveSubscription.tier,
        tierName: effectiveSubscription.tierName,
        tierType: effectiveSubscription.tierType,
        isPro,
        isActive: effectiveSubscription.isActive,
        isExpired: effectiveSubscription.isExpired,
        isLoading,
        refetch,
        streakSavers: effectiveSubscription.metadata?.streakSavers ?? 1,
        holidaySavers: effectiveSubscription.metadata?.holidaySavers ?? 0,
        holidayDurationDays: effectiveSubscription.metadata?.holidayDurationDays ?? 14,
        endDate: effectiveSubscription.endDate
    };
}
