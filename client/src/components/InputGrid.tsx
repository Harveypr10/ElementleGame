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
  placeholders?: string[]; // Dynamic placeholders based on date format
}

export function InputGrid({ guesses, currentInput, maxGuesses, placeholders = ["D", "D", "M", "M", "Y", "Y"] }: InputGridProps) {
  const numCells = placeholders.length; // Support 6 or 8 cells
  const is8Digit = numCells === 8; // Check if in 8-digit mode
  
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
      for (let j = 0; j < numCells; j++) {
        cells.push({
          digit: currentInput[j] || "",
          state: "empty",
        });
      }
      return cells;
    } else {
      return Array(numCells).fill({ digit: "", state: "empty" });
    }
  });

  return (
    <div className="space-y-2 w-full px-2" data-testid="input-grid">
      {rows.map((row, rowIdx) => (
        <div key={rowIdx} className="flex gap-1 sm:gap-2 justify-center max-w-full">
          {row.map((cell, cellIdx) => {
            const isActiveRow = rowIdx === guesses.length;
            const showPlaceholder = isActiveRow && !cell.digit;

            return (
              <div
                key={`${rowIdx}-${cellIdx}`}
                className="relative flex-1 aspect-square min-h-12 sm:min-h-14 max-w-[12vw] sm:max-w-16"
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
                        text-xl xs:text-2xl sm:text-3xl md:text-4xl font-semibold
                        ${getCellClasses(cell.state)}
                        ${cell.arrow ? 'pt-2 xs:pt-2.5 sm:pt-1' : ''}
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
                            <ArrowUp className="h-3 w-3 xs:h-3.5 xs:w-3.5 sm:h-4 sm:w-4 md:h-5 md:w-5" />
                          ) : (
                            <ArrowDown className="h-3 w-3 xs:h-3.5 xs:w-3.5 sm:h-4 sm:w-4 md:h-5 md:w-5" />
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
                        text-xl xs:text-2xl sm:text-3xl md:text-4xl font-semibold
                        ${getCellClasses(cell.state)}
                      `}
                    >
                      {/* Show entered digit if present */}
                      {cell.digit}

                      {/* Placeholder if active row and empty */}
                      <AnimatePresence>
                        {showPlaceholder && (
                          <motion.span
                            key={`ph-${rowIdx}-${cellIdx}`}
                            className="absolute text-muted-foreground opacity-30 text-sm xs:text-base sm:text-lg font-normal pointer-events-none select-none"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 0.3, transition: { duration: 0.2 } }}   // fade in
                            exit={{ opacity: 0, transition: { duration: 0 } }}          // instant out
                          >
                            {placeholders[cellIdx]}
                          </motion.span>
                        )}
                      </AnimatePresence>
                    </div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
