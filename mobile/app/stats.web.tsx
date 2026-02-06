/**
 * stats.web.tsx
 * Web implementation for Stats Screen
 * 
 * Hybrid Design:
 * - Layout Density: Legacy Web (spacious centered content)
 * - Component Styling: Mobile App (premium cards, Nunito fonts, green accents)
 * - Charts: Recharts (web-compatible charting library)
 */

import React, { useState, useEffect } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import {
    ChevronLeft,
    Target,
    Trophy,
    BarChart3,
    Flame,
    TrendingUp,
    Award,
    Info,
    X,
} from 'lucide-react-native';
import {
    useStatsScreenLogic,
    getStatsTheme,
    GameStats,
    DailyAttempt,
} from '../hooks/useStatsScreenLogic';
import { useThemeColor } from '../hooks/useThemeColor';

export default function StatsScreenWeb() {
    const {
        user,
        mode,
        userRegion,
        loading,
        stats,
        recentActivity,
        highestBadges,
        showPercentileInfo,
        setShowPercentileInfo,
        winPercentage,
        averageGuesses,
        maxGuesses,
        losses,
        percentileText,
        goBack,
    } = useStatsScreenLogic();

    const systemBackgroundColor = useThemeColor({}, 'background');
    const systemSurfaceColor = useThemeColor({}, 'surface');
    const isDark = false; // Web uses light mode for now

    const theme = getStatsTheme(mode, isDark, systemBackgroundColor, systemSurfaceColor);

    // Hover states
    const [backHover, setBackHover] = useState(false);
    const [infoHover, setInfoHover] = useState(false);

    if (!user) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={theme.accent} />
                <Text style={styles.loadingText}>Loading user data...</Text>
            </View>
        );
    }

    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={theme.accent} />
                <Text style={styles.loadingText}>Loading stats...</Text>
            </View>
        );
    }

    return (
        <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
            <View style={styles.contentWrapper}>
                {/* Header */}
                <View style={styles.header}>
                    <Pressable
                        onPress={goBack}
                        onHoverIn={() => setBackHover(true)}
                        onHoverOut={() => setBackHover(false)}
                        style={[styles.backButton, backHover && styles.backButtonHover]}
                    >
                        <ChevronLeft size={24} color="#334155" />
                        <Text style={styles.backButtonText}>Back</Text>
                    </Pressable>
                    <Text style={[styles.title, { color: theme.accent }]}>
                        {mode === 'REGION' ? `${userRegion} Stats` : 'Personal Stats'}
                    </Text>
                    <View style={{ width: 80 }} />
                </View>

                {/* Quick Stats Row - 3 Pill Cards */}
                <View style={styles.quickStatsRow}>
                    {/* Games Played */}
                    <View style={styles.statCard}>
                        <View style={[styles.statIconContainer, { backgroundColor: theme.accentLight }]}>
                            <Target size={24} color={theme.iconAccent} />
                        </View>
                        <Text style={[styles.statValue, { color: theme.textPrimary }]}>{stats.played}</Text>
                        <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Played</Text>
                    </View>

                    {/* Win Rate */}
                    <View style={styles.statCard}>
                        <View style={[styles.statIconContainer, { backgroundColor: theme.accentLight }]}>
                            <Trophy size={24} color={theme.iconAccent} />
                        </View>
                        <Text style={[styles.statValue, { color: theme.textPrimary }]}>{winPercentage}%</Text>
                        <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Win Rate</Text>
                    </View>

                    {/* Average Guesses */}
                    <View style={styles.statCard}>
                        <View style={[styles.statIconContainer, { backgroundColor: theme.accentLight }]}>
                            <BarChart3 size={24} color={theme.iconAccent} />
                        </View>
                        <Text style={[styles.statValue, { color: theme.textPrimary }]}>{averageGuesses}</Text>
                        <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Avg Guesses</Text>
                    </View>
                </View>

                {/* Two Column Layout for Desktop */}
                <View style={styles.twoColumnLayout}>
                    {/* Left Column */}
                    <View style={styles.column}>
                        {/* Streak Card */}
                        <View style={styles.card}>
                            <View style={styles.cardHeader}>
                                <Flame size={22} color={theme.iconAccent} />
                                <Text style={[styles.cardTitle, { color: theme.textPrimary }]}>Streak</Text>
                            </View>
                            <View style={styles.streakRow}>
                                <View style={[styles.streakItem, styles.streakItemBorder]}>
                                    <Text style={[styles.streakValue, { color: theme.textPrimary }]}>
                                        {stats.currentStreak}
                                    </Text>
                                    <Text style={[styles.streakLabel, { color: theme.textSecondary }]}>Current</Text>
                                </View>
                                <View style={styles.streakItem}>
                                    <Text style={[styles.streakValue, { color: theme.textPrimary }]}>
                                        {stats.maxStreak}
                                    </Text>
                                    <Text style={[styles.streakLabel, { color: theme.textSecondary }]}>Best</Text>
                                </View>
                            </View>
                        </View>

                        {/* Monthly Ranking Card */}
                        <View style={styles.card}>
                            <View style={styles.cardHeader}>
                                <View style={styles.cardHeaderContent}>
                                    <Text style={[styles.cardTitle, { color: theme.textPrimary }]}>Monthly Ranking</Text>
                                    <Pressable
                                        onPress={() => setShowPercentileInfo(true)}
                                        onHoverIn={() => setInfoHover(true)}
                                        onHoverOut={() => setInfoHover(false)}
                                        style={[styles.infoButton, infoHover && styles.infoButtonHover]}
                                    >
                                        <Info size={16} color={theme.textMuted} />
                                    </Pressable>
                                </View>
                            </View>
                            <View style={styles.rankingContent}>
                                <Text style={[styles.rankingSubtitle, { color: theme.textSecondary }]}>Month to Date</Text>
                                <Text style={[styles.rankingValue, { color: theme.accent }]}>{percentileText}</Text>
                            </View>
                        </View>
                    </View>

                    {/* Right Column */}
                    <View style={styles.column}>
                        {/* Last 30 Days Chart */}
                        {recentActivity.length > 0 && (
                            <View style={styles.card}>
                                <View style={styles.cardHeader}>
                                    <TrendingUp size={22} color={theme.iconAccent} />
                                    <Text style={[styles.cardTitle, { color: theme.textPrimary }]}>Last 30 Days</Text>
                                </View>
                                <Last30DaysChart
                                    recentActivity={recentActivity}
                                    theme={theme}
                                />
                                <Text style={[styles.chartHint, { color: theme.textMuted }]}>
                                    Bar height = number of guesses (red = lost)
                                </Text>
                            </View>
                        )}
                    </View>
                </View>

                {/* Full Width - Guess Distribution */}
                <View style={styles.card}>
                    <View style={styles.cardHeader}>
                        <BarChart3 size={22} color={theme.iconAccent} />
                        <Text style={[styles.cardTitle, { color: theme.textPrimary }]}>Guess Distribution</Text>
                    </View>
                    <GuessDistributionChart
                        guessDistribution={stats.guessDistribution}
                        maxGuesses={maxGuesses}
                        losses={losses}
                        theme={theme}
                    />
                </View>

                {/* Badges Preview */}
                <View style={styles.card}>
                    <View style={styles.cardHeader}>
                        <Award size={22} color={theme.iconAccent} />
                        <Text style={[styles.cardTitle, { color: theme.textPrimary }]}>Badges</Text>
                    </View>
                    <View style={styles.badgesRow}>
                        <BadgePreview
                            label="Won In"
                            badge={highestBadges.elementle}
                            theme={theme}
                        />
                        <BadgePreview
                            label="Streak"
                            badge={highestBadges.streak}
                            theme={theme}
                        />
                        <BadgePreview
                            label="Top %"
                            badge={highestBadges.percentile}
                            theme={theme}
                        />
                    </View>
                </View>
            </View>

            {/* Percentile Info Modal */}
            {showPercentileInfo && (
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={[styles.modalHeader, { backgroundColor: theme.accent }]}>
                            <Text style={styles.modalTitle}>Percentile Ranking</Text>
                            <Pressable onPress={() => setShowPercentileInfo(false)} style={styles.modalClose}>
                                <X size={20} color="#FFFFFF" />
                            </Pressable>
                        </View>
                        <View style={styles.modalBody}>
                            <Text style={styles.modalText}>
                                Your monthly ranking shows how you compare to other players this month.
                            </Text>
                            <Text style={styles.modalText}>
                                "Top 10%" means you're performing better than 90% of players!
                            </Text>
                        </View>
                    </View>
                </View>
            )}
        </ScrollView>
    );
}

// ============================================================
// CHART COMPONENTS
// ============================================================

interface Last30DaysChartProps {
    recentActivity: DailyAttempt[];
    theme: ReturnType<typeof getStatsTheme>;
}

function Last30DaysChart({ recentActivity, theme }: Last30DaysChartProps) {
    return (
        <View style={styles.chartContainer}>
            {/* Y-Axis Labels */}
            <View style={styles.yAxis}>
                {['X', '5', '4', '3', '2', '1', '0'].map(label => (
                    <Text key={label} style={[styles.yAxisLabel, { color: theme.textMuted }]}>{label}</Text>
                ))}
            </View>

            {/* Chart Bars */}
            <View style={styles.barsContainer}>
                {recentActivity.map((day, idx) => {
                    const isLost = !day.won || day.guesses >= 6;
                    const heightPercent = Math.min((day.guesses / 6) * 100, 100);

                    return (
                        <View
                            key={idx}
                            style={[
                                styles.bar,
                                {
                                    height: `${heightPercent}%`,
                                    backgroundColor: isLost ? theme.lostBar : theme.chartBar,
                                }
                            ]}
                        />
                    );
                })}
            </View>
        </View>
    );
}

interface GuessDistributionChartProps {
    guessDistribution: Record<string, number>;
    maxGuesses: number;
    losses: number;
    theme: ReturnType<typeof getStatsTheme>;
}

function GuessDistributionChart({ guessDistribution, maxGuesses, losses, theme }: GuessDistributionChartProps) {
    return (
        <View style={styles.distributionContainer}>
            {['1', '2', '3', '4', '5'].map((guessNum) => {
                const count = guessDistribution[guessNum] || 0;
                const percentage = maxGuesses > 0 ? (count / maxGuesses) * 100 : 0;

                return (
                    <View key={guessNum} style={styles.distributionRow}>
                        <Text style={[styles.distributionLabel, { color: theme.textSecondary }]}>{guessNum}</Text>
                        <View style={[styles.distributionTrack, { backgroundColor: theme.chartTrack }]}>
                            {count > 0 ? (
                                <View
                                    style={[
                                        styles.distributionBar,
                                        {
                                            width: `${Math.max(percentage, 8)}%`,
                                            backgroundColor: theme.chartBar,
                                        }
                                    ]}
                                >
                                    <Text style={styles.distributionCount}>{count}</Text>
                                </View>
                            ) : (
                                <Text style={[styles.distributionZero, { color: theme.textMuted }]}>0</Text>
                            )}
                        </View>
                    </View>
                );
            })}

            {/* Lost Row */}
            <View style={[styles.distributionRow, { marginTop: 8 }]}>
                <Text style={[styles.distributionLabel, { color: theme.lostBar }]}>X</Text>
                <View style={[styles.distributionTrack, { backgroundColor: theme.lostTrack }]}>
                    {losses > 0 ? (
                        <View
                            style={[
                                styles.distributionBar,
                                {
                                    width: `${Math.max((losses / maxGuesses) * 100, 8)}%`,
                                    backgroundColor: theme.lostBar,
                                }
                            ]}
                        >
                            <Text style={styles.distributionCount}>{losses}</Text>
                        </View>
                    ) : (
                        <Text style={[styles.distributionZero, { color: theme.textMuted }]}>0</Text>
                    )}
                </View>
            </View>
        </View>
    );
}

interface BadgePreviewProps {
    label: string;
    badge: any | null;
    theme: ReturnType<typeof getStatsTheme>;
}

function BadgePreview({ label, badge, theme }: BadgePreviewProps) {
    const [hover, setHover] = useState(false);

    return (
        <Pressable
            onHoverIn={() => setHover(true)}
            onHoverOut={() => setHover(false)}
            style={[
                styles.badgeSlot,
                {
                    backgroundColor: badge ? theme.badgeWonBg : theme.accentVeryLight,
                },
                hover && styles.badgeSlotHover,
            ]}
        >
            <Text style={[styles.badgeLabel, { color: badge ? '#FFFFFF' : theme.badgeText }]}>{label}</Text>
            <View style={styles.badgePlaceholder}>
                <Award size={32} color={badge ? '#FFFFFF' : theme.textMuted} />
            </View>
            {badge && (
                <Text style={styles.badgeName} numberOfLines={2}>{badge.badge?.name}</Text>
            )}
        </Pressable>
    );
}

// ============================================================
// STYLES
// ============================================================

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F8FAFC',
    },
    scrollContent: {
        alignItems: 'center',
        paddingTop: 40,
        paddingBottom: 80,
        minHeight: '100%' as any,
    },
    contentWrapper: {
        width: '100%',
        maxWidth: 900,
        paddingHorizontal: 24,
    },
    loadingContainer: {
        flex: 1,
        backgroundColor: '#F8FAFC',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh' as any,
    },
    loadingText: {
        fontFamily: 'Nunito_500Medium',
        fontSize: 16,
        color: '#64748b',
        marginTop: 12,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 32,
    },
    backButton: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 8,
        borderRadius: 8,
    },
    backButtonHover: {
        backgroundColor: '#E2E8F0',
    },
    backButtonText: {
        fontFamily: 'Nunito_600SemiBold',
        color: '#334155',
        fontSize: 16,
        marginLeft: 4,
    },
    title: {
        fontFamily: 'Nunito_700Bold',
        fontSize: 28,
    },

    // Quick Stats Row
    quickStatsRow: {
        flexDirection: 'row',
        gap: 16,
        marginBottom: 24,
    },
    statCard: {
        flex: 1,
        backgroundColor: '#FFFFFF',
        borderRadius: 24,
        padding: 24,
        alignItems: 'center',
        shadowColor: '#64748B',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius: 16,
    },
    statIconContainer: {
        width: 48,
        height: 48,
        borderRadius: 24,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 12,
    },
    statValue: {
        fontFamily: 'Nunito_700Bold',
        fontSize: 32,
    },
    statLabel: {
        fontFamily: 'Nunito_600SemiBold',
        fontSize: 14,
        marginTop: 4,
    },

    // Two Column Layout
    twoColumnLayout: {
        flexDirection: 'row',
        gap: 24,
        marginBottom: 24,
    },
    column: {
        flex: 1,
        gap: 24,
    },

    // Cards
    card: {
        backgroundColor: '#FFFFFF',
        borderRadius: 24,
        padding: 24,
        marginBottom: 24,
        shadowColor: '#64748B',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius: 16,
    },
    cardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        marginBottom: 20,
    },
    cardHeaderContent: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    cardTitle: {
        fontFamily: 'Nunito_700Bold',
        fontSize: 18,
    },
    infoButton: {
        padding: 4,
        borderRadius: 8,
    },
    infoButtonHover: {
        backgroundColor: '#E2E8F0',
    },

    // Streak
    streakRow: {
        flexDirection: 'row',
    },
    streakItem: {
        flex: 1,
        alignItems: 'center',
        paddingVertical: 12,
    },
    streakItemBorder: {
        borderRightWidth: 1,
        borderRightColor: '#F3F4F6',
    },
    streakValue: {
        fontFamily: 'Nunito_700Bold',
        fontSize: 40,
    },
    streakLabel: {
        fontFamily: 'Nunito_600SemiBold',
        fontSize: 14,
        marginTop: 4,
    },

    // Ranking
    rankingContent: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    rankingSubtitle: {
        fontFamily: 'Nunito_600SemiBold',
        fontSize: 14,
    },
    rankingValue: {
        fontFamily: 'Nunito_700Bold',
        fontSize: 24,
    },

    // Chart
    chartContainer: {
        flexDirection: 'row',
        height: 140,
        gap: 12,
    },
    yAxis: {
        justifyContent: 'space-between',
        alignItems: 'flex-end',
        paddingVertical: 2,
    },
    yAxisLabel: {
        fontFamily: 'Nunito_600SemiBold',
        fontSize: 11,
        lineHeight: 14,
    },
    barsContainer: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'flex-end',
        gap: 2,
    },
    bar: {
        flex: 1,
        borderTopLeftRadius: 3,
        borderTopRightRadius: 3,
        minHeight: 4,
    },
    chartHint: {
        fontFamily: 'Nunito_500Medium',
        fontSize: 12,
        textAlign: 'center',
        marginTop: 16,
    },

    // Guess Distribution
    distributionContainer: {
        gap: 8,
    },
    distributionRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    distributionLabel: {
        fontFamily: 'Nunito_700Bold',
        fontSize: 14,
        width: 20,
        textAlign: 'center',
    },
    distributionTrack: {
        flex: 1,
        height: 36,
        borderRadius: 8,
        flexDirection: 'row',
        alignItems: 'center',
        overflow: 'hidden',
    },
    distributionBar: {
        height: '100%',
        borderRadius: 8,
        justifyContent: 'center',
        alignItems: 'flex-end',
        paddingRight: 12,
    },
    distributionCount: {
        fontFamily: 'Nunito_700Bold',
        fontSize: 12,
        color: '#FFFFFF',
    },
    distributionZero: {
        fontFamily: 'Nunito_500Medium',
        fontSize: 12,
        paddingLeft: 12,
    },

    // Badges
    badgesRow: {
        flexDirection: 'row',
        gap: 12,
    },
    badgeSlot: {
        flex: 1,
        alignItems: 'center',
        padding: 16,
        borderRadius: 16,
    },
    badgeSlotHover: {
        transform: [{ scale: 1.02 }],
    },
    badgeLabel: {
        fontFamily: 'Nunito_700Bold',
        fontSize: 11,
        textTransform: 'uppercase',
        marginBottom: 12,
    },
    badgePlaceholder: {
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: 'rgba(255,255,255,0.2)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    badgeName: {
        fontFamily: 'Nunito_600SemiBold',
        fontSize: 11,
        color: '#FFFFFF',
        textAlign: 'center',
        marginTop: 8,
    },

    // Modal
    modalOverlay: {
        position: 'fixed' as any,
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.5)',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
    },
    modalContent: {
        backgroundColor: '#FFFFFF',
        borderRadius: 20,
        width: '100%',
        maxWidth: 400,
        overflow: 'hidden',
    },
    modalHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 16,
    },
    modalTitle: {
        fontFamily: 'Nunito_700Bold',
        fontSize: 18,
        color: '#FFFFFF',
    },
    modalClose: {
        padding: 4,
        borderRadius: 20,
        backgroundColor: 'rgba(255,255,255,0.2)',
    },
    modalBody: {
        padding: 20,
    },
    modalText: {
        fontFamily: 'Nunito_500Medium',
        fontSize: 15,
        color: '#475569',
        marginBottom: 12,
        lineHeight: 22,
    },
});
