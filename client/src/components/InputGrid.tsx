import { ArrowUp, ArrowDown } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export type CellState = "empty" | "correct" | "inSequence" | "notInSequence";

export interface CellFeedback {
  digit: string;
  state: CellState;
  arrow?: "up" | "down";
}

interface InputGridProps {
  guesses: CellFeedback[][];
  currentInput: string;
  maxGuesses: number;
}

export function InputGrid({ guesses, currentInput, maxGuesses }: InputGridProps) {
  const getCellClasses = (state: CellState) => {
    switch (state) {
      case "correct":
        return "bg-game-correct text-white border-game-correct";
      case "inSequence":
        return "bg-game-inSequence text-white border-game-inSequence";
      case "notInSequence":
        return "bg-game-notInSequence text-white border-game-notInSequence";
      default:
        return "bg-card border-border";
    }
  };

  const rows = Array.from({ length: maxGuesses }, (_, i) => {
    if (i < guesses.length) {
      return guesses[i];
    } else if (i === guesses.length) {
      const cells: CellFeedback[] = [];
      for (let j = 0; j < 6; j++) {
        cells.push({
          digit: currentInput[j] || "",
          state: "empty",
        });
      }
      return cells;
    } else {
      return Array(6).fill({ digit: "", state: "empty" });
    }
  });

  return (
    <div className="space-y-2 w-full" data-testid="input-grid">
      {rows.map((row, rowIdx) => (
        <div key={rowIdx} className="flex gap-2 justify-center">
          {row.map((cell, cellIdx) => (
            <div
              key={`${rowIdx}-${cellIdx}`}
              className="relative flex-1 aspect-square max-w-16"
              style={{ perspective: "1000px" }}
              data-testid={`cell-${rowIdx}-${cellIdx}`}
            >
              <AnimatePresence mode="wait">
                {cell.state !== "empty" ? (
                  <motion.div
                    key={`${rowIdx}-${cellIdx}-${cell.state}`}
                    className={`
                      absolute inset-0
                      flex items-center justify-center
                      border-2 rounded-md
                      text-3xl sm:text-4xl font-semibold
                      ${getCellClasses(cell.state)}
                    `}
                    initial={{ rotateX: 90, opacity: 0 }}
                    animate={{ rotateX: 0, opacity: 1 }}
                    exit={{ rotateX: -90, opacity: 0 }}
                    transition={{ duration: 1, delay: cellIdx * 0.25 }}
                  >
                    {cell.digit}
                    {cell.arrow && (
                      <div className="absolute top-0.5 right-0.5">
                        {cell.arrow === "up" ? (
                          <ArrowUp className="h-4 w-4 sm:h-5 sm:w-5" />
                        ) : (
                          <ArrowDown className="h-4 w-4 sm:h-5 sm:w-5" />
                        )}
                      </div>
                    )}
                  </motion.div>
                ) : (
                  <div
                    key={`${rowIdx}-${cellIdx}-empty`}
                    className={`
                      absolute inset-0
                      flex items-center justify-center
                      border-2 rounded-md
                      text-3xl sm:text-4xl font-semibold
                      ${getCellClasses(cell.state)}
                    `}
                  >
                    {cell.digit}
                  </div>
                )}
              </AnimatePresence>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
