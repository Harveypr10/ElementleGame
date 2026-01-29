import { View, Text, TouchableOpacity, Image, ScrollView, RefreshControl, Animated, Dimensions, NativeSyntheticEvent, NativeScrollEvent } from 'react-native';
import { useRouter, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { styled } from 'nativewind';
import { useAuth } from '../../lib/auth';
import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
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

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function HomeScreen() {
    const router = useRouter();
    const params = useLocalSearchParams(); // Use params for initialMode
    const { user } = useAuth();
    const { gameMode, setGameMode } = useOptions();
    const { pendingBadges, markBadgeAsSeen, refetchPending } = useBadgeSystem();
    const [showHolidayModal, setShowHolidayModal] = useState(false);

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
                const todayStr = new Date().toISOString().split('T')[0];

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
    }, []);

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
    } = useStreakSaverStatus();
    const { isPro } = useSubscription();
    const { incrementInteraction } = useConversionPrompt();

    // Contexts for Timing and Focus
    const { isAppReady } = useAppReadiness();
    const isFocused = useIsFocused();

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
    const { isJustCompleted } = useStreakSaver();

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
    const [userAnimationVisible, setUserAnimationVisible] = useState(false);

    // Check for streak saver eligibility and show popup
    useEffect(() => {
        // Only show popup when app is ready, screen is focused, loaded, and not dismissed
        if (isAppReady && isFocused && !loading && user && !dismissedPopup) {

            // Extract new flags from status (default to false if loading/null)
            const regionOfferStreakSaver = streakSaverStatus?.region?.offerStreakSaver ?? false;
            const regionOfferHolidayRescue = streakSaverStatus?.region?.offerHolidayRescue ?? false;

            const userOfferStreakSaver = streakSaverStatus?.user?.offerStreakSaver ?? false;
            const userOfferHolidayRescue = streakSaverStatus?.user?.offerHolidayRescue ?? false;

            // GLOBAL CHECK (Independent of current tab)
            // Prioritize Region, then User

            // 1. Region Checks
            if (!isJustCompleted('REGION')) {
                if (regionOfferHolidayRescue || regionOfferStreakSaver) {
                    setPopupMode('REGION');
                    setStreakSaverVisible(true);
                    return;
                }
            }

            // 2. User Checks
            if (!isJustCompleted('USER')) {
                if (userOfferHolidayRescue || userOfferStreakSaver) {
                    setPopupMode('USER');
                    setStreakSaverVisible(true);
                    return;
                }
            }
        }
    }, [isAppReady, isFocused, loading, streakSaverStatus, user, isJustCompleted, dismissedPopup]);





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

    const fetchData = useCallback(async () => {
        try {
            setLoading(true);
            if (!user) return;

            // Trigger Refetches for Hook Data
            refetchPending();
            refetchRegionStats();
            refetchUserStats();

            const startOfDay = new Date();
            startOfDay.setHours(0, 0, 0, 0);
            const todayStr = new Date().toISOString().split('T')[0];

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
                fetchData();
            }
        }, [user, fetchData])
    );

    // Sync Scroll Position with GameMode
    useEffect(() => {
        if (gameMode === 'REGION') {
            scrollViewRef.current?.scrollTo({ x: 0, animated: true });
        } else {
            scrollViewRef.current?.scrollTo({ x: SCREEN_WIDTH, animated: true });
        }
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
        const position = event.nativeEvent.contentOffset.x;
        const index = Math.round(position / SCREEN_WIDTH);
        const newMode = index === 0 ? 'REGION' : 'USER';
        if (newMode !== gameMode) {
            setGameMode(newMode);
        }
    };

    // Default stats object moved to component scope


    // Helper to calculate total guesses from distribution
    const calculateTotalGuesses = (distribution: any, gamesWon: number, gamesPlayed: number) => {
        if (!distribution) return 0;
        let total = 0;
        // Sum guesses for wins
        Object.entries(distribution).forEach(([guesses, count]) => {
            total += parseInt(guesses) * (count as number);
        });
        // Add guesses for losses (assuming 6 guesses for a loss)
        const losses = gamesPlayed - gamesWon;
        // The distribution usually only tracks wins in some systems, but let's stick to wins for "average guesses" 
        // usually average guesses is for WON games only.
        return total;
    };


    const renderGameContent = (isRegion: boolean) => {
        const todayStatus = isRegion ? todayStatusRegion : todayStatusUser;
        const guesses = isRegion ? guessesRegion : guessesUser;

        // Use Hook Data
        const statsData = isRegion ? regionHookStats : userHookStats;
        // Merge with defaults to prevent crashes
        const stats = statsData || defaultStats;

        const totalGames = stats.games_played || 0;

        // Colors from Web App
        const playColor = isRegion ? '#7DAAE8' : '#66becb'; // Blue (Region) vs Teal (User)
        const archiveColor = isRegion ? '#FFD429' : '#fdab58'; // Yellow (Region) vs Orange (User)
        // Green: Match the overlay box color
        const statsColor = isRegion ? '#93c54e' : '#84b86c';

        // Stats Calculations
        const winRate = totalGames > 0 ? ((stats.games_won || 0) / totalGames * 100).toFixed(0) : "0";
        const totalGuesses = calculateTotalGuesses(stats.guess_distribution, stats.games_won || 0, totalGames);
        const avgGuesses = (stats.games_won || 0) > 0 ? (totalGuesses / stats.games_won!).toFixed(1) : "0.0";

        // Percentile Logic
        const dayOfMonth = new Date().getDate();
        const percentile = stats.cumulative_monthly_percentile;
        let percentileMessage = null;

        if (dayOfMonth >= 5 && percentile !== null && percentile !== undefined && percentile > 0 && todayStatus === 'solved') {
            const roundedPercentile = Math.floor(percentile / 5) * 5;
            if (percentile >= 50) {
                percentileMessage = `You're in the top ${roundedPercentile}% of players`;
            }
        }

        // Fallback messages
        if (!percentileMessage) {
            percentileMessage = "Play the archive to boost your ranking";
        }

        // Use same hamster images for both modes (PNG only to avoid React Native freeze errors)
        const playIcon = todayStatus === 'solved' ? WinHamsterBlue : HistorianHamsterBlue;
        const archiveIcon = LibrarianHamsterYellow;
        const statsIcon = MathsHamsterGreen;

        return (
            <ScrollView
                key={isRegion ? 'region_list' : 'user_list'}
                contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
                showsVerticalScrollIndicator={false}
                style={{ width: SCREEN_WIDTH }}
            >
                {/* Main Action Buttons */}
                <View className="space-y-4">
                    {/* PERCENTILE TEXT (Dynamic & Above Play Button) */}
                    {percentileMessage && (
                        <ThemedText className="text-slate-500 font-n-medium text-center mb-4" size="base">
                            {percentileMessage}
                        </ThemedText>
                    )}

                    {/* 1. PLAY BUTTON */}
                    <HomeCard
                        testID="home-card-play"
                        title={todayStatus === 'solved' ? "Today's puzzle solved!" : "Play Today"}
                        subtitle={todayStatus !== 'solved' ? "Good luck!" : undefined}
                        icon={playIcon}
                        backgroundColor={playColor}
                        onPress={() => {
                            incrementInteraction();
                            if (holidayActive) {
                                // If Holiday Active -> Show Modal (For both Region and User)
                                setHolidayModalMode(isRegion ? 'REGION' : 'USER');
                                setShowHolidayModal(true);
                            } else {
                                // Normal Flow
                                router.push(isRegion ? '/game/REGION/today' : '/game/USER/next');
                            }
                        }}
                        height={144}
                        iconStyle={{ width: 89, height: 89 }} // Increased 15% (77->89)
                    >
                        {todayStatus === 'solved' && (
                            <View className="flex-row gap-2 mt-0 w-full">
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
                            router.push('/archive');
                        }}
                        height={120}
                        iconStyle={{ width: 78, height: 78 }}
                    >
                        {/* Games Played Box - Under Title */}
                        <View className="flex-row w-full">
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
                        height={120} // Increased by 20% (100 -> 120)
                        iconStyle={{ width: 78, height: 78 }}
                    >
                        {/* Stats Boxes */}
                        <View className="flex-row gap-2 w-full">
                            {/* % Won */}
                            <View className="mt-0 rounded-xl p-2 items-center justify-center" style={{ width: 95 }}>
                                <ThemedText className="text-slate-700 font-n-medium text-sm">% Won</ThemedText>
                                <ThemedText className="text-slate-700 font-n-bold text-xl">{winRate}%</ThemedText>
                            </View>
                            {/* Guess Avg */}
                            <View className="mt-0 rounded-xl p-2 items-center justify-center" style={{ width: 95 }}>
                                <ThemedText className="text-slate-700 font-n-medium text-sm">Guess avg</ThemedText>
                                <ThemedText className="text-slate-700 font-n-bold text-xl">{avgGuesses}</ThemedText>
                            </View>
                        </View>
                    </HomeCard>


                </View>
            </ScrollView>
        );
    };

    const backgroundColor = useThemeColor({}, 'background');
    const surfaceColor = useThemeColor({}, 'surface');
    const iconColor = useThemeColor({}, 'icon');

    return (
        <AdBannerContext.Provider value={true}>
            <ThemedView className="flex-1" style={{ paddingBottom: isPro ? 0 : 50 }}>
                <SafeAreaView edges={['top']} className="z-50" style={{ backgroundColor: backgroundColor }}>
                    {/* Header - Fixed & Safe Area Adjusted */}
                    <StyledView
                        className="items-center relative pb-2 z-50"
                        style={{ backgroundColor: backgroundColor }}
                    >

                        {/* Top Left Icon (Help) */}
                        <StyledView className="absolute left-4 top-2">
                            <StyledTouchableOpacity onPress={() => setHelpVisible(true)}>
                                <HelpCircle size={28} color={iconColor} />
                            </StyledTouchableOpacity>
                        </StyledView>

                        {/* Top Right: Settings Icon */}
                        <StyledView className="absolute right-4 top-2">
                            <StyledTouchableOpacity onPress={() => router.push('/settings')}>
                                <Settings size={28} color={iconColor} />
                            </StyledTouchableOpacity>
                        </StyledView>

                        <ThemedText className="font-n-bold mb-6 pt-2 font-heading" size="4xl">
                            Elementle
                        </ThemedText>

                        <ModeToggle
                            mode={gameMode}
                            onModeChange={handleModeChange}
                            scrollX={scrollX}
                            screenWidth={SCREEN_WIDTH}
                            userLabel={firstName}
                        />

                        {/* Greeting Row with Go Pro Button */}
                        <StyledView className="w-full px-4 flex-row items-center justify-center relative">
                            <StyledView className="absolute right-4">
                                <GoProButton
                                    onPress={() => {
                                        if (isPro) {
                                            router.push('/category-selection');
                                        } else {
                                            router.push('/subscription');
                                        }
                                    }}
                                />
                            </StyledView>
                            <ThemedText className="font-n-bold" size="xl">
                                {getGreeting()}
                            </ThemedText>
                        </StyledView>
                    </StyledView>
                </SafeAreaView>

                {/* Content Swiper */}
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
                    {renderGameContent(true)}
                    {renderGameContent(false)}
                </Animated.ScrollView>

                {/* Modals */}
                <HelpModal visible={helpVisible} onClose={() => setHelpVisible(false)} />

                {/* Badge Inbox Modal: Shows first pending badge if any */}
                <BadgeUnlockModal
                    visible={badgeModalVisible}
                    badge={pendingBadges && pendingBadges.length > 0 ? (pendingBadges[0].badge ?? null) : null}
                    onClose={handleBadgeClose}
                />

                <StreakSaverPopup
                    visible={streakSaverVisible}
                    onClose={(action) => {
                        setStreakSaverVisible(false);
                        if (action === 'dismiss') setDismissedPopup(true);

                        // Chain User Animation if Region Holiday was just activated
                        // Use timeout to ensure first modal is fully closed/unmounted
                        if (action === 'holiday' && popupMode === 'REGION') {
                            setTimeout(() => setUserAnimationVisible(true), 500);
                        }
                    }}

                    currentStreak={popupMode === 'REGION' ? regionStats.current_streak : userStats.current_streak}
                    gameType={popupMode}
                />

                {/* Chained User Animation Modal */}
                <HolidayActivationModal
                    visible={userAnimationVisible}
                    onClose={() => setUserAnimationVisible(false)}
                    filledDates={[new Date().toISOString().split('T')[0]]}
                    gameType="USER"
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
