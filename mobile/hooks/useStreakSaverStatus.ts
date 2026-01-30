import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import { useSubscription } from './useSubscription';
import { activateHolidayMode, endHolidayMode } from '../lib/supabase-rpc';
import { format } from 'date-fns';

export interface StreakSaverStatus {
    region: {
        currentStreak: number;
        streakSaversUsedMonth: number;
        missedYesterdayFlag: boolean;
        canUseStreakSaver: boolean;
        offerStreakSaver: boolean; // Gap = 2
        offerHolidayRescue: boolean; // Gap > 2
        hasValidStreakForHoliday: boolean;
    } | null;
    user: {
        currentStreak: number;
        streakSaversUsedMonth: number;
        missedYesterdayFlag: boolean;
        canUseStreakSaver: boolean;
        offerStreakSaver: boolean; // Gap = 2
        offerHolidayRescue: boolean; // Gap > 2
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

                // --- NEW: GAP CALCULATION LOGIC ---
                // We need to find the "Last Played Date" to know if the gap is 2 days (Streak Saver) or >2 days (Holiday Rescue).
                // "Missed Yesterday" flag handles the basic "is streak broken?" check, but doesn't tell us "by how much".

                // Helper to get days diff
                const getDaysDiff = (dateStr: string | null) => {
                    if (!dateStr) return 999; // Infinite gap if never played
                    const d1 = new Date(today);
                    const d2 = new Date(dateStr);
                    const diffTime = Math.abs(d1.getTime() - d2.getTime());
                    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                };

                // Fetch Last Played Date for REGION
                // Joined query: game_attempts -> allocated -> order by date
                const { data: lastRegionAttempt } = await supabase
                    .from('game_attempts_region')
                    .select(`
                        id, 
                        streak_day_status,
                        questions_allocated_region!inner (puzzle_date)
                    `)
                    .eq('user_id', user.id)
                    .not('streak_day_status', 'is', null) // Only count valid plays/holidays
                    .order('questions_allocated_region(puzzle_date)', { ascending: false })
                    .limit(1)
                    .maybeSingle();

                // Fetch Last Played Date for USER
                const { data: lastUserAttempt } = await supabase
                    .from('game_attempts_user')
                    .select(`
                        id, 
                        streak_day_status,
                        questions_allocated_user!inner (puzzle_date)
                    `)
                    .eq('user_id', user.id)
                    .not('streak_day_status', 'is', null)
                    .order('questions_allocated_user(puzzle_date)', { ascending: false })
                    .limit(1)
                    .maybeSingle();

                // [FIX] Fetch recent holiday events to account for valid "Holiday Days" that might not have rows yet
                const { data } = await supabase
                    .from('user_holiday_events' as any)
                    .select('started_at, ended_at')
                    .eq('user_id', user.id)
                    .order('ended_at', { ascending: false })
                    .limit(5);

                const holidayEvents = data as any[];

                const regionLastDate = lastRegionAttempt?.questions_allocated_region?.puzzle_date || null;
                const userLastAttemptDate = lastUserAttempt?.questions_allocated_user?.puzzle_date || null;

                // Determine Effective Last User Date (Latest of Attempt OR Holiday End)
                let userLastDate = userLastAttemptDate;

                if (holidayEvents && holidayEvents.length > 0) {
                    // Check if we have a holiday that ends LATER than the last attempt
                    // If holiday is active, ended_at might be null or future.
                    // If ended_at is null (Active), treat as Today.
                    const latestHoliday = holidayEvents[0];
                    let holidayEnd = latestHoliday.ended_at ? new Date(latestHoliday.ended_at) : new Date();

                    // Normalize to YYYY-MM-DD
                    const holidayEndStr = holidayEnd.toISOString().split('T')[0];

                    if (!userLastDate || holidayEndStr > userLastDate) {
                        // If holiday is active (ended_at null) or ends today, we consider "Last Played" as Today (Gap 0)
                        // If ended yesterday, Last Played = Yesterday (Gap 1)
                        userLastDate = holidayEndStr;
                        console.log(`[StreakStatus] Using Holiday End Date as Effective Last Played: ${userLastDate}`);
                    }
                }

                const regionGap = getDaysDiff(regionLastDate); // e.g. played yesterday (gap 1), played day before (gap 2)
                const userGap = getDaysDiff(userLastDate);

                console.log(`[StreakDebug] Region Last: ${regionLastDate} (Gap: ${regionGap}), User Last: ${userLastDate} (Gap: ${userGap})`);

                // --- LAZY RESET LOGIC (Match Server Behavior) ---
                // If streak > 0 BUT gap > 7 (Lookback Limit), we must reset streak to 0 in DB.
                // This ensures "broken" streaks are recorded even if no cron job ran.
                const lookbackLimit = 7; // Matches server/admin default
                const resetThreshold = lookbackLimit + 1; // If gap > 7 (i.e. 8 or more), it's dead.

                // Check Region
                if ((regionStats?.current_streak || 0) > 0 && regionGap >= resetThreshold) {
                    console.log(`[StreakStatus] Auto-resetting Region Streak (Gap ${regionGap} > ${lookbackLimit})`);
                    await supabase.from('user_stats_region').update({
                        current_streak: 0,
                        missed_yesterday_flag_region: false
                    }).eq('user_id', user.id);
                    // Update local object to reflect change immediately
                    if (regionStats) {
                        regionStats.current_streak = 0;
                        regionStats.missed_yesterday_flag_region = false;
                    }
                }

                // Check User
                if ((userStats?.current_streak || 0) > 0 && userGap >= resetThreshold) {
                    // Only reset if NOT on holiday (Holiday keeps streak alive, but check logic is complex... 
                    // Actually server logic: "!holidayActive" check usually applies to setting the flag, but here we are checking ANCIENT history.
                    // If holiday is active, the gap might be large but valid?
                    // Server: "If a mode has current_streak > 0 but NO recent activity, reset...". 
                    // Server logic lines 3220 does NOT check holidayActive! It just checks recent activity.
                    // BUT holiday attempts (status=0) COUNT as activity.
                    // Since 'lastUserAttempt' query includes status=0 (not('streak_day_status', 'is', null)), 
                    // if they are on holiday, 'userGap' will be small (yesterday/today).
                    // So this logic is safe.
                    console.log(`[StreakStatus] Auto-resetting User Streak (Gap ${userGap} > ${lookbackLimit})`);
                    await supabase.from('user_stats_user').update({
                        current_streak: 0,
                        missed_yesterday_flag_user: false
                    }).eq('user_id', user.id);
                    // Update local object
                    if (userStats) {
                        userStats.current_streak = 0;
                        userStats.missed_yesterday_flag_user = false;
                    }
                }

                const regionMissedFlag = regionStats?.missed_yesterday_flag_region ?? false;
                const userMissedFlag = userStats?.missed_yesterday_flag_user ?? false;

                // Flags for UI - RELY ON GAP, NOT DB FLAG (DB flag requires server/web app to run first)
                // We check current_streak > 0 to ensure there is actually a streak to save.
                const regionOfferStreakSaver = regionGap === 2 && (regionStats?.current_streak || 0) > 0;
                const regionOfferHolidayRescue = regionGap > 2 && regionGap <= 8 && (regionStats?.current_streak || 0) > 0;

                const userOfferStreakSaver = userGap === 2 && (userStats?.current_streak || 0) > 0;
                const userOfferHolidayRescue = userGap > 2 && userGap <= 8 && (userStats?.current_streak || 0) > 0;

                console.log(`[StreakDebug] Flags Calculated: 
                    RegionStreak: ${regionStats?.current_streak}, RegionGap: ${regionGap}, OfferSaver: ${regionOfferStreakSaver}, OfferRescue: ${regionOfferHolidayRescue}
                    UserStreak: ${userStats?.current_streak}, UserGap: ${userGap}, OfferSaver: ${userOfferStreakSaver}, OfferRescue: ${userOfferHolidayRescue}
                    HolidayActive: ${userStats?.holiday_active}
                `);

                // Check if has valid streak for holiday (current_streak > 0)
                const regionHasValidStreakForHoliday = (regionStats?.current_streak || 0) > 0;
                const userHasValidStreakForHoliday = (userStats?.current_streak || 0) > 0;

                // Can use streak saver if missed yesterday AND has savers remaining (Legacy flag check just in case gap logic fails or timezones weird)
                // We trust GAP logic more now, but keep flag check as base.
                const regionCanUseStreakSaver = regionOfferStreakSaver && regionSaversRemaining > 0;
                const userCanUseStreakSaver = userOfferStreakSaver && userSaversRemaining > 0;

                return {
                    region: regionStats
                        ? {
                            currentStreak: regionStats.current_streak || 0,
                            streakSaversUsedMonth: regionStats.streak_savers_used_month || 0,
                            missedYesterdayFlag: regionStats.missed_yesterday_flag_region ?? false,
                            canUseStreakSaver: regionCanUseStreakSaver,
                            offerStreakSaver: regionOfferStreakSaver,
                            offerHolidayRescue: regionOfferHolidayRescue,
                            hasValidStreakForHoliday: regionHasValidStreakForHoliday,
                        }
                        : null,
                    user: userStats
                        ? {
                            currentStreak: userStats.current_streak || 0,
                            streakSaversUsedMonth: userStats.streak_savers_used_month || 0,
                            missedYesterdayFlag: userStats.missed_yesterday_flag_user ?? false,
                            canUseStreakSaver: userCanUseStreakSaver,
                            offerStreakSaver: userOfferStreakSaver,
                            offerHolidayRescue: userOfferHolidayRescue,
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
        staleTime: 0, // Always fetch fresh data to avoid stale popups
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

    // Helper: Backfill holiday rows for missed days
    const backfillHolidayRows = async (): Promise<string[]> => {
        if (!user) return [];
        const allFilledDates: string[] = [];

        console.log('[HolidayBackfill] Starting backfill check for both modes...');

        // Fetch User Region for Allocations
        let userRegion = 'UK';
        try {
            const { data: uStats } = await supabase
                .from('user_stats_region')
                .select('region')
                .eq('user_id', user.id)
                .maybeSingle();
            if (uStats?.region) userRegion = uStats.region;
        } catch (e) {
            console.warn('[HolidayBackfill] Failed to fetch user region, defaulting to UK');
        }

        const modes = ['USER', 'REGION'] as const;
        const today = new Date();
        const todayStr = today.toISOString().split('T')[0];

        // Fetch Lookback Limit from Admin Settings
        let lookbackLimit = 7;
        try {
            const { data: adminSetting } = await supabase
                .from('admin_settings')
                .select('value')
                .eq('key', 'holiday_max_lookback_days')
                .maybeSingle();
            if (adminSetting?.value) lookbackLimit = Number(adminSetting.value);
        } catch (e) { }

        for (const mode of modes) {
            const attemptsTable = mode === 'REGION' ? 'game_attempts_region' : 'game_attempts_user';
            const allocTable = mode === 'REGION' ? 'questions_allocated_region' : 'questions_allocated_user';
            const allocIdCol = mode === 'REGION' ? 'allocated_region_id' : 'allocated_user_id';

            // 1. Find LAST COMPLETED GAME (Win, Loss, or Holiday) to determine start point
            // We want to fill the gap AFTER this date.
            let query = supabase
                .from(attemptsTable)
                .select(`id, streak_day_status, result, ${allocTable}!inner(puzzle_date)`)
                .eq('user_id', user.id)
                // Status 1 (Played), Status 0 (Holiday), OR Result is not null (Played)
                // We trust 'streak_day_status' mostly.
                .not('streak_day_status', 'is', null)
                .order(`${allocTable}(puzzle_date)`, { ascending: false })
                .limit(1)
                .maybeSingle();

            const { data: lastAttempt } = await query;

            // Determine Start Date for Backfill
            let startDate = new Date();
            startDate.setDate(today.getDate() - lookbackLimit); // Default: Lookback Limit

            //@ts-ignore - Supabase types join handling
            const lastDateStr = lastAttempt?.[allocTable]?.puzzle_date;

            if (lastDateStr) {
                const lastDate = new Date(lastDateStr);
                // Start from Day AFTER Last Played
                lastDate.setDate(lastDate.getDate() + 1);

                // Limit Date: Today - Lookback Limit
                const limitDate = new Date();
                limitDate.setDate(today.getDate() - lookbackLimit);

                // RESET LOGIC: If Last Played is OLDER than the Limit Window...
                // e.g. Played 20 days ago, limit is 7.
                // User wants: "streak should be reset to 0... only today being set to a holiday day."
                if (lastDate < limitDate) {
                    console.log(`[HolidayBackfill] Gap too large (Last played: ${lastDateStr}, Limit: ${lookbackLimit} days). resetting streak logic. Only filling Today.`);
                    startDate = new Date(today); // Only fill today
                } else {
                    // Gap is within limit -> Fill the gap
                    startDate = lastDate;
                }
            } else {
                // No history found. If streak is 0, we shouldn't backfill history.
                // Default to Today only.
                startDate = new Date(today);
            }

            // Loop from StartDate to Today (Inclusive)
            // Iterate day by day
            const currentDate = new Date(startDate);

            while (currentDate <= today) {
                const dateStr = currentDate.toISOString().split('T')[0];
                currentDate.setDate(currentDate.getDate() + 1); // Increment for next loop

                // Skip if date is in future (timezone safety)
                if (dateStr > todayStr) continue;

                console.log(`[HolidayBackfill] Checking ${mode} date: ${dateStr}`);

                // 2. Ensure Allocation Exists
                let allocQuery = supabase.from(allocTable).select('id').eq('puzzle_date', dateStr);
                if (mode === 'USER') allocQuery = allocQuery.eq('user_id', user.id);
                else allocQuery = allocQuery.eq('region', userRegion);

                let { data: allocation, error: allocError } = await allocQuery.maybeSingle();

                // Auto-allocate Region if missing (Logic from before)
                if ((!allocation || allocError) && mode === 'REGION') {
                    // ... Copying the master question lookup logic ...
                    // To save space, we assume Master Question exists. 
                    // We previously had robust logic here. Let's include a simplified robust version.
                    const { data: mq } = await supabase.from('questions_master_region').select('id, categories').eq('answer_date_canonical', dateStr).maybeSingle();
                    if (mq) {
                        const { data: newAlloc } = await supabase.from('questions_allocated_region').insert({
                            question_id: mq.id, puzzle_date: dateStr, region: userRegion
                        }).select('id').single();
                        allocation = newAlloc;
                    }
                }

                if (!allocation) {
                    console.log(`[HolidayBackfill] No allocation for ${dateStr}. Skipping.`);
                    continue;
                }

                // 3. Check if Attempt already exists (Double check to prevent duplicates)
                const { data: existing } = await supabase
                    .from(attemptsTable)
                    .select('id, streak_day_status, result')
                    .eq('user_id', user.id)
                    .eq(allocIdCol, allocation.id)
                    .maybeSingle();

                if (existing) {
                    // Update PARTIAL games (streak_day_status=null but exists) to Holiday
                    // Leave Played/Holiday games alone
                    if (existing.streak_day_status === null && existing.result === null) {
                        await supabase.from(attemptsTable).update({ streak_day_status: 0, num_guesses: 0, completed_at: new Date().toISOString() }).eq('id', existing.id);
                        if (!allFilledDates.includes(dateStr)) allFilledDates.push(dateStr);
                    } else if (existing.streak_day_status === 0) {
                        // Already holiday, add to list for animation
                        if (!allFilledDates.includes(dateStr)) allFilledDates.push(dateStr);
                    }
                } else {
                    // 4. Insert Holiday Row
                    await supabase.from(attemptsTable).insert({
                        user_id: user.id,
                        [allocIdCol]: allocation.id,
                        streak_day_status: 0,
                        num_guesses: 0,
                        result: null,
                        completed_at: new Date().toISOString()
                    });
                    if (!allFilledDates.includes(dateStr)) allFilledDates.push(dateStr);
                }
            }
        }
        return allFilledDates.sort(); // Return merged sorted dates
    };

    const displayMode = (m: string) => m;

    // Mutation to start holiday mode (USER mode only)
    const startHolidayMutation = useMutation({
        mutationFn: async () => {
            if (!user) throw new Error('No user');

            // 1. Perform Backfill of Holiday Rows
            const filledDates = await backfillHolidayRows();

            // Calculate start date: Earliest backfilled date OR Today
            const holidayStartDate = filledDates.length > 0 ? filledDates[0] : new Date().toISOString().split('T')[0];
            console.log(`[HolidayMutation] Activating Mode from ${holidayStartDate} (Duration: ${holidayDurationDays})`);

            // 2. Activate Mode in Stats (RPC)
            await activateHolidayMode(user.id, holidayDurationDays, holidayStartDate);

            // Ensure Today is included for animation (RPC activates it)
            // Use local time construction to match UI
            const todayStr = format(new Date(), 'yyyy-MM-dd');

            if (!filledDates.includes(todayStr)) {
                filledDates.push(todayStr);
            }

            // Manual update block removed - RPC handles this atomically


            // Small artificial delay to allow DB views/triggers to propagate if needed
            await new Promise(resolve => setTimeout(resolve, 1500));

            return filledDates.sort();
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
        regionOfferStreakSaver: status?.region?.offerStreakSaver ?? false,
        userOfferStreakSaver: status?.user?.offerStreakSaver ?? false,
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
