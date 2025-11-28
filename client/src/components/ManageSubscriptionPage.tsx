import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { ChevronLeft, Crown, Calendar, Flame, Umbrella, AlertTriangle } from "lucide-react";
import { useSubscription } from "@/hooks/useSubscription";
import { useStreakSaverStatus } from "@/hooks/useStreakSaverStatus";
import { useAdBannerActive } from "@/components/AdBanner";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useQueryClient } from "@tanstack/react-query";
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

function formatTierDisplayName(tierName: string): string {
  switch (tierName) {
    case 'pro_monthly':
      return 'Pro - Monthly';
    case 'pro_annual':
      return 'Pro - Annual';
    case 'pro_lifetime':
      return 'Pro - Lifetime';
    case 'standard':
      return 'Standard';
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
  const { subscription, isPro, tierName, streakSavers, holidaySavers, holidayDurationDays } = useSubscription();
  const { 
    status,
    isLoading: statusLoading,
  } = useStreakSaverStatus();
  const adBannerActive = useAdBannerActive();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [autoRenew, setAutoRenew] = useState(subscription?.autoRenew ?? true);
  const [showCancelWarning, setShowCancelWarning] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

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
        throw new Error("Failed to update auto-renewal");
      }
      queryClient.invalidateQueries({ queryKey: ["/api/subscription"] });
      toast({
        title: value ? "Auto-renewal enabled" : "Auto-renewal disabled",
        description: value 
          ? "Your subscription will renew automatically." 
          : "Your subscription will not renew after the current period.",
      });
    } catch (error) {
      console.error("Failed to update auto-renewal:", error);
      setAutoRenew(previousValue);
      toast({
        title: "Error",
        description: "Failed to update auto-renewal setting. Please try again.",
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

  const regionUsed = status?.region?.streakSaversUsedMonth ?? 0;
  const userUsed = status?.user?.streakSaversUsedMonth ?? 0;
  const totalStreakSaversUsed = Math.max(regionUsed, userUsed);
  const effectiveStreakSavers = streakSavers ?? (isPro ? 3 : 1);
  const streakSaversRemaining = effectiveStreakSavers - totalStreakSaversUsed;

  const holidaysUsedThisYear = status?.allowances?.holidaysUsedThisYear ?? 0;
  const effectiveHolidaySavers = holidaySavers ?? (isPro ? 2 : 0);
  const effectiveHolidayDurationDays = holidayDurationDays ?? (isPro ? 14 : 0);
  const holidaysRemainingValue = effectiveHolidaySavers - holidaysUsedThisYear;

  const isLifetime = tierName === 'pro_lifetime';

  return (
    <div className={`min-h-screen flex flex-col p-4 ${adBannerActive ? 'pb-[50px]' : ''}`}>
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
                    {formatTierDisplayName(tierName)}
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

            {!isLifetime && (
              <Card className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold">Auto-renewal</p>
                    <p className="text-sm text-muted-foreground">
                      {autoRenew ? "Your subscription will renew automatically" : "Your subscription will not renew"}
                    </p>
                  </div>
                  <Switch
                    checked={autoRenew}
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
              Turn off auto-renewal?
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
                  <li><strong>{effectiveHolidaySavers} holiday breaks per year</strong> - Pause your streak for up to {effectiveHolidayDurationDays} days each</li>
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
              Keep auto-renewal on
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={confirmCancelAutoRenew}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-cancel-renewal"
            >
              Turn off auto-renewal
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
