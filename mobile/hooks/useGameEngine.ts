
import { useState, useCallback, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../lib/auth';
import { useOptions } from '../lib/options';
import { formatCanonicalDate, parseUserDateWithContext } from '../lib/dateFormat';
import { KeyState } from '../components/NumericKeyboard';
import { CellFeedback } from '../components/InputGrid';
import { checkAndAwardStreakBadge, checkAndAwardElementleBadge, checkAndAwardPercentileBadge } from '../lib/supabase-rpc';
import hapticsManager from '../lib/hapticsManager';
import soundManager from '../lib/soundManager';

export type GameState = 'loading' | 'playing' | 'won' | 'lost';
export type GameMode = 'REGION' | 'USER';

export interface UseGameEngineProps {
    puzzleId: number;
    answerDateCanonical: string; // YYYY-MM-DD
    maxGuesses?: number;
    mode?: GameMode;
}

export function useGameEngine({
    puzzleId,
    answerDateCanonical,
    maxGuesses = 5,
    mode = 'REGION'
}: UseGameEngineProps) {
    const { user, session, isGuest } = useAuth();
    const [gameState, setGameState] = useState<GameState>('loading');
    const [currentInput, setCurrentInput] = useState('');
    const [guesses, setGuesses] = useState<CellFeedback[][]>([]);
    const [keyStates, setKeyStates] = useState<Record<string, KeyState>>({});
    const [attemptId, setAttemptId] = useState<number | null>(null);
    const [wrongGuessCount, setWrongGuessCount] = useState(0);
    const [invalidShake, setInvalidShake] = useState(0); // Counter to trigger shake
    const [isRestored, setIsRestored] = useState(false);



    const { dateFormatOrder, dateLength } = useOptions();
    const numDigits = dateLength;
    // Construct full format: dateFormatOrder is 'ddmmyy' or 'mmddyy', need to append 'yy' or 'yyyy'
    const baseFormat = dateFormatOrder.startsWith('dd') ? 'ddmm' : 'mmdd';
    const yearFormat = dateLength === 8 ? 'yyyy' : 'yy';
    const dateFormat = `${baseFormat}${yearFormat}` as import('../lib/dateFormat').DateFormatPreference;

    // Dynamic Table Names
    const ATTEMPTS_TABLE = mode === 'REGION' ? 'game_attempts_region' : 'game_attempts_user';
    const GUESSES_TABLE = mode === 'REGION' ? 'guesses_region' : 'guesses_user';
    // For Region, the puzzle link is 'allocated_region_id'. For User, it is 'allocated_user_id'.
    const PUZZLE_ID_FIELD = mode === 'REGION' ? 'allocated_region_id' : 'allocated_user_id';
    const STATS_TABLE = mode === 'REGION' ? 'user_stats_region' : 'user_stats_user';
    const REGION_FIELD = mode === 'REGION' ? 'region' : null;

    // Helper function to update user stats after game completion
    // This mimics the backend recalculateUserStatsRegion/User functions
    // Returns the current streak value for badge checks
    const updateUserStats = async (isWin: boolean, numGuesses: number): Promise<number> => {
        if (!user?.id) return 0;

        try {
            console.log(`[GameEngine] Recalculating stats for ${STATS_TABLE}...`);

            // Get user's region if in REGION mode
            let userRegion = 'UK';
            if (mode === 'REGION') {
                const { data: profile } = await supabase
                    .from('user_profiles')
                    .select('region')
                    .eq('id', user.id)
                    .single();
                userRegion = profile?.region || 'UK';
            }

            // Fetch ALL completed game attempts for this user/mode
            // CRITICAL: Must join with allocated tables to get puzzle_date and filter by region
            let query = supabase
                .from(ATTEMPTS_TABLE)
                .select(`
                    id,
                    result,
                    num_guesses,
                    completed_at,
                    streak_day_status,
                    ${mode === 'REGION' ? 'questions_allocated_region(puzzle_date, region)' : 'questions_allocated_user(puzzle_date)'}
                `)
                .eq('user_id', user.id)
                .not('result', 'is', null);

            const { data: allAttempts, error: attemptsError } = await query;

            if (attemptsError) {
                console.error('[GameEngine] Error fetching attempts:', attemptsError);
                return 0;
            }

            if (!allAttempts || allAttempts.length === 0) {
                console.log('[GameEngine] No completed attempts found for stats calculation');
                return 0;
            }

            // Filter by region for REGION mode (backend does this via join)
            const filteredAttempts = mode === 'REGION'
                ? allAttempts.filter((a: any) => a.questions_allocated_region?.region === userRegion)
                : allAttempts;

            console.log(`[GameEngine] Recalculating from ${filteredAttempts.length} attempts`);

            // Calculate stats from ALL attempts
            const gamesPlayed = filteredAttempts.length;
            const gamesWon = filteredAttempts.filter((a: any) => a.result === 'won').length;

            // Calculate guess distribution (only from won games)
            const guessDistribution: Record<string, number> = { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 };
            filteredAttempts.forEach((attempt: any) => {
                if (attempt.result === 'won' && attempt.num_guesses >= 1 && attempt.num_guesses <= 5) {
                    const key = attempt.num_guesses.toString();
                    guessDistribution[key] = (guessDistribution[key] || 0) + 1;
                }
            });

            // Calculate streaks using streak_day_status and puzzle_date
            // Backend logic: streak_day_status: 0 = holiday (maintains), 1 = played (increments), NULL = missed (breaks)

            // Build date map from attempts
            const dateMap = new Map<string, { result: string | null; streakDayStatus: number | null }>();
            for (const attempt of filteredAttempts) {
                const puzzleDate = mode === 'REGION'
                    ? (attempt as any).questions_allocated_region?.puzzle_date
                    : (attempt as any).questions_allocated_user?.puzzle_date;

                if (puzzleDate) {
                    const streakStatus = (attempt as any).streak_day_status;
                    if (streakStatus !== null && streakStatus !== undefined) {
                        dateMap.set(puzzleDate, {
                            result: (attempt as any).result,
                            streakDayStatus: streakStatus
                        });
                    } else if ((attempt as any).result !== null) {
                        // Game completed but streakDayStatus not set (legacy)
                        dateMap.set(puzzleDate, {
                            result: (attempt as any).result,
                            streakDayStatus: null
                        });
                    }
                }
            }

            // Calculate current streak (from today backwards)
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const todayStr = today.toISOString().split('T')[0];

            let checkDate = new Date(today);
            if (!dateMap.has(todayStr)) {
                // Start from yesterday if no game played today
                checkDate.setDate(checkDate.getDate() - 1);
            }

            let currentStreak = 0;
            while (true) {
                const dateStr = checkDate.toISOString().split('T')[0];
                const dayData = dateMap.get(dateStr);

                if (!dayData) break; // No row - streak broken
                if (dayData.streakDayStatus === null || dayData.streakDayStatus === undefined) break; // NULL breaks chain

                // Add the streakDayStatus value (1 for played/won, 0 for holiday)
                currentStreak += dayData.streakDayStatus;
                checkDate.setDate(checkDate.getDate() - 1);
            }

            // Calculate max streak (check consecutive dates)
            const sortedDates = Array.from(dateMap.keys()).sort();
            let maxStreak = 0;
            let tempStreak = 0;
            let prevDate: Date | null = null;

            for (const currentDateStr of sortedDates) {
                const currentDate = new Date(currentDateStr);
                const dayData = dateMap.get(currentDateStr);

                if (!dayData) {
                    tempStreak = 0;
                    prevDate = null;
                    continue;
                }

                // Check for date gap (more than 1 day between entries)
                if (prevDate) {
                    const dayDiff = Math.round((currentDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24));
                    if (dayDiff > 1) {
                        tempStreak = 0; // Gap in dates - streak breaks
                    }
                }

                if (dayData.streakDayStatus === null || dayData.streakDayStatus === undefined) {
                    tempStreak = 0; // NULL breaks the streak
                } else {
                    tempStreak += dayData.streakDayStatus; // Add value (1 for played, 0 for holiday)
                    maxStreak = Math.max(maxStreak, tempStreak);
                }

                prevDate = currentDate;
            }

            // Upsert stats
            const statsData: any = {
                user_id: user.id,
                games_played: gamesPlayed,
                games_won: gamesWon,
                current_streak: currentStreak,
                max_streak: maxStreak,
                guess_distribution: guessDistribution
            };

            if (mode === 'REGION') {
                statsData.region = userRegion;
            }

            // Upsert with proper conflict resolution
            // For REGION mode: conflict on (user_id, region)
            // For USER mode: conflict on (user_id)
            const { error: upsertError } = await supabase
                .from(STATS_TABLE)
                .upsert(statsData, {
                    onConflict: mode === 'REGION' ? 'user_id,region' : 'user_id'
                });

            if (upsertError) {
                console.error('[GameEngine] Failed to upsert stats:', upsertError);
                return 0; // Return 0 streak on error
            } else {
                console.log(`[GameEngine] Updated ${STATS_TABLE} for user ${user.id}`, statsData);
                return currentStreak; // Return the new current streak for badge checks
            }
        } catch (error) {
            console.error('[GameEngine] Failed to recalculate user stats:', error);
            return 0; // Return 0 streak on error
        }
    };

    const formattedAnswer = useMemo(() => {
        return formatCanonicalDate(answerDateCanonical, dateFormat);
    }, [answerDateCanonical, dateFormat]);

    // Load game state
    useEffect(() => {
        if ((!user && !isGuest) || !puzzleId) return;

        const loadGame = async () => {
            try {
                setGameState('loading');

                // 1. Check for existing attempt
                if (isGuest) {
                    const savedState = await AsyncStorage.getItem(`guest_game_${mode}_${puzzleId}`);
                    if (savedState) {
                        const parsed = JSON.parse(savedState);
                        // parsed: { result, guesses: string[] }
                        if (parsed.result) {
                            setGameState(parsed.result === 'won' ? 'won' : 'lost');
                        } else {
                            setGameState('playing');
                        }

                        // Reconstruct guesses
                        const loadedGuesses: CellFeedback[][] = [];
                        let newKeyStates: Record<string, KeyState> = {};

                        // Guesses stored as canonical strings? Or raw digits?
                        if (parsed.guesses && Array.isArray(parsed.guesses)) {
                            parsed.guesses.forEach((guessStr: string) => {
                                const displayGuess = formatCanonicalDate(guessStr, dateFormat);
                                const feedback = calculateFeedbackOnly(displayGuess, formattedAnswer);
                                loadedGuesses.push(feedback);
                                newKeyStates = updateKeyStatesOnly(displayGuess, feedback, newKeyStates);
                            });
                        }

                        setGuesses(loadedGuesses);
                        setKeyStates(newKeyStates);
                        setWrongGuessCount(loadedGuesses.filter(g => !isGuessCorrect(g)).length);
                        return; // Done loading guest
                    } else {
                        setGameState('playing');
                        return;
                    }
                }

                if (user) {
                    // Fetch Attempt
                    const query = supabase
                        .from(ATTEMPTS_TABLE)
                        .select('*')
                        .eq('user_id', user.id);

                    if (mode === 'REGION') {
                        query.eq('allocated_region_id', puzzleId);
                    } else {
                        // User Mode
                        query.eq('allocated_user_id', puzzleId);
                    }

                    const { data: attempts, error: attemptError } = await query.maybeSingle();

                    if (attemptError && attemptError.code !== 'PGRST116') {
                        console.error('Error loading attempt:', attemptError);
                        throw attemptError;
                    }

                    if (attempts) {
                        console.log('[useGameEngine] Found attempt:', {
                            id: attempts.id,
                            mode,
                            result: attempts.result,
                            digits: attempts.digits,
                            puzzleId,
                            userId: user.id
                        });

                        setAttemptId(attempts.id);

                        if (attempts.result) {
                            setGameState(attempts.result === 'won' ? 'won' : 'lost');
                            setIsRestored(true);
                        } else {
                            setGameState('playing');
                        }

                        // 2. Load guesses for this attempt
                        const { data: dbGuesses, error: guessError } = await supabase
                            .from(GUESSES_TABLE)
                            .select('*')
                            .eq('game_attempt_id', attempts.id)
                            .order('id', { ascending: true });

                        console.log('[useGameEngine] Guesses query result:', {
                            table: GUESSES_TABLE,
                            attemptId: attempts.id,
                            guessCount: dbGuesses?.length || 0,
                            error: guessError
                        });

                        if (guessError) throw guessError;

                        if (dbGuesses && dbGuesses.length > 0) {
                            // Reconstruct local state from DB guesses
                            const loadedGuesses: CellFeedback[][] = [];
                            let newKeyStates: Record<string, KeyState> = {};

                            // CRITICAL: Use the digit format that was used when the guess was made (from attempts.digits)
                            // Not the current user preference, to preserve historical guesses correctly
                            const originalDigits = parseInt(attempts.digits || '8');
                            const baseFormat = (dateFormatOrder && dateFormatOrder.startsWith('mm')) ? 'mm' : 'dd';
                            const originalFormat = baseFormat === 'mm'
                                ? (originalDigits === 6 ? 'mmddyy' : 'mmddyyyy')
                                : (originalDigits === 6 ? 'ddmmyy' : 'ddmmyyyy');

                            // CRITICAL: Format the answer using the SAME digit count as the guesses
                            const lockedFormattedAnswer = formatCanonicalDate(answerDateCanonical, originalFormat);

                            console.log('[useGameEngine] Processing guesses:', {
                                answerCanonical: answerDateCanonical,
                                originalDigits,
                                originalFormat,
                                lockedFormattedAnswer,
                                guessesCount: dbGuesses.length
                            });

                            dbGuesses.forEach((g, idx) => {
                                // Convert canonical guess (YYYY-MM-DD) to the ORIGINAL display format
                                const displayGuess = formatCanonicalDate(g.guess_value, originalFormat);
                                // CRITICAL: Compare against answer formatted in SAME digit count
                                const feedback = calculateFeedbackOnly(displayGuess, lockedFormattedAnswer);

                                if (idx === 0) {
                                    console.log('[useGameEngine] First guess sample:', {
                                        canonical: g.guess_value,
                                        displayGuess,
                                        feedback
                                    });
                                }

                                loadedGuesses.push(feedback);
                                newKeyStates = updateKeyStatesOnly(displayGuess, feedback, newKeyStates);
                            });

                            console.log('[useGameEngine] Setting guesses:', {
                                count: loadedGuesses.length,
                                mode
                            });

                            setGuesses(loadedGuesses);
                            setKeyStates(newKeyStates);
                            setWrongGuessCount(loadedGuesses.filter(g => !isGuessCorrect(g)).length);

                            // Set isRestored flag if we loaded any guesses OR if game is finished
                            // This prevents IntroScreen from showing for partially played games
                            if (loadedGuesses.length > 0 || attempts.result) {
                                setIsRestored(true);
                            }
                        } else {
                            console.log('[useGameEngine] No guesses found for attempt');
                        }
                    } else {
                        // No attempt exists, start fresh
                        setGameState('playing');
                    }
                }
            } catch (e) {
                console.error('Failed to load game:', e);
                setGameState('playing');
            }
        };

        loadGame();
    }, [user, puzzleId, formattedAnswer, dateFormat, mode]);

    const calculateFeedbackOnly = (guess: string, answer: string): CellFeedback[] => {
        const feedback: CellFeedback[] = [];
        const answerChars = answer.split('');

        for (let i = 0; i < guess.length; i++) {
            const guessDigit = guess[i];
            const targetDigit = answer[i];

            if (guessDigit === targetDigit) {
                feedback.push({ digit: guessDigit, state: 'correct' });
            } else if (answer.includes(guessDigit)) {
                // Simple logic: if present elsewhere
                const param = parseInt(guessDigit) < parseInt(targetDigit) ? 'up' : 'down';
                feedback.push({ digit: guessDigit, state: 'inSequence', arrow: param });
            } else {
                const param = parseInt(guessDigit) < parseInt(targetDigit) ? 'up' : 'down';
                feedback.push({ digit: guessDigit, state: 'notInSequence', arrow: param });
            }
        }
        return feedback;
    };

    const updateKeyStatesOnly = (guess: string, feedback: CellFeedback[], currentKeyStates: Record<string, KeyState>): Record<string, KeyState> => {
        const newKeyStates = { ...currentKeyStates };
        for (let i = 0; i < guess.length; i++) {
            const digit = guess[i];
            const state = feedback[i].state;

            if (state === 'correct') {
                newKeyStates[digit] = 'correct';
            } else if (state === 'inSequence') {
                if (newKeyStates[digit] !== 'correct') {
                    newKeyStates[digit] = 'inSequence';
                }
            } else if (state === 'notInSequence') {
                newKeyStates[digit] = 'ruledOut';
            }
        }
        return newKeyStates;
    };

    const isGuessCorrect = (feedback: CellFeedback[]) => {
        return feedback.every(f => f.state === 'correct');
    };

    const submitGuess = async () => {
        if (currentInput.length !== numDigits || gameState !== 'playing') return;

        // 0. DATE VALIDATION
        console.log('[GameEngine] Validating date:', {
            input: currentInput,
            format: dateFormat,
            answerCanonical: answerDateCanonical
        });
        const canonicalGuessCheck = parseUserDateWithContext(currentInput, dateFormat, answerDateCanonical);
        console.log('[GameEngine] Validation result:', canonicalGuessCheck);
        if (!canonicalGuessCheck) {
            console.log('[GameEngine] Date validation FAILED - triggering shake');
            hapticsManager.error(); // Invalid date haptic
            soundManager.play('guess_failed'); // Invalid date sound
            setInvalidShake(prev => prev + 1);
            return;
        }

        // 1. Calculate feedback
        const feedback = calculateFeedbackOnly(currentInput, formattedAnswer);
        const isWin = isGuessCorrect(feedback);
        const newGuesses = [...guesses, feedback];
        const newWrongGuessCount = !isWin ? wrongGuessCount + 1 : wrongGuessCount;

        // Update local state immediately
        setGuesses(newGuesses);
        setKeyStates(prev => updateKeyStatesOnly(currentInput, feedback, prev));
        setCurrentInput('');
        setWrongGuessCount(newWrongGuessCount);

        if (isWin) {
            hapticsManager.success(); // Victory haptic
            soundManager.play('game_win'); // Victory sound
            setGameState('won');
        } else if (newGuesses.length >= maxGuesses) {
            hapticsManager.error(); // Lost game haptic
            soundManager.play('game_lose'); // Lost game sound
            setGameState('lost');
        } else {
            hapticsManager.warning(); // Incorrect guess but game continues
            soundManager.play('guess_entered'); // Guess submitted sound
        }

        // 2. Persist to DB
        if (!user) {
            if (isGuest) {
                try {
                    // Guest logic
                    const canonicalGuesses = newGuesses.map(g => {
                        const rawDigits = g.map(c => c.digit).join('');
                        return parseUserDateWithContext(rawDigits, dateFormat, answerDateCanonical) || rawDigits;
                    });

                    const stateToSave = {
                        result: isWin ? 'won' : (newGuesses.length >= maxGuesses ? 'lost' : null),
                        guesses: canonicalGuesses,
                        updatedAt: new Date().toISOString()
                    };

                    await AsyncStorage.setItem(`guest_game_${mode}_${puzzleId}`, JSON.stringify(stateToSave));
                } catch (e) {
                    console.error("Failed to save guest game", e);
                }
            }
            return;
        }

        try {
            let currentAttemptId = attemptId;

            // Create attempt if needed
            if (!currentAttemptId) {
                // Dynamic Insert
                const insertData: any = {
                    user_id: user.id,
                    started_at: new Date().toISOString(),
                    digits: numDigits.toString()
                };
                insertData[PUZZLE_ID_FIELD] = puzzleId;

                const { data: newAttempt, error: createError } = await supabase
                    .from(ATTEMPTS_TABLE)
                    .insert(insertData)
                    .select()
                    .single();

                if (createError) throw createError;
                currentAttemptId = newAttempt.id;
                setAttemptId(newAttempt.id);
            }

            // Save guess (already triggered validation above)
            // But use the validated variable
            const { error: guessError } = await supabase
                .from(GUESSES_TABLE)
                .insert({
                    game_attempt_id: currentAttemptId,
                    guess_value: canonicalGuessCheck
                });

            if (guessError) throw guessError;

            // Update attempt if game over
            if (isWin || newGuesses.length >= maxGuesses) {
                const { error: updateError } = await supabase
                    .from(ATTEMPTS_TABLE)
                    .update({
                        result: isWin ? 'won' : 'lost',
                        num_guesses: newGuesses.length,
                        completed_at: new Date().toISOString()
                    })
                    .eq('id', currentAttemptId);

                if (updateError) throw updateError;

                // Update user stats and get the new current streak
                const newCurrentStreak = await updateUserStats(isWin, newGuesses.length);

                // Award badges if user won
                if (isWin && user && newCurrentStreak > 0) {
                    try {
                        const GAME_TYPE = mode === 'REGION' ? 'REGION' : 'USER';

                        // Get user's region for badge context
                        let userRegion = 'UK';
                        if (mode === 'REGION') {
                            const { data: profile } = await supabase
                                .from('user_profiles')
                                .select('region')
                                .eq('id', user.id)
                                .single();
                            userRegion = profile?.region || 'UK';
                        }

                        const REGION = mode === 'REGION' ? userRegion : 'GLOBAL';

                        console.log('[GameEngine] Checking badges...', { streak: newCurrentStreak, guesses: newGuesses.length });

                        // 1. Check streak badge (awarded at milestones: 7, 14, 30, 50, 100, etc.)
                        const streakBadge = await checkAndAwardStreakBadge(
                            user.id,
                            newCurrentStreak,
                            GAME_TYPE,
                            REGION
                        );

                        if (streakBadge && !streakBadge.is_awarded) {
                            console.log('[GameEngine] New streak badge awarded:', streakBadge.badge_name);
                        }

                        // 2. Check elementle badge (only for 1 or 2 guesses)
                        if (newGuesses.length === 1 || newGuesses.length === 2) {
                            const elementleBadge = await checkAndAwardElementleBadge(
                                user.id,
                                newGuesses.length,
                                GAME_TYPE,
                                REGION
                            );

                            if (elementleBadge && !elementleBadge.is_awarded) {
                                console.log('[GameEngine] New elementle badge awarded:', elementleBadge.badge_name);
                            }
                        }

                        // 3. Check percentile badge (based on rank)
                        const percentileBadge = await checkAndAwardPercentileBadge(
                            user.id,
                            GAME_TYPE,
                            REGION
                        );

                        if (percentileBadge && !percentileBadge.is_awarded) {
                            console.log('[GameEngine] New percentile badge awarded:', percentileBadge.badge_name);
                        }
                    } catch (badgeError) {
                        // Don't fail the game if badge awarding fails
                        console.error('[GameEngine] Failed to award badges:', badgeError);
                    }
                }
            } else {
                await supabase
                    .from(ATTEMPTS_TABLE)
                    .update({
                        num_guesses: newGuesses.length
                    })
                    .eq('id', currentAttemptId);
            }

        } catch (e) {
            console.error('Error saving progress:', e);
        }
    };

    const handleDigitPress = (digit: string) => {
        if (gameState !== 'playing') return;
        if (currentInput.length < numDigits) {
            setCurrentInput(prev => prev + digit);
        }
    };

    const handleDelete = () => {
        if (gameState !== 'playing') return;
        setCurrentInput(prev => prev.slice(0, -1));
    };

    const handleClear = () => {
        if (gameState !== 'playing') return;
        setCurrentInput('');
    };

    return {
        gameState,
        currentInput,
        guesses,
        keyStates,
        submitGuess,
        handleDigitPress,
        handleDelete,
        handleClear,
        isValidGuess: currentInput.length === numDigits,
        invalidShake, // Return counter
        isRestored: attemptId !== null && gameState !== 'loading' && gameState !== 'playing' // Derived state for restoration
    };
}
