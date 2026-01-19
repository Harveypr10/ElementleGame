import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import { useSubscription } from './useSubscription';

export interface StreakSaverStatus {
    region: {
        currentStreak: number;
        streakSaversUsedMonth: number;
        missedYesterdayFlag: boolean;
        canUseStreakSaver: boolean;
    } | null;
    user: {
        currentStreak: number;
        streakSaversUsedMonth: number;
        missedYesterdayFlag: boolean;
        canUseStreakSaver: boolean;
    } | null;
}

export function useStreakSaverStatus() {
    const { user } = useAuth();
    const queryClient = useQueryClient();
    const { streakSavers } = useSubscription();

    // Fetch streak saver status from database
    const { data: status, isLoading, refetch } = useQuery({
        queryKey: ['streak-saver-status', user?.id],
        queryFn: async () => {
            if (!user) return null;

            try {
                const today = new Date().toISOString().split('T')[0];
                const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
                const dayBeforeYesterday = new Date(Date.now() - 2 * 86400000).toISOString().split('T')[0];

                // Get REGION mode status
                const { data: regionStats } = await supabase
                    .from('user_stats_region')
                    .select('current_streak, streak_savers_used_month, region')
                    .eq('user_id', user.id)
                    .maybeSingle();

                // Get USER mode status
                const { data: userStats } = await supabase
                    .from('user_stats_user')
                    .select('current_streak, streak_savers_used_month')
                    .eq('user_id', user.id)
                    .maybeSingle();

                // Check if missed yesterday for REGION mode
                let regionMissedYesterday = false;
                if (regionStats && regionStats.current_streak > 0) {
                    const { data: yesterdayAttempt } = await supabase
                        .from('game_attempts_region')
                        .select('id, result, streak_day_status, allocated_region_id(puzzle_date)')
                        .eq('user_id', user.id)
                        .maybeSingle();

                    const { data: todayAttempt } = await supabase
                        .from('game_attempts_region')
                        .select('id')
                        .eq('user_id', user.id)
                        .maybeSingle();

                    const { data: dayBeforeAttempt } = await supabase
                        .from('game_attempts_region')
                        .select('result, streak_day_status')
                        .eq('user_id', user.id)
                        .maybeSingle();

                    // Missed yesterday if:
                    // 1. Yesterday has no result OR result is NULL
                    // 2. Yesterday's streak_day_status is NOT 0 (not protected by holiday) and NOT 1 (not played)
                    // 3. Today has NOT been played yet
                    // 4. Day before yesterday WAS won (had streak going)
                    regionMissedYesterday =
                        yesterdayAttempt?.result === null &&
                        yesterdayAttempt?.streak_day_status !== 0 &&
                        yesterdayAttempt?.streak_day_status !== 1 &&
                        !todayAttempt &&
                        dayBeforeAttempt?.result === 'won';
                }

                // Check if missed yesterday for USER mode
                let userMissedYesterday = false;
                if (userStats && userStats.current_streak > 0) {
                    const { data: yesterdayAttempt } = await supabase
                        .from('game_attempts_user')
                        .select('id, result, streak_day_status')
                        .eq('user_id', user.id)
                        .maybeSingle();

                    const { data: todayAttempt } = await supabase
                        .from('game_attempts_user')
                        .select('id')
                        .eq('user_id', user.id)
                        .maybeSingle();

                    const { data: dayBeforeAttempt } = await supabase
                        .from('game_attempts_user')
                        .select('result, streak_day_status')
                        .eq('user_id', user.id)
                        .maybeSingle();

                    userMissedYesterday =
                        yesterdayAttempt?.result === null &&
                        yesterdayAttempt?.streak_day_status !== 0 &&
                        yesterdayAttempt?.streak_day_status !== 1 &&
                        !todayAttempt &&
                        dayBeforeAttempt?.result === 'won';
                }

                const regionSaversRemaining = streakSavers - (regionStats?.streak_savers_used_month || 0);
                const userSaversRemaining = streakSavers - (userStats?.streak_savers_used_month || 0);

                return {
                    region: regionStats
                        ? {
                            currentStreak: regionStats.current_streak || 0,
                            streakSaversUsedMonth: regionStats.streak_savers_used_month || 0,
                            missedYesterdayFlag: regionMissedYesterday,
                            canUseStreakSaver: regionMissedYesterday && regionSaversRemaining > 0,
                        }
                        : null,
                    user: userStats
                        ? {
                            currentStreak: userStats.current_streak || 0,
                            streakSaversUsedMonth: userStats.streak_savers_used_month || 0,
                            missedYesterdayFlag: userMissedYesterday,
                            canUseStreakSaver: userMissedYesterday && userSaversRemaining > 0,
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
        },
    });

    return {
        status,
        isLoading,
        refetch,
        hasMissedRegion: status?.region?.missedYesterdayFlag ?? false,
        hasMissedUser: status?.user?.missedYesterdayFlag ?? false,
        regionCanUseStreakSaver: status?.region?.canUseStreakSaver ?? false,
        userCanUseStreakSaver: status?.user?.canUseStreakSaver ?? false,
        useStreakSaver: useStreakSaverMutation.mutateAsync,
    };
}
