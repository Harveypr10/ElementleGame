import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "./useAuth";
import { apiRequest } from "@/lib/queryClient";
import { useGameMode } from "@/contexts/GameModeContext";
import type { UserStats } from "@shared/schema";

interface UpdateUserStatsData {
  gamesPlayed?: number;
  gamesWon?: number;
  currentStreak?: number;
  maxStreak?: number;
  guessDistribution?: Record<string, number>;
}

export function useUserStats() {
  const { isAuthenticated } = useAuth();
  const queryClient = useQueryClient();
  const { isLocalMode } = useGameMode();

  // Get user stats (mode-aware)
  const endpoint = isLocalMode ? "/api/user/stats" : "/api/stats";
  const { data: stats, isLoading } = useQuery<UserStats>({
    queryKey: [endpoint],
    enabled: isAuthenticated,
  });

  // Update user stats (mode-aware)
  const updateStats = useMutation({
    mutationFn: async (data: UpdateUserStatsData) => {
      const response = await apiRequest("POST", endpoint, data);
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [endpoint] });
    },
  });

  // Increment stats after a game completion
  const incrementStats = async (won: boolean, numGuesses: number) => {
    if (!isAuthenticated || !stats) return;

    const currentDist = stats.guessDistribution as Record<string, number> || {
      "1": 0,
      "2": 0,
      "3": 0,
      "4": 0,
      "5": 0,
    };

    const newStats: UpdateUserStatsData = {
      gamesPlayed: (stats.gamesPlayed ?? 0) + 1,
      gamesWon: won ? (stats.gamesWon ?? 0) + 1 : (stats.gamesWon ?? 0),
      currentStreak: won ? (stats.currentStreak ?? 0) + 1 : 0,
      maxStreak: won
        ? Math.max(stats.maxStreak ?? 0, (stats.currentStreak ?? 0) + 1)
        : (stats.maxStreak ?? 0),
      guessDistribution: won
        ? {
            ...currentDist,
            [numGuesses.toString()]: (currentDist[numGuesses.toString()] || 0) + 1,
          }
        : currentDist,
    };

    await updateStats.mutateAsync(newStats);
    return newStats.currentStreak;
  };

  return {
    stats,
    isLoading,
    updateStats: updateStats.mutateAsync,
    incrementStats,
    isUpdating: updateStats.isPending,
  };
}
