import { useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Flame } from "lucide-react";

interface StreakCelebrationPopupProps {
  streak: number;
  onDismiss: () => void;
}

export function StreakCelebrationPopup({ streak, onDismiss }: StreakCelebrationPopupProps) {
  useEffect(() => {
    const timer = setTimeout(() => {
      onDismiss();
    }, 5000);

    return () => clearTimeout(timer);
  }, [onDismiss]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm"
      onClick={onDismiss}
      data-testid="streak-celebration-overlay"
    >
      <div
        className="cursor-pointer"
        onClick={onDismiss}
        data-testid="streak-celebration-card"
      >
        <Card className="p-8 max-w-sm w-full mx-4 text-center hover-elevate">
          <div className="flex flex-col items-center gap-4">
            <div className="relative">
              <Flame className="h-20 w-20 text-orange-500" />
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-3xl font-bold text-white drop-shadow-lg" data-testid="text-streak-number">
                  {streak}
                </span>
              </div>
            </div>
            
            <div>
              <h3 className="text-2xl font-bold mb-2" data-testid="text-streak-title">
                {streak === 1 ? "Streak Started!" : "Streak Continues!"}
              </h3>
              <p className="text-lg text-muted-foreground" data-testid="text-streak-message">
                {streak === 1 
                  ? "Keep playing to build your streak!" 
                  : `${streak} days in a row! Keep it up!`}
              </p>
            </div>

            <p className="text-sm text-muted-foreground mt-2">
              Click anywhere to dismiss
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
}
