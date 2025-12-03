import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ProSubscriptionDialog } from "./ProSubscriptionDialog";
import { useStreakSaverStatus } from "@/hooks/useStreakSaverStatus";
import { useStreakSaver } from "@/contexts/StreakSaverContext";
import { useToast } from "@/hooks/use-toast";
import { Flame, Umbrella, X } from "lucide-react";
import hamsterStreakSaver from "@assets/Historian-Hamster-Blue.svg";

interface StreakSaverPopupProps {
  open: boolean;
  onClose: () => void;
  gameType: "region" | "user";
  currentStreak: number;
  onPlayYesterdaysPuzzle?: (gameType: "region" | "user", puzzleDate: string) => void;
}

export function StreakSaverPopup({ open, onClose, gameType, currentStreak, onPlayYesterdaysPuzzle }: StreakSaverPopupProps) {
  const { toast } = useToast();
  const [showProDialog, setShowProDialog] = useState(false);
  const {
    isPro,
    regionStreakSaversRemaining,
    userStreakSaversRemaining,
    holidaysRemaining,
    holidayDurationDays,
    declineStreakSaver,
    isDeclining,
    startHoliday,
    isStartingHoliday,
  } = useStreakSaverStatus();
  
  const { startStreakSaverSession } = useStreakSaver();

  const streakSaversRemaining = gameType === "region" ? regionStreakSaversRemaining : userStreakSaversRemaining;
  const hasStreakSaversLeft = streakSaversRemaining > 0;
  const canStartHoliday = isPro && holidaysRemaining > 0 && holidayDurationDays > 0;
  
  const gameModeLabel = gameType === "region" ? "Global" : "Personal";
  
  // Calculate yesterday's date
  const getYesterdayDate = () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    return yesterday.toISOString().split('T')[0];
  };

  const handleUseStreakSaver = () => {
    if (!hasStreakSaversLeft) {
      setShowProDialog(true);
      return;
    }
    
    const yesterdayDate = getYesterdayDate();
    
    // Start the streak saver session (don't increment usage yet - that happens on completion)
    startStreakSaverSession(gameType, yesterdayDate, currentStreak);
    
    // Navigate to yesterday's puzzle if callback provided
    if (onPlayYesterdaysPuzzle) {
      onPlayYesterdaysPuzzle(gameType, yesterdayDate);
    }
    
    onClose();
  };

  const handleDecline = async () => {
    try {
      await declineStreakSaver(gameType);
      toast({
        title: "Streak Reset",
        description: "Your streak has been reset to 0. Start fresh today!",
      });
      onClose();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error?.message || "Failed to reset streak",
        variant: "destructive",
      });
    }
  };

  const handleStartHoliday = async () => {
    try {
      await startHoliday();
      toast({
        title: "Holiday Started!",
        description: `You're on holiday for ${holidayDurationDays} days. Your streak is protected.`,
      });
      onClose();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error?.message || "Failed to start holiday",
        variant: "destructive",
      });
    }
  };

  const handleNoStreakSavers = () => {
    setShowProDialog(true);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={() => onClose()}>
        <DialogContent className="max-w-sm" data-testid="streak-saver-popup">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl">
              <Flame className="h-6 w-6 text-orange-500" />
              Save Your Streak?
            </DialogTitle>
            <DialogDescription className="text-center">
              You missed yesterday's {gameModeLabel} puzzle!
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col items-center gap-4 py-4">
            <img 
              src={hamsterStreakSaver} 
              alt="Hamster" 
              className="w-24 h-24"
            />
            
            <div className="text-center">
              <p className="text-2xl font-bold text-orange-500">{currentStreak} Day Streak</p>
              <p className="text-sm text-muted-foreground mt-1">
                {hasStreakSaversLeft 
                  ? `You have ${streakSaversRemaining} streak saver${streakSaversRemaining > 1 ? 's' : ''} remaining this month`
                  : "You've used all your streak savers this month"
                }
              </p>
            </div>

            <div className="w-full space-y-3">
              {hasStreakSaversLeft ? (
                <Button
                  onClick={handleUseStreakSaver}
                  className="w-full bg-orange-500 hover:bg-orange-600"
                  data-testid="button-use-streak-saver"
                >
                  Use Streak Saver
                </Button>
              ) : (
                <Button
                  onClick={handleNoStreakSavers}
                  className="w-full bg-gradient-to-r from-orange-400 to-amber-500"
                  data-testid="button-get-more-savers"
                >
                  Get More Streak Savers
                </Button>
              )}

              {canStartHoliday && (
                <Button
                  onClick={handleStartHoliday}
                  disabled={isStartingHoliday}
                  variant="outline"
                  className="w-full border-blue-400 text-blue-600 hover:bg-blue-50"
                  data-testid="button-start-holiday"
                >
                  <Umbrella className="h-4 w-4 mr-2" />
                  {isStartingHoliday ? "Starting..." : `Go on Holiday (${holidayDurationDays} days)`}
                </Button>
              )}

              <Button
                onClick={handleDecline}
                disabled={isDeclining}
                variant="ghost"
                className="w-full text-muted-foreground"
                data-testid="button-decline-streak-saver"
              >
                <X className="h-4 w-4 mr-2" />
                {isDeclining ? "Resetting..." : "Let Streak Reset"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <ProSubscriptionDialog
        isOpen={showProDialog}
        onClose={() => setShowProDialog(false)}
        onSuccess={() => setShowProDialog(false)}
      />
    </>
  );
}
