/**
 * useStatsScreenLogic.ts
 * Shared logic for Stats Screen (mobile & web)
 * 
 * Extracts all data fetching, calculations, and state management
 * from the mobile stats.tsx component.
 */

import { useState, useCallback, useEffect } from 'react';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { subDays } from 'date-fns';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import { useOptions } from '../lib/options';
import { useNetwork } from '../contexts/NetworkContext';
import { hasFeatureAccess } from '../lib/featureGates';

// Types
export interface GameStats {
    played: number;
    won: number;
    currentStreak: number;
    maxStreak: number;
    guessDistribution: Record<string, number>;
    cumulativeMonthlyPercentile?: number;
}

export interface DailyAttempt {
    date: string;
    won: boolean;
    guesses: number;
}

export interface HighestBadges {
    elementle: any | null;
    streak: any | null;
    percentile: any | null;
}

// Helper Functions
export const calculateWinPercentage = (played: number, won: number): number => {
    return played > 0 ? Math.round((won / played) * 100) : 0;
};

export const calculateAverageGuesses = (stats: GameStats): string => {
    if (stats.played === 0) return "0";
    const dist = stats.guessDistribution;
    let totalGuesses = 0;
    Object.entries(dist).forEach(([guesses, count]) => {
        totalGuesses += parseInt(guesses) * count;
    });
    const losses = stats.played - stats.won;
    totalGuesses += losses * 6;
    return (totalGuesses / stats.played).toFixed(1);
};

export const getPercentileText = (percentile: number | undefined): string => {
    if (percentile === undefined || percentile === null || percentile <= 0) return "NA";
    if (percentile <= 1) return "Top 1%";
    if (percentile <= 2) return "Top 2%";
    if (percentile <= 5) return "Top 5%";
    if (percentile <= 10) return "Top 10%";
    if (percentile <= 15) return "Top 20%";
    const rounded = Math.ceil(percentile / 10) * 10;
    return `Top ${rounded}%`;
};

export const getMaxGuesses = (guessDistribution: Record<string, number>): number => {
    return Math.max(...Object.values(guessDistribution), 1);
};

// Theme Generator
export const getStatsTheme = (mode: 'USER' | 'REGION', isDark: boolean, systemBackgroundColor: string, systemSurfaceColor: string) => {
    const brandColor = mode === 'REGION' ? '#93c54e' : '#84b86c';
    const brandColorDark = mode === 'REGION' ? '#84b86c' : '#7ab862';
    const brandColorLight = '#E8F5E9';
    const brandColorVeryLight = '#F1F8E9';

    return {
        pageBg: isDark ? systemBackgroundColor : '#FAFBFC',
        cardBg: isDark ? systemSurfaceColor : '#FFFFFF',
        headerBg: brandColor,
        textPrimary: isDark ? '#FFFFFF' : '#1a1a2e',
        textSecondary: isDark ? '#CBD5E1' : '#6B7280',
        textMuted: isDark ? '#94A3B8' : '#9CA3AF',
        accent: brandColor,
        iconAccent: brandColor,
        viewAllText: isDark ? '#FFD429' : '#7DAAE8',
        accentDark: brandColorDark,
        accentLight: brandColorLight,
        accentVeryLight: brandColorVeryLight,
        badgeWonBg: brandColor,
        badgeText: isDark ? '#CBD5E1' : '#6B7280',
        chartBar: brandColor,
        chartTrack: isDark ? '#334155' : brandColorVeryLight,
        lostBar: '#EF4444',
        lostTrack: isDark ? 'rgba(127, 29, 29, 0.6)' : '#FEF2F2',
        cardBorder: isDark ? '#334155' : '#F3F4F6',
        shadow: 'rgba(0, 0, 0, 0.04)',
    };
};

// Main Hook
export const useStatsScreenLogic = () => {
    const router = useRouter();
    const { user, isGuest } = useAuth();
    const { textScale } = useOptions();
    const searchParams = useLocalSearchParams();
    const mode = (searchParams.mode as 'USER' | 'REGION') || 'USER';
    const { isConnected } = useNetwork();

    // State
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState<GameStats>({
        played: 0,
        won: 0,
        currentStreak: 0,
        maxStreak: 0,
        guessDistribution: { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 },
    });
    const [recentActivity, setRecentActivity] = useState<DailyAttempt[]>([]);
    const [showPercentileInfo, setShowPercentileInfo] = useState(false);
    const [showBadgesModal, setShowBadgesModal] = useState(false);
    const [guestModalVisible, setGuestModalVisible] = useState(false);
    const [highestBadges, setHighestBadges] = useState<HighestBadges>({ elementle: null, streak: null, percentile: null });
    const [selectedCategory, setSelectedCategory] = useState<'elementle' | 'streak' | 'percentile'>('elementle');
    const [userRegion, setUserRegion] = useState<string>('UK');

    // Check for guest mode
    useEffect(() => {
        if (isGuest && !hasFeatureAccess('stats', !isGuest)) {
            setGuestModalVisible(true);
        }
    }, [isGuest]);

    // Data Fetching
    const fetchData = useCallback(async () => {
        if (!user) return;

        try {
            setLoading(true);

            const CACHE_KEY = `stats_page_cache_${user.id}_${mode}`;

            // Try Cache First
            try {
                const cached = await AsyncStorage.getItem(CACHE_KEY);
                if (cached) {
                    const parsed = JSON.parse(cached);
                    if (parsed.stats) setStats(parsed.stats);
                    if (parsed.recentActivity) setRecentActivity(parsed.recentActivity);
                    if (parsed.highestBadges) setHighestBadges(parsed.highestBadges);
                    if (parsed.userRegion) setUserRegion(parsed.userRegion);
                    console.log('[Stats] Loaded from cache');
                    setLoading(false);
                }
            } catch (e) {
                console.log('Error reading stats cache', e);
            }

            if (isConnected === false) {
                setLoading(false);
                return;
            }

            // Fetch User Profile for Region
            const { data: profile } = await supabase
                .from('user_profiles')
                .select('region')
                .eq('id', user.id)
                .single();

            const fetchedRegion = profile?.region || 'UK';
            setUserRegion(fetchedRegion);

            // Determine which stats table to query based on mode
            const STATS_TABLE = mode === 'REGION' ? 'user_stats_region' : 'user_stats_user';

            // Fetch Aggregated Stats
            let statsQuery = supabase
                .from(STATS_TABLE)
                .select('*')
                .eq('user_id', user.id);

            if (mode === 'REGION') {
                statsQuery = statsQuery.eq('region', fetchedRegion);
            }

            const { data: userStats, error: statsError } = await statsQuery.single();

            if (statsError && statsError.code !== 'PGRST116') {
                console.error("Error fetching stats:", statsError);
            }

            let newStats = stats;
            if (userStats) {
                newStats = {
                    played: userStats.games_played || 0,
                    won: userStats.games_won || 0,
                    currentStreak: userStats.current_streak || 0,
                    maxStreak: userStats.max_streak || 0,
                    guessDistribution: (userStats.guess_distribution as Record<string, number>) || { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 },
                    cumulativeMonthlyPercentile: userStats.cumulative_monthly_percentile ?? undefined
                };
                setStats(newStats);
            }

            // Fetch Badges for Preview
            const { data: userBadgesData } = await supabase
                .from('user_badges')
                .select('*, badge:badges(*)')
                .eq('user_id', user.id);

            let highest: HighestBadges = { elementle: null, streak: null, percentile: null };
            if (userBadgesData) {
                const categories = ['elementle', 'streak', 'percentile'] as const;
                categories.forEach(cat => {
                    const catBadges = userBadgesData.filter((ub: any) =>
                        ub.badge?.category?.toLowerCase().includes(cat)
                    );

                    if (catBadges.length > 0) {
                        catBadges.sort((a: any, b: any) => (b.badge?.threshold || 0) - (a.badge?.threshold || 0));
                        highest[cat] = catBadges[0];
                    }
                });
                setHighestBadges(highest);
            }

            // Fetch Recent Activity (Last 30 Days)
            const thirtyDaysAgo = subDays(new Date(), 30);
            const ATTEMPTS_TABLE_NAME = mode === 'REGION' ? 'game_attempts_region' : 'game_attempts_user';
            const { data: attempts, error: attemptsError } = await supabase
                .from(ATTEMPTS_TABLE_NAME)
                .select('result, num_guesses, started_at')
                .eq('user_id', user.id)
                .gte('started_at', thirtyDaysAgo.toISOString())
                .order('started_at', { ascending: true });

            if (attemptsError) throw attemptsError;

            let activity: DailyAttempt[] = [];
            if (attempts) {
                activity = attempts
                    .filter(a => a.result === 'won' || a.result === 'lost')
                    .map(a => ({
                        date: a.started_at || new Date().toISOString(),
                        won: a.result === 'won',
                        guesses: a.num_guesses || 6
                    }));
                setRecentActivity(activity);
            }

            // Cache Save
            const minimalData = {
                stats: newStats,
                recentActivity: activity,
                highestBadges: highest,
                userRegion: fetchedRegion
            };

            try {
                await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(minimalData));
            } catch (e) { console.error('Stats cache write failed', e); }

        } catch (error) {
            console.error('Error fetching stats page data:', error);
        } finally {
            setLoading(false);
        }
    }, [user, mode, isConnected]);

    // Use focus effect for mobile, regular effect for web
    useFocusEffect(
        useCallback(() => {
            if (user) {
                fetchData();
            }
        }, [user, fetchData])
    );

    // Navigation
    const goBack = () => router.back();

    // Computed values
    const winPercentage = calculateWinPercentage(stats.played, stats.won);
    const averageGuesses = calculateAverageGuesses(stats);
    const maxGuesses = getMaxGuesses(stats.guessDistribution);
    const losses = stats.played - stats.won;
    const percentileText = getPercentileText(stats.cumulativeMonthlyPercentile);

    return {
        // Auth
        user,
        isGuest,

        // Config
        mode,
        textScale,
        userRegion,
        isConnected,

        // State
        loading,
        stats,
        recentActivity,
        highestBadges,

        // Modals
        showPercentileInfo,
        setShowPercentileInfo,
        showBadgesModal,
        setShowBadgesModal,
        guestModalVisible,
        setGuestModalVisible,
        selectedCategory,
        setSelectedCategory,

        // Computed
        winPercentage,
        averageGuesses,
        maxGuesses,
        losses,
        percentileText,

        // Actions
        goBack,
        fetchData,
    };
};
