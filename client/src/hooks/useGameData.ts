import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "./useAuth";
import { apiRequest } from "@/lib/queryClient";
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

  // Get all game attempts for the current user
  const { data: gameAttempts, isLoading: loadingAttempts } = useQuery<GameAttempt[]>({
    queryKey: ["/api/game-attempts/user"],
    enabled: isAuthenticated,
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
  });

  // Get guesses for a specific game attempt
  const getGuessesByAttempt = async (gameAttemptId: number): Promise<Guess[]> => {
    if (!isAuthenticated) return [];
    try {
      const response = await fetch(`/api/guesses/${gameAttemptId}`);
      if (!response.ok) return [];
      return await response.json();
    } catch (error) {
      console.error("Error fetching guesses:", error);
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
    isPuzzleCompleted,
    getInProgressAttempt,
    isCreatingAttempt: createGameAttempt.isPending,
    isCreatingGuess: createGuess.isPending,
  };
}
