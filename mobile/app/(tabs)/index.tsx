import { View, Text, TouchableOpacity, Image, ScrollView, RefreshControl, Animated, Dimensions, NativeSyntheticEvent, NativeScrollEvent, useWindowDimensions, Platform } from 'react-native';
import { useRouter, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { styled } from 'nativewind';
import { useAuth } from '../../lib/auth';
import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';

// Web version import
import HomeScreenWeb from './index.web';
import { supabase } from '../../lib/supabase';
import { HelpCircle, Settings } from 'lucide-react-native';
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
import { usePuzzleReadiness } from '../../hooks/usePuzzleReadiness';

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
    dismissedHolidayModal
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
    dismissedHolidayModal?: boolean // Guard to prevent holiday modal from re-showing after dismissal
}) => {
    // Colors from Web App
    const playColor = isRegion ? '#7DAAE8' : '#66becb'; // Blue (Region) vs Teal (User)
    const archiveColor = isRegion ? '#FFD429' : '#fdab58'; // Yellow (Region) vs Orange (User)
    // Green: Match the overlay box color
    const statsColor = isRegion ? '#93c54e' : '#84b86c';

    // Responsive scaling for large screens - use actual screen width
    const { width: screenWidth } = useWindowDimensions();
    const scale = screenWidth >= 768 ? 1.25 : 1;

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
            <View className="space-y-4">
                {/* PERCENTILE TEXT (Dynamic & Above Play Button) */}
                {percentileMessage && (
                    <ThemedText className="text-slate-500 font-n-medium text-center mb-4" baseSize={16 * scale}>
                        {percentileMessage}
                    </ThemedText>
                )}

                {/* 1. PLAY BUTTON */}
                <HomeCard
                    testID="home-card-play"
                    title={
                        !isRegion && !userPuzzleReady && !isCheckingPuzzle
                            ? "One moment, Hammie is still cooking up today's puzzle..."
                            : todayStatus === 'solved' ? "Today's puzzle solved!" : "Play Today"
                    }
                    subtitle={!isRegion && !userPuzzleReady ? undefined : (todayStatus !== 'solved' ? "Good luck!" : undefined)}
                    icon={playIcon}
                    backgroundColor={playColor}
                    disabled={!isRegion && !userPuzzleReady && todayStatus === 'not-played'}
                    onPress={() => {
                        incrementInteraction();
                        console.log(`[Home] Play Today pressed. HolidayActive: ${holidayActive}, Status: ${todayStatus}`);

                        // [FIX] Only show Holiday Popup if the game hasn't been played yet.
                        // If it's solved or failed, we allow navigation to review.
                        if (holidayActive && todayStatus === 'not-played' && !dismissedHolidayModal) {
                            setHolidayModalMode(isRegion ? 'REGION' : 'USER');
                            setShowHolidayModal(true);
                        } else {
                            // Use the centralized today's puzzle date passed from parent
                            router.push(isRegion ? `/game/REGION/${todaysPuzzleDate}` : `/game/USER/${todaysPuzzleDate}`);
                        }
                    }}
                    height={144}
                    iconStyle={{ width: 89, height: 89 }}
                    scale={scale}
                >
                    {todayStatus === 'solved' && (
                        <View className="flex-row gap-2 mt-0 w-full" style={{ flexDirection: 'row' }}>
                            {/* Solved In Box */}
                            <View className="rounded-xl p-2 items-center justify-center" style={{ width: 95 }}>
                                <ThemedText className="text-slate-700 font-n-medium text-sm">Solved in</ThemedText>
                                <ThemedText className="text-slate-700 font-n-bold text-xl">{guesses}</ThemedText>
                            </View>
                            {/* Streak Box */}
                            <View className="rounded-xl p-2 items-center justify-center" style={{ width: 95 }}>
                                <ThemedText className="text-slate-700 font-n-medium text-sm">Streak</ThemedText>
                                <ThemedText className="text-slate-700 font-n-bold text-xl">{stats.current_streak}</ThemedText>
                            </View>
                        </View>
                    )}
                </HomeCard>

                {/* 2. ARCHIVE BUTTON */}
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
                    scale={scale}
                >
                    <View className="flex-row w-full" style={{ flexDirection: 'row' }}>
                        <View className="mt-0 rounded-xl p-2 items-center justify-center" style={{ width: 95 }}>
                            <ThemedText className="text-slate-700 font-n-medium text-sm">Played</ThemedText>
                            <ThemedText className="text-slate-700 font-n-bold text-xl">{totalGames}</ThemedText>
                        </View>
                    </View>
                </HomeCard>

                {/* 3. STATS BUTTON */}
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
                    scale={scale}
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
            </View>
        </ScrollView>
    );
});

export default function HomeScreen() {
    // Render web version on web platform
    if (Platform.OS === 'web') {
        return <HomeScreenWeb />;
    }

    // [WEB FIX] Use useWindowDimensions hook for reactive width detection on web
    const { width: SCREEN_WIDTH } = useWindowDimensions();

    const router = useRouter();
    const params = useLocalSearchParams(); // Use params for initialMode
    const { user } = useAuth();
    const { gameMode, setGameMode } = useOptions();
    const { profile } = useProfile();
    const userRegion = profile?.region || 'UK';
    const { pendingBadges, markBadgeAsSeen, refetchPending } = useBadgeSystem();
    const [showHolidayModal, setShowHolidayModal] = useState(false);
    const [dismissedHolidayModal, setDismissedHolidayModal] = useState(false);

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
        }
    }, [isFocused]);

    // Check for initialMode param from Game Return
    // Removed initialMode param listener to rely on persistent useOptions context


    // Hook-based Stats (Cached & Fast)
    const { stats: regionHookStats, refetch: refetchRegionStats } = useUserStats('REGION');
    const { stats: userHookStats, refetch: refetchUserStats } = useUserStats('USER');

    // Resolve Stats with Defaults (Available for render and Modals)
    const defaultStats = { current_streak: 0, games_played: 0, games_won: 0, guess_distribution: {}, cumulative_monthly_percentile: null };
    const regionStats = regionHookStats || defaultStats;
    const userStats = userHookStats || defaultStats;

    // Load Cached Data on Mount to prevent FOUC
    useEffect(() => {
        const loadCache = async () => {
            try {
                // Use the centralized today's puzzle date
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

    // Track which mode triggered the Holiday Modal (to route correctly on Continue/Exit)
    const [holidayModalMode, setHolidayModalMode] = useState<'REGION' | 'USER'>('USER');

    const {
        status: streakSaverStatus,
        isLoading: isStreakSaverLoading,
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

    // Data States
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [helpVisible, setHelpVisible] = useState(false);

    // Badge Display State
    const [badgeModalVisible, setBadgeModalVisible] = useState(false);

    // Streak Saver Popup State
    const [streakSaverVisible, setStreakSaverVisible] = useState(false);
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
        if (isAppReady && pendingBadges && pendingBadges.length > 0) {
            setBadgeModalVisible(true);
        } else {
            setBadgeModalVisible(false);
        }
    }, [pendingBadges, isAppReady]);

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
            isInStreakSaverMode
        });

        // Only show popup when app is ready, screen is focused, loaded, and not dismissed
        // [FIX] Also suppress if we are currently IN a streak saver mode (e.g. just clicked "Use")
        if (isAppReady && isFocused && !loading && user && !dismissedPopup && !isInStreakSaverMode) {

            // Extract new flags from status (default to false if loading/null)
            const regionOfferStreakSaver = streakSaverStatus?.region?.offerStreakSaver ?? false;
            const regionOfferHolidayRescue = streakSaverStatus?.region?.offerHolidayRescue ?? false;

            const userOfferStreakSaver = streakSaverStatus?.user?.offerStreakSaver ?? false;
            const userOfferHolidayRescue = streakSaverStatus?.user?.offerHolidayRescue ?? false;

            // [FIX] If popup is currently visible, check if the current popupMode still meets criteria
            // This handles the case where holiday mode was activated, invalidating the flags
            if (streakSaverVisible) {
                const currentModeStillEligible =
                    (popupMode === 'REGION' && (regionOfferStreakSaver || regionOfferHolidayRescue) && !holidayActive) ||
                    (popupMode === 'USER' && (userOfferStreakSaver || userOfferHolidayRescue) && !holidayActive);

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
                if ((regionOfferHolidayRescue || regionOfferStreakSaver) && !holidayActive) {
                    console.log('[Home PopupCheck] Showing REGION popup');
                    setPopupMode('REGION');
                    setStreakSaverVisible(true);
                    return;
                }
            }

            // 2. User Checks
            if (!isJustCompleted('USER')) {
                if ((userOfferHolidayRescue || userOfferStreakSaver) && !holidayActive) {
                    console.log('[Home PopupCheck] Showing USER popup');
                    setPopupMode('USER');
                    setStreakSaverVisible(true);
                    return;
                }
            }

            console.log('[Home PopupCheck] No popup to show');
        }
    }, [isAppReady, isFocused, loading, streakSaverStatus, user, isJustCompleted, dismissedPopup, streakSaverVisible, popupMode, isInStreakSaverMode, holidayActive]);





    const handleBadgeClose = async () => {
        if (pendingBadges && pendingBadges.length > 0) {
            const badgeToMark = pendingBadges[0];
            // Optimistically close to prep for next or end
            setBadgeModalVisible(false);

            // Mark as seen, triggering query update
            // [FIX] Use the ROW ID (id) not the badge definition ID (badge_id)
            await markBadgeAsSeen(badgeToMark.id);
            // The useEffect will make it visible again if there are more
        }
    };

    // Region Stats
    const [todayStatusRegion, setTodayStatusRegion] = useState<'not-played' | 'solved' | 'failed'>('not-played');
    const [guessesRegion, setGuessesRegion] = useState(0);


    // User Stats
    const [todayStatusUser, setTodayStatusUser] = useState<'not-played' | 'solved' | 'failed'>('not-played');
    const [guessesUser, setGuessesUser] = useState(0);

    const [firstName, setFirstName] = useState("User");

    // Animation & Scroll Refs
    const scrollX = useRef(new Animated.Value(0)).current;
    const scrollViewRef = useRef<ScrollView>(null);

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
                    AsyncStorage.setItem('cached_game_status_region', JSON.stringify({
                        date: todayStr,
                        status: status,
                        guesses: guesses
                    }));
                } else {
                    setTodayStatusRegion('not-played');
                    // Cache Region Status (Not Played) - Clear or set default?
                    // Better to overwrite with current state
                    AsyncStorage.setItem('cached_game_status_region', JSON.stringify({
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
                    AsyncStorage.setItem('cached_game_status_user', JSON.stringify({
                        date: todayStr,
                        status: status,
                        guesses: guesses
                    }));
                } else {
                    setTodayStatusUser('not-played');
                    AsyncStorage.setItem('cached_game_status_user', JSON.stringify({
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
                AsyncStorage.setItem('cached_first_name', profile.first_name);
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
                const pending = await AsyncStorage.getItem('streak_saver_upgrade_pending');
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

    // Sync Scroll Position with GameMode
    useEffect(() => {
        isProgrammaticScroll.current = true;
        if (gameMode === 'REGION') {
            scrollViewRef.current?.scrollTo({ x: 0, animated: true });
        } else {
            scrollViewRef.current?.scrollTo({ x: SCREEN_WIDTH, animated: true });
        }
        // Reset flag after animation duration (approx 300ms)
        const timer = setTimeout(() => {
            isProgrammaticScroll.current = false;
        }, 500);
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

    return (
        <AdBannerContext.Provider value={true}>
            <ThemedView className="flex-1" style={{ paddingBottom: isPro ? 0 : 50 }}>
                <SafeAreaView edges={['top']} className="z-50" style={{ backgroundColor: backgroundColor }}>
                    {/* Header - Fixed & Safe Area Adjusted */}
                    <StyledView
                        className="items-center pb-2 z-50"
                        style={{ backgroundColor: backgroundColor, position: 'relative' }}
                    >

                        {/* Top Left Icon (Help) */}
                        <StyledView style={{ position: 'absolute', left: 16, top: 8 }}>
                            <StyledTouchableOpacity onPress={() => setHelpVisible(true)}>
                                <HelpCircle size={28} color={iconColor} />
                            </StyledTouchableOpacity>
                        </StyledView>

                        {/* Top Right: Settings Icon */}
                        <StyledView style={{ position: 'absolute', right: 16, top: 8 }}>
                            <StyledTouchableOpacity onPress={() => router.push('/settings')}>
                                <Settings size={28} color={iconColor} />
                            </StyledTouchableOpacity>
                        </StyledView>

                        {/* Title - reduced top padding by 60% */}
                        <ThemedText className="font-n-bold mb-3 font-heading" baseSize={SCREEN_WIDTH >= 768 ? 48 : 36} style={{ paddingTop: 16 }}>
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

                        {/* Greeting Row with Go Pro Button */}
                        <StyledView style={{ width: '100%', paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
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
                                />
                            </StyledView>
                            <ThemedText className="font-n-bold" baseSize={SCREEN_WIDTH >= 768 ? 25 : 20}>
                                {getGreeting()}
                            </ThemedText>
                        </StyledView>
                    </StyledView>
                </SafeAreaView>

                {/* Responsive Layout Switch */}
                {SCREEN_WIDTH >= 768 ? (
                    // TABLET / DESKTOP VIEW (Side-by-Side)
                    <ScrollView
                        showsVerticalScrollIndicator={false}
                        contentContainerStyle={{ paddingBottom: 40 }}
                    >
                        <StyledView className="flex-row justify-center w-full max-w-7xl self-center px-6 gap-8" style={{ marginTop: 8, flexDirection: 'row' }}>
                            {/* Left Column: Region Game (UK/World) */}
                            <StyledView className="flex-1 max-w-lg">
                                {/* Mode Label */}
                                <StyledView className="items-center" style={{ marginBottom: 10 }}>
                                    <ThemedText className="font-n-bold text-slate-900 dark:text-white" baseSize={25}>
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
                                    dismissedHolidayModal={dismissedHolidayModal}
                                />
                            </StyledView>

                            {/* Right Column: User Game (Personal) */}
                            <StyledView className="flex-1 max-w-lg">
                                {/* User Name Label */}
                                <StyledView className="items-center" style={{ marginBottom: 10 }}>
                                    <ThemedText className="font-n-bold text-slate-900 dark:text-white" baseSize={25}>
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
                                    dismissedHolidayModal={dismissedHolidayModal}
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
                            dismissedHolidayModal={dismissedHolidayModal}
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
                            dismissedHolidayModal={dismissedHolidayModal}
                        />
                    </Animated.ScrollView>
                )}

                {/* Modals */}
                <HelpModal visible={helpVisible} onClose={() => setHelpVisible(false)} />

                {/* Badge Inbox Modal: Shows first pending badge if any */}
                <BadgeUnlockModal
                    visible={badgeModalVisible}
                    badge={pendingBadges && pendingBadges.length > 0 ? (pendingBadges[0].badge ?? null) : null}
                    onClose={handleBadgeClose}
                    gameMode={gameMode}
                />

                <StreakSaverPopup
                    visible={streakSaverVisible}
                    onClose={(action) => {
                        setStreakSaverVisible(false);
                        if (action === 'dismiss') setDismissedPopup(true);

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
                <AdBanner />
            </ThemedView>
            {/* Holiday Active Modal (Home Screen Intercept) */}
            <HolidayActiveModal
                visible={showHolidayModal}
                holidayEndDate={holidayEndDate || "Unknown Date"}
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

                        // 3. Navigate to Game (Standard Mode)
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
                    setDismissedHolidayModal(true);
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

        </AdBannerContext.Provider>
    );
}
