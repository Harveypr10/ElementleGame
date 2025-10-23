import { useState, useEffect, useCallback, useRef } from "react";
import { InputGrid, type CellFeedback } from "./InputGrid";
import { NumericKeyboard, type KeyState } from "./NumericKeyboard";
import { EndGameModal } from "./EndGameModal";
import { HelpDialog } from "./HelpDialog";
import { StreakCelebrationPopup } from "./StreakCelebrationPopup";
import { Button } from "@/components/ui/button";
import { ChevronLeft } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import { useGameData } from "@/hooks/useGameData";
import { useUserStats } from "@/hooks/useUserStats";
import { useUserSettings } from "@/hooks/useUserSettings";
import { useGuessCache } from "@/contexts/GuessCacheContext";
import greyHelpIcon from "@assets/Grey-Help-Grey_1760979822771.png";
import mechanicHamsterGrey from "@assets/Mechanic-Hamster-Grey.svg";
import { writeLocal, CACHE_KEYS } from "@/lib/localCache";

interface PlayPageProps {
  targetDate: string;
  answerDate?: string;
  eventTitle: string;
  eventDescription: string;
  clue1?: string;
  clue2?: string;
  maxGuesses?: number;
  viewOnly?: boolean;
  puzzleId?: number;
  fromArchive?: boolean;
  showCelebrationFirst?: boolean;
  hasOpenedCelebration?: boolean;
  onBack: () => void;
  onHomeFromCelebration?: () => void;
  onSetHasOpenedCelebration?: (value: boolean) => void;
  onViewStats?: () => void;
  onViewArchive?: () => void;
}

interface GuessRecord {
  guessValue: string;
  feedbackResult: CellFeedback[];
}

export function PlayPage({
  targetDate,
  answerDate,
  eventTitle,
  eventDescription,
  clue1,
  clue2,
  maxGuesses = 5,
  viewOnly = false,
  puzzleId,
  fromArchive = false,
  showCelebrationFirst = false,
  hasOpenedCelebration = false,
  onBack,
  onHomeFromCelebration,
  onSetHasOpenedCelebration,
  onViewStats,
  onViewArchive,
}: PlayPageProps) {
  const { user, isAuthenticated } = useAuth();
  const { gameAttempts, getAllGuesses, loadingAttempts } = useGameData();
  const { stats: supabaseStats } = useUserStats();
  const { settings } = useUserSettings();
  const { getGuessesForPuzzle, setGuessesForPuzzle, addGuessToCache } = useGuessCache();
  const [currentInput, setCurrentInput] = useState("");
  const [guesses, setGuesses] = useState<CellFeedback[][]>([]);
  const [keyStates, setKeyStates] = useState<Record<string, KeyState>>({});
  const [gameOver, setGameOver] = useState(false);
  const [isWin, setIsWin] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [cluesEnabled, setCluesEnabled] = useState(true);
  const [wrongGuessCount, setWrongGuessCount] = useState(0);
  const [guessRecords, setGuessRecords] = useState<GuessRecord[]>([]);
  const [showStreakCelebration, setShowStreakCelebration] = useState(false);
  const [currentStreak, setCurrentStreak] = useState(0);
  const [showCelebrationModal, setShowCelebrationModal] = useState(false);
  const [currentGameAttemptId, setCurrentGameAttemptId] = useState<number | null>(null);
  const [showEndModal, setShowEndModal] = useState(false);

  // Load clues setting from Supabase or localStorage
  useEffect(() => {
    if (isAuthenticated && settings) {
      setCluesEnabled(settings.cluesEnabled ?? true);
    } else if (!isAuthenticated) {
      const storedCluesEnabled = localStorage.getItem("cluesEnabled");
      setCluesEnabled(storedCluesEnabled ? storedCluesEnabled === "true" : true);
    }
  }, [isAuthenticated, settings]);

  // Reset state when targetDate changes
  // Note: This runs before loadCompletedPuzzle, so completed puzzles will reload their guesses after reset
  useEffect(() => {
    setCurrentInput("");
    setGuesses([]);
    setKeyStates({});
    setGameOver(false);
    setIsWin(false);
    setWrongGuessCount(0);
    setGuessRecords([]);
    setCurrentGameAttemptId(null);
    setShowEndModal(false);
  }, [targetDate]);

  // Check if puzzle is already completed and redirect if needed
  useEffect(() => {
    let mounted = true;
    
    const loadCompletedPuzzle = async () => {
      if (!viewOnly && !loadingAttempts) {
        if (isAuthenticated && gameAttempts && puzzleId) {
          // For authenticated users, check Supabase data using result !== null as completion check
          const completedAttempt = gameAttempts.find(
            attempt => attempt.puzzleId === puzzleId && attempt.result !== null
          );
          
          if (completedAttempt && mounted) {
            // Puzzle already completed - set to view-only mode
            setGameOver(true);
            setShowEndModal(true); // Show modal immediately for completed puzzles
            // Defensive normalization: handle both "won"/"lost" (current) and "win"/"loss" (legacy)
            const isWinResult = completedAttempt.result === "won" || completedAttempt.result === "win";
            setIsWin(isWinResult);
            
            // Try to load guesses from cache first for faster loading
            const cachedGuesses = puzzleId ? getGuessesForPuzzle(puzzleId) : null;
            let attemptGuesses = cachedGuesses;
            
            if (!cachedGuesses) {
              // Cache miss - load from Supabase
              const allGuesses = await getAllGuesses();
              attemptGuesses = allGuesses.filter(g => g.gameAttemptId === completedAttempt.id);
              
              // Add to cache for next time
              if (attemptGuesses && attemptGuesses.length > 0 && puzzleId) {
                setGuessesForPuzzle(puzzleId, attemptGuesses);
              }
            }
            
            if (mounted && attemptGuesses && attemptGuesses.length > 0) {
              const feedbackArrays = attemptGuesses.map(guess => {
                const feedback = guess.feedbackResult as CellFeedback[];
                return feedback;
              });
              setGuesses(feedbackArrays);
              
              // Reconstruct guess records for display
              const records = attemptGuesses.map(guess => ({
                guessValue: guess.guessValue,
                feedbackResult: guess.feedbackResult as CellFeedback[]
              }));
              setGuessRecords(records);
            }
          }
        } else {
          // For guest users, check localStorage
          const storedStats = localStorage.getItem("elementle-stats");
          if (storedStats) {
            const stats = JSON.parse(storedStats);
            const completion = stats.puzzleCompletions?.[targetDate];
            
            if (completion && completion.completed && mounted) {
              // Puzzle already completed - set to view-only mode
              setGameOver(true);
              setIsWin(completion.won);
              if (completion.guesses && Array.isArray(completion.guesses)) {
                const feedbackArrays = completion.guesses.map((gr: GuessRecord) => gr.feedbackResult);
                setGuesses(feedbackArrays);
                setGuessRecords(completion.guesses);
              }
            }
          }
        }
      }
    };
    
    loadCompletedPuzzle();
    
    return () => { mounted = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetDate, viewOnly, isAuthenticated, gameAttempts, loadingAttempts, puzzleId]);

  // Load completed puzzle guesses for view-only mode
  useEffect(() => {
    let mounted = true;
    
    const loadViewOnlyPuzzle = async () => {
      if (viewOnly && !loadingAttempts) {
        if (isAuthenticated && gameAttempts && puzzleId) {
          // For authenticated users, check Supabase data using result !== null as completion check
          const completedAttempt = gameAttempts.find(
            attempt => attempt.puzzleId === puzzleId && attempt.result !== null
          );
          
          if (completedAttempt && mounted) {
            setGameOver(true);
            setShowEndModal(true); // Show modal immediately for view-only mode
            // Defensive normalization: handle both "won"/"lost" (current) and "win"/"loss" (legacy)
            const isWinResult = completedAttempt.result === "won" || completedAttempt.result === "win";
            setIsWin(isWinResult);
            
            // Try to load guesses from cache first for faster loading
            const cachedGuesses = puzzleId ? getGuessesForPuzzle(puzzleId) : null;
            let attemptGuesses = cachedGuesses;
            
            if (!cachedGuesses) {
              // Cache miss - load from Supabase
              const allGuesses = await getAllGuesses();
              attemptGuesses = allGuesses.filter(g => g.gameAttemptId === completedAttempt.id);
              
              // Add to cache for next time
              if (attemptGuesses && attemptGuesses.length > 0 && puzzleId) {
                setGuessesForPuzzle(puzzleId, attemptGuesses);
              }
            }
            
            if (mounted && attemptGuesses && attemptGuesses.length > 0) {
              const feedbackArrays = attemptGuesses.map(guess => {
                const feedback = guess.feedbackResult as CellFeedback[];
                return feedback;
              });
              setGuesses(feedbackArrays);
              
              // Reconstruct guess records for display
              const records = attemptGuesses.map(guess => ({
                guessValue: guess.guessValue,
                feedbackResult: guess.feedbackResult as CellFeedback[]
              }));
              setGuessRecords(records);
            }
          }
        } else {
          // For guest users, check localStorage
          const storedStats = localStorage.getItem("elementle-stats");
          if (storedStats) {
            const stats = JSON.parse(storedStats);
            const completion = stats.puzzleCompletions?.[targetDate];
            
            if (completion && mounted) {
              setGameOver(true);
              setIsWin(completion.won);
              if (completion.guesses && Array.isArray(completion.guesses)) {
                const feedbackArrays = completion.guesses.map((gr: GuessRecord) => gr.feedbackResult);
                setGuesses(feedbackArrays);
                setGuessRecords(completion.guesses);
              }
            }
          }
        }
      }
    };
    
    loadViewOnlyPuzzle();
    
    return () => { mounted = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewOnly, targetDate, isAuthenticated, gameAttempts, loadingAttempts, puzzleId]);

  // Auto-open celebration modal when returning from stats for completed archive puzzles
  useEffect(() => {
    if (showCelebrationFirst && gameOver && hasOpenedCelebration && !showCelebrationModal) {
      setShowCelebrationModal(true);
    }
  }, [showCelebrationFirst, gameOver, hasOpenedCelebration, showCelebrationModal]);

  // Load in-progress guesses when resuming a puzzle
  useEffect(() => {
    let mounted = true;
    
    const loadInProgressGame = async () => {
      console.log('[loadInProgressGame] Starting...', {
        viewOnly,
        gameOver,
        loadingAttempts,
        isAuthenticated,
        puzzleId,
        gameAttemptsLength: gameAttempts?.length
      });
      
      if (!viewOnly && !gameOver && !loadingAttempts) {
        if (isAuthenticated && gameAttempts && puzzleId) {
          console.log('[loadInProgressGame] Looking for in-progress attempt for puzzleId:', puzzleId, 'type:', typeof puzzleId);
          console.log('[loadInProgressGame] gameAttempts:', gameAttempts.map(a => ({ id: a.id, puzzleId: a.puzzleId, result: a.result, numGuesses: a.numGuesses })));
          
          // For authenticated users, load from database
          const inProgressAttempt = gameAttempts.find(
            attempt => attempt.puzzleId === puzzleId && attempt.result === null && (attempt.numGuesses ?? 0) > 0
          );
          
          console.log('[loadInProgressGame] Found in-progress attempt:', inProgressAttempt);
          
          if (inProgressAttempt && mounted) {
            console.log('[loadInProgressGame] Setting currentGameAttemptId to:', inProgressAttempt.id);
            // Set the current attempt ID so future guesses save to the correct attempt
            setCurrentGameAttemptId(inProgressAttempt.id);
            
            // Load guesses from unified dataset
            console.log('[loadInProgressGame] Loading guesses for attemptId:', inProgressAttempt.id);
            const allGuesses = await getAllGuesses();
            const attemptGuesses = allGuesses.filter(g => g.gameAttemptId === inProgressAttempt.id);
            console.log('[loadInProgressGame] Loaded guesses:', attemptGuesses);
            
            if (mounted && attemptGuesses && attemptGuesses.length > 0) {
              console.log('[loadInProgressGame] Recalculating feedback for', attemptGuesses.length, 'guesses');
              // Recalculate feedback for each guess (don't use stored feedbackResult)
              const freshGuessRecords: GuessRecord[] = [];
              const freshFeedbackArrays: CellFeedback[][] = [];
              let newKeyStates = {};
              
              attemptGuesses.forEach(guess => {
                const feedback = calculateFeedbackForGuess(guess.guessValue, newKeyStates);
                freshFeedbackArrays.push(feedback);
                freshGuessRecords.push({
                  guessValue: guess.guessValue,
                  feedbackResult: feedback
                });
                newKeyStates = updateKeyStates(guess.guessValue, feedback, newKeyStates);
              });
              
              console.log('[loadInProgressGame] Setting state with', freshFeedbackArrays.length, 'guesses');
              setGuesses(freshFeedbackArrays);
              setGuessRecords(freshGuessRecords);
              setKeyStates(newKeyStates);
              setWrongGuessCount(attemptGuesses.filter(g => g.guessValue !== targetDate).length);
              console.log('[loadInProgressGame] State updated successfully');
            } else {
              console.log('[loadInProgressGame] No guesses to load or component unmounted');
            }
          }
        } else if (!isAuthenticated) {
          // For guest users, load from localStorage
          const inProgressKey = `puzzle-progress-${targetDate}`;
          const savedProgress = localStorage.getItem(inProgressKey);
          
          if (savedProgress && mounted) {
            const progress = JSON.parse(savedProgress);
            if (progress.guessRecords && Array.isArray(progress.guessRecords)) {
              const feedbackArrays = progress.guessRecords.map((gr: GuessRecord) => gr.feedbackResult);
              setGuesses(feedbackArrays);
              setGuessRecords(progress.guessRecords);
              setWrongGuessCount(progress.wrongGuessCount || 0);
              
              // Restore key states
              if (progress.keyStates) {
                setKeyStates(progress.keyStates);
              }
            }
          }
        }
      }
    };
    
    loadInProgressGame();
    
    return () => { mounted = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewOnly, targetDate, isAuthenticated, gameAttempts, loadingAttempts, puzzleId]);
  
  // Helper function to calculate feedback without updating state
  const calculateFeedbackForGuess = (guess: string, currentKeyStates: Record<string, KeyState>): CellFeedback[] => {
    const feedback: CellFeedback[] = [];
    
    for (let i = 0; i < 6; i++) {
      const guessDigit = guess[i];
      const targetDigit = targetDate[i];
      
      if (guessDigit === targetDigit) {
        feedback.push({ digit: guessDigit, state: "correct" });
      } else if (targetDate.includes(guessDigit)) {
        const arrow = parseInt(guessDigit) < parseInt(targetDigit) ? "up" : "down";
        feedback.push({ digit: guessDigit, state: "inSequence", arrow });
      } else {
        const arrow = parseInt(guessDigit) < parseInt(targetDigit) ? "up" : "down";
        feedback.push({ digit: guessDigit, state: "notInSequence", arrow });
      }
    }
    
    return feedback;
  };
  
  // Helper function to update key states without modifying state
  const updateKeyStates = (guess: string, feedback: CellFeedback[], currentKeyStates: Record<string, KeyState>): Record<string, KeyState> => {
    const newKeyStates = { ...currentKeyStates };
    
    for (let i = 0; i < 6; i++) {
      const guessDigit = guess[i];
      const cellFeedback = feedback[i];
      
      if (cellFeedback.state === "correct") {
        newKeyStates[guessDigit] = "correct";
      } else if (cellFeedback.state === "inSequence") {
        if (newKeyStates[guessDigit] !== "correct") {
          newKeyStates[guessDigit] = "inSequence";
        }
      } else if (cellFeedback.state === "notInSequence") {
        newKeyStates[guessDigit] = "ruledOut";
      }
    }
    
    return newKeyStates;
  };

  const calculateFeedback = (guess: string): CellFeedback[] => {
    const feedback: CellFeedback[] = [];
    const newKeyStates = { ...keyStates };

    for (let i = 0; i < 6; i++) {
      const guessDigit = guess[i];
      const targetDigit = targetDate[i];
      
      if (guessDigit === targetDigit) {
        feedback.push({ digit: guessDigit, state: "correct" });
        newKeyStates[guessDigit] = "correct";
      } else if (targetDate.includes(guessDigit)) {
        const arrow = parseInt(guessDigit) < parseInt(targetDigit) ? "up" : "down";
        feedback.push({ digit: guessDigit, state: "inSequence", arrow });
        if (newKeyStates[guessDigit] !== "correct") {
          newKeyStates[guessDigit] = "inSequence";
        }
      } else {
        const arrow = parseInt(guessDigit) < parseInt(targetDigit) ? "up" : "down";
        feedback.push({ digit: guessDigit, state: "notInSequence", arrow });
        newKeyStates[guessDigit] = "ruledOut";
      }
    }

    setKeyStates(newKeyStates);
    return feedback;
  };

  useEffect(() => {
    const storedClues = localStorage.getItem("cluesEnabled");
    if (storedClues !== null) setCluesEnabled(storedClues === "true");
  }, []);

  const handleSubmit = useCallback(async () => {
    if (currentInput.length !== 6 || gameOver) return;

    const feedback = calculateFeedback(currentInput);
    const newGuesses = [...guesses, feedback];
    const newGuessRecords = [...guessRecords, { guessValue: currentInput, feedbackResult: feedback }];
    const newWrongGuessCount = currentInput !== targetDate ? wrongGuessCount + 1 : wrongGuessCount;
    const currentGuess = { guessValue: currentInput, feedbackResult: feedback };
    
    setGuesses(newGuesses);
    setGuessRecords(newGuessRecords);
    setCurrentInput("");

    // For guest users: update archive progress immediately
    if (!isAuthenticated) {
      const storedStats = localStorage.getItem("elementle-stats");
      const stats = storedStats ? JSON.parse(storedStats) : { puzzleCompletions: {} };

      const completion = stats.puzzleCompletions[targetDate] || {
        completed: false,
        won: false,
        guessCount: 0,
        guesses: []
      };

      completion.guessCount = newGuesses.length;
      completion.guesses = newGuessRecords;
      completion.completed = false; // still in progress
      completion.won = false;

      stats.puzzleCompletions[targetDate] = completion;
      localStorage.setItem("elementle-stats", JSON.stringify(stats));
    }
    
    // For authenticated users: progressive database saving
    let attemptId: number | null = null;
    if (isAuthenticated && puzzleId) {
      // Create or get game attempt on first guess
      attemptId = await createOrGetGameAttempt();
      
      // Save this guess to database
      if (attemptId) {
        await saveGuessToDatabase(attemptId, currentGuess);
      }
    }

    const isWinningGuess = currentInput === targetDate;
    const isLosingGuess = !isWinningGuess && newGuesses.length >= maxGuesses;

    if (isWinningGuess) {
      // Game won
      setIsWin(true);
      setGameOver(true);
      localStorage.removeItem(`puzzle-progress-${targetDate}`);
      
      // Delay showing modal by 4 seconds to show animations
      setTimeout(() => {
        setShowEndModal(true);
      }, 4000);
      
      if (isAuthenticated && attemptId) {
        // Complete game attempt and recalculate stats from database (use attemptId, not state)
        await completeGameAttempt(attemptId, true, newGuesses.length);
      } else if (!isAuthenticated) {
        // Guest user: use localStorage stats
        await updateStats(true, newGuesses.length, newGuessRecords);
      }
      
      // Cache today's outcome (only if not from archive)
      if (!fromArchive) {
        writeLocal(CACHE_KEYS.TODAY_OUTCOME, {
          date: targetDate,
          puzzleId: puzzleId,
          isWin: true,
          guessCount: newGuesses.length,
        });
      }
    } else if (isLosingGuess) {
      // Game lost
      setIsWin(false);
      setGameOver(true);
      localStorage.removeItem(`puzzle-progress-${targetDate}`);
      
      // Delay showing modal by 2 seconds to show final state
      setTimeout(() => {
        setShowEndModal(true);
      }, 2000);
      
      if (isAuthenticated && attemptId) {
        // Complete game attempt and recalculate stats from database (use attemptId, not state)
        await completeGameAttempt(attemptId, false, newGuesses.length);
      } else if (!isAuthenticated) {
        // Guest user: use localStorage stats
        await updateStats(false, newGuesses.length, newGuessRecords);
      }
      
      // Cache today's outcome (only if not from archive)
      if (!fromArchive) {
        writeLocal(CACHE_KEYS.TODAY_OUTCOME, {
          date: targetDate,
          puzzleId: puzzleId,
          isWin: false,
          guessCount: newGuesses.length,
        });
      }
    } else {
      // Game in progress - save current state to localStorage
      setWrongGuessCount(newWrongGuessCount);
      const inProgressKey = `puzzle-progress-${targetDate}`;
      const newKeyStates = { ...keyStates };
      
      // Update key states from the feedback we just calculated
      for (let i = 0; i < 6; i++) {
        const digit = currentInput[i];
        const state = feedback[i].state;
        if (state === "correct") {
          newKeyStates[digit] = "correct";
        } else if (state === "inSequence" && newKeyStates[digit] !== "correct") {
          newKeyStates[digit] = "inSequence";
        } else if (state === "notInSequence") {
          newKeyStates[digit] = "ruledOut";
        }
      }
      
      localStorage.setItem(inProgressKey, JSON.stringify({
        guessRecords: newGuessRecords,
        wrongGuessCount: newWrongGuessCount,
        keyStates: newKeyStates
      }));
    }
  }, [currentInput, gameOver, guesses, guessRecords, targetDate, maxGuesses, keyStates, wrongGuessCount, isAuthenticated, puzzleId, currentGameAttemptId]);

  const handleKeyPress = useCallback((e: KeyboardEvent) => {
    if (gameOver || viewOnly) return;

    if (e.key >= "0" && e.key <= "9") {
      if (currentInput.length < 6) {
        setCurrentInput(currentInput + e.key);
      }
    } else if (e.key === "Backspace" || e.key === "Delete") {
      setCurrentInput(currentInput.slice(0, -1));
    } else if (e.key === "Enter") {
      handleSubmit();
    } else if (e.key === "Escape") {
      setCurrentInput("");
    }
  }, [currentInput, gameOver, handleSubmit]);

  useEffect(() => {
    window.addEventListener("keydown", handleKeyPress);
    return () => window.removeEventListener("keydown", handleKeyPress);
  }, [handleKeyPress]);

  const createOrGetGameAttempt = async (): Promise<number | null> => {
    if (!isAuthenticated || !puzzleId) {
      console.log('[createOrGetGameAttempt] Not authenticated or missing puzzleId', { isAuthenticated, puzzleId });
      return null;
    }

    // If we already have one in state, reuse it
    if (currentGameAttemptId) {
      console.log('[createOrGetGameAttempt] Reusing existing attemptId from state:', currentGameAttemptId);
      return currentGameAttemptId;
    }

    try {
      console.log('[createOrGetGameAttempt] POSTing to find or create attempt for puzzleId:', puzzleId);
      
      // POST to /api/game-attempts - server will find existing open attempt or create new one
      const res = await apiRequest("POST", "/api/game-attempts", {
        puzzleId,
        result: null,
        numGuesses: 0
      });
      
      if (!res.ok) {
        console.error('[createOrGetGameAttempt] Failed to create/get attempt:', res.status, res.statusText);
        return null;
      }
      
      const gameAttempt = await res.json();
      console.log('[createOrGetGameAttempt] Got attemptId:', gameAttempt.id, 'numGuesses:', gameAttempt.numGuesses);
      
      setCurrentGameAttemptId(gameAttempt.id);
      return gameAttempt.id;
    } catch (error) {
      console.error("[createOrGetGameAttempt] Error:", error);
      return null;
    }
  };

  const saveGuessToDatabase = async (gameAttemptId: number, guess: GuessRecord) => {
    if (!isAuthenticated) return;

    try {
      console.log('[saveGuessToDatabase] Saving guess:', {
        gameAttemptId,
        guessValue: guess.guessValue,
        feedbackLength: guess.feedbackResult.length
      });
      
      const res = await apiRequest("POST", "/api/guesses", {
        gameAttemptId,
        guessValue: guess.guessValue,
        feedbackResult: guess.feedbackResult
      });
      
      if (!res.ok) {
        console.error('[saveGuessToDatabase] Failed to save guess:', res.status, res.statusText);
        const errorText = await res.text();
        console.error('[saveGuessToDatabase] Error response:', errorText);
        return;
      }
      
      const savedGuess = await res.json();
      console.log('[saveGuessToDatabase] Guess saved successfully:', savedGuess.id);
    } catch (error) {
      console.error("[saveGuessToDatabase] Error:", error);
    }
  };

  const completeGameAttempt = async (gameAttemptId: number, won: boolean, numGuesses: number) => {
    if (!isAuthenticated) return;

    try {
      console.log('[completeGameAttempt] Completing attempt:', {
        gameAttemptId,
        won,
        numGuesses
      });
      
      // Update the game attempt with result and completion time
      const patchRes = await apiRequest("PATCH", `/api/game-attempts/${gameAttemptId}`, {
        result: won ? "won" : "lost",
        numGuesses
      });
      
      if (!patchRes.ok) {
        console.error('[completeGameAttempt] Failed to PATCH attempt:', patchRes.status);
        return;
      }
      
      const updatedAttempt = await patchRes.json();
      console.log('[completeGameAttempt] Attempt updated:', updatedAttempt);

      // Recalculate stats from database
      console.log('[completeGameAttempt] Recalculating stats...');
      const recalcRes = await apiRequest("POST", "/api/stats/recalculate");
      
      if (!recalcRes.ok) {
        console.error('[completeGameAttempt] Failed to recalculate stats:', recalcRes.status);
      } else {
        const recalcStats = await recalcRes.json();
        console.log('[completeGameAttempt] Stats recalculated:', recalcStats);
      }

      // Invalidate caches to refetch fresh data
      const { queryClient } = await import("@/lib/queryClient");
      await queryClient.invalidateQueries({ queryKey: ['/api/stats'] });
      await queryClient.invalidateQueries({ queryKey: ['/api/game-attempts/user'] });
      
      // Reload stats to show streak celebration if won
      if (won) {
        const statsRes = await apiRequest("GET", "/api/stats");
        const freshStats = await statsRes.json();
        console.log('[completeGameAttempt] Fresh stats loaded:', freshStats);
        if (freshStats.currentStreak) {
          setCurrentStreak(freshStats.currentStreak);
          setShowStreakCelebration(true);
        }
      }
    } catch (error) {
      console.error("[completeGameAttempt] Error:", error);
    }
  };

  const updateStats = async (won: boolean, numGuesses: number, allGuessRecords: GuessRecord[]) => {
    // For authenticated users, stats are now calculated from database
    // This function only handles localStorage for guest users
    if (isAuthenticated) {
      // Authenticated users: database handles everything via recalculate
      return;
    }

    console.log('[updateStats] Updating guest stats:', { won, numGuesses });

    // Guest users: use old localStorage increment logic
    const storedStats = localStorage.getItem("elementle-stats");
    const currentStats = storedStats ? JSON.parse(storedStats) : {
      played: 0,
      won: 0,
      currentStreak: 0,
      maxStreak: 0,
      guessDistribution: { "1": 0, "2": 0, "3": 0, "4": 0, "5": 0 },
      puzzleCompletions: {}
    };

    // Ensure guessDistribution is always initialized with string keys
    if (!currentStats.guessDistribution || typeof currentStats.guessDistribution !== 'object') {
      currentStats.guessDistribution = { "1": 0, "2": 0, "3": 0, "4": 0, "5": 0 };
    }

    if (!currentStats.puzzleCompletions) {
      currentStats.puzzleCompletions = {};
    }

    // Use targetDate as the key (historical event date) to match archive lookup
    currentStats.puzzleCompletions[targetDate] = {
      completed: true,
      won,
      guessCount: numGuesses,
      guesses: allGuessRecords,
      puzzleTargetDate: targetDate,
      date: new Date().toISOString()
    };

    currentStats.played += 1;
    if (won) {
      currentStats.won += 1;
      currentStats.currentStreak += 1;
      currentStats.maxStreak = Math.max(currentStats.maxStreak, currentStats.currentStreak);
      
      // Use string key for guessDistribution (convert numGuesses to string)
      const guessKey = numGuesses.toString();
      if (numGuesses >= 1 && numGuesses <= 5) {
        currentStats.guessDistribution[guessKey] = (currentStats.guessDistribution[guessKey] || 0) + 1;
      }
      
      console.log('[updateStats] Updated distribution:', currentStats.guessDistribution);
      
      // Show streak celebration
      setCurrentStreak(currentStats.currentStreak);
      setShowStreakCelebration(true);
    } else {
      currentStats.currentStreak = 0;
    }

    // Save to localStorage for guest users
    localStorage.setItem("elementle-stats", JSON.stringify(currentStats));
    console.log('[updateStats] Stats saved to localStorage');
  };

  const handlePlayAgain = () => {
    setCurrentInput("");
    setGuesses([]);
    setKeyStates({});
    setGameOver(false);
    setIsWin(false);
    setWrongGuessCount(0);
  };

  return (
    <div className="min-h-screen flex flex-col p-4">
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={onBack}
          data-testid="button-back"
          className="w-14 h-14 flex items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
        >
          <ChevronLeft className="h-10 w-10 text-gray-700" />
        </button>

        <h2 className="text-4xl font-bold">
          {viewOnly ? "View Puzzle" : "Elementle"}
        </h2>

        <button
          onClick={() => setShowHelp(true)}
          data-testid="button-help"
          className="w-14 h-14 flex items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
        >
          <img src={greyHelpIcon} alt="Help" className="h-9 w-9" />
        </button>
      </div>

      <div className="flex-1 flex flex-col justify-between">
        <div className="flex-1 flex flex-col items-center justify-center">
          <div className="w-full max-w-md space-y-2 sm:space-y-4">
            {cluesEnabled && (
              <div className="text-center">
                <h3 className="text-xl font-semibold text-foreground" data-testid="text-event-title">
                  {eventTitle}
                </h3>
              </div>
            )}

            <InputGrid
              guesses={guesses}
              currentInput={currentInput}
              maxGuesses={maxGuesses}
            />
            
            {gameOver && !isWin && (
              <div className="w-full mt-12">
                <p className="text-center text-sm text-muted-foreground mb-3">Correct answer:</p>
                <div className="flex gap-2 justify-center">
                  {targetDate.split('').map((digit, i) => (
                    <div
                      key={i}
                      className="flex-1 aspect-square"
                      data-testid={`answer-container-${i}`}
                    >
                      <div
                        className="w-full h-full flex items-center justify-center bg-game-correct text-white border-2 border-game-correct text-3xl sm:text-4xl font-semibold rounded-md"
                        data-testid={`answer-digit-${i}`}
                      >
                        {digit}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {showCelebrationFirst && gameOver && !hasOpenedCelebration && (
          <div className="w-full max-w-md mx-auto pb-4">
            <Button
              variant="outline"
              className="w-full h-16 sm:h-20 md:h-24 flex items-center justify-center px-6 rounded-3xl shadow-sm bg-brand-grey"
              onClick={() => {
                onSetHasOpenedCelebration?.(true);
                setShowCelebrationModal(true);
              }}
              data-testid="button-continue"
            >
              <span className="text-lg sm:text-xl md:text-2xl font-bold text-gray-800">
                Continue
              </span>
            </Button>
          </div>
        )}

        {!viewOnly && !showCelebrationFirst && (
          <div className="w-full max-w-md mx-auto pb-4">
            <NumericKeyboard
              onDigitPress={(digit) => {
                if (currentInput.length < 6) {
                  setCurrentInput(currentInput + digit);
                }
              }}
              onDelete={() => setCurrentInput(currentInput.slice(0, -1))}
              onClear={() => setCurrentInput("")}
              onEnter={handleSubmit}
              keyStates={keyStates}
              canSubmit={currentInput.length === 6}
            />
          </div>
        )}
      </div>

      <EndGameModal
        isOpen={showCelebrationFirst ? showCelebrationModal : showEndModal}
        isWin={isWin}
        targetDate={targetDate}
        answerDate={answerDate}
        eventTitle={eventTitle}
        eventDescription={eventDescription}
        numGuesses={guesses.length}
        onPlayAgain={handlePlayAgain}
        onHome={onHomeFromCelebration || onBack}
        onViewStats={onViewStats}
        onViewArchive={onViewArchive}
      />

      <HelpDialog isOpen={showHelp} onClose={() => setShowHelp(false)} />

      {showStreakCelebration && (
        <StreakCelebrationPopup
          streak={currentStreak}
          onDismiss={() => setShowStreakCelebration(false)}
        />
      )}
    </div>
  );
}
