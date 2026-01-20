/**
 * Guess Cache Context
 * 
 * Caches game guesses to prevent unnecessary re-renders and API calls.
 * Ported from web app for performance parity.
 */

import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';

interface GuessCache {
    [puzzleId: string]: {
        guesses: string[];
        timestamp: number;
    };
}

interface GuessCacheContextType {
    getCachedGuesses: (puzzleId: number) => string[] | null;
    setCachedGuesses: (puzzleId: number, guesses: string[]) => void;
    clearCache: () => void;
    clearPuzzleCache: (puzzleId: number) => void;
}

const GuessCacheContext = createContext<GuessCacheContextType | null>(null);

const CACHE_EXPIRY_MS = 1000 * 60 * 60 * 24; // 24 hours

export function GuessCacheProvider({ children }: { children: ReactNode }) {
    const [cache, setCache] = useState<GuessCache>({});

    const getCachedGuesses = useCallback((puzzleId: number): string[] | null => {
        const key = puzzleId.toString();
        const cached = cache[key];

        if (!cached) {
            return null;
        }

        // Check if cache is expired
        const now = Date.now();
        if (now - cached.timestamp > CACHE_EXPIRY_MS) {
            // Clear expired cache
            setCache(prev => {
                const newCache = { ...prev };
                delete newCache[key];
                return newCache;
            });
            return null;
        }

        return cached.guesses;
    }, [cache]);

    const setCachedGuesses = useCallback((puzzleId: number, guesses: string[]) => {
        const key = puzzleId.toString();
        setCache(prev => ({
            ...prev,
            [key]: {
                guesses,
                timestamp: Date.now(),
            },
        }));
    }, []);

    const clearCache = useCallback(() => {
        setCache({});
    }, []);

    const clearPuzzleCache = useCallback((puzzleId: number) => {
        const key = puzzleId.toString();
        setCache(prev => {
            const newCache = { ...prev };
            delete newCache[key];
            return newCache;
        });
    }, []);

    return (
        <GuessCacheContext.Provider
            value={{
                getCachedGuesses,
                setCachedGuesses,
                clearCache,
                clearPuzzleCache,
            }}
        >
            {children}
        </GuessCacheContext.Provider>
    );
}

export const useGuessCache = () => {
    const context = useContext(GuessCacheContext);
    if (!context) {
        throw new Error('useGuessCache must be used within GuessCacheProvider');
    }
    return context;
};
