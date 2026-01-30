import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';

export const SYNC_STORAGE_PREFIX = 'pending_game_';

interface PendingGameState {
    userId: string;
    mode: 'REGION' | 'USER';
    puzzleId: number;
    guesses: string[]; // Raw guess values
    result: 'won' | 'lost' | null;
    digits: number;
    updatedAt: string;
}

export async function syncPendingGames(userId: string) {
    if (!userId) return;

    try {
        const allKeys = await AsyncStorage.getAllKeys();
        const userPrefix = `${SYNC_STORAGE_PREFIX}${userId}_`;
        const pendingKeys = allKeys.filter(key => key.startsWith(userPrefix));

        if (pendingKeys.length === 0) return;

        console.log(`[Sync] Found ${pendingKeys.length} pending games for user ${userId}`);

        for (const key of pendingKeys) {
            try {
                const item = await AsyncStorage.getItem(key);
                if (!item) continue;

                const localState: PendingGameState = JSON.parse(item);

                // Double check user consistency
                if (localState.userId !== userId) continue;

                const table = localState.mode === 'REGION' ? 'game_attempts_region' : 'game_attempts_user';
                const puzzleIdField = localState.mode === 'REGION' ? 'allocated_region_id' : 'allocated_user_id';
                const guessesTable = localState.mode === 'REGION' ? 'guesses_region' : 'guesses_user';

                // Fetch Remote State
                const { data: remoteAttempt, error } = await supabase
                    .from(table)
                    .select('id, result, num_guesses, digits')
                    .eq('user_id', userId)
                    .eq(puzzleIdField, localState.puzzleId)
                    .maybeSingle();

                if (error) {
                    console.error(`[Sync] Error fetching remote state for ${key}`, error);
                    continue; // Skip and try later
                }

                // Rule 1: Server Wins (if final or more progress)
                let serverWins = false;
                if (remoteAttempt) {
                    if (remoteAttempt.result === 'won' || remoteAttempt.result === 'lost') {
                        serverWins = true;
                    } else if ((remoteAttempt.num_guesses || 0) > localState.guesses.length) {
                        serverWins = true;
                    }
                }

                if (serverWins) {
                    console.log(`[Sync] Server wins for ${localState.mode} ${localState.puzzleId}. Discarding local.`);
                    await AsyncStorage.removeItem(key);
                    continue;
                }

                // Rule 2: Local Wins (if we have more data or we finished it)
                // If we get here, Server is either null (new game) or behind
                // BUT we must be careful: if remote exists, we update. If not, we insert.

                console.log(`[Sync] Local wins for ${localState.mode} ${localState.puzzleId}. Syncing to DB.`);

                let attemptId = remoteAttempt?.id;

                // 1. Ensure Attempt Exists
                if (!attemptId) {
                    const insertData: any = {
                        user_id: userId,
                        started_at: new Date().toISOString(),
                        digits: localState.digits.toString(), // Ensure we save digits
                        [puzzleIdField]: localState.puzzleId
                    };

                    // Note: We don't implement Holiday logic here implicitly, DB defaults or other flows handle status.
                    // But if we are syncing a completed game, we might need to be careful? 
                    // The `updateUserStats` in game engine usually handles calculations.

                    const { data: newAttempt, error: createError } = await supabase
                        .from(table)
                        .insert(insertData)
                        .select('id')
                        .single();

                    if (createError) {
                        console.error('[Sync] Failed to create attempt', createError);
                        continue;
                    }
                    attemptId = newAttempt.id;
                }

                // 2. Sync Guesses (Upsert/Insert missing)
                // We need to fetch existing guesses to know which ones to add?
                // Or just blindly insert? Guesses have unique constraint on (attempt_id, guess_order)? 
                // No, usually just ID. But we sync in order.
                // Easiest is to fetch existing count and append.

                // Actually, if we decided Local Wins, it implies Local > Remote.
                // We can just get current remote count and insert the specific new ones.
                // But what if Local has [A, B, C] and Remote has [A, B] (but Remote didn't win)?
                // We just add C.

                // Fetch existing remote guesses to compare contents just in case?
                // Let's rely on count for simplicity as per "Rule 2 Local num_guesses > DB num_guesses"

                const { count: remoteCount } = await supabase
                    .from(guessesTable)
                    .select('*', { count: 'exact', head: true })
                    .eq('game_attempt_id', attemptId);

                const currentRemoteCount = remoteCount || 0;

                if (localState.guesses.length > currentRemoteCount) {
                    const guessesToAdd = localState.guesses.slice(currentRemoteCount);
                    const guessesToInsert = guessesToAdd.map(g => ({
                        game_attempt_id: attemptId,
                        guess_value: g
                    }));

                    const { error: insertGuessError } = await supabase
                        .from(guessesTable)
                        .insert(guessesToInsert);

                    if (insertGuessError) {
                        console.error('[Sync] Failed to insert guesses', insertGuessError);
                        continue;
                    }
                }

                // 3. Update Attempt Result if finished locally
                if (localState.result) {
                    const { error: updateError } = await supabase
                        .from(table)
                        .update({
                            result: localState.result,
                            completed_at: new Date().toISOString(),
                            num_guesses: localState.guesses.length
                        })
                        .eq('id', attemptId);

                    if (updateError) {
                        console.error('[Sync] Failed to update final result', updateError);
                        continue;
                    }

                    // Trigger Stat Updates?
                    // Ideally we'd call the stats RPC function or rely on the triggers if they exist.
                    // Or rely on the app to fetch fresh stats next time it loads.
                    // The Next time user opens App, `index.tsx` fetches `game_attempts_...` and recalculates logic.
                }

                // Rule 3: Cleanup
                console.log(`[Sync] Sync successful for ${key}. removing local.`);
                await AsyncStorage.removeItem(key);

            } catch (e) {
                console.error(`[Sync] Error processing key ${key}`, e);
            }
        }
    } catch (e) {
        console.error('[Sync] General error', e);
    }
}
