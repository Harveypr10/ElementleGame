import { useEffect, useState } from "react";
import { useStreakSaverStatus } from "@/hooks/useStreakSaverStatus";
import { useAuth } from "@/hooks/useAuth";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Umbrella } from "lucide-react";

export function HolidayEndedPopup() {
  const { isAuthenticated } = useAuth();
  const { 
    holidayEnded,
    holidayDaysTakenCurrentPeriod,
    acknowledgeHolidayEnd,
    isAcknowledging,
    isLoading
  } = useStreakSaverStatus();
  
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (!isLoading && isAuthenticated && holidayEnded) {
      setIsOpen(true);
    }
  }, [isLoading, isAuthenticated, holidayEnded]);

  const handleAcknowledge = async () => {
    try {
      await acknowledgeHolidayEnd();
      setIsOpen(false);
    } catch (error) {
      console.error("Failed to acknowledge holiday end:", error);
      setIsOpen(false);
    }
  };

  if (!isAuthenticated || !holidayEnded) {
    return null;
  }

  return (
    <AlertDialog open={isOpen} onOpenChange={setIsOpen}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <Umbrella className="h-5 w-5 text-blue-500" />
            Holiday Mode Ended
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="text-left space-y-3 text-sm text-muted-foreground">
              <p>
                Your holiday mode has ended after {holidayDaysTakenCurrentPeriod} day{holidayDaysTakenCurrentPeriod !== 1 ? 's' : ''}.
              </p>
              <p>
                Your streak was protected during this time. Now it's time to get back to playing!
              </p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogAction 
            onClick={handleAcknowledge}
            disabled={isAcknowledging}
            className="bg-blue-500 text-white hover:bg-blue-600"
            data-testid="button-acknowledge-holiday-end"
          >
            {isAcknowledging ? "..." : "Got it!"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
