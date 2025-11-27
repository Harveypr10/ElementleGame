import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "./useAuth";
import { apiRequest } from "@/lib/queryClient";
import { useSupabase } from "@/lib/SupabaseProvider";
import { useGameMode } from "@/contexts/GameModeContext";
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
  const { isLocalMode } = useGameMode();

  // Get all game attempts for the current user (mode-aware)
  const endpoint = isLocalMode ? "/api/user/game-attempts/user" : "/api/game-attempts/user";
  const { data: gameAttempts, isLoading: loadingAttempts } = useQuery<GameAttempt[]>({
    queryKey: [endpoint],
    enabled: isAuthenticated,
    staleTime: 30000, // Consider data stale after 30 seconds
    refetchOnMount: true, // Refetch when Archive mounts but respect staleTime
  });

  // Create a new game attempt (mode-aware)
  const createGameAttempt = useMutation({
    mutationFn: async (data: CreateGameAttemptData) => {
      const createEndpoint = isLocalMode ? "/api/user/game-attempts" : "/api/game-attempts";
      const response = await apiRequest("POST", createEndpoint, data);
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [endpoint] });
    },
  });

  // Update an existing game attempt (when completing, mode-aware)
  const updateGameAttempt = useMutation({
    mutationFn: async (data: UpdateGameAttemptData) => {
      const updateEndpoint = isLocalMode ? `/api/user/game-attempts/${data.id}` : `/api/game-attempts/${data.id}`;
      const response = await apiRequest("PATCH", updateEndpoint, {
        result: data.result,
        numGuesses: data.numGuesses,
      });
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [endpoint] });
    },
  });

  // Create a guess (mode-aware)
  const createGuess = useMutation({
    mutationFn: async (data: CreateGuessData) => {
      const guessEndpoint = isLocalMode ? "/api/user/guesses" : "/api/guesses";
      const response = await apiRequest("POST", guessEndpoint, data);
      return await response.json();
    },
    onSuccess: () => {
      // Invalidate both caches:
      // - game attempts cache (for updated numGuesses count)
      // - all guesses cache (for updated guess data)
      // This ensures Archive page shows updated status and guess counts
      const allGuessesEndpoint = isLocalMode ? "/api/user/guesses/all" : "/api/guesses/all";
      queryClient.invalidateQueries({ queryKey: [endpoint] });
      queryClient.invalidateQueries({ queryKey: [allGuessesEndpoint] });
    },
  });

  // Get guesses for a specific game attempt (mode-aware)
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

      const guessesEndpoint = isLocalMode ? `/api/user/guesses/${gameAttemptId}` : `/api/guesses/${gameAttemptId}`;
      const response = await fetch(guessesEndpoint, {
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

  const getAllGuesses = async (): Promise<Array<Guess & { puzzleId: number; result: string | null; categoryName?: string | null }>> => {
    console.log("[getAllGuesses] Called, isAuthenticated:", isAuthenticated, "isLocalMode:", isLocalMode);
    try {
      const allGuessesEndpoint = isLocalMode ? "/api/user/guesses/all" : "/api/guesses/all";
      console.log("[getAllGuesses] Fetching from", allGuessesEndpoint);
      const response = await apiRequest("GET", allGuessesEndpoint);
      console.log("[getAllGuesses] Response status:", response.status);
      if (!response.ok) {
        const errorText = await response.text();
        console.error("[getAllGuesses] Request failed:", response.status, errorText);
        return [];
      }
      const data = await response.json();
      console.log("[getAllGuesses] Fetched", data.length, "guesses");
      // Backend now includes categoryName when available
      return data as Array<Guess & { puzzleId: number; result: string | null; categoryName?: string | null }>;
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
