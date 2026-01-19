
import React, { useEffect } from 'react';
import { View, Text, ActivityIndicator, Image, TouchableOpacity } from 'react-native';
import { styled } from 'nativewind';
import { useRouter } from 'expo-router';
import { HelpCircle } from 'lucide-react-native';

import { InputGrid } from '../InputGrid';
import { NumericKeyboard } from '../NumericKeyboard';
import { useGameEngine } from '../../hooks/useGameEngine';
import { StreakCelebration } from './StreakCelebration';
import { BadgeUnlockModal } from './BadgeUnlockModal';
import { IntroScreen } from './IntroScreen';
import { useOptions } from '../../lib/options';

import { useUserStats } from '../../hooks/useUserStats';
import { useBadgeSystem, Badge } from '../../hooks/useBadgeSystem';

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
}

export function ActiveGame({ puzzle, gameMode, backgroundColor = '#FAFAFA' }: ActiveGameProps) {
    const router = useRouter();
    const { dateLength, cluesEnabled, dateFormatOrder } = useOptions(); // Get dateLength, cluesEnabled, and dateFormatOrder

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
        isRestored
    } = useGameEngine({
        puzzleId: puzzle.id,
        answerDateCanonical: puzzle.solutionDate, // Use the actual solution date
        mode: gameMode
    });

    // Generate dynamic placeholders based on dateLength and dateFormatOrder
    const placeHolders = React.useMemo(() => {
        if (dateLength === 8) {
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
    }, [dateLength, dateFormatOrder]);

    // ... Hook Integrations ...

    // TODO: Fetch streak info or calculate it here if needed for UI,
    // though ResultModal might fetch it independently or use context.

    // -- Hook Integrations --
    const { stats, refetch: refetchStats, updateStats } = useUserStats();
    const { checkBadgesForWin, markBadgeAsSeen, pendingBadges } = useBadgeSystem();

    // -- Local State for UI Flow --
    const [isLoading, setIsLoading] = React.useState(true);
    const [showIntro, setShowIntro] = React.useState(false);
    const [showStreakCelebration, setShowStreakCelebration] = React.useState(false);
    const [streakToDisplay, setStreakToDisplay] = React.useState(0);

    // Badge Queue System
    const [newBadgesQueue, setNewBadgesQueue] = React.useState<Badge[]>([]);
    const [currentBadge, setCurrentBadge] = React.useState<Badge | null>(null);
    const [showBadgeModal, setShowBadgeModal] = React.useState(false);

    // Prevent double-processing of game end
    const processedGame = React.useRef(false);

    // Loading logic: Wait for game state to be loaded AND minimum 1.5s
    useEffect(() => {
        if (gameState === 'loading') return;

        const startTime = Date.now();
        const MINIMUM_LOADING_TIME = 1500; // 1.5 seconds

        const timer = setTimeout(() => {
            setIsLoading(false);

            // After loading completes, determine whether to show intro
            // Only show intro for fresh games (playing, no guesses, not restored)
            if (gameState === 'playing' && guesses.length === 0 && !isRestored) {
                setShowIntro(true);
            }
        }, Math.max(0, MINIMUM_LOADING_TIME - (Date.now() - startTime)));

        return () => clearTimeout(timer);
    }, [gameState, guesses.length, isRestored]);

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
            processedGame.current = true;

            // 1. Calculate new streak (add 1 if not already updated in DB, 
            // but DB update might be async. Best to trust stats + 1 or optimistically update)
            const currentStreak = stats?.current_streak || 0;
            const displayStreak = (stats?.current_streak || 0) + 1;
            setStreakToDisplay(displayStreak);

            // 2. Update Stats
            updateStats(true);

            // 3. Show celebration after delay
            const timer = setTimeout(() => {
                setShowStreakCelebration(true);

                // 4. Check Badges
                checkBadgesForWin(guesses.length, displayStreak, gameMode, puzzle.id.toString())
                    .then(badges => {
                        if (badges && badges.length > 0) {
                            setNewBadgesQueue(badges);
                        }
                    });

                // Refetch stats to be sure
                refetchStats();
            }, 500);

            return () => clearTimeout(timer);
        } else if (gameState === 'lost') {
            processedGame.current = true;

            // Update Stats (reset streak, etc.)
            updateStats(false);

            // No celebration, just navigate to result after delay
            const timer = setTimeout(() => {
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
                    }
                });
            }, 1000);
            return () => clearTimeout(timer);
        }
    }, [gameState, isRestored]); // Added isRestored to deps


    if (gameState === 'loading') {
        return (
            <View className="flex-1 justify-center items-center">
                <ActivityIndicator size="large" color="#3b82f6" />
            </View>
        );
    }

    // Handlers (moved below loading check, could be above but logic only needed when playing)
    const handleStreakClose = () => {
        setShowStreakCelebration(false);

        // Transition to Badge Check
        if (newBadgesQueue.length > 0) {
            const nextBadge = newBadgesQueue[0];
            setCurrentBadge(nextBadge);
            setShowBadgeModal(true);
        } else {
            // No badges, navigate to result
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
                }
            });
        }
    };

    const handleBadgeClose = async () => {
        if (currentBadge) {
            await markBadgeAsSeen(currentBadge.id);
        }
        setShowBadgeModal(false);

        // Check if more badges in queue (excluding the one just shown)
        const remainingBadges = newBadgesQueue.slice(1);
        setNewBadgesQueue(remainingBadges);

        if (remainingBadges.length > 0) {
            // Show next badge after brief delay
            setTimeout(() => {
                setCurrentBadge(remainingBadges[0]);
                setShowBadgeModal(true);
            }, 300);
        } else {
            // Done with badges, navigate to result
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
                }
            });
        }
    };

    // Construct Display Strings
    // Only show location for Local History category (999)
    const categoryText = puzzle.category || '';
    const locationText = puzzle.categoryNumber === 999 && puzzle.location ? `: ${puzzle.location}` : '';
    const headerLine1 = `${categoryText}${locationText}`;

    return (
        <View className="flex-1 bg-slate-50 dark:bg-slate-800">
            {/* Loading Spinner - shown while determining game state */}
            {isLoading && (
                <View className="flex-1 items-center justify-center bg-slate-50 dark:bg-slate-800">
                    <ActivityIndicator size="large" color="#7DAAE8" />
                    <Text className="text-slate-600 dark:text-slate-300 mt-4 font-n-medium">Loading puzzle...</Text>
                </View>
            )}

            {!isLoading && !showIntro && (
                <>
                    {/* Title & Info */}
                    <View className="items-center mt-6 mb-4 px-4">
                        <StyledText className="text-base font-n-bold text-[#3b82f6] mb-1 tracking-wide text-center">
                            {headerLine1 || (gameMode === 'REGION' ? 'Great Britain' : 'Personal User')}
                        </StyledText>

                        {/* Event Title - only show if clues enabled */}
                        {cluesEnabled && (
                            <StyledText className="font-n-bold text-slate-800 dark:text-white text-center text-[22px] leading-7">
                                {puzzle.title}
                            </StyledText>
                        )}
                    </View>

                    {/* Game Grid */}
                    <View className="flex-1 w-full max-w-md mx-auto px-4 justify-start bg-slate-50 dark:bg-slate-800" style={{ paddingTop: 16, paddingBottom: 8 }}>
                        <InputGrid
                            guesses={guesses}
                            currentInput={currentInput}
                            maxGuesses={5}
                            placeholders={placeHolders}
                            invalidShake={invalidShake}
                            isRestored={isRestored} // Always animate if restored
                        />
                    </View>

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
                                            }
                                        });
                                    }}
                                    className="bg-slate-300 dark:bg-slate-700 w-full py-4 rounded-xl items-center active:bg-slate-400 dark:active:bg-slate-600"
                                >
                                    <StyledText className="text-slate-900 dark:text-white font-n-bold text-lg">
                                        Continue
                                    </StyledText>
                                </TouchableOpacity>
                            </View>
                        )}
                    </View>
                </>
            )}

            {/* Intro Screen */}
            {!isLoading && (
                <IntroScreen
                    visible={showIntro}
                    gameMode={gameMode}
                    onStart={() => setShowIntro(false)}
                    puzzleDate={puzzle.date}
                    eventTitle={puzzle.title}
                    currentStreak={stats?.current_streak || 0}
                    isStreakGame={false} // Todo: Determine if we are in streak mode logic
                />
            )}


            {/* Celebrations */}
            {/* Streak Celebration */}
            <StreakCelebration
                visible={showStreakCelebration}
                streak={stats?.current_streak || 0}
                onClose={() => setShowStreakCelebration(false)}
            />
            {/* Badge Unlock Modal */}
            <BadgeUnlockModal
                visible={showBadgeModal}
                badge={currentBadge}
                onClose={handleBadgeClose}
            />
        </View>
    );
}
