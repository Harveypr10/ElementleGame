import { useState, useEffect, useCallback } from "react";
import { InputGrid, type CellFeedback } from "./InputGrid";
import { NumericKeyboard, type KeyState } from "./NumericKeyboard";
import { EndGameModal } from "./EndGameModal";
import { HelpDialog } from "./HelpDialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowLeft, HelpCircle, Lightbulb } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";

interface PlayPageProps {
  targetDate: string;
  eventTitle: string;
  eventDescription: string;
  clue1?: string;
  clue2?: string;
  maxGuesses?: number;
  viewOnly?: boolean;
  puzzleId?: number;
  onBack: () => void;
  onViewStats?: () => void;
  onViewArchive?: () => void;
}

interface GuessRecord {
  guessValue: string;
  feedbackResult: CellFeedback[];
}

export function PlayPage({
  targetDate,
  eventTitle,
  eventDescription,
  clue1,
  clue2,
  maxGuesses = 5,
  viewOnly = false,
  puzzleId,
  onBack,
  onViewStats,
  onViewArchive,
}: PlayPageProps) {
  const { user, isAuthenticated } = useAuth();
  const [currentInput, setCurrentInput] = useState("");
  const [guesses, setGuesses] = useState<CellFeedback[][]>([]);
  const [keyStates, setKeyStates] = useState<Record<string, KeyState>>({});
  const [gameOver, setGameOver] = useState(false);
  const [isWin, setIsWin] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [cluesEnabled, setCluesEnabled] = useState(true);
  const [wrongGuessCount, setWrongGuessCount] = useState(0);
  const [guessRecords, setGuessRecords] = useState<GuessRecord[]>([]);

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
    
    setGuesses(newGuesses);
    setGuessRecords(newGuessRecords);
    setCurrentInput("");

    if (currentInput === targetDate) {
      setIsWin(true);
      setGameOver(true);
      updateStats(true, newGuesses.length, newGuessRecords);
    } else {
      setWrongGuessCount(wrongGuessCount + 1);
      if (newGuesses.length >= maxGuesses) {
        setIsWin(false);
        setGameOver(true);
        updateStats(false, newGuesses.length, newGuessRecords);
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
    const getTodayKey = () => {
      const today = new Date();
      const day = String(today.getDate()).padStart(2, '0');
      const month = String(today.getMonth() + 1).padStart(2, '0');
      const year = String(today.getFullYear()).slice(-2);
      return `${day}${month}${year}`;
    };

    const storedStats = localStorage.getItem("elementle-stats");
    const stats = storedStats ? JSON.parse(storedStats) : {
      played: 0,
      won: 0,
      currentStreak: 0,
      maxStreak: 0,
      guessDistribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
      puzzleCompletions: {}
    };

    if (!stats.puzzleCompletions) {
      stats.puzzleCompletions = {};
    }

    const puzzleKey = getTodayKey();
    stats.puzzleCompletions[puzzleKey] = {
      completed: true,
      won,
      guessCount: numGuesses,
      guesses: allGuessRecords,
      puzzleTargetDate: targetDate,
      date: new Date().toISOString()
    };

    stats.played += 1;
    if (won) {
      stats.won += 1;
      stats.currentStreak += 1;
      stats.maxStreak = Math.max(stats.maxStreak, stats.currentStreak);
      stats.guessDistribution[numGuesses] = (stats.guessDistribution[numGuesses] || 0) + 1;
    } else {
      stats.currentStreak = 0;
    }

    localStorage.setItem("elementle-stats", JSON.stringify(stats));

    await saveGameToDatabase(won, numGuesses, allGuessRecords);
  };

  const handlePlayAgain = () => {
    setCurrentInput("");
    setGuesses([]);
    setKeyStates({});
    setGameOver(false);
    setIsWin(false);
    setWrongGuessCount(0);
  };

  const shouldShowClue1 = cluesEnabled && wrongGuessCount >= 2 && clue1 && !gameOver;
  const shouldShowClue2 = cluesEnabled && wrongGuessCount >= 4 && clue2 && !gameOver;

  return (
    <div className="min-h-screen flex flex-col p-4">
      <div className="flex items-center justify-between mb-8">
        <Button
          variant="ghost"
          size="icon"
          onClick={onBack}
          data-testid="button-back"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>

        <h2 className="text-2xl font-semibold">
          {viewOnly ? "View Puzzle" : "Elementle"}
        </h2>

        <Button
          variant="ghost"
          size="icon"
          onClick={() => setShowHelp(true)}
          data-testid="button-help"
        >
          <HelpCircle className="h-5 w-5" />
        </Button>
      </div>

      <div className="flex-1 flex items-center justify-center">
        <div className="w-full max-w-md space-y-8">
          <InputGrid
            guesses={guesses}
            currentInput={currentInput}
            maxGuesses={maxGuesses}
          />

          {(shouldShowClue1 || shouldShowClue2) && (
            <Card className="p-4 bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
              <div className="flex items-start gap-3">
                <Lightbulb className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5" />
                <div className="space-y-2">
                  {shouldShowClue1 && (
                    <p className="text-sm text-blue-900 dark:text-blue-100" data-testid="text-clue1">
                      <span className="font-semibold">Clue 1:</span> {clue1}
                    </p>
                  )}
                  {shouldShowClue2 && (
                    <p className="text-sm text-blue-900 dark:text-blue-100" data-testid="text-clue2">
                      <span className="font-semibold">Clue 2:</span> {clue2}
                    </p>
                  )}
                </div>
              </div>
            </Card>
          )}

          {!viewOnly && (
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
          )}

          <div className="text-center text-sm text-muted-foreground">
            Guess {guesses.length + 1} of {maxGuesses}
          </div>
        </div>
      </div>

      <EndGameModal
        isOpen={gameOver}
        isWin={isWin}
        targetDate={targetDate}
        eventTitle={eventTitle}
        eventDescription={eventDescription}
        numGuesses={guesses.length}
        onPlayAgain={handlePlayAgain}
        onHome={onBack}
        onViewStats={onViewStats}
        onViewArchive={onViewArchive}
      />

      <HelpDialog isOpen={showHelp} onClose={() => setShowHelp(false)} />
    </div>
  );
}
