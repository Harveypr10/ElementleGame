import { useState, useEffect, useCallback } from "react";
import { InputGrid, type CellFeedback } from "./InputGrid";
import { NumericKeyboard, type KeyState } from "./NumericKeyboard";
import { EndGameModal } from "./EndGameModal";
import { HelpDialog } from "./HelpDialog";
import { StreakCelebrationPopup } from "./StreakCelebrationPopup";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import { useGameData } from "@/hooks/useGameData";
import { useUserStats } from "@/hooks/useUserStats";
import greyHelpIcon from "@assets/Grey-Help-Grey_1760979822771.png";

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
  const { gameAttempts, getGuessesByAttempt, loadingAttempts } = useGameData();
  const { stats: supabaseStats } = useUserStats();
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

  // Reset state when targetDate changes
  useEffect(() => {
    setCurrentInput("");
    setGuesses([]);
    setKeyStates({});
    setGameOver(false);
    setIsWin(false);
    setWrongGuessCount(0);
    setGuessRecords([]);
  }, [targetDate]);

  // Check if puzzle is already completed and redirect if needed
  useEffect(() => {
    if (!viewOnly) {
      const storedStats = localStorage.getItem("elementle-stats");
      if (storedStats) {
        const stats = JSON.parse(storedStats);
        const completion = stats.puzzleCompletions?.[targetDate];
        
        if (completion && completion.completed) {
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
  }, [targetDate, viewOnly]);

  // Load completed puzzle guesses for view-only mode
  useEffect(() => {
    if (viewOnly) {
      const storedStats = localStorage.getItem("elementle-stats");
      if (storedStats) {
        const stats = JSON.parse(storedStats);
        const completion = stats.puzzleCompletions?.[targetDate];
        
        if (completion) {
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
  }, [viewOnly, targetDate]);

  // Auto-open celebration modal when returning from stats for completed archive puzzles
  useEffect(() => {
    if (showCelebrationFirst && gameOver && hasOpenedCelebration && !showCelebrationModal) {
      setShowCelebrationModal(true);
    }
  }, [showCelebrationFirst, gameOver, hasOpenedCelebration, showCelebrationModal]);

  // Load in-progress guesses when resuming a puzzle
  useEffect(() => {
    if (!viewOnly && !gameOver) {
      const inProgressKey = `puzzle-progress-${targetDate}`;
      const savedProgress = localStorage.getItem(inProgressKey);
      
      if (savedProgress) {
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
  }, [viewOnly, targetDate]);

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

  const handleSubmit = useCallback(() => {
    if (currentInput.length !== 6 || gameOver) return;

    const feedback = calculateFeedback(currentInput);
    const newGuesses = [...guesses, feedback];
    const newGuessRecords = [...guessRecords, { guessValue: currentInput, feedbackResult: feedback }];
    const newWrongGuessCount = currentInput !== targetDate ? wrongGuessCount + 1 : wrongGuessCount;
    
    setGuesses(newGuesses);
    setGuessRecords(newGuessRecords);
    setCurrentInput("");

    if (currentInput === targetDate) {
      // Game won - save to stats and clear progress
      setIsWin(true);
      setGameOver(true);
      updateStats(true, newGuesses.length, newGuessRecords);
      localStorage.removeItem(`puzzle-progress-${targetDate}`);
    } else {
      setWrongGuessCount(newWrongGuessCount);
      if (newGuesses.length >= maxGuesses) {
        // Game lost - save to stats and clear progress
        setIsWin(false);
        setGameOver(true);
        updateStats(false, newGuesses.length, newGuessRecords);
        localStorage.removeItem(`puzzle-progress-${targetDate}`);
      } else {
        // Game in progress - save current state
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
    }
  }, [currentInput, gameOver, guesses, guessRecords, targetDate, maxGuesses, keyStates, wrongGuessCount]);

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

  const saveGameToDatabase = async (won: boolean, numGuesses: number, allGuesses: GuessRecord[]) => {
    // Only save to database for authenticated users
    if (!isAuthenticated || !puzzleId) return;

    try {
      const res = await apiRequest("POST", "/api/game-attempts", {
        puzzleId,
        result: won ? "win" : "loss",
        numGuesses
      });
      
      const gameAttempt = await res.json();

      for (const guess of allGuesses) {
        await apiRequest("POST", "/api/guesses", {
          gameAttemptId: gameAttempt.id,
          guessValue: guess.guessValue,
          feedbackResult: guess.feedbackResult
        });
      }
    } catch (error) {
      console.error("Error saving game to database:", error);
    }
  };

  const updateStats = async (won: boolean, numGuesses: number, allGuessRecords: GuessRecord[]) => {
    // Get current stats from appropriate source
    let currentStats;
    if (isAuthenticated && supabaseStats && supabaseStats.gamesPlayed !== undefined) {
      // Use Supabase stats for authenticated users (only if stats exist)
      const dist = supabaseStats.guessDistribution as any || {};
      currentStats = {
        played: supabaseStats.gamesPlayed ?? 0,
        won: supabaseStats.gamesWon ?? 0,
        currentStreak: supabaseStats.currentStreak ?? 0,
        maxStreak: supabaseStats.maxStreak ?? 0,
        guessDistribution: {
          1: dist["1"] || 0,
          2: dist["2"] || 0,
          3: dist["3"] || 0,
          4: dist["4"] || 0,
          5: dist["5"] || 0,
        },
        puzzleCompletions: {}
      };
    } else {
      // Use localStorage for guest users or as fallback
      const storedStats = localStorage.getItem("elementle-stats");
      currentStats = storedStats ? JSON.parse(storedStats) : {
        played: 0,
        won: 0,
        currentStreak: 0,
        maxStreak: 0,
        guessDistribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
        puzzleCompletions: {}
      };
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
      currentStats.guessDistribution[numGuesses] = (currentStats.guessDistribution[numGuesses] || 0) + 1;
      
      // Show streak celebration
      setCurrentStreak(currentStats.currentStreak);
      setShowStreakCelebration(true);
    } else {
      currentStats.currentStreak = 0;
    }

    // Always save to localStorage for backward compatibility
    localStorage.setItem("elementle-stats", JSON.stringify(currentStats));

    // Save game data and stats to Supabase for authenticated users
    await saveGameToDatabase(won, numGuesses, allGuessRecords);

    // Save stats to Supabase for authenticated users
    if (isAuthenticated) {
      try {
        await apiRequest("POST", "/api/stats", {
          gamesPlayed: currentStats.played,
          gamesWon: currentStats.won,
          currentStreak: currentStats.currentStreak,
          maxStreak: currentStats.maxStreak,
          guessDistribution: currentStats.guessDistribution,
        });
        
        // Invalidate caches to refetch fresh data
        const { queryClient } = await import("@/lib/queryClient");
        await queryClient.invalidateQueries({ queryKey: ['/api/stats'] });
        await queryClient.invalidateQueries({ queryKey: ['/api/game-attempts/user'] });
      } catch (error) {
        console.error("Error saving stats to Supabase:", error);
      }
    }
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
          <ArrowLeft className="h-9 w-9" />
        </button>

        <h2 className="text-4xl font-bold">
          {viewOnly ? "View Puzzle" : "Elementle"}
        </h2>

        <button
          onClick={() => setShowHelp(true)}
          data-testid="button-help"
          className="w-14 h-14 flex items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
        >
          <img src={greyHelpIcon} alt="Help" className="h-6 w-6" />
        </button>
      </div>

      <div className="flex-1 flex flex-col justify-between">
        <div className="flex-1 flex flex-col items-center justify-center">
          <div className="w-full max-w-md space-y-4">
            <div className="text-center">
              <h3 className="text-xl font-semibold text-foreground" data-testid="text-event-title">
                {eventTitle}
              </h3>
            </div>

            <InputGrid
              guesses={guesses}
              currentInput={currentInput}
              maxGuesses={maxGuesses}
            />
          </div>
        </div>

        {showCelebrationFirst && gameOver && !hasOpenedCelebration && (
          <div className="w-full max-w-md mx-auto pb-4">
            <Button
              className="w-full h-14 text-lg"
              onClick={() => {
                onSetHasOpenedCelebration?.(true);
                setShowCelebrationModal(true);
              }}
              data-testid="button-continue"
            >
              Continue
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
        isOpen={showCelebrationFirst ? showCelebrationModal : gameOver}
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
