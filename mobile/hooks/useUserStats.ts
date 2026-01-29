import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth';

export interface UserStats {
    user_id: string; // Added for explicit type safety if needed
    // Deprecated fields kept optional if needed for legacy compatibility, but prefer games_*
    total_played?: number;
    total_wins?: number;

    current_streak: number;
    max_streak: number;
    win_percentage: number;

    // Correct schema columns
    games_played: number;
    games_won?: number; // Some schemas might use 'wins' or 'games_won'
    wins?: number; // Matches the upsert key used in some contexts

    current_streak_daily?: number;
    max_streak_daily?: number;

    // Additional Stats
    guess_distribution?: any;
    cumulative_monthly_percentile?: number | null;
}

export const useUserStats = (mode: 'REGION' | 'USER' = 'REGION') => {
    const { user } = useAuth();
    const tableName = mode === 'REGION' ? 'user_stats_region' : 'user_stats_user';

    const { data: stats, isLoading, refetch } = useQuery({
        queryKey: ['userStats', user?.id, mode],
        queryFn: async () => {
            if (!user) return null;

            // Debug log
            console.log(`[useUserStats] Fetching stats from ${tableName} for user ${user.id}`);

            const { data, error } = await supabase
                .from(tableName)
                .select('*')
                .eq('user_id', user.id)
                .maybeSingle();

            if (error) {
                console.error('Error fetching user stats:', error);
                return null;
            }

            return data as unknown as UserStats;
        },
        enabled: !!user,
    });

    const updateStats = async (isWin: boolean) => {
        if (!user) return;

        console.log(`[useUserStats] Updating stats in ${tableName} for user ${user.id}`);

        // 1. Get current stats
        const { data: currentStats, error: fetchError } = await supabase
            .from(tableName)
            .select('*')
            .eq('user_id', user.id)
            .maybeSingle();

        if (fetchError && fetchError.code !== 'PGRST116') {
            console.error('Error fetching stats for update:', fetchError);
            return;
        }

        const stats = currentStats || {
            user_id: user.id,
            games_played: 0,
            games_won: 0, // Added to satisfy type
            wins: 0,
            current_streak: 0,
            max_streak: 0,
            win_percentage: 0,
            total_played: 0, // Legacy init
        };

        // 2. Calculate New Stats
        // Cast to any to handle potential schema variations safely
        const statsAny = (stats as any) || {};

        const currentGamesPlayed = stats.games_played || statsAny.total_played || 0;
        const currentWins = stats.games_won || statsAny.total_wins || statsAny.wins || 0;

        const newTotalPlayed = currentGamesPlayed + 1;
        const newTotalWins = currentWins + (isWin ? 1 : 0);

        let newCurrentStreak = stats.current_streak || 0;
        if (isWin) {
            newCurrentStreak += 1;
        } else {
            newCurrentStreak = 0;
        }

        const newMaxStreak = Math.max(stats.max_streak || 0, newCurrentStreak);
        const winPct = newTotalPlayed > 0 ? (newTotalWins / newTotalPlayed) * 100 : 0;

        // Removed intermediate 'updates' object to simplify upsert logic below

        // 3. Upsert
        // We must specify the conflict columns for ON CONFLICT clause to work properly
        // For user_stats_region, likely (user_id, region) is unique if region column exists
        // But the table structure in useUserStats context seems to just rely on user_id for the WHERE clause above.
        // Wait, the error said "uq_user_stats_region".
        // Let's check table structure assumption.
        // The table likely has `user_id` and `region` (for region table) or just `user_id` (for user table).
        // Since we are creating the object:
        const payload: any = {
            user_id: user.id,
            games_played: newTotalPlayed,
            games_won: newTotalWins,
            current_streak: newCurrentStreak,
            max_streak: newMaxStreak,
            // Only add region if it's the region table to satisfy unique constraint
            ...(mode === 'REGION' ? { region: 'UK' } : {})
        };

        const { error: upsertError } = await supabase
            .from(tableName)
            .upsert(payload, { onConflict: mode === 'REGION' ? 'user_id, region' : 'user_id' })
            .select();

        if (upsertError) {
            console.error('Error updating stats:', upsertError);
        } else {
            refetch();
        }
    };

    return {
        stats,
        isLoading,
        refetch,
        updateStats
    };
};
