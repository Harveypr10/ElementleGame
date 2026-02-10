import { useState, useEffect, useRef, useCallback } from 'react';
import { useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';

const CACHE_KEY = 'puzzle_readiness_cache';

// Polling schedule:
// Phase 1: 5s intervals for 30s (6 attempts)
// Phase 2: 10s intervals for 120s (12 more attempts)
// Then stop — re-trigger on next focus
const PHASE_1_INTERVAL = 5000;
const PHASE_1_DURATION = 30000;
const PHASE_2_INTERVAL = 10000;
const PHASE_2_DURATION = 120000;

interface ReadinessCache {
    date: string;
    userReady: boolean;
}

/**
 * Checks whether today's personal/user puzzle is available.
 * Region puzzles are pre-generated and always assumed ready.
 * 
 * Uses a two-phase polling schedule if the puzzle isn't ready yet:
 *   Phase 1: every 5s for 30s
 *   Phase 2: every 10s for 120s
 * Stops after that, but re-triggers on screen re-focus.
 */
export function usePuzzleReadiness(
    userId: string | undefined,
    todayDate: string
) {
    const [userReady, setUserReady] = useState(false);
    const [isChecking, setIsChecking] = useState(true);
    const pollingRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const pollingStartRef = useRef<number>(0);
    const isMountedRef = useRef(true);

    // Cleanup on unmount
    useEffect(() => {
        isMountedRef.current = true;
        return () => {
            isMountedRef.current = false;
            if (pollingRef.current) {
                clearTimeout(pollingRef.current);
                pollingRef.current = null;
            }
        };
    }, []);

    const checkPuzzleReady = useCallback(async (): Promise<boolean> => {
        if (!userId) return false;

        try {
            const { data, error } = await supabase
                .from('questions_allocated_user')
                .select('id, question_id')
                .eq('user_id', userId)
                .eq('puzzle_date', todayDate)
                .maybeSingle();

            if (error) {
                console.warn('[usePuzzleReadiness] Query error:', error.message);
                return false;
            }

            // Ready if row exists AND has a non-null question_id
            return !!(data && data.question_id != null);
        } catch (e) {
            console.error('[usePuzzleReadiness] Check failed:', e);
            return false;
        }
    }, [userId, todayDate]);

    const saveCache = useCallback(async (ready: boolean) => {
        try {
            const cache: ReadinessCache = { date: todayDate, userReady: ready };
            await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(cache));
        } catch (e) {
            console.warn('[usePuzzleReadiness] Cache save failed:', e);
        }
    }, [todayDate]);

    const loadCache = useCallback(async (): Promise<boolean | null> => {
        try {
            const raw = await AsyncStorage.getItem(CACHE_KEY);
            if (!raw) return null;
            const cached: ReadinessCache = JSON.parse(raw);
            if (cached.date === todayDate && cached.userReady) {
                return true;
            }
            return null; // Stale or not ready
        } catch (e) {
            return null;
        }
    }, [todayDate]);

    const stopPolling = useCallback(() => {
        if (pollingRef.current) {
            clearTimeout(pollingRef.current);
            pollingRef.current = null;
        }
    }, []);

    const startPolling = useCallback(() => {
        stopPolling();
        pollingStartRef.current = Date.now();

        const poll = async () => {
            if (!isMountedRef.current) return;

            const ready = await checkPuzzleReady();
            if (!isMountedRef.current) return;

            if (ready) {
                setUserReady(true);
                setIsChecking(false);
                await saveCache(true);
                console.log('[usePuzzleReadiness] Puzzle is ready!');
                return;
            }

            // Determine which phase we're in
            const elapsed = Date.now() - pollingStartRef.current;

            if (elapsed < PHASE_1_DURATION) {
                // Phase 1: 5s intervals
                console.log(`[usePuzzleReadiness] Not ready, retrying in ${PHASE_1_INTERVAL / 1000}s (phase 1, ${Math.round(elapsed / 1000)}s elapsed)`);
                pollingRef.current = setTimeout(poll, PHASE_1_INTERVAL);
            } else if (elapsed < PHASE_1_DURATION + PHASE_2_DURATION) {
                // Phase 2: 10s intervals
                console.log(`[usePuzzleReadiness] Not ready, retrying in ${PHASE_2_INTERVAL / 1000}s (phase 2, ${Math.round(elapsed / 1000)}s elapsed)`);
                pollingRef.current = setTimeout(poll, PHASE_2_INTERVAL);
            } else {
                // Polling exhausted — stop until next focus
                console.log('[usePuzzleReadiness] Polling exhausted. Will retry on next screen focus.');
                setIsChecking(false);
            }
        };

        poll();
    }, [checkPuzzleReady, saveCache, stopPolling]);

    const runCheck = useCallback(async () => {
        if (!userId) {
            setIsChecking(false);
            return;
        }

        setIsChecking(true);

        // 1. Try cache first
        const cached = await loadCache();
        if (cached === true) {
            setUserReady(true);
            setIsChecking(false);
            console.log('[usePuzzleReadiness] Loaded from cache: ready');
            return;
        }

        // 2. Do a single check
        const ready = await checkPuzzleReady();
        if (!isMountedRef.current) return;

        if (ready) {
            setUserReady(true);
            setIsChecking(false);
            await saveCache(true);
            console.log('[usePuzzleReadiness] First check: ready');
            return;
        }

        // 3. Not ready — start polling
        setIsChecking(false); // No longer "initially checking", now polling
        console.log('[usePuzzleReadiness] Not ready, starting polling...');
        startPolling();
    }, [userId, loadCache, checkPuzzleReady, saveCache, startPolling]);

    // Run check on screen focus (handles day change, returning from other screens)
    useFocusEffect(
        useCallback(() => {
            // Reset state for fresh check
            setUserReady(false);
            runCheck();

            return () => {
                stopPolling();
            };
        }, [runCheck, stopPolling])
    );

    return { userReady, isChecking };
}
