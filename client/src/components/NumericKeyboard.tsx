import { Button } from "@/components/ui/button";
import { Delete, RotateCcw } from "lucide-react";

export type KeyState = "default" | "correct" | "inSequence" | "ruledOut";

interface NumericKeyboardProps {
  onDigitPress: (digit: string) => void;
  onDelete: () => void;
  onClear: () => void;
  onEnter: () => void;
  keyStates: Record<string, KeyState>;
  canSubmit: boolean;
}

export function NumericKeyboard({
  onDigitPress,
  onDelete,
  onClear,
  onEnter,
  keyStates,
  canSubmit,
}: NumericKeyboardProps) {
  const getKeyClasses = (digit: string) => {
    const state = keyStates[digit] || "default";
    switch (state) {
      case "correct":
        return "bg-game-correct text-white hover:bg-game-correct";
      case "inSequence":
        return "bg-game-inSequence text-white hover:bg-game-inSequence";
      case "ruledOut":
        return "bg-game-ruledOut text-muted-foreground opacity-50";
      default:
        return "";
    }
  };

  const digits = [
    ["1", "2", "3"],
    ["4", "5", "6"],
    ["7", "8", "9"],
  ];

  return (
    <div className="space-y-2" data-testid="numeric-keyboard">
      {digits.map((row, rowIdx) => (
        <div key={rowIdx} className="flex gap-2 justify-center">
          {row.map((digit) => (
            <Button
              key={digit}
              variant="outline"
              className={`h-14 w-14 sm:h-16 sm:w-16 text-xl font-medium ${getKeyClasses(digit)}`}
              onClick={() => onDigitPress(digit)}
              data-testid={`key-${digit}`}
            >
              {digit}
            </Button>
          ))}
        </div>
      ))}
      
      <div className="flex gap-2 justify-center">
        <Button
          variant="outline"
          className="h-14 w-14 sm:h-16 sm:w-16"
          onClick={onClear}
          data-testid="key-clear"
        >
          <RotateCcw className="h-5 w-5" />
        </Button>
        
        <Button
          key="0"
          variant="outline"
          className={`h-14 w-14 sm:h-16 sm:w-16 text-xl font-medium ${getKeyClasses("0")}`}
          onClick={() => onDigitPress("0")}
          data-testid="key-0"
        >
          0
        </Button>
        
        <Button
          variant="outline"
          className="h-14 w-14 sm:h-16 sm:w-16"
          onClick={onDelete}
          data-testid="key-delete"
        >
          <Delete className="h-5 w-5" />
        </Button>
        
        <Button
          variant="default"
          className="h-14 w-20 sm:h-16 sm:w-24 text-lg font-medium"
          onClick={onEnter}
          disabled={!canSubmit}
          data-testid="key-enter"
        >
          Enter
        </Button>
      </div>
    </div>
  );
}
