import React, { useEffect } from 'react';
import { View, Text, ActivityIndicator, TouchableOpacity, Animated, Dimensions, Platform } from 'react-native';
import { Image } from 'expo-image';
import { styled } from 'nativewind';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { HelpCircle } from 'lucide-react-native';
import { useQueryClient } from '@tanstack/react-query';

import { InputGrid } from '../InputGrid';
import { NumericKeyboard } from '../NumericKeyboard';
import { useGameEngine } from '../../hooks/useGameEngine';
import { useAuth } from '../../lib/auth';
import { useInterstitialAd } from '../../hooks/useInterstitialAd';
import { useSubscription } from '../../hooks/useSubscription';
import { IntroScreen } from './IntroScreen';
import { useOptions } from '../../lib/options';
import { useReviewPrompt } from '../../hooks/useReviewPrompt';
import { useToast } from '../../contexts/ToastContext';

import { useUserStats } from '../../hooks/useUserStats';
import { useBadgeSystem, Badge } from '../../hooks/useBadgeSystem';
import { ThemedText } from '../ThemedText';
import { ThemedView } from '../ThemedView';
import { useThemeColor } from '../../hooks/useThemeColor';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StreakCelebration } from './StreakCelebration';

const StyledView = styled(View);
const StyledText = styled(Text);
const StyledImage = styled(Image);

export interface PuzzleData {
    id: number;
    title: string;
    date: string;
    difficulty?: number;
    masterId?: number;
    category?: string;
    categoryNumber?: number;
    location?: string;
    eventDescription?: string;
    solutionDate: string; // The canonical answer (historical date)
}

interface ActiveGameProps {
    puzzle: PuzzleData;
    gameMode: 'REGION' | 'USER';
    backgroundColor?: string;
    onGameStateChange?: (state: 'loading' | 'playing' | 'won' | 'lost') => void;
    isStreakSaverGame?: boolean;
    onStreakSaverExit?: () => void;
    introVisible?: boolean;
    onIntroChange?: (visible: boolean) => void;
    contentOpacity?: any;
    isTodayPuzzle?: boolean;
}

export function ActiveGame({ puzzle, gameMode, backgroundColor = '#FAFAFA', onGameStateChange, isStreakSaverGame, onStreakSaverExit, introVisible, onIntroChange, contentOpacity, isTodayPuzzle }: ActiveGameProps) {
    const router = useRouter();
    const { mode, id, skipIntro, preserveStreakStatus: preserveParam, guestReplay: guestReplayParam } = useLocalSearchParams();
    const { dateLength, cluesEnabled, dateFormatOrder } = useOptions();
    const { user } = useAuth();
    const isGuest = !user;
    const isGuestReplay = guestReplayParam === 'true';

    const { showAd, isClosed: adClosed } = useInterstitialAd();
    const { isPro } = useSubscription();
    const { shouldShowReview, triggerReview } = useReviewPrompt();
    const reviewTriggeredRef = React.useRef(false);
    const surfaceColor = useThemeColor({}, 'surface');
    const insets = useSafeAreaInsets();
    const queryClient = useQueryClient();
    const { toast } = useToast();

    // Local State
    const [preserveStreakStatus, setPreserveStreakStatus] = React.useState(false);

    // Initialize preserve status from param
    useEffect(() => {
        if (preserveParam === 'true') {
            console.log("[ActiveGame] Preserving Streak Status from Params");
            setPreserveStreakStatus(true);
        }
    }, [preserveParam]);
    // -- Local State for UI Flow --
    const [isLoading, setIsLoading] = React.useState(true);

    // State for Introduction Sequencing
    const [introPhase, setIntroPhase] = React.useState<'visible' | 'fading' | 'hidden'>('hidden');
    const gameFadeAnim = React.useRef(new Animated.Value(0)).current;

    // Trigger Game Fade In when Intro is fully gone
    useEffect(() => {
        if (introPhase === 'hidden' && !isLoading) {
            Animated.timing(gameFadeAnim, {
                toValue: 1,
                duration: 800,
                useNativeDriver: true,
            }).start();
        }
    }, [introPhase, isLoading]);
    // Holiday popup removed — interception now happens at Home/Archive screen level

    // Pass the correct props to useGameEngine
    // Note: useGameEngine expects { puzzleId, answerDateCanonical, mode }
    const {
        gameState,
        currentInput,
        guesses,
        keyStates,
        submitGuess,
        handleDigitPress,
        handleDelete,
        handleClear,
        isValidGuess,
        invalidShake, // Using this to trigger shake animation if needed
        isRestored,
        wasInitiallyComplete, // True only when viewing a previously completed game
        numDigits, // Get authoritative digit count
        finalStreak, // Get authoritative calculated streak
        streakDayStatus, // Get the DB status for today's game
        // Guest Replay
        replayGuestGuess,
        guestReplayReady,
        guestReplayCount
    } = useGameEngine({
        puzzleId: puzzle.id,
        answerDateCanonical: puzzle.solutionDate, // Use the actual solution date
        puzzleDate: puzzle.date, // Pass calendar date for Steak Saver validation
        mode: gameMode,
        preserveStreakStatus, // Pass down the user's choice
        guestReplay: isGuestReplay // Load from guest AsyncStorage for replay
    });

    // ... (placeHolders logic remains same)
    const placeHolders = React.useMemo(() => {
        if (numDigits === 8) {
            // 8 digits: full year
            if (dateFormatOrder === 'mmddyy') {
                return ['M', 'M', 'D', 'D', 'Y', 'Y', 'Y', 'Y'];
            } else {
                return ['D', 'D', 'M', 'M', 'Y', 'Y', 'Y', 'Y'];
            }
        } else {
            // 6 digits: 2-digit year
            if (dateFormatOrder === 'mmddyy') {
                return ['M', 'M', 'D', 'D', 'Y', 'Y'];
            } else {
                return ['D', 'D', 'M', 'M', 'Y', 'Y'];
            }
        }
    }, [numDigits, dateFormatOrder]);

    // ... Hook Integrations ...

    // TODO: Fetch streak info or calculate it here if needed for UI,
    // though ResultModal might fetch it independently or use context.

    // -- Hook Integrations --
    const { stats, refetch: refetchStats } = useUserStats(gameMode);
    const { markBadgeAsSeen, pendingBadges } = useBadgeSystem();


    // Support lifted state or local fallback
    // const [localShowIntro, setLocalShowIntro] = React.useState(false); // REMOVED
    // const showIntro = introVisible !== undefined ? introVisible : localShowIntro; // REMOVED
    // const setShowIntro = onIntroChange || setLocalShowIntro; // REMOVED

    const [streakToDisplay, setStreakToDisplay] = React.useState(0);
    const [readyForCelebration, setReadyForCelebration] = React.useState(false);
    const [buttonEnabled, setButtonEnabled] = React.useState(false);
    // navigationStartedRef and navigateToResultRef are now defined earlier (before handleAdClosed callback)
    const previousAdClosedRef = React.useRef(false);
    const [earnedBadgesState, setEarnedBadgesState] = React.useState<any[]>([]);
    const proNavigationTimerRef = React.useRef<NodeJS.Timeout | null>(null); // Store Pro user timer to cancel on manual Continue
    const hasNavigatedRef = React.useRef(false); // Guard: prevents Pro timer from navigating if user already clicked Continue
    const wasInitiallyCompleteRef = React.useRef(wasInitiallyComplete); // Track latest value for async timer checks

    // Calculate effective streak to show in Intro
    // use finalStreak (if just won) or current stats streak
    // Calculate effective streak to show in Intro
    // use finalStreak (if just won) or current stats streak
    const effectiveStreak = finalStreak ?? stats?.current_streak ?? 0;

    // Prevent double-processing of game end
    const processedGame = React.useRef(false);



    // Loading logic: Wait for game state to be loaded AND minimum 1.5s
    useEffect(() => {
        if (gameState === 'loading') return;

        // Notify parent of state change
        if (onGameStateChange) onGameStateChange(gameState);

        const startTime = Date.now();
        const MINIMUM_LOADING_TIME = 1000; // 1 second

        const timer = setTimeout(() => {

            // [FIX] Determine intro state BEFORE clearing loading to prevent "Flash" of game screen.
            // Only show intro for fresh games (playing, no guesses, not restored)
            // AND only if skipIntro param is NOT present
            // AND only if NOT in Holiday Mode (Holiday Modal takes precedence)
            if (gameState === 'playing' && guesses.length === 0 && !isRestored && skipIntro !== 'true') {
                // Check if Holiday Mode (streakDayStatus === 0)
                // Exception: streak saver games should ALWAYS show intro even though
                // the safety net holiday row sets status to 0
                if (streakDayStatus !== 0 || isStreakSaverGame) {
                    setIntroPhase('visible');
                } else {
                    console.log('[ActiveGame] In Holiday Mode (Status 0) - Suppressing Intro to show Holiday Modal');
                    setIntroPhase('hidden');
                }
            } else {
                setIntroPhase('hidden');
            }

            // Clear loading state AFTER setting intro state
            setIsLoading(false);

        }, Math.max(0, MINIMUM_LOADING_TIME - (Date.now() - startTime)));

        return () => clearTimeout(timer);
    }, [gameState, guesses.length, isRestored, skipIntro]);

    // ============================================================
    // GUEST REPLAY ORCHESTRATION
    // After loading completes, sequentially replay saved guest guesses
    // on a timer. Shows blue toast while replaying.
    // ============================================================
    const guestReplayStartedRef = React.useRef(false);

    useEffect(() => {
        // Only run for guest replay games
        if (!isGuestReplay || !guestReplayReady) return;

        // Don't start until loading UI is done
        if (isLoading) return;

        // Only start once
        if (guestReplayStartedRef.current) return;
        guestReplayStartedRef.current = true;

        console.log(`[ActiveGame] Guest Replay: starting replay of ${guestReplayCount} guesses`);

        // Show blue toast
        toast({
            title: 'Loading your game data for today\'s puzzle',
            variant: 'migration',
            position: 'bottom',
            duration: 4000,
        });

        // Replay guesses on a timer
        let guessIndex = 0;
        const replayInterval = setInterval(async () => {
            const result = await replayGuestGuess();
            guessIndex++;

            if (result.done) {
                clearInterval(replayInterval);
                console.log(`[ActiveGame] Guest Replay: all ${guessIndex} guesses replayed`);
            }
        }, 1200); // 1.2 seconds between each guess to allow animation

        return () => clearInterval(replayInterval);
    }, [isGuestReplay, guestReplayReady, isLoading, guestReplayCount]);

    // Keep ref in sync with prop
    React.useEffect(() => {
        wasInitiallyCompleteRef.current = wasInitiallyComplete;
    }, [wasInitiallyComplete]);

    // -- Side Effects --

    // Trigger Win Sequence
    useEffect(() => {
        if (processedGame.current) return;



        if (gameState === 'won') {
            // [FIX] Wait for finalStreak to be populated by GameEngine before processing
            if (finalStreak === null || finalStreak === undefined) {
                console.log('[ActiveGame] Won detected but waiting for finalStreak...');
                return;
            }
            console.log('[ActiveGame] Final Streak Ready:', finalStreak);

            processedGame.current = true;
            let timer: NodeJS.Timeout;

            const handleWin = async () => {
                // 1. Set streak display value immediately
                const displayStreak = finalStreak ?? stats?.current_streak ?? 1;
                setStreakToDisplay(displayStreak);
                console.log(`[ActiveGame] Set streak for celebration: ${displayStreak}`);

                // 2. Refetch stats in background
                const { data: newStats } = await refetchStats();

                // 3. Invalidate queries
                queryClient.invalidateQueries({ queryKey: ['pendingBadges'] });
                queryClient.invalidateQueries({ queryKey: ['streak-saver-status'] });

                // Badges are awarded by useGameEngine during submitGuess.
                // Read pending badges from the query (already populated by useGameEngine).
                let earnedBadges: any[] = [];
                if (!isRestored) {
                    // Allow time for pendingBadges query to refresh after invalidation above
                    await new Promise(resolve => setTimeout(resolve, 300));
                    earnedBadges = pendingBadges || [];
                    console.log(`[ActiveGame] Read ${earnedBadges.length} pending badges from query`);
                } else {
                    console.log('[ActiveGame] Skipping badge read - restored game');
                }

                // Store earned badges for passing to game-result
                console.log('[ActiveGame] Win handled, storing badges', earnedBadges);
                setEarnedBadgesState(earnedBadges);

                // Navigate to game-result after delay (celebrations will happen there)
                // Pro users: 5 second delay
                // Standard users: 2.5 seconds after ad closes (handled by useEffect)
                // Guests: Navigate after ad
                if (isPro) {
                    console.log('[ActiveGame] Pro user - navigating after 5s delay');
                    // Capture values NOW to avoid closure issues with state
                    const capturedStreak = displayStreak;
                    const capturedBadges = earnedBadges;
                    // Store timer ID so it can be cancelled if Continue is clicked
                    proNavigationTimerRef.current = setTimeout(() => {
                        // Guard: if user manually clicked Continue before this fires, abort
                        if (hasNavigatedRef.current) {
                            console.log('[ActiveGame] Pro auto-nav timer fired but user already navigated — aborting');
                            return;
                        }
                        // Pass captured values directly to avoid stale state
                        navigateToResult(capturedStreak, capturedBadges);
                    }, 5000);
                } else {
                    // Standard user or guest - mark ready for post-ad navigation
                    // [RATE MY APP] If review milestone reached, trigger review instead of ad
                    if (shouldShowReview && !isGuest) {
                        console.log('[ActiveGame] Review milestone reached — triggering review, skipping ad');
                        reviewTriggeredRef.current = true;
                        triggerReview();
                    } else {
                        console.log('[ActiveGame] Marking ready for post-ad navigation');
                    }
                    setReadyForCelebration(true);
                }
            };

            handleWin();
            // No timer cleanup needed since we removed the auto-trigger timers

        } else if (gameState === 'lost') {
            // Skip for already-completed games being viewed
            if (wasInitiallyComplete) {
                console.log('[ActiveGame] Viewing previously lost game - skipping auto-navigate');
                return;
            }

            if (processedGame.current) return;
            processedGame.current = true;

            let timer: NodeJS.Timeout;

            const handleLoss = async () => {
                await refetchStats();
                if (!isGuest) {
                    timer = setTimeout(() => {
                        // Double-check via ref: wasInitiallyComplete may have become true
                        // between when the timer was scheduled and when it fires
                        if (wasInitiallyCompleteRef.current) {
                            console.log('[ActiveGame] Lost timer fired but wasInitiallyComplete is now true - aborting navigate');
                            return;
                        }
                        router.replace({
                            pathname: '/game-result',
                            params: {
                                isWin: 'false',
                                guessesCount: guesses.length.toString(),
                                maxGuesses: '5',
                                answerDateCanonical: puzzle.solutionDate,
                                eventTitle: puzzle.title,
                                eventDescription: puzzle.eventDescription || '',
                                gameMode,
                                puzzleId: puzzle.id.toString(),
                                puzzleDate: puzzle.date,
                                isGuest: isGuest ? 'true' : 'false',
                                currentStreak: '0',
                                isStreakSaverGame: isStreakSaverGame ? 'true' : 'false',
                                isToday: (isTodayPuzzle ?? (puzzle.date === new Date().toISOString().split('T')[0])).toString(),
                                justFinished: 'true',
                                guessFeedback: JSON.stringify(guesses.map(row => row.map(c => ({ state: c.state, digit: c.digit }))))
                            }
                        });
                    }, 1500);
                }
            };
            handleLoss();
            return () => clearTimeout(timer);
        }
    }, [gameState, isRestored, finalStreak, isStreakSaverGame, isTodayPuzzle, wasInitiallyComplete]); // Added finalStreak, isStreakSaverGame, isTodayPuzzle to deps

    // Helper function to navigate to game-result with all params
    // Optional parameters allow passing captured values to avoid closure issues
    const navigateToResult = (overrideStreak?: number, overrideBadges?: any[]) => {
        const currentStreakVal = overrideStreak ?? streakToDisplay;
        const finalBadges = overrideBadges ?? earnedBadgesState;
        const isWin = gameState === 'won';

        router.replace({
            pathname: '/game-result',
            params: {
                isWin: isWin ? 'true' : 'false',
                guessesCount: guesses.length.toString(),
                maxGuesses: '5',
                answerDateCanonical: puzzle.solutionDate,
                eventTitle: puzzle.title,
                eventDescription: puzzle.eventDescription || '',
                gameMode,
                puzzleId: puzzle.id.toString(),
                puzzleDate: puzzle.date,
                isGuest: isGuest ? 'true' : 'false',
                currentStreak: currentStreakVal.toString(),
                isStreakSaverGame: isStreakSaverGame ? 'true' : 'false',
                earnedBadges: JSON.stringify(finalBadges),
                isToday: (isTodayPuzzle ?? (puzzle.date === new Date().toISOString().split('T')[0])).toString(),
                justFinished: 'true',
                guessFeedback: JSON.stringify(guesses.map(row => row.map(c => ({ state: c.state, digit: c.digit }))))
            }
        });
    };




    // Enable Continue button 1 second after ad starts (for standard users)
    // wasInitiallyComplete games (viewing completed): enable immediately since no ad
    useEffect(() => {
        console.log('[ActiveGame] Button enable check - isPro:', isPro, 'isGuest:', isGuest, 'wasInitiallyComplete:', wasInitiallyComplete, 'readyForCelebration:', readyForCelebration, 'buttonEnabled:', buttonEnabled, 'gameState:', gameState);

        // For games that were initially loaded as complete (viewing), enable immediately - no ad plays
        if (wasInitiallyComplete && (gameState === 'won' || gameState === 'lost')) {
            console.log('[ActiveGame] Viewing completed game - enabling Continue immediately');
            setButtonEnabled(true);
            return;
        }

        if (!readyForCelebration) return;
        if (isPro || isGuest) {
            // Pro users: don't see ads
            // Guests: see ad before game (in age verification), not after
            console.log('[ActiveGame] Enabling immediately - isPro:', isPro, 'isGuest:', isGuest);
            setButtonEnabled(true);
            return;
        }

        // Standard users: wait 5 seconds for ad to fully appear on screen
        // [RATE MY APP] If review was triggered instead of ad, enable immediately
        if (reviewTriggeredRef.current) {
            console.log('[ActiveGame] Review triggered — enabling Continue immediately (no ad)');
            setButtonEnabled(true);
            return;
        }
        console.log('[ActiveGame] Standard user - Waiting 5s before enabling Continue button');
        const timer = setTimeout(() => {
            console.log('[ActiveGame] Enabling Continue button after 5s wait');
            setButtonEnabled(true);
        }, 5000);

        return () => clearTimeout(timer);
    }, [readyForCelebration, isPro, isGuest, wasInitiallyComplete, gameState]);



    if (gameState === 'loading') {
        return (
            <View className="flex-1 justify-center items-center" style={{ backgroundColor }}>
                <ActivityIndicator size="large" color="#3b82f6" />
            </View>
        );
    }

    // Construct Display Strings
    // Only show location for Local History category (999)
    const categoryText = puzzle.category || '';
    const locationText = puzzle.categoryNumber === 999 && puzzle.location ? `: ${puzzle.location} ` : '';
    const headerLine1 = `${categoryText}${locationText} `;

    return (
        <ThemedView className="flex-1">
            {/* Loading Spinner - shown while determining game state */}
            {isLoading && (
                <ThemedView className="flex-1 items-center justify-center">
                    <ActivityIndicator size="large" color="#7DAAE8" />
                    <ThemedText className="opacity-60 mt-4 font-n-medium" size="base">Loading puzzle...</ThemedText>
                </ThemedView>
            )}

            {!isLoading && introPhase === 'hidden' && (
                <Animated.View className="flex-1 w-full" style={{ opacity: gameFadeAnim }}>

                    {/* Clue Box - rendered inline with stats-screen overlap pattern */}
                    {cluesEnabled ? (
                        <View style={{
                            marginTop: -20,
                            paddingHorizontal: 24, // [FIX] Match app-wide padding pattern (px-6)
                            zIndex: 20,
                            maxWidth: 582,
                            alignSelf: 'center',
                            width: '100%',
                        }}>
                            <View style={{
                                backgroundColor: '#FFFFFF',
                                borderRadius: 24,
                                padding: 16,
                                alignItems: 'center',
                                shadowColor: '#000',
                                shadowOffset: { width: 0, height: 2 },
                                shadowOpacity: 0.1,
                                shadowRadius: 8,
                                elevation: 4,
                            }}>
                                <Text style={{ color: '#3b82f6', fontWeight: '700', fontSize: 14, marginBottom: 4 }}>
                                    {puzzle.category}
                                </Text>
                                <Text style={{ color: '#1e293b', fontWeight: '700', fontSize: 18, textAlign: 'center' }}>
                                    {puzzle.title}
                                </Text>
                            </View>
                        </View>
                    ) : (
                        /* Spacer when clues OFF - pushes grid below header */
                        <View style={{ height: 50 }} />
                    )}

                    <ThemedView className={`flex-1 w-full max-w-md mx-auto px-4 ${cluesEnabled ? 'justify-start' : 'justify-center'}`} style={{ paddingTop: cluesEnabled ? 16 : 0, paddingBottom: cluesEnabled ? 8 : 0 }}>
                        <InputGrid
                            guesses={guesses}
                            currentInput={currentInput}
                            maxGuesses={5}
                            placeholders={placeHolders}
                            invalidShake={invalidShake}
                            isRestored={isRestored} // Always animate if restored
                        />
                    </ThemedView>

                    {/* Keyboard or Continue Button */}
                    <View style={{ paddingBottom: (Dimensions.get('window').height < 700 ? 8 : 25) + (Platform.OS === 'android' ? insets.bottom : 0), paddingTop: 8, maxWidth: 582, alignSelf: 'center', width: '100%' }}>
                        {(gameState === 'playing') ? (
                            <NumericKeyboard
                                onDigitPress={handleDigitPress}
                                onDelete={handleDelete}
                                onClear={handleClear}
                                onEnter={submitGuess}
                                keyStates={keyStates}
                                canSubmit={isValidGuess}
                            />
                        ) : (
                            <View style={{ alignItems: 'center', paddingHorizontal: 16 }}>
                                <TouchableOpacity
                                    onPress={async () => {
                                        // Prioritize authoritative finalStreak if available (from local hook state)
                                        const displayStreak = finalStreak ?? stats?.current_streak ?? 0;

                                        // Badges are awarded by useGameEngine during submitGuess.
                                        // Read pending badges from the query (already populated).
                                        let earnedBadges: any[] = [];
                                        if (isRestored) {
                                            console.log('[ActiveGame] Manual Continue - skipping badges (restored game)');
                                        } else {
                                            earnedBadges = pendingBadges || [];
                                            console.log(`[ActiveGame] Manual Continue - read ${earnedBadges.length} pending badges`);
                                        }

                                        // Manual continue - store badges and navigate (celebrations happen on game-result)
                                        console.log('[ActiveGame] Manual Continue - storing badges and navigating', earnedBadges);

                                        // Cancel Pro user auto-navigation timer if it exists
                                        if (proNavigationTimerRef.current) {
                                            console.log('[ActiveGame] Cancelling Pro user auto-navigation timer');
                                            clearTimeout(proNavigationTimerRef.current);
                                            proNavigationTimerRef.current = null;
                                        }
                                        // Guard: mark that we've already navigated
                                        hasNavigatedRef.current = true;

                                        setEarnedBadgesState(earnedBadges);
                                        setStreakToDisplay(displayStreak);
                                        navigateToResult();
                                    }}
                                    disabled={!isPro && !isGuest && !wasInitiallyComplete && !buttonEnabled} // Guests, Pro, and viewing completed skip ad wait
                                    className={`w-full py-4 rounded-xl items-center ${!isPro && !isGuest && !wasInitiallyComplete && !buttonEnabled
                                        ? 'bg-slate-200 dark:bg-slate-800'
                                        : 'bg-slate-300 dark:bg-slate-700 active:bg-slate-400 dark:active:bg-slate-600'
                                        }`}
                                    style={{ transform: [{ translateY: 0 }] }} // Ensure button is reachable
                                >
                                    <ThemedText
                                        className={`font-n-bold ${!isPro && !isGuest && !wasInitiallyComplete && !buttonEnabled
                                            ? 'text-slate-400 dark:text-slate-600'
                                            : 'text-slate-900 dark:text-white'
                                            }`}
                                        size="lg"
                                    >
                                        Continue
                                    </ThemedText>
                                </TouchableOpacity>
                            </View>
                        )}
                    </View>
                </Animated.View>
            )}

            {/* Intro Screen - Renders when not hidden (visible or fading) */}
            {!isLoading && introPhase !== 'hidden' && (
                <IntroScreen
                    visible={introPhase === 'visible'}
                    onStart={() => setIntroPhase('fading')}
                    onAnimationComplete={() => setIntroPhase('hidden')}
                    gameMode={gameMode}
                    puzzleDate={puzzle.date}
                    // Issue 4 Fix: Only show streak intro if NOT preserving holiday status (i.e. we are playing for real)
                    // AND if it's Today's puzzle OR a Streak Saver game.
                    // Archive games should show standard intro.
                    isStreakGame={
                        effectiveStreak > 0 &&
                        !isRestored &&
                        gameState === 'playing' &&
                        !preserveStreakStatus &&
                        (isStreakSaverGame || puzzle.date === new Date().toISOString().split('T')[0])
                    }
                    isStreakSaverGame={isStreakSaverGame}
                    onExit={onStreakSaverExit}
                    currentStreak={effectiveStreak}
                    eventTitle={puzzle.title}
                    category={puzzle.category} // Pass Category
                    isGuest={isGuest}
                />
            )}



        </ThemedView >
    );
}
