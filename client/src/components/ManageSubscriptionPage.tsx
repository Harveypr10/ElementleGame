import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { ChevronLeft, Crown, Calendar, Flame, Umbrella, AlertTriangle, Globe, User } from "lucide-react";
import { useSubscription } from "@/hooks/useSubscription";
import { useStreakSaverStatus } from "@/hooks/useStreakSaverStatus";
import { useAdBannerActive } from "@/components/AdBanner";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { clearArchiveCache } from "@/lib/localCache";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface ManageSubscriptionPageProps {
  onBack: () => void;
  onGoProClick?: () => void;
}

function formatTierDisplayName(tierName: string, tierType: string): string {
  if (tierName.toLowerCase() === 'standard') {
    return 'Standard';
  }
  
  switch (tierType) {
    case 'monthly':
      return 'Pro - Monthly';
    case 'annual':
      return 'Pro - Annual';
    case 'lifetime':
      return 'Pro - Lifetime';
    default:
      return tierName.charAt(0).toUpperCase() + tierName.slice(1);
  }
}

function formatRenewalDate(dateString: string | null): string {
  if (!dateString) return 'N/A';
  const date = new Date(dateString);
  return date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export function ManageSubscriptionPage({ onBack, onGoProClick }: ManageSubscriptionPageProps) {
  const { subscription, isPro, tierName, tierType, streakSavers, holidaySavers, holidayDurationDays, isExpired } = useSubscription();
  const { 
    status,
    isLoading: statusLoading,
    holidayActive,
    holidayStartDate,
    holidayEndDate,
    holidayDaysTakenCurrentPeriod,
    holidaysRemaining,
    startHoliday,
    isStartingHoliday,
    endHoliday,
    isEndingHoliday,
    holidayDurationDays: hookHolidayDurationDays,
  } = useStreakSaverStatus();
  const adBannerActive = useAdBannerActive();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [autoRenew, setAutoRenew] = useState<boolean | null>(null);
  const [showCancelWarning, setShowCancelWarning] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [showStartHolidayConfirm, setShowStartHolidayConfirm] = useState(false);
  const [showEndHolidayConfirm, setShowEndHolidayConfirm] = useState(false);
  
  // Holiday activation overlay state
  const [showHolidayOverlay, setShowHolidayOverlay] = useState(false);
  const [holidayOverlayMode, setHolidayOverlayMode] = useState<'region' | 'user'>('region');
  const [overlayPhase, setOverlayPhase] = useState<'fade-in' | 'glow' | 'fade-out'>('fade-in');
  
  // Holiday animation data - dates to highlight with yellow glow
  const [regionHolidayDates, setRegionHolidayDates] = useState<string[]>([]);
  const [userHolidayDates, setUserHolidayDates] = useState<string[]>([]);
  const [showUserAfterRegion, setShowUserAfterRegion] = useState(false);

  // Sync local autoRenew state with subscription data when it loads/changes
  useEffect(() => {
    if (subscription?.autoRenew !== undefined) {
      setAutoRenew(subscription.autoRenew);
    }
  }, [subscription?.autoRenew]);

  // Display value - use subscription value if local state not yet set
  const displayAutoRenew = autoRenew ?? subscription?.autoRenew ?? true;

  const handleAutoRenewToggle = async (newValue: boolean) => {
    if (!newValue) {
      setShowCancelWarning(true);
    } else {
      await updateAutoRenew(true);
    }
  };

  const updateAutoRenew = async (value: boolean) => {
    if (!isPro) {
      return;
    }
    
    const previousValue = autoRenew;
    setIsUpdating(true);
    setAutoRenew(value);
    
    try {
      const response = await apiRequest("POST", "/api/subscription/auto-renew", { autoRenew: value });
      if (!response.ok) {
        throw new Error("Failed to update auto-renew");
      }
      queryClient.invalidateQueries({ queryKey: ["/api/subscription"] });
      toast({
        title: value ? "Auto-renew enabled" : "Auto-renew disabled",
        description: value 
          ? "Your subscription will renew automatically." 
          : "Your subscription will not renew after the current period.",
      });
    } catch (error) {
      console.error("Failed to update auto-renew:", error);
      setAutoRenew(previousValue);
      toast({
        title: "Error",
        description: "Failed to update auto-renew setting. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsUpdating(false);
    }
  };

  const confirmCancelAutoRenew = async () => {
    setShowCancelWarning(false);
    await updateAutoRenew(false);
  };

  const handleStartHoliday = async () => {
    setShowStartHolidayConfirm(false);
    try {
      await startHoliday();
      
      // Clear archive local cache and invalidate game attempts queries
      // This ensures Archive page shows fresh data with holiday rows and yellow borders
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
          
          if (showRegion) {
            // Set region holiday dates and start with region mode
            setRegionHolidayDates(animationData?.region?.holidayDates || []);
            setUserHolidayDates(animationData?.user?.holidayDates || []);
            setShowUserAfterRegion(showUser);
            setHolidayOverlayMode('region');
            setOverlayPhase('fade-in');
            setShowHolidayOverlay(true);
            return; // Exit early, animation will show toast on completion
          } else if (showUser) {
            // Skip region, go straight to user mode
            setUserHolidayDates(animationData?.user?.holidayDates || []);
            setShowUserAfterRegion(false);
            setHolidayOverlayMode('user');
            setOverlayPhase('fade-in');
            setShowHolidayOverlay(true);
            return; // Exit early, animation will show toast on completion
          }
        }
      } catch (animationError) {
        // Log but don't fail - animation is non-critical
        console.warn("Failed to fetch animation data:", animationError);
      }
      
      // No animation needed or animation fetch failed - just show toast
      toast({
        title: "Holiday mode activated",
        description: `Your streak is now protected for the next ${effectiveHolidayDurationDays} days.`,
      });
    } catch (error) {
      console.error("Failed to start holiday:", error);
      toast({
        title: "Error",
        description: "Failed to activate holiday mode. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleEndHoliday = async () => {
    setShowEndHolidayConfirm(false);
    try {
      await endHoliday(false);
      
      // Clear archive local cache and invalidate game attempts queries
      clearArchiveCache();
      queryClient.invalidateQueries({ queryKey: ['/api/game-attempts/user'] });
      queryClient.invalidateQueries({ queryKey: ['/api/user/game-attempts/user'] });
      
      toast({
        title: "Holiday mode ended",
        description: "Your streak protection has been deactivated.",
      });
    } catch (error) {
      console.error("Failed to end holiday:", error);
      toast({
        title: "Error",
        description: "Failed to end holiday mode. Please try again.",
        variant: "destructive",
      });
    }
  };

  const formatHolidayDate = (dateStr: string | null): string => {
    if (!dateStr) return 'N/A';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  const regionUsed = status?.region?.streakSaversUsedMonth ?? 0;
  const userUsed = status?.user?.streakSaversUsedMonth ?? 0;
  const totalStreakSaversUsed = Math.max(regionUsed, userUsed);
  const effectiveStreakSavers = streakSavers ?? (isPro ? 3 : 1);
  const streakSaversRemaining = effectiveStreakSavers - totalStreakSaversUsed;

  const holidaysUsedThisYear = status?.allowances?.holidaysUsedThisYear ?? 0;
  const effectiveHolidaySavers = holidaySavers ?? (isPro ? 2 : 0);
  const effectiveHolidayDurationDays = holidayDurationDays ?? (isPro ? 14 : 0);
  const holidaysRemainingValue = effectiveHolidaySavers - holidaysUsedThisYear;

  const isLifetime = tierType === 'lifetime';

  // Holiday overlay animation effect
  useEffect(() => {
    if (!showHolidayOverlay) return;
    
    let timer: NodeJS.Timeout;
    
    if (overlayPhase === 'fade-in') {
      // 1 second fade in, then start glow
      timer = setTimeout(() => setOverlayPhase('glow'), 1000);
    } else if (overlayPhase === 'glow') {
      // 3 seconds of glow animation, then fade out
      timer = setTimeout(() => setOverlayPhase('fade-out'), 3000);
    } else if (overlayPhase === 'fade-out') {
      // 1 second fade out, then switch mode or close
      timer = setTimeout(() => {
        if (holidayOverlayMode === 'region' && showUserAfterRegion) {
          // Switch to user mode only if conditions were met for user mode
          setHolidayOverlayMode('user');
          setOverlayPhase('fade-in');
        } else {
          // Done, close overlay and show toast
          setShowHolidayOverlay(false);
          setShowUserAfterRegion(false);
          toast({
            title: "Holiday mode activated",
            description: `Your streak is now protected for the next ${effectiveHolidayDurationDays} days.`,
          });
        }
      }, 1000);
    }
    
    return () => clearTimeout(timer);
  }, [showHolidayOverlay, overlayPhase, holidayOverlayMode, showUserAfterRegion, effectiveHolidayDurationDays, toast]);

  // Get today's date for the calendar
  const today = new Date();
  const currentMonth = today.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
  const currentDay = today.getDate();
  const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).getDay();
  // Adjust for Monday start (0 = Monday, 6 = Sunday)
  const adjustedFirstDay = firstDayOfMonth === 0 ? 6 : firstDayOfMonth - 1;

  return (
    <div className={`min-h-screen flex flex-col p-4 bg-background ${adBannerActive ? 'pb-[50px]' : ''}`}>
      <div className="w-full max-w-md mx-auto space-y-4">
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={onBack}
            data-testid="button-back-from-manage-subscription"
            className="w-14 h-14 flex items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <ChevronLeft className="h-9 w-9 text-gray-700" />
          </button>

          <div className="flex flex-col items-center">
            <h1 className="text-2xl font-bold">Manage Subscription</h1>
          </div>

          <div className="w-14" />
        </div>

        {isPro ? (
          <>
            <Card className="p-4 space-y-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-full bg-gradient-to-br from-orange-400 to-orange-500">
                  <Crown className="h-5 w-5 text-white" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Subscription</p>
                  <p className="font-semibold text-lg" data-testid="text-subscription-tier">
                    {formatTierDisplayName(tierName, tierType)}
                  </p>
                </div>
              </div>

              {!isLifetime && subscription?.endDate && (
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-full bg-muted">
                    <Calendar className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Renews on</p>
                    <p className="font-semibold" data-testid="text-renewal-date">
                      {formatRenewalDate(subscription.endDate)}
                    </p>
                  </div>
                </div>
              )}

              {isLifetime && (
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-full bg-muted">
                    <Calendar className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Subscription type</p>
                    <p className="font-semibold" data-testid="text-lifetime-status">
                      Lifetime - Never expires
                    </p>
                  </div>
                </div>
              )}
            </Card>

            <Card className="p-4 space-y-4">
              <h2 className="font-semibold text-lg">Your Allowances</h2>
              
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-full bg-amber-100 dark:bg-amber-900/30">
                  <Flame className="h-5 w-5 text-amber-500" />
                </div>
                <div className="flex-1">
                  <p className="text-sm text-muted-foreground">Monthly streak savers</p>
                  <p className="font-semibold" data-testid="text-streak-savers-remaining">
                    {statusLoading 
                      ? `${effectiveStreakSavers} of ${effectiveStreakSavers} remaining`
                      : `${Math.max(0, streakSaversRemaining)} of ${effectiveStreakSavers} remaining`
                    }
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="p-2 rounded-full bg-blue-100 dark:bg-blue-900/30">
                  <Umbrella className="h-5 w-5 text-blue-500" />
                </div>
                <div className="flex-1">
                  <p className="text-sm text-muted-foreground">Annual {effectiveHolidayDurationDays} day holiday allowance</p>
                  <p className="font-semibold" data-testid="text-holidays-remaining">
                    {statusLoading 
                      ? `${effectiveHolidaySavers} of ${effectiveHolidaySavers} remaining`
                      : `${Math.max(0, holidaysRemainingValue)} of ${effectiveHolidaySavers} remaining`
                    }
                  </p>
                </div>
              </div>
            </Card>

            <Card className="p-4 space-y-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-full bg-blue-100 dark:bg-blue-900/30">
                  <Umbrella className="h-5 w-5 text-blue-500" />
                </div>
                <div className="flex-1">
                  <h2 className="font-semibold text-lg">Holiday Mode</h2>
                  <p className="text-sm text-muted-foreground">
                    {holidayActive 
                      ? "Your streak is currently protected"
                      : "Protect your streak for up to " + effectiveHolidayDurationDays + " days"
                    }
                  </p>
                </div>
              </div>

              {holidayActive ? (
                <div className="space-y-3 pl-12">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Started</span>
                    <span className="font-medium" data-testid="text-holiday-start-date">
                      {formatHolidayDate(holidayStartDate)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Ends</span>
                    <span className="font-medium" data-testid="text-holiday-end-date">
                      {formatHolidayDate(holidayEndDate)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Days taken</span>
                    <span className="font-medium" data-testid="text-holiday-days-taken">
                      {holidayDaysTakenCurrentPeriod} of {effectiveHolidayDurationDays}
                    </span>
                  </div>
                  <Button
                    variant="outline"
                    onClick={() => setShowEndHolidayConfirm(true)}
                    disabled={isEndingHoliday}
                    className="w-full mt-2"
                    data-testid="button-end-holiday"
                  >
                    {isEndingHoliday ? "Ending..." : "End Holiday Early"}
                  </Button>
                </div>
              ) : (
                <div className="pl-12">
                  {holidaysRemaining > 0 ? (
                    <Button
                      onClick={() => setShowStartHolidayConfirm(true)}
                      disabled={isStartingHoliday}
                      className="w-full bg-blue-500 hover:bg-blue-600 text-white"
                      data-testid="button-start-holiday"
                    >
                      {isStartingHoliday ? "Activating..." : "Start Holiday Mode"}
                    </Button>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      You've used all your holiday allowances this year. Your allowance will reset one year after your initial subscription was activated.
                    </p>
                  )}
                </div>
              )}
            </Card>

            {!isLifetime && (
              <Card className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold">Auto-renew</p>
                    <p className="text-sm text-muted-foreground">
                      {displayAutoRenew ? "Your subscription will renew automatically" : "Your subscription will not renew"}
                    </p>
                  </div>
                  <Switch
                    checked={displayAutoRenew}
                    onCheckedChange={handleAutoRenewToggle}
                    disabled={isUpdating}
                    data-testid="switch-auto-renew"
                  />
                </div>
              </Card>
            )}
          </>
        ) : (
          <>
            <Card className="p-4 space-y-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-full bg-muted">
                  <Crown className="h-5 w-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Subscription</p>
                  <p className="font-semibold text-lg" data-testid="text-subscription-tier">
                    Standard
                  </p>
                </div>
              </div>
            </Card>

            <Card className="p-4 space-y-4">
              <h2 className="font-semibold text-lg">Your Allowances</h2>
              
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-full bg-amber-100 dark:bg-amber-900/30">
                  <Flame className="h-5 w-5 text-amber-500" />
                </div>
                <div className="flex-1">
                  <p className="text-sm text-muted-foreground">Monthly streak savers</p>
                  <p className="font-semibold" data-testid="text-streak-savers-remaining">
                    {(() => {
                      const used = status?.region?.streakSaversUsedMonth ?? 0;
                      const remaining = Math.max(0, 1 - used);
                      return `${remaining} of 1 remaining`;
                    })()}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="p-2 rounded-full bg-blue-100 dark:bg-blue-900/30">
                  <Umbrella className="h-5 w-5 text-blue-500" />
                </div>
                <div className="flex-1">
                  <p className="text-sm text-muted-foreground">Annual 14 day holiday allowance</p>
                  <p className="font-semibold text-muted-foreground" data-testid="text-holidays-remaining">
                    0 of 0 remaining
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Pro members can pause their streak with holidays
                  </p>
                </div>
              </div>
            </Card>

            <Button
              onClick={onGoProClick}
              className="w-full bg-gradient-to-r from-orange-400 to-orange-500 hover:from-orange-500 hover:to-orange-600 text-white"
              data-testid="button-go-pro-upgrade"
            >
              <Crown className="h-4 w-4 mr-2" />
              Go Pro to increase your allowances
            </Button>
          </>
        )}
      </div>

      <AlertDialog open={showCancelWarning} onOpenChange={setShowCancelWarning}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Turn off auto-renew?
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="text-left space-y-3 text-sm text-muted-foreground">
                <p>
                  If you don't renew your subscription, you'll lose access to these Pro benefits:
                </p>
                <ul className="list-disc pl-5 space-y-1 text-foreground">
                  <li><strong>Ad-free experience</strong> - No more banner or interstitial ads</li>
                  <li><strong>Custom categories</strong> - Choose your preferred puzzle categories</li>
                  <li><strong>{effectiveStreakSavers} streak savers per month</strong> - Instead of just 1</li>
                  <li><strong>{effectiveHolidaySavers} holiday breaks per year</strong> - Protect your streak for up to {effectiveHolidayDurationDays} days each</li>
                  <li><strong>Personal mode puzzles</strong> - Puzzles tailored to your location</li>
                </ul>
                <p className="text-muted-foreground">
                  Your subscription will remain active until {formatRenewalDate(subscription?.endDate || null)}, but will not renew after that.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-warning-dismiss">
              Keep auto-renew on
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={confirmCancelAutoRenew}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-cancel-renewal"
            >
              Turn off auto-renew
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showStartHolidayConfirm} onOpenChange={setShowStartHolidayConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Umbrella className="h-5 w-5 text-blue-500" />
              Start Holiday Mode?
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="text-left space-y-3 text-sm text-muted-foreground">
                <p>
                  This will protect your streak for up to {effectiveHolidayDurationDays} days. During this time:
                </p>
                <ul className="list-disc pl-5 space-y-1 text-foreground">
                  <li>Your streak will be preserved even if you don't play</li>
                  <li>You can still play puzzles if you want</li>
                  <li>Holiday days will be marked in your archive</li>
                </ul>
                <p>
                  You have {holidaysRemaining} holiday allowance{holidaysRemaining !== 1 ? 's' : ''} remaining this year.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-start-holiday">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleStartHoliday}
              className="bg-blue-500 text-white hover:bg-blue-600"
              data-testid="button-confirm-start-holiday"
            >
              Start Holiday
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showEndHolidayConfirm} onOpenChange={setShowEndHolidayConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Umbrella className="h-5 w-5 text-blue-500" />
              End Holiday Mode?
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="text-left space-y-3 text-sm text-muted-foreground">
                <p>
                  Are you sure you want to end your holiday early?
                </p>
                <p>
                  You've used {holidayDaysTakenCurrentPeriod} of your {effectiveHolidayDurationDays} holiday days. 
                  Ending early won't give you these days back.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-end-holiday">
              Keep Holiday Active
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleEndHoliday}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-end-holiday"
            >
              End Holiday
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Holiday Activation Overlay */}
      <AnimatePresence>
        {showHolidayOverlay && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80"
            initial={{ opacity: 0 }}
            animate={{ opacity: overlayPhase === 'fade-out' ? 0 : 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1 }}
          >
            <motion.div
              className="bg-card rounded-lg p-6 max-w-sm w-full mx-4 shadow-xl"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: overlayPhase === 'fade-out' ? 0 : 1 }}
              transition={{ duration: 0.5 }}
            >
              {/* Header with mode icon */}
              <div className="flex items-center justify-center gap-2 mb-4">
                <div className={cn(
                  "p-2 rounded-full",
                  holidayOverlayMode === 'region' 
                    ? "bg-blue-100 dark:bg-blue-900/30" 
                    : "bg-purple-100 dark:bg-purple-900/30"
                )}>
                  {holidayOverlayMode === 'region' ? (
                    <Globe className="h-5 w-5 text-blue-500" />
                  ) : (
                    <User className="h-5 w-5 text-purple-500" />
                  )}
                </div>
                <h3 className="text-lg font-semibold">
                  {holidayOverlayMode === 'region' ? 'Global Game' : 'Personal Game'}
                </h3>
              </div>

              <p className="text-center text-sm text-muted-foreground mb-4">
                Holiday mode is now active
              </p>

              {/* Calendar Grid */}
              <div className="bg-muted/50 rounded-lg p-4">
                <p className="text-center text-sm font-medium mb-3">{currentMonth}</p>
                
                {/* Day headers */}
                <div className="grid grid-cols-7 gap-1 mb-2">
                  {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((day, i) => (
                    <div key={i} className="text-center text-xs text-muted-foreground font-medium">
                      {day}
                    </div>
                  ))}
                </div>

                {/* Calendar days */}
                <div className="grid grid-cols-7 gap-1">
                  {/* Empty cells for days before the first of the month */}
                  {Array.from({ length: adjustedFirstDay }).map((_, i) => (
                    <div key={`empty-${i}`} className="aspect-square" />
                  ))}
                  
                  {/* Days of the month */}
                  {Array.from({ length: daysInMonth }).map((_, i) => {
                    const day = i + 1;
                    const isToday = day === currentDay;
                    
                    // Check if this day should be highlighted based on holidayDates
                    const currentHolidayDates = holidayOverlayMode === 'region' ? regionHolidayDates : userHolidayDates;
                    const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                    const isHolidayDate = currentHolidayDates.includes(dateStr);
                    
                    return (
                      <div
                        key={day}
                        className={cn(
                          "aspect-square flex items-center justify-center text-xs rounded-md relative",
                          (isToday || isHolidayDate) && "font-bold"
                        )}
                      >
                        {isHolidayDate && overlayPhase === 'glow' && (
                          <motion.div
                            className="absolute inset-0 rounded-md border-2 border-yellow-400"
                            initial={{ opacity: 0 }}
                            animate={{
                              opacity: 1,
                              boxShadow: [
                                "0 0 5px 2px rgba(250, 204, 21, 0.4)",
                                "0 0 15px 5px rgba(250, 204, 21, 0.7)",
                                "0 0 5px 2px rgba(250, 204, 21, 0.4)",
                              ],
                            }}
                            transition={{
                              duration: 1.5,
                              repeat: Infinity,
                              ease: "easeInOut",
                            }}
                          />
                        )}
                        <span className={cn(isHolidayDate && overlayPhase === 'glow' && "relative z-10")}>{day}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
