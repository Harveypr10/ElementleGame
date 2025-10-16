import { ArrowUp, ArrowDown } from "lucide-react";

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
      for (let j = 0; j < 8; j++) {
        cells.push({
          digit: currentInput[j] || "",
          state: "empty",
        });
      }
      return cells;
    } else {
      return Array(8).fill({ digit: "", state: "empty" });
    }
  });

  return (
    <div className="space-y-2" data-testid="input-grid">
      {rows.map((row, rowIdx) => (
        <div key={rowIdx} className="flex gap-1 justify-center">
          {row.map((cell, cellIdx) => (
            <div
              key={`${rowIdx}-${cellIdx}`}
              className={`
                relative w-10 h-10 sm:w-12 sm:h-12 md:w-14 md:h-14
                flex items-center justify-center
                border-2 rounded-md
                text-xl sm:text-2xl font-semibold
                transition-colors
                ${getCellClasses(cell.state)}
              `}
              data-testid={`cell-${rowIdx}-${cellIdx}`}
            >
              {cell.digit}
              {cell.arrow && (
                <div className="absolute top-0.5 right-0.5">
                  {cell.arrow === "up" ? (
                    <ArrowUp className="h-3 w-3 sm:h-4 sm:w-4" />
                  ) : (
                    <ArrowDown className="h-3 w-3 sm:h-4 sm:w-4" />
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
