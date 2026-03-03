/**
 * League Tab — League Table view
 *
 * Tab screen showing user's leagues, MTD/YTD standings, rating tooltip.
 * Header matches app design: filled background, back button, centered title.
 * Column headers stay pinned while list scrolls underneath.
 *
 * Name column: bold league_nickname, subtitle: GlobalName #Tag
 * Smart Ghost Row: hides when list fits / user row visible,
 *   pins to top when user row scrolled off top, bottom when off bottom.
 */

import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import {
    View,
    Text,
    ScrollView,
    TouchableOpacity,
    ActivityIndicator,
    FlatList,
    RefreshControl,
    Animated,
    Modal,
    LayoutChangeEvent,
    ViewToken,
    PanResponder,
    useWindowDimensions,
} from 'react-native';
import { styled } from 'nativewind';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { ChevronLeft, ChevronRight, ChevronUp, ChevronDown, Minus, Settings, Lock } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { Image } from 'expo-image';
import {
    useMyLeagues,
    useLeagueStandings,
    useRecordLeagueView,
    useHistoricalStandings,
    getAvailablePeriods,
    getCurrentPeriodLabel,
    formatPeriodLabel,
} from '../../hooks/useLeagueData';
import type { GameMode } from '../../hooks/useLeagueData';
import { useLeague } from '../../contexts/LeagueContext';
import { useAuth } from '../../lib/auth';
import { useThemeColor } from '../../hooks/useThemeColor';
import { useOptions } from '../../lib/options';
import { ThemedView } from '../../components/ThemedView';
import { ThemedText } from '../../components/ThemedText';
import { RapidScrollBar } from '../../components/league/RapidScrollBar';
import { MonthSelectModal } from '../../components/archive/MonthSelectModal';
import type { StandingRow, Timeframe, League } from '../../hooks/useLeagueData';

const StyledView = styled(View);
const StyledTouchableOpacity = styled(TouchableOpacity);
const StyledScrollView = styled(ScrollView);

const WelcomeHamster = require('../../assets/ui/webp_assets/Win-Hamster-Blue.webp');

// ─── RankArrow ─────────────────────────────────────────────────────────

function RankArrow({ yesterdaysRank, currentRank }: { yesterdaysRank: number | null; currentRank: number }) {
    if (yesterdaysRank === null || yesterdaysRank === undefined) {
        return (
            <StyledView className="w-9 flex-row items-center justify-center" style={{ gap: 2 }}>
                <Minus size={14} color="#94a3b8" />
            </StyledView>
        );
    }
    const change = yesterdaysRank - currentRank;
    if (change > 0) {
        return (
            <StyledView className="w-9 flex-row items-center justify-center" style={{ gap: 2 }}>
                <ChevronUp size={14} color="#22c55e" />
                <Text style={{ fontSize: 11, fontWeight: '700', fontFamily: 'Nunito_700Bold', color: '#22c55e' }}>{change}</Text>
            </StyledView>
        );
    } else if (change < 0) {
        return (
            <StyledView className="w-9 flex-row items-center justify-center" style={{ gap: 2 }}>
                <ChevronDown size={14} color="#ef4444" />
                <Text style={{ fontSize: 11, fontWeight: '700', fontFamily: 'Nunito_700Bold', color: '#ef4444' }}>{Math.abs(change)}</Text>
            </StyledView>
        );
    }
    return (
        <StyledView className="w-9 flex-row items-center justify-center" style={{ gap: 2 }}>
            <Minus size={14} color="#94a3b8" />
        </StyledView>
    );
}

// ─── TimeframeToggle (compact Month/Year with sliding indicator) ─────────

function TimeframeToggle({
    selectedTimeframe,
    onSelect,
    darkMode,
}: {
    selectedTimeframe: Timeframe;
    onSelect: (tf: Timeframe) => void;
    darkMode: boolean;
}) {
    const [tabWidth, setTabWidth] = useState(0);
    const slideAnim = useRef(new Animated.Value(selectedTimeframe === 'mtd' ? 0 : 1)).current;

    useEffect(() => {
        Animated.timing(slideAnim, {
            toValue: selectedTimeframe === 'mtd' ? 0 : 1,
            duration: 200,
            useNativeDriver: true,
        }).start();
    }, [selectedTimeframe]);

    const containerBg = darkMode ? '#334155' : '#475569';
    const indicatorBg = darkMode ? '#1e293b' : '#ffffff';
    const activeTextColor = darkMode ? '#ffffff' : '#0f172a';
    const inactiveTextColor = '#ffffff';

    return (
        <View
            style={{
                flexDirection: 'row',
                backgroundColor: containerBg,
                borderRadius: 20,
                padding: 3,
                marginRight: 8,
                zIndex: 1,
            }}
            onLayout={(e) => {
                const w = e.nativeEvent.layout.width;
                setTabWidth((w - 6) / 2); // subtract padding
            }}
        >
            {/* Sliding indicator */}
            {tabWidth > 0 && (
                <Animated.View
                    style={{
                        position: 'absolute',
                        top: 3, left: 3,
                        width: tabWidth,
                        height: '100%',
                        borderRadius: 18,
                        backgroundColor: indicatorBg,
                        shadowColor: '#000',
                        shadowOffset: { width: 0, height: 1 },
                        shadowOpacity: 0.15,
                        shadowRadius: 2,
                        elevation: 2,
                        transform: [{
                            translateX: slideAnim.interpolate({
                                inputRange: [0, 1],
                                outputRange: [0, tabWidth],
                            }),
                        }],
                    }}
                />
            )}
            {(['mtd', 'ytd'] as Timeframe[]).map((tf) => (
                <TouchableOpacity
                    key={tf}
                    style={{
                        paddingHorizontal: 12, paddingVertical: 5,
                        borderRadius: 18,
                        zIndex: 1,
                    }}
                    onPress={() => onSelect(tf)}
                >
                    <Text style={{
                        color: selectedTimeframe === tf ? activeTextColor : inactiveTextColor,
                        fontWeight: selectedTimeframe === tf ? '700' : '500',
                        fontSize: 13,
                        fontFamily: selectedTimeframe === tf ? 'Nunito_700Bold' : 'Nunito_500Medium',
                    }}>
                        {tf === 'mtd' ? 'Month' : 'Year'}
                    </Text>
                </TouchableOpacity>
            ))}
        </View>
    );
}

// ─── GhostRow (smart pinned "my" row) ───────────────────────────────────

function GhostRow({ row, position }: { row: StandingRow; position: 'top' | 'bottom' }) {
    const textColor = useThemeColor({}, 'text');
    const ghostBg = useThemeColor({ light: '#dbeafe', dark: '#1e3a5f' }, 'surface');

    const borderStyle = position === 'top'
        ? { borderBottomWidth: 2, borderBottomColor: '#3b82f6' }
        : { borderTopWidth: 2, borderTopColor: '#3b82f6' };

    return (
        <StyledView
            className="flex-row items-center px-3 py-3"
            style={{ ...borderStyle, backgroundColor: ghostBg }}
        >
            <Text style={{ width: 28, textAlign: 'center', fontSize: 14, fontWeight: '700', fontFamily: 'Nunito_700Bold', color: textColor }}>{row.rank}</Text>
            <RankArrow yesterdaysRank={row.yesterdays_rank} currentRank={row.rank} />
            <StyledView className="flex-1 px-1">
                <Text style={{ fontSize: 14, fontFamily: 'Nunito_700Bold', fontWeight: '700', color: '#1d4ed8' }}>
                    {row.league_nickname || row.global_display_name} ★
                </Text>
                <Text style={{ fontSize: 10, fontFamily: 'Nunito_400Regular', color: '#94a3b8' }}>
                    {row.global_display_name} {row.global_tag}
                </Text>
            </StyledView>
            <Text style={{ width: 36, textAlign: 'center', fontSize: 14, fontFamily: 'Nunito_600SemiBold', color: textColor }}>{row.games_played}</Text>
            <Text style={{ width: 42, textAlign: 'center', fontSize: 14, fontFamily: 'Nunito_600SemiBold', color: textColor }}>{row.win_rate}%</Text>
            <Text style={{ width: 36, textAlign: 'center', fontSize: 14, fontFamily: 'Nunito_600SemiBold', color: textColor }}>{row.avg_guesses}</Text>
            <Text style={{ width: 48, textAlign: 'center', fontSize: 14, fontWeight: '700', fontFamily: 'Nunito_700Bold', color: '#b45309' }}>
                {row.elementle_rating}
            </Text>
        </StyledView>
    );
}

// ─── LeagueTableRow ────────────────────────────────────────────────────

function LeagueTableRow({ row, isEven }: { row: StandingRow; isEven: boolean }) {
    const textColor = useThemeColor({}, 'text');
    const secondaryText = useThemeColor({}, 'icon');
    const bgEven = useThemeColor({ light: '#f8fafc', dark: '#1e293b' }, 'surface');
    const bgOdd = useThemeColor({ light: '#ffffff', dark: '#0f172a' }, 'background');

    return (
        <StyledView
            className="flex-row items-center px-3 py-2.5"
            style={{ backgroundColor: isEven ? bgEven : bgOdd }}
        >
            <Text style={{ width: 28, textAlign: 'center', fontSize: 14, fontWeight: '700', fontFamily: 'Nunito_700Bold', color: textColor }}>
                {row.rank}
            </Text>
            <RankArrow yesterdaysRank={row.yesterdays_rank} currentRank={row.rank} />
            <StyledView className="flex-1 px-1">
                <Text
                    style={{
                        fontSize: 14,
                        fontFamily: row.is_me ? 'Nunito_700Bold' : 'Nunito_600SemiBold',
                        fontWeight: row.is_me ? '700' : '500',
                        color: row.is_me ? '#1d4ed8' : textColor,
                    }}
                    numberOfLines={1}
                >
                    {row.league_nickname || row.global_display_name}{row.is_me ? ' ★' : ''}
                </Text>
                <Text style={{ fontSize: 10, fontFamily: 'Nunito_400Regular', color: '#94a3b8' }}>
                    {row.global_display_name} {row.global_tag}
                </Text>
            </StyledView>
            <Text style={{ width: 36, textAlign: 'center', fontSize: 14, fontFamily: 'Nunito_600SemiBold', color: secondaryText }}>{row.games_played}</Text>
            <Text style={{ width: 42, textAlign: 'center', fontSize: 14, fontFamily: 'Nunito_600SemiBold', color: secondaryText }}>{row.win_rate}%</Text>
            <Text style={{ width: 36, textAlign: 'center', fontSize: 14, fontFamily: 'Nunito_600SemiBold', color: secondaryText }}>{row.avg_guesses}</Text>
            <Text style={{ width: 48, textAlign: 'center', fontSize: 14, fontWeight: '700', fontFamily: 'Nunito_700Bold', color: '#b45309' }}>
                {row.elementle_rating}
            </Text>
        </StyledView>
    );
}

// ─── Column Header Row ─────────────────────────────────────────────────

function ColumnHeaders({
    borderColor,
    iconColor,
    onStatInfo,
}: {
    borderColor: string;
    iconColor: string;
    onStatInfo: (stat: string) => void;
}) {
    return (
        <StyledView
            className="flex-row items-center px-3 py-2"
            style={{ borderBottomWidth: 1, borderBottomColor: borderColor }}
        >
            <Text style={{ width: 28, textAlign: 'center', fontSize: 12, fontFamily: 'Nunito_600SemiBold', color: iconColor }}>#</Text>
            <Text style={{ width: 36, textAlign: 'center', fontSize: 12, fontFamily: 'Nunito_600SemiBold', color: iconColor }}>▲▼</Text>
            <Text style={{ flex: 1, fontSize: 12, fontFamily: 'Nunito_600SemiBold', color: iconColor }}>Name</Text>
            <TouchableOpacity
                style={{ flexDirection: 'row', width: 114, justifyContent: 'center' }}
                onPress={() => onStatInfo('stats')}
                hitSlop={{ top: 10, bottom: 10, left: 5, right: 5 }}
            >
                <Text style={{ width: 36, textAlign: 'center', fontSize: 12, fontFamily: 'Nunito_600SemiBold', color: iconColor }}>P</Text>
                <Text style={{ width: 42, textAlign: 'center', fontSize: 12, fontFamily: 'Nunito_600SemiBold', color: iconColor }}>Win%</Text>
                <Text style={{ width: 36, textAlign: 'center', fontSize: 12, fontFamily: 'Nunito_600SemiBold', color: iconColor }}>Avg</Text>
            </TouchableOpacity>
            <TouchableOpacity style={{ width: 48, alignItems: 'center' }} onPress={() => onStatInfo('rating')} hitSlop={{ top: 10, bottom: 10, left: 5, right: 5 }}>
                <Text style={{ fontSize: 12, fontFamily: 'Nunito_600SemiBold', color: '#b45309' }}>Rating</Text>
            </TouchableOpacity>
        </StyledView>
    );
}

// ─── Main League Screen ────────────────────────────────────────────────

export default function LeagueScreen({ gameMode = 'region' as GameMode }: { gameMode?: GameMode }) {
    const { width: screenWidth } = useWindowDimensions();
    const { user } = useAuth();
    const router = useRouter();

    // Theme colors
    const backgroundColor = useThemeColor({}, 'background');
    const surfaceColor = useThemeColor({}, 'surface');
    const borderColor = useThemeColor({}, 'border');
    const textColor = useThemeColor({}, 'text');
    const iconColor = useThemeColor({}, 'icon');

    const { darkMode } = useOptions();
    const { selectedLeagueId, setSelectedLeagueId, selectedTimeframe, setSelectedTimeframe } = useLeague();

    const { data: leagues, isLoading: leaguesLoading, refetch: refetchLeagues } = useMyLeagues(gameMode);
    const { data: standings, isLoading: standingsLoading, refetch: refetchStandings } = useLeagueStandings(
        selectedLeagueId,
        selectedTimeframe,
        gameMode
    );
    const recordView = useRecordLeagueView();

    const [refreshing, setRefreshing] = useState(false);
    const [showRatingTooltip, setShowRatingTooltip] = useState(false);
    const [statTooltipType, setStatTooltipType] = useState<string | null>(null);
    const [monthPickerVisible, setMonthPickerVisible] = useState(false);
    const scrollY = useRef(new Animated.Value(0)).current;
    const [listContainerHeight, setListContainerHeight] = useState(0);
    const [listContentHeight, setListContentHeight] = useState(0);
    const insets = useSafeAreaInsets();

    // Brand color for header
    const brandColor = gameMode === 'region' ? '#8E57DB' : '#B278CD';

    // ── Date Picker / Historical Mode state ──
    const [selectedPeriod, setSelectedPeriod] = useState<string | null>(null); // null = current/live
    const availablePeriods = useMemo(() => getAvailablePeriods(selectedTimeframe), [selectedTimeframe]);
    const currentPeriodLabel = useMemo(() => getCurrentPeriodLabel(selectedTimeframe), [selectedTimeframe]);

    // Is the user viewing a past period?
    const isViewingPast = selectedPeriod !== null && selectedPeriod !== currentPeriodLabel;

    // Historical standings hook (only fires when viewing a past period)
    const { data: historicalStandings, isLoading: historicalLoading } = useHistoricalStandings(
        isViewingPast ? selectedLeagueId : null,
        selectedTimeframe,
        isViewingPast ? selectedPeriod : null,
        gameMode
    );

    // Determine if we're in blind phase (live RPC returned is_historical: true)
    const isBlindPhase = !isViewingPast && standings?.is_historical === true;

    // Effective data: historical (past or blind phase) vs live
    const isHistoricalMode = isViewingPast || isBlindPhase;
    const effectiveStandings = isViewingPast ? historicalStandings : standings;
    const effectiveLoading = isViewingPast ? historicalLoading : standingsLoading;

    // Grey background for historical/blind mode
    const historicalBg = darkMode ? '#1a2332' : '#f0f0f0';
    const normalBg = 'transparent';
    const tableContainerBg = isHistoricalMode ? historicalBg : normalBg;

    // Reset period selection when timeframe changes
    useEffect(() => {
        setSelectedPeriod(null);
    }, [selectedTimeframe]);

    // Date picker label
    const displayPeriodLabel = selectedPeriod || (isBlindPhase && standings?.period_label) || currentPeriodLabel;
    const displayPeriodFormatted = formatPeriodLabel(displayPeriodLabel, selectedTimeframe);

    // Date picker navigation
    const currentPeriodIndex = availablePeriods.indexOf(displayPeriodLabel);
    const canGoNewer = currentPeriodIndex > 0;
    const canGoOlder = currentPeriodIndex < availablePeriods.length - 1;

    const handlePeriodPrev = () => {
        if (canGoOlder) {
            setSelectedPeriod(availablePeriods[currentPeriodIndex + 1]);
        }
    };
    const handlePeriodNext = () => {
        if (canGoNewer) {
            const newPeriod = availablePeriods[currentPeriodIndex - 1];
            setSelectedPeriod(newPeriod === currentPeriodLabel ? null : newPeriod);
        }
    };

    // Swipe gesture on data area to change period
    const swipePanResponder = useRef(
        PanResponder.create({
            onMoveShouldSetPanResponder: (_, gestureState) => {
                return Math.abs(gestureState.dx) > 30 && Math.abs(gestureState.dy) < 30;
            },
            onPanResponderRelease: (_, gestureState) => {
                if (gestureState.dx < -50 && canGoNewer) {
                    // Swipe left → go newer (forward)
                    handlePeriodNext();
                } else if (gestureState.dx > 50 && canGoOlder) {
                    // Swipe right → go older (backward)
                    handlePeriodPrev();
                }
            },
        })
    ).current;

    // MonthSelectModal date helpers
    const periodToDate = (period: string | null): Date => {
        if (!period) return new Date();
        const parts = period.split('-');
        if (parts.length === 2) return new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, 1);
        return new Date(parseInt(parts[0]), 0, 1);
    };
    const minPeriodDate = useMemo(() => {
        if (availablePeriods.length === 0) return new Date(2022, 0, 1);
        return periodToDate(availablePeriods[availablePeriods.length - 1]);
    }, [availablePeriods]);
    const maxPeriodDate = useMemo(() => new Date(), []);

    const handleMonthSelect = (date: Date) => {
        const label = selectedTimeframe === 'mtd'
            ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
            : `${date.getFullYear()}`;
        if (label === currentPeriodLabel) {
            setSelectedPeriod(null);
        } else if (availablePeriods.includes(label)) {
            setSelectedPeriod(label);
        }
    };

    // Stat tooltip descriptions
    const statDescriptions: Record<string, { title: string; body: string }> = {
        stats: { title: 'Game Statistics', body: 'P — Games Played: total games played this period.\n\nWin% — Win Rate: percentage of games won.\n\nAvg — Average Guesses: average number of guesses per game.' },
        rating: { title: 'Elementle Rating', body: 'A comprehensive measure of your puzzle-solving skill, factoring in your win rate, average guesses, and consistency.' },
    };

    // ── Smart Ghost Row state ──
    const [myRowVisible, setMyRowVisible] = useState(false);
    // Track the range of visible item indices to determine ghost position
    const visibleRangeRef = useRef<{ first: number; last: number }>({ first: 0, last: 0 });

    // Auto-select first league
    useEffect(() => {
        if (leagues && leagues.length > 0 && !selectedLeagueId) {
            setSelectedLeagueId(leagues[0].id);
        }
    }, [leagues, selectedLeagueId]);

    // Record league view
    useFocusEffect(
        useCallback(() => {
            if (standings?.my_rank && selectedLeagueId) {
                recordView.mutate({ leagueId: selectedLeagueId, currentRank: standings.my_rank });
            }
        }, [standings?.my_rank, selectedLeagueId])
    );

    const onRefresh = async () => {
        setRefreshing(true);
        await Promise.all([refetchLeagues(), refetchStandings()]);
        setRefreshing(false);
    };

    const myRow = effectiveStandings?.standings?.find((s: StandingRow) => s.is_me);
    const allRows = effectiveStandings?.standings ?? [];
    const listFitsOnScreen = listContentHeight > 0 && listContentHeight <= listContainerHeight;

    // Determine my row's index for viewability tracking
    const myRowIndex = useMemo(() => {
        if (!myRow) return -1;
        return allRows.findIndex((r: StandingRow) => r.user_id === myRow.user_id);
    }, [allRows, myRow]);

    // onViewableItemsChanged callback — tracks visibility AND visible index range
    const onViewableItemsChanged = useCallback(
        ({ viewableItems }: { viewableItems: ViewToken[] }) => {
            if (myRowIndex < 0) return;
            const isVisible = viewableItems.some(
                (item) => item.index === myRowIndex
            );
            setMyRowVisible(isVisible);

            // Track visible range for ghost position
            if (viewableItems.length > 0) {
                const indices = viewableItems
                    .map(v => v.index)
                    .filter((i): i is number => i !== null && i !== undefined);
                if (indices.length > 0) {
                    visibleRangeRef.current = {
                        first: Math.min(...indices),
                        last: Math.max(...indices),
                    };
                }
            }
        },
        [myRowIndex]
    );

    const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 100 }).current;

    // Track scroll for RapidScrollBar (no longer used for ghost position)
    const handleScroll = useCallback(
        (event: any) => {
            // No-op for ghost, but still needed for Animated.event
        },
        []
    );

    // Determine ghost row visibility and position
    const showGhost = myRow && !listFitsOnScreen && !myRowVisible;
    // Position based on WHERE the user's row actually is relative to visible area
    const ghostPosition: 'top' | 'bottom' = useMemo(() => {
        if (!myRow || myRowIndex < 0) return 'bottom';
        // User's row is BELOW the visible area → pin ghost to BOTTOM
        if (myRowIndex > visibleRangeRef.current.last) return 'bottom';
        // User's row is ABOVE the visible area → pin ghost to TOP
        if (myRowIndex < visibleRangeRef.current.first) return 'top';
        // Fallback (shouldn't happen if myRowVisible is false, but be safe)
        return 'bottom';
    }, [myRowIndex, myRow, myRowVisible]);

    // Not signed in
    if (!user) {
        return (
            <ThemedView className="flex-1">
                <SafeAreaView edges={['top']} style={{ flex: 1, justifyContent: 'center', alignItems: 'center', gap: 16, padding: 40 }}>
                    <Image source={WelcomeHamster} style={{ width: 100, height: 100 }} contentFit="contain" />
                    <ThemedText size="lg" className="font-n-bold text-center">Sign in to view leagues</ThemedText>
                </SafeAreaView>
            </ThemedView>
        );
    }

    return (
        <ThemedView className="flex-1" style={{ backgroundColor: darkMode ? '#0f172a' : '#f1f5f9' }}>
            {/* ── COLORED HEADER (Archive-style) ── */}
            <View
                style={{
                    backgroundColor: brandColor,
                    paddingTop: insets.top + 2,
                    paddingBottom: 24,
                }}
            >
                {/* Header Row */}
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', position: 'relative', paddingVertical: 12, paddingHorizontal: 16 }}>
                    <StyledTouchableOpacity
                        onPress={() => router.back()}
                        style={{ position: 'absolute', left: 16, top: 8, zIndex: 10, padding: 8 }}
                        hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
                    >
                        <ChevronLeft size={28} color="#FFFFFF" />
                    </StyledTouchableOpacity>

                    {screenWidth >= 768 ? (
                        <ThemedText className="font-n-bold text-white" size="3xl" style={{ color: '#FFFFFF' }}>
                            {gameMode === 'region' ? 'UK Edition Leagues' : 'Personal Edition Leagues'}
                        </ThemedText>
                    ) : (
                        <View style={{ alignItems: 'center' }}>
                            <ThemedText className="font-n-bold text-white" size="3xl" style={{ color: '#FFFFFF' }}>
                                {gameMode === 'region' ? 'UK Edition' : 'Personal Edition'}
                            </ThemedText>
                            <ThemedText className="font-n-bold text-white" size="3xl" style={{ color: '#FFFFFF', marginTop: -2 }}>
                                Leagues
                            </ThemedText>
                        </View>
                    )}

                    <StyledTouchableOpacity
                        onPress={() => router.push({ pathname: '/league/manage', params: { mode: gameMode } })}
                        style={{ position: 'absolute', right: 16, top: 8, zIndex: 10, padding: 8 }}
                        hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
                    >
                        <Settings size={28} color="#FFFFFF" />
                    </StyledTouchableOpacity>
                </View>
            </View>

            {/* ── OVERLAPPING CONTENT (below colored header) ── */}
            <View style={{ marginTop: -24, width: '100%', maxWidth: 768, alignSelf: 'center' }}>
                {/* ── DATE PICKER (Archive-style arrows) - overlaps header ── */}
                <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 24, gap: 12, marginBottom: 8 }}>
                    {/* Left (older) arrow */}
                    <StyledTouchableOpacity
                        onPress={handlePeriodPrev}
                        disabled={!canGoOlder}
                        style={{
                            backgroundColor: darkMode ? '#1e293b' : '#FFFFFF',
                            borderRadius: 24,
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: 48,
                            height: 60,
                            opacity: canGoOlder ? 1 : 0.4,
                            shadowColor: '#000',
                            shadowOffset: { width: 0, height: 1 },
                            shadowOpacity: darkMode ? 0 : 0.05,
                            shadowRadius: 2,
                            elevation: darkMode ? 0 : 1,
                        }}
                    >
                        <ChevronLeft size={24} color={darkMode ? '#FFFFFF' : '#64748B'} />
                    </StyledTouchableOpacity>

                    {/* Period label (tappable) */}
                    <TouchableOpacity
                        style={{
                            flex: 1,
                            backgroundColor: isHistoricalMode
                                ? (darkMode ? '#334155' : '#e2e8f0')
                                : (darkMode ? '#1e293b' : '#FFFFFF'),
                            borderRadius: 24,
                            alignItems: 'center',
                            justifyContent: 'center',
                            height: 60,
                            flexDirection: 'row',
                            gap: 6,
                            shadowColor: '#000',
                            shadowOffset: { width: 0, height: 1 },
                            shadowOpacity: darkMode ? 0 : 0.05,
                            shadowRadius: 2,
                            elevation: darkMode ? 0 : 1,
                        }}
                        onPress={() => setMonthPickerVisible(true)}
                    >
                        {isHistoricalMode && <Lock size={12} color={iconColor} />}
                        <ThemedText
                            style={{
                                fontSize: 20,
                                color: isHistoricalMode ? iconColor : (darkMode ? '#FFFFFF' : '#1e293b'),
                            }}
                            className="font-n-bold"
                            numberOfLines={1}
                        >
                            {isBlindPhase && !isViewingPast
                                ? `${displayPeriodFormatted} (final)`
                                : displayPeriodFormatted}
                        </ThemedText>
                    </TouchableOpacity>

                    {/* Right (newer) arrow */}
                    <StyledTouchableOpacity
                        onPress={handlePeriodNext}
                        disabled={!canGoNewer}
                        style={{
                            backgroundColor: darkMode ? '#1e293b' : '#FFFFFF',
                            borderRadius: 24,
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: 48,
                            height: 60,
                            opacity: canGoNewer ? 1 : 0.4,
                            shadowColor: '#000',
                            shadowOffset: { width: 0, height: 1 },
                            shadowOpacity: darkMode ? 0 : 0.05,
                            shadowRadius: 2,
                            elevation: darkMode ? 0 : 1,
                        }}
                    >
                        <ChevronRight size={24} color={darkMode ? '#FFFFFF' : '#64748B'} />
                    </StyledTouchableOpacity>
                </View>

                {/* League tabs + compact Month/Year toggle on same row */}
                <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, marginTop: 8, marginBottom: 8 }}>
                    {/* Compact Month/Year toggle - fixed left with sliding indicator */}
                    <TimeframeToggle
                        selectedTimeframe={selectedTimeframe}
                        onSelect={setSelectedTimeframe}
                        darkMode={darkMode}
                    />

                    {/* League pills - scroll behind the toggle */}
                    {leaguesLoading ? (
                        <ActivityIndicator style={{ marginLeft: 8 }} color="#3b82f6" />
                    ) : (leagues && leagues.length > 0) && (
                        <ScrollView
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            style={{ flex: 1 }}
                            contentContainerStyle={{ gap: 8, alignItems: 'center', paddingRight: 8 }}
                        >
                            {leagues.map((league: League) => {
                                const isActive = league.id === selectedLeagueId;
                                return (
                                    <TouchableOpacity
                                        key={league.id}
                                        style={{
                                            paddingHorizontal: 16, paddingVertical: 7,
                                            borderRadius: 9999,
                                            backgroundColor: isActive ? brandColor : surfaceColor,
                                            borderWidth: isActive ? 0 : 1,
                                            borderColor: isActive ? 'transparent' : borderColor,
                                        }}
                                        onPress={() => setSelectedLeagueId(league.id)}
                                    >
                                        <Text style={{
                                            color: isActive ? '#ffffff' : iconColor,
                                            fontWeight: isActive ? '700' : '500',
                                            fontSize: 13, fontFamily: 'Nunito_600SemiBold',
                                        }}>{league.is_system_league
                                            ? (league.system_region === 'GLOBAL' ? 'Global' : (league.system_region || league.name))
                                            : league.name}</Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </ScrollView>
                    )}
                </View>

                {/* ── STICKY COLUMN HEADERS ── */}
                <View style={{ marginTop: 4 }}>
                    <ColumnHeaders borderColor={borderColor} iconColor={iconColor} onStatInfo={(stat) => setStatTooltipType(stat)} />
                </View>
            </View>

            {/* ── SCROLLABLE LIST ── */}
            {
                effectiveLoading ? (
                    <ActivityIndicator style={{ marginTop: 40 }} color="#3b82f6" />
                ) : allRows.length === 0 ? (
                    <StyledView className="flex-1 justify-center items-center p-10" style={{ gap: 12, width: '100%', maxWidth: 768, alignSelf: 'center' }}>
                        <Image source={WelcomeHamster} style={{ width: 80, height: 80 }} contentFit="contain" />
                        {isViewingPast ? (
                            <>
                                <ThemedText size="lg" className="font-n-bold text-center">No data available</ThemedText>
                                <ThemedText className="font-n-regular text-center" style={{ color: iconColor }}>
                                    This league was created after the selected date
                                </ThemedText>
                                <TouchableOpacity
                                    style={{
                                        paddingHorizontal: 24, paddingVertical: 12,
                                        borderRadius: 12, marginTop: 8,
                                        borderWidth: 1, borderColor: brandColor,
                                    }}
                                    onPress={() => setSelectedPeriod(null)}
                                >
                                    <Text style={{ color: brandColor, fontWeight: '600', fontFamily: 'Nunito_600SemiBold', fontSize: 15 }}>
                                        Return to today
                                    </Text>
                                </TouchableOpacity>
                            </>
                        ) : (
                            <>
                                <ThemedText size="lg" className="font-n-bold text-center">No standings yet</ThemedText>
                                <ThemedText className="font-n-regular text-center" style={{ color: iconColor }}>
                                    Play a game to appear on the leaderboard!
                                </ThemedText>
                            </>
                        )}
                    </StyledView>
                ) : (
                    <View style={{ flex: 1, backgroundColor: tableContainerBg, width: '100%', maxWidth: 768, alignSelf: 'center' }} {...swipePanResponder.panHandlers}>
                        <FlatList
                            data={allRows}
                            keyExtractor={(item) => item.user_id}
                            renderItem={({ item, index }) => (
                                <LeagueTableRow row={item} isEven={index % 2 === 0} />
                            )}
                            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
                            contentContainerStyle={{ paddingBottom: 20 }}
                            showsVerticalScrollIndicator={false}
                            onScroll={(event) => {
                                handleScroll(event);
                                Animated.event(
                                    [{ nativeEvent: { contentOffset: { y: scrollY } } }],
                                    { useNativeDriver: false }
                                )(event);
                            }}
                            scrollEventThrottle={16}
                            onLayout={(e: LayoutChangeEvent) => setListContainerHeight(e.nativeEvent.layout.height)}
                            onContentSizeChange={(_, h) => setListContentHeight(h)}
                            onViewableItemsChanged={onViewableItemsChanged}
                            viewabilityConfig={viewabilityConfig}
                        />
                        <RapidScrollBar
                            contentHeight={listContentHeight}
                            scrollY={scrollY}
                            containerHeight={listContainerHeight}
                        />

                        {/* Ghost row — absolute overlay (doesn't affect list layout) */}
                        {showGhost && myRow && (
                            <View
                                pointerEvents="none"
                                style={{
                                    position: 'absolute',
                                    left: 0, right: 0,
                                    ...(ghostPosition === 'top' ? { top: 0 } : { bottom: 0 }),
                                }}
                            >
                                <GhostRow row={myRow} position={ghostPosition} />
                            </View>
                        )}
                    </View>
                )
            }

            {/* ── Stat Tooltip Modal ── */}
            <Modal
                visible={statTooltipType !== null}
                transparent
                animationType="fade"
                onRequestClose={() => setStatTooltipType(null)}
            >
                <TouchableOpacity
                    style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 32 }}
                    activeOpacity={1}
                    onPress={() => setStatTooltipType(null)}
                >
                    <View style={{ borderRadius: 16, padding: 24, width: '100%', maxWidth: 340, backgroundColor: surfaceColor }}>
                        <Text style={{ fontSize: 18, fontWeight: '700', fontFamily: 'Nunito_700Bold', color: statTooltipType === 'rating' ? '#b45309' : brandColor, marginBottom: 12 }}>
                            {statTooltipType ? statDescriptions[statTooltipType]?.title : ''}
                        </Text>
                        <Text style={{ fontSize: 14, fontFamily: 'Nunito_400Regular', lineHeight: 22, marginBottom: 20, color: textColor }}>
                            {statTooltipType ? statDescriptions[statTooltipType]?.body : ''}
                        </Text>
                        <TouchableOpacity
                            style={{ paddingVertical: 10, borderRadius: 10, alignItems: 'center', backgroundColor: brandColor }}
                            onPress={() => setStatTooltipType(null)}
                        >
                            <Text style={{ color: '#ffffff', fontWeight: '600', fontFamily: 'Nunito_600SemiBold' }}>Got it</Text>
                        </TouchableOpacity>
                    </View>
                </TouchableOpacity>
            </Modal>

            {/* ── Month/Year Picker Modal ── */}
            <MonthSelectModal
                visible={monthPickerVisible}
                onClose={() => setMonthPickerVisible(false)}
                currentDate={periodToDate(displayPeriodLabel)}
                minDate={minPeriodDate}
                maxDate={maxPeriodDate}
                onSelectDate={handleMonthSelect}
                mode={selectedTimeframe === 'ytd' ? 'year' : 'month'}
            />
        </ThemedView >
    );
}
