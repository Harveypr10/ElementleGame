/**
 * Guest Data Migration Utilities
 * 
 * Handles migrating guest user data to authenticated user account upon signup.
 * This preserves game progress, streaks, and achievements when converting from guest mode.
 */

import { supabase } from './supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface GuestGameData {
    puzzleId: number;
    mode: 'REGION' | 'USER';
    guesses: string[];
    result: 'won' | 'lost' | 'in_progress';
    puzzleDate: string;
    numGuesses?: number;
}

const GUEST_GAMES_KEY = 'guest_games_data';
const MIGRATION_COMPLETE_KEY = 'guest_migration_complete';

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
        // Check if migration already completed
        const migrationComplete = await AsyncStorage.getItem(MIGRATION_COMPLETE_KEY);
        if (migrationComplete === 'true') {
            console.log('[GuestMigration] Migration already completed');
            return { success: true, migratedGames: 0 };
        }

        console.log('[GuestMigration] starting migration scan...');

        // 1. Scan all keys for guest games
        const allKeys = await AsyncStorage.getAllKeys();
        const guestGameKeys = allKeys.filter(key => key.startsWith('guest_game_'));

        console.log(`[GuestMigration] Found ${guestGameKeys.length} guest game keys`);

        if (guestGameKeys.length === 0) {
            console.log('[GuestMigration] No guest data to migrate');
            await AsyncStorage.setItem(MIGRATION_COMPLETE_KEY, 'true');
            return { success: true, migratedGames: 0 };
        }

        let migratedCount = 0;

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
                    const { data: allocData } = await supabase.from(allocationTable).select('puzzle_date').eq('id', puzzleIdRaw).single();
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
                        digits: '8', // Defaulting to 8, unable to know for sure from guest data unless saved
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

                migratedCount++;
                // Remove key
                await AsyncStorage.removeItem(key);
                console.log(`[GuestMigration] Removed key ${key}`);
            } catch (innerError) {
                console.error(`[GuestMigration] processing error for ${key}`, innerError);
            }
        }

        // Mark migration as complete
        await AsyncStorage.setItem(MIGRATION_COMPLETE_KEY, 'true');

        console.log(`[GuestMigration] Migration complete: ${migratedCount} games migrated`);
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
 * Clear guest migration state (for testing/debugging)
 */
export async function clearGuestMigrationState(): Promise<void> {
    try {
        await Promise.all([
            AsyncStorage.removeItem(GUEST_GAMES_KEY),
            AsyncStorage.removeItem(MIGRATION_COMPLETE_KEY),
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
