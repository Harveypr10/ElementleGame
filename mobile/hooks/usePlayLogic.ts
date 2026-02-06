import { useState, useCallback, useEffect, useMemo } from 'react';
import { Platform } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import { useOptions } from '../lib/options';
import { useNetwork } from '../contexts/NetworkContext';

// ============================================================================
// Types
// ============================================================================

export interface PuzzleData {
    id: number;
    title: string;
    date: string;              // Puzzle allocation date (YYYY-MM-DD)
    difficulty?: number;
    masterId?: number;
    category?: string;
    categoryNumber?: number;
    location?: string;
    eventDescription?: string;
    solutionDate: string;      // The canonical answer (historical date)
}

export type IntroPhase = 'visible' | 'fading' | 'hidden';
export type GameState = 'loading' | 'playing' | 'won' | 'lost';

export interface UsePlayLogicParams {
    mode: 'REGION' | 'USER';
    puzzleIdParam: string;     // Could be 'today', 'next', a date, or numeric ID
}

export interface UsePlayLogicReturn {
    // Puzzle data
    puzzle: PuzzleData | null;
    loading: boolean;
    debugInfo: string;

    // Intro phase
    introPhase: IntroPhase;
    setIntroPhase: (phase: IntroPhase) => void;
    handlePlayClick: () => void;

    // Game state
    gameState: GameState;
    setGameState: (state: GameState) => void;

    // Navigation
    handleBack: () => void;

    // Computed values
    isRegion: boolean;
    isUserMode: boolean;
    brandColor: string;
    isTodayPuzzle: boolean;

    // Theme colors
    theme: PlayTheme;
}

export interface PlayTheme {
    pageBg: string;
    introBg: string;
    textPrimary: string;
    textSecondary: string;
    headerBg: string;
    regionColor: string;
    userColor: string;
}

// ============================================================================
// Theme Generator
// ============================================================================

export const getPlayTheme = (isDark: boolean): PlayTheme => {
    return {
        pageBg: isDark ? '#0f172a' : '#FAFAFA',
        introBg: '#000000',                        // Intro always starts dark for streak
        textPrimary: isDark ? '#FFFFFF' : '#1e293b',
        textSecondary: isDark ? '#94A3B8' : '#64748B',
        headerBg: isDark ? '#1e293b' : '#FFFFFF',
        regionColor: '#7DAAE8',                    // Blue
        userColor: '#66becb',                      // Teal
    };
};

// ============================================================================
// Hook Implementation
// ============================================================================

export function usePlayLogic({ mode, puzzleIdParam }: UsePlayLogicParams): UsePlayLogicReturn {
    const router = useRouter();
    const { user } = useAuth();
    const { cluesEnabled } = useOptions();
    const { isConnected } = useNetwork();

    // Puzzle state
    const [puzzle, setPuzzle] = useState<PuzzleData | null>(null);
    const [loading, setLoading] = useState(true);
    const [debugInfo, setDebugInfo] = useState<string>('');

    // Intro phase - Start visible so user sees intro first
    const [introPhase, setIntroPhase] = useState<IntroPhase>('visible');

    // Game state
    const [gameState, setGameState] = useState<GameState>('loading');

    // Computed values
    const isRegion = mode === 'REGION';
    const isUserMode = mode === 'USER';
    const brandColor = isUserMode ? '#66becb' : '#7DAAE8';

    // Today check
    const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);
    const isTodayPuzzle = useMemo(() => {
        if (!puzzle) return false;
        return puzzle.date === todayStr;
    }, [puzzle, todayStr]);

    // Theme (default to light mode on web, mobile can override)
    const theme = useMemo(() => getPlayTheme(false), []);

    // ========================================================================
    // Puzzle Fetching
    // ========================================================================

    const fetchPuzzle = useCallback(async () => {
        const now = new Date();
        const today = now.toISOString().split('T')[0];

        // Resolve puzzle ID
        const resolvedId = (puzzleIdParam === 'today' || puzzleIdParam === 'next')
            ? today
            : puzzleIdParam;

        const modeStr = isRegion ? 'REGION' : 'USER';
        const CACHE_KEY = `puzzle_data_${modeStr}_${resolvedId}`;

        try {
            setLoading(true);
            setDebugInfo('');

            // 1. Try Cache First
            if (Platform.OS !== 'web') {
                try {
                    const cached = await AsyncStorage.getItem(CACHE_KEY);
                    if (cached) {
                        const parsed = JSON.parse(cached);
                        console.log('[usePlayLogic] Loaded puzzle from cache:', CACHE_KEY);
                        setPuzzle(parsed);

                        if (isConnected === false) {
                            setLoading(false);
                            return;
                        }
                    }
                } catch (e) {
                    console.log('[usePlayLogic] Cache read error', e);
                }
            }

            // 2. Network Fetch
            if (isConnected === false && !puzzle) {
                setDebugInfo('You are offline and no question data was found.');
                setLoading(false);
                return;
            }

            console.log(`[usePlayLogic] Fetching Puzzle. Mode: ${modeStr}, Param: ${puzzleIdParam}`);

            let allocationData: any = null;
            let masterData: any = null;

            if (isRegion) {
                // REGION MODE QUERY
                let regionQuery = supabase
                    .from('questions_allocated_region')
                    .select('*, categories(id, name)');

                if (puzzleIdParam === 'today') {
                    regionQuery = regionQuery.eq('region', 'UK').eq('puzzle_date', today);
                } else if (/^\d{4}-\d{2}-\d{2}$/.test(puzzleIdParam)) {
                    regionQuery = regionQuery.eq('region', 'UK').eq('puzzle_date', puzzleIdParam);
                } else {
                    const idInt = parseInt(puzzleIdParam, 10);
                    if (!isNaN(idInt)) {
                        regionQuery = regionQuery.eq('id', idInt).eq('region', 'UK');
                    } else {
                        console.error('[usePlayLogic] Invalid puzzle ID:', puzzleIdParam);
                        setPuzzle(null);
                        setLoading(false);
                        return;
                    }
                }

                const { data: allocRes, error: allocError } = await regionQuery.maybeSingle();

                if (allocError) throw allocError;

                if (!allocRes) {
                    console.warn(`[usePlayLogic] No Region allocation found for ${puzzleIdParam}`);
                    setDebugInfo(`No puzzle found for ${puzzleIdParam}.`);
                    setPuzzle(null);
                    setLoading(false);
                    return;
                }

                allocationData = allocRes;

                if (allocRes.question_id) {
                    const { data: master } = await supabase
                        .from('questions_master_region')
                        .select('*')
                        .eq('id', allocRes.question_id)
                        .maybeSingle();
                    masterData = master;
                }

            } else {
                // USER MODE QUERY
                if (!user?.id) {
                    setPuzzle(null);
                    setLoading(false);
                    return;
                }

                let query = supabase
                    .from('questions_allocated_user')
                    .select('*, categories(id, name)');

                if (puzzleIdParam === 'next') {
                    query = query.eq('user_id', user.id).eq('puzzle_date', today);
                } else if (/^\d{4}-\d{2}-\d{2}$/.test(puzzleIdParam)) {
                    query = query.eq('user_id', user.id).eq('puzzle_date', puzzleIdParam);
                } else {
                    const idInt = parseInt(puzzleIdParam, 10);
                    if (!isNaN(idInt)) {
                        query = query.eq('id', idInt).eq('user_id', user.id);
                    } else {
                        setPuzzle(null);
                        setLoading(false);
                        return;
                    }
                }

                const { data: allocRes, error: allocError } = await query.maybeSingle();

                if (allocError) throw allocError;

                if (!allocRes) {
                    setDebugInfo(`No puzzle found for ${puzzleIdParam}`);
                    setPuzzle(null);
                    setLoading(false);
                    return;
                }

                allocationData = allocRes;

                if (allocRes.question_id) {
                    const { data: master } = await supabase
                        .from('questions_master_user')
                        .select('*, populated_places!populated_place_id(name1)')
                        .eq('id', allocRes.question_id)
                        .maybeSingle();
                    masterData = master;
                }
            }

            if (allocationData) {
                const finalPuzzle: PuzzleData = {
                    id: allocationData.id,
                    title: masterData?.event_title || masterData?.title || `Puzzle #${allocationData.id}`,
                    date: allocationData.puzzle_date,
                    solutionDate: masterData?.answer_date_canonical || masterData?.answer_date || allocationData.puzzle_date,
                    difficulty: masterData?.difficulty || 1,
                    masterId: allocationData.question_id,
                    category: allocationData?.categories?.name || 'History',
                    categoryNumber: allocationData?.categories?.id,
                    location: allocationData?.categories?.id === 999 && masterData?.populated_places?.name1
                        ? masterData.populated_places.name1
                        : '',
                    eventDescription: masterData?.event_description || masterData?.description || ''
                };

                setPuzzle(finalPuzzle);

                // Cache save (mobile only)
                if (Platform.OS !== 'web') {
                    try {
                        await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(finalPuzzle));
                    } catch (e) {
                        console.error('[usePlayLogic] Error saving puzzle cache', e);
                    }
                }
            }

        } catch (e) {
            console.error('[usePlayLogic] Critical Error:', e);
            if (isConnected === false) {
                setDebugInfo('You are offline. Connect to the internet to play.');
            } else {
                setDebugInfo('Unexpected error loading puzzle.');
            }
        } finally {
            setLoading(false);
        }
    }, [puzzleIdParam, isRegion, user?.id, isConnected, puzzle]);

    // Fetch on mount
    useEffect(() => {
        fetchPuzzle();
    }, []);

    // ========================================================================
    // Handlers
    // ========================================================================

    const handlePlayClick = useCallback(() => {
        setIntroPhase('fading');
    }, []);

    const handleBack = useCallback(() => {
        if (!user) {
            // Guest - go to onboarding
            router.replace('/(auth)/onboarding');
        } else {
            router.back();
        }
    }, [user, router]);

    // ========================================================================
    // Return
    // ========================================================================

    return {
        puzzle,
        loading,
        debugInfo,
        introPhase,
        setIntroPhase,
        handlePlayClick,
        gameState,
        setGameState,
        handleBack,
        isRegion,
        isUserMode,
        brandColor,
        isTodayPuzzle,
        theme,
    };
}
