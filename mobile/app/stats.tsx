import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator, Modal, Image } from 'react-native';
import { AllBadgesModal } from '../components/stats/AllBadgesModal';
import { BadgeSlot } from '../components/stats/BadgeSlot';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { styled, useColorScheme } from 'nativewind';
import { ChevronLeft, BarChart3, TrendingUp, Award, Info, X, Trophy, Flame, Target } from 'lucide-react-native';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import { useOptions } from '../lib/options';
import { format, subDays } from 'date-fns';
import { SafeAreaView } from 'react-native-safe-area-context';
import { GuestRestrictionModal } from '../components/GuestRestrictionModal';
import { hasFeatureAccess } from '../lib/featureGates';
import { AdBanner } from '../components/AdBanner';
import { AdBannerContext } from '../contexts/AdBannerContext';
import { LinearGradient } from 'expo-linear-gradient';

import { ThemedView } from '../components/ThemedView';
import { ThemedText } from '../components/ThemedText';
import { useThemeColor } from '../hooks/useThemeColor';

const StyledView = styled(View);
const StyledText = styled(Text);
const StyledTouchableOpacity = styled(TouchableOpacity);
const StyledScrollView = styled(ScrollView);
const StyledImage = styled(Image);

const MathsHamsterGreen = require('../assets/ui/webp_assets/Maths-Hamster.webp');
const MathsHamsterTransparent = require('../assets/ui/webp_assets/Signup-Hamster-Transparent.webp');

interface GameStats {
    played: number;
    won: number;
    currentStreak: number;
    maxStreak: number;
    guessDistribution: Record<string, number>;
    cumulativeMonthlyPercentile?: number;
}

interface DailyAttempt {
    date: string;
    won: boolean;
    guesses: number;
}

export default function StatsScreen() {
    const router = useRouter();
    const { user, isGuest } = useAuth();
    const { textScale } = useOptions();
    const searchParams = useLocalSearchParams();
    const mode = (searchParams.mode as 'USER' | 'REGION') || 'USER';
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
    const [highestBadges, setHighestBadges] = useState<Record<string, any>>({ elementle: null, streak: null, percentile: null });
    const [selectedCategory, setSelectedCategory] = useState<'elementle' | 'streak' | 'percentile'>('elementle');
    const [userRegion, setUserRegion] = useState<string>('UK');
    const borderColor = useThemeColor({}, 'border');
    const iconColor = useThemeColor({}, 'icon');
    const textColor = useThemeColor({}, 'text');

    // System Theme Colors
    const systemBackgroundColor = useThemeColor({}, 'background');
    const systemSurfaceColor = useThemeColor({}, 'surface');
    const { colorScheme } = useColorScheme();
    const isDark = colorScheme === 'dark';

    // Theme Colors - Green-accented clean design
    const brandColor = mode === 'REGION' ? '#93c54e' : '#84b86c';
    const brandColorDark = mode === 'REGION' ? '#84b86c' : '#7ab862';
    const brandColorLight = mode === 'REGION' ? '#E8F5E9' : '#E8F5E9';
    const brandColorVeryLight = mode === 'REGION' ? '#F1F8E9' : '#F1F8E9';

    const theme = {
        pageBg: isDark ? systemBackgroundColor : '#FAFBFC',
        cardBg: isDark ? systemSurfaceColor : '#FFFFFF',
        headerBg: brandColor,
        textPrimary: isDark ? '#FFFFFF' : '#1a1a2e',
        textSecondary: isDark ? '#CBD5E1' : '#6B7280',
        textMuted: isDark ? '#94A3B8' : '#9CA3AF',
        accent: brandColor,
        iconAccent: brandColor, // Always green
        viewAllText: isDark ? '#FFD429' : '#7DAAE8',

        accentDark: brandColorDark,
        accentLight: brandColorLight,
        accentVeryLight: brandColorVeryLight, // Same pale green background in both modes
        badgeWonBg: brandColor, // Strong green for won badges
        badgeText: isDark ? '#CBD5E1' : '#6B7280', // Grey/white for non-won badges
        chartBar: brandColor,
        chartTrack: isDark ? '#334155' : brandColorVeryLight,
        lostBar: '#EF4444',
        lostTrack: isDark ? 'rgba(127, 29, 29, 0.6)' : '#FEF2F2',
        cardBorder: isDark ? '#334155' : '#F3F4F6',
        shadow: 'rgba(0, 0, 0, 0.04)',
        hamsterTitle: mode === 'REGION' ? `${userRegion} Edition` : 'Personal Stats',
    };

    // Check for guest mode on mount
    useEffect(() => {
        if (isGuest && !hasFeatureAccess('stats', !isGuest)) {
            setGuestModalVisible(true);
        }
    }, [isGuest]);

    const fetchData = useCallback(async () => {
        if (!user) return;

        try {
            setLoading(true);

            // 0. Fetch User Profile for Region
            const { data: profile } = await supabase
                .from('user_profiles')
                .select('region')
                .eq('id', user.id)
                .single();

            const fetchedRegion = profile?.region || 'UK';
            setUserRegion(fetchedRegion);

            // Determine which stats table to query based on mode
            const STATS_TABLE = mode === 'REGION' ? 'user_stats_region' : 'user_stats_user';

            // 1. Fetch Aggregated Stats
            let statsQuery = supabase
                .from(STATS_TABLE)
                .select('*')
                .eq('user_id', user.id);

            // Add region filter only for REGION mode
            if (mode === 'REGION') {
                statsQuery = statsQuery.eq('region', fetchedRegion);
            }

            const { data: userStats, error: statsError } = await statsQuery.single();

            if (statsError && statsError.code !== 'PGRST116') {
                console.error("Error fetching stats:", statsError);
            }

            if (userStats) {
                setStats({
                    played: userStats.games_played || 0,
                    won: userStats.games_won || 0,
                    currentStreak: userStats.current_streak || 0,
                    maxStreak: userStats.max_streak || 0,
                    guessDistribution: (userStats.guess_distribution as Record<string, number>) || { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 },
                    cumulativeMonthlyPercentile: userStats.cumulative_monthly_percentile
                });
            }

            // 2. Fetch Badges for Preview
            const { data: userBadgesData } = await supabase
                .from('user_badges')
                .select('*, badge:badges(*)')
                .eq('user_id', user.id);

            if (userBadgesData) {
                const highest = { elementle: null, streak: null, percentile: null } as Record<string, any>;

                const categories = ['elementle', 'streak', 'percentile'];
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

            // 3. Fetch Recent Activity (Last 30 Days)
            const thirtyDaysAgo = subDays(new Date(), 30);

            const ATTEMPTS_TABLE_NAME = mode === 'REGION' ? 'game_attempts_region' : 'game_attempts_user';
            const { data: attempts, error: attemptsError } = await supabase
                .from(ATTEMPTS_TABLE_NAME)
                .select('result, num_guesses, started_at')
                .eq('user_id', user.id)
                .gte('started_at', thirtyDaysAgo.toISOString())
                .order('started_at', { ascending: true });

            if (attemptsError) throw attemptsError;

            if (attempts) {
                const activity: DailyAttempt[] = attempts
                    .filter(a => a.result === 'won' || a.result === 'lost')
                    .map(a => ({
                        date: a.started_at,
                        won: a.result === 'won',
                        guesses: a.num_guesses || 6
                    }));
                setRecentActivity(activity);
            }

        } catch (error) {
            console.error('Error fetching stats page data:', error);
        } finally {
            setLoading(false);
        }
    }, [user, mode]);

    useFocusEffect(
        useCallback(() => {
            if (user) {
                fetchData();
            }
        }, [user, fetchData])
    );

    if (!user) {
        return (
            <AdBannerContext.Provider value={true}>
                <SafeAreaView className="flex-1 bg-white dark:bg-slate-900 px-4 justify-center items-center" style={{ paddingBottom: 50 }}>
                    <ActivityIndicator size="large" color={theme.accent} />
                    <StyledText style={{ fontSize: 18 * textScale }} className="mt-4 text-slate-900 dark:text-white">Loading user data...</StyledText>
                </SafeAreaView>
            </AdBannerContext.Provider>
        );
    }

    const winPercentage = stats.played > 0 ? Math.round((stats.won / stats.played) * 100) : 0;

    const averageGuesses = (() => {
        if (stats.played === 0) return "0";
        const dist = stats.guessDistribution;
        let totalGuesses = 0;
        Object.entries(dist).forEach(([guesses, count]) => {
            totalGuesses += parseInt(guesses) * count;
        });
        const losses = stats.played - stats.won;
        totalGuesses += losses * 6;
        return (totalGuesses / stats.played).toFixed(1);
    })();

    const getPercentileText = (percentile: number | undefined) => {
        if (percentile === undefined || percentile === null || percentile <= 0) return "NA";
        if (percentile <= 1) return "Top 1%";
        if (percentile <= 2) return "Top 2%";
        if (percentile <= 5) return "Top 5%";
        if (percentile <= 10) return "Top 10%";
        if (percentile <= 15) return "Top 20%";
        const rounded = Math.ceil(percentile / 10) * 10;
        return `Top ${rounded}%`;
    };

    const maxGuesses = Math.max(...Object.values(stats.guessDistribution), 1);
    const losses = stats.played - stats.won;

    // Stat Card Component for cleaner code
    const StatItem = ({ label, value, icon: Icon }: { label: string; value: string | number; icon?: any }) => (
        <StyledView className="flex-row items-center justify-between py-3">
            <StyledView className="flex-row items-center gap-2">
                {Icon && <Icon size={16} color={theme.textSecondary} />}
                <ThemedText className="font-n-medium text-sm" style={{ color: theme.textSecondary }}>{label}</ThemedText>
            </StyledView>
            <ThemedText className="font-n-bold text-xl" style={{ color: theme.textPrimary }}>{value}</ThemedText>
        </StyledView>
    );

    return (
        <ThemedView className="flex-1" style={{ backgroundColor: theme.pageBg }}>
            {/* Header with green accent */}
            <StyledView style={{ backgroundColor: theme.headerBg }}>
                <SafeAreaView edges={['top']} className="px-5 pb-6">
                    <StyledView className="flex-row items-center justify-between py-3">
                        <StyledTouchableOpacity
                            onPress={() => router.back()}
                            className="p-2 -ml-2"
                        >
                            <ChevronLeft size={24} color="#FFFFFF" />
                        </StyledTouchableOpacity>
                        <ThemedText baseSize={36} className="font-n-bold font-heading" style={{ color: '#FFFFFF' }}>
                            {mode === 'REGION' ? `${userRegion} Stats` : 'Personal Stats'}
                        </ThemedText>
                        <StyledView className="w-10" />
                    </StyledView>
                </SafeAreaView>
            </StyledView>

            {loading ? (
                <StyledView className="flex-1 justify-center items-center">
                    <ActivityIndicator size="large" color={theme.accent} />
                </StyledView>
            ) : (
                <StyledScrollView
                    showsVerticalScrollIndicator={false}
                    className="flex-1"
                    contentContainerStyle={{ paddingBottom: 40 }}
                    style={{ marginTop: -20 }}
                >
                    {/* Main Stats Cards - Overlapping header */}
                    <StyledView className="px-4">
                        {/* Quick Stats Row */}
                        <StyledView className="flex-row gap-3 mb-4">
                            {/* Games Played */}
                            <StyledView
                                className="flex-1 rounded-2xl p-4 items-center"
                                style={{
                                    backgroundColor: theme.cardBg,
                                    shadowColor: '#000',
                                    shadowOffset: { width: 0, height: 2 },
                                    shadowOpacity: 0.06,
                                    shadowRadius: 8,
                                    elevation: 3,
                                }}
                            >
                                <StyledView
                                    className="w-10 h-10 rounded-full items-center justify-center mb-2"
                                    style={{ backgroundColor: theme.accentLight }}
                                >
                                    <Target size={20} color={theme.iconAccent} />
                                </StyledView>
                                <ThemedText className="font-n-bold text-2xl" style={{ color: theme.textPrimary }}>
                                    {stats.played}
                                </ThemedText>
                                <ThemedText className="font-n-medium text-xs mt-1" style={{ color: theme.textSecondary }}>
                                    Played
                                </ThemedText>
                            </StyledView>

                            {/* Win Rate */}
                            <StyledView
                                className="flex-1 rounded-2xl p-4 items-center"
                                style={{
                                    backgroundColor: theme.cardBg,
                                    shadowColor: '#000',
                                    shadowOffset: { width: 0, height: 2 },
                                    shadowOpacity: 0.06,
                                    shadowRadius: 8,
                                    elevation: 3,
                                }}
                            >
                                <StyledView
                                    className="w-10 h-10 rounded-full items-center justify-center mb-2"
                                    style={{ backgroundColor: theme.accentLight }}
                                >
                                    <Trophy size={20} color={theme.iconAccent} />
                                </StyledView>
                                <ThemedText className="font-n-bold text-2xl" style={{ color: theme.textPrimary }}>
                                    {winPercentage}%
                                </ThemedText>
                                <ThemedText className="font-n-medium text-xs mt-1" style={{ color: theme.textSecondary }}>
                                    Win Rate
                                </ThemedText>
                            </StyledView>

                            {/* Average Guesses */}
                            <StyledView
                                className="flex-1 rounded-2xl p-4 items-center"
                                style={{
                                    backgroundColor: theme.cardBg,
                                    shadowColor: '#000',
                                    shadowOffset: { width: 0, height: 2 },
                                    shadowOpacity: 0.06,
                                    shadowRadius: 8,
                                    elevation: 3,
                                }}
                            >
                                <StyledView
                                    className="w-10 h-10 rounded-full items-center justify-center mb-2"
                                    style={{ backgroundColor: theme.accentLight }}
                                >
                                    <BarChart3 size={20} color={theme.iconAccent} />
                                </StyledView>
                                <ThemedText className="font-n-bold text-2xl" style={{ color: theme.textPrimary }}>
                                    {averageGuesses}
                                </ThemedText>
                                <ThemedText className="font-n-medium text-xs mt-1" style={{ color: theme.textSecondary }}>
                                    Avg Guesses
                                </ThemedText>
                            </StyledView>
                        </StyledView>

                        {/* Streak Card */}
                        <StyledView
                            className="rounded-2xl p-5 mb-4"
                            style={{
                                backgroundColor: theme.cardBg,
                                shadowColor: '#000',
                                shadowOffset: { width: 0, height: 2 },
                                shadowOpacity: 0.06,
                                shadowRadius: 8,
                                elevation: 3,
                            }}
                        >
                            <StyledView className="flex-row items-center gap-2 mb-4">
                                <Flame size={22} color={theme.iconAccent} />
                                <ThemedText className="font-n-bold text-lg" style={{ color: theme.textPrimary }}>
                                    Streak
                                </ThemedText>
                            </StyledView>

                            <StyledView className="flex-row">
                                {/* Current Streak */}
                                <StyledView className="flex-1 items-center py-3 border-r" style={{ borderColor: theme.cardBorder }}>
                                    <ThemedText className="font-n-bold text-3xl" style={{ color: theme.textPrimary }}>
                                        {stats.currentStreak}
                                    </ThemedText>
                                    <ThemedText className="font-n-medium text-sm mt-1" style={{ color: theme.textSecondary }}>
                                        Current
                                    </ThemedText>
                                </StyledView>

                                {/* Best Streak */}
                                <StyledView className="flex-1 items-center py-3">
                                    <ThemedText className="font-n-bold text-3xl" style={{ color: theme.textPrimary }}>
                                        {stats.maxStreak}
                                    </ThemedText>
                                    <ThemedText className="font-n-medium text-sm mt-1" style={{ color: theme.textSecondary }}>
                                        Best
                                    </ThemedText>
                                </StyledView>
                            </StyledView>
                        </StyledView>

                        {/* Percentile Card */}
                        <StyledView
                            className="rounded-2xl p-5 mb-4"
                            style={{
                                backgroundColor: theme.cardBg,
                                shadowColor: '#000',
                                shadowOffset: { width: 0, height: 2 },
                                shadowOpacity: 0.06,
                                shadowRadius: 8,
                                elevation: 3,
                            }}
                        >
                            <StyledView className="flex-row items-center">
                                <StyledView className="flex-1">
                                    <StyledView className="flex-row items-center gap-2 mb-1">
                                        <ThemedText className="font-n-bold text-lg" style={{ color: theme.textPrimary }}>
                                            Monthly Ranking
                                        </ThemedText>
                                        <TouchableOpacity onPress={() => setShowPercentileInfo(true)} hitSlop={10}>
                                            <Info size={16} color={theme.textMuted} />
                                        </TouchableOpacity>
                                    </StyledView>
                                    <ThemedText className="font-n-medium text-sm" style={{ color: theme.textSecondary }}>
                                        Month to Date
                                    </ThemedText>
                                </StyledView>

                                <StyledView
                                    className="flex-1 items-center justify-center"
                                >
                                    <ThemedText className="font-n-bold text-xl" style={{ color: theme.textPrimary }}>
                                        {getPercentileText(stats.cumulativeMonthlyPercentile)}
                                    </ThemedText>
                                </StyledView>
                            </StyledView>
                        </StyledView>

                        {/* Badges Section */}
                        <StyledView
                            className="rounded-2xl p-5 mb-4"
                            style={{
                                backgroundColor: theme.cardBg,
                                shadowColor: '#000',
                                shadowOffset: { width: 0, height: 2 },
                                shadowOpacity: 0.06,
                                shadowRadius: 8,
                                elevation: 3,
                            }}
                        >
                            <StyledView className="flex-row justify-between items-center mb-5">
                                <StyledView className="flex-row items-center gap-2">
                                    <Award size={22} color={theme.iconAccent} />
                                    <ThemedText className="font-n-bold text-lg" style={{ color: theme.textPrimary }}>
                                        Badges
                                    </ThemedText>
                                </StyledView>
                                <StyledTouchableOpacity
                                    onPress={() => setShowBadgesModal(true)}
                                    className="flex-row items-center px-0 py-1"
                                >
                                    <ThemedText className="font-n-semibold text-sm mr-1" style={{ color: theme.viewAllText }}>
                                        View all
                                    </ThemedText>
                                    <ChevronLeft size={14} color={theme.viewAllText} style={{ transform: [{ rotate: '180deg' }] }} />
                                </StyledTouchableOpacity>
                            </StyledView>

                            <StyledView className="flex-row justify-around">
                                {/* Elementle Badge */}
                                <StyledTouchableOpacity
                                    className="flex-1 items-center p-3 rounded-xl mx-1"
                                    style={{ backgroundColor: highestBadges.elementle ? theme.badgeWonBg : theme.accentVeryLight }}
                                    onPress={() => { setSelectedCategory('elementle'); setShowBadgesModal(true); }}
                                >
                                    <ThemedText className="font-n-bold text-xs mb-2" style={{ color: highestBadges.elementle ? '#FFFFFF' : theme.badgeText }}>
                                        Won In
                                    </ThemedText>
                                    <BadgeSlot
                                        category="elementle"
                                        badge={highestBadges.elementle}
                                        minimal={true}
                                        size="lg"
                                        placeholderImage={MathsHamsterTransparent}
                                    />
                                    <ThemedText className="font-n-medium text-xs text-center mt-2" style={{ color: highestBadges.elementle ? '#FFFFFF' : theme.badgeText }} numberOfLines={2}>
                                        {highestBadges.elementle?.badge?.name || "None"}
                                    </ThemedText>
                                </StyledTouchableOpacity>

                                {/* Streak Badge */}
                                <StyledTouchableOpacity
                                    className="flex-1 items-center p-3 rounded-xl mx-1"
                                    style={{ backgroundColor: highestBadges.streak ? theme.badgeWonBg : theme.accentVeryLight }}
                                    onPress={() => { setSelectedCategory('streak'); setShowBadgesModal(true); }}
                                >
                                    <ThemedText className="font-n-bold text-xs mb-2" style={{ color: highestBadges.streak ? '#FFFFFF' : theme.badgeText }}>
                                        Streak
                                    </ThemedText>
                                    <BadgeSlot
                                        category="streak"
                                        badge={highestBadges.streak}
                                        minimal={true}
                                        size="lg"
                                        placeholderImage={MathsHamsterTransparent}
                                    />
                                    <ThemedText className="font-n-medium text-xs text-center mt-2" style={{ color: highestBadges.streak ? '#FFFFFF' : theme.badgeText }} numberOfLines={2}>
                                        {highestBadges.streak?.badge?.name || "None"}
                                    </ThemedText>
                                </StyledTouchableOpacity>

                                {/* Percentile Badge */}
                                <StyledTouchableOpacity
                                    className="flex-1 items-center p-3 rounded-xl mx-1"
                                    style={{ backgroundColor: highestBadges.percentile ? theme.badgeWonBg : theme.accentVeryLight }}
                                    onPress={() => { setSelectedCategory('percentile'); setShowBadgesModal(true); }}
                                >
                                    <ThemedText className="font-n-bold text-xs mb-2" style={{ color: highestBadges.percentile ? '#FFFFFF' : theme.badgeText }}>
                                        Top %
                                    </ThemedText>
                                    <BadgeSlot
                                        category="percentile"
                                        badge={highestBadges.percentile}
                                        minimal={true}
                                        size="lg"
                                        placeholderImage={MathsHamsterTransparent}
                                    />
                                    <ThemedText className="font-n-medium text-xs text-center mt-2" style={{ color: highestBadges.percentile ? '#FFFFFF' : theme.badgeText }} numberOfLines={2}>
                                        {highestBadges.percentile?.badge?.name || "None"}
                                    </ThemedText>
                                </StyledTouchableOpacity>
                            </StyledView>
                        </StyledView>

                        <AllBadgesModal
                            visible={showBadgesModal}
                            onClose={() => setShowBadgesModal(false)}
                            gameType="REGION"
                            initialCategory={selectedCategory}
                        />

                        {/* Last 30 Days Chart */}
                        {recentActivity.length > 0 && (
                            <StyledView
                                className="rounded-2xl p-5 mb-4"
                                style={{
                                    backgroundColor: theme.cardBg,
                                    shadowColor: '#000',
                                    shadowOffset: { width: 0, height: 2 },
                                    shadowOpacity: 0.06,
                                    shadowRadius: 8,
                                    elevation: 3,
                                }}
                            >
                                <StyledView className="flex-row items-center gap-2 mb-5">
                                    <TrendingUp size={22} color={theme.iconAccent} />
                                    <ThemedText className="font-n-bold text-lg" style={{ color: theme.textPrimary }}>
                                        Last 30 Days
                                    </ThemedText>
                                </StyledView>

                                <StyledView className="flex-row gap-3 items-start">
                                    {/* Y-Axis */}
                                    <StyledView className="h-32 justify-between items-end pb-0 pt-0.5">
                                        {['X', '5', '4', '3', '2', '1', '0'].map(label => (
                                            <ThemedText key={label} className="text-xs font-n-semibold leading-none" style={{ color: theme.textMuted }}>
                                                {label}
                                            </ThemedText>
                                        ))}
                                    </StyledView>

                                    {/* Chart Bars */}
                                    <StyledView className="flex-1 h-32 relative">
                                        <StyledView className="flex-row h-32 items-end gap-[2px]">
                                            {recentActivity.map((day, idx) => {
                                                const isLost = !day.won || day.guesses >= 6;
                                                return (
                                                    <StyledView
                                                        key={idx}
                                                        className="flex-1 rounded-t-sm"
                                                        style={{
                                                            height: `${Math.min((day.guesses / 6) * 100, 100)}%`,
                                                            backgroundColor: isLost ? theme.lostBar : theme.chartBar,
                                                        }}
                                                    />
                                                );
                                            })}
                                        </StyledView>
                                    </StyledView>
                                </StyledView>

                                <ThemedText className="font-n-medium text-xs text-center mt-4" style={{ color: theme.textMuted }}>
                                    Bar height = number of guesses
                                </ThemedText>
                            </StyledView>
                        )}

                        {/* Guess Distribution Chart */}
                        <StyledView
                            className="rounded-2xl p-5 mb-4"
                            style={{
                                backgroundColor: theme.cardBg,
                                shadowColor: '#000',
                                shadowOffset: { width: 0, height: 2 },
                                shadowOpacity: 0.06,
                                shadowRadius: 8,
                                elevation: 3,
                            }}
                        >
                            <StyledView className="flex-row items-center gap-2 mb-5">
                                <BarChart3 size={22} color={theme.iconAccent} />
                                <ThemedText className="font-n-bold text-lg" style={{ color: theme.textPrimary }}>
                                    Guess Distribution
                                </ThemedText>
                            </StyledView>

                            <StyledView className="gap-1">
                                {['1', '2', '3', '4', '5'].map((guessNum) => {
                                    const count = stats.guessDistribution[guessNum] || 0;
                                    const percentage = maxGuesses > 0 ? (count / maxGuesses) * 100 : 0;

                                    return (
                                        <StyledView key={guessNum} className="flex-row items-center gap-3">
                                            <ThemedText className="w-5 text-center text-sm font-n-bold" style={{ color: theme.textSecondary }}>
                                                {guessNum}
                                            </ThemedText>
                                            <StyledView
                                                className="flex-1 h-9 rounded-lg overflow-hidden flex-row items-center"
                                                style={{ backgroundColor: theme.chartTrack }}
                                            >
                                                {count > 0 ? (
                                                    <StyledView
                                                        className="h-full rounded-lg justify-center items-end pr-3"
                                                        style={{
                                                            width: `${Math.max(percentage, 12)}%`,
                                                            backgroundColor: theme.chartBar
                                                        }}
                                                    >
                                                        <ThemedText className="text-xs font-n-bold text-white">{count}</ThemedText>
                                                    </StyledView>
                                                ) : (
                                                    <StyledView className="px-3 justify-center h-full">
                                                        <ThemedText className="text-xs font-n-medium" style={{ color: theme.textMuted }}>0</ThemedText>
                                                    </StyledView>
                                                )}
                                            </StyledView>
                                        </StyledView>
                                    );
                                })}

                                {/* Lost Row */}
                                <StyledView className="flex-row items-center gap-3 mt-1">
                                    <ThemedText className="w-5 text-center text-sm font-n-bold" style={{ color: theme.lostBar }}>
                                        X
                                    </ThemedText>
                                    <StyledView
                                        className="flex-1 h-9 rounded-lg overflow-hidden flex-row items-center"
                                        style={{ backgroundColor: theme.lostTrack }}
                                    >
                                        {losses > 0 ? (
                                            <StyledView
                                                className="h-full rounded-lg justify-center items-end pr-3"
                                                style={{
                                                    width: `${Math.max((losses / maxGuesses) * 100, 12)}%`,
                                                    backgroundColor: theme.lostBar
                                                }}
                                            >
                                                <ThemedText className="text-xs font-n-bold text-white">{losses}</ThemedText>
                                            </StyledView>
                                        ) : (
                                            <StyledView className="px-3 justify-center h-full">
                                                <ThemedText className="text-xs font-n-medium" style={{ color: theme.textMuted }}>0</ThemedText>
                                            </StyledView>
                                        )}
                                    </StyledView>
                                </StyledView>
                            </StyledView>
                        </StyledView>
                    </StyledView>
                </StyledScrollView>
            )}

            {/* Percentile Info Modal */}
            <Modal
                transparent
                visible={showPercentileInfo}
                animationType="fade"
                onRequestClose={() => setShowPercentileInfo(false)}
            >
                <StyledView className="flex-1 bg-black/50 justify-center items-center p-5">
                    <StyledView
                        className="w-full max-w-sm rounded-2xl overflow-hidden"
                        style={{ backgroundColor: theme.cardBg }}
                    >
                        <StyledView
                            className="p-4"
                            style={{ backgroundColor: theme.accent }}
                        >
                            <StyledView className="flex-row justify-between items-center">
                                <ThemedText className="font-n-bold text-lg text-white">Percentile Ranking</ThemedText>
                                <TouchableOpacity
                                    onPress={() => setShowPercentileInfo(false)}
                                    className="p-1 rounded-full"
                                    style={{ backgroundColor: 'rgba(255,255,255,0.2)' }}
                                >
                                    <X size={20} color="#FFFFFF" />
                                </TouchableOpacity>
                            </StyledView>
                        </StyledView>
                        <StyledView className="p-5">
                            <ThemedText className="font-n-medium text-sm mb-4" style={{ color: theme.textSecondary, lineHeight: 20 }}>
                                You must have played at least 5 days this month for a percentile to be calculated.
                            </ThemedText>
                            <ThemedText className="font-n-medium text-sm" style={{ color: theme.textSecondary, lineHeight: 20 }}>
                                Rankings are updated daily based on your performance compared to other players in your region.
                            </ThemedText>
                        </StyledView>
                    </StyledView>
                </StyledView>
            </Modal>

            <GuestRestrictionModal
                visible={guestModalVisible}
                onClose={() => {
                    setGuestModalVisible(false);
                    router.back();
                }}
                feature="Stats"
                description="Sign up to view your detailed statistics and achievements!"
            />
        </ThemedView>
    );
}
