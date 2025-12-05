import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ProSubscriptionDialog } from "./ProSubscriptionDialog";
import { useStreakSaverStatus } from "@/hooks/useStreakSaverStatus";
import { useStreakSaver } from "@/contexts/StreakSaverContext";
import { useToast } from "@/hooks/use-toast";
import { Flame, Umbrella, X } from "lucide-react";
import hamsterStreakSaver from "@assets/Historian-Hamster-Blue.svg";

import Streak_Hamster_Black from "@assets/Streak-Hamster-Black.svg";

interface StreakSaverPopupProps {
  open: boolean;
  onClose: () => void;
  gameType: "region" | "user";
  currentStreak: number;
  onPlayYesterdaysPuzzle?: (gameType: "region" | "user", puzzleDate: string) => void;
  onStreakLost?: () => void; // Called when user confirms losing their streak
}

export function StreakSaverPopup({ 
  open, 
  onClose, 
  gameType, 
  currentStreak, 
  onPlayYesterdaysPuzzle,
  onStreakLost 
}: StreakSaverPopupProps) {
  const { toast } = useToast();
  const [showProDialog, setShowProDialog] = useState(false);
  const [showStreakSaverAfterPro, setShowStreakSaverAfterPro] = useState(false);
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
    refetch,
  } = useStreakSaverStatus();
  
  const { startStreakSaverSession } = useStreakSaver();

  const streakSaversRemaining = gameType === "region" ? regionStreakSaversRemaining : userStreakSaversRemaining;
  const hasStreakSaversLeft = streakSaversRemaining > 0;
  const canStartHoliday = isPro && holidaysRemaining > 0 && holidayDurationDays > 0;
  
  const gameModeLabel = gameType === "region" ? "Global" : "Personal";
  
  // When returning from successful Pro subscription, refetch status and ensure popup is shown
  useEffect(() => {
    if (showStreakSaverAfterPro) {
      refetch();
      setShowStreakSaverAfterPro(false);
    }
  }, [showStreakSaverAfterPro, refetch]);
  
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
      if (onStreakLost) {
        onStreakLost();
      }
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

  const handleProDialogClose = () => {
    // This is called when user clicks back arrow and confirms exit warning
    // Do nothing here - the streak loss is handled by onStreakLost callback
    setShowProDialog(false);
  };

  const handleProDialogSuccess = async () => {
    // User successfully subscribed to Pro
    // Refetch streak saver status to get updated allowances
    await refetch();
    setShowProDialog(false);
    // Flag that we should show the streak saver popup with updated data
    setShowStreakSaverAfterPro(true);
    
    toast({
      title: "Welcome to Pro!",
      description: "You now have more streak savers available.",
    });
  };

  const handleStreakLost = async () => {
    // User chose to exit Pro dialog and lose their streak
    try {
      await declineStreakSaver(gameType);
      toast({
        title: "Streak Reset",
        description: "Your streak has been reset to 0. Start fresh today!",
      });
      setShowProDialog(false);
      onClose();
      if (onStreakLost) {
        onStreakLost();
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error?.message || "Failed to reset streak",
        variant: "destructive",
      });
    }
  };

  const handleStayOnProDialog = () => {
    // User chose to stay on Pro dialog after exit warning
    // Do nothing - they remain on the Pro dialog
  };

  // Keep the StreakSaverPopup dialog open but hidden when ProDialog is shown
  // This ensures when Pro dialog closes successfully, we can show the popup again
  const showMainPopup = open && !showProDialog;

  // Prevent the dialog from closing via backdrop when going to Pro signup
  const handleDialogOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      // Only allow closing through our explicit handlers
      onClose();
    }
  };

  // Set background color based on game type (matching Archive button colors)
  const popupBackgroundColor = gameType === "region" ? "#FFD429" : "#fdab58";

  return (
    <>
      <Dialog open={showMainPopup} onOpenChange={handleDialogOpenChange}>
        <DialogContent 
          className="max-w-sm" 
          data-testid="streak-saver-popup"
          style={{ backgroundColor: popupBackgroundColor }}
        >
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl text-gray-800">
              <Flame className="h-6 w-6 text-orange-500" />
              Save Your Streak?
            </DialogTitle>
            <DialogDescription className="text-center text-gray-700">
              You missed yesterday's {gameModeLabel} puzzle!
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col items-center gap-4 py-4">
            <img 
              src={Streak_Hamster_Black} 
              alt="Hamster" 
              className="w-24 h-24"
            />
            
            <div className="text-center">
              <p className="text-2xl font-bold text-gray-800">{currentStreak} Day Streak</p>
              <p className="text-sm text-gray-700 mt-1">
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
                  className="w-full bg-[#7DAAE8] text-white text-[16px] border-blue-400 hover:bg-blue-400"
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
        onClose={handleProDialogClose}
        onSuccess={handleProDialogSuccess}
        fromStreakSaver={true}
        currentStreak={currentStreak}
        gameType={gameType}
        onStreakLost={handleStreakLost}
        onStayOnPage={handleStayOnProDialog}
      />
    </>
  );
}
