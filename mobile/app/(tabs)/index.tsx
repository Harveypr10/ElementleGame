import { View, Text, TouchableOpacity, Image, ScrollView, RefreshControl, Animated, Dimensions, NativeSyntheticEvent, NativeScrollEvent, useWindowDimensions, Platform } from 'react-native';
import ReAnimated, { useSharedValue, useAnimatedStyle, withTiming, withDelay, Easing as ReEasing, SharedValue } from 'react-native-reanimated';
import { useHomeCacheSnapshot, HomeCacheSnapshot } from '../../hooks/useHomeCacheSnapshot';
import { useRouter, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { styled } from 'nativewind';
import { useAuth } from '../../lib/auth';
import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';

// Web version import
import HomeScreenWeb from './index.web';
import { supabase } from '../../lib/supabase';
import { HelpCircle, Settings, ChevronUp, ChevronDown } from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useOptions } from '../../lib/options';
import { useUserStats } from '../../hooks/useUserStats';
import { HomeCard } from '../../components/home/HomeCard';
import { ModeToggle } from '../../components/home/ModeToggle';
import { HelpModal } from '../../components/HelpModal';
import { BadgeUnlockModal } from '../../components/game/BadgeUnlockModal';
import { StreakSaverPopup } from '../../components/game/StreakSaverPopup';
import { useStreakSaver } from '../../contexts/StreakSaverContext';
import { useStreakSaverStatus } from '../../hooks/useStreakSaverStatus';
import { HolidayActiveModal } from '../../components/game/HolidayActiveModal';
import { endHolidayMode } from '../../lib/supabase-rpc'; // Import RPC helper
import { HolidayModePopup } from '../../components/game/HolidayModePopup';
import { HolidayEndedPopup } from '../../components/game/HolidayEndedPopup';
import { HolidayModeIndicator } from '../../components/HolidayModeIndicator';
import { HolidayActivationModal } from '../../components/game/HolidayActivationModal';
import { useBadgeSystem } from '../../hooks/useBadgeSystem';
import { useSubscription } from '../../hooks/useSubscription';
import { useConversionPrompt } from '../../contexts/ConversionPromptContext';
import { SafeAreaView } from 'react-native-safe-area-context';
import { GoProButton } from '../../components/GoProButton';
import { AdBanner } from '../../components/AdBanner';
import { AdBannerContext } from '../../contexts/AdBannerContext';
import { useProfile } from '../../hooks/useProfile';
import { getTodaysPuzzleDate } from '../../lib/dateUtils';
import { useToast } from '../../contexts/ToastContext';
import { usePuzzleReadiness } from '../../hooks/usePuzzleReadiness';
import { useAdsConsent } from '../../hooks/useAdsConsent';
import { ReminderPromptModal } from '../../components/game/ReminderPromptModal';
import { ReminderSuccessToast } from '../../components/game/ReminderSuccessToast';
import * as NotificationService from '../../lib/NotificationService';
import { fetchNotificationData } from '../../hooks/useNotificationData';
import { useMyLeagues, useMyLeaguesAll, useMyHomeRanks, useRejoinLeague, invalidateAllLeagueQueries, usePendingTrophies, League, GameMode } from '../../hooks/useLeagueData';
import { TrophyUnlockModal } from '../../components/game/TrophyUnlockModal';
import { useLeague } from '../../contexts/LeagueContext';
import LeagueUnlockPopup from '../../components/LeagueUnlockPopup';

// Import hamster images - trying UI folder versions which appear to be transparent
const HistorianHamsterBlue = require('../../assets/ui/webp_assets/Historian-Hamster.webp');
const WinHamsterBlue = require('../../assets/ui/webp_assets/Win-Hamster-Blue.webp');
const LibrarianHamsterYellow = require('../../assets/ui/webp_assets/Librarian-Hamster-Yellow.webp');
const MathsHamsterGreen = require('../../assets/ui/webp_assets/Maths-Hamster.webp');

const StyledView = styled(View);
const StyledText = styled(Text);
const StyledTouchableOpacity = styled(TouchableOpacity);

import { ThemedText } from '../../components/ThemedText';
import { ThemedView } from '../../components/ThemedView';
import { useThemeColor } from '../../hooks/useThemeColor';
import { useIsFocused } from '@react-navigation/native';
import { useAppReadiness } from '../../contexts/AppReadinessContext';

const { width: STATIC_WIDTH } = Dimensions.get('window');

// ── Cold-start animation guard ──
// Module-level variable: resets on app kill, survives re-renders and navigation.
let hasPlayedHomeAnimation = false;

// Lightweight reanimated wrapper — avoids CGBitmapContext warnings
// that RN core Animated.View triggers when wrapping shadow-bearing views.
const AnimatedEntry = React.memo(({ opacity, translateY, children }: {
    opacity: SharedValue<number>;
    translateY: SharedValue<number>;
    children: React.ReactNode;
}) => {
    const style = useAnimatedStyle(() => ({
        opacity: opacity.value,
        transform: [{ translateY: translateY.value }],
    }));
    return <ReAnimated.View style={style}>{children}</ReAnimated.View>;
});

// Memoized Page Component to prevent re-renders during scroll
const GameModePage = React.memo(({
    isRegion,
    todayStatus,
    guesses,
    stats,
    totalGames,
    refreshing,
    onRefresh,
    holidayActive,
    setHolidayModalMode,
    setShowHolidayModal,
    router,
    incrementInteraction,
    width,
    todaysPuzzleDate,
    userPuzzleReady,
    isCheckingPuzzle,
    leagueTablesEnabled,
    quickMenuEnabled,
    pendingLeagueInvite,
    onLeagueInviteClicked,
    entryAnims,
}: {
    isRegion: boolean,
    todayStatus: 'not-played' | 'solved' | 'failed',
    guesses: number,
    stats: any,
    totalGames: number,
    refreshing: boolean,
    onRefresh: () => void,
    holidayActive: boolean,
    setHolidayModalMode: (mode: 'REGION' | 'USER') => void,
    setShowHolidayModal: (show: boolean) => void,
    router: any,
    incrementInteraction: () => void,
    width?: number, // Optional for flex-based tablet layout
    todaysPuzzleDate: string, // CRITICAL: Today's puzzle date from parent
    userPuzzleReady?: boolean, // Whether today's personal puzzle is available
    isCheckingPuzzle?: boolean, // Whether the readiness check is in progress
    leagueTablesEnabled?: boolean, // Whether league tables feature is enabled
    quickMenuEnabled?: boolean, // Whether quick menu is active (legacy, ignored)
    pendingLeagueInvite?: boolean, // Whether there's a pending league invitation for this mode
    onLeagueInviteClicked?: () => void, // Called when invitation button is clicked
    entryAnims: { opacity: SharedValue<number>; translateY: SharedValue<number> }[], // Entry animation shared values (4 elements)
}) => {
    // Colors from Web App
    const playColor = isRegion ? '#7DAAE8' : '#66becb'; // Blue (Region) vs Teal (User)
    const archiveColor = isRegion ? '#FFD429' : '#fdab58'; // Yellow (Region) vs Orange (User)
    // Green: Match the overlay box color
    const statsColor = isRegion ? '#93c54e' : '#84b86c';

    // Responsive scaling for large screens - use actual screen width
    const { width: screenWidth } = useWindowDimensions();
    const scale = screenWidth >= 768 ? 1.25 : 1;
    const cardHeightScale = screenWidth >= 768 ? 1.06 : 1; // 15% smaller buttons on iPad (1.25 * 0.85 ≈ 1.06)

    // ── League Rankings for home button (lightweight RPC) ──
    const leagueGameMode: GameMode = isRegion ? 'region' : 'user';
    const { data: homeRanks, refetch: refetchHomeRanks } = useMyHomeRanks(leagueGameMode);
    const globalRank = homeRanks?.global_rank ?? null;
    const regionRank = homeRanks?.region_rank ?? null;
    const globalRankChange = (homeRanks?.global_yesterdays_rank != null && homeRanks?.global_rank != null)
        ? homeRanks.global_yesterdays_rank - homeRanks.global_rank : null;
    const regionRankChange = (homeRanks?.region_yesterdays_rank != null && homeRanks?.region_rank != null)
        ? homeRanks.region_yesterdays_rank - homeRanks.region_rank : null;
    const regionName = homeRanks?.region_name ?? 'UK';
    const hasRankChange = (globalRankChange != null && globalRankChange !== 0) || (regionRankChange != null && regionRankChange !== 0);
    const [globalOverflows, setGlobalOverflows] = useState(false);

    // Refetch home ranks whenever screen gains focus (e.g. returning from a game)
    useFocusEffect(
        useCallback(() => {
            refetchHomeRanks();
        }, [refetchHomeRanks])
    );

    // Helper: Calculate Total Guesses
    const calculateTotalGuesses = (distribution: any, gamesWon: number, gamesPlayed: number) => {
        if (!distribution) return 0;
        let total = 0;
        Object.entries(distribution).forEach(([guesses, count]) => {
            total += parseInt(guesses) * (count as number);
        });
        return total;
    };

    // Stats Calculations
    const winRate = totalGames > 0 ? ((stats.games_won || 0) / totalGames * 100).toFixed(0) : "0";
    const totalGuesses = calculateTotalGuesses(stats.guess_distribution, stats.games_won || 0, totalGames);
    const avgGuesses = (stats.games_won || 0) > 0 ? (totalGuesses / stats.games_won!).toFixed(1) : "0.0";

    // Percentile Logic & Dynamic Streak Message
    const dayOfMonth = new Date().getDate();
    const percentile = stats.cumulative_monthly_percentile;
    const currentStreak = stats.current_streak || 0;
    let percentileMessage = null;

    // Dynamic message based on game status and streak
    if (todayStatus === 'not-played') {
        if (currentStreak > 0) {
            const dayText = currentStreak === 1 ? 'day' : 'days';
            percentileMessage = `Continue your streak of ${currentStreak} ${dayText} in a row`;
        } else {
            percentileMessage = "Play today's puzzle to start a new streak";
        }
    } else {
        // User has played today - show percentile or archive message
        if (dayOfMonth >= 5 && percentile !== null && percentile !== undefined && percentile > 0) {
            const roundedPercentile = Math.floor(percentile / 5) * 5;
            if (percentile >= 50) {
                percentileMessage = `You're in the top ${roundedPercentile}% of players`;
            } else {
                percentileMessage = "Play the archive to boost your ranking";
            }
        } else {
            percentileMessage = "Play the archive to boost your ranking";
        }
    }

    // Use same hamster images for both modes
    const playIcon = todayStatus === 'solved' ? WinHamsterBlue : HistorianHamsterBlue;
    const archiveIcon = LibrarianHamsterYellow;
    const statsIcon = MathsHamsterGreen;

    return (
        <ScrollView
            contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
            showsVerticalScrollIndicator={false}
            style={width ? { width: width } : { flex: 1 }}
        >
            <View>
                {/* 1. PERCENTILE/STREAK MESSAGE */}
                <AnimatedEntry opacity={entryAnims[0].opacity} translateY={entryAnims[0].translateY}>
                    {percentileMessage ? (
                        <ThemedText className="text-slate-500 font-n-medium text-center" baseSize={16 * scale} style={{ marginBottom: screenWidth >= 768 ? 8 : 16 }}>
                            {percentileMessage}
                        </ThemedText>
                    ) : null}
                </AnimatedEntry>

                {/* 2. PLAY TODAY CARD */}
                <AnimatedEntry opacity={entryAnims[1].opacity} translateY={entryAnims[1].translateY}>
                <HomeCard
                    testID="home-card-play"
                    title={
                        !isRegion && !userPuzzleReady && !isCheckingPuzzle
                            ? "One moment, Hammie is still cooking up today's puzzle..."
                            : todayStatus === 'solved' ? "Today's puzzle solved!" : "Play Today"
                    }
                    titleSize={!isRegion && !userPuzzleReady && !isCheckingPuzzle ? 'base' : 'xl'}
                    subtitle={!isRegion && !userPuzzleReady ? undefined : (todayStatus !== 'solved' ? "Good luck!" : undefined)}
                    icon={playIcon}
                    backgroundColor={playColor}
                    disabled={!isRegion && !userPuzzleReady && todayStatus === 'not-played'}
                    onPress={() => {
                        incrementInteraction();
                        console.log(`[Home] Play Today pressed. HolidayActive: ${holidayActive}, Status: ${todayStatus}`);
                        if (holidayActive && todayStatus !== 'solved' && todayStatus !== 'failed') {
                            setHolidayModalMode(isRegion ? 'REGION' : 'USER');
                            setShowHolidayModal(true);
                        } else {
                            router.push(isRegion ? `/game/REGION/${todaysPuzzleDate}` : `/game/USER/${todaysPuzzleDate}`);
                        }
                    }}
                    height={144}
                    iconStyle={{ width: 89, height: 89 }}
                    scale={cardHeightScale}
                >
                    {todayStatus === 'solved' && (
                        <View className="flex-row gap-2 mt-0 w-full" style={{ flexDirection: 'row' }}>
                            <View className="rounded-xl p-2 items-center justify-center" style={{ width: 95 }}>
                                <ThemedText className="text-slate-700 font-n-medium text-sm">Solved in</ThemedText>
                                <ThemedText className="text-slate-700 font-n-bold text-xl">{guesses}</ThemedText>
                            </View>
                            <View className="rounded-xl p-2 items-center justify-center" style={{ width: 95 }}>
                                <ThemedText className="text-slate-700 font-n-medium text-sm">Streak</ThemedText>
                                <ThemedText className="text-slate-700 font-n-bold text-xl">{(stats.current_streak || 0).toLocaleString()}</ThemedText>
                            </View>
                        </View>
                    )}
                </HomeCard>
                </AnimatedEntry>

                {/* 3. ARCHIVE BUTTON */}
                <AnimatedEntry opacity={entryAnims[2].opacity} translateY={entryAnims[2].translateY}>
                <HomeCard
                    testID="home-card-archive"
                    title={isRegion ? "UK Archive" : "Personal Archive"}
                    icon={archiveIcon}
                    backgroundColor={archiveColor}
                    onPress={() => {
                        incrementInteraction();
                        router.push({ pathname: '/archive', params: { mode: isRegion ? 'REGION' : 'USER' } });
                    }}
                    height={120}
                    iconStyle={{ width: 78, height: 78 }}
                    scale={cardHeightScale}
                >
                    <View className="flex-row w-full" style={{ flexDirection: 'row' }}>
                        <View className="mt-0 rounded-xl p-2 items-center justify-center" style={{ width: 95 }}>
                            <ThemedText className="text-slate-700 font-n-medium text-sm">Played</ThemedText>
                            <ThemedText className="text-slate-700 font-n-bold text-xl">{totalGames.toLocaleString()}</ThemedText>
                        </View>
                    </View>
                </HomeCard>
                </AnimatedEntry>

                {/* 4. STATS + LEAGUE — 50/50 row when leagues enabled, full-width stats otherwise */}
                <AnimatedEntry opacity={entryAnims[3].opacity} translateY={entryAnims[3].translateY}>
                {leagueTablesEnabled ? (
                    <View style={{ flexDirection: 'row', gap: 10, marginBottom: 0 }}>
                        {/* Half-width Stats */}
                        <TouchableOpacity
                            testID="home-card-stats-half"
                            activeOpacity={0.9}
                            onPress={() => {
                                incrementInteraction();
                                router.push(`/stats?mode=${isRegion ? 'REGION' : 'USER'}`);
                            }}
                            style={{
                                flex: 1, backgroundColor: statsColor, borderRadius: 24,
                                paddingLeft: 20, paddingRight: 14, paddingTop: 18, paddingBottom: 18,
                                height: 120 * cardHeightScale, overflow: 'hidden',
                                shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
                                shadowOpacity: 0.1, shadowRadius: 8, elevation: 3,
                            }}
                        >
                            <Image source={statsIcon} style={{ position: 'absolute', top: screenWidth >= 768 ? 27 : 8, right: screenWidth >= 768 ? 16 : 8, width: screenWidth >= 768 ? 74 : 46, height: screenWidth >= 768 ? 74 : 46, opacity: 0.9 }} resizeMode="contain" />
                            <View style={{ flex: 1 }}>
                                <ThemedText className="font-n-bold text-slate-900" size="lg">Stats</ThemedText>
                                <View style={{ marginTop: 10, gap: 1 }}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                        <ThemedText className="font-n-medium" style={{ fontSize: 15, color: '#475569' }}>Won</ThemedText>
                                        <ThemedText className="font-n-bold" size="base" style={{ color: '#1e293b' }}>{winRate}%</ThemedText>
                                    </View>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                        <ThemedText className="font-n-medium" style={{ fontSize: 15, color: '#475569' }}>Avg</ThemedText>
                                        <ThemedText className="font-n-bold" size="base" style={{ color: '#1e293b' }}>{avgGuesses}</ThemedText>
                                    </View>
                                </View>
                            </View>
                        </TouchableOpacity>
                        {/* Half-width Leagues */}
                        <TouchableOpacity
                            testID="home-card-league-half"
                            activeOpacity={0.9}
                            onPress={() => {
                                incrementInteraction();
                                if (pendingLeagueInvite && onLeagueInviteClicked) {
                                    onLeagueInviteClicked();
                                } else {
                                    router.push(isRegion ? '/league/region' : '/league/user');
                                }
                            }}
                            style={{
                                flex: 1, backgroundColor: pendingLeagueInvite ? '#8E57DB' : (isRegion ? '#CDCFD1' : '#BABFB8'),
                                borderRadius: 24, paddingLeft: 20, paddingRight: 14,
                                paddingTop: 18, paddingBottom: 18,
                                height: 120 * cardHeightScale, overflow: 'hidden',
                                shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
                                shadowOpacity: 0.1, shadowRadius: 8, elevation: 3,
                            }}
                        >
                            <Image source={WinHamsterBlue} style={{ position: 'absolute', top: screenWidth >= 768 ? 27 : 8, right: screenWidth >= 768 ? 16 : 8, width: screenWidth >= 768 ? 74 : 46, height: screenWidth >= 768 ? 74 : 46, opacity: 0.9 }} resizeMode="contain" />
                            <View style={{ flex: 1 }}>
                                <ThemedText className="font-n-bold text-slate-900" size="lg" style={{ color: pendingLeagueInvite ? '#FFFFFF' : '#1e293b' }}>Leagues</ThemedText>
                                {pendingLeagueInvite ? (
                                    <View style={{ marginTop: 12 }}>
                                        <ThemedText className="font-n-semibold" style={{ fontSize: 13, color: '#FFFFFF', lineHeight: 17 }}>
                                            Invitation waiting{"\n"}- click to join
                                        </ThemedText>
                                    </View>
                                ) : (
                                    <View style={{ flex: 1, justifyContent: 'center', gap: 1, paddingTop: 6 }}>
                                        {/* Global row — 2-column: label + rank/change */}
                                        <View
                                            style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 4 }}
                                            onLayout={(e) => {
                                                // If Global row exceeds single-line height (~24px), hide UK row
                                                setGlobalOverflows(e.nativeEvent.layout.height > 24);
                                            }}
                                        >
                                            <ThemedText className="font-n-medium" style={{ fontSize: 15, color: '#475569' }}>Global</ThemedText>
                                            <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 4, flex: 1 }}>
                                                <ThemedText className="font-n-bold" size="base" style={{ color: '#1e293b' }}>{globalRank != null ? globalRank.toLocaleString() : '—'}</ThemedText>
                                                {globalRankChange != null && globalRankChange !== 0 && (
                                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 1 }}>
                                                        {globalRankChange > 0
                                                            ? <ChevronUp size={12} color="#15803d" />
                                                            : <ChevronDown size={12} color="#dc2626" />}
                                                        <Text style={{ fontSize: 11, fontFamily: 'Nunito_700Bold', color: globalRankChange > 0 ? '#15803d' : '#dc2626' }}>
                                                            {Math.abs(globalRankChange).toLocaleString()}
                                                        </Text>
                                                    </View>
                                                )}
                                            </View>
                                        </View>
                                        {/* UK row — hidden when Global overflows */}
                                        {!globalOverflows && (
                                            <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 4 }}>
                                                <ThemedText className="font-n-medium" style={{ fontSize: 15, color: '#475569' }}>{regionName}</ThemedText>
                                                <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 4, flex: 1 }}>
                                                    <ThemedText className="font-n-bold" size="base" style={{ color: '#1e293b' }}>{regionRank != null ? regionRank.toLocaleString() : '—'}</ThemedText>
                                                    {regionRankChange != null && regionRankChange !== 0 && (
                                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 1 }}>
                                                            {regionRankChange > 0
                                                                ? <ChevronUp size={12} color="#15803d" />
                                                                : <ChevronDown size={12} color="#dc2626" />}
                                                            <Text style={{ fontSize: 11, fontFamily: 'Nunito_700Bold', color: regionRankChange > 0 ? '#15803d' : '#dc2626' }}>
                                                                {Math.abs(regionRankChange).toLocaleString()}
                                                            </Text>
                                                        </View>
                                                    )}
                                                </View>
                                            </View>
                                        )}
                                    </View>
                                )}
                            </View>
                        </TouchableOpacity>
                    </View>
                ) : (
                    <HomeCard
                        testID="home-card-stats"
                        title={isRegion ? "UK Stats" : "Personal Stats"}
                        icon={statsIcon}
                        backgroundColor={statsColor}
                        onPress={() => {
                            incrementInteraction();
                            router.push(`/stats?mode=${isRegion ? 'REGION' : 'USER'}`);
                        }}
                        height={120}
                        iconStyle={{ width: 78, height: 78 }}
                        scale={cardHeightScale}
                    >
                        <View className="flex-row gap-2 w-full" style={{ flexDirection: 'row' }}>
                            <View className="mt-0 rounded-xl p-2 items-center justify-center" style={{ width: 95 }}>
                                <ThemedText className="text-slate-700 font-n-medium text-sm">% Won</ThemedText>
                                <ThemedText className="text-slate-700 font-n-bold text-xl">{winRate}%</ThemedText>
                            </View>
                            <View className="mt-0 rounded-xl p-2 items-center justify-center" style={{ width: 95 }}>
                                <ThemedText className="text-slate-700 font-n-medium text-sm">Guess avg</ThemedText>
                                <ThemedText className="text-slate-700 font-n-bold text-xl">{avgGuesses}</ThemedText>
                            </View>
                        </View>
                    </HomeCard>
                )}
                </AnimatedEntry>
            </View>
        </ScrollView>
    );
});

function HomeScreenInner({ snapshot }: { snapshot: HomeCacheSnapshot }) {
    // [WEB FIX] Use useWindowDimensions hook for reactive width detection on web
    const { width: SCREEN_WIDTH } = useWindowDimensions();

    const router = useRouter();
    const params = useLocalSearchParams(); // Use params for initialMode
    const { user, deferredPuzzle, consumeDeferredPuzzle } = useAuth();
    const { toast } = useToast();
    const {
        gameMode, setGameMode, streakSaverActive, holidaySaverActive, syncDarkModeWithDevice,
        reminderEnabled, setReminderEnabled, reminderTime,
        hasPromptedStreak7, setHasPromptedStreak7,
        neverAskReminder, setNeverAskReminder,
        streakReminderEnabled, streakReminderTime,
        leagueTablesEnabled,
        toggleLeagueTables,
        leagueAutoUnlockDone,
        setLeagueAutoUnlockDone,
        quickMenuEnabled,
        userSettingsLoaded,
    } = useOptions();
    const {
        pendingJoinCode,
        setPendingJoinCode,
        pendingLeagueInviteRegion,
        pendingLeagueInviteUser,
        setPendingLeagueInviteRegion,
        setPendingLeagueInviteUser,
        setNewlyJoinedLeagueId,
    } = useLeague();
    const { data: allLeagues } = useMyLeaguesAll();
    const { profile } = useProfile();
    const userRegion = profile?.region || 'UK';
    const { pendingBadges, markBadgeAsSeen, refetchPending } = useBadgeSystem();
    const { pendingTrophies, markTrophyAsSeen, refetchPendingTrophies } = usePendingTrophies();
    const [showHolidayModal, setShowHolidayModal] = useState(false);
    const [showLeagueUnlockPopup, setShowLeagueUnlockPopup] = useState(false);
    // dismissedHolidayModal removed — holiday check is now reactive on every press

    // Auto-enable league tables when a league invitation is pending (once per session)
    const hasAutoEnabledRef = useRef(false);
    useEffect(() => {
        if (hasAutoEnabledRef.current) return;
        if ((pendingLeagueInviteRegion || pendingLeagueInviteUser) && !leagueTablesEnabled) {
            console.log('[Home] Auto-enabling league tables for pending invitation');
            hasAutoEnabledRef.current = true;
            toggleLeagueTables();
        }
    }, [pendingLeagueInviteRegion, pendingLeagueInviteUser, leagueTablesEnabled]);

    const rejoinLeague = useRejoinLeague();

    // Handle league invite button press: check membership first, skip join screen if already member
    const handleLeagueInvitePress = useCallback(async (mode: 'region' | 'user') => {
        // Clear the per-mode invitation flag
        const otherModeStillPending = mode === 'region'
            ? pendingLeagueInviteUser
            : pendingLeagueInviteRegion;
        if (mode === 'region') {
            setPendingLeagueInviteRegion(false);
        } else {
            setPendingLeagueInviteUser(false);
        }

        // If this is the last pending mode, clear the join code so it doesn't
        // auto-fill when manually navigating to Join League later
        if (!otherModeStillPending && pendingJoinCode) {
            console.log('[Home] Both mode invitations handled — clearing pendingJoinCode');
            setPendingJoinCode(null);
        }

        // Check if the user is already a member of the league matching the join code
        const matchedLeague = pendingJoinCode && allLeagues
            ? allLeagues.find(l => l.join_code?.toUpperCase() === pendingJoinCode.toUpperCase())
            : null;

        if (matchedLeague) {
            // If user has left this league, rejoin them first
            if (!matchedLeague.is_active) {
                try {
                    console.log(`[Home] User has left league ${matchedLeague.id}, rejoining...`);
                    await rejoinLeague.mutateAsync(matchedLeague.id);
                    console.log(`[Home] Successfully rejoined league ${matchedLeague.id}`);
                } catch (err) {
                    console.error('[Home] Error rejoining league:', err);
                }
            } else {
                console.log(`[Home] User already active in league ${matchedLeague.id}, skipping join screen`);
            }
            setNewlyJoinedLeagueId(matchedLeague.id);
            router.push(mode === 'region' ? '/league/region' : '/league/user');
        } else {
            // Not a member — go to join screen
            router.push('/league/join');
        }
    }, [pendingJoinCode, allLeagues, setNewlyJoinedLeagueId, setPendingLeagueInviteRegion, setPendingLeagueInviteUser, setPendingJoinCode, pendingLeagueInviteRegion, pendingLeagueInviteUser, router, rejoinLeague]);

    // CRITICAL: Single source of truth for "today's puzzle date"
    // This is calculated ONCE when the component mounts and when it refocuses
    // All date-related logic MUST use this value, not recalculate "today"
    const [todaysPuzzleDate, setTodaysPuzzleDate] = useState(() => getTodaysPuzzleDate());

    // Refresh "today" when screen comes into focus (handles cross-midnight edge case)
    const isFocused = useIsFocused();
    useEffect(() => {
        if (isFocused) {
            const newToday = getTodaysPuzzleDate();
            if (newToday !== todaysPuzzleDate) {
                console.log(`[Home] Date changed from ${todaysPuzzleDate} to ${newToday}. Refreshing.`);
                setTodaysPuzzleDate(newToday);
            }
            // Re-check device display setting (handles auto light/dark at night)
            syncDarkModeWithDevice();
        }
    }, [isFocused]);

    // Check for initialMode param from Game Return
    // Removed initialMode param listener to rely on persistent useOptions context


    // Hook-based Stats (Cached & Fast)
    const { stats: regionHookStats, refetch: refetchRegionStats } = useUserStats('REGION');
    const { stats: userHookStats, refetch: refetchUserStats } = useUserStats('USER');

    // Resolve Stats: use snapshot (cached) until React Query delivers live data.
    // This ensures the first frame shows yesterday's correct numbers instead of zeros.
    const defaultStats = { current_streak: 0, games_played: 0, games_won: 0, guess_distribution: {}, cumulative_monthly_percentile: null };
    const regionStats = regionHookStats || snapshot.regionStats || defaultStats;
    const userStats = userHookStats || snapshot.userStats || defaultStats;

    // Cache stats to AsyncStorage whenever React Query delivers fresh data,
    // so the next cold start has accurate numbers to display immediately.
    useEffect(() => {
        if (regionHookStats && user?.id) {
            AsyncStorage.setItem(`cached_home_stats_region_${user.id}`, JSON.stringify({
                current_streak: regionHookStats.current_streak ?? 0,
                games_played: regionHookStats.games_played ?? 0,
                games_won: regionHookStats.games_won ?? regionHookStats.wins ?? 0,
                guess_distribution: regionHookStats.guess_distribution ?? {},
                cumulative_monthly_percentile: regionHookStats.cumulative_monthly_percentile ?? null,
            }));
        }
    }, [regionHookStats, user?.id]);

    useEffect(() => {
        if (userHookStats && user?.id) {
            AsyncStorage.setItem(`cached_home_stats_user_${user.id}`, JSON.stringify({
                current_streak: userHookStats.current_streak ?? 0,
                games_played: userHookStats.games_played ?? 0,
                games_won: userHookStats.games_won ?? userHookStats.wins ?? 0,
                guess_distribution: userHookStats.guess_distribution ?? {},
                cumulative_monthly_percentile: userHookStats.cumulative_monthly_percentile ?? null,
            }));
        }
    }, [userHookStats, user?.id]);

    // Auto-unlock leagues for new users who qualify in their first full month
    const hasCheckedAutoUnlockRef = useRef(false);
    useEffect(() => {
        // Only check once per app session, and only after user settings are hydrated
        if (hasCheckedAutoUnlockRef.current || leagueAutoUnlockDone || !user?.created_at) return;
        if (!regionHookStats) return; // Wait for stats to load
        if (!userSettingsLoaded) return; // Wait for user-scoped settings to load from AsyncStorage

        // If leagues are ALREADY enabled, this user doesn't need the auto-unlock popup.
        // Just mark the flag as done so we never re-check, and bail out.
        if (leagueTablesEnabled) {
            console.log('[Home] Auto-unlock: leagues already enabled, marking done');
            hasCheckedAutoUnlockRef.current = true;
            setLeagueAutoUnlockDone(true);
            return;
        }

        hasCheckedAutoUnlockRef.current = true;

        const checkAutoUnlock = async () => {
            try {
                // SAFETY CHECK: verify against Supabase DB directly, since AsyncStorage
                // may not have this user's settings on a new/different device.
                // If the user has ALREADY unlocked leagues on another device, skip the popup.
                const { data: dbSettings } = await supabase
                    .from('user_settings')
                    .select('league_auto_unlock_done, league_tables_enabled')
                    .eq('user_id', user.id)
                    .maybeSingle() as any;

                if ((dbSettings as any)?.league_auto_unlock_done || (dbSettings as any)?.league_tables_enabled) {
                    console.log('[Home] Auto-unlock: DB shows leagues already configured, skipping popup');
                    // Sync local state with DB
                    if ((dbSettings as any).league_tables_enabled && !leagueTablesEnabled) {
                        toggleLeagueTables(); // Enable locally
                    }
                    setLeagueAutoUnlockDone(true);
                    return;
                }

                // Check if user signed up in a previous calendar month
                const createdDate = new Date(user.created_at);
                const now = new Date();
                const isNewMonth = now.getFullYear() > createdDate.getFullYear()
                    || (now.getFullYear() === createdDate.getFullYear() && now.getMonth() > createdDate.getMonth());

                if (!isNewMonth) {
                    console.log('[Home] Auto-unlock: user is still in signup month, skipping');
                    return;
                }

                // Fetch min games threshold from admin_settings
                const { data: settingRow } = await supabase
                    .from('admin_settings')
                    .select('value')
                    .eq('key', 'min_games_for_cumulative_percentile')
                    .maybeSingle();
                const minGames = settingRow?.value ? parseInt(settingRow.value, 10) : 5;

                const monthlyGames = (regionHookStats as any)?.games_played_month ?? 0;
                console.log(`[Home] Auto-unlock check: monthlyGames=${monthlyGames}, minGames=${minGames}`);

                if (monthlyGames >= minGames) {
                    console.log('[Home] Auto-unlock: user qualifies! Enabling league tables.');
                    // Only enable if not already enabled (never toggle OFF)
                    if (!leagueTablesEnabled) {
                        toggleLeagueTables();
                    } else {
                        setLeagueAutoUnlockDone(true);
                    }
                    setShowLeagueUnlockPopup(true);
                }
            } catch (err) {
                // If DB check fails, assume user has already seen leagues (fail-safe: don't show popup)
                console.error('[Home] Auto-unlock check error (defaulting to done):', err);
                setLeagueAutoUnlockDone(true);
            }
        };

        checkAutoUnlock();
    }, [leagueAutoUnlockDone, leagueTablesEnabled, userSettingsLoaded, user?.created_at, regionHookStats]);

    // Sync game status from cache on every focus event.
    // When game-result writes updated status to AsyncStorage before dismissAll(),
    // this reads it instantly (~1-3ms) so the Home screen shows correct state
    // the moment it becomes visible — no flash of stale data.
    useFocusEffect(
        useCallback(() => {
            const syncFromCache = async () => {
                const id = user?.id ?? 'guest';
                const todayStr = todaysPuzzleDate;
                try {
                    const [regionRaw, userRaw, nameRaw] = await Promise.all([
                        AsyncStorage.getItem(`cached_game_status_region_${id}`),
                        AsyncStorage.getItem(`cached_game_status_user_${id}`),
                        AsyncStorage.getItem(`cached_first_name_${id}`),
                    ]);
                    if (regionRaw) {
                        const parsed = JSON.parse(regionRaw);
                        if (parsed.date === todayStr) {
                            setTodayStatusRegion(parsed.status);
                            setGuessesRegion(parsed.guesses ?? 0);
                        }
                    }
                    if (userRaw) {
                        const parsed = JSON.parse(userRaw);
                        if (parsed.date === todayStr) {
                            setTodayStatusUser(parsed.status);
                            setGuessesUser(parsed.guesses ?? 0);
                        }
                    }
                    if (nameRaw) setFirstName(nameRaw);
                } catch (e) {
                    // Silent — fetchData will correct any issues
                }
            };
            syncFromCache();
        }, [todaysPuzzleDate, user?.id])
    );

    // Track which mode triggered the Holiday Modal (to route correctly on Continue/Exit)
    const [holidayModalMode, setHolidayModalMode] = useState<'REGION' | 'USER'>('USER');

    const {
        status: streakSaverStatus,
        isLoading: isStreakSaverLoadingInitial,
        isFetching: isStreakSaverFetching,
        regionCanUseStreakSaver,
        userCanUseStreakSaver,
        userOfferStreakSaver,
        regionOfferStreakSaver,
        holidayActive, // Get holiday status
        holidayEndDate, // Get end date for modal
        refetch: refetchStreakStatus,
        hasMissedRegion,
        hasMissedUser
    } = useStreakSaverStatus(todaysPuzzleDate);

    // [FIX] isLoading only covers initial fetch with no cache.
    // isFetching also covers background refetches (e.g. after sign-out/sign-in).
    // We need BOTH to ensure we never evaluate with stale/default data.
    const isStreakSaverLoading = isStreakSaverLoadingInitial || isStreakSaverFetching;
    const { isPro } = useSubscription();
    const { incrementInteraction } = useConversionPrompt();
    // SCREEN_WIDTH defined by hook above

    // Contexts for Timing and Focus
    const { isAppReady } = useAppReadiness();
    // isFocused already declared above for date refresh logic

    // Puzzle readiness check (personal mode only — region puzzles are pre-generated)
    const { userReady: userPuzzleReady, isChecking: isCheckingPuzzle } = usePuzzleReadiness(
        user?.id,
        todaysPuzzleDate
    );

    // Trigger UMP/ATT consent flow on first Home Screen visit
    // SDK handles de-duplication — if user already consented (e.g. as guest),
    // this resolves silently without showing any UI
    const { triggerConsentFlow } = useAdsConsent();
    const consentTriggeredRef = useRef(false);
    useEffect(() => {
        if (user && !consentTriggeredRef.current) {
            consentTriggeredRef.current = true;
            triggerConsentFlow();
        }
    }, [user, triggerConsentFlow]);

    // Data States
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [helpVisible, setHelpVisible] = useState(false);

    // Badge Display State
    const [badgeModalVisible, setBadgeModalVisible] = useState(false);
    // [FIX] Track badge IDs we've already shown/dismissed this session
    // to prevent double-popup when query refetch briefly returns stale data
    const seenBadgeIdsRef = React.useRef<Set<number>>(new Set());

    // Trophy Display State
    const [trophyModalVisible, setTrophyModalVisible] = useState(false);
    const seenTrophyIdsRef = React.useRef<Set<number>>(new Set());

    // Streak-7 notification prompt (moved from game-result.tsx)
    const [reminderPromptVisible, setReminderPromptVisible] = useState(false);
    const [reminderSuccessVisible, setReminderSuccessVisible] = useState(false);

    // Streak Saver Popup State
    const [streakSaverVisible, setStreakSaverVisible] = useState(false);
    // [FIX] Track when the popup check effect has completed at least once,
    // so deferred navigation doesn't race ahead before the popup has a chance to show.
    const popupCheckDoneRef = useRef(false);
    const [holidayModeVisible, setHolidayModeVisible] = useState(false);
    const [isRescueMode, setIsRescueMode] = useState(false);

    // Context for suppression
    const { isJustCompleted, isInStreakSaverMode } = useStreakSaver();

    const [holidayEndedVisible, setHolidayEndedVisible] = useState(false);

    // Holiday Ended Check
    useEffect(() => {
        if (streakSaverStatus?.user?.holidayEnded) {
            setHolidayEndedVisible(true);
        }
    }, [streakSaverStatus?.user?.holidayEnded]);

    // Sync modal visibility with pending badges
    useEffect(() => {
        // [FIX] Only show badges when App is fully ready (Splash gone)
        // AND when the home screen is actually focused (not when user is on game-result).
        // Without isFocused check, both home screen AND game-result would race to show
        // the same badge since both subscribe to pendingBadges via useBadgeSystem().
        // Filter out badges we've already seen/dismissed this session
        const unseen = pendingBadges?.filter(b => !seenBadgeIdsRef.current.has(b.id)) ?? [];
        if (isAppReady && isFocused && unseen.length > 0) {
            setBadgeModalVisible(true);
        } else {
            setBadgeModalVisible(false);
        }
    }, [pendingBadges, isAppReady, isFocused]);

    // Sync trophy modal visibility with pending trophies
    // Show AFTER badge modal is dismissed to avoid overlap
    useEffect(() => {
        const unseenTrophies = pendingTrophies?.filter(t => !seenTrophyIdsRef.current.has(t.id)) ?? [];
        if (isAppReady && isFocused && !badgeModalVisible && unseenTrophies.length > 0) {
            setTrophyModalVisible(true);
        } else {
            setTrophyModalVisible(false);
        }
    }, [pendingTrophies, isAppReady, isFocused, badgeModalVisible]);

    // Track which mode triggered the popup (Region or User)
    const [popupMode, setPopupMode] = useState<'REGION' | 'USER'>('REGION');
    const [dismissedPopup, setDismissedPopup] = useState(false);

    // User Animation Chaining State


    // Check for streak saver eligibility and show popup
    useEffect(() => {
        // [DEBUG] Log guard conditions to identify blocking issue
        console.log('[Home PopupGuard] Checking conditions:', {
            isAppReady,
            isFocused,
            loading,
            hasUser: !!user,
            dismissedPopup,
            isInStreakSaverMode,
            isStreakSaverLoading
        });

        // Only show popup when app is ready, screen is focused, loaded, and not dismissed
        // [FIX] Also suppress if we are currently IN a streak saver mode (e.g. just clicked "Use")
        // [FIX] If streak saver toggle is OFF, never show any popup
        if (isAppReady && isFocused && !loading && user && !dismissedPopup && !isInStreakSaverMode && streakSaverActive && !isStreakSaverLoading) {

            // Extract new flags from status (default to false if loading/null)
            const regionOfferStreakSaver = streakSaverStatus?.region?.offerStreakSaver ?? false;
            const regionOfferHolidayRescue = streakSaverStatus?.region?.offerHolidayRescue ?? false;

            const userOfferStreakSaver = streakSaverStatus?.user?.offerStreakSaver ?? false;
            const userOfferHolidayRescue = streakSaverStatus?.user?.offerHolidayRescue ?? false;

            // [FIX] If popup is currently visible, check if the current popupMode still meets criteria.
            // EXCEPTION: If holidayActive just became true while popup is showing, the user
            // activated holiday FROM the popup. Don't dismiss — the popup manages its own
            // lifecycle during calendar animations and will call onClose('holiday') when done.
            if (streakSaverVisible) {
                if (holidayActive) {
                    // Holiday was activated from within the popup — let it handle its own lifecycle
                    console.log(`[Home] Holiday active while popup visible — letting popup manage its own calendar animations`);
                    return;
                }

                const currentModeStillEligible =
                    (popupMode === 'REGION' && (regionOfferStreakSaver || regionOfferHolidayRescue)) ||
                    (popupMode === 'USER' && (userOfferStreakSaver || userOfferHolidayRescue));

                if (!currentModeStillEligible) {
                    console.log(`[Home] Current popup mode ${popupMode} no longer eligible, dismissing popup`);
                    setStreakSaverVisible(false);
                    return;
                }
            }

            // GLOBAL CHECK (Independent of current tab)
            // Prioritize Region, then User

            // [DEBUG] Log current state for debugging
            console.log('[Home PopupCheck] Evaluating popup eligibility:', {
                regionOfferStreakSaver,
                regionOfferHolidayRescue,
                userOfferStreakSaver,
                userOfferHolidayRescue,
                holidayActive,
                isJustCompletedRegion: isJustCompleted('REGION'),
                isJustCompletedUser: isJustCompleted('USER'),
                streakSaverVisible,
                popupMode
            });

            // 1. Region Checks
            if (!isJustCompleted('REGION')) {
                // [FIX] Do NOT show rescue popup if Holiday Mode is ALREADY active.
                // The gap logic might still see a gap, but if we are on holiday, it's protected.
                // [FIX] If holidaySaverActive is OFF, only show streak saver (gap=2), not holiday rescue (gap>2)
                const regionShowSaver = regionOfferStreakSaver && !holidayActive;
                const regionShowRescue = regionOfferHolidayRescue && !holidayActive && holidaySaverActive;
                if (regionShowSaver || regionShowRescue) {
                    console.log('[Home PopupCheck] Showing REGION popup');
                    setPopupMode('REGION');
                    setStreakSaverVisible(true);
                    return;
                }
            }

            // 2. User Checks
            if (!isJustCompleted('USER')) {
                const userShowSaver = userOfferStreakSaver && !holidayActive;
                const userShowRescue = userOfferHolidayRescue && !holidayActive && holidaySaverActive;
                if (userShowSaver || userShowRescue) {
                    console.log('[Home PopupCheck] Showing USER popup');
                    setPopupMode('USER');
                    setStreakSaverVisible(true);
                    return;
                }
            }

            console.log('[Home PopupCheck] No popup to show');
        }

        // [FIX] Mark popup check as complete so deferred navigation knows
        // it's safe to proceed (popup had its chance to show).
        if (isAppReady && !loading && user && !isStreakSaverLoading) {
            popupCheckDoneRef.current = true;
        }
    }, [isAppReady, isFocused, loading, streakSaverStatus, user, isJustCompleted, dismissedPopup, streakSaverVisible, popupMode, isInStreakSaverMode, holidayActive, streakSaverActive, holidaySaverActive, isStreakSaverLoading]);

    // ============================================================
    // "GAME SHARED" BUTTON
    // Instead of auto-navigating to shared puzzles (which races with
    // StreakSavers and Holiday Mode), we show a button on the Home
    // screen that the user must tap to load the shared puzzle.
    // The button only appears once all startup flows are complete.
    // ============================================================
    const [showSharedButton, setShowSharedButton] = useState(false);

    useEffect(() => {
        // No deferred puzzle → hide button
        if (!deferredPuzzle) {
            setShowSharedButton(false);
            return;
        }

        // Wait for user to be signed in
        if (!user) return;

        // Wait for app to be fully ready and data loaded
        if (!isAppReady || loading || !isFocused) return;

        // Wait for StreakSaver status to be loaded
        if (isStreakSaverLoading) return;

        // Wait for popup check to complete at least once
        if (!popupCheckDoneRef.current) return;

        // Wait for any StreakSaver/Holiday popup to be dismissed
        if (streakSaverVisible) return;

        // Wait for ALL queued streak saver offers to be handled
        if (streakSaverActive && !dismissedPopup) {
            // Note: holidayActive no longer blocks the button — the press handler
            // (handleSharedGamePress) shows the holiday modal when appropriate.

            const regionHasPendingOffer =
                !isJustCompleted('REGION') &&
                ((streakSaverStatus?.region?.offerStreakSaver) ||
                    (streakSaverStatus?.region?.offerHolidayRescue && holidaySaverActive));
            const userHasPendingOffer =
                !isJustCompleted('USER') &&
                ((streakSaverStatus?.user?.offerStreakSaver) ||
                    (streakSaverStatus?.user?.offerHolidayRescue && holidaySaverActive));

            if (regionHasPendingOffer || userHasPendingOffer) return;
        }

        // All clear — show the button
        console.log('[Home] Shared puzzle ready — showing Game Shared button');
        setShowSharedButton(true);
    }, [deferredPuzzle, isAppReady, loading, isFocused, streakSaverVisible, isStreakSaverLoading, user, holidayActive, streakSaverStatus, dismissedPopup, isJustCompleted, streakSaverActive, holidaySaverActive]);

    // Handler for the "Game Shared" button press
    const handleSharedGamePress = () => {
        const puzzle = consumeDeferredPuzzle();
        setShowSharedButton(false);
        if (!puzzle) return;

        console.log(`[Home] Game Shared button pressed: ${puzzle.mode}/${puzzle.date}, holidayActive=${holidayActive}`);

        // Holiday Mode interception: if user is on holiday and this is today's puzzle,
        // show the Holiday exit/continue modal before navigating.
        const today = todaysPuzzleDate;
        if (holidayActive && puzzle.date === today) {
            console.log('[Home] Holiday Mode active — showing Holiday modal for shared puzzle');
            toast({
                title: 'Puzzle shared with you!',
                description: 'Continue in holiday mode or exit to play the shared puzzle.',
                variant: 'share',
                position: 'bottom',
                duration: 5000,
            });
            // Delay the modal so the toast is visible first (Modal renders in a
            // separate native window layer and would cover the toast otherwise)
            setHolidayModalMode(puzzle.mode === 'USER' ? 'USER' : 'REGION');
            setTimeout(() => {
                setShowHolidayModal(true);
            }, 2000);
            return;
        }

        // Normal navigation
        toast({
            title: 'Loading the puzzle that has been shared with you...',
            variant: 'share',
            position: 'bottom',
            duration: 5000,
        });
        setTimeout(() => {
            console.log(`[Home] Navigating to shared puzzle: /game/${puzzle.mode}/${puzzle.date}`);
            router.push(`/game/${puzzle.mode}/${puzzle.date}`);
        }, 300);
    };

    // ============================================================
    // DEFERRED GUEST REPLAY
    // After StreakSaver/Holiday popup flow completes, navigate to
    // the game screen to visually replay the guest's saved game data.
    // This must run AFTER StreakSaver is resolved so the streak isn't
    // destroyed before the user can use their saver.
    // ============================================================
    const guestReplayTriggeredRef = useRef(false);

    useEffect(() => {
        // Only trigger once per session
        if (guestReplayTriggeredRef.current) return;

        // Wait for user to be signed in
        if (!user) return;

        // Wait for app to be fully ready and data loaded
        if (!isAppReady || loading || !isFocused) return;

        // Wait for StreakSaver status to be loaded
        if (isStreakSaverLoading) return;

        // Wait for popup check to complete at least once
        if (!popupCheckDoneRef.current) return;

        // Wait for any StreakSaver popup to be dismissed
        if (streakSaverVisible) return;

        // Wait if in streak saver mode (user is playing yesterday's puzzle)
        if (isInStreakSaverMode) return;

        // If StreakSaver was active but not yet dismissed, wait
        if (streakSaverActive && !dismissedPopup) {
            // If holiday just activated from popup, wait for it to finish
            if (holidayActive) return;

            // Check if any offers are still pending
            const regionHasPending = !isJustCompleted('REGION') &&
                (streakSaverStatus?.region?.offerStreakSaver || streakSaverStatus?.region?.offerHolidayRescue);
            const userHasPending = !isJustCompleted('USER') &&
                (streakSaverStatus?.user?.offerStreakSaver || streakSaverStatus?.user?.offerHolidayRescue);
            if (regionHasPending || userHasPending) return;
        }

        // All clear — check if there's deferred guest data to replay
        guestReplayTriggeredRef.current = true;

        (async () => {
            try {
                // Check for any remaining guest_game_REGION_* keys
                const allKeys = await AsyncStorage.getAllKeys();
                const guestRegionKeys = allKeys.filter(k => k.startsWith('guest_game_REGION_'));

                if (guestRegionKeys.length > 0) {
                    console.log(`[Home] Found ${guestRegionKeys.length} deferred guest games, navigating to replay`);
                    // Navigate to the game screen with guestReplay flag
                    router.push(`/game/REGION/${todaysPuzzleDate}?guestReplay=true&skipIntro=true`);
                } else {
                    console.log('[Home] No deferred guest games found');
                }
            } catch (e) {
                console.error('[Home] Deferred guest replay check error:', e);
            }
        })();
    }, [user, isAppReady, loading, isFocused, isStreakSaverLoading, streakSaverVisible,
        isInStreakSaverMode, streakSaverActive, dismissedPopup, holidayActive,
        streakSaverStatus, isJustCompleted, todaysPuzzleDate]);
    const handleBadgeClose = async () => {
        // [FIX] Filter out already-seen badges before processing
        const unseen = pendingBadges?.filter(b => !seenBadgeIdsRef.current.has(b.id)) ?? [];
        if (unseen.length > 0) {
            const badgeToMark = unseen[0];
            // Capture the badge info BEFORE marking as seen (for streak-7 check)
            const closedBadge = badgeToMark.badge;

            // [FIX] Add to local seen set BEFORE closing / marking in DB
            seenBadgeIdsRef.current.add(badgeToMark.id);
            setBadgeModalVisible(false);

            // Mark as seen, triggering query update
            await markBadgeAsSeen(badgeToMark.id);

            // Check if we should show streak-7 reminder prompt after badge closes
            if (
                closedBadge?.category === 'Streak' &&
                closedBadge?.threshold === 7 &&
                !hasPromptedStreak7 &&
                !neverAskReminder &&
                !reminderEnabled
            ) {
                console.log('[Home] Streak 7 badge closed — showing reminder prompt');
                setTimeout(() => setReminderPromptVisible(true), 400);
            }
        }
    };

    const handleTrophyClose = async () => {
        const unseenTrophies = pendingTrophies?.filter(t => !seenTrophyIdsRef.current.has(t.id)) ?? [];
        if (unseenTrophies.length > 0) {
            const trophyToMark = unseenTrophies[0];
            seenTrophyIdsRef.current.add(trophyToMark.id);
            setTrophyModalVisible(false);
            await markTrophyAsSeen(trophyToMark.id);
        }
    };

    // Region Stats — initialized from cache snapshot for instant first frame
    const [todayStatusRegion, setTodayStatusRegion] = useState<'not-played' | 'solved' | 'failed'>(snapshot.todayStatusRegion);
    const [guessesRegion, setGuessesRegion] = useState(snapshot.guessesRegion);


    // User Stats — initialized from cache snapshot for instant first frame
    const [todayStatusUser, setTodayStatusUser] = useState<'not-played' | 'solved' | 'failed'>(snapshot.todayStatusUser);
    const [guessesUser, setGuessesUser] = useState(snapshot.guessesUser);

    const [firstName, setFirstName] = useState(snapshot.firstName);

    // Animation & Scroll Refs
    const scrollX = useRef(new Animated.Value(0)).current;
    const scrollViewRef = useRef<ScrollView>(null);

    // ── Entry animation values (react-native-reanimated) ──
    // Using reanimated instead of RN core Animated to avoid CGBitmapContext
    // warnings when wrapping shadow-bearing HomeCard views.
    const topFadeOpacity = useSharedValue(hasPlayedHomeAnimation ? 1 : 0);
    const e0Opacity = useSharedValue(hasPlayedHomeAnimation ? 1 : 0);
    const e0TranslateY = useSharedValue(hasPlayedHomeAnimation ? 0 : 60);
    const e1Opacity = useSharedValue(hasPlayedHomeAnimation ? 1 : 0);
    const e1TranslateY = useSharedValue(hasPlayedHomeAnimation ? 0 : 60);
    const e2Opacity = useSharedValue(hasPlayedHomeAnimation ? 1 : 0);
    const e2TranslateY = useSharedValue(hasPlayedHomeAnimation ? 0 : 60);
    const e3Opacity = useSharedValue(hasPlayedHomeAnimation ? 1 : 0);
    const e3TranslateY = useSharedValue(hasPlayedHomeAnimation ? 0 : 60);
    const bottomEntryAnims = useRef([
        { opacity: e0Opacity, translateY: e0TranslateY },
        { opacity: e1Opacity, translateY: e1TranslateY },
        { opacity: e2Opacity, translateY: e2TranslateY },
        { opacity: e3Opacity, translateY: e3TranslateY },
    ]).current;

    const topFadeStyle = useAnimatedStyle(() => ({
        opacity: topFadeOpacity.value,
    }));

    // Trigger entry animations on cold start only — wait for splash screen to dismiss
    useEffect(() => {
        if (!isAppReady || hasPlayedHomeAnimation) return;
        hasPlayedHomeAnimation = true;

        // Top section: simple fade in
        topFadeOpacity.value = withTiming(1, { duration: 500 });

        // Bottom section: staggered slide-up + fade
        bottomEntryAnims.forEach((anim, i) => {
            const d = i * 200; // 200ms stagger
            anim.opacity.value = withDelay(d, withTiming(1, { duration: 500 }));
            anim.translateY.value = withDelay(d, withTiming(0, {
                duration: 500,
                easing: ReEasing.out(ReEasing.cubic),
            }));
        });
    }, [isAppReady]);

    const lastFetchRef = useRef<number>(0);
    const prevUserIdRef = useRef<string | undefined>(undefined);

    // Reset throttle and force refetch when user ID changes 
    // (important for guest migration - ensures fresh data after sign-up)
    useEffect(() => {
        if (user?.id && user.id !== prevUserIdRef.current) {
            console.log('[Home] User ID changed - resetting throttle and forcing refetch');
            lastFetchRef.current = 0; // Reset throttle
            prevUserIdRef.current = user.id;
            // Small delay to ensure migration has completed
            const timer = setTimeout(() => {
                refetchRegionStats();
                refetchUserStats();
                refetchPending();
            }, 500);
            return () => clearTimeout(timer);
        }
    }, [user?.id, refetchRegionStats, refetchUserStats, refetchPending]);

    const fetchData = useCallback(async (force = false) => {
        const now = Date.now();
        // Throttle: Only fetch if forced or > 10 seconds since last fetch
        if (!force && lastFetchRef.current && (now - lastFetchRef.current < 10000)) {
            console.log('[Home] Skipping fetch (throttled)');
            return;
        }
        lastFetchRef.current = now;

        try {
            setLoading(true);
            if (!user) return;

            // Trigger Refetches for Hook Data
            refetchPending();
            refetchRegionStats();
            refetchUserStats();

            // Use the centralized today's puzzle date
            const todayStr = todaysPuzzleDate;
            const startOfDay = new Date();
            startOfDay.setHours(0, 0, 0, 0);

            // ==========================================
            // 1. REGION DATA (Attempts Only)
            // ==========================================
            const { data: attemptsReg } = await supabase
                .from('game_attempts_region')
                .select('*, questions_allocated_region(puzzle_date)')
                .eq('user_id', user.id)
                .gte('updated_at', startOfDay.toISOString());

            if (attemptsReg && attemptsReg.length > 0) {
                // Filter for ACTUAL today's puzzle
                const todayAttempt = attemptsReg.find((a: any) => a.questions_allocated_region?.puzzle_date === todayStr);

                if (todayAttempt) {
                    const status = todayAttempt.result === 'won' ? 'solved' : (todayAttempt.result === 'lost' ? 'failed' : 'not-played');
                    setTodayStatusRegion(status);

                    const guesses = todayAttempt.result === 'won' ? (todayAttempt.num_guesses || 0) : 0;
                    if (todayAttempt.result === 'won') setGuessesRegion(guesses);

                    // Cache Region Status
                    AsyncStorage.setItem(`cached_game_status_region_${user.id}`, JSON.stringify({
                        date: todayStr,
                        status: status,
                        guesses: guesses
                    }));
                } else {
                    setTodayStatusRegion('not-played');
                    // Cache Region Status (Not Played) - Clear or set default?
                    // Better to overwrite with current state
                    AsyncStorage.setItem(`cached_game_status_region_${user.id}`, JSON.stringify({
                        date: todayStr,
                        status: 'not-played',
                        guesses: 0
                    }));
                }
            } else {
                setTodayStatusRegion('not-played');
            }

            // ==========================================
            // 2. USER DATA (Attempts Only)
            // ==========================================
            const { data: attemptsUser } = await supabase
                .from('game_attempts_user')
                .select('*, questions_allocated_user(puzzle_date)')
                .eq('user_id', user.id)
                .gte('updated_at', startOfDay.toISOString());

            if (attemptsUser && attemptsUser.length > 0) {
                // Filter for ACTUAL today's puzzle
                const todayAttempt = attemptsUser.find((a: any) => a.questions_allocated_user?.puzzle_date === todayStr);

                if (todayAttempt) {
                    const status = todayAttempt.result === 'won' ? 'solved' : (todayAttempt.result === 'lost' ? 'failed' : 'not-played');
                    setTodayStatusUser(status);

                    const guesses = todayAttempt.result === 'won' ? (todayAttempt.num_guesses || 0) : 0;
                    if (todayAttempt.result === 'won') setGuessesUser(guesses);

                    // Cache User Status
                    AsyncStorage.setItem(`cached_game_status_user_${user.id}`, JSON.stringify({
                        date: todayStr,
                        status: status,
                        guesses: guesses
                    }));
                } else {
                    setTodayStatusUser('not-played');
                    AsyncStorage.setItem(`cached_game_status_user_${user.id}`, JSON.stringify({
                        date: todayStr,
                        status: 'not-played',
                        guesses: 0
                    }));
                }
            } else {
                setTodayStatusUser('not-played');
            }

            // Fetch Profile Name
            const { data: profile } = await supabase
                .from('user_profiles')
                .select('first_name')
                .eq('id', user.id)
                .single();
            if (profile?.first_name) {
                setFirstName(profile.first_name);
                AsyncStorage.setItem(`cached_first_name_${user.id}`, profile.first_name);
            }

        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [user, refetchPending, refetchRegionStats, refetchUserStats]);

    // Check if we need to redirect new Pro users to category selection
    // Defer until loading complete & ensure no missed streaks pending (let popup handle those)
    useEffect(() => {
        const checkPendingUpgrade = async () => {
            if (loading || !user || !isFocused) return;

            // If user has missed streaks, STICK HERE so StreakSaverPopup can show.
            // The popup flow will handle redirection if they Reset/Holiday,
            // or loop back here (where this check will pass) if they Play/Win.
            if (hasMissedRegion || hasMissedUser) return;

            try {
                const pending = await AsyncStorage.getItem(`streak_saver_upgrade_pending_${user?.id ?? 'guest'}`);
                if (pending === 'true') {
                    router.replace('/category-selection');
                }
            } catch (e) {
                console.error('Error checking pending upgrade:', e);
            }
        };

        checkPendingUpgrade();
    }, [loading, user, isFocused, hasMissedRegion, hasMissedUser]);

    // Initial Fetch & Focus Refresh (Fixes stale data on back nav)
    useFocusEffect(
        useCallback(() => {
            if (user) {
                // Force fetch when returning to screen to ensure "Play Today" button
                // and other stats are up to date immediately after a game.
                fetchData(true);
            }
        }, [user, fetchData])
    );

    // Flag to ignore scroll events triggered by programmatic scrolling
    const isProgrammaticScroll = useRef(false);
    const isInitialScrollSync = useRef(true);

    // Sync Scroll Position with GameMode
    useEffect(() => {
        isProgrammaticScroll.current = true;
        // Don't animate on initial mount — prevents visible flick if mode somehow isn't REGION
        const shouldAnimate = !isInitialScrollSync.current;
        isInitialScrollSync.current = false;

        if (gameMode === 'REGION') {
            scrollViewRef.current?.scrollTo({ x: 0, animated: shouldAnimate });
        } else {
            scrollViewRef.current?.scrollTo({ x: SCREEN_WIDTH, animated: shouldAnimate });
        }
        // Reset flag after animation duration (approx 300ms)
        const timer = setTimeout(() => {
            isProgrammaticScroll.current = false;
        }, shouldAnimate ? 500 : 50);
        return () => clearTimeout(timer);
    }, [gameMode]);

    const onRefresh = useCallback(() => {
        setRefreshing(true);
        fetchData();
    }, [fetchData]);

    const getGreeting = () => {
        const hour = new Date().getHours();
        if (hour < 12) return "Good morning";
        if (hour < 18) return "Good afternoon";
        return "Good evening";
    };

    const handleModeChange = (mode: 'REGION' | 'USER') => {
        setGameMode(mode);
    };

    const onMomentumScrollEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
        if (isProgrammaticScroll.current) return;

        const position = event.nativeEvent.contentOffset.x;
        const index = Math.round(position / SCREEN_WIDTH);
        const newMode = index === 0 ? 'REGION' : 'USER';
        if (newMode !== gameMode) {
            setGameMode(newMode);
        }
    };

    // Default stats object moved to component scope




    const backgroundColor = useThemeColor({}, 'background');
    const surfaceColor = useThemeColor({}, 'surface');
    const iconColor = useThemeColor({}, 'icon');

    // Dynamic ad banner height (measured via onLayout in AdBanner)
    const [adBannerHeight, setAdBannerHeight] = useState(0);

    // Hydration gate removed — HomeScreenInner only mounts after snapshot is loaded
    // (handled by the HomeScreen wrapper below)

    return (
        <AdBannerContext.Provider value={true}>
            <ThemedView className="flex-1">
                <ReAnimated.View style={topFadeStyle}>
                <SafeAreaView edges={['top']} className="z-50" style={{ backgroundColor: backgroundColor }}>
                    {/* Header - Fixed & Safe Area Adjusted */}
                    <StyledView
                        className="items-center pb-2 z-50"
                        style={{ backgroundColor: backgroundColor, position: 'relative' }}
                    >

                        {/* Top Left Icon (Help) */}
                        <StyledView style={{ position: 'absolute', left: 16, top: SCREEN_WIDTH >= 768 ? 0 : 11 }}>
                            <StyledTouchableOpacity onPress={() => setHelpVisible(true)} hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}>
                                <HelpCircle size={28} color={iconColor} />
                            </StyledTouchableOpacity>
                        </StyledView>

                        {/* Top Right: Settings Icon */}
                        <StyledView style={{ position: 'absolute', right: 16, top: SCREEN_WIDTH >= 768 ? 0 : 11 }}>
                            <StyledTouchableOpacity onPress={() => router.push('/settings')} hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}>
                                <Settings size={28} color={iconColor} />
                            </StyledTouchableOpacity>
                        </StyledView>

                        {/* Title - aligned with icons at top */}
                        <ThemedText className="font-n-bold mb-3 font-heading" baseSize={SCREEN_WIDTH >= 768 ? 48 : 36} style={{ paddingTop: SCREEN_WIDTH >= 768 ? 0 : 11 }}>
                            Elementle
                        </ThemedText>

                        {SCREEN_WIDTH < 768 && (
                            <ModeToggle
                                mode={gameMode}
                                onModeChange={handleModeChange}
                                scrollX={scrollX}
                                screenWidth={SCREEN_WIDTH}
                                userLabel={firstName}
                            />
                        )}

                        {/* Greeting Row with Game Shared + Go Pro Buttons */}
                        <StyledView style={{ width: '100%', paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
                            {/* Game Shared button (left side) — only visible when a shared puzzle is pending */}
                            {showSharedButton && (
                                <StyledView style={{ position: 'absolute', left: 16 }}>
                                    <StyledTouchableOpacity
                                        onPress={handleSharedGamePress}
                                        testID="button-game-shared"
                                        style={{
                                            backgroundColor: '#e87daa',
                                            paddingHorizontal: 8 * (SCREEN_WIDTH >= 768 ? 1.25 : 1),
                                            paddingVertical: 6 * (SCREEN_WIDTH >= 768 ? 1.25 : 1),
                                            borderRadius: 8,
                                            maxWidth: 70,
                                        }}
                                    >
                                        <StyledText style={{ fontSize: 12 * (SCREEN_WIDTH >= 768 ? 1.25 : 1), fontWeight: 'bold', color: 'white', textAlign: 'center' }}>
                                            Game Shared
                                        </StyledText>
                                    </StyledTouchableOpacity>
                                </StyledView>
                            )}
                            {/* Go Pro button (right side) */}
                            <StyledView style={{ position: 'absolute', right: 16 }}>
                                <GoProButton
                                    onPress={() => {
                                        if (isPro) {
                                            router.push('/category-selection');
                                        } else {
                                            router.push('/subscription');
                                        }
                                    }}
                                    scale={SCREEN_WIDTH >= 768 ? 1.25 : 1}
                                    initialProStatus={snapshot.isPro}
                                />
                            </StyledView>
                            <ThemedText className="font-n-bold" baseSize={SCREEN_WIDTH >= 768 ? 25 : 20}>
                                {getGreeting()}
                            </ThemedText>
                        </StyledView>
                    </StyledView>
                </SafeAreaView>
                </ReAnimated.View>

                {/* Responsive Layout Switch */}
                {SCREEN_WIDTH >= 768 ? (
                    // TABLET / DESKTOP VIEW (Side-by-Side)
                    <ScrollView
                        showsVerticalScrollIndicator={false}
                        contentContainerStyle={{ paddingBottom: 40 }}
                    >
                        <StyledView className="flex-row justify-center w-full max-w-7xl self-center px-6 gap-8" style={{ marginTop: 4, flexDirection: 'row' }}>
                            {/* Left Column: Region Game (UK/World) */}
                            <StyledView className="flex-1 max-w-lg">
                                {/* Mode Label */}
                                <StyledView className="items-center" style={{ marginBottom: 5 }}>
                                    <ThemedText className="font-n-bold" lightColor="#0f172a" darkColor="#ffffff" baseSize={25}>
                                        {userRegion} Edition
                                    </ThemedText>
                                </StyledView>
                                <GameModePage
                                    isRegion={true}
                                    todayStatus={todayStatusRegion}
                                    guesses={guessesRegion}
                                    stats={regionStats}
                                    totalGames={regionStats.games_played || 0}
                                    refreshing={refreshing}
                                    onRefresh={onRefresh}
                                    holidayActive={holidayActive}
                                    setHolidayModalMode={setHolidayModalMode}
                                    setShowHolidayModal={setShowHolidayModal}
                                    router={router}
                                    incrementInteraction={incrementInteraction}
                                    width={undefined} // Let it take container width
                                    todaysPuzzleDate={todaysPuzzleDate}
                                    userPuzzleReady={true}
                                    isCheckingPuzzle={false}
                                    leagueTablesEnabled={leagueTablesEnabled}
                                    quickMenuEnabled={quickMenuEnabled}
                                    pendingLeagueInvite={pendingLeagueInviteRegion}
                                    onLeagueInviteClicked={() => handleLeagueInvitePress('region')}
                                    entryAnims={bottomEntryAnims}
                                />
                            </StyledView>

                            {/* Right Column: User Game (Personal) */}
                            <StyledView className="flex-1 max-w-lg">
                                {/* User Name Label */}
                                <StyledView className="items-center" style={{ marginBottom: 5 }}>
                                    <ThemedText className="font-n-bold" lightColor="#0f172a" darkColor="#ffffff" baseSize={25}>
                                        {firstName}
                                    </ThemedText>
                                </StyledView>
                                <GameModePage
                                    isRegion={false}
                                    todayStatus={todayStatusUser}
                                    guesses={guessesUser}
                                    stats={userStats}
                                    totalGames={userStats.games_played || 0}
                                    refreshing={refreshing}
                                    onRefresh={onRefresh}
                                    holidayActive={holidayActive}
                                    setHolidayModalMode={setHolidayModalMode}
                                    setShowHolidayModal={setShowHolidayModal}
                                    router={router}
                                    incrementInteraction={incrementInteraction}
                                    width={undefined} // Let it take container width
                                    todaysPuzzleDate={todaysPuzzleDate}
                                    userPuzzleReady={userPuzzleReady}
                                    isCheckingPuzzle={isCheckingPuzzle}
                                    leagueTablesEnabled={leagueTablesEnabled}
                                    quickMenuEnabled={quickMenuEnabled}
                                    pendingLeagueInvite={pendingLeagueInviteUser}
                                    onLeagueInviteClicked={() => handleLeagueInvitePress('user')}
                                    entryAnims={bottomEntryAnims}
                                />
                            </StyledView>
                        </StyledView>
                    </ScrollView>
                ) : (
                    // PHONE VIEW (Swiper)
                    <Animated.ScrollView
                        ref={scrollViewRef}
                        horizontal
                        pagingEnabled
                        showsHorizontalScrollIndicator={false}
                        onScroll={Animated.event(
                            [{ nativeEvent: { contentOffset: { x: scrollX } } }],
                            { useNativeDriver: false }
                        )}
                        scrollEventThrottle={16}
                        onMomentumScrollEnd={onMomentumScrollEnd}
                    >
                        {/* Region Page */}
                        <GameModePage
                            isRegion={true}
                            todayStatus={todayStatusRegion}
                            guesses={guessesRegion}
                            stats={regionStats}
                            totalGames={regionStats.games_played || 0}
                            refreshing={refreshing}
                            onRefresh={onRefresh}
                            holidayActive={holidayActive}
                            setHolidayModalMode={setHolidayModalMode}
                            setShowHolidayModal={setShowHolidayModal}
                            router={router}
                            incrementInteraction={incrementInteraction}
                            width={SCREEN_WIDTH}
                            todaysPuzzleDate={todaysPuzzleDate}
                            userPuzzleReady={true}
                            isCheckingPuzzle={false}
                            leagueTablesEnabled={leagueTablesEnabled}
                            quickMenuEnabled={quickMenuEnabled}
                            pendingLeagueInvite={pendingLeagueInviteRegion}
                            onLeagueInviteClicked={() => handleLeagueInvitePress('region')}
                            entryAnims={bottomEntryAnims}
                        />

                        {/* User Page */}
                        <GameModePage
                            isRegion={false}
                            todayStatus={todayStatusUser}
                            guesses={guessesUser}
                            stats={userStats}
                            totalGames={userStats.games_played || 0}
                            refreshing={refreshing}
                            onRefresh={onRefresh}
                            holidayActive={holidayActive}
                            setHolidayModalMode={setHolidayModalMode}
                            setShowHolidayModal={setShowHolidayModal}
                            router={router}
                            incrementInteraction={incrementInteraction}
                            width={SCREEN_WIDTH}
                            todaysPuzzleDate={todaysPuzzleDate}
                            userPuzzleReady={userPuzzleReady}
                            isCheckingPuzzle={isCheckingPuzzle}
                            leagueTablesEnabled={leagueTablesEnabled}
                            quickMenuEnabled={quickMenuEnabled}
                            pendingLeagueInvite={pendingLeagueInviteUser}
                            onLeagueInviteClicked={() => handleLeagueInvitePress('user')}
                            entryAnims={bottomEntryAnims}
                        />
                    </Animated.ScrollView>
                )}

                {/* Modals */}
                <HelpModal visible={helpVisible} onClose={() => setHelpVisible(false)} />

                {/* Badge Inbox Modal: Shows first pending badge if any */}
                <BadgeUnlockModal
                    visible={badgeModalVisible}
                    badge={(() => {
                        const unseen = pendingBadges?.filter(b => !seenBadgeIdsRef.current.has(b.id)) ?? [];
                        return unseen.length > 0 ? (unseen[0].badge ?? null) : null;
                    })()}
                    onClose={handleBadgeClose}
                    gameMode={gameMode}
                />

                {/* Trophy Celebration Modal: Shows first pending trophy if any */}
                <TrophyUnlockModal
                    visible={trophyModalVisible}
                    trophy={(() => {
                        const unseen = pendingTrophies?.filter(t => !seenTrophyIdsRef.current.has(t.id)) ?? [];
                        return unseen.length > 0 ? unseen[0] : null;
                    })()}
                    onClose={handleTrophyClose}
                />

                {/* Streak-7 Notification Prompt (moved from game-result.tsx) */}
                <ReminderPromptModal
                    visible={reminderPromptVisible}
                    onClose={async (action) => {
                        setReminderPromptVisible(false);

                        if (action === 'yes') {
                            const granted = await NotificationService.requestPermissions();
                            if (granted && user) {
                                await setReminderEnabled(true);
                                const freshData = await fetchNotificationData(user.id);
                                await NotificationService.scheduleAll({
                                    reminderEnabled: true,
                                    reminderTime: reminderTime || '09:00',
                                    streakReminderEnabled: true,
                                    streakReminderTime: streakReminderTime || '20:00',
                                }, freshData);
                                setTimeout(() => setReminderSuccessVisible(true), 300);
                            }
                        } else if (action === 'not_now') {
                            await setHasPromptedStreak7(true);
                        } else if (action === 'never') {
                            await setNeverAskReminder(true);
                        }
                    }}
                />

                {/* Reminder Success Toast */}
                <ReminderSuccessToast
                    visible={reminderSuccessVisible}
                    reminderTime={reminderTime || '11:00'}
                    onDismiss={() => setReminderSuccessVisible(false)}
                />

                <StreakSaverPopup
                    visible={streakSaverVisible}
                    onClose={(action) => {
                        setStreakSaverVisible(false);
                        // [FIX] Set dismissedPopup for both 'dismiss' and 'holiday' — signals
                        // to the deferred nav guard that the popup flow is fully complete.
                        if (action === 'dismiss' || action === 'holiday') setDismissedPopup(true);

                        // [FIX] Sequence Chain: If we just finished REGION (via decline or holiday), 
                        // and we know USER might be waiting, force a check/transition.
                        if (popupMode === 'REGION') {
                            // If action was 'decline' or 'holiday', we want to check for USER next.

                            // 1. If we used/declined, check if User needs one
                            const userHasOffer = streakSaverStatus?.user?.offerStreakSaver || streakSaverStatus?.user?.offerHolidayRescue;
                            // Exclude 'holiday' action here - if they started holiday, it covers both, so we don't prompt User.
                            // [FIX] Exclude 'use_streak_saver' - if they used it, they are navigating to game. Don't show User popup yet.
                            // When they return from game, the useEffect will naturally pick up the User offer.
                            if (userHasOffer && action === 'decline') {
                                setTimeout(() => {
                                    setPopupMode('USER');
                                    setStreakSaverVisible(true);
                                }, 500);
                            } else if (action === 'holiday') {
                                // Holiday animations are now handled within StreakSaverPopup
                                // No additional action needed here
                            }
                        }
                    }}

                    currentStreak={popupMode === 'REGION' ? regionStats.current_streak : userStats.current_streak}
                    gameType={popupMode}
                />


                {/* Ad Banner - shows at bottom for non-Pro users */}
                <AdBanner onHeightChange={setAdBannerHeight} />
            </ThemedView>
            {/* Holiday Active Modal (Home Screen Intercept) */}
            <HolidayActiveModal
                visible={showHolidayModal}
                holidayEndDate={holidayEndDate || "Unknown Date"}
                gameType={holidayModalMode}
                onExitHoliday={async () => {
                    if (!user) return;
                    console.log(`[Home] Exiting Holiday Mode for ${holidayModalMode}`);
                    try {
                        // 1. Deactivate Holiday Mode via RPC
                        await endHolidayMode(user.id, true);
                        console.log("[Home] Holiday Deactivated. Refetching stats...");

                        // 2. Refetch Stats to ensure game sees updated status
                        await Promise.all([
                            refetchStreakStatus(),
                            supabase.from('user_stats_user').select('holiday_active').eq('user_id', user.id).single(),
                            supabase.from('user_stats_region').select('holiday_active').eq('user_id', user.id).single()
                        ]);

                        // 3. [FIX] Reset today's puzzle streak_day_status from 0 → NULL
                        // so it receives normal streak treatment when played
                        const todayStr = new Date().toISOString().split('T')[0];
                        console.log(`[Home] Resetting today's (${todayStr}) holiday status to NULL`);

                        // Reset in BOTH tables - find today's attempt via allocation join
                        const resetRegion = supabase
                            .from('game_attempts_region')
                            .select('id, streak_day_status, questions_allocated_region!inner(puzzle_date)')
                            .eq('user_id', user.id)
                            .eq('questions_allocated_region.puzzle_date', todayStr)
                            .eq('streak_day_status', 0)
                            .maybeSingle();

                        const resetUser = supabase
                            .from('game_attempts_user')
                            .select('id, streak_day_status, questions_allocated_user!inner(puzzle_date)')
                            .eq('user_id', user.id)
                            .eq('questions_allocated_user.puzzle_date', todayStr)
                            .eq('streak_day_status', 0)
                            .maybeSingle();

                        const [regionAttempt, userAttempt] = await Promise.all([resetRegion, resetUser]);

                        if (regionAttempt.data?.id) {
                            await supabase
                                .from('game_attempts_region')
                                .update({ streak_day_status: null })
                                .eq('id', regionAttempt.data.id);
                            console.log('[Home] Reset region attempt holiday status to NULL');
                        }
                        if (userAttempt.data?.id) {
                            await supabase
                                .from('game_attempts_user')
                                .update({ streak_day_status: null })
                                .eq('id', userAttempt.data.id);
                            console.log('[Home] Reset user attempt holiday status to NULL');
                        }

                        // 4. Navigate to Game (Standard Mode)
                        setShowHolidayModal(false);
                        setTimeout(() => {
                            if (holidayModalMode === 'REGION') {
                                router.push('/game/REGION/today');
                            } else {
                                router.push('/game/USER/next');
                            }
                        }, 100);
                    } catch (e) {
                        console.error("[Home] Failed to deactivate holiday:", e);
                        setShowHolidayModal(false);
                        // Fallback navigation
                        if (holidayModalMode === 'REGION') {
                            router.push('/game/REGION/today');
                        } else {
                            router.push('/game/USER/next');
                        }
                    }
                }}
                onContinueHoliday={() => {
                    console.log(`[Home] Continuing in Holiday Mode for ${holidayModalMode}`);
                    setShowHolidayModal(false);
                    // Navigate with flag to preserve status
                    if (holidayModalMode === 'REGION') {
                        router.push({
                            pathname: '/game/REGION/today',
                            params: { preserveStreakStatus: 'true' }
                        });
                    } else {
                        router.push({
                            pathname: '/game/USER/next',
                            params: { preserveStreakStatus: 'true' }
                        });
                    }
                }}
            />

            <LeagueUnlockPopup
                visible={showLeagueUnlockPopup}
                onDismiss={() => setShowLeagueUnlockPopup(false)}
            />

        </AdBannerContext.Provider>
    );
}

/**
 * HomeScreen wrapper — loads the cache snapshot BEFORE mounting HomeScreenInner.
 * This ensures that useState initializers inside HomeScreenInner capture the
 * LOADED snapshot values (not defaults), eliminating content-popping on every mount.
 */
export default function HomeScreen() {
    const { user } = useAuth();
    const { snapshot, isLoaded } = useHomeCacheSnapshot(user?.id);

    // Render web version on web platform
    if (Platform.OS === 'web') {
        return <HomeScreenWeb />;
    }

    // Gate: don't mount HomeScreenInner until snapshot is loaded.
    // multiGet resolves in <15ms, well within the 2.5s splash screen window.
    if (!isLoaded) {
        return <View style={{ flex: 1, backgroundColor: '#F1F5F9' }} />;
    }

    return <HomeScreenInner snapshot={snapshot} />;
}
