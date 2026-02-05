
import React, { useEffect, useState, useRef } from 'react';
import { View, Text, ActivityIndicator, Alert, TouchableOpacity, Animated } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft, Calendar, HelpCircle } from 'lucide-react-native';
import { ActiveGame } from '../../../components/game/ActiveGame';
import { useAuth } from '../../../lib/auth';
import { useOptions } from '../../../lib/options';
import { supabase } from '../../../lib/supabase';
import { format } from 'date-fns';
import { ThemedView } from '../../../components/ThemedView';
import { ThemedText } from '../../../components/ThemedText';
import { useThemeColor } from '../../../hooks/useThemeColor';
import { useStreakSaver } from '../../../contexts/StreakSaverContext';
import { useStreakSaverStatus } from '../../../hooks/useStreakSaverStatus';
import { StreakSaverExitWarning } from '../../../components/StreakSaverExitWarning';
import { HelpModal } from '../../../components/HelpModal';
import { useNetwork } from '../../../contexts/NetworkContext';

export default function GameScreen() {
    const backgroundColor = useThemeColor({}, 'background');
    const iconColor = useThemeColor({}, 'icon');
    const surfaceColor = useThemeColor({}, 'surface');
    const textColor = useThemeColor({}, 'text');

    const params = useLocalSearchParams();
    // Safely parse params which might be arrays
    const modeParam = Array.isArray(params.mode) ? params.mode[0] : params.mode;

    // Header Colors
    const isUserMode = modeParam === 'USER';
    const brandColor = isUserMode ? '#66becb' : '#7DAAE8'; // Teal (User) / Blue (Region)
    const headerIconColor = '#FFFFFF';
    const idParam = Array.isArray(params.id) ? params.id[0] : params.id;

    // Explicitly cast to string for subsequent logic
    const mode = modeParam as string;
    const id = idParam as string;

    // GUARD: If params are not ready, show loading.
    // This Prevents "Cross-Contamination" where undefined 'mode' defaults to 'USER' logic.
    if (!mode || !id) {
        return (
            <SafeAreaView className="flex-1 bg-white dark:bg-slate-900 justify-center items-center">
                <ActivityIndicator size="large" color="#3b82f6" />
            </SafeAreaView>
        );
    }

    const router = useRouter();
    const { user } = useAuth();


    // -- FIXED: HOOKS MOVED TO TOP LEVEL --
    const [gameState, setGameState] = useState<'loading' | 'playing' | 'won' | 'lost'>('loading');
    const isGuest = !user;

    // Streak Saver Integration
    const { isInStreakSaverMode, streakSaverSession } = useStreakSaver();
    const { declineStreakSaver } = useStreakSaverStatus();
    const [showExitWarning, setShowExitWarning] = useState(false);
    const [helpVisible, setHelpVisible] = useState(false);


    // Intercept back navigation
    const handleBack = async () => {
        // Only show warning if ALL of these conditions are true:
        // 1. User is in streak saver mode (has an active session)
        // 2. The current game is not finished (not won/lost)
        // 3. The current puzzle matches the streak saver session's puzzle date AND game type
        const isPlayingStreakSaverPuzzle = streakSaverSession && puzzle &&
            streakSaverSession.puzzleDate === puzzle.date &&
            streakSaverSession.gameType === mode;

        if (isInStreakSaverMode && isPlayingStreakSaverPuzzle && gameState !== 'won' && gameState !== 'lost') {
            // If in streak saver AND playing the actual streak saver puzzle (yesterday's), show warning
            setShowExitWarning(true);
            return;
        }

        performBackNavigation();
    };

    const performBackNavigation = () => {
        if (isGuest) {
            // For guests, always replace to onboarding - don't use router.back()
            // as the navigation stack may contain unintended destinations
            router.replace('/(auth)/onboarding');
        } else {
            router.back();
        }
    };

    const handleConfirmExit = async () => {
        // User chose to exit and lose streak
        setShowExitWarning(false);
        try {
            // Decline/Cancel the streak saver for this mode
            // We need to know which mode we are in (REGION or USER)
            const gameType = mode === 'REGION' ? 'REGION' : 'USER';
            await declineStreakSaver(gameType);
        } catch (e) {
            console.error('[GameScreen] Error declining streak saver:', e);
        } finally {
            performBackNavigation();
        }
    };
    // -------------------------------------

    const [loading, setLoading] = useState(true);
    const [puzzle, setPuzzle] = useState<any>(null);
    const [debugInfo, setDebugInfo] = useState<string>("");

    const isRegion = mode === 'REGION';
    const modeStr = isRegion ? 'REGION' : 'USER';
    const puzzleIdParam = id as string;

    const { cluesEnabled } = useOptions();

    // Use a ref to prevent double-firing useEffect
    const hasFetched = useRef(false);

    useEffect(() => {
        if (!hasFetched.current) {
            console.log('[GameScreen] Fetching puzzle. Params:', { mode, id });
            hasFetched.current = true;
            fetchPuzzle();
        }
    }, [mode, id, user?.id]);

    const { isConnected } = useNetwork();

    const fetchPuzzle = async () => {
        const now = new Date();
        const today = now.toISOString().split('T')[0];

        // Determine Cache Key based on params
        // If param is 'today', we resolve to current date for the key to ensure freshness per day
        const resolvedId = (puzzleIdParam === 'today' || puzzleIdParam === 'next') ? today : puzzleIdParam;
        const CACHE_KEY = `puzzle_data_${modeStr}_${resolvedId}`;

        try {
            setLoading(true);
            setDebugInfo("");

            // 1. Try Cache First (Always check cache to enable fast load)
            try {
                const cached = await AsyncStorage.getItem(CACHE_KEY);
                if (cached) {
                    const parsed = JSON.parse(cached);
                    console.log('[GameScreen] Loaded puzzle from cache:', CACHE_KEY);
                    setPuzzle(parsed);

                    // If offline, we are done!
                    // If online, we could continue to fetch to "revalidate" (stale-while-revalidate),
                    // but puzzle data is largely static. If we have it, we probably trust it.
                    // Exception: User might want latest data if there was a fix.
                    // For now, if we found cache, let's treat it as good enough to render immediately.
                    // We can let the network request run in background if we want, but simpler to just use cache.

                    // However, we MUST check if we are offline.
                    if (isConnected === false) {
                        setLoading(false);
                        return;
                    }
                }
            } catch (e) {
                console.log('[GameScreen] Cache read error', e);
            }

            // 2. Network Fetch
            if (isConnected === false && !puzzle) {
                // No cache and no internet
                setDebugInfo("You are offline and no question data was found on this device.");
                setLoading(false);
                return;
            }

            console.log(`[GameScreen] Fetching Puzzle from DB. Mode: ${modeStr}, Param: ${puzzleIdParam}, ID: ${resolvedId}`);

            let allocationData: any = null;
            let masterData: any = null;

            if (isRegion) {
                // REGION MODE QUERY
                let regionQuery = supabase.from('questions_allocated_region').select('*, categories(id, name)');

                if (puzzleIdParam === 'today') {
                    regionQuery = regionQuery.eq('region', 'UK').eq('puzzle_date', today);
                } else if (/^\d{4}-\d{2}-\d{2}$/.test(puzzleIdParam)) {
                    regionQuery = regionQuery.eq('region', 'UK').eq('puzzle_date', puzzleIdParam);
                } else {
                    const idInt = parseInt(puzzleIdParam, 10);
                    if (!isNaN(idInt)) {
                        regionQuery = regionQuery.eq('id', idInt).eq('region', 'UK');
                    } else {
                        console.error("Invalid puzzle ID:", puzzleIdParam);
                        setPuzzle(null); setLoading(false); return;
                    }
                }

                const { data: allocRes, error: allocError } = await regionQuery.maybeSingle();

                if (allocError) {
                    // Start offline fallback if needed (handled by catch below usually)
                    throw allocError;
                }

                if (!allocRes) {
                    console.warn(`[GameScreen] No Region allocation found for ${puzzleIdParam}`);
                    if (puzzleIdParam === 'today') {
                        /* ... recent logic omitted for brevity, keeping simple error ... */
                        setDebugInfo(`No puzzle found for today (${today}).`);
                    }
                    setPuzzle(null); setLoading(false); return;
                }

                allocationData = allocRes;

                if (allocRes.question_id) {
                    const { data: master, error: masterError } = await supabase
                        .from('questions_master_region')
                        .select('*')
                        .eq('id', allocRes.question_id)
                        .maybeSingle();
                    masterData = master;
                }

            } else {
                // USER MODE QUERY
                if (!user?.id) {
                    setPuzzle(null); setLoading(false); return;
                }

                let query = supabase.from('questions_allocated_user').select('*, categories(id, name)');

                if (puzzleIdParam === 'next') {
                    query = query.eq('user_id', user.id).eq('puzzle_date', today);
                } else if (/^\d{4}-\d{2}-\d{2}$/.test(puzzleIdParam)) {
                    query = query.eq('user_id', user.id).eq('puzzle_date', puzzleIdParam);
                } else {
                    const idInt = parseInt(puzzleIdParam, 10);
                    if (!isNaN(idInt)) {
                        query = query.eq('id', idInt).eq('user_id', user.id);
                    } else {
                        setPuzzle(null); setLoading(false); return;
                    }
                }

                const { data: allocRes, error: allocError } = await query.maybeSingle();

                if (allocError) throw allocError;

                if (!allocRes) {
                    setDebugInfo(`No puzzle found for ${puzzleIdParam}`);
                    setPuzzle(null); setLoading(false); return;
                }

                allocationData = allocRes;

                if (allocRes.question_id) {
                    const { data: master, error: masterError } = await supabase
                        .from('questions_master_user')
                        .select('*, populated_places!populated_place_id(name1)')
                        .eq('id', allocRes.question_id)
                        .maybeSingle();
                    masterData = master;
                }
            }

            if (allocationData) {
                const finalPuzzle = {
                    id: allocationData.id,
                    title: masterData?.event_title || masterData?.title || `Puzzle #${allocationData.id}`,
                    date: allocationData.puzzle_date,
                    solutionDate: masterData?.answer_date_canonical || masterData?.answer_date || allocationData.puzzle_date,
                    difficulty: masterData?.difficulty || 1,
                    masterId: allocationData.question_id,
                    category: allocationData?.categories?.name || "History",
                    categoryNumber: allocationData?.categories?.id,
                    location: allocationData?.categories?.id === 999 && masterData?.populated_places?.name1
                        ? masterData.populated_places.name1
                        : "",
                    eventDescription: masterData?.event_description || masterData?.description || ""
                };

                setPuzzle(finalPuzzle);

                // CACHE SAVE
                try {
                    await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(finalPuzzle));
                } catch (e) { console.error('Error saving puzzle cache', e); }
            }

        } catch (e) {
            console.error('[GameScreen] Critical Error:', e);
            if (isConnected === false) {
                setDebugInfo("You are offline. Connect to the internet to play.");
            } else {
                Alert.alert("Error", "Unexpected crash loading puzzle.");
            }
        } finally {
            setLoading(false);
        }
    };


    // Loading and Error states are now handled inline below to preserve Header visibility




    // Calculate isToday for ActiveGame
    const todayStr = new Date().toISOString().split('T')[0];
    const isTodayPuzzleValue = (id === 'today' || id === 'next') || (puzzle?.date === todayStr);
    console.log('[GameScreen] isToday Calculation:', { id, puzzleDate: puzzle?.date, todayStr, isToday: isTodayPuzzleValue });

    return (
        <ThemedView className="flex-1">
            <SafeAreaView edges={['top']} className="z-10" style={{ backgroundColor: brandColor }}>
                <View className="relative items-center z-50" style={{ backgroundColor: brandColor, paddingTop: 6, paddingBottom: 24 }}>

                    {/* Left: Back Arrow - Hidden if game OVER and Guest */}
                    {!(isGuest && (gameState === 'won' || gameState === 'lost')) && (
                        <View className="absolute left-4 top-4">
                            <TouchableOpacity
                                onPress={handleBack}
                                className="items-center justify-center bg-transparent"
                            >
                                <ChevronLeft size={28} color={headerIconColor} />
                            </TouchableOpacity>
                        </View>
                    )}

                    {/* Center: Title */}
                    <ThemedText size="4xl" className="text-white font-n-bold mb-2 pt-2 font-heading tracking-tight text-center">
                        Elementle
                    </ThemedText>

                    {/* Right: Help */}
                    <View className="absolute right-4 top-4">
                        <TouchableOpacity
                            onPress={() => setHelpVisible(true)}
                            className="items-center justify-center bg-transparent"
                        >
                            <HelpCircle size={28} color={headerIconColor} />
                        </TouchableOpacity>
                    </View>
                </View>
            </SafeAreaView>

            {/* Main Content Area: Handles Loading, Error, and Active Game */}
            <View className="flex-1">
                {loading ? (
                    <View className="flex-1 justify-center items-center">
                        <ActivityIndicator size="large" color="#3b82f6" />
                        <Text className="text-slate-900 dark:text-white mt-4 font-body">Loading Puzzle...</Text>
                    </View>
                ) : !puzzle ? (
                    <View className="flex-1 justify-center items-center px-6">
                        <Text className="text-slate-900 dark:text-white text-xl font-display mb-2 text-center">No Puzzle Found</Text>
                        <Text className="text-slate-500 dark:text-slate-400 text-center mb-6">
                            {debugInfo || `We couldn't find a puzzle for ${modeStr} mode on this date.`}
                        </Text>
                        <TouchableOpacity
                            className="bg-blue-600 px-6 py-3 rounded-xl flex-row items-center mb-4"
                            onPress={() => router.replace('/archive')}
                        >
                            <Calendar className="text-white mr-2" size={20} />
                            <Text className="text-white font-bold text-lg">Pick Another Date</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            className="bg-slate-700 px-6 py-3 rounded-xl flex-row items-center"
                            onPress={() => router.back()}
                        >
                            <ChevronLeft className="text-white mr-2" size={20} />
                            <Text className="text-white font-bold text-lg">Go Back</Text>
                        </TouchableOpacity>
                    </View>
                ) : (
                    <View className="flex-1 z-20">
                        <ActiveGame
                            puzzle={puzzle}
                            gameMode={modeStr}
                            backgroundColor={backgroundColor}
                            onGameStateChange={setGameState}
                            isStreakSaverGame={isInStreakSaverMode}
                            onStreakSaverExit={handleConfirmExit}
                            isTodayPuzzle={isTodayPuzzleValue}
                        />
                    </View>
                )}
            </View>

            {/* Streak Saver Exit Warning */}
            <StreakSaverExitWarning
                visible={showExitWarning}
                onClose={() => setShowExitWarning(false)}
                onContinuePlaying={() => setShowExitWarning(false)}
                onCancelAndLoseStreak={handleConfirmExit}
            />

            {/* Help Modal */}
            <HelpModal visible={helpVisible} onClose={() => setHelpVisible(false)} />
        </ThemedView >
    );
}
