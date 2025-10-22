import { useEffect } from "react";
import streakHamster from "@assets/Streak-Hamster-Black.svg";
import { soundManager } from "@/lib/sounds";

interface StreakCelebrationPopupProps {
  streak: number;
  onDismiss: () => void;
}

export function StreakCelebrationPopup({ streak, onDismiss }: StreakCelebrationPopupProps) {
  useEffect(() => {
    // Play streak sound when popup appears
    soundManager.playStreak();
    
    const timer = setTimeout(() => {
      onDismiss();
    }, 5000);

    return () => clearTimeout(timer);
  }, [onDismiss]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black backdrop-blur-sm"
      onClick={onDismiss}
      data-testid="streak-celebration-overlay"
    >
      <div
        className="cursor-pointer p-8 max-w-sm w-full mx-4 text-center"
        onClick={onDismiss}
        data-testid="streak-celebration-card"
      >
        <div className="flex flex-col items-center gap-6">
          <div className="relative w-64 h-64 flex items-center justify-center">
            <img
              src={streakHamster}
              alt="Streak hamster"
              className="w-full h-full object-contain"
            />
            <div
              className="absolute inset-0 flex items-center justify-center"
              style={{ top: "50%" }}
            >
              <span
                className={`font-bold text-red-600 drop-shadow-lg leading-none ${
                  String(streak).length === 1
                    ? "text-6xl"
                    : String(streak).length === 2
                    ? "text-5xl"
                    : "text-4xl"
                }`}
                data-testid="text-streak-number"
              >
                {streak}
              </span>
            </div>

          </div>
          
          <div className="text-white">
            <h3 className="text-2xl font-bold mb-2" data-testid="text-streak-title">
              {streak === 1 ? "Streak Started!" : "Streak Continues!"}
            </h3>
            <p className="text-lg text-white/80" data-testid="text-streak-message">
              {streak === 1 
                ? "Keep playing to build your streak!" 
                : `${streak} days in a row! Keep it up!`}
            </p>
          </div>

          <p className="text-sm text-white/60 mt-2">
            Click anywhere to dismiss
          </p>
        </div>
      </div>
    </div>
  );
}
