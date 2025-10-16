import { useState, useEffect, useCallback } from "react";
import { InputGrid, type CellFeedback } from "./InputGrid";
import { NumericKeyboard, type KeyState } from "./NumericKeyboard";
import { EndGameModal } from "./EndGameModal";

interface PlayPageProps {
  targetDate: string;
  eventTitle: string;
  eventDescription: string;
  maxGuesses?: number;
}

export function PlayPage({
  targetDate,
  eventTitle,
  eventDescription,
  maxGuesses = 5,
}: PlayPageProps) {
  const [currentInput, setCurrentInput] = useState("");
  const [guesses, setGuesses] = useState<CellFeedback[][]>([]);
  const [keyStates, setKeyStates] = useState<Record<string, KeyState>>({});
  const [gameOver, setGameOver] = useState(false);
  const [isWin, setIsWin] = useState(false);

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

  const handleSubmit = useCallback(() => {
    if (currentInput.length !== 6 || gameOver) return;

    const feedback = calculateFeedback(currentInput);
    const newGuesses = [...guesses, feedback];
    setGuesses(newGuesses);
    setCurrentInput("");

    if (currentInput === targetDate) {
      setIsWin(true);
      setGameOver(true);
    } else if (newGuesses.length >= maxGuesses) {
      setIsWin(false);
      setGameOver(true);
    }
  }, [currentInput, gameOver, guesses, targetDate, maxGuesses, keyStates]);

  const handleKeyPress = useCallback((e: KeyboardEvent) => {
    if (gameOver) return;

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

  const handlePlayAgain = () => {
    setCurrentInput("");
    setGuesses([]);
    setKeyStates({});
    setGameOver(false);
    setIsWin(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-8">
        <h2 className="text-2xl font-semibold text-center">Elementle</h2>

        <InputGrid
          guesses={guesses}
          currentInput={currentInput}
          maxGuesses={maxGuesses}
        />

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

        <div className="text-center text-sm text-muted-foreground">
          Guess {guesses.length + 1} of {maxGuesses}
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
      />
    </div>
  );
}
