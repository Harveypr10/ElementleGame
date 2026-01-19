import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator, Modal } from 'react-native';
import { AllBadgesModal } from '../components/stats/AllBadgesModal';
import { BadgeSlot } from '../components/stats/BadgeSlot';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { styled } from 'nativewind';
import { ChevronLeft, BarChart3, TrendingUp, Award, Info, X } from 'lucide-react-native';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import { format, subDays } from 'date-fns';
import { SafeAreaView } from 'react-native-safe-area-context';

const StyledView = styled(View);
const StyledText = styled(Text);
const StyledTouchableOpacity = styled(TouchableOpacity);
const StyledScrollView = styled(ScrollView);

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
    const { user } = useAuth();
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
    const [highestBadges, setHighestBadges] = useState<Record<string, any>>({ elementle: null, streak: null, percentile: null });
    const [selectedCategory, setSelectedCategory] = useState<'elementle' | 'streak' | 'percentile'>('elementle');

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

            const userRegion = profile?.region || 'UK';

            // Determine which stats table to query based on mode
            const STATS_TABLE = mode === 'REGION' ? 'user_stats_region' : 'user_stats_user';

            // 1. Fetch Aggregated Stats
            let statsQuery = supabase
                .from(STATS_TABLE)
                .select('*')
                .eq('user_id', user.id);

            // Add region filter only for REGION mode
            if (mode === 'REGION') {
                statsQuery = statsQuery.eq('region', userRegion);
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
            <SafeAreaView className="flex-1 bg-white dark:bg-slate-900 px-4 justify-center items-center">
                <ActivityIndicator size="large" color="#7DAAE8" />
                <StyledText className="mt-4 text-lg text-slate-900 dark:text-white">Loading user data...</StyledText>
            </SafeAreaView>
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
        <SafeAreaView className="flex-1 bg-white dark:bg-slate-900 px-4">
            <StyledView className="flex-row items-center justify-between py-4">
                <StyledTouchableOpacity onPress={() => router.back()} className="p-2 -ml-2">
                    <ChevronLeft size={28} color="#1e293b" />
                </StyledTouchableOpacity>
                <StyledText className="text-4xl font-n-bold text-slate-900 dark:text-white font-heading">
                    Statistics
                </StyledText>
                <StyledView className="w-10" />
            </StyledView>

            {loading ? (
                <StyledView className="flex-1 justify-center items-center">
                    <ActivityIndicator size="large" color="#7DAAE8" />
                </StyledView>
            ) : (
                <StyledScrollView showsVerticalScrollIndicator={false} className="flex-1" contentContainerStyle={{ paddingBottom: 40 }}>

                    {/* Top Grid */}
                    <StyledView className="flex-row gap-3 mb-6">
                        {/* Left Column: Stats */}
                        <StyledView className="flex-1 bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm space-y-4">
                            <StyledText className="font-n-bold text-sm text-slate-900 dark:text-white mb-2">UK Edition</StyledText>

                            <StyledView className="flex-row justify-between items-center">
                                <StyledText className="text-sm font-n-medium text-slate-500 dark:text-slate-400">Played</StyledText>
                                <StyledText className="text-xl font-n-bold text-slate-900 dark:text-white">{stats.played}</StyledText>
                            </StyledView>

                            <StyledView className="flex-row justify-between items-center">
                                <StyledText className="text-sm font-n-medium text-slate-500 dark:text-slate-400">Win %</StyledText>
                                <StyledText className="text-xl font-n-bold text-slate-900 dark:text-white">{winPercentage}%</StyledText>
                            </StyledView>

                            <StyledView className="flex-row justify-between items-center">
                                <StyledText className="text-sm font-n-medium text-slate-500 dark:text-slate-400">Avg Guesses</StyledText>
                                <StyledText className="text-xl font-n-bold text-slate-900 dark:text-white">{averageGuesses}</StyledText>
                            </StyledView>
                        </StyledView>

                        {/* Right Column: Streak & Percentile */}
                        <StyledView className="flex-1 gap-3">
                            {/* Streak Box */}
                            <StyledView className="flex-1 bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm justify-between">
                                <StyledText className="font-n-bold text-sm text-slate-900 dark:text-white">Streak</StyledText>
                                <StyledView>
                                    <StyledView className="flex-row justify-between items-center mb-1">
                                        <StyledText className="text-xs font-n-medium text-slate-500">Current</StyledText>
                                        <StyledText className="text-lg font-n-bold text-slate-900 dark:text-white">{stats.currentStreak}</StyledText>
                                    </StyledView>
                                    <StyledView className="flex-row justify-between items-center">
                                        <StyledText className="text-xs font-n-medium text-slate-500">Best</StyledText>
                                        <StyledText className="text-lg font-n-bold text-slate-900 dark:text-white">{stats.maxStreak}</StyledText>
                                    </StyledView>
                                </StyledView>
                            </StyledView>

                            {/* Percentile Box */}
                            <StyledView className="flex-1 bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm justify-between">
                                <StyledView className="flex-row justify-between items-center">
                                    <StyledText className="font-n-bold text-sm text-slate-900 dark:text-white">Percentile</StyledText>
                                    <TouchableOpacity onPress={() => setShowPercentileInfo(true)}>
                                        <Info size={14} color="#94a3b8" />
                                    </TouchableOpacity>
                                </StyledView>
                                <StyledView className="flex-row justify-between items-center mt-2">
                                    <StyledText className="text-xs font-n-medium text-slate-500">Month to Date</StyledText>
                                    <StyledText className="text-lg font-n-bold text-slate-900 dark:text-white">
                                        {getPercentileText(stats.cumulativeMonthlyPercentile)}
                                    </StyledText>
                                </StyledView>
                            </StyledView>
                        </StyledView>
                    </StyledView>



                    {/* Badges Section */}
                    <StyledView className="mb-6 bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm">
                        <StyledView className="flex-row justify-between items-center mb-4">
                            <StyledView className="flex-row items-center gap-2">
                                <Award size={20} color="#7DAAE8" />
                                <StyledText className="font-n-bold text-sm text-slate-900 dark:text-white">Badges</StyledText>
                            </StyledView>
                            <StyledTouchableOpacity onPress={() => setShowBadgesModal(true)}>
                                <StyledText className="text-xs text-blue-500 font-n-bold">See All</StyledText>
                            </StyledTouchableOpacity>
                        </StyledView>

                        <StyledView className="flex-row justify-around py-2">
                            <StyledTouchableOpacity onPress={() => { setSelectedCategory('elementle'); setShowBadgesModal(true); }}>
                                <BadgeSlot
                                    category="elementle"
                                    badge={highestBadges.elementle}
                                />
                            </StyledTouchableOpacity>
                            <StyledTouchableOpacity onPress={() => { setSelectedCategory('streak'); setShowBadgesModal(true); }}>
                                <BadgeSlot
                                    category="streak"
                                    badge={highestBadges.streak}
                                />
                            </StyledTouchableOpacity>
                            <StyledTouchableOpacity onPress={() => { setSelectedCategory('percentile'); setShowBadgesModal(true); }}>
                                <BadgeSlot
                                    category="percentile"
                                    badge={highestBadges.percentile}
                                />
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
                        <StyledView className="mb-6 bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm">
                            <StyledView className="flex-row items-center gap-2 mb-4">
                                <TrendingUp size={20} color="#7DAAE8" />
                                <StyledText className="font-n-bold text-sm text-slate-900 dark:text-white">Last 30 Days</StyledText>
                            </StyledView>

                            <StyledView className="flex-row h-24 items-end gap-1">
                                {recentActivity.map((day, idx) => (
                                    <StyledView
                                        key={idx}
                                        className={`flex-1 rounded-sm ${day.won ? 'bg-[#A4DB57]' : 'bg-[#8e57db]'}`}
                                        style={{ height: `${(day.guesses / 6) * 100}%` }}
                                    />
                                ))}
                            </StyledView>
                            <StyledText className="text-xs font-n-medium text-center text-slate-400 mt-2">
                                Bar height = guesses
                            </StyledText>
                        </StyledView>
                    )}


                    {/* Guess Distribution Chart */}
                    <StyledView className="bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm mb-6">
                        <StyledView className="flex-row items-center gap-2 mb-4">
                            <BarChart3 size={20} color="#7DAAE8" />
                            <StyledText className="font-n-bold text-sm text-slate-900 dark:text-white">Guess Distribution</StyledText>
                        </StyledView>

                        <StyledView className="space-y-3">
                            {['1', '2', '3', '4', '5'].map((guessNum) => {
                                const count = stats.guessDistribution[guessNum] || 0;
                                const percentage = maxGuesses > 0 ? (count / maxGuesses) * 100 : 0;
                                const barColor = mode === 'USER' ? '#7DAAE8' : '#A4DB57'; // Blue for USER, Green for REGION

                                return (
                                    <StyledView key={guessNum} className="flex-row items-center gap-3">
                                        <StyledText className="w-4 text-sm font-n-medium text-slate-700 dark:text-slate-300">{guessNum}</StyledText>
                                        <StyledView className="flex-1 h-8 rounded-sm overflow-hidden flex-row" style={{ backgroundColor: `${barColor}20` }}>
                                            {count > 0 && (
                                                <StyledView
                                                    className="h-full justify-center items-end pr-2"
                                                    style={{ width: `${Math.max(percentage, 10)}%`, backgroundColor: barColor }}
                                                >
                                                    <StyledText className="text-xs font-n-bold text-white shadow-sm">{count}</StyledText>
                                                </StyledView>
                                            )}
                                        </StyledView>
                                    </StyledView>
                                );
                            })}

                            {/* Lost Row */}
                            <StyledView className="flex-row items-center gap-3">
                                <StyledText className="w-4 text-sm font-n-medium text-slate-700 dark:text-slate-300 relative bottom-0">X</StyledText>
                                <StyledView className="flex-1 h-8 bg-[#FFD429]/20 rounded-sm overflow-hidden flex-row">
                                    {losses > 0 && (
                                        <StyledView
                                            className="h-full bg-[#FFD429] justify-center items-end pr-2"
                                            style={{ width: `${Math.max((losses / maxGuesses) * 100, 10)}%` }}
                                        >
                                            <StyledText className="text-xs font-n-bold text-white shadow-sm">{losses}</StyledText>
                                        </StyledView>
                                    )}
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
                    <StyledView className="bg-white dark:bg-slate-800 p-6 rounded-2xl w-full max-w-sm">
                        <StyledView className="flex-row justify-between items-center mb-4">
                            <StyledText className="text-lg font-n-bold text-slate-900 dark:text-white">Percentile Ranking</StyledText>
                            <TouchableOpacity onPress={() => setShowPercentileInfo(false)}>
                                <X size={24} color="#64748b" />
                            </TouchableOpacity>
                        </StyledView>
                        <StyledText className="text-slate-600 dark:text-slate-300 mb-4 font-n-medium">
                            You must have played at least 5 days this month for a percentile to be calculated.
                        </StyledText>
                        <StyledText className="text-slate-600 dark:text-slate-300 font-n-medium">
                            Rankings are updated daily based on your performance compared to other players in your region.
                        </StyledText>
                    </StyledView>
                </StyledView>
            </Modal>

        </SafeAreaView>
    );
}
