import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import type { Guess } from "@shared/schema";

interface GuessCache {
  [puzzleId: number]: Guess[];
}

interface GuessCacheContextValue {
  getGuessesForPuzzle: (puzzleId: number) => Guess[] | null;
  setGuessesForPuzzle: (puzzleId: number, guesses: Guess[]) => void;
  refreshRecentGuesses: () => Promise<void>;
  isLoading: boolean;
  addGuessToCache: (puzzleId: number, guess: Guess) => void;
}

const GuessCacheContext = createContext<GuessCacheContextValue | undefined>(undefined);

export function GuessCacheProvider({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated } = useAuth();
  const [cache, setCache] = useState<GuessCache>({});
  const [isLoading, setIsLoading] = useState(false);

  // Fetch recent guesses (last 30 days) from Supabase
  const fetchRecentGuesses = useCallback(async () => {
    if (!isAuthenticated || !user?.id) return;

    setIsLoading(true);
    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const dateString = thirtyDaysAgo.toISOString().split("T")[0];

      const response = await fetch(`/api/guesses/recent?since=${dateString}`, {
        credentials: "include",
      });

      if (!response.ok) {
        if (response.status !== 401) {
          console.error("Failed to fetch recent guesses:", response.status);
        }
        return;
      }

      const guesses: Guess[] = await response.json();

      const newCache: GuessCache = {};
      for (const guess of guesses) {
        const puzzleId = (guess as any).puzzleId;
        if (!puzzleId) {
          console.warn("Guess missing puzzleId:", guess);
          continue;
        }
        if (!newCache[puzzleId]) newCache[puzzleId] = [];
        newCache[puzzleId].push(guess);
      }

      setCache(newCache);

      try {
        localStorage.setItem(`guess-cache-${user.id}`, JSON.stringify(newCache));
      } catch (e) {
        console.warn("Failed to persist cache to localStorage", e);
      }
    } catch (error) {
      console.error("Error fetching recent guesses:", error);
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated, user]);

  // On login: clear cache first, then load from localStorage, then fetch fresh
  useEffect(() => {
    if (isAuthenticated && user?.id) {
      setCache({}); // clear stale data immediately

      try {
        const stored = localStorage.getItem(`guess-cache-${user.id}`);
        if (stored) {
          setCache(JSON.parse(stored));
        }
      } catch (e) {
        console.warn("Failed to load cache from localStorage", e);
      }

      fetchRecentGuesses();
    }
  }, [isAuthenticated, user, fetchRecentGuesses]);

  // On logout: clear cache and localStorage
  useEffect(() => {
    if (!isAuthenticated) {
      setCache({});
      try {
        Object.keys(localStorage).forEach((key) => {
          if (key.startsWith("guess-cache-")) {
            localStorage.removeItem(key);
          }
        });
      } catch (e) {
        console.warn("Failed to clear cache from localStorage", e);
      }
    }
  }, [isAuthenticated]);

  const getGuessesForPuzzle = useCallback(
    (puzzleId: number): Guess[] | null => cache[puzzleId] || null,
    [cache]
  );

  const setGuessesForPuzzle = useCallback(
    (puzzleId: number, guesses: Guess[]) => {
      setCache((prev) => {
        const newCache = { ...prev, [puzzleId]: guesses };
        if (user) {
          try {
            localStorage.setItem(`guess-cache-${user.id}`, JSON.stringify(newCache));
          } catch (e) {
            console.warn("Failed to persist cache to localStorage", e);
          }
        }
        return newCache;
      });
    },
    [user]
  );

  const addGuessToCache = useCallback(
    (puzzleId: number, guess: Guess) => {
      setCache((prev) => {
        const existing = prev[puzzleId] || [];
        const newCache = { ...prev, [puzzleId]: [...existing, guess] };
        if (user) {
          try {
            localStorage.setItem(`guess-cache-${user.id}`, JSON.stringify(newCache));
          } catch (e) {
            console.warn("Failed to persist cache to localStorage", e);
          }
        }
        return newCache;
      });
    },
    [user]
  );

  const refreshRecentGuesses = useCallback(async () => {
    await fetchRecentGuesses();
  }, [fetchRecentGuesses]);

  return (
    <GuessCacheContext.Provider
      value={{
        getGuessesForPuzzle,
        setGuessesForPuzzle,
        refreshRecentGuesses,
        isLoading,
        addGuessToCache,
      }}
    >
      {children}
    </GuessCacheContext.Provider>
  );
}

export function useGuessCache() {
  const context = useContext(GuessCacheContext);
  if (!context) {
    throw new Error("useGuessCache must be used within a GuessCacheProvider");
  }
  return context;
}
