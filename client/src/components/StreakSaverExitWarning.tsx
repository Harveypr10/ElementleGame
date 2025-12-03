import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { AlertTriangle } from "lucide-react";

interface StreakSaverExitWarningProps {
  open: boolean;
  onClose: () => void;
  onCancelAndLoseStreak: () => void;
  onContinuePlaying: () => void;
}

export function StreakSaverExitWarning({
  open,
  onClose,
  onCancelAndLoseStreak,
  onContinuePlaying,
}: StreakSaverExitWarningProps) {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-sm" data-testid="streak-saver-exit-warning">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <AlertTriangle className="h-6 w-6 text-orange-500" />
            Are you sure?
          </DialogTitle>
          <DialogDescription className="text-center pt-2">
            If you don't complete and win yesterday's game you will lose your streak.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3 pt-4">
          <Button
            onClick={onContinuePlaying}
            className="w-full bg-orange-500 hover:bg-orange-600"
            data-testid="button-continue-playing"
          >
            Continue Playing
          </Button>
          
          <Button
            onClick={onCancelAndLoseStreak}
            variant="ghost"
            className="w-full text-muted-foreground"
            data-testid="button-cancel-streak-saver"
          >
            Cancel Streak Saver and Lose Streak
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
