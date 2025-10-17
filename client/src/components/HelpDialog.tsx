import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ArrowUp, ArrowDown } from "lucide-react";

interface HelpDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export function HelpDialog({ isOpen, onClose }: HelpDialogProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg top-4 translate-y-0 max-h-[calc(100vh-2rem)] overflow-y-auto" data-testid="help-dialog">
        <DialogHeader>
          <DialogTitle className="text-2xl">How to Play</DialogTitle>
        </DialogHeader>

        <div className="space-y-6 text-sm">
          <div>
            <p className="mb-4">
              Guess the historical date in DDMMYY format. You have 5 attempts to find the correct date.
            </p>
            <p className="font-semibold mb-2">After each guess, the boxes will change color:</p>
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-game-correct text-white flex items-center justify-center rounded-md border-2 border-game-correct font-semibold text-xl">
                2
              </div>
              <div className="flex-1">
                <p className="font-medium">Green</p>
                <p className="text-muted-foreground">The digit is correct and in the right position</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="relative w-12 h-12 bg-game-inSequence text-white flex items-center justify-center rounded-md border-2 border-game-inSequence font-semibold text-xl">
                5
                <ArrowUp className="absolute top-0.5 right-0.5 h-4 w-4" />
              </div>
              <div className="flex-1">
                <p className="font-medium">Amber with Arrow</p>
                <p className="text-muted-foreground">The digit appears in the date but in a different position. Arrow shows if the actual digit is higher ↑ or lower ↓</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="relative w-12 h-12 bg-game-notInSequence text-white flex items-center justify-center rounded-md border-2 border-game-notInSequence font-semibold text-xl">
                8
                <ArrowDown className="absolute top-0.5 right-0.5 h-4 w-4" />
              </div>
              <div className="flex-1">
                <p className="font-medium">Grey with Arrow</p>
                <p className="text-muted-foreground">The digit doesn't appear in the date. Arrow shows if the actual digit is higher ↑ or lower ↓</p>
              </div>
            </div>
          </div>

          <div className="bg-muted p-4 rounded-lg">
            <p className="font-semibold mb-2">Example:</p>
            <p className="text-muted-foreground">
              If the answer is <span className="font-mono font-bold">200769</span> (July 20, 1969 - Moon Landing)
            </p>
            <p className="text-muted-foreground mt-1">
              Guess <span className="font-mono font-bold">250769</span> would show: first digit amber (2 is in date but wrong position), others green
            </p>
          </div>

          <div>
            <p className="font-semibold mb-2">Tips:</p>
            <ul className="list-disc list-inside space-y-1 text-muted-foreground">
              <li>Use the arrows to narrow down the correct digits</li>
              <li>Pay attention to which digits turn green - they're in the right spot!</li>
              <li>Each puzzle reveals a fascinating historical event</li>
            </ul>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
