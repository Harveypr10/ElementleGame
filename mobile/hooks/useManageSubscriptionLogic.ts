/**
 * useManageSubscriptionLogic.ts
 * Shared logic for Manage Subscription screen (mobile + web)
 * 
 * Platform differences:
 * - Mobile: RevenueCat for subscription management
 * - Web: Stripe billing portal + auto-renew toggle
 */

import { useState, useEffect } from 'react';
import { Platform, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useSubscription } from './useSubscription';
import { useStreakSaverStatus } from './useStreakSaverStatus';
import { useProfile } from './useProfile';
import { useUserStats } from './useUserStats';
import { useOptions } from '../lib/options';
import { useThemeColor } from './useThemeColor';
import { supabase } from '../lib/supabase';
import { format } from 'date-fns';

export interface ManageSubscriptionState {
    // Subscription info
    isPro: boolean;
    tierType: string | null;
    endDate: string | null;
    streakSavers: number;
    holidaySavers: number;
    holidayDurationDays: number;

    // Stripe (web only)
    stripeCustomerId: string | null;
    stripeSubscriptionId: string | null;
    autoRenew: boolean;
    isUpdatingAutoRenew: boolean;
    isOpeningBillingPortal: boolean;

    // Holiday mode
    holidayActive: boolean;
    holidayStartDate: string | null;
    holidayEndDate: string | null;
    holidaysRemaining: number;
    holidaysTotal: number;
    hasAnyValidStreakForHoliday: boolean;

    // Streak savers
    regionUsed: number;
    userUsed: number;
    effectiveStreakSavers: number;
    regionLabel: string;

    // Animation state (for holiday activation)
    regionAnimationVisible: boolean;
    userAnimationVisible: boolean;
    regionFilledDates: string[];
    userFilledDates: string[];

    // UI helpers
    nextHolidayResetDate: string | null;
    dateFormatPreference: string | null;
}

export const useManageSubscriptionLogic = () => {
    const router = useRouter();
    const { subscription, isPro, tierType, streakSavers, holidaySavers, holidayDurationDays } = useSubscription();
    const {
        status,
        holidayActive,
        holidayStartDate,
        holidayEndDate,
        endHoliday,
        startHoliday,
        hasAnyValidStreakForHoliday
    } = useStreakSaverStatus();
    const { profile } = useProfile();
    const { textScale } = useOptions();
    const { stats: userStats } = useUserStats('USER');

    // Theme colors
    const backgroundColor = useThemeColor({}, 'background');
    const surfaceColor = useThemeColor({}, 'surface');
    const borderColor = useThemeColor({}, 'border');
    const textColor = useThemeColor({}, 'text');
    const iconColor = useThemeColor({}, 'icon');

    // Animation states for holiday activation
    const [regionAnimationVisible, setRegionAnimationVisible] = useState(false);
    const [userAnimationVisible, setUserAnimationVisible] = useState(false);
    const [regionFilledDates, setRegionFilledDates] = useState<string[]>([]);
    const [userFilledDates, setUserFilledDates] = useState<string[]>([]);

    // Stripe states (web only)
    const [autoRenew, setAutoRenew] = useState<boolean>(subscription?.autoRenew ?? true);
    const [isUpdatingAutoRenew, setIsUpdatingAutoRenew] = useState(false);
    const [isOpeningBillingPortal, setIsOpeningBillingPortal] = useState(false);

    // Sync auto-renew with subscription data
    useEffect(() => {
        if (subscription?.autoRenew !== undefined) {
            setAutoRenew(subscription.autoRenew);
        }
    }, [subscription?.autoRenew]);

    // Calculations
    const regionLabel = profile?.region ? `${profile.region} Edition` : 'UK Edition';
    const regionUsed = status?.region?.streakSaversUsedMonth ?? 0;
    const userUsed = status?.user?.streakSaversUsedMonth ?? 0;
    const effectiveStreakSavers = streakSavers ?? (isPro ? 3 : 1);

    const holidaysUsed = status?.user?.holidaysUsedYear ?? 0;
    const holidaysTotal = holidaySavers ?? 0;
    const holidaysRemaining = Math.max(0, holidaysTotal - holidaysUsed);

    // Format date helper
    const formatDate = (dateStr: string | null): string => {
        if (!dateStr) return 'N/A';
        const date = new Date(dateStr);
        return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    };

    // Format next holiday reset date
    const getFormattedNextHolidayResetDate = (): string => {
        if (!userStats?.next_holiday_reset_date) return '...';
        const dateFormat = profile?.date_format_preference === 'mmddyy' || profile?.date_format_preference === 'mmddyyyy'
            ? 'MM/dd/yyyy'
            : 'dd/MM/yyyy';
        return format(new Date(userStats.next_holiday_reset_date), dateFormat);
    };

    // ============================================================
    // HANDLERS
    // ============================================================

    const handleEndHoliday = () => {
        if (Platform.OS === 'web') {
            // Web: use confirm dialog
            if (window.confirm('Are you sure you want to end your holiday? Your streak protection will stop immediately.')) {
                endHoliday(false).catch(error => {
                    console.error('Failed to end holiday:', error);
                    alert('Failed to end holiday mode. Please try again.');
                });
            }
        } else {
            // Native: use Alert
            Alert.alert(
                'End Holiday Early?',
                'Are you sure you want to end your holiday? Your streak protection will stop immediately.',
                [
                    { text: 'Cancel', style: 'cancel' },
                    {
                        text: 'End Holiday',
                        style: 'destructive',
                        onPress: async () => {
                            try {
                                await endHoliday(false);
                            } catch (error) {
                                console.error('Failed to end holiday:', error);
                                Alert.alert('Error', 'Failed to end holiday mode. Please try again.');
                            }
                        }
                    }
                ]
            );
        }
    };

    const handleStartHoliday = () => {
        if ((holidaySavers ?? 0) <= 0) {
            if (Platform.OS === 'web') {
                alert('You have used all your holiday allowances for this year.');
            } else {
                Alert.alert('No Holidays Remaining', 'You have used all your holiday allowances for this year.');
            }
            return;
        }

        const confirmStart = async () => {
            try {
                const { regionDates, userDates } = await startHoliday();
                console.log('[ManageSubscription] Holiday activated. Region dates:', regionDates, 'User dates:', userDates);

                setRegionFilledDates(regionDates || []);
                setUserFilledDates(userDates || []);
                setRegionAnimationVisible(true);
            } catch (error) {
                console.error('Failed to start holiday:', error);
                if (Platform.OS === 'web') {
                    alert('Failed to start holiday mode. Please try again.');
                } else {
                    Alert.alert('Error', 'Failed to start holiday mode. Please try again.');
                }
            }
        };

        if (Platform.OS === 'web') {
            if (window.confirm(`This will protect your streak for up to ${holidayDurationDays} days.`)) {
                confirmStart();
            }
        } else {
            Alert.alert(
                'Start Holiday Mode?',
                `This will protect your streak for up to ${holidayDurationDays} days.`,
                [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Start Holiday', onPress: confirmStart }
                ]
            );
        }
    };

    // Close Region animation and open User animation
    const handleRegionAnimationClose = () => {
        setRegionAnimationVisible(false);
        console.log('[ManageSubscription] Region modal closed, showing User modal');
        setUserAnimationVisible(true);
    };

    const handleUserAnimationClose = () => {
        setUserAnimationVisible(false);
        console.log('[ManageSubscription] User modal closed, holiday activation complete');
    };

    // ============================================================
    // STRIPE HANDLERS (Web Only)
    // ============================================================

    const handleManageBilling = async () => {
        if (Platform.OS !== 'web') {
            console.warn('Stripe billing portal not available on native');
            return;
        }

        if (!subscription?.stripeCustomerId) {
            alert('No billing account found. Please contact support.');
            return;
        }

        setIsOpeningBillingPortal(true);

        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session?.access_token) {
                throw new Error('Not authenticated');
            }

            const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
            const functionBaseUrl = supabaseUrl.replace('.supabase.co', '.functions.supabase.co');

            const response = await fetch(`${functionBaseUrl}/manage-billing`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.access_token}`,
                },
                body: JSON.stringify({
                    customerId: subscription.stripeCustomerId,
                    returnUrl: window.location.origin + '/manage-subscription',
                }),
            });

            if (!response.ok) {
                throw new Error('Failed to open billing portal');
            }

            const { url } = await response.json();
            window.location.href = url;
        } catch (error) {
            console.error('Failed to open billing portal:', error);
            setIsOpeningBillingPortal(false);
            alert('Failed to open billing portal. Please try again.');
        }
    };

    const handleAutoRenewToggle = async (newValue: boolean) => {
        if (Platform.OS !== 'web' || !isPro) return;

        const previousValue = autoRenew;
        setIsUpdatingAutoRenew(true);
        setAutoRenew(newValue);

        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session?.access_token) {
                throw new Error('Not authenticated');
            }

            const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
            const functionBaseUrl = supabaseUrl.replace('.supabase.co', '.functions.supabase.co');

            const response = await fetch(`${functionBaseUrl}/update-auto-renew`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.access_token}`,
                },
                body: JSON.stringify({
                    stripeSubscriptionId: subscription?.stripeSubscriptionId,
                    autoRenew: newValue,
                }),
            });

            if (!response.ok) {
                throw new Error('Failed to update auto-renew');
            }

            // Success - state already updated optimistically
        } catch (error) {
            console.error('Failed to update auto-renew:', error);
            setAutoRenew(previousValue);
            alert('Failed to update auto-renew setting. Please try again.');
        } finally {
            setIsUpdatingAutoRenew(false);
        }
    };

    const goBack = () => {
        router.back();
    };

    const goToSubscription = () => {
        router.push('/subscription');
    };

    return {
        // State
        isPro,
        tierType,
        endDate: subscription?.endDate ?? null,
        streakSavers: streakSavers ?? 0,
        holidaySavers: holidaySavers ?? 0,
        holidayDurationDays: holidayDurationDays ?? 0,

        // Stripe
        stripeCustomerId: subscription?.stripeCustomerId ?? null,
        stripeSubscriptionId: subscription?.stripeSubscriptionId ?? null,
        autoRenew,
        isUpdatingAutoRenew,
        isOpeningBillingPortal,

        // Holiday
        holidayActive,
        holidayStartDate,
        holidayEndDate,
        holidaysRemaining,
        holidaysTotal,
        hasAnyValidStreakForHoliday,

        // Streak savers
        regionUsed,
        userUsed,
        effectiveStreakSavers,
        regionLabel,

        // Animation
        regionAnimationVisible,
        userAnimationVisible,
        regionFilledDates,
        userFilledDates,

        // Helpers
        formatDate,
        getFormattedNextHolidayResetDate,
        textScale,

        // Theme
        colors: {
            background: backgroundColor,
            surface: surfaceColor,
            border: borderColor,
            text: textColor,
            icon: iconColor,
        },

        // Handlers
        handleEndHoliday,
        handleStartHoliday,
        handleRegionAnimationClose,
        handleUserAnimationClose,
        handleManageBilling,
        handleAutoRenewToggle,
        goBack,
        goToSubscription,
    };
};
