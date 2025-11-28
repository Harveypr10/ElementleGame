import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useSupabase } from "@/lib/SupabaseProvider";
import type { Guess } from "@shared/schema";

// Cache keys now include mode prefix to prevent cross-contamination
// Format: "global:123" or "local:456"
interface GuessCache {
  [modeAndPuzzleId: string]: Guess[];
}

interface GuessCacheContextValue {
  getGuessesForPuzzle: (puzzleId: number, mode: 'global' | 'local') => Guess[] | null;
  setGuessesForPuzzle: (puzzleId: number, mode: 'global' | 'local', guesses: Guess[]) => void;
  refreshRecentGuesses: (mode: 'global' | 'local') => Promise<void>;
  isLoading: boolean;
  addGuessToCache: (puzzleId: number, mode: 'global' | 'local', guess: Guess) => void;
}

const GuessCacheContext = createContext<GuessCacheContextValue | undefined>(undefined);

// Helper to create mode-prefixed cache key
const makeCacheKey = (mode: 'global' | 'local', puzzleId: number): string => `${mode}:${puzzleId}`;

export function GuessCacheProvider({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated } = useAuth();
  const supabase = useSupabase();
  const [cache, setCache] = useState<GuessCache>({});
  const [isLoading, setIsLoading] = useState(false);

  // Fetch recent guesses (last 30 days) from Supabase - MODE AWARE
  const fetchRecentGuesses = useCallback(async (mode: 'global' | 'local' = 'global') => {
    if (!isAuthenticated || !user?.id) return;

    setIsLoading(true);
    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const dateString = thirtyDaysAgo.toISOString().split("T")[0];

      // Get Supabase session token
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.access_token) {
        console.error("No access token available");
        setIsLoading(false);
        return;
      }

      // Use mode-specific endpoint
      const endpoint = mode === 'local' 
        ? `/api/user/guesses/recent?since=${dateString}`
        : `/api/guesses/recent?since=${dateString}`;
        
      console.log(`[GuessCacheContext] Fetching from ${endpoint} for mode: ${mode}`);

      const response = await fetch(endpoint, {
        credentials: "include",
        headers: {
          "Authorization": `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) {
        if (response.status !== 401) {
          console.error("Failed to fetch recent guesses:", response.status);
        }
        return;
      }

      const guesses: Guess[] = await response.json();
      console.log(`[GuessCacheContext] Fetched ${guesses.length} guesses for ${mode} mode`);

      // Update cache with mode-prefixed keys (merge with existing, don't replace all)
      setCache((prev) => {
        const newCache = { ...prev };
        for (const guess of guesses) {
          const puzzleId = (guess as any).puzzleId;
          if (!puzzleId) {
            console.warn("Guess missing puzzleId:", guess);
            continue;
          }
          const key = makeCacheKey(mode, puzzleId);
          if (!newCache[key]) newCache[key] = [];
          // Check if this guess is already in the cache (by id)
          if (!newCache[key].some(g => g.id === guess.id)) {
            newCache[key].push(guess);
          }
        }
        
        // Persist to localStorage
        if (user) {
          try {
            localStorage.setItem(`guess-cache-${user.id}`, JSON.stringify(newCache));
          } catch (e) {
            console.warn("Failed to persist cache to localStorage", e);
          }
        }
        
        return newCache;
      });
    } catch (error) {
      console.error("Error fetching recent guesses:", error);
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated, user, supabase]);

  // On login: clear cache first, then load from localStorage, then fetch fresh for both modes
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

      // Fetch for both modes on login
      fetchRecentGuesses('global');
      fetchRecentGuesses('local');
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

  // Mode-aware getGuessesForPuzzle
  const getGuessesForPuzzle = useCallback(
    (puzzleId: number, mode: 'global' | 'local'): Guess[] | null => {
      const key = makeCacheKey(mode, puzzleId);
      return cache[key] || null;
    },
    [cache]
  );

  // Mode-aware setGuessesForPuzzle
  const setGuessesForPuzzle = useCallback(
    (puzzleId: number, mode: 'global' | 'local', guesses: Guess[]) => {
      const key = makeCacheKey(mode, puzzleId);
      setCache((prev) => {
        const newCache = { ...prev, [key]: guesses };
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

  // Mode-aware addGuessToCache
  const addGuessToCache = useCallback(
    (puzzleId: number, mode: 'global' | 'local', guess: Guess) => {
      const key = makeCacheKey(mode, puzzleId);
      setCache((prev) => {
        const existing = prev[key] || [];
        const newCache = { ...prev, [key]: [...existing, guess] };
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

  // Mode-aware refreshRecentGuesses
  const refreshRecentGuesses = useCallback(async (mode: 'global' | 'local') => {
    await fetchRecentGuesses(mode);
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
