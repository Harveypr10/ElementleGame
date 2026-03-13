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

import React, { useEffect, useState, useCallback, useRef, useMemo, } from 'react';
import {
    View,
    Text,
    ScrollView,
    TouchableOpacity,
    Pressable,
    ActivityIndicator,
    FlatList,
    RefreshControl,
    Animated,
    Modal,
    LayoutChangeEvent,
    ViewToken,
    Platform,
    useWindowDimensions,
    Share,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { styled } from 'nativewind';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { ChevronLeft, ChevronRight, ChevronUp, ChevronDown, Minus, Settings, Share2, Trophy } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { Image } from 'expo-image';
import {
    useMyLeagues,
    useMyLeaguesAll,
    useLeagueStandings,
    useLeagueSnapshotRange,
    useMyMembership,
    useMyAwards,
    prefetchLeagueSnapshots,

    getCurrentPeriodLabel,
    formatPeriodLabel,
} from '../../hooks/useLeagueData';
import { useQueryClient } from '@tanstack/react-query';
import type { GameMode, SnapshotRange } from '../../hooks/useLeagueData';
import { useLeague } from '../../contexts/LeagueContext';
import { useAuth } from '../../lib/auth';
import { supabase } from '../../lib/supabase';
import { useThemeColor } from '../../hooks/useThemeColor';
import { useOptions } from '../../lib/options';
import { ThemedView } from '../../components/ThemedView';
import { ThemedText } from '../../components/ThemedText';
import { RapidScrollBar } from '../../components/league/RapidScrollBar';
import { MonthSelectModal } from '../../components/archive/MonthSelectModal';
import type { StandingRow, Timeframe, League } from '../../hooks/useLeagueData';
import { TrophyPopup } from '../../components/league/TrophyPopup';

const StyledView = styled(View);
const StyledTouchableOpacity = styled(TouchableOpacity);
const StyledScrollView = styled(ScrollView);

// Prevent device text scaling from affecting league tables
// (league layout is tightly constrained and can't accommodate larger text)
// This is set globally — it affects ALL Text in the app after this module loads.
// However since league.tsx is a tab that's always loaded, this is fine.
if (!(Text as any).defaultProps) (Text as any).defaultProps = {};
(Text as any).defaultProps.allowFontScaling = false;

const WelcomeHamster = require('../../assets/ui/webp_assets/Win-Hamster-Blue.webp');

// Ordinal helper: 1 → "1st", 2 → "2nd", 3 → "3rd", etc.
function getOrdinal(n: number): string {
    const s = ['th', 'st', 'nd', 'rd'];
    const v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

// ─── RankArrow ─────────────────────────────────────────────────────────

function RankArrow({ yesterdaysRank, currentRank }: { yesterdaysRank: number | null; currentRank: number | null }) {
    if (currentRank == null || yesterdaysRank == null) {
        return <View style={{ width: 36 }} />;
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
                        minWidth: tabWidth > 0 ? tabWidth : undefined,
                        alignItems: 'center',
                        justifyContent: 'center',
                        paddingHorizontal: 12,
                        paddingVertical: 5,
                        borderRadius: 18,
                        zIndex: 1,
                    }}
                    onPress={() => onSelect(tf)}
                >
                    <Text numberOfLines={1} style={{
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

function GhostRow({ row, position, isHistorical, isPerfectStreak, brandColor, awardMedal, onRankPress, onStatsPress, onNamePress, sizes }: { row: StandingRow; position: 'top' | 'bottom'; isHistorical?: boolean; isPerfectStreak?: boolean; brandColor?: string; awardMedal?: string; onRankPress?: () => void; onStatsPress?: () => void; onNamePress?: () => void; sizes?: { rowFont: number; subFont: number; pW: number; winW: number; avgW: number; ratingW: number; streakFont: number } }) {
    const sz = sizes ?? { rowFont: 14, subFont: 10, pW: 36, winW: 42, avgW: 36, ratingW: 48, streakFont: 12 };
    const textColor = useThemeColor({}, 'text');
    const ghostBg = useThemeColor({ light: '#dbeafe', dark: '#1e3a5f' }, 'surface');

    const borderStyle = position === 'top'
        ? { borderBottomWidth: 2, borderBottomColor: '#3b82f6' }
        : { borderTopWidth: 2, borderTopColor: '#3b82f6' };

    const isUnranked = row.is_unranked === true;
    const medalEmoji = awardMedal === 'gold' ? '🥇' : awardMedal === 'silver' ? '🥈' : awardMedal === 'bronze' ? '🥉' : null;

    return (
        <StyledView
            className="flex-row items-center px-3 py-3"
            style={{ ...borderStyle, backgroundColor: ghostBg }}
        >
            <Pressable onPress={onRankPress} style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text style={{ width: 28, textAlign: 'center', fontSize: sz.rowFont, fontWeight: '700', fontFamily: 'Nunito_700Bold', color: textColor }}>{isUnranked ? '-' : medalEmoji ?? row.rank}</Text>
                <RankArrow yesterdaysRank={row.yesterdays_rank} currentRank={row.rank} />
            </Pressable>
            <Pressable onPress={onNamePress} style={{ flex: 1, paddingHorizontal: 4 }}>
                <Text style={{ fontSize: sz.rowFont, fontFamily: 'Nunito_700Bold', fontWeight: '700', color: '#1d4ed8' }}>
                    {row.league_nickname || row.global_display_name} ★
                </Text>
                <Text style={{ fontSize: sz.subFont, fontFamily: 'Nunito_400Regular', color: '#94a3b8' }}>
                    {row.global_display_name} {row.global_tag}
                </Text>
            </Pressable>
            <Pressable onPress={onStatsPress} style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text style={{ width: sz.pW, textAlign: 'center', fontSize: sz.rowFont, fontFamily: isPerfectStreak ? 'Nunito_700Bold' : 'Nunito_600SemiBold', fontWeight: isPerfectStreak ? '700' : undefined, color: isPerfectStreak ? (brandColor || '#8E57DB') : textColor }}>{isPerfectStreak ? (
                    <View style={{ backgroundColor: brandColor || '#8E57DB', borderRadius: 10, paddingHorizontal: 6, paddingVertical: 1, alignItems: 'center', justifyContent: 'center' }}>
                        <Text style={{ fontSize: sz.streakFont, fontFamily: 'Nunito_700Bold', fontWeight: '700', color: '#ffffff' }}>{row.games_played}</Text>
                    </View>
                ) : row.games_played}</Text>
                <Text style={{ width: sz.winW, textAlign: 'center', fontSize: sz.rowFont, fontFamily: 'Nunito_600SemiBold', color: textColor }}>{isUnranked ? '-' : `${row.win_rate}%`}</Text>
                <Text style={{ width: sz.avgW, textAlign: 'center', fontSize: sz.rowFont, fontFamily: 'Nunito_600SemiBold', color: textColor }}>{isUnranked ? '-' : row.avg_guesses}</Text>
                <Text style={{ width: sz.ratingW, textAlign: 'center', fontSize: sz.rowFont, fontWeight: '700', fontFamily: 'Nunito_700Bold', color: '#b45309' }}>
                    {isUnranked ? '-' : row.elementle_rating}
                </Text>
            </Pressable>
        </StyledView>
    );
}

// ─── LeagueTableRow ────────────────────────────────────────────────────

function LeagueTableRow({ row, isEven, isGlowing, glowAnim, gameMode, isHistorical, isPerfectStreak, brandColor, isLiveView, awardMedal, onRankPress, onStatsPress, onNamePress, sizes }: { row: StandingRow; isEven: boolean; isGlowing?: boolean; glowAnim?: Animated.Value; gameMode?: string; isHistorical?: boolean; isPerfectStreak?: boolean; brandColor?: string; isLiveView?: boolean; awardMedal?: string; onRankPress?: () => void; onStatsPress?: () => void; onNamePress?: () => void; sizes?: { rowFont: number; subFont: number; pW: number; winW: number; avgW: number; ratingW: number; streakFont: number } }) {
    const sz = sizes ?? { rowFont: 14, subFont: 10, pW: 36, winW: 42, avgW: 36, ratingW: 48, streakFont: 12 };
    const textColor = useThemeColor({}, 'text');
    const secondaryText = useThemeColor({}, 'icon');
    const bgEven = useThemeColor({ light: '#f8fafc', dark: '#1e293b' }, 'surface');
    const bgOdd = useThemeColor({ light: '#ffffff', dark: '#0f172a' }, 'background');

    // Light purple highlight for the user's own row (both called unconditionally to satisfy Rules of Hooks)
    const myRowBgUser = useThemeColor({ light: '#f3e8f9', dark: '#2d1f3d' }, 'surface');   // lighter shade of #B278CD
    const myRowBgRegion = useThemeColor({ light: '#ede5f7', dark: '#261e3d' }, 'surface');  // lighter shade of #8E57DB
    const myRowBg = gameMode === 'user' ? myRowBgUser : myRowBgRegion;

    const rowBg = row.is_me ? myRowBg : (isEven ? bgEven : bgOdd);
    const isUnranked = row.is_unranked === true;
    const medalEmoji = awardMedal === 'gold' ? '🥇' : awardMedal === 'silver' ? '🥈' : awardMedal === 'bronze' ? '🥉' : null;

    // Left side content: rank + arrows
    const leftContent = (
        <>
            <Text style={{ width: 28, textAlign: 'center', fontSize: sz.rowFont, fontWeight: '700', fontFamily: 'Nunito_700Bold', color: textColor }}>
                {isUnranked ? '-' : medalEmoji ?? row.rank}
            </Text>
            <RankArrow yesterdaysRank={row.yesterdays_rank} currentRank={row.rank} />
        </>
    );

    // Right side content: P, Win%, Avg, Rating
    const rightContent = (
        <>
            {isPerfectStreak ? (
                <View style={{ width: sz.pW, alignItems: 'center', justifyContent: 'center' }}>
                    <View style={{ backgroundColor: brandColor || '#8E57DB', borderRadius: 10, paddingHorizontal: 6, paddingVertical: 1, alignItems: 'center', justifyContent: 'center' }}>
                        <Text style={{ fontSize: sz.streakFont, fontFamily: 'Nunito_700Bold', fontWeight: '700', color: '#ffffff' }}>{row.games_played}</Text>
                    </View>
                </View>
            ) : (
                <Text style={{ width: sz.pW, textAlign: 'center', fontSize: sz.rowFont, fontFamily: 'Nunito_600SemiBold', color: secondaryText }}>{row.games_played}</Text>
            )}
            <Text style={{ width: sz.winW, textAlign: 'center', fontSize: sz.rowFont, fontFamily: 'Nunito_600SemiBold', color: secondaryText }}>{isUnranked ? '-' : `${row.win_rate}%`}</Text>
            <Text style={{ width: sz.avgW, textAlign: 'center', fontSize: sz.rowFont, fontFamily: 'Nunito_600SemiBold', color: secondaryText }}>{isUnranked ? '-' : row.avg_guesses}</Text>
            <Text style={{ width: sz.ratingW, textAlign: 'center', fontSize: sz.rowFont, fontWeight: '700', fontFamily: 'Nunito_700Bold', color: '#b45309' }}>
                {isUnranked ? '-' : row.elementle_rating}
            </Text>
        </>
    );

    return (
        <Animated.View
            style={[
                { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10 },
                { backgroundColor: rowBg, opacity: isUnranked ? 0.6 : 1 },
                isGlowing && glowAnim ? {
                    borderWidth: 2,
                    borderColor: '#f59e0b',
                    borderRadius: 8,
                    shadowColor: '#f59e0b',
                    shadowOffset: { width: 0, height: 0 },
                    shadowRadius: 8,
                    elevation: 6,
                    shadowOpacity: glowAnim as any,
                } : {},
            ]}
        >
            {/* Left: rank + arrows — Pressable for own row */}
            {row.is_me && onRankPress ? (
                <Pressable onPress={onRankPress} style={{ flexDirection: 'row', alignItems: 'center' }}>
                    {leftContent}
                </Pressable>
            ) : (
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    {leftContent}
                </View>
            )}
            {/* Name — Pressable for own row */}
            {row.is_me && onNamePress ? (
                <Pressable onPress={onNamePress} style={{ flex: 1, paddingHorizontal: 4 }}>
                    <Text
                        style={{
                            fontSize: sz.rowFont,
                            fontFamily: 'Nunito_700Bold',
                            fontWeight: '700',
                            color: '#1d4ed8',
                        }}
                        numberOfLines={1}
                    >
                        {row.league_nickname || row.global_display_name} ★
                    </Text>
                    <Text style={{ fontSize: sz.subFont, fontFamily: 'Nunito_400Regular', color: '#94a3b8' }} numberOfLines={1}>
                        {row.global_display_name} {row.global_tag}
                    </Text>
                </Pressable>
            ) : (
                <StyledView className="flex-1 px-1">
                    <Text
                        style={{
                            fontSize: sz.rowFont,
                            fontFamily: row.is_me ? 'Nunito_700Bold' : 'Nunito_600SemiBold',
                            fontWeight: row.is_me ? '700' : '500',
                            color: row.is_me ? '#1d4ed8' : textColor,
                        }}
                        numberOfLines={1}
                    >
                        {row.league_nickname || row.global_display_name}{row.is_me ? ' ★' : ''}
                    </Text>
                    <Text style={{ fontSize: sz.subFont, fontFamily: 'Nunito_400Regular', color: '#94a3b8' }} numberOfLines={1}>
                        {row.global_display_name} {row.global_tag}
                    </Text>
                </StyledView>
            )}
            {/* Right: stats — Pressable for own row */}
            {row.is_me && onStatsPress ? (
                <Pressable onPress={onStatsPress} style={{ flexDirection: 'row', alignItems: 'center' }}>
                    {rightContent}
                </Pressable>
            ) : (
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    {rightContent}
                </View>
            )}
        </Animated.View>
    );
}

// ─── Column Header Row ─────────────────────────────────────────────────

function ColumnHeaders({
    borderColor,
    iconColor,
    onStatInfo,
    sizes,
}: {
    borderColor: string;
    iconColor: string;
    onStatInfo?: (type: string) => void;
    sizes?: { headerFont: number; pW: number; winW: number; avgW: number; ratingW: number };
}) {
    const sz = sizes ?? { headerFont: 12, pW: 36, winW: 42, avgW: 36, ratingW: 48 };
    return (
        <StyledView
            className="flex-row items-center px-3 py-2"
            style={{ borderBottomWidth: 1, borderBottomColor: borderColor }}
        >
            <TouchableOpacity onPress={() => onStatInfo?.('rank')} style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text style={{ width: 28, textAlign: 'center', fontSize: sz.headerFont, fontFamily: 'Nunito_600SemiBold', color: iconColor }}>#</Text>
                <Text style={{ width: 36, textAlign: 'center', fontSize: sz.headerFont, fontFamily: 'Nunito_600SemiBold', color: iconColor }}>▲▼</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => onStatInfo?.('name')} style={{ flex: 1 }}>
                <Text style={{ fontSize: sz.headerFont, fontFamily: 'Nunito_600SemiBold', color: iconColor }}>Name</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => onStatInfo?.('stats')} style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text style={{ width: sz.pW, textAlign: 'center', fontSize: sz.headerFont, fontFamily: 'Nunito_600SemiBold', color: iconColor }}>P</Text>
                <Text style={{ width: sz.winW, textAlign: 'center', fontSize: sz.headerFont, fontFamily: 'Nunito_600SemiBold', color: iconColor }}>Win%</Text>
                <Text style={{ width: sz.avgW, textAlign: 'center', fontSize: sz.headerFont, fontFamily: 'Nunito_600SemiBold', color: iconColor }}>Avg</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => onStatInfo?.('rating')} style={{ width: sz.ratingW, alignItems: 'center' }}>
                <Text style={{ textAlign: 'center', fontSize: sz.headerFont, fontFamily: 'Nunito_600SemiBold', color: '#b45309' }}>Rating</Text>
            </TouchableOpacity>
        </StyledView>
    );
}

// ─── AnimatedEntryRow (per-row mount animation) ───────────────────────

const AnimatedEntryRow = React.memo(({ children, index, startTime }: {
    children: React.ReactNode;
    index: number;
    startTime: number;
}) => {
    const anim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        // Calculate remaining delay relative to the global animation start time
        const elapsed = Date.now() - startTime;
        const targetDelay = index * 60; // 60ms stagger per row
        const remainingDelay = Math.max(0, targetDelay - elapsed);

        Animated.timing(anim, {
            toValue: 1,
            duration: 300,
            delay: remainingDelay,
            useNativeDriver: true,
        }).start();
    }, []);

    return (
        <Animated.View style={{
            opacity: anim,
            transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [40, 0] }) }],
        }}>
            {children}
        </Animated.View>
    );
});

// ─── Main League Screen ────────────────────────────────────────────────

export default function LeagueScreen({ gameMode = 'region' as GameMode }: { gameMode?: GameMode }) {
    const { width: screenWidth } = useWindowDimensions();
    const queryClient = useQueryClient();
    const { user } = useAuth();
    const router = useRouter();

    // Theme colors
    const backgroundColor = useThemeColor({}, 'background');
    const surfaceColor = useThemeColor({}, 'surface');
    const borderColor = useThemeColor({}, 'border');
    const textColor = useThemeColor({}, 'text');
    const iconColor = useThemeColor({}, 'icon');

    const { darkMode, textSize } = useOptions();
    const isLargeText = textSize === 'large';

    // Dynamic text sizes and column widths for league table
    const leagueSizes = useMemo(() => {
        if (textSize === 'small') return { rowFont: 13, subFont: 9, headerFont: 11, pW: 34, winW: 40, avgW: 34, ratingW: 46, streakFont: 11 };
        if (textSize === 'large') return { rowFont: 15, subFont: 11, headerFont: 13, pW: 38, winW: 46, avgW: 38, ratingW: 50, streakFont: 13 };
        return { rowFont: 14, subFont: 10, headerFont: 12, pW: 36, winW: 42, avgW: 36, ratingW: 48, streakFont: 12 }; // medium (default)
    }, [textSize]);
    const { selectedLeagueId, setSelectedLeagueId, selectedTimeframe, setSelectedTimeframe, consumeNewlyJoinedLeagueId } = useLeague();

    // ── Glow animation for newly joined league ──
    const [glowLeagueId, setGlowLeagueId] = useState<string | null>(null);
    const glowAnim = useRef(new Animated.Value(0)).current;
    const leaguePillsScrollRef = useRef<ScrollView>(null);
    const leagueFlatListRef = useRef<FlatList>(null);
    const shouldScrollToUserRef = useRef(false);
    const ESTIMATED_ROW_HEIGHT = 52; // paddingVertical:10 * 2 + name text + subtitle

    useEffect(() => {
        const newLeagueId = consumeNewlyJoinedLeagueId();
        if (newLeagueId) {
            console.log('[League] Newly joined league detected, activating glow:', newLeagueId);
            setGlowLeagueId(newLeagueId);
            setSelectedLeagueId(newLeagueId);
            shouldScrollToUserRef.current = true;

            // Auto-scroll league pills to show the new league (likely at the end)
            setTimeout(() => {
                leaguePillsScrollRef.current?.scrollToEnd({ animated: true });
            }, 300);

            // Pulsing glow animation: 0 → 1 → 0 repeated for 4 seconds
            const pulse = Animated.loop(
                Animated.sequence([
                    Animated.timing(glowAnim, { toValue: 1, duration: 600, useNativeDriver: false }),
                    Animated.timing(glowAnim, { toValue: 0.2, duration: 600, useNativeDriver: false }),
                ])
            );
            pulse.start();

            // Stop glow after 4 seconds, then scroll to top of the league
            const timer = setTimeout(() => {
                pulse.stop();
                Animated.timing(glowAnim, { toValue: 0, duration: 300, useNativeDriver: false }).start(() => {
                    setGlowLeagueId(null);

                    // Animate scroll to top of the league list
                    leagueFlatListRef.current?.scrollToOffset({ offset: 0, animated: true });
                });
            }, 4000);

            return () => {
                clearTimeout(timer);
                pulse.stop();
            };
        }
    }, []);

    const { data: leagues, isLoading: leaguesLoading, refetch: refetchLeagues } = useMyLeagues(gameMode);

    // ── Snapshot date navigation state ──
    // null = live view, string = 'YYYY-MM-DD' snapshot date
    const [snapshotDate, setSnapshotDate] = useState<string | null>(null);

    const { data: snapshotRange } = useLeagueSnapshotRange(selectedLeagueId, selectedTimeframe, gameMode);

    const { data: standings, isLoading: standingsLoading, refetch: refetchStandings } = useLeagueStandings(
        selectedLeagueId,
        selectedTimeframe,
        gameMode,
        snapshotDate
    );
    const { data: membership } = useMyMembership(selectedLeagueId);
    const { data: allLeaguesData } = useMyLeaguesAll();

    // ── League tab ordering from AsyncStorage ──
    const [savedLeagueOrder, setSavedLeagueOrder] = useState<string[]>([]);
    const orderLoadedRef = useRef(false);

    useFocusEffect(
        useCallback(() => {
            if (!user?.id) return;
            // Local cache first
            AsyncStorage.getItem(`league_order_${user.id}`).then(saved => {
                if (saved) {
                    try { setSavedLeagueOrder(JSON.parse(saved)); } catch { }
                }
                orderLoadedRef.current = true;
            }).catch(() => { orderLoadedRef.current = true; });
            // Cloud sync
            supabase.from('user_settings')
                .select('league_order')
                .eq('user_id', user.id)
                .maybeSingle()
                .then(({ data }) => {
                    if ((data as any)?.league_order) {
                        const cloudOrder = (data as any).league_order as string[];
                        setSavedLeagueOrder(cloudOrder);
                        AsyncStorage.setItem(`league_order_${user.id}`, JSON.stringify(cloudOrder)).catch(() => { });
                    }
                });
        }, [user?.id])
    );

    // Sort league tabs by saved order
    const sortedLeagues = useMemo(() => {
        if (!leagues || leagues.length === 0) return leagues;
        if (savedLeagueOrder.length === 0) return leagues;
        return [...(leagues as League[])].sort((a, b) => {
            const idxA = savedLeagueOrder.indexOf(a.id);
            const idxB = savedLeagueOrder.indexOf(b.id);
            return (idxA === -1 ? 999 : idxA) - (idxB === -1 ? 999 : idxB);
        });
    }, [leagues, savedLeagueOrder]);

    // ── State persistence (save on blur, restore on focus) ──
    const stateRestoredRef = useRef(false);


    // Save state when screen loses focus, refetch + validate on focus
    useFocusEffect(
        useCallback(() => {
            // Screen gained focus — refresh league list (picks up reordering from Manage Leagues)
            refetchLeagues();

            // Check if the saved state was cleared (e.g. user left a league in Manage Leagues)
            // If so, reset to first league / current month
            if (user?.id) {
                AsyncStorage.getItem(`league_screen_state_${user.id}_${gameMode}`).then(saved => {
                    if (!saved) {
                        // State was cleared — reset to defaults
                        setSelectedLeagueId(null);
                        setSnapshotDate(null);
                        setSelectedTimeframe('mtd');
                    }
                }).catch(() => { });
            }

            return () => {
                // Cleanup = screen blurred
                if (user?.id && selectedLeagueId) {
                    const state = {
                        selectedLeagueId,
                        selectedTimeframe,
                        snapshotDate,
                        timestamp: Date.now(),
                        day: new Date().toISOString().split('T')[0],
                    };
                    AsyncStorage.setItem(`league_screen_state_${user.id}_${gameMode}`, JSON.stringify(state)).catch(() => { });
                }
            };
        }, [user?.id, selectedLeagueId, selectedTimeframe, snapshotDate])
    );

    // ── Fresh-load detection for row animation ──
    // true = fresh open (animate rows), false = returning within session (instant)
    const shouldAnimateRowsRef = useRef(true);  // default: yes, animate
    const animStartTimeRef = useRef(0); // Global start timestamp for stagger calculation

    // Restore state on mount (or reset if > 30 min)
    useEffect(() => {
        if (!user?.id || stateRestoredRef.current || !orderLoadedRef.current) return;
        stateRestoredRef.current = true;
        AsyncStorage.getItem(`league_screen_state_${user.id}_${gameMode}`).then(saved => {
            if (!saved) {
                shouldAnimateRowsRef.current = true; // No saved state = fresh load
                return;
            }
            try {
                const state = JSON.parse(saved);
                const elapsed = Date.now() - (state.timestamp || 0);
                const THIRTY_MINUTES = 30 * 60 * 1000;
                const savedDay = state.day || '';
                const todayDay = new Date().toISOString().split('T')[0];
                if (elapsed < THIRTY_MINUTES && savedDay === todayDay) {
                    // Returning within session — skip animation
                    shouldAnimateRowsRef.current = false;
                    if (state.selectedLeagueId) setSelectedLeagueId(state.selectedLeagueId);
                    if (state.selectedTimeframe) setSelectedTimeframe(state.selectedTimeframe);
                    if (state.snapshotDate !== undefined) setSnapshotDate(state.snapshotDate ?? null);
                } else {
                    // Expired — treat as fresh load
                    shouldAnimateRowsRef.current = true;
                    setSelectedTimeframe('mtd');
                    setSnapshotDate(null);
                }
            } catch { }
        }).catch(() => { });
    }, [user?.id, orderLoadedRef.current]);

    // Determine the currently selected league object
    const selectedLeague = useMemo(() => {
        if (!leagues || !selectedLeagueId) return null;
        return (leagues as League[]).find(l => l.id === selectedLeagueId) ?? null;
    }, [leagues, selectedLeagueId]);

    // Share permission: system leagues always shareable, admin always can share,
    // other members need can_share flag set to true
    const canShare = useMemo(() => {
        if (!selectedLeague) return false;
        if (selectedLeague.is_system_league) return true;
        // Admin always has share permission regardless of toggle setting
        if (selectedLeague.admin_user_id === user?.id) return true;
        // Primary: from dedicated membership query
        if (membership?.can_share === true) return true;
        // Fallback: from the all-leagues query (LeagueWithMembership includes can_share)
        const allLeagueMatch = allLeaguesData?.find(l => l.id === selectedLeagueId);
        return allLeagueMatch?.can_share === true;
    }, [selectedLeague, membership, allLeaguesData, selectedLeagueId, user?.id]);

    const [refreshing, setRefreshing] = useState(false);
    const [statTooltipType, setStatTooltipType] = useState<string | null>(null);
    const [monthPickerVisible, setMonthPickerVisible] = useState(false);
    const [showTrophyPopup, setShowTrophyPopup] = useState(false);
    const scrollY = useRef(new Animated.Value(0)).current;
    const [listContainerHeight, setListContainerHeight] = useState(0);
    const [listContentHeight, setListContentHeight] = useState(0);
    const insets = useSafeAreaInsets();

    // Brand color for header
    const brandColor = gameMode === 'region' ? '#8E57DB' : '#B278CD';

    // ── Awards / Trophies ──
    const { data: myAwards } = useMyAwards();
    const hasTrophiesForLeague = useMemo(() => {
        if (!myAwards?.medals || !selectedLeagueId) return false;
        return myAwards.medals.some(m => m.league_id === selectedLeagueId && m.timeframe === selectedTimeframe && m.game_mode === gameMode);
    }, [myAwards, selectedLeagueId, selectedTimeframe, gameMode]);

    // ── Snapshot-based date navigation ──
    const isLiveView = snapshotDate === null;
    const newestSnapshotDate = snapshotRange?.newest_date ?? null;
    const oldestSnapshotDate = snapshotRange?.oldest_date ?? null;

    // Effective data (must come before isGapDay)
    const effectiveStandings = standings;
    const effectiveLoading = standingsLoading;

    // Display period formatted (for live view month label — must come before dateDisplayLabel)
    const currentPeriodLabel = getCurrentPeriodLabel(selectedTimeframe);
    const displayPeriodFormatted = formatPeriodLabel(currentPeriodLabel, selectedTimeframe);

    // Can navigate older: back to league created_at date
    const leagueCreatedAt = snapshotRange?.league_created_at ?? null;
    const canGoOlder = (() => {
        if (isLiveView) return true; // Can always go back from live
        if (!isLiveView && snapshotDate && leagueCreatedAt && snapshotDate > leagueCreatedAt) return true;
        return false;
    })();

    // Can navigate newer if we're on a snapshot (not live)
    const canGoNewer = !isLiveView;

    // Is gap day: navigated to a date that has no snapshot data
    const isGapDay = !isLiveView && standings && effectiveStandings?.standings?.length === 0;

    // Format next snapshot time for gap-day message
    const gapDayLocalTime = useMemo(() => {
        if (!snapshotRange?.next_snapshot_utc) return null;
        const utcDate = new Date(snapshotRange.next_snapshot_utc);
        return utcDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }, [snapshotRange?.next_snapshot_utc]);

    // Date navigation handlers
    const handleDatePrev = () => {
        // Get yesterday's date — today should always be live, never a snapshot
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toISOString().split('T')[0];

        if (isLiveView) {
            // From live → always go to yesterday (never today's snapshot)
            setSnapshotDate(yesterdayStr);
        } else if (snapshotDate && leagueCreatedAt) {
            const d = new Date(snapshotDate);
            d.setDate(d.getDate() - 1);
            const newDate = d.toISOString().split('T')[0];
            if (newDate >= leagueCreatedAt) {
                setSnapshotDate(newDate);
            }
        }
    };

    const handleDateNext = () => {
        if (!isLiveView && snapshotDate) {
            // Get yesterday's date — if we're at or past yesterday, go live
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);
            const yesterdayStr = yesterday.toISOString().split('T')[0];

            if (snapshotDate >= yesterdayStr) {
                // At or past yesterday → go live
                setSnapshotDate(null);
            } else {
                const d = new Date(snapshotDate);
                d.setDate(d.getDate() + 1);
                const newDate = d.toISOString().split('T')[0];
                if (newDate >= yesterdayStr) {
                    // Would reach yesterday → check if yesterday has data, else go live
                    setSnapshotDate(yesterdayStr);
                } else {
                    setSnapshotDate(newDate);
                }
            }
        }
    };

    // Display label for the date picker
    const dateDisplayLabel = useMemo(() => {
        if (isLiveView) {
            // Show "9 March 2026" style for live view (includes today's date)
            const now = new Date();
            const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
            return `${now.getDate()} ${months[now.getMonth()]} ${now.getFullYear()}`;
        }
        // Snapshot: show as "DD Mon YYYY"
        if (snapshotDate) {
            const d = new Date(snapshotDate + 'T12:00:00');
            const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
            return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
        }
        return displayPeriodFormatted;
    }, [isLiveView, snapshotDate, displayPeriodFormatted]);

    // Reset snapshot date when league changes
    useEffect(() => {
        setSnapshotDate(null);
    }, [selectedLeagueId]);

    // Background: snapshot = grey, live = transparent
    const isSnapshotMode = !isLiveView;
    const historicalBg = darkMode ? '#1a2332' : '#f0f0f0';
    const normalBg = 'transparent';
    const tableContainerBg = isSnapshotMode ? historicalBg : normalBg;

    // Stat tooltip descriptions
    const statDescriptions: Record<string, { title: string; body: string | null }> = {
        stats: { title: 'Game Statistics', body: null }, // Uses custom JSX render
        rating: { title: 'Elementle Rating', body: 'A comprehensive measure of your puzzle-solving skill, factoring in your win rate, average guesses, and first guess accuracy.' },
        rank: { title: 'Rank & Movement', body: null }, // Uses custom JSX render
        name: { title: 'Player Identity', body: null }, // Uses custom JSX render
    };

    // Compute day-of-period for perfect streak detection
    const dayOfPeriod = useMemo(() => {
        const now = new Date();
        if (selectedTimeframe === 'mtd') {
            return now.getDate(); // day of month (1-31)
        } else {
            // day of year
            const start = new Date(now.getFullYear(), 0, 0);
            const diff = now.getTime() - start.getTime();
            return Math.floor(diff / (1000 * 60 * 60 * 24));
        }
    }, [selectedTimeframe]);

    // Helper to check if a row has a perfect streak
    const isPerfectStreak = useCallback((row: StandingRow): boolean => {
        if (row.is_unranked || row.current_streak == null || row.games_played == null) return false;
        // Perfect if streak covers all days so far (including today not yet played)
        return row.current_streak >= dayOfPeriod || (row.current_streak >= dayOfPeriod - 1 && row.games_played >= dayOfPeriod - 1);
    }, [dayOfPeriod]);

    // ── Award medals: show 🥇🥈🥉 on last day of month/year snapshots ──
    // When viewing the last day of a period, ranks 1-3 get medal icons
    const isAwardDate = useMemo((): boolean => {
        if (!snapshotDate) return false;
        const d = new Date(snapshotDate + 'T12:00:00');
        const day = d.getDate();
        const month = d.getMonth();
        const year = d.getFullYear();

        if (selectedTimeframe === 'mtd') {
            // Last day of the month
            const lastDayOfMonth = new Date(year, month + 1, 0).getDate();
            return day === lastDayOfMonth;
        } else if (selectedTimeframe === 'ytd') {
            // Last day of the year (Dec 31)
            return month === 11 && day === 31;
        }
        return false;
    }, [snapshotDate, selectedTimeframe]);

    // Helper: get medal string for a rank on award dates
    const getMedalForRank = useCallback((rank: number | null): string | undefined => {
        if (!isAwardDate || rank === null) return undefined;
        if (rank === 1) return 'gold';
        if (rank === 2) return 'silver';
        if (rank === 3) return 'bronze';
        return undefined;
    }, [isAwardDate]);

    // ── Smart Ghost Row state ──
    const [myRowVisible, setMyRowVisible] = useState(false);
    // Track the range of visible item indices to determine ghost position
    const visibleRangeRef = useRef<{ first: number; last: number }>({ first: 0, last: 0 });


    // Auto-select first league (using sorted order)
    useEffect(() => {
        if (sortedLeagues && sortedLeagues.length > 0 && !selectedLeagueId) {
            setSelectedLeagueId(sortedLeagues[0].id);
        }
    }, [sortedLeagues, selectedLeagueId]);



    const onRefresh = async () => {
        setRefreshing(true);
        await Promise.all([refetchLeagues(), refetchStandings()]);
        setRefreshing(false);
    };

    // ── Share handler ──
    const handleShare = useCallback(async () => {
        if (!selectedLeague || !effectiveStandings) return;
        try {
            let shareText = '';

            if (selectedLeague.is_system_league) {
                // System league: share ranking
                const rank = effectiveStandings.my_rank;
                const total = effectiveStandings.total_members;
                const leagueName = selectedLeague.system_region === 'GLOBAL' ? 'Global' : (selectedLeague.system_region || 'Global');
                const periodType = selectedTimeframe === 'mtd' ? 'month' : 'year';

                if (rank && total) {
                    const ordinal = getOrdinal(rank);
                    if (!isLiveView) {
                        // Past snapshot
                        shareText = `I was ${ordinal} of ${total.toLocaleString()} players in the ${leagueName} game!`;
                    } else {
                        // Current period
                        shareText = `I'm currently ${ordinal} of ${total.toLocaleString()} players this ${periodType} in the ${leagueName} game!`;
                    }
                } else {
                    shareText = `Check out my ${leagueName} league standings on Elementle!`;
                }

                shareText += '\n\nElementle is a free daily puzzle game where you guess historical dates.';
                shareText += '\n\nTap this link to join: https://elementle.tech';
            } else {
                // User-created league: share join link
                const isAdmin = selectedLeague.admin_user_id === user?.id;
                const leagueName = selectedLeague.name;

                if (isAdmin) {
                    shareText = `Join my Elementle league - "${leagueName}"!`;
                } else {
                    shareText = `Join the Elementle league I'm in - "${leagueName}"!`;
                }

                shareText += '\n\nElementle is a free daily puzzle game where you guess historical dates.';

                if (selectedLeague.join_code) {
                    shareText += `\n\nJoin code: ${selectedLeague.join_code}`;
                    shareText += `\n\nOr tap this link to join:\nhttps://elementle.tech/league/join/${selectedLeague.join_code}`;
                }
            }

            await Share.share({ message: shareText });
        } catch (e) {
            console.error('[League] Share error:', e);
        }
    }, [selectedLeague, effectiveStandings, selectedTimeframe, isLiveView, user]);

    const myRow = effectiveStandings?.standings?.find((s: StandingRow) => s.is_me);
    const minGamesThreshold = effectiveStandings?.min_games_threshold ?? 5;

    // Build display rows: insert a divider between ranked and unranked sections
    type DividerItem = { _type: 'divider'; user_id: string; threshold: number };
    type ListItem = StandingRow | DividerItem;

    const allRows: ListItem[] = useMemo(() => {
        const standings = effectiveStandings?.standings ?? [];
        if (standings.length === 0) return [];

        const ranked = standings.filter(r => !r.is_unranked);
        const unranked = standings.filter(r => r.is_unranked);

        if (unranked.length === 0) return ranked;

        const result: ListItem[] = [...ranked];
        result.push({ _type: 'divider', user_id: '__divider__', threshold: minGamesThreshold });
        result.push(...unranked);
        return result;
    }, [effectiveStandings, minGamesThreshold]);
    const listFitsOnScreen = listContentHeight > 0 && listContentHeight <= listContainerHeight;

    // Scroll to user's row when data loads after joining a league
    useEffect(() => {
        if (shouldScrollToUserRef.current && allRows.length > 0 && leagueFlatListRef.current) {
            const userIndex = allRows.findIndex((r) => !('_type' in r) && r.is_me);
            if (userIndex >= 0) {
                shouldScrollToUserRef.current = false;
                // Use scrollToOffset to avoid "scrollToIndex out of range" crash
                // when FlatList hasn't rendered the target item yet
                const listHeight = listContainerHeight || 400;
                const targetOffset = Math.max(0, (userIndex * ESTIMATED_ROW_HEIGHT) - (listHeight / 2) + (ESTIMATED_ROW_HEIGHT / 2));
                setTimeout(() => {
                    leagueFlatListRef.current?.scrollToOffset({
                        offset: targetOffset,
                        animated: true,
                    });
                }, 300);
            }
        }
    }, [allRows]);

    // ── Row entry animation trigger ──
    useEffect(() => {
        if (!shouldAnimateRowsRef.current) return;
        if (allRows.length === 0) return;
        if (animStartTimeRef.current > 0) return; // Already started

        // Record start time — each AnimatedEntryRow calculates its own delay from this
        animStartTimeRef.current = Date.now();

        // Auto-disable animation after the window closes (60ms × rows + 300ms duration + buffer)
        const totalMs = Math.min(allRows.length * 60 + 500, 5000);
        const timer = setTimeout(() => {
            shouldAnimateRowsRef.current = false;
            animStartTimeRef.current = 0;
        }, totalMs);
        return () => clearTimeout(timer);
    }, [allRows]);

    // ── Snapshot preloading ──
    const prefetchStartedRef = useRef(false);
    useEffect(() => {
        if (prefetchStartedRef.current) return;
        if (!leagues || (leagues as League[]).length === 0) return;
        prefetchStartedRef.current = true;
        // Run in background — no UI impact
        prefetchLeagueSnapshots(queryClient, leagues as League[], selectedTimeframe, gameMode).catch((e) =>
            console.warn('[LeaguePreload] Error:', e)
        );
    }, [leagues]);

    // Determine my row's index for viewability tracking
    const myRowIndex = useMemo(() => {
        if (!myRow) return -1;
        return allRows.findIndex((r) => !('_type' in r) && r.user_id === myRow.user_id);
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

                    {/* Trophies pill (only if user has medals for this league) */}
                    {hasTrophiesForLeague && (
                        <TouchableOpacity
                            onPress={() => setShowTrophyPopup(true)}
                            activeOpacity={0.85}
                            style={{
                                position: 'absolute',
                                left: 16,
                                top: 54,
                                zIndex: 10,
                                flexDirection: 'row',
                                alignItems: 'center',
                                justifyContent: 'center',
                                backgroundColor: '#FFFFFF',
                                paddingHorizontal: 12,
                                paddingVertical: 8,
                                borderRadius: 9999,
                                gap: 5,
                                shadowColor: '#000',
                                shadowOffset: { width: 0, height: 2 },
                                shadowOpacity: 0.1,
                                shadowRadius: 4,
                                elevation: 2,
                            }}
                        >
                            <Trophy size={14} color={brandColor} />
                            <Text style={{ color: brandColor, fontSize: 13, fontFamily: 'Nunito_700Bold', fontWeight: '700' }}>Trophies</Text>
                        </TouchableOpacity>
                    )}

                    {screenWidth >= 768 ? (
                        <ThemedText className="font-n-bold text-white" size="3xl" style={{ color: '#FFFFFF' }}>
                            {gameMode === 'region' ? 'Global Game Leagues' : 'Personal Game Leagues'}
                        </ThemedText>
                    ) : (
                        <View style={{ alignItems: 'center' }}>
                            <ThemedText className="font-n-bold text-white" size="3xl" style={{ color: '#FFFFFF' }}>
                                {gameMode === 'region' ? 'Global Game' : 'Personal Game'}
                            </ThemedText>
                            <ThemedText className="font-n-bold text-white" size="3xl" style={{ color: '#FFFFFF', marginTop: -2 }}>
                                Leagues
                            </ThemedText>
                        </View>
                    )}

                    <View style={{ position: 'absolute', right: 10, top: 4, zIndex: 10, alignItems: 'center', gap: 6 }}>
                        <StyledTouchableOpacity
                            onPress={() => router.push({ pathname: '/league/manage', params: { mode: gameMode } })}
                            style={{ padding: 8 }}
                            hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
                        >
                            <Settings size={28} color="#FFFFFF" />
                        </StyledTouchableOpacity>

                        {canShare && (
                            <TouchableOpacity
                                onPress={handleShare}
                                activeOpacity={0.85}
                                style={{
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    backgroundColor: '#FFFFFF',
                                    paddingHorizontal: 14,
                                    paddingVertical: 8,
                                    borderRadius: 9999,
                                    gap: 6,
                                    shadowColor: '#000',
                                    shadowOffset: { width: 0, height: 2 },
                                    shadowOpacity: 0.1,
                                    shadowRadius: 4,
                                    elevation: 2,
                                }}
                            >
                                <Text style={{ color: brandColor, fontSize: 13, fontFamily: 'Nunito_700Bold', fontWeight: '700' }}>Share</Text>
                                <Share2 size={14} color={brandColor} />
                            </TouchableOpacity>
                        )}
                    </View>
                </View>
            </View>

            {/* ── OVERLAPPING CONTENT (below colored header) ── */}
            <View style={{ marginTop: -24, width: '100%', maxWidth: 768, alignSelf: 'center' }}>
                {/* ── DATE PICKER (Archive-style arrows) - overlaps header ── */}
                <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 24, gap: 12, marginBottom: 8 }}>
                    {/* Left (older) arrow */}
                    <StyledTouchableOpacity
                        onPress={handleDatePrev}
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

                    {/* Date / period label (tappable to open month picker) */}
                    <TouchableOpacity
                        onPress={() => setMonthPickerVisible(true)}
                        activeOpacity={0.7}
                        style={{
                            flex: 1,
                            backgroundColor: darkMode ? '#1e293b' : '#FFFFFF',
                            borderRadius: 24,
                            alignItems: 'center',
                            justifyContent: 'center',
                            height: 60,
                            shadowColor: '#000',
                            shadowOffset: { width: 0, height: 1 },
                            shadowOpacity: darkMode ? 0 : 0.05,
                            shadowRadius: 2,
                            elevation: darkMode ? 0 : 1,
                        }}
                    >
                        <ThemedText
                            style={{
                                fontSize: 20,
                                color: darkMode ? '#FFFFFF' : '#1e293b',
                            }}
                            className="font-n-bold"
                            numberOfLines={1}
                        >
                            {dateDisplayLabel}
                        </ThemedText>
                        {/* "Live" label below the date when in live mode */}
                        {isLiveView && (
                            <Text style={{
                                fontSize: 11,
                                fontFamily: 'Nunito_700Bold',
                                fontWeight: '700',
                                color: '#ef4444',
                                marginTop: 1,
                            }}>
                                ● Live
                            </Text>
                        )}
                    </TouchableOpacity>

                    {/* Right (newer) arrow */}
                    <StyledTouchableOpacity
                        onPress={handleDateNext}
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
                    ) : (sortedLeagues && sortedLeagues.length > 0) && (
                        <ScrollView
                            ref={leaguePillsScrollRef}
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            style={{ flex: 1 }}
                            contentContainerStyle={{ gap: 8, alignItems: 'center', paddingRight: 8 }}
                        >
                            {sortedLeagues.map((league: League) => {
                                const isActive = league.id === selectedLeagueId;
                                return (
                                    <TouchableOpacity
                                        key={league.id}
                                        style={[
                                            {
                                                paddingHorizontal: 16, paddingVertical: 7,
                                                borderRadius: 9999,
                                                backgroundColor: isActive ? brandColor : surfaceColor,
                                                borderWidth: isActive ? 0 : 1,
                                                borderColor: isActive ? 'transparent' : borderColor,
                                            },
                                            glowLeagueId === league.id ? {
                                                borderWidth: 2,
                                                borderColor: '#f59e0b',
                                                shadowColor: '#f59e0b',
                                                shadowOffset: { width: 0, height: 0 },
                                                shadowRadius: glowAnim.interpolate({ inputRange: [0, 1], outputRange: [4, 14] }) as any,
                                                shadowOpacity: glowAnim as any,
                                                elevation: 8,
                                            } : {},
                                        ]}
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
                    <ColumnHeaders borderColor={borderColor} iconColor={iconColor} onStatInfo={(type) => setStatTooltipType(type)} sizes={leagueSizes} />
                </View>
            </View>

            {/* ── SCROLLABLE LIST ── */}
            {
                effectiveLoading ? (
                    <ActivityIndicator style={{ marginTop: 40 }} color="#3b82f6" />
                ) : isGapDay ? (
                    (() => {
                        // Differentiate: dates at or before the newest snapshot with no data = "No snapshot available"
                        // (snapshot was taken, but no qualifying users due to 5-game minimum);
                        // dates beyond the newest snapshot = "Snapshot pending" (cron hasn't run yet)
                        const snapshotWasTaken = snapshotDate && newestSnapshotDate && snapshotDate <= newestSnapshotDate;
                        return (
                            <StyledView className="flex-1 justify-center items-center p-10" style={{ gap: 12, width: '100%', maxWidth: 768, alignSelf: 'center' }}>
                                <Image source={WelcomeHamster} style={{ width: 80, height: 80 }} contentFit="contain" />
                                {snapshotWasTaken ? (
                                    <>
                                        <ThemedText size="lg" className="font-n-bold text-center">No snapshot available</ThemedText>
                                        <ThemedText className="font-n-regular text-center" style={{ color: iconColor }}>
                                            Leagues data is only shown when users have played a minimum of {minGamesThreshold} games
                                        </ThemedText>
                                    </>
                                ) : (
                                    <>
                                        <ThemedText size="lg" className="font-n-bold text-center">Snapshot pending</ThemedText>
                                        <ThemedText className="font-n-regular text-center" style={{ color: iconColor }}>
                                            {gapDayLocalTime
                                                ? `Data for this date will be available at ${gapDayLocalTime}`
                                                : 'Data for this date is not yet available'}
                                        </ThemedText>
                                    </>
                                )}
                                <TouchableOpacity
                                    style={{
                                        paddingHorizontal: 24, paddingVertical: 12,
                                        borderRadius: 12, marginTop: 8,
                                        borderWidth: 1, borderColor: brandColor,
                                    }}
                                    onPress={() => setSnapshotDate(null)}
                                >
                                    <Text style={{ color: brandColor, fontWeight: '600', fontFamily: 'Nunito_600SemiBold', fontSize: 15 }}>
                                        Return to live
                                    </Text>
                                </TouchableOpacity>
                            </StyledView>
                        );
                    })()
                ) : allRows.length === 0 ? (
                    <StyledView className="flex-1 justify-center items-center p-10" style={{ gap: 12, width: '100%', maxWidth: 768, alignSelf: 'center' }}>
                        <Image source={WelcomeHamster} style={{ width: 80, height: 80 }} contentFit="contain" />
                        {!isLiveView ? (
                            <>
                                <ThemedText size="lg" className="font-n-bold text-center">No data available</ThemedText>
                                <ThemedText className="font-n-regular text-center" style={{ color: iconColor }}>
                                    No snapshot data exists for this date
                                </ThemedText>
                                <TouchableOpacity
                                    style={{
                                        paddingHorizontal: 24, paddingVertical: 12,
                                        borderRadius: 12, marginTop: 8,
                                        borderWidth: 1, borderColor: brandColor,
                                    }}
                                    onPress={() => setSnapshotDate(null)}
                                >
                                    <Text style={{ color: brandColor, fontWeight: '600', fontFamily: 'Nunito_600SemiBold', fontSize: 15 }}>
                                        Return to live
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
                    <View style={{ flex: 1, backgroundColor: tableContainerBg, width: '100%', maxWidth: 768, alignSelf: 'center' }}>
                        <FlatList<ListItem>
                            ref={leagueFlatListRef as any}
                            data={allRows}
                            keyExtractor={(item) => item.user_id}
                            renderItem={({ item, index }) => {
                                if ('_type' in item && item._type === 'divider') {
                                    const dividerContent = (
                                        <View style={{
                                            paddingVertical: 10,
                                            paddingHorizontal: 16,
                                            backgroundColor: borderColor,
                                            alignItems: 'center',
                                        }}>
                                            <Text style={{
                                                fontSize: 11,
                                                fontFamily: 'Nunito_600SemiBold',
                                                color: iconColor,
                                                textAlign: 'center',
                                            }}>
                                                Players must play a minimum of {item.threshold} games to compete
                                            </Text>
                                        </View>
                                    );
                                    if (animStartTimeRef.current > 0) {
                                        return (
                                            <AnimatedEntryRow index={index} startTime={animStartTimeRef.current}>
                                                {dividerContent}
                                            </AnimatedEntryRow>
                                        );
                                    }
                                    return dividerContent;
                                }
                                const rowContent = (
                                    <LeagueTableRow
                                        row={item as StandingRow}
                                        isEven={index % 2 === 0}
                                        isGlowing={!!glowLeagueId && (item as StandingRow).is_me}
                                        glowAnim={glowAnim}
                                        gameMode={gameMode}
                                        isHistorical={isSnapshotMode}
                                        isPerfectStreak={isPerfectStreak(item as StandingRow)}
                                        brandColor={brandColor}
                                        isLiveView={isLiveView}
                                        awardMedal={getMedalForRank((item as StandingRow).rank)}
                                        onRankPress={() => setStatTooltipType('rank')}
                                        onStatsPress={() => setStatTooltipType('stats')}
                                        onNamePress={() => setStatTooltipType('name')}
                                        sizes={leagueSizes}
                                    />
                                );
                                if (animStartTimeRef.current > 0) {
                                    return (
                                        <AnimatedEntryRow index={index} startTime={animStartTimeRef.current}>
                                            {rowContent}
                                        </AnimatedEntryRow>
                                    );
                                }
                                return rowContent;
                            }}
                            getItemLayout={(_, index) => ({
                                length: ESTIMATED_ROW_HEIGHT,
                                offset: ESTIMATED_ROW_HEIGHT * index,
                                index,
                            })}
                            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
                            contentContainerStyle={{ paddingBottom: 20 + (Platform.OS === 'android' ? 0 : insets.bottom) }}
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
                                pointerEvents="box-none"
                                style={{
                                    position: 'absolute',
                                    left: 0, right: 0,
                                    ...(ghostPosition === 'top' ? { top: 0 } : { bottom: 0 }),
                                }}
                            >
                                <GhostRow
                                    row={myRow}
                                    position={ghostPosition}
                                    isHistorical={isSnapshotMode}
                                    isPerfectStreak={isPerfectStreak(myRow)}
                                    brandColor={brandColor}
                                    awardMedal={getMedalForRank(myRow.rank)}
                                    onRankPress={() => setStatTooltipType('rank')}
                                    onStatsPress={() => setStatTooltipType('stats')}
                                    onNamePress={() => setStatTooltipType('name')}
                                    sizes={leagueSizes}
                                />
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
                        {statTooltipType === 'stats' ? (
                            <View style={{ marginBottom: 20 }}>
                                <Text style={{ fontSize: 14, fontFamily: 'Nunito_400Regular', lineHeight: 22, color: textColor }}>
                                    <Text style={{ fontFamily: 'Nunito_700Bold', fontWeight: '700' }}>P — Games Played:</Text> total games played this period.
                                </Text>
                                <Text style={{ fontSize: 14, fontFamily: 'Nunito_400Regular', lineHeight: 22, color: textColor, marginTop: 8 }}>
                                    <Text style={{ fontFamily: 'Nunito_700Bold', fontWeight: '700' }}>Win% — Win Rate:</Text> percentage of games won.
                                </Text>
                                <Text style={{ fontSize: 14, fontFamily: 'Nunito_400Regular', lineHeight: 22, color: textColor, marginTop: 8 }}>
                                    <Text style={{ fontFamily: 'Nunito_700Bold', fontWeight: '700' }}>Avg — Average Guesses:</Text> average number of guesses per game.
                                </Text>
                                <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', marginTop: 12 }}>
                                    <Text style={{ fontSize: 14, fontFamily: 'Nunito_400Regular', lineHeight: 22, color: textColor }}>*When a player is on a perfect streak their Games Played is shown as: </Text>
                                    <View style={{ backgroundColor: brandColor, borderRadius: 10, paddingHorizontal: 7, paddingVertical: 1 }}>
                                        <Text style={{ fontSize: 12, fontFamily: 'Nunito_700Bold', fontWeight: '700', color: '#ffffff' }}>5</Text>
                                    </View>
                                </View>
                            </View>
                        ) : statTooltipType === 'rank' ? (
                            <View style={{ marginBottom: 20 }}>
                                <Text style={{ fontSize: 14, fontFamily: 'Nunito_400Regular', lineHeight: 22, color: textColor }}>
                                    <Text style={{ fontFamily: 'Nunito_700Bold', fontWeight: '700' }}># — League Ranking:</Text> your current position within the league, based on your Elementle Rating.
                                </Text>
                                <Text style={{ fontSize: 14, fontFamily: 'Nunito_400Regular', lineHeight: 22, color: textColor, marginTop: 8 }}>
                                    The arrows show how your rank has changed since the last snapshot. ▲ means you moved up, ▼ means you moved down, and — means no change.
                                </Text>
                            </View>
                        ) : statTooltipType === 'name' ? (
                            <View style={{ marginBottom: 20 }}>
                                <Text style={{ fontSize: 14, fontFamily: 'Nunito_400Regular', lineHeight: 22, color: textColor }}>
                                    Your League Nickname is specific to each league and can be edited in that league's settings. Your identity name (shown in smaller text) is unique to you across all leagues and can be changed in your profile settings.
                                </Text>
                                <Text style={{ fontSize: 15, fontFamily: 'Nunito_700Bold', fontWeight: '700', color: '#dc2626', marginTop: 14, marginBottom: 4 }}>
                                    Live vs Snapshot Data
                                </Text>
                                <Text style={{ fontSize: 14, fontFamily: 'Nunito_400Regular', lineHeight: 22, color: textColor }}>
                                    When "Live" is shown, the league updates as users play today's puzzle. Previous days' snapshots are locked in once all users have passed midnight in their timezone.
                                </Text>
                            </View>
                        ) : (
                            <Text style={{ fontSize: 14, fontFamily: 'Nunito_400Regular', lineHeight: 22, marginBottom: 20, color: textColor }}>
                                {statTooltipType ? statDescriptions[statTooltipType]?.body : ''}
                            </Text>
                        )}
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
                currentDate={snapshotDate ? new Date(snapshotDate + 'T12:00:00') : new Date()}
                minDate={leagueCreatedAt ? new Date(leagueCreatedAt + 'T12:00:00') : new Date(2025, 0, 1)}
                maxDate={new Date()}
                onSelectDate={(date: Date) => {
                    const year = date.getFullYear();
                    const month = date.getMonth();
                    const now = new Date();

                    if (selectedTimeframe === 'ytd') {
                        // Year view: navigate to Dec 31 of selected year
                        if (year === now.getFullYear()) {
                            // Current year — go to live
                            setSnapshotDate(null);
                        } else {
                            setSnapshotDate(`${year}-12-31`);
                        }
                    } else {
                        // Month view: navigate to last day of selected month
                        if (year === now.getFullYear() && month === now.getMonth()) {
                            // Current month — go to live
                            setSnapshotDate(null);
                        } else {
                            const lastDay = new Date(year, month + 1, 0);
                            setSnapshotDate(lastDay.toISOString().split('T')[0]);
                        }
                    }
                    setMonthPickerVisible(false);
                }}
                mode={selectedTimeframe === 'ytd' ? 'year' : 'month'}
            />

            {/* ── Trophy Popup ── */}
            {myAwards?.medals && selectedLeagueId && (
                <TrophyPopup
                    visible={showTrophyPopup}
                    onClose={() => setShowTrophyPopup(false)}
                    medals={myAwards.medals.filter(m => m.game_mode === gameMode)}
                    leagueId={selectedLeagueId}
                    brandColor={brandColor}
                    initialTimeframe={selectedTimeframe}
                    currentSnapshotDate={snapshotDate}
                />
            )}
        </ThemedView >
    );
}
