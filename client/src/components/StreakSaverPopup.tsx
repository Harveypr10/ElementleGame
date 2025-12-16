import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ProSubscriptionDialog } from "./ProSubscriptionDialog";
import { useStreakSaverStatus } from "@/hooks/useStreakSaverStatus";
import { useStreakSaver } from "@/contexts/StreakSaverContext";
import { useToast } from "@/hooks/use-toast";
import { useProfile } from "@/hooks/useProfile";
import { Flame, Umbrella } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { clearArchiveCache } from "@/lib/localCache";
import { useQueryClient } from "@tanstack/react-query";
import hamsterStreakSaver from "@assets/Historian-Hamster-Blue.svg";

import Streak_Hamster_Black from "@assets/Streak-Hamster-Black.svg";

interface HolidayAnimationData {
  regionHolidayDates: string[];
  userHolidayDates: string[];
  showUserAfterRegion: boolean;
  holidayDurationDays: number;
}

interface StreakSaverPopupProps {
  open: boolean;
  onClose: () => void;
  gameType: "region" | "user";
  currentStreak: number;
  onPlayYesterdaysPuzzle?: (gameType: "region" | "user", puzzleDate: string) => void;
  onStreakLost?: () => void;
  onStartHolidayWithAnimation?: (data: HolidayAnimationData) => void;
  onShowCategorySelection?: () => void;
}

export function StreakSaverPopup({ 
  open, 
  onClose, 
  gameType, 
  currentStreak, 
  onPlayYesterdaysPuzzle,
  onStreakLost,
  onStartHolidayWithAnimation,
  onShowCategorySelection,
}: StreakSaverPopupProps) {
  const { toast } = useToast();
  const { profile } = useProfile();
  const queryClient = useQueryClient();
  const [showProDialog, setShowProDialog] = useState(false);
  const [showStreakSaverAfterPro, setShowStreakSaverAfterPro] = useState(false);
  const {
    isPro,
    regionStreakSaversRemaining,
    userStreakSaversRemaining,
    regionCanUseStreakSaver,
    userCanUseStreakSaver,
    holidaysRemaining,
    holidayDurationDays,
    hasAnyValidStreakForHoliday,
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
  
  // Check if user can use streak saver (missed only yesterday, not multiple days)
  const canUseStreakSaverForMode = gameType === "region" ? regionCanUseStreakSaver : userCanUseStreakSaver;
  // Show streak saver button only if: missed just yesterday AND (has savers left OR can upgrade to Pro)
  const showStreakSaverButton = canUseStreakSaverForMode;
  
  const regionDisplayNames: Record<string, string> = {
    'UK': 'UK Edition',
    'US': 'US Edition',
    'EU': 'EU Edition',
    'AU': 'AU Edition',
    'CA': 'CA Edition',
    'Global': 'Global',
  };
  
  const gameModeLabel = gameType === "region" 
    ? (regionDisplayNames[profile?.region || 'UK'] || `${profile?.region} Edition`)
    : "Personal";
  
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
      
      // Clear archive local cache and invalidate game attempts queries
      clearArchiveCache();
      queryClient.invalidateQueries({ queryKey: ['/api/game-attempts/user'] });
      queryClient.invalidateQueries({ queryKey: ['/api/user/game-attempts/user'] });
      
      // Fetch animation data as best-effort - don't fail the activation if this fails
      let showRegion = false;
      let showUser = false;
      
      try {
        const response = await apiRequest("GET", "/api/holiday/animation-data");
        if (response.ok) {
          const animationData = await response.json();
          
          // Check conditions for each game mode with optional chaining
          showRegion = !!(animationData?.region?.hasStreak && animationData?.region?.todayStreakDayStatusZero);
          showUser = !!(animationData?.user?.hasStreak && animationData?.user?.todayStreakDayStatusZero);
          
          if ((showRegion || showUser) && onStartHolidayWithAnimation) {
            // Close popup and trigger animation overlay
            onClose();
            onStartHolidayWithAnimation({
              regionHolidayDates: showRegion ? (animationData?.region?.holidayDates || []) : [],
              userHolidayDates: showUser ? (animationData?.user?.holidayDates || []) : [],
              showUserAfterRegion: showRegion && showUser,
              holidayDurationDays: holidayDurationDays ?? 14,
            });
            return; // Exit early, animation will show toast on completion
          }
        }
      } catch (animationError) {
        // Log but don't fail - animation is non-critical
        console.warn("Failed to fetch animation data:", animationError);
      }
      
      // No animation needed or animation fetch failed - just show toast
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
    
    toast({
      title: "Welcome to Pro!",
      description: "You now have more streak savers available.",
    });
    
    // After successful Pro subscription, show CategorySelectionScreen
    // Close the streak saver popup first, then open category selection
    onClose();
    if (onShowCategorySelection) {
      onShowCategorySelection();
    }
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
      <Dialog
        open={showMainPopup}
        onOpenChange={handleDialogOpenChange}
      >
        <DialogContent
          className="max-w-sm rounded-2xl"
          data-testid="streak-saver-popup"
          style={{ backgroundColor: popupBackgroundColor }}
          // 👇 prevent closing via Escape or backdrop click
          onEscapeKeyDown={(e) => e.preventDefault()}
          onPointerDownOutside={(e) => e.preventDefault()}
        >
          {/* 👇 no close button will be rendered because we don't include <DialogClose /> */}
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl text-gray-800">
              <Flame className="h-6 w-6 text-orange-500" />
              {showStreakSaverButton ? "Save Your Streak?" : "Protect Your Streak?"}
            </DialogTitle>
            <DialogDescription className="text-center text-gray-700">
              {showStreakSaverButton 
                ? `You missed yesterday's ${gameModeLabel} puzzle!`
                : `You've been away for multiple days. Use holiday mode to protect your streak, or let it reset.`
              }
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col items-center gap-4 py-4">
            <div className="w-36 h-36 bg-black rounded-full flex items-center justify-center">
              <img 
                src={Streak_Hamster_Black} 
                alt="Hamster" 
                className="w-24 h-24"
              />
            </div>
            
            <div className="text-center">
              <p className="text-2xl font-bold text-gray-800">{currentStreak} Day Streak</p>
              <p className="text-sm text-gray-700 mt-1">
                {showStreakSaverButton 
                  ? (hasStreakSaversLeft 
                    ? `You have ${streakSaversRemaining} streak saver${streakSaversRemaining > 1 ? 's' : ''} remaining this month`
                    : "You've used all your streak savers this month")
                  : (isPro 
                    ? `You have ${holidaysRemaining} holiday${holidaysRemaining !== 1 ? 's' : ''} remaining this year`
                    : "Upgrade to Pro to access holiday protection")
                }
              </p>
            </div>

            <div className="w-full space-y-3">
              {/* Only show streak saver button if missed just yesterday (not multiple days) */}
              {showStreakSaverButton && (
                hasStreakSaversLeft ? (
                  <Button
                    onClick={handleUseStreakSaver}
                    className="w-full text-[16px] bg-black hover:bg-gray-800"
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
                )
              )}

              {/* Show holiday button for Pro users - disabled if no allowances or no valid streak */}
              {isPro && (
                <Button
                  onClick={handleStartHoliday}
                  disabled={isStartingHoliday || holidaysRemaining <= 0 || holidayDurationDays <= 0 || !hasAnyValidStreakForHoliday}
                  variant="outline"
                  className="w-full text-[16px]"
                  data-testid="button-start-holiday"
                >
                  {isStartingHoliday 
                    ? "Starting..." 
                    : !hasAnyValidStreakForHoliday
                      ? "No streak to protect"
                      : holidaysRemaining <= 0 
                        ? "No Holidays Remaining" 
                        : `Go on Holiday (up to ${holidayDurationDays} days)`
                  }
                </Button>
              )}

              <Button
                onClick={handleDecline}
                disabled={isDeclining}
                className="w-full text-muted-foreground bg-white text-[16px] hover:bg-gray-100"
                data-testid="button-decline-streak-saver"
              >
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
