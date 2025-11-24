import { ArrowUp, ArrowDown } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useRef, useEffect } from "react";

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
  placeholders?: string[];
}

export function InputGrid({
  guesses,
  currentInput,
  maxGuesses,
  placeholders = ["D", "D", "M", "M", "Y", "Y"],
}: InputGridProps) {
  const numCells = placeholders.length;
  const is8Digit = numCells === 8;
  const prevInputLengthRef = useRef(currentInput.length);

  // Detect when a digit is added to trigger animation
  const digitJustAdded = currentInput.length > prevInputLengthRef.current;
  
  useEffect(() => {
    prevInputLengthRef.current = currentInput.length;
  }, [currentInput]);

  const getCellClasses = (state: CellState, hasDigit: boolean = false) => {
    switch (state) {
      case "correct":
        return "bg-game-correct text-white border-game-correct";
      case "inSequence":
        return "bg-game-inSequence text-white border-game-inSequence";
      case "notInSequence":
        return "bg-game-notInSequence text-white border-game-notInSequence";
      default:
        // For empty state, apply dark grey border if digit is present
        return hasDigit ? "bg-card border-[#4a4a4a] dark:border-[#6b6b6b]" : "bg-card border-border";
    }
  };

  const rows = Array.from({ length: maxGuesses }, (_, i) => {
    if (i < guesses.length) return guesses[i];
    if (i === guesses.length) {
      return Array.from({ length: numCells }, (_, j) => ({
        digit: currentInput[j] || "",
        state: "empty" as CellState,
      }));
    }
    return Array(numCells).fill({ digit: "", state: "empty" });
  });

  return (
    <div className="space-y-2 w-full px-2" data-testid="input-grid">
      {rows.map((row, rowIdx) => {
        const isActiveRow = rowIdx === guesses.length;
        const rowHasArrow = row.some(
          (c) => c.state !== "empty" && typeof c.arrow !== "undefined"
        );

        // Only lower numbers if in 8-digit mode AND row has an arrow
        const needsLowering = is8Digit && rowHasArrow;

        return (
          <div
            key={rowIdx}
            className="flex gap-1 sm:gap-2 justify-center w-full"
          >
            {row.map((cell, cellIdx) => {
              const showPlaceholder = isActiveRow && !cell.digit;
              const cellHasDigit = isActiveRow && !!cell.digit;
              const cellJustGotDigit = isActiveRow && digitJustAdded && cellIdx === currentInput.length - 1;

              return (
                <div
                  key={`${rowIdx}-${cellIdx}`}
                  className="
                    relative flex-1 basis-0 shrink
                    min-h-[56px] sm:min-h-[64px]
                    max-w-[72px] sm:max-w-[80px] md:max-w-[96px]
                  "
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
                          font-semibold
                          text-3xl sm:text-3xl md:text-4xl lg:text-4xl
                          ${getCellClasses(cell.state)}
                          ${needsLowering ? "pt-2" : ""}
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
                              <ArrowUp
                                className={
                                  is8Digit
                                    ? "h-3 w-3 sm:h-4 sm:w-4 md:h-5 md:w-5" // small on phones, step up on larger
                                    : "h-4 w-4 sm:h-5 sm:w-5 md:h-6 md:w-6"
                                }
                              />
                            ) : (
                              <ArrowDown
                                className={
                                  is8Digit
                                    ? "h-3 w-3 sm:h-4 sm:w-4 md:h-5 md:w-5"
                                    : "h-4 w-4 sm:h-5 sm:w-5 md:h-6 md:w-6"
                                }
                              />
                            )}
                          </div>
                        )}
                      </motion.div>
                    ) : (
                      <motion.div
                        key={`${rowIdx}-${cellIdx}-empty`}
                        className={`
                          absolute inset-0
                          flex items-center justify-center
                          border-2 rounded-md
                          font-semibold
                          text-3xl sm:text-3xl md:text-4xl lg:text-4xl
                          ${getCellClasses(cell.state, cellHasDigit)}
                          ${needsLowering ? "pt-2" : ""}
                          transition-colors duration-200
                        `}
                        animate={
                          cellJustGotDigit
                            ? {
                                scale: [1, 1.08, 1],
                                transition: { duration: 0.2, times: [0, 0.5, 1] }
                              }
                            : {}
                        }
                      >
                        {cell.digit}
                        <AnimatePresence>
                          {showPlaceholder && (
                            <motion.span
                              key={`ph-${rowIdx}-${cellIdx}`}
                              className="absolute text-muted-foreground opacity-30 font-normal pointer-events-none select-none
                                         text-2xl sm:text-2xl md:text-3xl lg:text-3xl"
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 0.3, transition: { duration: 0.2 } }}
                              exit={{ opacity: 0, transition: { duration: 0 } }}
                            >
                              {placeholders[cellIdx]}
                            </motion.span>
                          )}
                        </AnimatePresence>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
