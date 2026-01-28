import React, { useEffect } from 'react';
import { View, Text, ActivityIndicator, Image, TouchableOpacity } from 'react-native';
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
import { IntroScreen } from './IntroScreen';
import { useOptions } from '../../lib/options';

import { useUserStats } from '../../hooks/useUserStats';
import { useBadgeSystem, Badge } from '../../hooks/useBadgeSystem';
import { ThemedText } from '../ThemedText';
import { ThemedView } from '../ThemedView';
import { useThemeColor } from '../../hooks/useThemeColor';
import { HolidayActiveModal } from './HolidayActiveModal';
import { useStreakSaverStatus } from '../../hooks/useStreakSaverStatus';

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
}

export function ActiveGame({ puzzle, gameMode, backgroundColor = '#FAFAFA', onGameStateChange, isStreakSaverGame, onStreakSaverExit }: ActiveGameProps) {
    const router = useRouter();
    const { mode, id, skipIntro, preserveStreakStatus: preserveParam } = useLocalSearchParams();
    const { dateLength, cluesEnabled, dateFormatOrder } = useOptions();
    const { user } = useAuth();
    const isGuest = !user;
    const { showAd } = useInterstitialAd();
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
    const [hasCheckedHoliday, setHasCheckedHoliday] = React.useState(false);
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

    // -- Local State for UI Flow --
    const [isLoading, setIsLoading] = React.useState(true);
    const [showIntro, setShowIntro] = React.useState(false);
    const [showStreakCelebration, setShowStreakCelebration] = React.useState(false);
    const [streakToDisplay, setStreakToDisplay] = React.useState(0);

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
    useEffect(() => {
        // [FIX] Only show if we are actually PLAYING (not viewing a won game from archive)
        // Wait, if it's holiday mode, we want to show the popup to say "It's a holiday".
        // But if I go to Archive -> Click Date -> It loads a "Played/Won" game -> status != 0 -> No Popup.
        // If I go to Archive -> Click Date -> It loads a "Holiday" game (missed) -> status == 0 -> Popup?
        // User says: "that route doesn't bring up the 'Holiday Mode Active' popup, so please implement this".
        // This implies they want the "You are in holiday mode" reminder.

        if (!hasCheckedHoliday && gameState === 'playing' && streakDayStatus === 0 && !preserveStreakStatus && holidayActive) {
            console.log("[ActiveGame] Game detected as Holiday Mode (Status 0) AND Global Holiday Active. Triggering Modal.");
            setHasCheckedHoliday(true);
            setShowHolidayPopup(true);
        }
    }, [gameState, streakDayStatus, hasCheckedHoliday, preserveStreakStatus, holidayActive]);

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
            setIsLoading(false);

            // After loading completes, determine whether to show intro
            // Only show intro for fresh games (playing, no guesses, not restored)
            // AND only if skipIntro param is NOT present
            // AND only if NOT in Holiday Mode (Holiday Modal takes precedence)
            if (gameState === 'playing' && guesses.length === 0 && !isRestored && skipIntro !== 'true') {
                // Check if Holiday Mode (streakDayStatus === 0)
                // If so, rely on the specific Holiday Modal logic in useEffect below
                if (streakDayStatus !== 0) {
                    setShowIntro(true);
                } else {
                    console.log('[ActiveGame] In Holiday Mode (Status 0) - Suppressing Intro to show Holiday Modal');
                }
            }
        }, Math.max(0, MINIMUM_LOADING_TIME - (Date.now() - startTime)));

        return () => clearTimeout(timer);
    }, [gameState, guesses.length, isRestored, skipIntro]);

    // -- Side Effects --

    // Trigger Win Sequence
    useEffect(() => {
        if (processedGame.current) return;

        // Skip celebration logic if game was restored
        if (isRestored) {
            processedGame.current = true;
            return;
        }

        if (gameState === 'won') {
            // [FIX] Wait for finalStreak to be populated by GameEngine before processing
            // This prevents race condition where we show the "Old" streak (e.g. 1) before the "New" streak (e.g. 2) arrives.
            if (finalStreak === null || finalStreak === undefined) {
                console.log('[ActiveGame] Won detected but waiting for finalStreak...');
                return;
            }
            console.log('[ActiveGame] Final Streak Ready:', finalStreak);

            processedGame.current = true;
            let timer: NodeJS.Timeout;

            const handleWin = async () => {
                // 1. Use authoritative streak from GameEngine if available to avoid race conditions
                // We still refetch stats to ensure global state is synced for other components
                const { data: newStats } = await refetchStats();

                // [FIX] Invalidate pendingBadges so GameResult screen sees the new badge immediately
                queryClient.invalidateQueries({ queryKey: ['pendingBadges'] });

                // CRITICAL: Use finalStreak if available, as it definitely includes the win.
                // Fallback to DB fetch (which might be stale due to replication lag) only if necessary.
                const displayStreak = finalStreak ?? newStats?.current_streak ?? 0;

                console.log('[ActiveGame] Win detected. Display Streak:', displayStreak, '(Final:', finalStreak, 'DB:', newStats?.current_streak, ')');
                setStreakToDisplay(displayStreak);

                // 2. Navigate to Result immediately (celebration handled there)
                // Add slight delay so user sees the "Green" grid.
                timer = setTimeout(() => {
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
                            currentStreak: displayStreak.toString(),
                            isStreakSaverGame: isStreakSaverGame ? 'true' : 'false'
                        }
                    });
                }, 1500); // 1.5s delay to see the win
            };

            handleWin();
            return () => clearTimeout(timer);

        } else if (gameState === 'lost') {
            processedGame.current = true;
            let timer: NodeJS.Timeout;

            const handleLoss = async () => {
                // 1. Refetch stats to ensure UI shows correct (reset) streak
                await refetchStats();

                // 2. No celebration, navigate after delay (ONLY for users)
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
                                isStreakSaverGame: isStreakSaverGame ? 'true' : 'false'
                            }
                        });
                    }, 1500);
                }
            };
            handleLoss();
            return () => clearTimeout(timer);
        }
    }, [gameState, isRestored, finalStreak]); // Added finalStreak to deps


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

            {!isLoading && !showIntro && (
                <>
                    {/* Title & Info */}
                    <View className="items-center mt-6 mb-4 px-4">
                        {/* Only show Category/Location if Clues are Enabled, otherwise show generic mode label */}
                        {cluesEnabled ? (
                            <ThemedText className="font-n-bold text-[#3b82f6] mb-1 tracking-wide text-center" size="base">
                                {headerLine1}
                            </ThemedText>
                        ) : (
                            <ThemedText className="font-n-bold text-[#3b82f6] mb-1 tracking-wide text-center" size="base">
                                {gameMode === 'REGION' ? 'Great Britain' : 'Personal User'}
                            </ThemedText>
                        )}

                        {/* Event Title - only show if clues enabled */}
                        {cluesEnabled && (
                            <ThemedText className="font-n-bold text-center leading-7" size="2xl">
                                {puzzle.title}
                            </ThemedText>
                        )}
                    </View>

                    {/* Game Grid */}
                    <ThemedView className="flex-1 w-full max-w-md mx-auto px-4 justify-start" style={{ paddingTop: 16, paddingBottom: 8 }}>
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
                    <View style={{ paddingBottom: 16, paddingTop: 4 }}>
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
                                    onPress={() => {
                                        // Prioritize authoritative finalStreak if available (from local hook state)
                                        // But finalStreak might not be in scope here if it's inside the hook???
                                        // Wait, finalStreak IS in scope of ActiveGame component.
                                        const displayStreak = finalStreak ?? stats?.current_streak ?? 0;
                                        router.replace({
                                            pathname: '/game-result',
                                            params: {
                                                isWin: gameState === 'won' ? 'true' : 'false',
                                                guessesCount: guesses.length.toString(),
                                                maxGuesses: '5',
                                                answerDateCanonical: puzzle.solutionDate,
                                                eventTitle: puzzle.title,
                                                eventDescription: puzzle.eventDescription || '',
                                                gameMode,
                                                puzzleId: puzzle.id.toString(),
                                                isGuest: isGuest ? 'true' : 'false',
                                                currentStreak: displayStreak.toString()
                                            }
                                        });
                                    }}
                                    className="bg-slate-300 dark:bg-slate-700 w-full py-4 rounded-xl items-center active:bg-slate-400 dark:active:bg-slate-600"
                                    style={{ transform: [{ translateY: 0 }] }} // Ensure button is reachable
                                >
                                    <ThemedText className="text-slate-900 dark:text-white font-n-bold" size="lg">
                                        Continue
                                    </ThemedText>
                                </TouchableOpacity>
                            </View>
                        )}
                    </View>
                </>
            )}

            {/* Intro & Holiday Logic */}
            {!isLoading && (
                <>
                    <IntroScreen
                        visible={showIntro}
                        onStart={() => setShowIntro(false)}
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

                    <HolidayActiveModal
                        visible={showHolidayPopup}
                        holidayEndDate={holidayEndDateDisplay}
                        onContinueHoliday={() => setShowHolidayPopup(false)}
                        onExitHoliday={async () => {
                            setShowHolidayPopup(false);
                            try {
                                await endHoliday();
                            } catch (e) {
                                console.error("Failed to exit holiday mode", e);
                            }
                        }}
                    />
                </>
            )}

        </ThemedView >
    );
}
