import { Button } from "@/components/ui/button";
import { Delete, RotateCcw } from "lucide-react";
import { soundManager } from "@/lib/sounds";

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
        return "bg-gray-500 text-white font-bold";
      default:
        return "";
    }
  };

  const handleClick = (callback: () => void) => {
    soundManager.playClick();
    callback();
  };

  return (
    <div className="space-y-2 w-full" data-testid="numeric-keyboard">
      {/* Row 1 */}
      <div className="flex gap-2 justify-center">
        {["1", "2", "3", "4", "5"].map((digit) => (
          <Button
            key={digit}
            className={`h-14 flex-1 sm:h-16 text-xl font-bold rounded-md active:scale-95 transition-transform ${
              getKeyClasses(digit) || "bg-gray-200 text-gray-800 hover:bg-gray-300"
            }`}
            onClick={() => handleClick(() => onDigitPress(digit))}
            data-testid={`key-${digit}`}
          >
            {digit}
          </Button>
        ))}
      </div>

      {/* Row 2 */}
      <div className="flex gap-2 justify-center">
        {["6", "7", "8", "9", "0"].map((digit) => (
          <Button
            key={digit}
            className={`h-14 flex-1 sm:h-16 text-xl font-bold rounded-md active:scale-95 transition-transform ${
              getKeyClasses(digit) || "bg-gray-200 text-gray-800 hover:bg-gray-300"
            }`}
            onClick={() => handleClick(() => onDigitPress(digit))}
            data-testid={`key-${digit}`}
          >
            {digit}
          </Button>
        ))}
      </div>

      {/* Row 3 */}
      <div className="flex gap-2 justify-center">
        {/* Enter key */}
        <Button
          className={`flex-1 h-14 sm:h-16 text-base sm:text-lg font-bold rounded-md active:scale-95 transition-transform ${
            canSubmit
              ? "bg-brand-blue/90 hover:bg-brand-blue/80 text-white"
              : "bg-brand-blue/60 text-white cursor-not-allowed"
          }`}
          onClick={() => handleClick(onEnter)}
          disabled={!canSubmit}
          data-testid="key-enter"
        >
          Enter
        </Button>

        {/* Clear key */}
        <Button
          className="flex-1 h-14 sm:h-16 bg-gray-200 text-gray-800 font-bold rounded-md hover:bg-gray-300 active:scale-95 transition-transform"
          onClick={() => handleClick(onClear)}
          data-testid="key-clear"
        >
          <RotateCcw className="h-7 w-7" />
        </Button>

        {/* Delete key */}
        <Button
          className="flex-1 h-14 sm:h-16 bg-gray-200 text-gray-800 font-bold rounded-md hover:bg-gray-300 active:scale-95 transition-transform"
          onClick={() => handleClick(onDelete)}
          data-testid="key-delete"
        >
          <Delete className="h-7 w-7" />
        </Button>
      </div>
    </div>

  );
}
