/**
 * useHomeLogic.ts
 * Shared logic for Home Screen (Mobile & Web)
 * 
 * Extracted from mobile app's (tabs)/index.tsx
 * Handles: greeting, stats calculations, navigation, today's game status
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useRouter, useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import { useOptions } from '../lib/options';
import { useUserStats } from '../hooks/useUserStats';
import { useProfile } from '../hooks/useProfile';
import { useStreakSaverStatus } from '../hooks/useStreakSaverStatus';
import { useSubscription } from '../hooks/useSubscription';
import { useConversionPrompt } from '../contexts/ConversionPromptContext';
import { useAppReadiness } from '../contexts/AppReadinessContext';
import { useBadgeSystem } from '../hooks/useBadgeSystem';
import { getTodaysPuzzleDate } from '../lib/dateUtils';
import { useIsFocused } from '@react-navigation/native';

// Theme generator
export const getHomeTheme = (isDark: boolean) => {
    return {
        pageBg: isDark ? '#0f172a' : '#F1F5F9',
        cardBg: isDark ? '#1e293b' : '#FFFFFF',
        textPrimary: isDark ? '#FFFFFF' : '#1e293b',
        textSecondary: isDark ? '#94A3B8' : '#64748B',
        headerBg: isDark ? '#1e293b' : '#FFFFFF',

        // Card colors - Mobile App palette
        playRegion: '#7DAAE8',   // Blue for Region
        playUser: '#66becb',     // Teal for User
        archiveRegion: '#FFD429', // Yellow for Region
        archiveUser: '#fdab58',   // Orange for User
        statsRegion: '#93c54e',   // Green for Region
        statsUser: '#84b86c',     // Green for User
    };
};

// Hamster image mappings
export const HAMSTER_IMAGES = {
    playUnsolved: require('../assets/ui/webp_assets/Historian-Hamster.webp'),
    playSolved: require('../assets/ui/webp_assets/Win-Hamster-Blue.webp'),
    archive: require('../assets/ui/webp_assets/Librarian-Hamster-Yellow.webp'),
    stats: require('../assets/ui/webp_assets/Maths-Hamster.webp'),
};

// Types
export interface GameModeStats {
    todayStatus: 'not-played' | 'solved' | 'failed';
    guesses: number;
    stats: {
        current_streak: number;
        games_played: number;
        games_won: number;
        guess_distribution: Record<string, number>;
        cumulative_monthly_percentile: number | null;
    };
    winRate: string;
    avgGuesses: string;
}

// Main Hook
export const useHomeLogic = () => {
    const router = useRouter();
    const { user, isGuest } = useAuth();
    const { gameMode, setGameMode, darkMode } = useOptions();
    const { profile } = useProfile();
    const { isPro } = useSubscription();
    const { incrementInteraction } = useConversionPrompt();
    const { isAppReady } = useAppReadiness();
    const { pendingBadges, markBadgeAsSeen } = useBadgeSystem();
    const isFocused = useIsFocused();

    // Stats hooks
    const { stats: regionHookStats, refetch: refetchRegionStats } = useUserStats('REGION');
    const { stats: userHookStats, refetch: refetchUserStats } = useUserStats('USER');

    // Streak saver status
    const [todaysPuzzleDate, setTodaysPuzzleDate] = useState(() => getTodaysPuzzleDate());
    const { holidayActive, holidayEndDate } = useStreakSaverStatus(todaysPuzzleDate);

    // Refresh date on focus (cross-midnight edge case)
    useEffect(() => {
        if (isFocused) {
            const newToday = getTodaysPuzzleDate();
            if (newToday !== todaysPuzzleDate) {
                setTodaysPuzzleDate(newToday);
            }
        }
    }, [isFocused, todaysPuzzleDate]);

    // States
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [firstName, setFirstName] = useState("User");
    const [todayStatusRegion, setTodayStatusRegion] = useState<'not-played' | 'solved' | 'failed'>('not-played');
    const [todayStatusUser, setTodayStatusUser] = useState<'not-played' | 'solved' | 'failed'>('not-played');
    const [guessesRegion, setGuessesRegion] = useState(0);
    const [guessesUser, setGuessesUser] = useState(0);

    // Modal states
    const [helpVisible, setHelpVisible] = useState(false);
    const [showHolidayModal, setShowHolidayModal] = useState(false);
    const [holidayModalMode, setHolidayModalMode] = useState<'REGION' | 'USER'>('USER');

    // Default stats
    const defaultStats = {
        current_streak: 0,
        games_played: 0,
        games_won: 0,
        guess_distribution: {},
        cumulative_monthly_percentile: null
    };
    const regionStats = regionHookStats || defaultStats;
    const userStats = userHookStats || defaultStats;

    // User profile
    const userRegion = profile?.region || 'UK';

    // Throttle ref
    const lastFetchRef = useRef<number>(0);
    const prevUserIdRef = useRef<string | undefined>(undefined);

    // Load cached data on mount
    useEffect(() => {
        const loadCache = async () => {
            try {
                const todayStr = todaysPuzzleDate;

                // 1. Name
                const cachedName = await AsyncStorage.getItem('cached_first_name');
                if (cachedName) setFirstName(cachedName);

                // 2. Region Status
                const cachedRegion = await AsyncStorage.getItem('cached_game_status_region');
                if (cachedRegion) {
                    const parsed = JSON.parse(cachedRegion);
                    if (parsed.date === todayStr) {
                        setTodayStatusRegion(parsed.status);
                        setGuessesRegion(parsed.guesses);
                    }
                }

                // 3. User Status
                const cachedUser = await AsyncStorage.getItem('cached_game_status_user');
                if (cachedUser) {
                    const parsed = JSON.parse(cachedUser);
                    if (parsed.date === todayStr) {
                        setTodayStatusUser(parsed.status);
                        setGuessesUser(parsed.guesses);
                    }
                }
            } catch (e) {
                console.log('Error loading cache:', e);
            }
        };
        loadCache();
    }, [todaysPuzzleDate]);

    // Reset throttle on user change
    useEffect(() => {
        if (user?.id && user.id !== prevUserIdRef.current) {
            lastFetchRef.current = 0;
            prevUserIdRef.current = user.id;
            const timer = setTimeout(() => {
                refetchRegionStats();
                refetchUserStats();
            }, 500);
            return () => clearTimeout(timer);
        }
    }, [user?.id, refetchRegionStats, refetchUserStats]);

    // Fetch data
    const fetchData = useCallback(async (force = false) => {
        const now = Date.now();
        if (!force && lastFetchRef.current && (now - lastFetchRef.current < 10000)) {
            return;
        }
        lastFetchRef.current = now;

        try {
            setLoading(true);
            if (!user) return;

            refetchRegionStats();
            refetchUserStats();

            const todayStr = todaysPuzzleDate;
            const startOfDay = new Date();
            startOfDay.setHours(0, 0, 0, 0);

            // Region Attempts
            const { data: attemptsReg } = await supabase
                .from('game_attempts_region')
                .select('*, questions_allocated_region(puzzle_date)')
                .eq('user_id', user.id)
                .gte('updated_at', startOfDay.toISOString());

            if (attemptsReg && attemptsReg.length > 0) {
                const todayAttempt = attemptsReg.find((a: any) => a.questions_allocated_region?.puzzle_date === todayStr);
                if (todayAttempt) {
                    const status = todayAttempt.result === 'won' ? 'solved' : (todayAttempt.result === 'lost' ? 'failed' : 'not-played');
                    setTodayStatusRegion(status);
                    if (todayAttempt.result === 'won') setGuessesRegion(todayAttempt.num_guesses || 0);
                    AsyncStorage.setItem('cached_game_status_region', JSON.stringify({
                        date: todayStr,
                        status,
                        guesses: todayAttempt.num_guesses || 0
                    }));
                }
            }

            // User Attempts
            const { data: attemptsUser } = await supabase
                .from('game_attempts_user')
                .select('*, questions_allocated_user(puzzle_date)')
                .eq('user_id', user.id)
                .gte('updated_at', startOfDay.toISOString());

            if (attemptsUser && attemptsUser.length > 0) {
                const todayAttempt = attemptsUser.find((a: any) => a.questions_allocated_user?.puzzle_date === todayStr);
                if (todayAttempt) {
                    const status = todayAttempt.result === 'won' ? 'solved' : (todayAttempt.result === 'lost' ? 'failed' : 'not-played');
                    setTodayStatusUser(status);
                    if (todayAttempt.result === 'won') setGuessesUser(todayAttempt.num_guesses || 0);
                    AsyncStorage.setItem('cached_game_status_user', JSON.stringify({
                        date: todayStr,
                        status,
                        guesses: todayAttempt.num_guesses || 0
                    }));
                }
            }

            // Fetch Profile Name
            const { data: profileData } = await supabase
                .from('user_profiles')
                .select('first_name')
                .eq('id', user.id)
                .single();
            if (profileData?.first_name) {
                setFirstName(profileData.first_name);
                AsyncStorage.setItem('cached_first_name', profileData.first_name);
            }

        } catch (e) {
            console.error('[Home] Fetch error:', e);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [user, refetchRegionStats, refetchUserStats, todaysPuzzleDate]);

    // Fetch on focus
    useFocusEffect(
        useCallback(() => {
            if (user) {
                fetchData(true);
            }
        }, [user, fetchData])
    );

    // Refresh handler
    const onRefresh = useCallback(() => {
        setRefreshing(true);
        fetchData(true);
    }, [fetchData]);

    // Greeting
    const getGreeting = useCallback(() => {
        const hour = new Date().getHours();
        if (hour < 12) return "Good morning";
        if (hour < 18) return "Good afternoon";
        return "Good evening";
    }, []);

    // Stats calculator
    const calculateStats = useCallback((stats: any, guesses: number): string => {
        const totalGames = stats?.games_played || 0;
        return totalGames > 0 ? ((stats?.games_won || 0) / totalGames * 100).toFixed(0) : "0";
    }, []);

    const calculateTotalGuesses = useCallback((distribution: any) => {
        if (!distribution) return 0;
        let total = 0;
        Object.entries(distribution).forEach(([guesses, count]) => {
            total += parseInt(guesses) * (count as number);
        });
        return total;
    }, []);

    const calculateAvgGuesses = useCallback((stats: any) => {
        const totalGuesses = calculateTotalGuesses(stats?.guess_distribution);
        return (stats?.games_won || 0) > 0 ? (totalGuesses / (stats?.games_won || 1)).toFixed(1) : "0.0";
    }, [calculateTotalGuesses]);

    // Percentile message generator
    const getPercentileMessage = useCallback((todayStatus: 'not-played' | 'solved' | 'failed', stats: any) => {
        const dayOfMonth = new Date().getDate();
        const percentile = stats?.cumulative_monthly_percentile;
        const currentStreak = stats?.current_streak || 0;

        if (todayStatus === 'not-played') {
            if (currentStreak > 0) {
                const dayText = currentStreak === 1 ? 'day' : 'days';
                return `Continue your streak of ${currentStreak} ${dayText} in a row`;
            } else {
                return "Play today's puzzle to start a new streak";
            }
        } else {
            if (dayOfMonth >= 5 && percentile !== null && percentile !== undefined && percentile > 0) {
                const roundedPercentile = Math.floor(percentile / 5) * 5;
                if (percentile >= 50) {
                    return `You're in the top ${roundedPercentile}% of players`;
                }
            }
            return "Play the archive to boost your ranking";
        }
    }, []);

    // Navigation handlers
    const handlePlayToday = useCallback((isRegion: boolean) => {
        incrementInteraction();
        if (holidayActive && (isRegion ? todayStatusRegion : todayStatusUser) === 'not-played') {
            setHolidayModalMode(isRegion ? 'REGION' : 'USER');
            setShowHolidayModal(true);
        } else {
            const mode = isRegion ? 'REGION' : 'USER';
            router.push(`/game/${mode}/${todaysPuzzleDate}`);
        }
    }, [incrementInteraction, holidayActive, todayStatusRegion, todayStatusUser, router, todaysPuzzleDate]);

    const handleArchive = useCallback((isRegion: boolean) => {
        incrementInteraction();
        router.push({ pathname: '/archive', params: { mode: isRegion ? 'REGION' : 'USER' } });
    }, [incrementInteraction, router]);

    const handleStats = useCallback((isRegion: boolean) => {
        incrementInteraction();
        router.push(`/stats?mode=${isRegion ? 'REGION' : 'USER'}`);
    }, [incrementInteraction, router]);

    const handleSettings = useCallback(() => {
        router.push('/settings');
    }, [router]);

    const handleHelp = useCallback(() => {
        setHelpVisible(true);
    }, []);

    const handleSubscription = useCallback(() => {
        if (isPro) {
            router.push('/category-selection');
        } else {
            router.push('/subscription');
        }
    }, [isPro, router]);

    // Computed values
    const regionWinRate = calculateStats(regionStats, guessesRegion);
    const userWinRate = calculateStats(userStats, guessesUser);
    const regionAvgGuesses = calculateAvgGuesses(regionStats);
    const userAvgGuesses = calculateAvgGuesses(userStats);
    const regionPercentileMessage = getPercentileMessage(todayStatusRegion, regionStats);
    const userPercentileMessage = getPercentileMessage(todayStatusUser, userStats);

    return {
        // Auth
        user,
        isGuest,
        isPro,

        // UI State
        loading,
        refreshing,
        onRefresh,
        isDark: darkMode,

        // Profile
        firstName,
        userRegion,
        getGreeting,

        // Region Mode
        regionStats,
        todayStatusRegion,
        guessesRegion,
        regionWinRate,
        regionAvgGuesses,
        regionPercentileMessage,

        // User Mode
        userStats,
        todayStatusUser,
        guessesUser,
        userWinRate,
        userAvgGuesses,
        userPercentileMessage,

        // Navigation
        handlePlayToday,
        handleArchive,
        handleStats,
        handleSettings,
        handleHelp,
        handleSubscription,

        // Holiday Modal
        holidayActive,
        holidayEndDate,
        showHolidayModal,
        setShowHolidayModal,
        holidayModalMode,
        setHolidayModalMode,

        // Help Modal
        helpVisible,
        setHelpVisible,

        // Date
        todaysPuzzleDate,
    };
};
