import React, { useEffect } from 'react';
import { View, Text, ActivityIndicator, TouchableOpacity, Animated } from 'react-native';
import { Image } from 'expo-image';
import { styled } from 'nativewind';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { HelpCircle } from 'lucide-react-native';
import { supabase } from '../../lib/supabase';
import { useQueryClient } from '@tanstack/react-query';

import { InputGrid } from '../InputGrid';
import { NumericKeyboard } from '../NumericKeyboard';
import { useGameEngine } from '../../hooks/useGameEngine';
import { useAuth } from '../../lib/auth';
import { useInterstitialAd } from '../../hooks/useInterstitialAd';
import { useSubscription } from '../../hooks/useSubscription';
import { IntroScreen } from './IntroScreen';
import { useOptions } from '../../lib/options';

import { useUserStats } from '../../hooks/useUserStats';
import { useBadgeSystem, Badge } from '../../hooks/useBadgeSystem';
import { ThemedText } from '../ThemedText';
import { ThemedView } from '../ThemedView';
import { useThemeColor } from '../../hooks/useThemeColor';
import { HolidayActiveModal } from './HolidayActiveModal';
import { useStreakSaverStatus } from '../../hooks/useStreakSaverStatus';
import { StreakCelebration } from './StreakCelebration';
import { checkAndAwardStreakBadge, checkAndAwardElementleBadge, checkAndAwardPercentileBadge } from '../../lib/supabase-rpc';

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
    const { mode, id, skipIntro, preserveStreakStatus: preserveParam } = useLocalSearchParams();
    const { dateLength, cluesEnabled, dateFormatOrder } = useOptions();
    const { user } = useAuth();
    const isGuest = !user;

    const { showAd, isClosed: adClosed } = useInterstitialAd();
    const { isPro } = useSubscription();
    const surfaceColor = useThemeColor({}, 'surface');
    const queryClient = useQueryClient();

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

    // Restore missing state
    const [hasCheckedHoliday, setHasCheckedHoliday] = React.useState(false);

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
    const { endHoliday, holidayActive } = useStreakSaverStatus();
    const [showHolidayPopup, setShowHolidayPopup] = React.useState(false);

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
        streakDayStatus // Get the DB status for today's game
    } = useGameEngine({
        puzzleId: puzzle.id,
        answerDateCanonical: puzzle.solutionDate, // Use the actual solution date
        puzzleDate: puzzle.date, // Pass calendar date for Steak Saver validation
        mode: gameMode,
        preserveStreakStatus // Pass down the user's choice
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
    const { checkBadgesForWin, markBadgeAsSeen, pendingBadges } = useBadgeSystem();


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

    // Calculate effective streak to show in Intro
    // use finalStreak (if just won) or current stats streak
    // Calculate effective streak to show in Intro
    // use finalStreak (if just won) or current stats streak
    const effectiveStreak = finalStreak ?? stats?.current_streak ?? 0;

    // Prevent double-processing of game end
    const processedGame = React.useRef(false);

    // HOLIDAY CHECK: After loading, check if this game is a holiday (status === 0)
    // Only check if playing,    // Check for Holiday Mode on mount (Safety Check, though Index handles it now)
    // We removed generic modal triggering here to avoid double-popup
    // HOLIDAY CHECK: After loading, check if this game is a holiday (status === 0)
    // Re-enabled to support triggering when entering from Archive (Deep Link)
    // HOLIDAY CHECK: After loading, check if this game is a holiday (status === 0)
    // Re-enabled to support triggering when entering from Archive (Deep Link)
    useEffect(() => {
        // [FIX] Only show if we are actually PLAYING (and not just loading).
        // AND checks if it is TODAY'S puzzle.
        // User Requirement: "If the game is partially played then the user should see the popup... if the game is won or lost... shouldn't appear"
        // We ensure data is restored (isRestored) so we trust gameState.

        // Calculate Today string for comparison
        const todayStr = new Date().toISOString().split('T')[0];
        const isTodayPuzzle = puzzle.date === todayStr;

        // Condition breakdown:
        // 1. Not already checked
        // 2. Game is loaded and actively PLAYING (not won/lost/loading)
        // 3. Game state IS restored (we know for sure it's not a fresh init race condition)
        // 4. It's a Holiday Game (status 0)
        // 5. Global Holiday Mode is Active
        if (!hasCheckedHoliday && gameState === 'playing' && isRestored && streakDayStatus === 0 && !preserveStreakStatus && holidayActive) {

            if (isTodayPuzzle) {
                console.log("[ActiveGame] Game detected as Holiday Mode (Status 0) AND Global Holiday Active AND Today. Triggering Modal.");
                setHasCheckedHoliday(true);
                setShowHolidayPopup(true);
            } else {
                console.log("[ActiveGame] Holiday Mode detected but treating as Archive Game (Not Today). No Popup.");
                setHasCheckedHoliday(true); // Mark checked so we don't re-check
            }
        } else if (!hasCheckedHoliday && isRestored && (gameState === 'won' || gameState === 'lost')) {
            // [FIX] If restored and already done, mark checked to prevent future triggers
            setHasCheckedHoliday(true);
        }
    }, [gameState, streakDayStatus, hasCheckedHoliday, preserveStreakStatus, holidayActive, puzzle.date, isRestored]);

    // Format Holiday End Date (Example: "Wednesday 11 February")

    // Format Holiday End Date (Example: "Wednesday 11 February")
    // We don't have the *actual* holiday end date here easily without checking subscription/settings.
    // For now, let's format Today + Remaining Days? 
    // Or just use a placeholder/generic or try to fetch it?
    // User stats might have "holiday_end_date"? No.
    // Let's rely on what we have. 
    // Wait, the prompt screenshot showed "Holiday runs until...".
    // I can't easily get the end date without a new fetch. 
    // I will mock it or leave generic for now, or just calculate based on max lookback?
    // Actually, `streak_day_status` doesn't tell us when holiday ENDS.
    // I'll leave the date hardcoded or generic, or just "until you exit".
    // Wait, let's use a simple date for now (e.g. Tomorrow?) or just "until deactivated".
    // Re-reading screenshot: "Wednesday 11 February".
    // I'll format a date 14 days from now? No.
    // I'll format the current date for now as a fallback.
    const holidayEndDateDisplay = React.useMemo(() => {
        const d = new Date();
        d.setDate(d.getDate() + 14); // Assumption/Placeholder
        return d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
    }, []);

    // Loading logic: Wait for game state to be loaded AND minimum 1.5s
    useEffect(() => {
        if (gameState === 'loading') return;

        // Notify parent of state change
        if (onGameStateChange) onGameStateChange(gameState);

        const startTime = Date.now();
        const MINIMUM_LOADING_TIME = 1500; // 1.5 seconds

        const timer = setTimeout(() => {

            // [FIX] Determine intro state BEFORE clearing loading to prevent "Flash" of game screen.
            // Only show intro for fresh games (playing, no guesses, not restored)
            // AND only if skipIntro param is NOT present
            // AND only if NOT in Holiday Mode (Holiday Modal takes precedence)
            if (gameState === 'playing' && guesses.length === 0 && !isRestored && skipIntro !== 'true') {
                // Check if Holiday Mode (streakDayStatus === 0)
                if (streakDayStatus !== 0) {
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

                // Check badges (Directly via RPC to avoid cache delays)
                // IMPORTANT: Skip badge awarding if this is a restored game (viewing completed game)
                let earnedBadges: any[] = [];
                if (isRestored) {
                    console.log('[ActiveGame] Skipping badge check - restored game (viewing, not fresh win)');
                } else {
                    try {
                        // Get region context
                        let userRegion = 'UK'; // Default
                        // Note: We might need to fetch the user's region here if we want to be 100% accurate for REGION mode
                        // But ActiveGame doesn't have easy access to profile without a query. 
                        // However, useGameEngine does this too.
                        // For UI feedback, 'UK' default is acceptable if we can't get it, or we rely on what useGameEngine did?
                        // Let's try to fetch it quickly or use 'UK' as fallback.
                        if (gameMode === 'REGION' && user) {
                            const { data: profile } = await supabase.from('user_profiles').select('region').eq('id', user.id).single();
                            userRegion = profile?.region || 'UK';
                        }
                        const REGION_CTX = gameMode === 'REGION' ? userRegion : 'GLOBAL';

                        console.log(`[ActiveGame] Checking Badges via RPC for immediate feedback (Region: ${REGION_CTX})...`);

                        if (user && displayStreak > 0) {
                            const streakBadge = await checkAndAwardStreakBadge(user.id, displayStreak, gameMode, REGION_CTX);
                            if (streakBadge) earnedBadges.push(streakBadge);
                        }

                        if (user && (guesses.length === 1 || guesses.length === 2)) {
                            const elementleBadge = await checkAndAwardElementleBadge(user.id, guesses.length, gameMode, REGION_CTX);
                            if (elementleBadge) earnedBadges.push(elementleBadge);
                        }

                        // We don't wait for percentile badge for UI feedback usually as it's slow/broken

                    } catch (e) {
                        console.error('[ActiveGame] Error checking badges:', e);
                    }
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
                        // Pass captured values directly to avoid stale state
                        navigateToResult(capturedStreak, capturedBadges);
                    }, 5000);
                } else {
                    // Standard user or guest - mark ready for post-ad navigation
                    console.log('[ActiveGame] Marking ready for post-ad navigation');
                    setReadyForCelebration(true);
                }
            };

            handleWin();
            // No timer cleanup needed since we removed the auto-trigger timers

        } else if (gameState === 'lost') {
            processedGame.current = true;
            let timer: NodeJS.Timeout;

            const handleLoss = async () => {
                await refetchStats();
                if (!isGuest) {
                    timer = setTimeout(() => {
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
                                isGuest: isGuest ? 'true' : 'false',
                                currentStreak: '0',
                                isStreakSaverGame: isStreakSaverGame ? 'true' : 'false',
                                isToday: (isTodayPuzzle ?? (puzzle.date === new Date().toISOString().split('T')[0])).toString(),
                                justFinished: 'true'
                            }
                        });
                    }, 1500);
                }
            };
            handleLoss();
            return () => clearTimeout(timer);
        }
    }, [gameState, isRestored, finalStreak, isStreakSaverGame, isTodayPuzzle]); // Added finalStreak, isStreakSaverGame, isTodayPuzzle to deps

    // Helper function to navigate to game-result with all params
    // Optional parameters allow passing captured values to avoid closure issues
    const navigateToResult = (overrideStreak?: number, overrideBadges?: any[]) => {
        const finalStreak = overrideStreak ?? streakToDisplay;
        const finalBadges = overrideBadges ?? earnedBadgesState;

        router.replace({
            pathname: '/game-result',
            params: {
                isWin: 'true',
                guessesCount: guesses.length.toString(),
                maxGuesses: '5',
                answerDateCanonical: puzzle.solutionDate,
                eventTitle: puzzle.title,
                eventDescription: puzzle.eventDescription || '',
                gameMode,
                puzzleId: puzzle.id.toString(),
                isGuest: isGuest ? 'true' : 'false',
                currentStreak: finalStreak.toString(),
                isStreakSaverGame: isStreakSaverGame ? 'true' : 'false',
                earnedBadges: JSON.stringify(finalBadges),
                isToday: (isTodayPuzzle ?? (puzzle.date === new Date().toISOString().split('T')[0])).toString(),
                justFinished: 'true'
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

        // Standard users: wait 2 seconds for ad to fully appear on screen
        console.log('[ActiveGame] Standard user - Waiting 4s before enabling Continue button');
        const timer = setTimeout(() => {
            console.log('[ActiveGame] Enabling Continue button after 4s wait');
            setButtonEnabled(true);
        }, 4000);

        return () => clearTimeout(timer);
    }, [readyForCelebration, isPro, isGuest, wasInitiallyComplete, gameState]);



    if (gameState === 'loading') {
        return (
            <View className="flex-1 justify-center items-center">
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

                    {/* Clue Box - Moved from GameScreen to sync animations */}
                    <Animated.View
                        className={`mx-6 -mt-6 mb-2 rounded-3xl items-center ${cluesEnabled ? 'bg-white dark:bg-slate-800 shadow-sm p-4' : 'h-10'}`}
                        style={{ zIndex: 100, maxWidth: 582, alignSelf: 'center', width: '100%' }}
                    >
                        {cluesEnabled && (
                            <>
                                <ThemedText className="font-n-bold text-[#3b82f6] mb-1 tracking-wide text-center" size="base">
                                    {puzzle.category}
                                </ThemedText>
                                <ThemedText className="font-n-bold text-center leading-7" size="xl">
                                    {puzzle.title}
                                </ThemedText>
                            </>
                        )}
                    </Animated.View>

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
                    <View style={{ paddingBottom: 25, paddingTop: 8, maxWidth: 582, alignSelf: 'center', width: '100%' }}>
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
                            <View className="items-center px-4">
                                <TouchableOpacity
                                    onPress={async () => {
                                        // Prioritize authoritative finalStreak if available (from local hook state)
                                        const displayStreak = finalStreak ?? stats?.current_streak ?? 0;

                                        // Fetch badges for immediate gratification (Manual Path)
                                        // IMPORTANT: Skip if this is a restored game (viewing completed game)
                                        let earnedBadges: any[] = [];
                                        if (isRestored) {
                                            console.log('[ActiveGame] Manual Continue - skipping badges (restored game)');
                                        } else {
                                            try {
                                                // Quick RPC checks
                                                if (user) {
                                                    // Get Region Context
                                                    let userRegion = 'UK';
                                                    if (gameMode === 'REGION') {
                                                        const { data: profile } = await supabase.from('user_profiles').select('region').eq('id', user.id).single();
                                                        userRegion = profile?.region || 'UK';
                                                    }
                                                    const REGION_CTX = gameMode === 'REGION' ? userRegion : 'GLOBAL';

                                                    if (displayStreak > 0) {
                                                        const streakBadge = await checkAndAwardStreakBadge(user.id, displayStreak, gameMode, REGION_CTX);
                                                        if (streakBadge) earnedBadges.push(streakBadge);
                                                    }
                                                    if (guesses.length === 1 || guesses.length === 2) {
                                                        const elementleBadge = await checkAndAwardElementleBadge(user.id, guesses.length, gameMode, REGION_CTX);
                                                        if (elementleBadge) earnedBadges.push(elementleBadge);
                                                    }
                                                }
                                            } catch (e) {
                                                console.log('[ActiveGame] Manual nav badge check failed', e);
                                            }
                                        }

                                        // Manual continue - store badges and navigate (celebrations happen on game-result)
                                        console.log('[ActiveGame] Manual Continue - storing badges and navigating', earnedBadges);

                                        // Cancel Pro user auto-navigation timer if it exists
                                        if (proNavigationTimerRef.current) {
                                            console.log('[ActiveGame] Cancelling Pro user auto-navigation timer');
                                            clearTimeout(proNavigationTimerRef.current);
                                            proNavigationTimerRef.current = null;
                                        }

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

            {/* Holiday Modal - Independent of Intro Logic */}
            {!isLoading && (
                <HolidayActiveModal
                    visible={showHolidayPopup}
                    holidayEndDate={holidayEndDateDisplay}
                    onContinueHoliday={() => setShowHolidayPopup(false)}
                    onExitHoliday={async () => {
                        setShowHolidayPopup(false);
                        try {
                            await endHoliday(false);
                            // [FIX] Reload the game screen to show streak intro
                            // Use replace to reload with fresh state
                            console.log('[ActiveGame] Holiday exited - reloading game to show streak intro');
                            router.replace(`/game/${gameMode}/${puzzle.date}`);
                        } catch (e) {
                            console.error("Failed to exit holiday mode", e);
                        }
                    }}
                />
            )}

        </ThemedView >
    );
}
