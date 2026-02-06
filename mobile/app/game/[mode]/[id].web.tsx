import React, { useEffect, useState, useMemo } from 'react';
import { View, Text, ActivityIndicator, StyleSheet, Pressable } from 'react-native';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ChevronLeft, HelpCircle, Calendar } from 'lucide-react-native';
import { format } from 'date-fns';

import { usePlayLogic, PuzzleData } from '../../../hooks/usePlayLogic';
import { useGameEngine } from '../../../hooks/useGameEngine';
import { useAuth } from '../../../lib/auth';
import { useOptions } from '../../../lib/options';
import { useUserStats } from '../../../hooks/useUserStats';
import { useStreakSaver } from '../../../contexts/StreakSaverContext';
import { InputGrid } from '../../../components/InputGrid';
import { NumericKeyboard } from '../../../components/NumericKeyboard';
import { HelpModal } from '../../../components/HelpModal';

// Assets
const StreakHamster = require('../../../assets/ui/webp_assets/Streak-Hamster-Black.webp');
const SherlockHamster = require('../../../assets/ui/webp_assets/Sherlock-Hamster.webp');

// Brand Colors
const HEADER_BLUE = '#7DAAE8';
const HEADER_TEAL = '#66becb';

// ============================================================================
// Web Game Screen
// ============================================================================

export default function GameScreenWeb() {
    const params = useLocalSearchParams();
    const router = useRouter();
    const { user } = useAuth();

    // Parse params
    const modeParam = Array.isArray(params.mode) ? params.mode[0] : params.mode;
    const idParam = Array.isArray(params.id) ? params.id[0] : params.id;
    const mode = (modeParam as 'REGION' | 'USER') || 'REGION';
    const puzzleIdParam = idParam || 'today';

    // Use shared play logic hook
    const {
        puzzle,
        loading,
        debugInfo,
        introPhase,
        setIntroPhase,
        handlePlayClick,
        handleBack,
        isRegion,
        brandColor,
        isTodayPuzzle,
    } = usePlayLogic({ mode, puzzleIdParam });

    // Options
    const { cluesEnabled, dateFormatOrder } = useOptions();

    // Stats for streak display
    const { stats } = useUserStats(mode);
    const currentStreak = stats?.current_streak ?? 0;

    // Streak Saver
    const { isInStreakSaverMode, streakSaverSession } = useStreakSaver();
    const isStreakSaverGame = isInStreakSaverMode && !!streakSaverSession;

    // UI state
    const [helpVisible, setHelpVisible] = useState(false);
    const [gameState, setGameState] = useState<'loading' | 'playing' | 'won' | 'lost'>('loading');

    // Determine intro visibility
    const isIntroActive = introPhase === 'visible';
    const isStreakGame = isTodayPuzzle && currentStreak > 0 && !isStreakSaverGame;

    // Header color based on mode
    const headerColor = isRegion ? HEADER_BLUE : HEADER_TEAL;

    // Handle play button click - transition to game
    const onPlayClick = () => {
        setIntroPhase('hidden');
    };

    // [FIX] Immediate redirect for pre-completed puzzles
    // If returning to a puzzle that was already won/lost, skip everything and go to result
    useEffect(() => {
        if (!loading && puzzle && (puzzle.isWin || puzzle.isLoss)) {
            console.log('[GameScreenWeb] Puzzle already completed, redirecting to result');
            router.replace({
                pathname: '/game-result',
                params: {
                    isWin: (puzzle.isWin || false).toString(),
                    guessesCount: (puzzle.guesses?.length || 0).toString(),
                    maxGuesses: '5',
                    answerDateCanonical: puzzle.solutionDate,
                    eventTitle: puzzle.title,
                    eventDescription: puzzle.eventDescription || '',
                    gameMode: mode,
                    puzzleId: puzzle.id.toString(),
                    isStreakSaverGame: isStreakSaverGame.toString(),
                    isToday: isTodayPuzzle.toString(),
                    justFinished: 'false', // Not just finished - returning
                }
            });
        }
    }, [loading, puzzle, mode, isStreakSaverGame, isTodayPuzzle, router]);

    // Show loading state while fetching puzzle
    if (loading) {
        return (
            <View style={styles.container}>
                <View style={[styles.header, { backgroundColor: headerColor }]}>
                    <Text style={styles.headerTitle}>Elementle</Text>
                </View>
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={headerColor} />
                    <Text style={styles.loadingText}>Loading puzzle...</Text>
                </View>
            </View>
        );
    }

    // Show error state
    if (!puzzle) {
        return (
            <View style={styles.container}>
                <View style={[styles.header, { backgroundColor: headerColor }]}>
                    <Text style={styles.headerTitle}>Elementle</Text>
                </View>
                <View style={styles.errorContainer}>
                    <Text style={styles.errorTitle}>No Puzzle Found</Text>
                    <Text style={styles.errorText}>
                        {debugInfo || `We couldn't find a puzzle for ${mode} mode on this date.`}
                    </Text>
                    <Pressable
                        style={[styles.actionButton, { backgroundColor: headerColor }]}
                        onPress={() => router.replace('/archive')}
                    >
                        <Calendar size={20} color="#FFFFFF" />
                        <Text style={styles.actionButtonText}>Pick Another Date</Text>
                    </Pressable>
                    <Pressable
                        style={[styles.actionButton, { backgroundColor: '#475569' }]}
                        onPress={handleBack}
                    >
                        <ChevronLeft size={20} color="#FFFFFF" />
                        <Text style={styles.actionButtonText}>Go Back</Text>
                    </Pressable>
                </View>
            </View>
        );
    }

    // TWO-STATE SYSTEM: Render Intro OR Game
    if (isIntroActive) {
        return (
            <IntroView
                puzzle={puzzle}
                mode={mode}
                isStreakGame={isStreakGame}
                isStreakSaverGame={isStreakSaverGame}
                currentStreak={currentStreak}
                cluesEnabled={cluesEnabled}
                headerColor={headerColor}
                onPlayClick={onPlayClick}
                onBack={handleBack}
                setHelpVisible={setHelpVisible}
            />
        );
    }

    return (
        <GameView
            puzzle={puzzle}
            mode={mode}
            headerColor={headerColor}
            cluesEnabled={cluesEnabled}
            isTodayPuzzle={isTodayPuzzle}
            isStreakSaverGame={isStreakSaverGame}
            gameState={gameState}
            setGameState={setGameState}
            helpVisible={helpVisible}
            setHelpVisible={setHelpVisible}
            onBack={handleBack}
        />
    );
}

// ============================================================================
// Intro View Component (matches first screenshot)
// ============================================================================

interface IntroViewProps {
    puzzle: PuzzleData;
    mode: 'REGION' | 'USER';
    isStreakGame: boolean;
    isStreakSaverGame: boolean;
    currentStreak: number;
    cluesEnabled: boolean;
    headerColor: string;
    onPlayClick: () => void;
    onBack: () => void;
    setHelpVisible: (visible: boolean) => void;
}

function IntroView({
    puzzle,
    mode,
    isStreakGame,
    isStreakSaverGame,
    currentStreak,
    cluesEnabled,
    headerColor,
    onPlayClick,
    onBack,
    setHelpVisible,
}: IntroViewProps) {
    const isBlackBg = isStreakGame || isStreakSaverGame;

    const formattedDate = puzzle.date
        ? format(new Date(puzzle.date), 'MMM d, yyyy')
        : '';

    const promptText = cluesEnabled
        ? (mode === 'REGION'
            ? "On what date did this historical event occur?"
            : "On what date did this personal event occur?")
        : "Take on the challenge of guessing a date in history!";

    // For streak games: black bg with colored text
    // For normal games: white bg with blue header (matching screenshot 1)
    const containerBg = isBlackBg ? '#000000' : '#FFFFFF';
    const textColor = isBlackBg ? '#FFFFFF' : '#54524F';
    const categoryColor = isBlackBg ? '#FFD700' : '#3b82f6';
    const promptColor = isBlackBg ? '#EF4444' : '#64748B';

    return (
        <View style={[styles.container, { backgroundColor: containerBg }]}>
            {/* Blue Header Band */}
            <View style={[styles.header, { backgroundColor: isBlackBg ? '#000000' : headerColor }]}>
                <Pressable style={styles.headerButton} onPress={onBack}>
                    <ChevronLeft size={32} color="#FFFFFF" />
                </Pressable>
                <Text style={styles.headerTitle}>Elementle</Text>
                <Pressable style={styles.headerButton} onPress={() => setHelpVisible(true)}>
                    <HelpCircle size={28} color="#FFFFFF" />
                </Pressable>
            </View>

            {/* Centered Content */}
            <View style={styles.introContent}>
                {/* Hamster Image */}
                <View style={styles.hamsterContainer}>
                    {isBlackBg ? (
                        <View style={styles.streakHamsterWrapper}>
                            <Image
                                source={StreakHamster}
                                style={styles.hamsterImage}
                                contentFit="contain"
                            />
                            {/* Streak Number Overlay */}
                            <View style={styles.streakNumberOverlay}>
                                <Text style={[
                                    styles.streakNumber,
                                    currentStreak.toString().length === 1 && styles.streakNumberLarge,
                                    currentStreak.toString().length === 2 && styles.streakNumberMedium,
                                    currentStreak.toString().length >= 3 && styles.streakNumberSmall,
                                ]}>
                                    {currentStreak}
                                </Text>
                            </View>
                        </View>
                    ) : (
                        <Image
                            source={SherlockHamster}
                            style={styles.hamsterImage}
                            contentFit="contain"
                        />
                    )}
                </View>

                {/* Prompt Text */}
                <Text style={[styles.introPrompt, { color: promptColor }]}>
                    {isBlackBg ? "Continue your streak!" : promptText}
                </Text>

                {/* Category and Title */}
                {cluesEnabled && (
                    <View style={styles.introQuestionBox}>
                        {puzzle.category && (
                            <Text style={[styles.introCategory, { color: categoryColor }]}>
                                {puzzle.category}
                            </Text>
                        )}
                        {puzzle.title && (
                            <Text style={[styles.introTitle, { color: textColor }]}>
                                {puzzle.title}
                            </Text>
                        )}
                    </View>
                )}

                {/* Play Button - Blue Pill */}
                <Pressable
                    style={[styles.playButton, { backgroundColor: headerColor }]}
                    onPress={onPlayClick}
                >
                    <Text style={styles.playButtonText}>PLAY</Text>
                </Pressable>

                {/* Date Footer */}
                {formattedDate && (
                    <Text style={[styles.dateFooter, { color: isBlackBg ? 'rgba(255,255,255,0.6)' : headerColor }]}>
                        Puzzle date: {formattedDate}
                    </Text>
                )}
            </View>
        </View>
    );
}

// ============================================================================
// Game View Component (matches second screenshot)
// ============================================================================

interface GameViewProps {
    puzzle: PuzzleData;
    mode: 'REGION' | 'USER';
    headerColor: string;
    cluesEnabled: boolean;
    isTodayPuzzle: boolean;
    isStreakSaverGame: boolean;
    gameState: 'loading' | 'playing' | 'won' | 'lost';
    setGameState: (state: 'loading' | 'playing' | 'won' | 'lost') => void;
    helpVisible: boolean;
    setHelpVisible: (visible: boolean) => void;
    onBack: () => void;
}

function GameView({
    puzzle,
    mode,
    headerColor,
    cluesEnabled,
    isTodayPuzzle,
    isStreakSaverGame,
    gameState,
    setGameState,
    helpVisible,
    setHelpVisible,
    onBack,
}: GameViewProps) {
    const router = useRouter();
    const { dateFormatOrder } = useOptions();

    // Use game engine hook
    const {
        gameState: engineGameState,
        currentInput,
        guesses,
        keyStates,
        submitGuess,
        handleDigitPress,
        handleDelete,
        handleClear,
        isValidGuess,
        invalidShake,
        numDigits,
    } = useGameEngine({
        puzzleId: puzzle.id,
        answerDateCanonical: puzzle.solutionDate,
        puzzleDate: puzzle.date,
        mode,
    });

    // Update game state from engine
    useEffect(() => {
        if (engineGameState !== 'loading') {
            setGameState(engineGameState);
        }
    }, [engineGameState, setGameState]);

    // Generate placeholders
    const placeholders = useMemo(() => {
        if (numDigits === 8) {
            return dateFormatOrder === 'mmddyy'
                ? ['M', 'M', 'D', 'D', 'Y', 'Y', 'Y', 'Y']
                : ['D', 'D', 'M', 'M', 'Y', 'Y', 'Y', 'Y'];
        } else {
            return dateFormatOrder === 'mmddyy'
                ? ['M', 'M', 'D', 'D', 'Y', 'Y']
                : ['D', 'D', 'M', 'M', 'Y', 'Y'];
        }
    }, [numDigits, dateFormatOrder]);

    // Note: Removed auto-navigation to result. User now manually clicks Continue button.

    return (
        <View style={styles.container}>
            {/* Blue Header Band */}
            <View style={[styles.header, { backgroundColor: headerColor }]}>
                <Pressable style={styles.headerButton} onPress={onBack}>
                    <ChevronLeft size={32} color="#FFFFFF" />
                </Pressable>
                <Text style={styles.headerTitle}>Elementle</Text>
                <Pressable style={styles.headerButton} onPress={() => setHelpVisible(true)}>
                    <HelpCircle size={28} color="#FFFFFF" />
                </Pressable>
            </View>

            {/* Main Content Area */}
            <View style={styles.gameArea}>
                {/* Question Card - White card overlapping header */}
                {cluesEnabled && (
                    <View style={styles.questionCard}>
                        <Text style={styles.questionCategory}>{puzzle.category}</Text>
                        <Text style={styles.questionTitle}>{puzzle.title}</Text>
                    </View>
                )}

                {/* Input Grid */}
                <View style={styles.gridWrapper}>
                    <InputGrid
                        guesses={guesses}
                        currentInput={currentInput}
                        maxGuesses={5}
                        placeholders={placeholders}
                        invalidShake={invalidShake}
                    />
                </View>

                {/* Numeric Keyboard */}
                <View style={styles.keyboardWrapper}>
                    {gameState === 'playing' ? (
                        <NumericKeyboard
                            onDigitPress={handleDigitPress}
                            onDelete={handleDelete}
                            onClear={handleClear}
                            onEnter={submitGuess}
                            keyStates={keyStates}
                            canSubmit={isValidGuess}
                        />
                    ) : (
                        <View style={styles.endStateContainer}>
                            <Text style={styles.endStateText}>
                                {gameState === 'won' ? '🎉 Congratulations!' : '😔 Better luck next time!'}
                            </Text>
                            <Pressable
                                style={[styles.continueButton, { backgroundColor: gameState === 'won' ? '#22C55E' : '#64748B' }]}
                                onPress={() => {
                                    router.replace({
                                        pathname: '/game-result',
                                        params: {
                                            isWin: (gameState === 'won').toString(),
                                            guessesCount: guesses.length.toString(),
                                            maxGuesses: '5',
                                            answerDateCanonical: puzzle.solutionDate,
                                            eventTitle: puzzle.title,
                                            eventDescription: puzzle.eventDescription || '',
                                            gameMode: mode,
                                            puzzleId: puzzle.id.toString(),
                                            isStreakSaverGame: isStreakSaverGame.toString(),
                                            isToday: isTodayPuzzle.toString(),
                                            justFinished: 'true',
                                        }
                                    });
                                }}
                            >
                                <Text style={styles.continueButtonText}>Continue</Text>
                            </Pressable>
                        </View>
                    )}
                </View>
            </View>

            {/* Help Modal */}
            <HelpModal visible={helpVisible} onClose={() => setHelpVisible(false)} />
        </View>
    );
}

// ============================================================================
// Styles - Matching Mobile Screenshots
// ============================================================================

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F8FAFC',
        minHeight: '100vh' as any,
    },

    // ========== Header (Blue Band) ==========
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingTop: 12,
        paddingBottom: 16,
        minHeight: 60,
    },
    headerButton: {
        width: 48,
        height: 48,
        borderRadius: 24,
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerTitle: {
        fontSize: 28,
        fontWeight: '700',
        color: '#FFFFFF',
        fontFamily: 'Nunito_700Bold, Nunito',
        letterSpacing: -0.5,
    },

    // ========== Loading / Error ==========
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingText: {
        marginTop: 16,
        fontSize: 16,
        color: '#64748B',
        fontFamily: 'Nunito_400Regular, Nunito',
    },
    errorContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 24,
    },
    errorTitle: {
        fontSize: 24,
        fontWeight: '700',
        color: '#1e293b',
        fontFamily: 'Nunito_700Bold, Nunito',
        marginBottom: 8,
    },
    errorText: {
        fontSize: 16,
        textAlign: 'center',
        color: '#64748B',
        marginBottom: 24,
        fontFamily: 'Nunito_400Regular, Nunito',
    },
    actionButton: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 24,
        paddingVertical: 12,
        borderRadius: 12,
        marginBottom: 12,
        gap: 8,
    },
    actionButtonText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '600',
        fontFamily: 'Nunito_600SemiBold, Nunito',
    },

    // ========== Intro View ==========
    introContent: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 24,
        marginTop: -40, // Slight upward shift for visual balance
    },
    hamsterContainer: {
        width: 160,
        height: 160,
        marginBottom: 24,
        justifyContent: 'center',
        alignItems: 'center',
    },
    hamsterImage: {
        width: 140,
        height: 140,
    },
    streakHamsterWrapper: {
        position: 'relative',
        width: '100%',
        height: '100%',
        justifyContent: 'center',
        alignItems: 'center',
    },
    streakNumberOverlay: {
        position: 'absolute',
        bottom: 20,
        left: 0,
        right: 0,
        alignItems: 'center',
    },
    streakNumber: {
        color: '#DC2626',
        fontWeight: '800',
        textShadowColor: 'rgba(255, 255, 255, 0.8)',
        textShadowOffset: { width: 0, height: 0 },
        textShadowRadius: 10,
    },
    streakNumberLarge: {
        fontSize: 48,
    },
    streakNumberMedium: {
        fontSize: 40,
    },
    streakNumberSmall: {
        fontSize: 32,
    },
    introPrompt: {
        fontSize: 16,
        fontWeight: '500',
        textAlign: 'center',
        marginBottom: 8,
        fontFamily: 'Nunito_500Medium, Nunito',
        maxWidth: 300,
    },
    introQuestionBox: {
        alignItems: 'center',
        marginBottom: 24,
    },
    introCategory: {
        fontSize: 18,
        fontWeight: '700',
        textAlign: 'center',
        fontFamily: 'Nunito_700Bold, Nunito',
        marginBottom: 4,
    },
    introTitle: {
        fontSize: 18,
        fontWeight: '700',
        textAlign: 'center',
        fontFamily: 'Nunito_700Bold, Nunito',
    },
    playButton: {
        paddingHorizontal: 56,
        paddingVertical: 14,
        borderRadius: 24,
        marginBottom: 24,
    },
    playButtonText: {
        color: '#FFFFFF',
        fontSize: 18,
        fontWeight: '700',
        fontFamily: 'Nunito_700Bold, Nunito',
        letterSpacing: 1,
    },
    dateFooter: {
        fontSize: 14,
        fontFamily: 'Nunito_400Regular, Nunito',
    },

    // ========== Game View ==========
    gameArea: {
        flex: 1,
        alignItems: 'center',
        paddingTop: 8,
    },
    questionCard: {
        backgroundColor: '#FFFFFF',
        paddingHorizontal: 32,
        paddingVertical: 12,
        borderRadius: 16,
        marginTop: -20, // Overlap the header
        marginBottom: 16,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 8,
        elevation: 3,
        maxWidth: 500,
        width: '90%',
    },
    questionCategory: {
        fontSize: 14,
        fontWeight: '700',
        color: '#22C55E',
        fontFamily: 'Nunito_700Bold, Nunito',
        letterSpacing: 0.5,
        marginBottom: 2,
    },
    questionTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#1e293b',
        fontFamily: 'Nunito_700Bold, Nunito',
        textAlign: 'center',
    },
    gridWrapper: {
        maxWidth: 440,
        width: '100%',
        paddingHorizontal: 16,
        marginBottom: 16,
    },
    keyboardWrapper: {
        maxWidth: 500,
        width: '100%',
        paddingHorizontal: 16,
        paddingBottom: 24,
    },
    endStateContainer: {
        alignItems: 'center',
        paddingVertical: 32,
    },
    endStateText: {
        fontSize: 20,
        fontWeight: '600',
        color: '#64748B',
        fontFamily: 'Nunito_600SemiBold, Nunito',
        marginBottom: 16,
    },
    continueButton: {
        paddingHorizontal: 48,
        paddingVertical: 16,
        borderRadius: 24,
        marginTop: 8,
    },
    continueButtonText: {
        fontSize: 18,
        fontWeight: '700',
        color: '#FFFFFF',
        fontFamily: 'Nunito_700Bold, Nunito',
    },
});
