/**
 * Query Optimization Utilities
 * 
 * Optimized Supabase query patterns using joins and batching
 */

import { supabase } from './supabase';

/**
 * Fetch game attempts with embedded puzzle data (optimized with join)
 */
export async function fetchGameAttemptsWithPuzzles(
    userId: string,
    mode: 'REGION' | 'USER',
    limit: number = 50
) {
    const table = mode === 'REGION' ? 'game_attempts_region' : 'game_attempts_user';
    const puzzleTable = mode === 'REGION' ? 'questions_allocated_region' : 'questions_allocated_user';

    const { data, error } = await supabase
        .from(table)
        .select(`
            *,
            puzzle:${puzzleTable}(*)
        `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(limit);

    if (error) {
        console.error('[QueryOptimization] Error fetching games with puzzles:', error);
        return { data: null, error };
    }

    return { data, error: null };
}

/**
 * Fetch user profile with subscription data (single query)
 */
export async function fetchUserProfileWithSubscription(userId: string) {
    const { data, error } = await supabase
        .from('user_profiles')
        .select(`
            *,
            subscription:user_subscriptions(*)
        `)
        .eq('id', userId)
        .single();

    if (error) {
        console.error('[QueryOptimization] Error fetching profile with subscription:', error);
        return { data: null, error };
    }

    return { data, error: null };
}

/**
 * Batch fetch multiple dates from archive (optimized)
 */
export async function fetchArchiveMonthBatch(
    userId: string,
    mode: 'REGION' | 'USER',
    startDate: string,
    endDate: string
) {
    const table = mode === 'REGION' ? 'game_attempts_region' : 'game_attempts_user';

    const { data, error } = await supabase
        .from(table)
        .select('*')
        .eq('user_id', userId)
        .gte('puzzle_date', startDate)
        .lte('puzzle_date', endDate)
        .order('puzzle_date', { ascending: false });

    if (error) {
        console.error('[QueryOptimization] Error fetching archive batch:', error);
        return { data: null, error };
    }

    return { data, error: null };
}

/**
 * Fetch stats with memoization support
 */
export async function fetchStatsOptimized(
    userId: string,
    mode: 'REGION' | 'USER'
) {
    const table = mode === 'REGION' ? 'game_attempts_region' : 'game_attempts_user';

    // Single query to get all stats data
    const { data, error } = await supabase
        .from(table)
        .select('won, guesses, puzzle_date, created_at')
        .eq('user_id', userId)
        .order('puzzle_date', { ascending: false });

    if (error) {
        console.error('[QueryOptimization] Error fetching stats:', error);
        return { data: null, error };
    }

    // Calculate stats client-side (more efficient than multiple queries)
    const stats = {
        totalGames: data.length,
        gamesWon: data.filter(g => g.won).length,
        currentStreak: calculateCurrentStreak(data),
        maxStreak: calculateMaxStreak(data),
        averageGuesses: data.filter(g => g.won).reduce((sum, g) => sum + g.guesses, 0) / data.filter(g => g.won).length || 0,
        guessDistribution: calculateGuessDistribution(data),
    };

    return { data: stats, error: null };
}

function calculateCurrentStreak(games: any[]): number {
    if (games.length === 0) return 0;

    let streak = 0;
    const sortedGames = [...games].sort((a, b) =>
        new Date(b.puzzle_date).getTime() - new Date(a.puzzle_date).getTime()
    );

    for (const game of sortedGames) {
        if (game.won) {
            streak++;
        } else {
            break;
        }
    }

    return streak;
}

function calculateMaxStreak(games: any[]): number {
    if (games.length === 0) return 0;

    let maxStreak = 0;
    let currentStreak = 0;

    const sortedGames = [...games].sort((a, b) =>
        new Date(a.puzzle_date).getTime() - new Date(b.puzzle_date).getTime()
    );

    for (const game of sortedGames) {
        if (game.won) {
            currentStreak++;
            maxStreak = Math.max(maxStreak, currentStreak);
        } else {
            currentStreak = 0;
        }
    }

    return maxStreak;
}

function calculateGuessDistribution(games: any[]): Record<number, number> {
    const distribution: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };

    games.filter(g => g.won).forEach(game => {
        if (game.guesses >= 1 && game.guesses <= 5) {
            distribution[game.guesses]++;
        }
    });

    return distribution;
}

/**
 * Request deduplication helper
 */
const pendingRequests = new Map<string, Promise<any>>();

export async function deduplicatedRequest<T>(
    key: string,
    requestFn: () => Promise<T>
): Promise<T> {
    if (pendingRequests.has(key)) {
        return pendingRequests.get(key)!;
    }

    const promise = requestFn().finally(() => {
        pendingRequests.delete(key);
    });

    pendingRequests.set(key, promise);
    return promise;
}
