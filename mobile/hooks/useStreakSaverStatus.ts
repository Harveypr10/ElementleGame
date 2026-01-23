import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import { useSubscription } from './useSubscription';
import { activateHolidayMode, endHolidayMode } from '../lib/supabase-rpc';

export interface StreakSaverStatus {
    region: {
        currentStreak: number;
        streakSaversUsedMonth: number;
        missedYesterdayFlag: boolean;
        canUseStreakSaver: boolean;
        hasValidStreakForHoliday: boolean;
    } | null;
    user: {
        currentStreak: number;
        streakSaversUsedMonth: number;
        missedYesterdayFlag: boolean;
        canUseStreakSaver: boolean;
        holidayActive: boolean;
        holidayStartDate: string | null;
        holidayEndDate: string | null;
        holidayDaysTakenCurrentPeriod: number;
        holidayEnded: boolean;
        holidaysUsedYear: number;
        hasValidStreakForHoliday: boolean;
    } | null;
}

export function useStreakSaverStatus() {
    const { user } = useAuth();
    const queryClient = useQueryClient();
    const { streakSavers, holidaySavers, holidayDurationDays, isPro } = useSubscription();

    // Fetch streak saver status from database
    const { data: status, isLoading, refetch } = useQuery({
        queryKey: ['streak-saver-status', user?.id],
        queryFn: async () => {
            if (!user) return null;

            try {
                const today = new Date().toISOString().split('T')[0];
                const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
                const dayBeforeYesterday = new Date(Date.now() - 2 * 86400000).toISOString().split('T')[0];

                // Get USER mode status (includes holiday fields)
                const { data: userStats } = await supabase
                    .from('user_stats_user')
                    .select(`
                        current_streak,
                        streak_savers_used_month,
                        holiday_active,
                        holiday_start_date,
                        holiday_end_date,
                        holiday_days_taken_current_period,
                        holiday_ended,
                        holidays_used_year,
                        missed_yesterday_flag_user
                    `)
                    .eq('user_id', user.id)
                    .maybeSingle();

                // Get REGION mode status (simpler - no holiday mode in region)
                const { data: regionStats } = await supabase
                    .from('user_stats_region')
                    .select('current_streak, streak_savers_used_month, region, missed_yesterday_flag_region')
                    .eq('user_id', user.id)
                    .maybeSingle();

                // Calculate savers remaining
                const regionSaversRemaining = streakSavers - (regionStats?.streak_savers_used_month || 0);
                const userSaversRemaining = streakSavers - (userStats?.streak_savers_used_month || 0);

                // Check if has valid streak for holiday (current_streak > 0)
                const regionHasValidStreakForHoliday = (regionStats?.current_streak || 0) > 0;
                const userHasValidStreakForHoliday = (userStats?.current_streak || 0) > 0;

                // Can use streak saver if missed yesterday AND has savers remaining
                const regionCanUseStreakSaver = (regionStats?.missed_yesterday_flag_region ?? false) && regionSaversRemaining > 0;
                const userCanUseStreakSaver = (userStats?.missed_yesterday_flag_user ?? false) && userSaversRemaining > 0;

                return {
                    region: regionStats
                        ? {
                            currentStreak: regionStats.current_streak || 0,
                            streakSaversUsedMonth: regionStats.streak_savers_used_month || 0,
                            missedYesterdayFlag: regionStats.missed_yesterday_flag_region ?? false,
                            canUseStreakSaver: regionCanUseStreakSaver,
                            hasValidStreakForHoliday: regionHasValidStreakForHoliday,
                        }
                        : null,
                    user: userStats
                        ? {
                            currentStreak: userStats.current_streak || 0,
                            streakSaversUsedMonth: userStats.streak_savers_used_month || 0,
                            missedYesterdayFlag: userStats.missed_yesterday_flag_user ?? false,
                            canUseStreakSaver: userCanUseStreakSaver,
                            holidayActive: userStats.holiday_active || false,
                            holidayStartDate: userStats.holiday_start_date,
                            holidayEndDate: userStats.holiday_end_date,
                            holidayDaysTakenCurrentPeriod: userStats.holiday_days_taken_current_period || 0,
                            holidayEnded: userStats.holiday_ended || false,
                            holidaysUsedYear: userStats.holidays_used_year || 0,
                            hasValidStreakForHoliday: userHasValidStreakForHoliday,
                        }
                        : null,
                };
            } catch (error) {
                console.error('[useStreakSaverStatus] Error:', error);
                return null;
            }
        },
        enabled: !!user,
        staleTime: 60 * 1000, // Cache for 1 minute
    });

    // Mutation to mark streak saver as used
    const useStreakSaverMutation = useMutation({
        mutationFn: async (gameType: 'REGION' | 'USER') => {
            if (!user) throw new Error('No user');

            const tableName = gameType === 'REGION' ? 'user_stats_region' : 'user_stats_user';

            // First fetch current value
            const { data, error: fetchError } = await supabase
                .from(tableName)
                .select('streak_savers_used_month')
                .eq('user_id', user.id)
                .single();

            if (fetchError) throw fetchError;

            // Then update with incremented value
            const { error: updateError } = await supabase
                .from(tableName)
                .update({
                    streak_savers_used_month: (data?.streak_savers_used_month || 0) + 1,
                })
                .eq('user_id', user.id);

            if (updateError) throw updateError;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['streak-saver-status'] });
            queryClient.invalidateQueries({ queryKey: ['user-stats'] });
        },
    });

    // Mutation to decline streak saver (reset streak to 0)
    const declineStreakSaverMutation = useMutation({
        mutationFn: async (gameType: 'REGION' | 'USER') => {
            if (!user) throw new Error('No user');

            const tableName = gameType === 'REGION' ? 'user_stats_region' : 'user_stats_user';
            const missedFlagColumn = gameType === 'REGION' ? 'missed_yesterday_flag_region' : 'missed_yesterday_flag_user';

            // Reset current streak to 0 and clear missed flag
            const { error: updateError } = await supabase
                .from(tableName)
                .update({
                    current_streak: 0,
                    [missedFlagColumn]: false,
                })
                .eq('user_id', user.id);

            if (updateError) throw updateError;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['streak-saver-status'] });
            queryClient.invalidateQueries({ queryKey: ['user-stats'] });
        },
    });

    // Mutation to start holiday mode (USER mode only)
    const startHolidayMutation = useMutation({
        mutationFn: async () => {
            if (!user) throw new Error('No user');
            await activateHolidayMode(user.id, holidayDurationDays);
            // Small artificial delay to allow DB views/triggers to propagate if needed
            await new Promise(resolve => setTimeout(resolve, 500));
        },
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: ['streak-saver-status'] });
            await queryClient.invalidateQueries({ queryKey: ['user-stats'] });
            await queryClient.invalidateQueries({ queryKey: ['game-attempts'] });
            // Force refetch to ensure UI updates immediately
            refetch();
        },
    });

    // Mutation to end holiday mode
    const endHolidayMutation = useMutation({
        mutationFn: async (acknowledge?: boolean) => {
            if (!user) throw new Error('No user');
            await endHolidayMode(user.id, acknowledge);
            // Small artificial delay to allow DB views/triggers to propagate if needed
            await new Promise(resolve => setTimeout(resolve, 500));
        },
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: ['streak-saver-status'] });
            await queryClient.invalidateQueries({ queryKey: ['user-stats'] });
            refetch();
        },
    });

    // Derived values
    const hasMissedRegion = status?.region?.missedYesterdayFlag ?? false;
    const hasMissedUser = status?.user?.missedYesterdayFlag ?? false;
    const hasMissedAny = hasMissedRegion || hasMissedUser;

    const regionCanUseStreakSaver = status?.region?.canUseStreakSaver ?? false;
    const userCanUseStreakSaver = status?.user?.canUseStreakSaver ?? false;

    const holidayActive = status?.user?.holidayActive ?? false;
    const holidayEndDate = status?.user?.holidayEndDate ?? null;
    const holidayStartDate = status?.user?.holidayStartDate ?? null;
    const holidayEnded = status?.user?.holidayEnded ?? false;
    const holidayDaysTakenCurrentPeriod = status?.user?.holidayDaysTakenCurrentPeriod ?? 0;

    const regionStreakSaversRemaining = streakSavers - (status?.region?.streakSaversUsedMonth ?? 0);
    const userStreakSaversRemaining = streakSavers - (status?.user?.streakSaversUsedMonth ?? 0);

    const holidaysRemaining = holidaySavers - (status?.user?.holidaysUsedYear ?? 0);

    const regionHasValidStreakForHoliday = status?.region?.hasValidStreakForHoliday ?? false;
    const userHasValidStreakForHoliday = status?.user?.hasValidStreakForHoliday ?? false;
    const hasAnyValidStreakForHoliday = regionHasValidStreakForHoliday || userHasValidStreakForHoliday;

    return {
        status,
        isLoading,
        refetch,
        hasMissedRegion,
        hasMissedUser,
        hasMissedAny,
        regionCanUseStreakSaver,
        userCanUseStreakSaver,
        holidayActive,
        holidayStartDate,
        holidayEndDate,
        holidayEnded,
        holidayDaysTakenCurrentPeriod,
        regionStreakSaversRemaining,
        userStreakSaversRemaining,
        holidaysRemaining,
        regionHasValidStreakForHoliday,
        userHasValidStreakForHoliday,
        hasAnyValidStreakForHoliday,
        isPro,
        holidayDurationDays,
        // Mutations
        useStreakSaver: useStreakSaverMutation.mutateAsync,
        isUsingStreakSaver: useStreakSaverMutation.isPending,
        declineStreakSaver: declineStreakSaverMutation.mutateAsync,
        isDeclining: declineStreakSaverMutation.isPending,
        startHoliday: startHolidayMutation.mutateAsync,
        isStartingHoliday: startHolidayMutation.isPending,
        endHoliday: endHolidayMutation.mutateAsync,
        isEndingHoliday: endHolidayMutation.isPending,
        acknowledgeHolidayEnd: () => endHolidayMutation.mutateAsync(true),
    };
}
