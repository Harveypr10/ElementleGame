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

        // Retrieve guest game data
        const guestDataStr = await AsyncStorage.getItem(GUEST_GAMES_KEY);
        if (!guestDataStr) {
            console.log('[GuestMigration] No guest data to migrate');
            await AsyncStorage.setItem(MIGRATION_COMPLETE_KEY, 'true');
            return { success: true, migratedGames: 0 };
        }

        const guestGames: GuestGameData[] = JSON.parse(guestDataStr);
        console.log(`[GuestMigration] Found ${guestGames.length} guest games to migrate`);

        let migratedCount = 0;

        // Migrate each game
        for (const game of guestGames) {
            try {
                const table = game.mode === 'REGION' ? 'game_attempts_region' : 'game_attempts_user';

                // Check if this game already exists for the user
                const { data: existingAttempt } = await supabase
                    .from(table)
                    .select('id')
                    .eq('user_id', userId)
                    .eq('puzzle_date', game.puzzleDate)
                    .maybeSingle();

                if (existingAttempt) {
                    console.log(`[GuestMigration] Skipping ${game.puzzleDate} - already exists`);
                    continue;
                }

                // Insert game attempt
                const { error: insertError } = await supabase
                    .from(table)
                    .insert({
                        user_id: userId,
                        puzzle_date: game.puzzleDate,
                        result: game.result === 'in_progress' ? null : game.result,
                        num_guesses: game.numGuesses || game.guesses.length,
                        guesses: game.guesses,
                        created_at: (game as any).savedAt || new Date().toISOString(),
                        updated_at: new Date().toISOString(),
                    });

                if (insertError) {
                    console.error(`[GuestMigration] Error migrating game ${game.puzzleDate}:`, insertError);
                } else {
                    migratedCount++;
                    console.log(`[GuestMigration] Migrated game ${game.puzzleDate}`);
                }
            } catch (gameError) {
                console.error('[GuestMigration] Error migrating individual game:', gameError);
            }
        }

        // Mark migration as complete
        await AsyncStorage.setItem(MIGRATION_COMPLETE_KEY, 'true');

        // Optionally clear guest data after successful migration
        await AsyncStorage.removeItem(GUEST_GAMES_KEY);

        console.log(`[GuestMigration] Migration complete: ${migratedCount}/${guestGames.length} games migrated`);

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
