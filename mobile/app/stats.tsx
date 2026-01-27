import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator, Modal, Image } from 'react-native';
import { AllBadgesModal } from '../components/stats/AllBadgesModal';
import { BadgeSlot } from '../components/stats/BadgeSlot';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { styled } from 'nativewind';
import { ChevronLeft, BarChart3, TrendingUp, Award, Info, X } from 'lucide-react-native';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import { useOptions } from '../lib/options';
import { format, subDays } from 'date-fns';
import { SafeAreaView } from 'react-native-safe-area-context';
import { GuestRestrictionModal } from '../components/GuestRestrictionModal';
import { hasFeatureAccess } from '../lib/featureGates';
import { AdBanner } from '../components/AdBanner';
import { AdBannerContext } from '../contexts/AdBannerContext';

import { ThemedView } from '../components/ThemedView';
import { ThemedText } from '../components/ThemedText';
import { useThemeColor } from '../hooks/useThemeColor';

const StyledView = styled(View);
const StyledText = styled(Text);
const StyledTouchableOpacity = styled(TouchableOpacity);
const StyledScrollView = styled(ScrollView);
const StyledImage = styled(Image);

const MathsHamsterGreen = require('../assets/ui/webp_assets/Maths-Hamster.webp');

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

    // Theme Colors based on Mode
    const theme = mode === 'REGION' ? {
        cardBg: '#A4DB57',
        inlayBg: '#93c54e',
        lostBar: '#7099d0',
        lostTrack: '#a4c3ee',
        hamsterTitle: `${userRegion} Edition`,
        accentText: '#93c54e' // Added for correct text coloring in distribution
    } : {
        cardBg: '#93cd78',
        inlayBg: '#84b86c',
        lostBar: '#5babb6',
        lostTrack: '#bde3e7',
        hamsterTitle: 'Personal Edition',
        accentText: '#84b86c'
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

            if (statsError && statsError.code !== 'PGRST116') { // PGRST116 is "no rows found"
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

                // Group by category and find max threshold
                const categories = ['elementle', 'streak', 'percentile'];
                categories.forEach(cat => {
                    // Fix: Ensure loose matching for category names (e.g. "Streak" vs "streak")
                    const catBadges = userBadgesData.filter((ub: any) =>
                        ub.badge?.category?.toLowerCase().includes(cat)
                    );

                    if (catBadges.length > 0) {
                        // Sort by threshold.
                        // For Percentile: Lower is better (Top 1% > Top 50%).
                        // For Streak/Elementle: Higher/Specific logic.
                        // Actually, badges usually have "levels". Let's assume the highest threshold # is the best badge for now,
                        // EXCEPT percentile where we might want the "lowest number" (Top 1).
                        // However, looking at BadgesRow.tsx in web, it doesn't seem to have special sort logic other than what I saw.
                        // Let's rely on threshold descending for now as a heuristic.
                        catBadges.sort((a: any, b: any) => (b.badge?.threshold || 0) - (a.badge?.threshold || 0));
                        highest[cat] = catBadges[0];
                    }
                });
                setHighestBadges(highest);
            }

            // 3. Fetch Recent Activity (Last 30 Days)
            // We need to join with questions_allocated_region to get the date
            // However, Supabase joins are strict. 
            // Alternative: Fetch last 30 attempts and match.
            // Or simpler: game_attempts_region has 'started_at'. We can use that as a proxy for date if needed, 
            // but ideally we want the puzzle date. 
            // Let's assume started_at is close enough for the "Last 30 Days" chart visual.
            const thirtyDaysAgo = subDays(new Date(), 30);

            const { data: attempts, error: attemptsError } = await supabase
                .from('game_attempts_region')
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
    }, [user, mode]); // Added mode to dependencies

    // Refetch stats when screen comes into focus (e.g., after completing a game)
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
                    <ActivityIndicator size="large" color="#7DAAE8" />
                    <StyledText style={{ fontSize: 18 * textScale }} className="mt-4 text-slate-900 dark:text-white">Loading user data...</StyledText>
                </SafeAreaView>
            </AdBannerContext.Provider>
        );
    }

    const winPercentage = stats.played > 0 ? Math.round((stats.won / stats.played) * 100) : 0;

    // Calculate Average Guesses
    // Formula: (sum of guesses from wins + 6 * losses) / total games played
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


    return (
        <ThemedView className="flex-1">
            <SafeAreaView edges={['top']} className="px-4 pb-2" style={{ backgroundColor: useThemeColor({}, 'background') }}>
                <StyledView className="flex-row items-center justify-between py-2">
                    <StyledTouchableOpacity onPress={() => router.back()} className="p-2 -ml-2">
                        <ChevronLeft size={28} color={iconColor} />
                    </StyledTouchableOpacity>
                    <ThemedText baseSize={36} className="font-n-bold font-heading">
                        Statistics
                    </ThemedText>
                    <StyledView className="w-10" />
                </StyledView>
            </SafeAreaView>

            {loading ? (
                <StyledView className="flex-1 justify-center items-center">
                    <ActivityIndicator size="large" color="#7DAAE8" />
                </StyledView>
            ) : (
                <StyledScrollView showsVerticalScrollIndicator={false} className="flex-1 px-4" contentContainerStyle={{ paddingBottom: 40 }}>

                    {/* Top Grid - Completely decoupled Left/Right columns sharing a center line */}
                    <StyledView className="flex-row items-stretch mb-6 mt-4">

                        {/* LEFT COLUMN: UK/Personal Edition - The "Master" for height */}
                        <StyledView className="flex-1 mr-2 rounded-3xl p-4 pb-6 shadow-sm relative overflow-hidden justify-between" style={{ backgroundColor: theme.cardBg }}>
                            <StyledView className="w-full">
                                <ThemedText baseSize={18} className="font-n-bold mb-2 text-slate-900">{theme.hamsterTitle}</ThemedText>

                                {/* Hamster Image - Moved Up with extra spacing */}
                                <StyledView className="items-center mt-3 mb-5">
                                    <StyledImage
                                        source={MathsHamsterGreen}
                                        className="w-24 h-24 z-20"
                                        resizeMode="contain"
                                    />
                                </StyledView>

                                <StyledView className="space-y-3 relative z-10 w-full">
                                    {/* Played Inlay */}
                                    <StyledView className="flex-row items-center justify-between p-2 rounded-xl w-full" style={{ backgroundColor: theme.inlayBg }}>
                                        <ThemedText className="text-white font-n-medium text-sm ml-1">Played</ThemedText>
                                        <ThemedText className="text-white font-n-bold text-xl mr-1">{stats.played}</ThemedText>
                                    </StyledView>

                                    {/* Win % Inlay */}
                                    <StyledView className="flex-row items-center justify-between p-2 rounded-xl w-full" style={{ backgroundColor: theme.inlayBg }}>
                                        <ThemedText className="text-white font-n-medium text-sm ml-1">Win %</ThemedText>
                                        <ThemedText className="text-white font-n-bold text-xl mr-1">{winPercentage}%</ThemedText>
                                    </StyledView>

                                    {/* Avg Inlay */}
                                    <StyledView className="flex-row items-center justify-between p-2 rounded-xl w-full" style={{ backgroundColor: theme.inlayBg }}>
                                        <ThemedText className="text-white font-n-medium text-sm ml-1">Avg</ThemedText>
                                        <ThemedText className="text-white font-n-bold text-xl mr-1">{averageGuesses}</ThemedText>
                                    </StyledView>
                                </StyledView>
                            </StyledView>
                            {/* Empty view for bottom spacing balance if needed, but justify-between handles it */}
                            <StyledView />
                        </StyledView>

                        {/* RIGHT COLUMN: Streak & Percentile - Stretches to match Left, spaced apart */}
                        <StyledView className="flex-1 ml-2 justify-between">

                            {/* Streak Box - Anchored Top */}
                            <StyledView className="w-full rounded-3xl p-4 shadow-sm relative overflow-hidden" style={{ backgroundColor: theme.cardBg }}>
                                <ThemedText baseSize={18} className="font-n-bold text-slate-900 mb-4">Streak</ThemedText>
                                <StyledView className="gap-2 w-full">
                                    <StyledView className="items-center justify-center p-2 rounded-xl w-full" style={{ backgroundColor: theme.inlayBg }}>
                                        <ThemedText className="text-white font-n-medium text-xs mb-1">Current</ThemedText>
                                        <ThemedText className="text-white font-n-bold text-xl leading-none">{stats.currentStreak}</ThemedText>
                                    </StyledView>
                                    <StyledView className="items-center justify-center p-2 rounded-xl w-full" style={{ backgroundColor: theme.inlayBg }}>
                                        <ThemedText className="text-white font-n-medium text-xs mb-1">Best</ThemedText>
                                        <ThemedText className="text-white font-n-bold text-xl leading-none">{stats.maxStreak}</ThemedText>
                                    </StyledView>
                                </StyledView>
                            </StyledView>

                            {/* Percentile Box - Anchored Bottom (via justify-between on parent) */}
                            <StyledView className="w-full rounded-3xl p-4 shadow-sm" style={{ backgroundColor: theme.cardBg }}>
                                <StyledView className="flex-row justify-between items-center mb-1">
                                    <ThemedText className="font-n-bold text-lg text-slate-900">Percentile</ThemedText>
                                    <TouchableOpacity onPress={() => setShowPercentileInfo(true)} hitSlop={10}>
                                        <Info size={21} color="#1e293b" opacity={0.6} />
                                    </TouchableOpacity>
                                </StyledView>

                                <StyledView className="items-center justify-center p-2 rounded-xl w-[90%] self-center mt-1" style={{ backgroundColor: theme.inlayBg }}>
                                    <ThemedText className="text-white font-n-medium text-xs mb-1">Month to Date</ThemedText>
                                    <ThemedText className="text-white font-n-bold text-lg leading-none text-center">
                                        {getPercentileText(stats.cumulativeMonthlyPercentile)}
                                    </ThemedText>
                                </StyledView>
                            </StyledView>
                        </StyledView>
                    </StyledView>



                    {/* Badges Section */}
                    <StyledView className="mb-6 rounded-3xl p-4 shadow-sm" style={{ backgroundColor: theme.cardBg }}>
                        <StyledView className="flex-row justify-between items-center mb-4">
                            <StyledView className="flex-row items-center gap-2">
                                <Award size={20} color="#1e293b" />
                                <ThemedText baseSize={18} className="font-n-bold text-slate-900">Badges</ThemedText>
                            </StyledView>
                            <StyledTouchableOpacity onPress={() => setShowBadgesModal(true)} className="mr-2">
                                <ThemedText baseSize={16} className="text-blue-600 font-n-bold">See All</ThemedText>
                            </StyledTouchableOpacity>
                        </StyledView>

                        <StyledView className="flex-row justify-around py-2 gap-2">
                            {/* Elementle Badge */}
                            <StyledTouchableOpacity className="flex-1" onPress={() => { setSelectedCategory('elementle'); setShowBadgesModal(true); }}>
                                <StyledView className="rounded-xl p-3 items-center w-full" style={{ backgroundColor: theme.inlayBg }}>
                                    <ThemedText className="text-white font-n-medium text-xs mb-1">Won in</ThemedText>
                                    <BadgeSlot
                                        category="elementle"
                                        badge={highestBadges.elementle}
                                        minimal={true}
                                        size="md"
                                    />
                                    <ThemedText className="text-white font-n-bold text-[10px] text-center mt-1" numberOfLines={1}>
                                        {highestBadges.elementle?.badge?.name || "None"}
                                    </ThemedText>
                                </StyledView>
                            </StyledTouchableOpacity>

                            {/* Streak Badge */}
                            <StyledTouchableOpacity className="flex-1" onPress={() => { setSelectedCategory('streak'); setShowBadgesModal(true); }}>
                                <StyledView className="rounded-xl p-3 items-center w-full" style={{ backgroundColor: theme.inlayBg }}>
                                    <ThemedText className="text-white font-n-medium text-xs mb-1">Streak</ThemedText>
                                    <BadgeSlot
                                        category="streak"
                                        badge={highestBadges.streak}
                                        minimal={true}
                                        size="md"
                                    />
                                    <ThemedText className="text-white font-n-bold text-[10px] text-center mt-1" numberOfLines={1}>
                                        {highestBadges.streak?.badge?.name || "None"}
                                    </ThemedText>
                                </StyledView>
                            </StyledTouchableOpacity>

                            {/* Percentile Badge */}
                            <StyledTouchableOpacity className="flex-1" onPress={() => { setSelectedCategory('percentile'); setShowBadgesModal(true); }}>
                                <StyledView className="rounded-xl p-3 items-center w-full" style={{ backgroundColor: theme.inlayBg }}>
                                    <ThemedText className="text-white font-n-medium text-xs mb-1">Top %</ThemedText>
                                    <BadgeSlot
                                        category="percentile"
                                        badge={highestBadges.percentile}
                                        minimal={true}
                                        size="md"
                                    />
                                    <ThemedText className="text-white font-n-bold text-[10px] text-center mt-1" numberOfLines={1}>
                                        {highestBadges.percentile?.badge?.name || "None"}
                                    </ThemedText>
                                </StyledView>
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
                        <StyledView className="mb-6 rounded-3xl p-4 shadow-sm" style={{ backgroundColor: theme.cardBg }}>
                            <StyledView className="flex-row items-center gap-2 mb-4">
                                <TrendingUp size={20} color="#1e293b" />
                                <ThemedText baseSize={18} className="font-n-bold text-slate-900">Last 30 Days</ThemedText>
                            </StyledView>

                            <StyledView className="flex-row gap-2">
                                {/* Axis */}
                                <StyledView className="py-4 justify-between h-auto">
                                    <StyledView className="h-32 justify-between items-end -my-1">
                                        {['X', '5', '4', '3', '2', '1', '0'].map(label => (
                                            <ThemedText key={label} className="text-xs font-n-medium text-white leading-none">{label}</ThemedText>
                                        ))}
                                    </StyledView>
                                </StyledView>

                                {/* Chart */}
                                <StyledView className="flex-1 rounded-xl p-4" style={{ backgroundColor: theme.inlayBg }}>
                                    <StyledView className="flex-row h-32 items-end gap-0.5">
                                        {recentActivity.map((day, idx) => {
                                            const isLost = !day.won || day.guesses >= 6;
                                            return (
                                                <StyledView
                                                    key={idx}
                                                    className="flex-1 rounded-sm"
                                                    style={{
                                                        height: `${Math.min((day.guesses / 6) * 100, 100)}%`,
                                                        backgroundColor: isLost ? theme.lostBar : '#ffffff',
                                                        opacity: 1
                                                    }}
                                                />
                                            );
                                        })}
                                    </StyledView>
                                </StyledView>
                            </StyledView>
                            <ThemedText baseSize={12} className="font-n-medium text-center opacity-80 mt-2 text-white">
                                Bar height = guesses
                            </ThemedText>
                        </StyledView>
                    )}


                    {/* Guess Distribution Chart */}
                    <StyledView className="rounded-3xl p-4 shadow-sm mb-6" style={{ backgroundColor: theme.cardBg }}>
                        <StyledView className="flex-row items-center gap-2 mb-4">
                            <BarChart3 size={20} color="#1e293b" />
                            <ThemedText className="font-n-bold text-lg text-slate-900">Guess Distribution</ThemedText>
                        </StyledView>

                        <StyledView className="rounded-xl p-4" style={{ backgroundColor: theme.inlayBg }}>
                            <StyledView className="space-y-1.5">
                                {['1', '2', '3', '4', '5'].map((guessNum) => {
                                    const count = stats.guessDistribution[guessNum] || 0;
                                    const percentage = maxGuesses > 0 ? (count / maxGuesses) * 100 : 0;

                                    return (
                                        <StyledView key={guessNum} className="flex-row items-center gap-3">
                                            <ThemedText className="w-4 text-sm font-n-medium opacity-100 text-white">{guessNum}</ThemedText>
                                            {/* Track (Grey Bar) */}
                                            <StyledView className="flex-1 h-8 rounded-sm overflow-hidden flex-row bg-slate-200/30 items-center">
                                                {count > 0 ? (
                                                    <StyledView
                                                        className="h-full justify-center items-end pr-2 bg-white"
                                                        style={{ width: `${Math.max(percentage, 10)}%` }}
                                                    >
                                                        <ThemedText className="text-xs font-n-bold shadow-sm" style={{ color: theme.inlayBg }}>{count}</ThemedText>
                                                    </StyledView>
                                                ) : (
                                                    <ThemedText className="text-xs font-n-bold text-white/50 ml-2">0</ThemedText>
                                                )}
                                            </StyledView>
                                        </StyledView>
                                    );
                                })}

                                {/* Lost Row */}
                                <StyledView className="flex-row items-center gap-3">
                                    <ThemedText className="w-4 text-sm font-n-medium opacity-100 text-white relative bottom-0">X</ThemedText>
                                    <StyledView className="flex-1 h-8 rounded-sm overflow-hidden flex-row items-center" style={{ backgroundColor: theme.lostTrack }}>
                                        {losses > 0 ? (
                                            <StyledView
                                                className="h-full justify-center items-end pr-2"
                                                style={{ width: `${Math.max((losses / maxGuesses) * 100, 10)}%`, backgroundColor: theme.lostBar }}
                                            >
                                                <ThemedText className="text-xs font-n-bold text-white shadow-sm">{losses}</ThemedText>
                                            </StyledView>
                                        ) : (
                                            <ThemedText className="text-xs font-n-bold text-white/50 ml-2">0</ThemedText>
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
                <StyledView className="flex-1 bg-black/50 justify-center items-center p-4">
                    <ThemedView variant="surface" className="p-6 rounded-2xl w-full max-w-sm">
                        <StyledView className="flex-row justify-between items-center mb-4">
                            <ThemedText baseSize={18} className="font-n-bold">Percentile Ranking</ThemedText>
                            <TouchableOpacity onPress={() => setShowPercentileInfo(false)}>
                                <X size={24} color="#64748b" />
                            </TouchableOpacity>
                        </StyledView>
                        <ThemedText baseSize={14} className="opacity-80 mb-4 font-n-medium">
                            You must have played at least 5 days this month for a percentile to be calculated.
                        </ThemedText>
                        <ThemedText baseSize={14} className="opacity-80 font-n-medium">
                            Rankings are updated daily based on your performance compared to other players in your region.
                        </ThemedText>
                    </ThemedView>
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
