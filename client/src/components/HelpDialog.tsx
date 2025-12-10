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
      <DialogContent className="sm:max-w-lg top-4 translate-y-0 max-h-[calc(100vh-2rem)] overflow-y-auto pb-24" data-testid="help-dialog">
        <DialogHeader>
          <DialogTitle className="text-4xl">How to Play</DialogTitle>
        </DialogHeader>

        <div className="space-y-6 text-sm">
          <div>
            <div className="mb-4">
              <p className="font-bold">Guess the historical date</p>
              <p className="text-muted-foreground">Format: DDMMYY - 6 digit mode</p>
              <p className="text-muted-foreground">Format: DDMMYYYY - 8 digit mode</p>
              <p className="mb-4">You have 5 attempts to find the correct date.</p>
            </div>
            <p className="mb-4 text-muted-foreground">
              <span className="font-semibold text-foreground">Note:</span> The Enter button will only activate once you've entered a complete and valid date. If the date you type doesn't exist (like 31/02/2020), you won't be able to submit it.
            </p>
            <p className="font-semibold mb-2">After each guess, the boxes will change color:</p>
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-game-correct text-white flex items-center justify-center rounded-md border-2 border-game-correct font-semibold text-xl">
                2
              </div>
              <div className="flex-1">
                <p className="font-bold">Green</p>
                <p className="text-muted-foreground">Digit correct and in right position</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="relative w-12 h-12 bg-game-inSequence text-white flex items-center justify-center rounded-md border-2 border-game-inSequence font-semibold text-xl">
                5
                <ArrowUp className="absolute top-0.5 right-0.5 h-4 w-4" />
              </div>
              <div className="flex-1">
                <p className="font-bold">Amber with Arrow</p>
                <p className="text-muted-foreground">Digit correct, but in different position. Actual digit is higher ↑ or lower ↓</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="relative w-12 h-12 bg-game-notInSequence text-white flex items-center justify-center rounded-md border-2 border-game-notInSequence font-semibold text-xl">
                8
                <ArrowDown className="absolute top-0.5 right-0.5 h-4 w-4" />
              </div>
              <div className="flex-1">
                <p className="font-bold">Grey with Arrow</p>
                <p className="text-muted-foreground">Digit doesn't appear in answer. Actual digit is higher ↑ or lower ↓</p>
              </div>
            </div>
          </div>

          <div className="bg-muted p-4 rounded-lg">
            <p className="font-semibold mb-2">Example:</p>
            <p className="text-muted-foreground">
              Moon Landing - 20th July 1969: answer in DDMMYY format is <span className="font-bold">200769</span>
            </p>
            <p className="text-muted-foreground mt-1">
              Guess <span className="font-bold">270769</span> would show the second digit "7" in amber (in the date but wrong position), all others in green
            </p>
          </div>

          <div>
            <p className="font-semibold mb-2">Tips:</p>
            <ul className="list-disc list-inside space-y-1 text-muted-foreground">
              <li>Arrows narrow down the possible digits</li>
              <li>Amber digits are in at least one other place in the answer</li>
              <li>Green digits are correct, but could still pop up somewhere else too!</li>
              <li>Each puzzle reveals a fascinating historical event</li>
            </ul>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
