import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { Platform, Share } from 'react-native';
import { useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { useOptions } from '../lib/options';
import { useBadgeSystem } from './useBadgeSystem';
import { useStreakSaver } from '../contexts/StreakSaverContext';

// ============================================================================
// Types
// ============================================================================

export interface EndGameParams {
    isWin: boolean;
    guessesCount: number;
    maxGuesses: number;
    answerDateCanonical: string;
    eventTitle: string;
    eventDescription: string;
    gameMode: 'REGION' | 'USER';
    puzzleId: string;
    isGuest: boolean;
    isStreakSaverGame: boolean;
    isToday: boolean;
    justFinished: boolean;
    currentStreak: number;
    earnedBadges?: any[];
}

export interface UseEndGameLogicReturn {
    // Formatted data
    formattedDate: string;
    shareText: string;

    // Colors
    statsColor: string;
    shareColor: string;
    homeColor: string;
    archiveColor: string;

    // Celebration state
    showStreakCelebration: boolean;
    showBadgePopup: boolean;
    currentBadge: any | null;
    celebrationComplete: boolean;

    // Actions
    handleShare: () => Promise<void>;
    goHome: () => void;
    goStats: () => void;
    goArchive: () => void;
    goLogin: () => void;
    dismissStreakCelebration: () => void;
    dismissBadgePopup: () => void;
}

// ============================================================================
// Helpers
// ============================================================================

const getOrdinal = (n: number): string => {
    const s = ['th', 'st', 'nd', 'rd'];
    const v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
};

const formatDate = (dateStr: string): string => {
    const date = new Date(dateStr);
    const day = date.getDate();
    const month = date.toLocaleString('default', { month: 'long' });
    const year = date.getFullYear();
    return `${getOrdinal(day)} ${month} ${year}`;
};

// ============================================================================
// Hook
// ============================================================================

export function useEndGameLogic(params: EndGameParams): UseEndGameLogicReturn {
    const router = useRouter();
    const queryClient = useQueryClient();
    const { setGameMode } = useOptions();
    const { pendingBadges, markBadgeAsSeen } = useBadgeSystem();
    const { completeStreakSaverSession } = useStreakSaver();

    // Destructure params
    const {
        isWin,
        guessesCount,
        maxGuesses,
        answerDateCanonical,
        eventTitle,
        gameMode,
        isGuest,
        isStreakSaverGame,
        isToday,
        justFinished,
        currentStreak,
        earnedBadges = [],
    } = params;

    const isLocalMode = gameMode === 'USER';

    // ========================================================================
    // Colors (matching mobile app exactly)
    // ========================================================================

    const colors = useMemo(() => ({
        stats: isLocalMode ? '#93cd78' : '#4ade80',    // Green
        share: '#f472b6',                                // Pink
        home: isLocalMode ? '#66becb' : '#60a5fa',       // Blue
        archive: isLocalMode ? '#fdab58' : '#facc15',    // Yellow
    }), [isLocalMode]);

    // ========================================================================
    // Formatted Data
    // ========================================================================

    const formattedDate = useMemo(() => formatDate(answerDateCanonical), [answerDateCanonical]);

    const shareText = useMemo(() => {
        return `I ${isWin ? 'solved' : 'tried'} today's Elementle puzzle!\n${eventTitle}\n${formattedDate}\n${isWin ? `Guessed in ${guessesCount}/${maxGuesses}` : `Used all ${maxGuesses} guesses`}`;
    }, [isWin, eventTitle, formattedDate, guessesCount, maxGuesses]);

    // ========================================================================
    // Celebration State
    // ========================================================================

    const [showStreakCelebration, setShowStreakCelebration] = useState(false);
    const [showBadgePopup, setShowBadgePopup] = useState(false);
    const [currentBadge, setCurrentBadge] = useState<any | null>(null);
    const [celebrationComplete, setCelebrationComplete] = useState(false);
    const [badgeQueue, setBadgeQueue] = useState<any[]>([]);
    const [visitedBadgeIds, setVisitedBadgeIds] = useState<Set<number>>(new Set());

    const celebrationHandledRef = useRef(false);

    // Initial celebration trigger
    useEffect(() => {
        if (celebrationHandledRef.current) return;

        // Show streak celebration if: win + has streak + today/saver + just finished
        if (isWin && currentStreak > 0 && (isToday || isStreakSaverGame) && justFinished) {
            celebrationHandledRef.current = true;
            const timer = setTimeout(() => {
                setShowStreakCelebration(true);
            }, 2500);
            return () => clearTimeout(timer);
        } else {
            celebrationHandledRef.current = true;
            setCelebrationComplete(true);
        }
    }, [isWin, currentStreak, isToday, isStreakSaverGame, justFinished]);

    // Process badge queue after streak closes
    useEffect(() => {
        if (celebrationComplete && earnedBadges.length > 0 && badgeQueue.length === 0) {
            setBadgeQueue(earnedBadges);
        }
    }, [celebrationComplete, earnedBadges, badgeQueue.length]);

    // Show next badge
    useEffect(() => {
        if (badgeQueue.length > 0 && !showBadgePopup && !currentBadge) {
            const nextBadge = badgeQueue[0];
            if (!visitedBadgeIds.has(nextBadge.id)) {
                setCurrentBadge(nextBadge);
                setShowBadgePopup(true);
                setVisitedBadgeIds(prev => new Set(prev).add(nextBadge.id));
            }
        }
    }, [badgeQueue, showBadgePopup, currentBadge, visitedBadgeIds]);

    // ========================================================================
    // Actions
    // ========================================================================

    const handleShare = useCallback(async () => {
        try {
            if (Platform.OS === 'web') {
                // Web: Try navigator.share, fallback to clipboard
                if (navigator.share) {
                    await navigator.share({ text: shareText });
                } else {
                    await navigator.clipboard.writeText(shareText);
                    // Could add toast notification here
                }
            } else {
                // Mobile: Use native Share
                await Share.share({ message: shareText });
            }
        } catch (error) {
            console.error('[useEndGameLogic] Share error:', error);
            // Fallback to clipboard on any error
            if (Platform.OS === 'web') {
                try {
                    await navigator.clipboard.writeText(shareText);
                } catch (e) {
                    console.error('[useEndGameLogic] Clipboard fallback failed:', e);
                }
            }
        }
    }, [shareText]);

    const goHome = useCallback(() => {
        if (gameMode === 'REGION' || gameMode === 'USER') {
            setGameMode(gameMode);
        }
        if (isStreakSaverGame) {
            completeStreakSaverSession();
        }
        queryClient.invalidateQueries({ queryKey: ['userStats'] });
        router.replace('/');
    }, [gameMode, isStreakSaverGame, setGameMode, completeStreakSaverSession, queryClient, router]);

    const goStats = useCallback(() => {
        router.push(`/stats?mode=${gameMode}`);
    }, [router, gameMode]);

    const goArchive = useCallback(() => {
        router.push('/archive');
    }, [router]);

    const goLogin = useCallback(() => {
        router.replace('/(auth)/login');
    }, [router]);

    const dismissStreakCelebration = useCallback(() => {
        setShowStreakCelebration(false);
        setCelebrationComplete(true);
    }, []);

    const dismissBadgePopup = useCallback(() => {
        if (currentBadge) {
            markBadgeAsSeen(currentBadge.id);
        }
        setShowBadgePopup(false);
        setCurrentBadge(null);
        setBadgeQueue(prev => prev.slice(1));
    }, [currentBadge, markBadgeAsSeen]);

    // ========================================================================
    // Return
    // ========================================================================

    return {
        formattedDate,
        shareText,
        statsColor: colors.stats,
        shareColor: colors.share,
        homeColor: colors.home,
        archiveColor: colors.archive,
        showStreakCelebration,
        showBadgePopup,
        currentBadge,
        celebrationComplete,
        handleShare,
        goHome,
        goStats,
        goArchive,
        goLogin,
        dismissStreakCelebration,
        dismissBadgePopup,
    };
}
