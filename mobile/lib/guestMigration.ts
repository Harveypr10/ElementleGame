/**
 * Guest Data Migration Utilities
 * 
 * Handles migrating guest user data to authenticated user account upon signup.
 * This preserves game progress, streaks, and achievements when converting from guest mode.
 */

import { supabase } from './supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { queryClient } from '../app/_layout';

interface GuestGameData {
    puzzleId: number;
    mode: 'REGION' | 'USER';
    guesses: string[];
    result: 'won' | 'lost' | 'in_progress';
    puzzleDate: string;
    numGuesses?: number;
    digits?: number; // Added digits field
}

const GUEST_GAMES_KEY = 'guest_games_data';
// Note: MIGRATION_COMPLETE_KEY was removed - it permanently blocked future migrations
// The per-game duplicate check in migrateGuestDataToUser is sufficient

/**
 * Store guest game data in AsyncStorage
 */
export async function saveGuestGameData(data: GuestGameData): Promise<void> {
    try {
        const existingDataStr = await AsyncStorage.getItem(GUEST_GAMES_KEY);
        const existingData: GuestGameData[] = existingDataStr ? JSON.parse(existingDataStr) : [];

        // Add new game data
        existingData.push({
            ...data,
            savedAt: new Date().toISOString(),
        } as any);

        await AsyncStorage.setItem(GUEST_GAMES_KEY, JSON.stringify(existingData));
        console.log('[GuestMigration] Saved guest game data:', data.puzzleId);
    } catch (error) {
        console.error('[GuestMigration] Error saving guest game data:', error);
    }
}

/**
 * Migrate guest data to authenticated user account
 */
export async function migrateGuestDataToUser(userId: string): Promise<{
    success: boolean;
    migratedGames: number;
    error?: string;
}> {
    try {
        console.log('[GuestMigration] starting migration scan...');

        // 1. Scan all keys for guest games
        const allKeys = await AsyncStorage.getAllKeys();
        const guestGameKeys = allKeys.filter(key => key.startsWith('guest_game_'));

        console.log(`[GuestMigration] Found ${guestGameKeys.length} guest game keys`);

        if (guestGameKeys.length === 0) {
            console.log('[GuestMigration] No guest data to migrate');
            return { success: true, migratedGames: 0 };
        }

        let migratedCount = 0;
        const migratedModes = new Set<'REGION' | 'USER'>();

        // 2. Iterate and migrate each game
        for (const key of guestGameKeys) {
            try {
                console.log(`[GuestMigration] Processing key: ${key}`);

                // Key format: guest_game_{mode}_{puzzleId}
                // e.g. guest_game_REGION_123 or guest_game_USER_456
                const parts = key.split('_');
                // parts[0]=guest, parts[1]=game, parts[2]=MODE, parts[3]=ID
                if (parts.length < 4) {
                    console.log(`[GuestMigration] Skipping ${key}: Invalid format parts=${parts.length}`);
                    continue;
                }

                const mode = parts[2] as 'REGION' | 'USER';
                // puzzleId might be numeric but AsyncStorage keys are strings
                const puzzleIdRaw = parts[3];

                const storedValue = await AsyncStorage.getItem(key);
                if (!storedValue) {
                    console.log(`[GuestMigration] Skipping ${key}: No stored value`);
                    continue;
                }

                const gameData = JSON.parse(storedValue);
                // Expected: { result, guesses: string[], updatedAt }

                if (!gameData.guesses || !Array.isArray(gameData.guesses)) {
                    console.log(`[GuestMigration] Invalid data for ${key}`, gameData);
                    continue;
                }

                // Determine table and puzzle Link
                const table = mode === 'REGION' ? 'game_attempts_region' : 'game_attempts_user';
                const puzzleIdField = mode === 'REGION' ? 'allocated_region_id' : 'allocated_user_id';
                const guessesTable = mode === 'REGION' ? 'guesses_region' : 'guesses_user';

                // 1. Get Date
                let puzzleDate = gameData.puzzleDate;
                if (!puzzleDate) {
                    console.log(`[GuestMigration] Date missing in data, fetching from DB for ${puzzleIdRaw}...`);
                    const allocationTable = mode === 'REGION' ? 'questions_allocated_region' : 'questions_allocated_user';
                    const { data: allocData } = await supabase.from(allocationTable).select('puzzle_date').eq('id', parseInt(puzzleIdRaw)).single();
                    puzzleDate = allocData?.puzzle_date;
                }
                if (!puzzleDate) {
                    console.log(`[GuestMigration] Skipping ${key}: Could not resolve puzzleDate`);
                    continue;
                }

                // 2. Check existence
                console.log(`[GuestMigration] Checking existence for user=${userId} puzzle=${puzzleIdRaw} in ${table}...`);
                const { data: existing } = await supabase
                    .from(table)
                    .select('id')
                    .eq('user_id', userId)
                    .eq(puzzleIdField, puzzleIdRaw)
                    .maybeSingle();

                if (existing) {
                    console.log(`[GuestMigration] Skipping ${key}: Attempt exists (id=${existing.id})`);
                    // If it exists, we assume migration is done for this one. 
                    await AsyncStorage.removeItem(key);
                    continue;
                }

                console.log(`[GuestMigration] Inserting attempt for ${key} date=${puzzleDate} result=${gameData.result}`);

                // 3. Insert Attempt
                const { data: newAttempt, error: insertError } = await supabase
                    .from(table)
                    .insert({
                        user_id: userId,
                        [puzzleIdField]: parseInt(puzzleIdRaw),
                        // puzzle_date removed: column does not exist on attempts table
                        result: gameData.result === 'in_progress' ? null : gameData.result,
                        num_guesses: gameData.guesses.length,
                        started_at: gameData.updatedAt || new Date().toISOString(),
                        completed_at: gameData.result ? (gameData.updatedAt || new Date().toISOString()) : null,
                        digits: gameData.digits ? gameData.digits.toString() : '8', // Use saved digits or default
                        streak_day_status: gameData.result === 'won' ? 1 : null // Set streak legacy status
                    })
                    .select('id')
                    .single();

                if (insertError || !newAttempt) {
                    console.error(`[GuestMigration] Failed to insert attempt ${key}`, insertError);
                    continue;
                }

                console.log(`[GuestMigration] Attempt created: ${newAttempt.id}. Inserting guesses...`);

                // 4. Insert Guesses
                if (gameData.guesses.length > 0) {
                    console.log(`[GuestMigration] Inserting ${gameData.guesses.length} guesses for attempt ${newAttempt.id}`);
                    const guessRows = gameData.guesses.map((g: string) => ({
                        game_attempt_id: newAttempt.id,
                        guess_value: g,
                        guessed_at: gameData.updatedAt || new Date().toISOString() // Ensure timestamp is present
                    }));

                    const { error: guessInsertError } = await supabase.from(guessesTable).insert(guessRows);
                    if (guessInsertError) {
                        console.error(`[GuestMigration] Failed to insert guesses for ${newAttempt.id}`, guessInsertError);
                    } else {
                        console.log(`[GuestMigration] Successfully inserted guesses for ${newAttempt.id}`);
                    }
                } else {
                    console.log(`[GuestMigration] No guesses to insert for ${key}`);
                }

                migratedModes.add(mode);

                migratedCount++;
                // Remove key
                await AsyncStorage.removeItem(key);
                console.log(`[GuestMigration] Removed key ${key}`);
            } catch (innerError) {
                console.error(`[GuestMigration] processing error for ${key}`, innerError);
            }
        }

        console.log(`[GuestMigration] Migration complete: ${migratedCount} games migrated`);

        // Recalculate stats for affected modes
        for (const mode of Array.from(migratedModes)) {
            await recalculateStatsForMode(userId, mode);
        }

        // Invalidate queries to refresh UI with migrated data
        if (migratedCount > 0) {
            console.log('[GuestMigration] Invalidating queries to refresh UI...');
            // Use partial keys - React Query matches all queries that start with these
            queryClient.invalidateQueries({ queryKey: ['userStats'] });
            queryClient.invalidateQueries({ queryKey: ['streak-saver-status'] });
            queryClient.invalidateQueries({ queryKey: ['pendingBadges'] });
            queryClient.invalidateQueries({ queryKey: ['game-attempts'] });
        }

        return { success: true, migratedGames: migratedCount };

    } catch (error: any) {
        console.error('[GuestMigration] Migration failed:', error);
        return {
            success: false,
            migratedGames: 0,
            error: error?.message || 'Unknown error'
        };
    }
}

/**
 * Re-calculate user stats from DB attempts (Mirrors useGameEngine logic)
 */
async function recalculateStatsForMode(userId: string, mode: 'REGION' | 'USER') {
    try {
        console.log(`[GuestMigration] Recalculating stats for ${mode}...`);

        const ATTEMPTS_TABLE = mode === 'REGION' ? 'game_attempts_region' : 'game_attempts_user';
        const STATS_TABLE = mode === 'REGION' ? 'user_stats_region' : 'user_stats_user';

        // Get user's region if in REGION mode
        let userRegion = 'UK';
        if (mode === 'REGION') {
            const { data: profile } = await supabase
                .from('user_profiles')
                .select('region')
                .eq('id', userId)
                .single();
            userRegion = profile?.region || 'UK';
        }

        // Fetch ALL attempts
        let query = supabase
            .from(ATTEMPTS_TABLE)
            .select(`
                id,
                result,
                num_guesses,
                completed_at,
                streak_day_status,
                ${mode === 'REGION' ? 'questions_allocated_region(puzzle_date, region)' : 'questions_allocated_user(puzzle_date)'}
            `)
            .eq('user_id', userId);

        const { data: allAttempts, error: attemptsError } = await query;

        if (attemptsError || !allAttempts) {
            console.error('[GuestMigration] Error fetching attempts for stats:', attemptsError);
            return;
        }

        // Filter by region and valid status
        const filteredAttempts = (mode === 'REGION'
            ? allAttempts.filter((a: any) => a.questions_allocated_region?.region === userRegion)
            : allAttempts).filter((a: any) => a.result !== null || (a.streak_day_status !== null && a.streak_day_status !== undefined));

        // Calculate stats
        const playedGames = filteredAttempts.filter((a: any) => a.result !== null);
        const gamesPlayed = playedGames.length;
        const gamesWon = playedGames.filter((a: any) => a.result === 'won').length;

        const guessDistribution: Record<string, number> = { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 };
        playedGames.forEach((attempt: any) => {
            if (attempt.result === 'won' && attempt.num_guesses >= 1 && attempt.num_guesses <= 5) {
                const key = attempt.num_guesses.toString();
                guessDistribution[key] = (guessDistribution[key] || 0) + 1;
            }
        });

        // Calculate Streak
        const dateMap = new Map<string, { result: string | null; streakDayStatus: number | null }>();
        for (const attempt of filteredAttempts) {
            const puzzleDate = mode === 'REGION'
                ? (attempt as any).questions_allocated_region?.puzzle_date
                : (attempt as any).questions_allocated_user?.puzzle_date;

            if (puzzleDate) {
                const streakStatus = (attempt as any).streak_day_status;
                if (streakStatus !== null && streakStatus !== undefined) {
                    dateMap.set(puzzleDate, { result: (attempt as any).result, streakDayStatus: streakStatus });
                } else if ((attempt as any).result !== null) {
                    dateMap.set(puzzleDate, { result: (attempt as any).result, streakDayStatus: null });
                }
            }
        }

        // Find max date (today or last played)
        let maxDateStr = new Date().toISOString().split('T')[0];
        filteredAttempts.forEach((a: any) => {
            const d = mode === 'REGION' ? a.questions_allocated_region?.puzzle_date : a.questions_allocated_user?.puzzle_date;
            if (d && d > maxDateStr) maxDateStr = d;
        });

        let checkDate = new Date(maxDateStr);
        let currentStreak = 0;

        // Loop backwards from max date
        while (true) {
            const dateStr = checkDate.toISOString().split('T')[0];
            const dayData = dateMap.get(dateStr);

            if (!dayData) break;
            if (dayData.streakDayStatus === null || dayData.streakDayStatus === undefined) break;

            currentStreak += dayData.streakDayStatus;
            checkDate.setDate(checkDate.getDate() - 1);
        }

        // Max Streak
        const sortedDates = Array.from(dateMap.keys()).sort();
        let maxStreak = 0;
        let tempStreak = 0;
        let prevDate: Date | null = null;

        for (const currentDateStr of sortedDates) {
            const currentDate = new Date(currentDateStr);
            const dayData = dateMap.get(currentDateStr);

            if (!dayData) {
                tempStreak = 0;
                prevDate = null;
                continue;
            }

            if (prevDate) {
                const dayDiff = Math.ceil((currentDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24));
                if (dayDiff > 1) tempStreak = 0;
            }

            if (dayData.streakDayStatus === null || dayData.streakDayStatus === undefined) {
                tempStreak = 0;
            } else {
                tempStreak += dayData.streakDayStatus;
                maxStreak = Math.max(maxStreak, tempStreak);
            }
            prevDate = currentDate;
        }

        // Upsert Stats
        const statsData: any = {
            user_id: userId,
            games_played: gamesPlayed,
            games_won: gamesWon,
            current_streak: currentStreak,
            max_streak: maxStreak,
            guess_distribution: guessDistribution
        };
        if (mode === 'REGION') statsData.region = userRegion;

        const matchCriteria = mode === 'REGION' ? { user_id: userId, region: userRegion } : { user_id: userId };

        // Check existing
        const { data: existingStats } = await supabase
            .from(STATS_TABLE)
            .select('id')
            .match(matchCriteria)
            .maybeSingle();

        if (existingStats) {
            await supabase.from(STATS_TABLE).update(statsData).eq('id', existingStats.id);
        } else {
            await supabase.from(STATS_TABLE).insert(statsData);
        }

        console.log(`[GuestMigration] Stats recalculated for ${mode}: Streak=${currentStreak}, Max=${maxStreak}`);

    } catch (error) {
        console.error(`[GuestMigration] Failed to recalculate stats for ${mode}`, error);
    }

}

/**
 * Clear guest migration state (for testing/debugging)
 */
export async function clearGuestMigrationState(): Promise<void> {
    try {
        // Clear all guest game keys
        const allKeys = await AsyncStorage.getAllKeys();
        const guestGameKeys = allKeys.filter(key => key.startsWith('guest_game_'));

        await Promise.all([
            AsyncStorage.removeItem(GUEST_GAMES_KEY),
            ...guestGameKeys.map(key => AsyncStorage.removeItem(key))
        ]);
        console.log('[GuestMigration] Cleared migration state');
    } catch (error) {
        console.error('[GuestMigration] Error clearing migration state:', error);
    }
}

/**
 * Get guest game count (for displaying to user)
 */
export async function getGuestGameCount(): Promise<number> {
    try {
        const guestDataStr = await AsyncStorage.getItem(GUEST_GAMES_KEY);
        if (!guestDataStr) return 0;

        const guestGames: GuestGameData[] = JSON.parse(guestDataStr);
        return guestGames.length;
    } catch (error) {
        console.error('[GuestMigration] Error getting guest game count:', error);
        return 0;
    }
}
