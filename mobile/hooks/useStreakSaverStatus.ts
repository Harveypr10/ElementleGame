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

                const regionLastDate = lastRegionAttempt?.questions_allocated_region?.puzzle_date || null;
                const userLastDate = lastUserAttempt?.questions_allocated_user?.puzzle_date || null;

                const regionGap = getDaysDiff(regionLastDate); // e.g. played yesterday (gap 1), played day before (gap 2)
                const userGap = getDaysDiff(userLastDate);

                console.log(`[StreakDebug] Region Last: ${regionLastDate} (Gap: ${regionGap}), User Last: ${userLastDate} (Gap: ${userGap})`);

                // Logic Rules:
                // Gap = 0: Played today
                // Gap = 1: Played yesterday (Safe)
                // Gap = 2: Missed Yesterday -> OFFER STREAK SAVER
                // Gap > 2: Missed Multiple -> OFFER HOLIDAY RESCUE (up to limit)

                // Admin Setting: Max lookback days for holiday rescue (default 7)
                // "less than today's date minus the value for 'holiday_max_lookback_days'"
                // e.g. if today = 27th, max lookback = 7. 
                // We rescue if last_played >= 27 - 7 = 20th. (Gap <= 7?)
                // User said: "Maximum date allowed... is 7 unplayed days including today".
                // So Gap must be <= 8 (1 played + 7 missed). Logic roughly: if gap > 2 and gap <= 9.
                // Let's stick to safe "Gap > 2 && Gap <= 8" as per Plan.

                const regionMissedFlag = regionStats?.missed_yesterday_flag_region ?? false;
                const userMissedFlag = userStats?.missed_yesterday_flag_user ?? false;

                // Flags for UI - RELY ON GAP, NOT DB FLAG (DB flag requires server/web app to run first)
                // We check current_streak > 0 to ensure there is actually a streak to save.
                const regionOfferStreakSaver = regionGap === 2 && (regionStats?.current_streak || 0) > 0;
                const regionOfferHolidayRescue = regionGap > 2 && regionGap <= 8 && (regionStats?.current_streak || 0) > 0;

                const userOfferStreakSaver = userGap === 2 && (userStats?.current_streak || 0) > 0;
                const userOfferHolidayRescue = userGap > 2 && userGap <= 8 && (userStats?.current_streak || 0) > 0;

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
        const filledDates: string[] = [];

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

        // Fetch Lookback Limit from Admin Settings
        let lookbackLimit = 7; // Default
        try {
            const { data: adminSetting } = await supabase
                .from('admin_settings')
                .select('value')
                .eq('key', 'holiday_max_lookback_days')
                .maybeSingle();

            if (adminSetting?.value) {
                lookbackLimit = Number(adminSetting.value);
                console.log(`[HolidayBackfill] Using dynamic lookback limit: ${lookbackLimit} days`);
            }
        } catch (e) {
            console.warn('[HolidayBackfill] Failed to fetch lookback limit, defaulting to 7');
        }

        try {
            const modes = ['USER', 'REGION'] as const;

            for (const mode of modes) {
                const attemptsTable = mode === 'REGION' ? 'game_attempts_region' : 'game_attempts_user';
                const allocTable = mode === 'REGION' ? 'questions_allocated_region' : 'questions_allocated_user';
                const allocIdCol = mode === 'REGION' ? 'allocated_region_id' : 'allocated_user_id';
                const statsTable = mode === 'REGION' ? 'user_stats_region' : 'user_stats_user';

                // Fetch Current Streak to determine Lookback Strategy
                // [FIX] Use cached status from hook if available to prevent network failures causing bad backfills
                let currentStreak = 0;
                if (mode === 'USER') {
                    currentStreak = status?.user?.currentStreak || 0;
                } else if (mode === 'REGION') {
                    currentStreak = status?.region?.currentStreak || 0;
                }

                let modeLookbackLimit = lookbackLimit;
                // Strict check: if streak is 0, limit to 1 (Today only)
                // This ensures we don't backfill ancient history if user lost their streak.
                if (currentStreak === 0) {
                    console.log(`[HolidayBackfill] ${mode} has 0 streak (Cached). Limiting backfill to Today (1 day).`);
                    modeLookbackLimit = 1;
                } else {
                    console.log(`[HolidayBackfill] ${mode} has streak ${currentStreak}. Using full lookback.`);
                }

                console.log(`[HolidayBackfill] Processing mode: ${mode} with limit ${modeLookbackLimit}`);

                const today = new Date();

                // Use dynamic lookback limit
                for (let i = 0; i < modeLookbackLimit; i++) {
                    const checkDate = new Date(today);
                    checkDate.setDate(today.getDate() - i);
                    const dateStr = checkDate.toISOString().split('T')[0];

                    console.log(`[HolidayBackfill] Checking ${mode} date: ${dateStr}`);

                    // 1. Get Allocated ID for this Date
                    // NOTE: Region table uses (region, puzzle_date), User table uses (user_id, puzzle_date)
                    let query = supabase
                        .from(allocTable)
                        .select('id')
                        .eq('puzzle_date', dateStr);

                    if (mode === 'USER') {
                        query = query.eq('user_id', user.id);
                    } else {
                        query = query.eq('region', userRegion);
                    }

                    let { data: allocation, error: allocError } = await query.maybeSingle();

                    // FIX: If Region allocation missing, auto-allocate
                    // This handles cases where user didn't open app on specific days
                    if ((!allocation || allocError) && mode === 'REGION') {
                        console.log(`[HolidayBackfill] No allocation for REGION ${dateStr}. Attempting to locate puzzle and allocate...`);
                        console.log(`[HolidayBackfill] Using Region: ${userRegion}`);

                        // Find Master Question for this date (Region Mode)
                        let { data: masterQuestion, error: masterError } = await supabase
                            .from('questions_master_region')
                            .select('id, categories, regions')
                            .eq('answer_date_canonical', dateStr)
                            .maybeSingle();

                        // FALLBACK: If specific date missing, get *any* recent master question to ensure allocation
                        if (!masterQuestion) {
                            console.log(`[HolidayBackfill] specific date ${dateStr} not found in master. Trying fallback...`);
                            const { data: fallback, error: fallbackError } = await supabase
                                .from('questions_master_region')
                                .select('id, categories, regions')
                                .order('answer_date_canonical', { ascending: false })
                                .limit(1)
                                .maybeSingle();

                            if (fallback) {
                                console.log(`[HolidayBackfill] Fallback master question found: ${fallback.id}`);
                                masterQuestion = fallback;
                                masterError = null;
                            } else if (fallbackError) {
                                console.error(`[HolidayBackfill] Fallback failed:`, fallbackError);
                            }
                        }

                        if (masterError) console.error(`[HolidayBackfill] Error fetching master question:`, masterError);

                        if (masterQuestion) {
                            console.log(`[HolidayBackfill] Found Master Question ${masterQuestion.id} for ${dateStr}. Categories:`, masterQuestion.categories);

                            // Determine Category ID (Default to 1 if missing/invalid)
                            let catId = 1;
                            if (masterQuestion.categories && Array.isArray(masterQuestion.categories) && masterQuestion.categories.length > 0) {
                                catId = Number(masterQuestion.categories[0]);
                                if (isNaN(catId)) catId = 1;
                            }

                            console.log(`[HolidayBackfill] Inserting allocation: Q=${masterQuestion.id}, Date=${dateStr}, Reg=${userRegion}, Cat=${catId}`);

                            // Insert WITHOUT user_id just for Region Mode
                            const { data: newAlloc, error: createError } = await supabase
                                .from('questions_allocated_region')
                                .insert({
                                    question_id: masterQuestion.id,
                                    puzzle_date: dateStr,
                                    region: userRegion,
                                    category_id: catId
                                })
                                .select('id')
                                .single();

                            if (newAlloc) {
                                console.log(`[HolidayBackfill] Successfully allocated Region puzzle for ${dateStr}. ID=${newAlloc.id}`);
                                allocation = newAlloc;
                                allocError = null;
                            } else if (createError) {
                                console.error(`[HolidayBackfill] Failed to create allocation:`, createError);
                            }
                        } else {
                            console.warn(`[HolidayBackfill] No Master Question found in DB for ${dateStr}. Query returned null.`);
                        }
                    }

                    if (allocError || !allocation) {
                        console.log(`[HolidayBackfill] No allocation found for ${displayMode(mode)} ${dateStr}. Stopping backfill.`);
                        // If we can't allocate, we can't reliably link the game attempt, so we break to avoid inconsistent state.
                        break;
                    }

                    // 2. Check for existing attempt
                    const { data: attempt } = await supabase
                        .from(attemptsTable)
                        .select('id, result, streak_day_status, num_guesses')
                        .eq('user_id', user.id)
                        .eq(allocIdCol, allocation.id)
                        .maybeSingle();

                    if (attempt) {
                        // Game exists. Check if it's protected.

                        // 1. PLAYED / COMPLETED Game (Win or Loss)
                        // If result is set OR streak_day_status is 1, we consider this "Played" and stop backfill.
                        if (attempt.result || attempt.streak_day_status === 1) {
                            console.log(`[HolidayBackfill] Found played/completed game on ${dateStr} (Result: ${attempt.result}, Status: ${attempt.streak_day_status}). Backfill complete.`);
                            break;
                        }

                        // 2. HOLIDAY Status Already Set
                        if (attempt.streak_day_status === 0) {
                            console.log(`[HolidayBackfill] Found existing holiday on ${dateStr}. Including in animation...`);
                            if (!filledDates.includes(dateStr)) {
                                filledDates.push(dateStr);
                            }
                            continue;
                        }

                        // 3. PARTIALLY PLAYED Game (Guesses exits, but no result yet)
                        // User Rule: "if a puzzle is partly played it can only update the streak_day_status to 0 and can't change any other data"
                        if ((attempt.num_guesses || 0) > 0) {
                            console.log(`[HolidayBackfill] Found PARTIALLY PLAYED game on ${dateStr}. Setting Status to Holiday(0) only.`);
                            const { error: partialError } = await supabase
                                .from(attemptsTable)
                                .update({
                                    streak_day_status: 0,
                                    // Do NOT touch result, num_guesses, or digits
                                })
                                .eq('id', attempt.id);

                            if (partialError) throw partialError;

                            if (!filledDates.includes(dateStr)) {
                                filledDates.push(dateStr);
                            }
                            continue;
                        }

                        // 4. MISSED / ARCHIVE (Null result, Null status, 0 guesses)
                        // Safe to convert fully to Holiday
                        console.log(`[HolidayBackfill] Found NULL status attempt on ${dateStr}. Updating to Holiday.`);
                        const { error: updateError } = await supabase
                            .from(attemptsTable)
                            .update({
                                streak_day_status: 0,
                                num_guesses: 0,
                                result: null, // Ensure result is null
                                completed_at: new Date().toISOString()
                            })
                            .eq('id', attempt.id);

                        if (updateError) throw updateError;

                        // Track date
                        if (!filledDates.includes(dateStr)) {
                            filledDates.push(dateStr);
                        }
                        continue; // Continue back to find next gap
                    }

                    // 3. No Attempt Found -> INSERT HOLIDAY ROW
                    console.log(`[HolidayBackfill] No attempt for ${dateStr}. Inserting Holiday Row.`);
                    const insertPayload: any = {
                        user_id: user.id,
                        [allocIdCol]: allocation.id,
                        streak_day_status: 0, // 0 = Holiday
                        num_guesses: 0,
                        result: null,
                        digits: null, // Requirement: NULL digits
                        completed_at: new Date().toISOString()
                    };

                    const { error: insertError } = await supabase
                        .from(attemptsTable)
                        .insert(insertPayload);

                    if (insertError) {
                        console.error(`[HolidayBackfill] Error inserting row for ${dateStr}:`, insertError);
                        throw insertError;
                    }

                    // Track date
                    // Track date
                    if (!filledDates.includes(dateStr)) {
                        filledDates.push(dateStr);
                    }
                }
            }
        } catch (e) {
            console.error('[HolidayBackfill] Error during backfill:', e);
            throw e; // Propagate to mutation
        }
        return filledDates.sort(); // Return sorted dates
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

            // [NEW] Update User Stats manually as requested
            // 1. Increment holidays_used_year (Total activations)
            // 2. Set holiday_days_taken_current_period (Backfilled + Today)
            try {
                const { data: currentStats } = await supabase
                    .from('user_stats_user')
                    .select('holidays_used_year')
                    .eq('user_id', user.id)
                    .maybeSingle();

                const newUsedCount = (currentStats?.holidays_used_year || 0) + 1;
                const daysTakenInitial = filledDates.length; // Includes backfilled + today

                console.log(`[HolidayMutation] Updating Stats: Used=${newUsedCount}, DaysTaken=${daysTakenInitial}`);

                const { error: statsUpdateError } = await supabase
                    .from('user_stats_user')
                    .update({
                        holidays_used_year: newUsedCount,
                        holiday_days_taken_current_period: daysTakenInitial
                    })
                    .eq('user_id', user.id);

                if (statsUpdateError) console.error('[HolidayMutation] Failed to update stats:', statsUpdateError);

            } catch (err) {
                console.error('[HolidayMutation] Error updating stats:', err);
            }

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
