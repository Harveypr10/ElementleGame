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
    if (!isAuthenticated || !user || !user.id) return;

    setIsLoading(true);
    try {
      // Calculate date 30 days ago
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const dateString = thirtyDaysAgo.toISOString().split('T')[0]; // YYYY-MM-DD

      // Fetch all guesses for recent game attempts
      const response = await fetch(`/api/guesses/recent?since=${dateString}`, {
        credentials: 'include',
      });

      if (!response.ok) {
        // Don't log error for 401 (not yet authenticated)
        if (response.status !== 401) {
          console.error('Failed to fetch recent guesses');
        }
        return;
      }

      const guesses: Guess[] = await response.json();

      // Group guesses by puzzle ID
      const newCache: GuessCache = {};
      for (const guess of guesses) {
        // We need to get the puzzle ID from the game attempt
        // The API should return guesses with their associated puzzle IDs
        const puzzleId = (guess as any).puzzleId;
        if (puzzleId) {
          if (!newCache[puzzleId]) {
            newCache[puzzleId] = [];
          }
          newCache[puzzleId].push(guess);
        }
      }

      setCache(newCache);

      // Optionally persist to localStorage
      try {
        localStorage.setItem(`guess-cache-${user.id}`, JSON.stringify(newCache));
      } catch (e) {
        console.warn('Failed to persist cache to localStorage', e);
      }
    } catch (error) {
      console.error('Error fetching recent guesses:', error);
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated, user]);

  // Load cache from localStorage on mount
  useEffect(() => {
    if (isAuthenticated && user && user.id) {
      try {
        const stored = localStorage.getItem(`guess-cache-${user.id}`);
        if (stored) {
          setCache(JSON.parse(stored));
        }
      } catch (e) {
        console.warn('Failed to load cache from localStorage', e);
      }
      // Then fetch fresh data
      fetchRecentGuesses();
    }
  }, [isAuthenticated, user, fetchRecentGuesses]);

  // Clear cache on logout
  useEffect(() => {
    if (!isAuthenticated) {
      setCache({});
      // Clear all guess caches from localStorage
      try {
        Object.keys(localStorage).forEach(key => {
          if (key.startsWith('guess-cache-')) {
            localStorage.removeItem(key);
          }
        });
      } catch (e) {
        console.warn('Failed to clear cache from localStorage', e);
      }
    }
  }, [isAuthenticated]);

  const getGuessesForPuzzle = useCallback((puzzleId: number): Guess[] | null => {
    return cache[puzzleId] || null;
  }, [cache]);

  const setGuessesForPuzzle = useCallback((puzzleId: number, guesses: Guess[]) => {
    setCache(prev => {
      const newCache = { ...prev, [puzzleId]: guesses };
      
      // Persist to localStorage
      if (user) {
        try {
          localStorage.setItem(`guess-cache-${user.id}`, JSON.stringify(newCache));
        } catch (e) {
          console.warn('Failed to persist cache to localStorage', e);
        }
      }
      
      return newCache;
    });
  }, [user]);

  const addGuessToCache = useCallback((puzzleId: number, guess: Guess) => {
    setCache(prev => {
      const existing = prev[puzzleId] || [];
      const newCache = { ...prev, [puzzleId]: [...existing, guess] };
      
      // Persist to localStorage
      if (user) {
        try {
          localStorage.setItem(`guess-cache-${user.id}`, JSON.stringify(newCache));
        } catch (e) {
          console.warn('Failed to persist cache to localStorage', e);
        }
      }
      
      return newCache;
    });
  }, [user]);

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
