/**
 * useGoProLogic.ts
 * Shared logic for Go Pro / Subscribe screen
 * 
 * Platform differences:
 * - Mobile: RevenueCat Paywall (handled in .native.tsx)
 * - Web: Stripe checkout via /api/subscription/create-checkout
 */

import { useState, useEffect } from 'react';
import { Platform } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSubscription } from './useSubscription';
import { useAuth } from '../lib/auth';
import { useThemeColor } from './useThemeColor';
import { supabase } from '../lib/supabase';

// Tier data from user_tier table
export interface TierData {
    id: string;
    region: string;
    tier: string;
    tierType: string; // 'monthly', 'annual', 'lifetime', 'default'
    subscriptionCost: number | null;
    currency: string | null;
    subscriptionDurationMonths: number | null;
    streakSavers: number;
    holidaySavers: number;
    holidayDurationDays: number;
    description: string | null;
    sortOrder: number;
}

// Format price helper
export function formatPrice(amount: number | null, currency: string | null): string {
    if (amount === null) return 'Free';
    const symbol = currency === 'GBP' ? '£' : currency === 'USD' ? '$' : currency || '';
    return `${symbol}${parseFloat(String(amount)).toFixed(2)}`;
}

// Get icon styling based on tier type
export function getTierStyle(tierType: string) {
    switch (tierType) {
        case 'monthly':
            return {
                displayName: 'Monthly',
                color: '#b45309', // amber-700
                bgColor: '#fef3c7', // amber-100
            };
        case 'annual':
            return {
                displayName: 'Annual',
                color: '#6b7280', // gray-500
                bgColor: '#f3f4f6', // gray-100
            };
        case 'lifetime':
            return {
                displayName: 'Lifetime*',
                color: '#ca8a04', // yellow-600
                bgColor: '#fef9c3', // yellow-100
            };
        default:
            return {
                displayName: tierType,
                color: '#6b7280',
                bgColor: '#f3f4f6',
            };
    }
}

export const useGoProLogic = () => {
    const router = useRouter();
    const { from } = useLocalSearchParams<{ from?: string }>();
    const { isPro } = useSubscription();
    const { user, isAuthenticated } = useAuth();

    // State
    const [tiers, setTiers] = useState<TierData[]>([]);
    const [tiersLoading, setTiersLoading] = useState(true);
    const [selectedTier, setSelectedTier] = useState<TierData | null>(null);
    const [showConfirmDialog, setShowConfirmDialog] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Theme colors
    const backgroundColor = useThemeColor({}, 'background');
    const surfaceColor = useThemeColor({}, 'surface');
    const borderColor = useThemeColor({}, 'border');
    const textColor = useThemeColor({}, 'text');
    const iconColor = useThemeColor({}, 'icon');

    // Redirect if already Pro
    useEffect(() => {
        if (isPro) {
            router.replace('/manage-subscription');
        }
    }, [isPro]);

    // Fetch tiers (web only - mobile uses RevenueCat)
    useEffect(() => {
        if (Platform.OS !== 'web') return;

        const fetchTiers = async () => {
            setTiersLoading(true);
            try {
                const { data: { session } } = await supabase.auth.getSession();
                if (!session) {
                    setTiers([]);
                    return;
                }

                const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
                const response = await fetch(`${supabaseUrl}/rest/v1/user_tier?region=eq.UK&tier=neq.standard&active=eq.true&order=sort_order`, {
                    headers: {
                        'Authorization': `Bearer ${session.access_token}`,
                        'apikey': process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '',
                    },
                });

                if (!response.ok) {
                    throw new Error('Failed to fetch tiers');
                }

                const data = await response.json();
                // Map snake_case to camelCase
                const mappedTiers = data.map((t: any) => ({
                    id: t.id,
                    region: t.region,
                    tier: t.tier,
                    tierType: t.tier_type,
                    subscriptionCost: t.subscription_cost,
                    currency: t.currency,
                    subscriptionDurationMonths: t.subscription_duration_months,
                    streakSavers: t.streak_savers,
                    holidaySavers: t.holiday_savers,
                    holidayDurationDays: t.holiday_duration_days,
                    description: t.description,
                    sortOrder: t.sort_order,
                }));
                setTiers(mappedTiers);
            } catch (err) {
                console.error('Failed to fetch tiers:', err);
                setError('Failed to load pricing. Please refresh the page.');
            } finally {
                setTiersLoading(false);
            }
        };

        if (isAuthenticated) {
            fetchTiers();
        }
    }, [isAuthenticated]);

    // ============================================================
    // HANDLERS
    // ============================================================

    const handleTierClick = (tier: TierData) => {
        if (!isAuthenticated) {
            router.push('/(auth)/login');
            return;
        }

        setSelectedTier(tier);
        setShowConfirmDialog(true);
    };

    const handleCancelConfirm = () => {
        setShowConfirmDialog(false);
        setSelectedTier(null);
    };

    const handleConfirmSubscription = async () => {
        if (!selectedTier || Platform.OS !== 'web') return;

        setIsProcessing(true);
        setShowConfirmDialog(false);

        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) {
                throw new Error('Not authenticated');
            }

            const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
            const functionBaseUrl = supabaseUrl.replace('.supabase.co', '.functions.supabase.co');

            const response = await fetch(`${functionBaseUrl}/create-checkout`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.access_token}`,
                },
                body: JSON.stringify({ tierId: selectedTier.id }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to create checkout');
            }

            const result = await response.json();

            if (result.url) {
                // Redirect to Stripe Checkout
                window.location.href = result.url;
            } else {
                throw new Error('No checkout URL returned');
            }
        } catch (err: any) {
            console.error('Stripe checkout error:', err);
            setError(err.message || 'Failed to start checkout. Please try again.');
            setIsProcessing(false);
            setSelectedTier(null);
        }
    };

    const goBack = () => {
        router.back();
    };

    return {
        // State
        isPro,
        isAuthenticated,
        tiers,
        tiersLoading,
        selectedTier,
        showConfirmDialog,
        isProcessing,
        error,
        from,

        // Theme
        colors: {
            background: backgroundColor,
            surface: surfaceColor,
            border: borderColor,
            text: textColor,
            icon: iconColor,
        },

        // Handlers
        handleTierClick,
        handleCancelConfirm,
        handleConfirmSubscription,
        goBack,

        // Helpers
        formatPrice,
        getTierStyle,
    };
};
