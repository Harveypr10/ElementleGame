
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
import { useInterstitialAd } from './useInterstitialAd';
import { useStreakSaver } from '../contexts/StreakSaverContext';
import { useStreakSaverStatus } from './useStreakSaverStatus';

import { useQueryClient } from '@tanstack/react-query'; // Import QueryClient
import { SYNC_STORAGE_PREFIX } from '../lib/sync';
import { useNetwork } from '../contexts/NetworkContext';

export type GameState = 'loading' | 'playing' | 'won' | 'lost';
export type GameMode = 'REGION' | 'USER';

export interface UseGameEngineProps {
    puzzleId: number;
    answerDateCanonical: string; // YYYY-MM-DD
    puzzleDate?: string; // Calendar Date of the puzzle (YYYY-MM-DD)
    maxGuesses?: number;
    mode?: GameMode;
    preserveStreakStatus?: boolean;
}

export function useGameEngine({
    puzzleId,
    answerDateCanonical,
    puzzleDate,
    maxGuesses = 5,
    mode = 'REGION',
    preserveStreakStatus = false
}: UseGameEngineProps) {
    const { user, session, isGuest } = useAuth();
    const [gameState, setGameState] = useState<GameState>('loading');
    const [currentInput, setCurrentInput] = useState('');
    const [guesses, setGuesses] = useState<CellFeedback[][]>([]);
    // Track streak day status from the fetched attempt
    const [streakDayStatus, setStreakDayStatus] = useState<number | null>(null);
    const [keyStates, setKeyStates] = useState<Record<string, KeyState>>({});
    const [attemptId, setAttemptId] = useState<number | null>(null);
    const [wrongGuessCount, setWrongGuessCount] = useState(0);
    const [invalidShake, setInvalidShake] = useState(0); // Counter to trigger shake
    const [isRestored, setIsRestored] = useState(false);
    const [wasInitiallyComplete, setWasInitiallyComplete] = useState(false); // True only when game was loaded in completed state
    const { showAd: showInterstitialAd } = useInterstitialAd();
    const { streakSaverSession } = useStreakSaver();
    const { holidayActive } = useStreakSaverStatus();
    const [finalStreak, setFinalStreak] = useState<number | null>(null);
    const queryClient = useQueryClient(); // Initialize QueryClient



    const { dateFormatOrder, dateLength } = useOptions();
    // State to hold and lock the digit count for this specific game
    // Initialize with current preference, but override when loading existing game
    const [gameDigits, setGameDigits] = useState<number>(dateLength);
    const numDigits = gameDigits;

    // Construct full format: dateFormatOrder is 'ddmmyy' or 'mmddyy', need to append 'yy' or 'yyyy'
    const baseFormat = dateFormatOrder.startsWith('dd') ? 'ddmm' : 'mmdd';
    // Use the LOCKED gameDigits for formatting
    const yearFormat = gameDigits === 8 ? 'yyyy' : 'yy';
    const dateFormat = `${baseFormat}${yearFormat}` as import('../lib/dateFormat').DateFormatPreference;

    // Dynamic Table Names
    const ATTEMPTS_TABLE = mode === 'REGION' ? 'game_attempts_region' : 'game_attempts_user';
    const GUESSES_TABLE = mode === 'REGION' ? 'guesses_region' : 'guesses_user';
    // For Region, the puzzle link is 'allocated_region_id'. For User, it is 'allocated_user_id'.
    const PUZZLE_ID_FIELD = mode === 'REGION' ? 'allocated_region_id' : 'allocated_user_id';
    const STATS_TABLE = mode === 'REGION' ? 'user_stats_region' : 'user_stats_user';
    // Remove REGION_FIELD definition if unused or redefine later

    // Helper to get region
    const getUserRegion = async () => {
        if (mode !== 'REGION' || !user?.id) return null;
        const { data: profile } = await supabase.from('user_profiles').select('region').eq('id', user.id).single();
        return profile?.region || 'UK';
    };

    // Helper function to update user stats after game completion
    // This mimics the backend recalculateUserStatsRegion/User functions
    // Returns the current streak value for badge checks
    const updateUserStats = async (isWin: boolean, numGuesses: number, anchorDate: string): Promise<number> => {
        if (!user?.id) return 0;

        try {
            console.log(`[GameEngine] Recalculating stats for ${STATS_TABLE}... (Anchor: ${anchorDate})`);

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

            // Fetch ALL attempts that have either a result OR a streak status (to catch holidays)
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
                .eq('user_id', user.id);
            // REMOVED .not('result', 'is', null) to ensure we get Holiday rows (status=0, result=null)

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
            // Filter to ensure we only have relevant rows (either has result OR has streak status)
            const filteredAttempts = (mode === 'REGION'
                ? allAttempts.filter((a: any) => a.questions_allocated_region?.region === userRegion)
                : allAttempts).filter((a: any) => a.result !== null || (a.streak_day_status !== null && a.streak_day_status !== undefined));

            console.log(`[GameEngine] Recalculating from ${filteredAttempts.length} attempts`);

            // DEBUG: Log attempt details to confirm we have the holidays
            console.log('[GameEngine] Attempt Details:', filteredAttempts.map((a: any) => ({
                id: a.id,
                result: a.result,
                date: mode === 'REGION' ? a.questions_allocated_region?.puzzle_date : a.questions_allocated_user?.puzzle_date,
                status: a.streak_day_status
            })));

            // Calculate stats from attempts that have a RESULT (actual played games)
            const playedGames = filteredAttempts.filter((a: any) => a.result !== null);
            const gamesPlayed = playedGames.length;
            const gamesWon = playedGames.filter((a: any) => a.result === 'won').length;

            // Calculate guess distribution (only from won games)
            const guessDistribution: Record<string, number> = { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 };
            playedGames.forEach((attempt: any) => {
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

                    // We prioritize the existing status
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

            // Calculate current streak (using explicit Anchor Date)
            // Ensures we start counting from the game just played!
            // [FIX] Anchor should be the LATEST valid date found in attempts (e.g. Today) 
            // even if we just played an Archive game. 
            // Otherwise, we calculate streak ending at Archive Date, ignoring subsequeny days.

            let maxDateStr = anchorDate;
            filteredAttempts.forEach((a: any) => {
                const d = mode === 'REGION' ? a.questions_allocated_region?.puzzle_date : a.questions_allocated_user?.puzzle_date;
                if (d && d > maxDateStr) {
                    maxDateStr = d;
                }
            });

            console.log(`[GameEngine] Streak Anchor Calculation: Provided=${anchorDate}, MaxFound=${maxDateStr}`);

            let checkDate = new Date(maxDateStr);
            let currentStreak = 0;

            console.log(`[GameEngine] Starting streak check from Anchor: ${maxDateStr}`);

            while (true) {
                const dateStr = checkDate.toISOString().split('T')[0];
                const dayData = dateMap.get(dateStr);

                console.log(`[GameEngine] Checking Date: ${dateStr}, Found: ${!!dayData}, Status: ${dayData?.streakDayStatus}`);

                if (!dayData) break; // No row - streak broken

                // CRITICAL: Stop if status is NULL or Undefined (break in chain)
                if (dayData.streakDayStatus === null || dayData.streakDayStatus === undefined) {
                    console.log(`[GameEngine] NULL status at ${dateStr} - Streak Broken`);
                    break;
                }

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
                    const dayDiff = Math.ceil((currentDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24));
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

            // Manual Upsert Logic to avoid unique constraint race conditions
            const matchCriteria = mode === 'REGION' ? { user_id: user.id, region: userRegion } : { user_id: user.id };

            // 1. Try to find existing record
            const { data: existingStats, error: fetchError } = await supabase
                .from(STATS_TABLE)
                .select('id')
                .match(matchCriteria)
                .maybeSingle();

            if (fetchError) {
                console.error('[GameEngine] Error checking existing stats:', fetchError);
                return 0;
            }

            if (existingStats) {
                // 2. Update existing
                const { error: updateError } = await supabase
                    .from(STATS_TABLE)
                    .update(statsData)
                    .eq('id', existingStats.id);

                if (updateError) {
                    console.error('[GameEngine] Failed to update stats:', updateError);
                    return 0;
                }
            } else {
                // 3. Insert new
                // Remove 'id' if present in statsData (it shouldn't be)
                const { error: insertError } = await supabase
                    .from(STATS_TABLE)
                    .insert(statsData);

                if (insertError) {
                    // If insert fails (maybe race condition), try update one last time
                    console.error('[GameEngine] Failed to insert stats:', insertError);
                    // Fallback check
                    if (insertError.code === '23505') { // Duplicate key
                        const { error: retryUpdate } = await supabase
                            .from(STATS_TABLE)
                            .update(statsData)
                            .match(matchCriteria);
                        if (retryUpdate) return 0;
                    } else {
                        return 0;
                    }
                }
            }

            console.log(`[GameEngine] Updated ${STATS_TABLE} for user ${user.id}`, statsData);
            return currentStreak;
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
        if (!puzzleId) return;

        const loadGame = async () => {
            try {
                setGameState('loading');

                // 1. Check for existing attempt
                if (!user) {
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
                    // Hybrid Offline: Try loading from Local Storage FIRST (if exists) or fallback to DB
                    // This ensures if we are offline (or just haven't synced yet), we see the local progress.
                    const storageKey = `${SYNC_STORAGE_PREFIX}${user.id}_${mode}_${puzzleId}`;
                    const savedState = await AsyncStorage.getItem(storageKey);

                    let localGuesses: string[] = [];
                    let localResult = null;
                    let localDigits = 8;

                    if (savedState) {
                        const parsed = JSON.parse(savedState);
                        if (parsed.puzzleId === puzzleId) { // Safety check
                            localGuesses = parsed.guesses || [];
                            localResult = parsed.result;
                            localDigits = parsed.digits || 8;
                            console.log('[useGameEngine] Found pending offline data:', { count: localGuesses.length, result: localResult });
                        }
                    }

                    // Fetch Remote Attempt
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

                    // If Error (offline?) we rely purely on Local Selection
                    // OR if Local has MORE progress than Remote (and remote isn't finished), use Local.

                    // Logic:
                    // 1. If Remote exists & "won"/"lost" -> USE REMOTE (Server Wins Rule 1)
                    // 2. If Remote exists & num_guesses > local -> USE REMOTE (Server Wins Rule 1)
                    // 3. Else -> USE LOCAL if available.

                    let useRemote = false;

                    // If we have a remote attempt without error
                    if (attempts && !attemptError) {
                        if (attempts.result === 'won' || attempts.result === 'lost') {
                            useRemote = true;
                        } else if ((attempts.num_guesses || 0) > localGuesses.length) {
                            useRemote = true;
                        }
                    } else if (attemptError) {
                        // Likely offline
                        console.log('[useGameEngine] Error fetching remote (offline?), falling back to local', attemptError);
                        useRemote = false;
                    }

                    // Final Decision
                    if (useRemote && attempts) {
                        // ... Standard DB Loading (Original Code) ...
                        console.log('[useGameEngine] Using Remote State');

                        setAttemptId(attempts.id);

                        if (attempts.result) {
                            setGameState(attempts.result === 'won' ? 'won' : 'lost');
                            setIsRestored(true);
                            setWasInitiallyComplete(true); // Game was loaded as already completed
                        } else {
                            setGameState('playing');
                        }

                        if (attempts.streak_day_status !== undefined) {
                            setStreakDayStatus(attempts.streak_day_status);
                        }

                        // Load guesses
                        const { data: dbGuesses, error: guessError } = await supabase
                            .from(GUESSES_TABLE)
                            .select('*')
                            .eq('game_attempt_id', attempts.id)
                            .order('id', { ascending: true });

                        if (dbGuesses && dbGuesses.length > 0) {
                            // Copied Logic for rebuilding state
                            // Match original digits...
                            let originalDigits = attempts.digits ? parseInt(attempts.digits) : numDigits;
                            setGameDigits(originalDigits);

                            // ... Reformatting Logic ...
                            const baseFormat = (dateFormatOrder && dateFormatOrder.startsWith('mm')) ? 'mm' : 'dd';
                            const originalFormat = baseFormat === 'mm'
                                ? (originalDigits === 6 ? 'mmddyy' : 'mmddyyyy')
                                : (originalDigits === 6 ? 'ddmmyy' : 'ddmmyyyy');

                            const lockedFormattedAnswer = formatCanonicalDate(answerDateCanonical, originalFormat);

                            const loadedGuesses: CellFeedback[][] = [];
                            let newKeyStates: Record<string, KeyState> = {};

                            dbGuesses.forEach((g) => {
                                const displayGuess = formatCanonicalDate(g.guess_value, originalFormat);
                                const feedback = calculateFeedbackOnly(displayGuess, lockedFormattedAnswer);
                                loadedGuesses.push(feedback);
                                newKeyStates = updateKeyStatesOnly(displayGuess, feedback, newKeyStates);
                            });

                            setGuesses(loadedGuesses);
                            setKeyStates(newKeyStates);
                            setWrongGuessCount(loadedGuesses.filter(g => !isGuessCorrect(g)).length);
                            if (loadedGuesses.length > 0 || attempts.result) setIsRestored(true);
                        }

                    } else if (localGuesses.length > 0) {
                        // LOAD FROM LOCAL STORAGE (Offline/Ahead)
                        console.log('[useGameEngine] Using Local State');

                        if (localResult) {
                            setGameState(localResult === 'won' ? 'won' : 'lost');
                            setIsRestored(true);
                            setWasInitiallyComplete(true); // Game was loaded as already completed
                        } else {
                            setGameState('playing');
                        }

                        // Set Digits from local state
                        setGameDigits(localDigits);

                        const baseFormat = (dateFormatOrder && dateFormatOrder.startsWith('mm')) ? 'mm' : 'dd';
                        const originalFormat = baseFormat === 'mm'
                            ? (localDigits === 6 ? 'mmddyy' : 'mmddyyyy')
                            : (localDigits === 6 ? 'ddmmyy' : 'ddmmyyyy');

                        const lockedFormattedAnswer = formatCanonicalDate(answerDateCanonical, originalFormat);

                        const loadedGuesses: CellFeedback[][] = [];
                        let newKeyStates: Record<string, KeyState> = {};

                        localGuesses.forEach((gStr) => {
                            // gStr is raw canonical or digits?
                            // Guest saving used "parseUserDateWithContext" result which IS canonical (YYYY-MM-DD) OR raw if invalid.
                            // We should assume it's acceptable for formatCanonicalDate or is raw.
                            // Actually, let's treat it same as DB guess_value.

                            const displayGuess = formatCanonicalDate(gStr, originalFormat);
                            const feedback = calculateFeedbackOnly(displayGuess, lockedFormattedAnswer);
                            loadedGuesses.push(feedback);
                            newKeyStates = updateKeyStatesOnly(displayGuess, feedback, newKeyStates);
                        });

                        setGuesses(loadedGuesses);
                        setKeyStates(newKeyStates);
                        setWrongGuessCount(loadedGuesses.filter(g => !isGuessCorrect(g)).length);
                        setIsRestored(true);

                    } else {
                        // Neither Remote nor Local -> New Game
                        setGameState('playing');
                        // If we failed to fetch remote but have no local, we assume new game?
                        // Or we should block?
                        // If OFFLINE and NO local -> Start is Blocked by [id].tsx.
                        // So if we are here, we are allowed to play (Online New, or Offline Existing).
                    }

                    return; // End of User Loading
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
            // Show interstitial ad after delay (SKIP FOR GUESTS - they watched one at start)
            if (user) {
                setTimeout(() => showInterstitialAd(), 2500);
            }
        } else if (newGuesses.length >= maxGuesses) {
            hapticsManager.error(); // Lost game haptic
            soundManager.play('game_lose'); // Lost game sound
            setGameState('lost');
            // Show interstitial ad after delay (SKIP FOR GUESTS)
            if (!isGuest) {
                setTimeout(() => showInterstitialAd(), 2500);
            }
        } else {
            hapticsManager.warning(); // Incorrect guess but game continues
            soundManager.play('guess_entered'); // Guess submitted sound
        }

        // 2. Persist to DB (and Local Storage)
        if (!user) {
            try {
                // Guest logic
                const canonicalGuesses = newGuesses.map(g => {
                    const rawDigits = g.map(c => c.digit).join('');
                    return parseUserDateWithContext(rawDigits, dateFormat, answerDateCanonical) || rawDigits;
                });

                const stateToSave = {
                    puzzleId, // ID for allocation table link
                    puzzleDate: answerDateCanonical, // Canonical date for DB
                    result: isWin ? 'won' : (newGuesses.length >= maxGuesses ? 'lost' : null),
                    guesses: canonicalGuesses,
                    updatedAt: new Date().toISOString(),
                    digits: numDigits // Save digits so migration can use it
                };

                await AsyncStorage.setItem(`guest_game_${mode}_${puzzleId}`, JSON.stringify(stateToSave));
                // Add console log to verify saving
                console.log(`[GameEngine] Saved guest game data for ${mode} ${puzzleId}`, stateToSave);
            } catch (e) {
                console.error("Failed to save guest game", e);
            }
            return;
        }

        // Authenticated User Logic
        try {
            // ALWAYS save to Local Storage (Hybrid Online/Offline)
            const canonicalGuesses = newGuesses.map(g => {
                const rawDigits = g.map(c => c.digit).join('');
                return parseUserDateWithContext(rawDigits, dateFormat, answerDateCanonical) || rawDigits;
            });

            const userStateToSave = {
                userId: user.id,
                mode: mode,
                puzzleId: puzzleId,
                guesses: canonicalGuesses,
                result: isWin ? 'won' : (newGuesses.length >= maxGuesses ? 'lost' : null),
                digits: numDigits,
                updatedAt: new Date().toISOString(),
                streakDayStatus: streakDayStatus
            };
            const storageKey = `${SYNC_STORAGE_PREFIX}${user.id}_${mode}_${puzzleId}`;
            await AsyncStorage.setItem(storageKey, JSON.stringify(userStateToSave));
            console.log(`[GameEngine] Persisted local state to ${storageKey}`);

            // If we don't have an ID, check existence then create
            let currentAttemptId = attemptId;

            if (!currentAttemptId) {
                // 1. CHECK FOR EXISTING ATTEMPT FIRST
                // This prevents "duplicate row" errors by explicitly finding the row if it exists.
                let checkQuery = supabase.from(ATTEMPTS_TABLE).select('id').eq('user_id', user.id);
                if (mode === 'REGION') checkQuery = checkQuery.eq('allocated_region_id', puzzleId);
                else checkQuery = checkQuery.eq('allocated_user_id', puzzleId);

                const { data: existing, error: checkError } = await checkQuery.maybeSingle();

                if (existing) {
                    console.log('[GameEngine] Found existing attempt during init, using ID:', existing.id);
                    currentAttemptId = existing.id;
                    setAttemptId(existing.id);
                } else {
                    // 2. CREATE NEW ATTEMPT (If not found)
                    const insertData: any = {
                        user_id: user.id
                    };

                    if (mode === 'REGION') {
                        insertData.allocated_region_id = puzzleId;
                        insertData.streak_day_status = 1; // Default to played
                    } else {
                        insertData.allocated_user_id = puzzleId;
                        insertData.streak_day_status = 1;
                    }

                    // Add digits from current state so it's locked in DB
                    insertData.digits = numDigits.toString();

                    // HOLIDAY LOGIC ON INSERT
                    const _today = new Date();
                    _today.setHours(0, 0, 0, 0);
                    const _todayStr = _today.toISOString().split('T')[0];
                    const _isTodayPuzzle = (puzzleDate || answerDateCanonical) === _todayStr;

                    if (holidayActive && _isTodayPuzzle) {
                        console.log('[GameEngine] New Game during Holiday: Setting initial status to 0');
                        insertData['streak_day_status'] = 0;
                    } else if (_isTodayPuzzle && preserveStreakStatus) {
                        console.log('[GameEngine] Preserved Status Game: Setting initial status to 0');
                        insertData['streak_day_status'] = 0;
                    }

                    // Try Insert with duplicate handling (Race Condition Safety)
                    const { data: newAttempt, error: createError } = await supabase
                        .from(ATTEMPTS_TABLE)
                        .insert(insertData)
                        .select()
                        .single();

                    if (createError) {
                        // Backup Catch: code 23505 (Unique Violation) just in case of race condition
                        if (createError.code === '23505') {
                            console.log('[GameEngine] Race condition catch (23505), fetching existing ID.');
                            const { data: retryExisting } = await checkQuery.single();
                            if (!retryExisting) throw createError;

                            currentAttemptId = retryExisting.id;
                            setAttemptId(retryExisting.id);
                        } else {
                            throw createError;
                        }
                    } else {
                        currentAttemptId = newAttempt.id;
                        setAttemptId(newAttempt.id);
                    }
                }
            }

            // Save guess (already triggered validation above)
            const { error: guessError } = await supabase
                .from(GUESSES_TABLE)
                .insert({
                    game_attempt_id: currentAttemptId,
                    guess_value: canonicalGuessCheck
                });

            if (guessError) throw guessError;

            // Update attempt if game over
            if (isWin || newGuesses.length >= maxGuesses) {

                // Calculate Streak Day Status
                // Logic: 1 = Contributes to streak (Today OR Valid Streak Saver Game)
                //        0 = Holiday (Protected)
                //        null = Archive game (does not affect streak)
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                const todayStr = today.toISOString().split('T')[0];

                let newStreakDayStatus: number | null = null;
                const isTodayPuzzle = (puzzleDate || answerDateCanonical) === todayStr;

                // HOLIDAY / PRESERVE LOGIC
                // Logic Refined:
                // 1. If Holiday Mode Active OR Preserve Status (e.g. from Archive or explicitly set):
                //    - We MUST PRESERVE the existing status (whether it's 0, null, or 1).
                //    - We should NOT overwrite it with NULL just because it's not today.
                // 2. If Normal Play (Today + No Holiday):
                //    - Win = 1
                //    - Loss = NULL (Break)

                // Check if we are in a "Protected/Preserved" state
                const isProtectedState = preserveStreakStatus || holidayActive;

                if (isProtectedState) {
                    // [FIX] Preserve existing status if we have one.
                    // If this is a Holiday Game (status 0), it stays 0.
                    // If this is an Archive Game (status null), it stays null.
                    // We DO NOT recalculate based on win/loss here.
                    if (streakDayStatus !== null && streakDayStatus !== undefined) {
                        console.log('[GameEngine] Protected Mode: Preserving existing status:', streakDayStatus);
                        newStreakDayStatus = streakDayStatus;
                    } else {
                        // Edge case: New row creation handled above set it to 0 or null.
                        // If we are here, we might be updating a row that started with null?
                        // If it's today and holiday, it should have been 0.
                        // If it's archive, it should be null.
                        // Let's trust the logic that established 'streakDayStatus' state on mount/insert.
                        console.log('[GameEngine] Protected Mode: No existing status to preserve. Defaulting to NULL (Archive behavior).');
                        newStreakDayStatus = null;
                    }
                }
                // NORMAL PLAY (Real Streak Impact)
                else {
                    // [FIX] If this game was already set to holiday (status 0), ALWAYS preserve it.
                    // This covers: replaying an old holiday game when no longer in holiday mode.
                    // The only exception (resetting today's puzzle on exit holiday) is handled
                    // at the Home/Archive screen level, not in the game engine.
                    if (streakDayStatus === 0) {
                        console.log('[GameEngine] Normal Mode but game has holiday status (0) - preserving');
                        newStreakDayStatus = 0;
                    }
                    // Start with strict Today check
                    else if (isWin) {
                        // Check Streak Saver?
                        if (streakSaverSession && streakSaverSession.puzzleDate === (puzzleDate || answerDateCanonical)) {
                            console.log('[GameEngine] Win + Streak Saver Session Match -> Status = 1');
                            newStreakDayStatus = 1;
                        } else if (isTodayPuzzle) {
                            console.log('[GameEngine] Win + Today -> Status = 1');
                            newStreakDayStatus = 1;
                        } else {
                            console.log('[GameEngine] Win + Archive (No Saver) -> Status = NULL (No streak credit)');
                            newStreakDayStatus = null;
                        }
                    } else {
                        // Loss always breaks streak (or has no status)
                        console.log('[GameEngine] Loss -> Status = NULL');
                        newStreakDayStatus = null;
                    }
                }

                const { error: updateError } = await supabase
                    .from(ATTEMPTS_TABLE)
                    .update({
                        result: isWin ? 'won' : 'lost',
                        num_guesses: newGuesses.length,
                        streak_day_status: newStreakDayStatus,
                        completed_at: new Date().toISOString(),
                        digits: numDigits.toString()
                    })
                    .eq('id', currentAttemptId);

                if (updateError) throw updateError;

                // Update local state
                setStreakDayStatus(newStreakDayStatus);

                // Update user stats
                const todayForStats = new Date();
                todayForStats.setHours(0, 0, 0, 0);
                const todayStrForStats = todayForStats.toISOString().split('T')[0];

                let anchorDate = todayStrForStats;
                if (newStreakDayStatus !== null) {
                    anchorDate = puzzleDate || answerDateCanonical;
                }

                const newCurrentStreak = await updateUserStats(isWin, newGuesses.length, anchorDate);
                if (isWin) setFinalStreak(newCurrentStreak);

                // STREAK SAVER LOGIC
                if (isWin && !preserveStreakStatus && streakSaverSession && streakSaverSession.puzzleDate === (puzzleDate || answerDateCanonical)) {
                    try {
                        const targetRegion = await getUserRegion();
                        const matchQuery = mode === 'REGION'
                            ? { user_id: user.id, region: targetRegion }
                            : { user_id: user.id };

                        const missedFlagCol = mode === 'REGION' ? 'missed_yesterday_flag_region' : 'missed_yesterday_flag_user';

                        const { data: currentStats, error: fetchStatsError } = await supabase
                            .from(STATS_TABLE)
                            .select(`id, streak_savers_used_month, ${missedFlagCol}`)
                            .match(matchQuery)
                            .maybeSingle();

                        if (currentStats) {
                            const statsAny = currentStats as any;
                            const usedCount = statsAny.streak_savers_used_month || 0;
                            const { error: statsUpdateError } = await supabase
                                .from(STATS_TABLE)
                                .update({
                                    [missedFlagCol]: false,
                                    streak_savers_used_month: usedCount + 1
                                })
                                .eq('id', statsAny.id);

                            if (statsUpdateError) {
                                console.error('[GameEngine] Failed to update Streak Saver stats:', statsUpdateError);
                            } else {
                                console.log('[GameEngine] Streak Saver stats updated successfully');
                            }
                        }
                    } catch (ssError) {
                        console.error('[GameEngine] Error in Streak Saver update block:', ssError);
                    }
                }

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

                        const streakBadge = await checkAndAwardStreakBadge(user.id, newCurrentStreak, GAME_TYPE, REGION);
                        if (streakBadge && !streakBadge.is_awarded) console.log('Badge:', streakBadge.badge_name);

                        if (newGuesses.length === 1 || newGuesses.length === 2) {
                            const elementleBadge = await checkAndAwardElementleBadge(user.id, newGuesses.length, GAME_TYPE, REGION);
                            if (elementleBadge && !elementleBadge.is_awarded) console.log('Badge:', elementleBadge.badge_name);
                        }

                        const percentileBadge: any = await checkAndAwardPercentileBadge(user.id, GAME_TYPE, REGION);
                        if (percentileBadge && !percentileBadge.is_awarded) console.log('Badge:', percentileBadge.badge_name);

                    } catch (badgeError) {
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
        } finally {
            if (isWin || newGuesses.length >= maxGuesses) {
                console.log('[GameEngine] Game Ended. Invalidating queries to refresh stats...');
                queryClient.invalidateQueries({ queryKey: ['user_stats'] });
                queryClient.invalidateQueries({ queryKey: ['user_stats_region'] });
                queryClient.invalidateQueries({ queryKey: ['user_stats_user'] });
                queryClient.invalidateQueries({ queryKey: ['streak_saver_status'] });
                queryClient.invalidateQueries({ queryKey: ['pending_badges'] });
            }
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
        finalStreak, // Expose authoritative calculated streak
        streakDayStatus, // Expose status for UI
        handleDigitPress,
        handleDelete,
        handleClear,
        isValidGuess: currentInput.length === numDigits,
        invalidShake, // Return counter
        isRestored: attemptId !== null && gameState !== 'loading' && gameState !== 'playing', // Derived state for restoration
        wasInitiallyComplete, // True only if game was loaded as completed (for ad timing)
        numDigits // Expose authoritative digit count
    };
}
