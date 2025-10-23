import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "./useAuth";
import { apiRequest } from "@/lib/queryClient";
import { useSupabase } from "@/lib/SupabaseProvider";
import type { GameAttempt, Guess } from "@shared/schema";

interface CreateGameAttemptData {
  puzzleId: number;
  result?: string;
  numGuesses?: number;
}

interface CreateGuessData {
  gameAttemptId: number;
  guessValue: string;
  feedbackResult: any;
}

interface UpdateGameAttemptData {
  id: number;
  result: string;
  numGuesses: number;
}

export function useGameData() {
  const { user, isAuthenticated } = useAuth();
  const queryClient = useQueryClient();
  const supabase = useSupabase();

  // Get all game attempts for the current user
  const { data: gameAttempts, isLoading: loadingAttempts } = useQuery<GameAttempt[]>({
    queryKey: ["/api/game-attempts/user"],
    enabled: isAuthenticated,
    staleTime: 0, // Always consider data stale to ensure refetch on Archive mount
  });

  // Create a new game attempt
  const createGameAttempt = useMutation({
    mutationFn: async (data: CreateGameAttemptData) => {
      const response = await apiRequest("POST", "/api/game-attempts", data);
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/game-attempts/user"] });
    },
  });

  // Update an existing game attempt (when completing)
  const updateGameAttempt = useMutation({
    mutationFn: async (data: UpdateGameAttemptData) => {
      const response = await apiRequest("PATCH", `/api/game-attempts/${data.id}`, {
        result: data.result,
        numGuesses: data.numGuesses,
      });
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/game-attempts/user"] });
    },
  });

  // Create a guess
  const createGuess = useMutation({
    mutationFn: async (data: CreateGuessData) => {
      const response = await apiRequest("POST", "/api/guesses", data);
      return await response.json();
    },
    onSuccess: () => {
      // Invalidate both caches:
      // - game attempts cache (for updated numGuesses count)
      // - all guesses cache (for updated guess data)
      // This ensures Archive page shows updated status and guess counts
      queryClient.invalidateQueries({ queryKey: ["/api/game-attempts/user"] });
      queryClient.invalidateQueries({ queryKey: ["/api/guesses/all"] });
    },
  });

  // Get guesses for a specific game attempt
  const getGuessesByAttempt = async (gameAttemptId: number): Promise<Guess[]> => {
    if (!isAuthenticated) {
      return [];
    }
    try {
      // Always refresh the session to get a fresh token
      const { data: { session }, error: sessionError } = await supabase.auth.refreshSession();
      if (sessionError || !session?.access_token) {
        console.error("[getGuessesByAttempt] No valid session:", sessionError);
        return [];
      }

      const response = await fetch(`/api/guesses/${gameAttemptId}`, {
        headers: {
          "Authorization": `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("[getGuessesByAttempt] Request failed:", response.status, errorText);
        return [];
      }

      const data = await response.json();
      console.log("[getGuessesByAttempt] Loaded guesses:", data.length);
      return data;
    } catch (error) {
      console.error("[getGuessesByAttempt] Error fetching guesses:", error);
      return [];
    }
  };

  const getAllGuesses = async (): Promise<Array<Guess & { puzzleId: number; result: string | null }>> => {
    console.log("[getAllGuesses] Called, isAuthenticated:", isAuthenticated);
    if (!isAuthenticated) {
      console.log("[getAllGuesses] Not authenticated, returning empty array");
      return [];
    }
    try {
      console.log("[getAllGuesses] Fetching from /api/guesses/all");
      const response = await apiRequest("GET", "/api/guesses/all");
      console.log("[getAllGuesses] Response status:", response.status);
      if (!response.ok) {
        const errorText = await response.text();
        console.error("[getAllGuesses] Request failed:", response.status, errorText);
        return [];
      }
      const data = await response.json();
      console.log("[getAllGuesses] Fetched", data.length, "guesses");
      return data;
    } catch (error) {
      console.error("[getAllGuesses] Error fetching guesses:", error);
      return [];
    }
  };

  // Check if a puzzle is completed by the user
  const isPuzzleCompleted = (puzzleId: number): GameAttempt | undefined => {
    if (!gameAttempts) return undefined;
    return gameAttempts.find(
      (attempt) => attempt.puzzleId === puzzleId && attempt.result !== null
    );
  };

  // Get in-progress attempt for a puzzle
  const getInProgressAttempt = (puzzleId: number): GameAttempt | undefined => {
    if (!gameAttempts) return undefined;
    return gameAttempts.find(
      (attempt) => attempt.puzzleId === puzzleId && attempt.result === null
    );
  };

  return {
    gameAttempts,
    loadingAttempts,
    createGameAttempt: createGameAttempt.mutateAsync,
    updateGameAttempt: updateGameAttempt.mutateAsync,
    createGuess: createGuess.mutateAsync,
    getGuessesByAttempt,
    getAllGuesses,
    isPuzzleCompleted,
    getInProgressAttempt,
    isCreatingAttempt: createGameAttempt.isPending,
    isCreatingGuess: createGuess.isPending,
  };
}
