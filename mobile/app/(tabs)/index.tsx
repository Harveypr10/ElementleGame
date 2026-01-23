import { View, Text, TouchableOpacity, Image, ScrollView, RefreshControl, Animated, Dimensions, NativeSyntheticEvent, NativeScrollEvent } from 'react-native';
import { useRouter } from 'expo-router';
import { styled } from 'nativewind';
import { useAuth } from '../../lib/auth';
import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import { HelpCircle, Settings } from 'lucide-react-native';
import { useOptions } from '../../lib/options';
import { HomeCard } from '../../components/home/HomeCard';
import { ModeToggle } from '../../components/home/ModeToggle';
import { HelpModal } from '../../components/HelpModal';
import { BadgeUnlockModal } from '../../components/game/BadgeUnlockModal';
import { StreakSaverPopup } from '../../components/game/StreakSaverPopup';
import { HolidayModePopup } from '../../components/game/HolidayModePopup';
import { HolidayModeIndicator } from '../../components/HolidayModeIndicator';
import { useBadgeSystem } from '../../hooks/useBadgeSystem';
import { useStreakSaverStatus } from '../../hooks/useStreakSaverStatus';
import { useSubscription } from '../../hooks/useSubscription';
import { useConversionPrompt } from '../../contexts/ConversionPromptContext';
import { SafeAreaView } from 'react-native-safe-area-context';
import { GoProButton } from '../../components/GoProButton';
import { AdBanner } from '../../components/AdBanner';
import { AdBannerContext } from '../../contexts/AdBannerContext';

// Import hamster images - using PNG versions to avoid React Native freeze errors with SVG
const HistorianHamsterBlue = require('../../assets/Historian-Hamster-Blue_1760977182002.png');
const LibrarianHamsterYellow = require('../../assets/Librarian-Hamster-Yellow_1760977182002.png');
const MathsHamsterGreen = require('../../assets/Maths-Hamster-Green_1760977182003.png');

const StyledView = styled(View);
const StyledText = styled(Text);
const StyledTouchableOpacity = styled(TouchableOpacity);

import { ThemedText } from '../../components/ThemedText';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function HomeScreen() {
    const router = useRouter();
    const { user } = useAuth();
    const { gameMode, setGameMode } = useOptions();
    const { pendingBadges, markBadgeAsSeen, refetchPending } = useBadgeSystem();
    const { status: streakSaverStatus, hasMissedRegion, hasMissedUser, regionCanUseStreakSaver, userCanUseStreakSaver } = useStreakSaverStatus();
    const { isPro } = useSubscription();
    const { incrementInteraction } = useConversionPrompt();

    // Data States
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [helpVisible, setHelpVisible] = useState(false);

    // Badge Display State
    const [badgeModalVisible, setBadgeModalVisible] = useState(false);

    // Streak Saver Popup State
    const [streakSaverVisible, setStreakSaverVisible] = useState(false);
    const [holidayModeVisible, setHolidayModeVisible] = useState(false);

    // Sync modal visibility with pending badges
    useEffect(() => {
        if (pendingBadges && pendingBadges.length > 0) {
            setBadgeModalVisible(true);
        } else {
            setBadgeModalVisible(false);
        }
    }, [pendingBadges]);

    // Check for streak saver eligibility and show popup
    useEffect(() => {
        // Only show popup when not loading and user hasn't already been prompted
        if (!loading && user) {
            // Check based on current game mode
            if (gameMode === 'REGION' && regionCanUseStreakSaver) {
                setStreakSaverVisible(true);
            } else if (gameMode === 'USER' && userCanUseStreakSaver) {
                setStreakSaverVisible(true);
            }
        }
    }, [loading, gameMode, regionCanUseStreakSaver, userCanUseStreakSaver, user]);

    const handleBadgeClose = async () => {
        if (pendingBadges && pendingBadges.length > 0) {
            const badgeToMark = pendingBadges[0];
            // Optimistically close to prep for next or end
            setBadgeModalVisible(false);

            // Mark as seen, triggering query update
            await markBadgeAsSeen(badgeToMark.badge_id);
            // The useEffect will make it visible again if there are more
        }
    };

    // Region Stats
    const [todayStatusRegion, setTodayStatusRegion] = useState<'not-played' | 'solved' | 'failed'>('not-played');
    const [guessesRegion, setGuessesRegion] = useState(0);
    const [totalGamesRegion, setTotalGamesRegion] = useState(0);
    const [percentileRegion, setPercentileRegion] = useState<number | null>(null);

    // User Stats
    const [todayStatusUser, setTodayStatusUser] = useState<'not-played' | 'solved' | 'failed'>('not-played');
    const [guessesUser, setGuessesUser] = useState(0);
    const [totalGamesUser, setTotalGamesUser] = useState(0);
    const [percentileUser, setPercentileUser] = useState<number | null>(null);
    const [firstName, setFirstName] = useState("User");

    // Animation & Scroll Refs
    const scrollX = useRef(new Animated.Value(0)).current;
    const scrollViewRef = useRef<ScrollView>(null);

    const fetchData = useCallback(async () => {
        try {
            setLoading(true);
            if (!user) return;

            // Also refresh badges
            refetchPending();

            const startOfDay = new Date();
            startOfDay.setHours(0, 0, 0, 0);

            // ==========================================
            // 1. REGION DATA (Global)
            // ==========================================
            const { data: attemptsReg } = await supabase
                .from('game_attempts_region')
                .select('*')
                .eq('user_id', user.id)
                .gte('updated_at', startOfDay.toISOString());

            if (attemptsReg && attemptsReg.length > 0) {
                const won = attemptsReg.some(a => a.result === 'won');
                setTodayStatusRegion(won ? 'solved' : 'not-played');
                if (won) setGuessesRegion(attemptsReg.find(a => a.result === 'won')?.num_guesses || 0);
            } else {
                setTodayStatusRegion('not-played');
            }

            const { count: countReg } = await supabase
                .from('game_attempts_region')
                .select('*', { count: 'exact', head: true })
                .eq('user_id', user.id)
                .in('result', ['won', 'lost']);
            setTotalGamesRegion(countReg || 0);

            const { data: statsReg } = await supabase
                .from('user_stats_region')
                .select('cumulative_monthly_percentile')
                .eq('user_id', user.id)
                .single();
            if (statsReg) setPercentileRegion(statsReg.cumulative_monthly_percentile);

            // ==========================================
            // 2. USER DATA (Endless/Personal)
            // ==========================================
            const { data: attemptsUser } = await supabase
                .from('game_attempts_user')
                .select('*')
                .eq('user_id', user.id)
                .gte('updated_at', startOfDay.toISOString());

            if (attemptsUser && attemptsUser.length > 0) {
                const won = attemptsUser.some(a => a.result === 'won');
                setTodayStatusUser(won ? 'solved' : 'not-played');
                if (won) setGuessesUser(attemptsUser.find(a => a.result === 'won')?.num_guesses || 0);
            } else {
                setTodayStatusUser('not-played');
            }

            const { count: countUser } = await supabase
                .from('game_attempts_user')
                .select('*', { count: 'exact', head: true })
                .eq('user_id', user.id)
                .in('result', ['won', 'lost']);
            setTotalGamesUser(countUser || 0);

            const { data: statsUser } = await supabase
                .from('user_stats_user')
                .select('cumulative_monthly_percentile')
                .eq('user_id', user.id)
                .single();
            if (statsUser) setPercentileUser(statsUser.cumulative_monthly_percentile);

            // Fetch Profile Name
            const { data: profile } = await supabase
                .from('user_profiles')
                .select('first_name')
                .eq('id', user.id)
                .single();
            if (profile?.first_name) {
                setFirstName(profile.first_name);
            }

        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [user, refetchPending]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    // Initial Scroll Position based on GameMode
    useEffect(() => {
        if (gameMode === 'REGION') {
            scrollViewRef.current?.scrollTo({ x: 0, animated: false });
        } else {
            scrollViewRef.current?.scrollTo({ x: SCREEN_WIDTH, animated: false });
        }
    }, []);

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
        if (mode === 'REGION') {
            scrollViewRef.current?.scrollTo({ x: 0, animated: true });
        } else {
            scrollViewRef.current?.scrollTo({ x: SCREEN_WIDTH, animated: true });
        }
    };

    const onMomentumScrollEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
        const position = event.nativeEvent.contentOffset.x;
        const index = Math.round(position / SCREEN_WIDTH);
        const newMode = index === 0 ? 'REGION' : 'USER';
        if (newMode !== gameMode) {
            setGameMode(newMode);
        }
    };

    const renderGameContent = (isRegion: boolean) => {
        const todayStatus = isRegion ? todayStatusRegion : todayStatusUser;
        const totalGames = isRegion ? totalGamesRegion : totalGamesUser;
        const guesses = isRegion ? guessesRegion : guessesUser;

        // Colors from Web App
        const playColor = isRegion ? '#7DAAE8' : '#66becb'; // Blue (Region) vs Teal (User)
        const archiveColor = isRegion ? '#FFD429' : '#fdab58'; // Yellow (Region) vs Orange (User)

        // Percentile Logic
        const dayOfMonth = new Date().getDate();
        const percentile = isRegion ? percentileRegion : percentileUser;
        let percentileMessage = null;

        if (dayOfMonth >= 5 && percentile !== null && percentile > 0 && todayStatus === 'solved') {
            const roundedPercentile = Math.floor(percentile / 5) * 5;
            if (percentile >= 50) {
                percentileMessage = `You're in the top ${roundedPercentile}% of players`;
            }
        }

        // Fallback messages
        if (!percentileMessage) {
            if (isRegion) {
                percentileMessage = "Play the archive to boost your ranking";
            } else {
                // User mode fallback - always show a message
                percentileMessage = "Play the archive to boost your ranking";
            }
        }

        // Use same hamster images for both modes (PNG only to avoid React Native freeze errors)
        const playIcon = HistorianHamsterBlue;
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
                        subtitle={todayStatus === 'solved'
                            ? `Solved in ${guesses} guesses`
                            : "Good luck!"}
                        icon={playIcon}
                        backgroundColor={playColor}
                        onPress={() => {
                            incrementInteraction();
                            router.push(isRegion ? '/game/REGION/today' : '/game/USER/next');
                        }}
                        height={160}
                    />

                    {/* 2. ARCHIVE BUTTON */}
                    <HomeCard
                        testID="home-card-archive"
                        title="Archive"
                        subtitle={`${totalGames} total games played`}
                        icon={archiveIcon}
                        backgroundColor={archiveColor}
                        onPress={() => {
                            incrementInteraction();
                            router.push('/archive');
                        }}
                        height={100}
                    />

                    {/* 3. STATS BUTTON (Full Width) */}
                    <HomeCard
                        testID="home-card-stats"
                        title={isRegion ? "UK Stats" : "Personal Stats"}
                        subtitle="View your performance history"
                        icon={statsIcon}
                        backgroundColor={isRegion ? '#A4DB57' : '#93cd78'}
                        onPress={() => {
                            incrementInteraction();
                            router.push(`/stats?mode=${isRegion ? 'REGION' : 'USER'}`);
                        }}
                        height={100}
                    />
                </View>
            </ScrollView>
        );
    };

    return (
        <AdBannerContext.Provider value={true}>
            <View className="flex-1 bg-white dark:bg-slate-900" style={{ paddingBottom: isPro ? 0 : 50 }}>
                <SafeAreaView edges={['top']} className="bg-white dark:bg-slate-900 z-50">
                    {/* Header - Fixed & Safe Area Adjusted */}
                    <StyledView className="items-center relative pb-2 bg-white dark:bg-slate-900 z-50">

                        {/* Top Left Icon (Help) */}
                        <StyledView className="absolute left-4 top-2">
                            <StyledTouchableOpacity onPress={() => setHelpVisible(true)}>
                                <HelpCircle size={28} className="text-slate-800 dark:text-white" />
                            </StyledTouchableOpacity>
                        </StyledView>

                        {/* Top Right: Settings Icon */}
                        <StyledView className="absolute right-4 top-2">
                            <StyledTouchableOpacity onPress={() => router.push('/settings')}>
                                <Settings size={28} className="text-slate-800 dark:text-white" />
                            </StyledTouchableOpacity>
                        </StyledView>

                        <ThemedText className="font-n-bold text-slate-900 dark:text-white mb-6 pt-2 font-heading" size="4xl">
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
                            <ThemedText className="font-n-bold text-slate-900 dark:text-white" size="xl">
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

                {/* Ad Banner - shows at bottom for non-Pro users */}
                <AdBanner />
            </View>
        </AdBannerContext.Provider>
    );
}
