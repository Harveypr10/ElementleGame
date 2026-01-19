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

            return data as UserStats;
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
            wins: 0,
            current_streak: 0,
            max_streak: 0,
            win_percentage: 0,
            total_played: 0, // Legacy init
        };

        // 2. Calculate New Stats, using (total_played || games_played) for reading, but saving to games_played
        // Since we are standardizing on games_played, we check both or default to 0.
        const currentGamesPlayed = stats.games_played || stats.total_played || 0;
        const currentWins = stats.games_won || stats.total_wins || stats.wins || 0;

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
        const { error: upsertError } = await supabase
            .from(tableName)
            .upsert({
                user_id: user.id,
                games_played: newTotalPlayed,
                games_won: newTotalWins,
                current_streak: newCurrentStreak,
                max_streak: newMaxStreak
            })
            .eq('user_id', user.id);

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
