import { Button } from "@/components/ui/button";
import happyHamster from "@assets/generated_images/Dancing_celebration_hamster_mascot_12963875.png";
import sadHamster from "@assets/generated_images/Sad_defeated_hamster_mascot_c614cf35.png";
import { useEffect, useState } from "react";
import { Home, BarChart3, Archive } from "lucide-react";
import { formatDateWithOrdinal } from "@/lib/dateFormat";

interface EndGameModalProps {
  isOpen: boolean;
  isWin: boolean;
  targetDate: string;
  eventTitle: string;
  eventDescription: string;
  numGuesses?: number;
  onPlayAgain: () => void;
  onHome: () => void;
  onViewStats?: () => void;
  onViewArchive?: () => void;
}

export function EndGameModal({
  isOpen,
  isWin,
  targetDate,
  eventTitle,
  eventDescription,
  numGuesses,
  onPlayAgain,
  onHome,
  onViewStats,
  onViewArchive,
}: EndGameModalProps) {
  const [showConfetti, setShowConfetti] = useState(false);

  useEffect(() => {
    if (isOpen && isWin) {
      setShowConfetti(true);
      const timer = setTimeout(() => setShowConfetti(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [isOpen, isWin]);


  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-background z-50 flex items-center justify-center p-4" data-testid="end-game-modal">
      <div className="w-full max-w-md space-y-8">
        <h2 className="text-center text-3xl font-bold">
          {isWin ? "Congratulations!" : "Better Luck Next Time"}
        </h2>

        <div className="relative flex justify-center h-40 mt-8">
          <img
            src={isWin ? happyHamster : sadHamster}
            alt={isWin ? "Happy hamster" : "Sad hamster"}
            className={`h-32 w-32 bg-background rounded-full ${isWin ? "animate-bounce" : "animate-pulse"}`}
            data-testid="hamster-image"
          />
          {showConfetti && (
            <div className="confetti-container">
              {Array.from({ length: 20 }).map((_, i) => (
                <div
                  key={i}
                  className="confetti"
                  style={{
                    left: `${Math.random() * 100}%`,
                    animationDelay: `${Math.random() * 0.5}s`,
                    backgroundColor: ['#3b82f6', '#10b981', '#f59e0b', '#ec4899'][Math.floor(Math.random() * 4)],
                  }}
                />
              ))}
            </div>
          )}
        </div>

        <div className="space-y-4 text-center">
          <div>
            <p className="text-sm text-muted-foreground mb-1">The date was</p>
            <p className="text-4xl font-bold" data-testid="text-target-date">
              {formatDateWithOrdinal(targetDate)}
            </p>
          </div>

          <div className="bg-muted p-6 rounded-lg space-y-2">
            <h3 className="font-semibold text-xl" data-testid="text-event-title">
              {eventTitle}
            </h3>
            <p className="text-sm text-muted-foreground" data-testid="text-event-description">
              {eventDescription}
            </p>
          </div>

          {isWin && numGuesses && (
            <p className="text-sm text-muted-foreground">
              You solved it in {numGuesses} {numGuesses === 1 ? "guess" : "guesses"}!
            </p>
          )}
        </div>

        <div className="space-y-3">
          <Button
            className="w-full h-14 text-lg"
            onClick={onHome}
            data-testid="button-home"
          >
            <Home className="h-5 w-5 mr-2" />
            Home
          </Button>

          <div className="flex gap-3">
            <Button
              variant="outline"
              className="flex-1 h-14"
              onClick={onViewStats}
              data-testid="button-stats"
            >
              <BarChart3 className="h-5 w-5 mr-2" />
              Stats
            </Button>

            <Button
              variant="outline"
              className="flex-1 h-14"
              onClick={onViewArchive}
              data-testid="button-archive"
            >
              <Archive className="h-5 w-5 mr-2" />
              Archive
            </Button>
          </div>
        </div>
      </div>

      <style>{`
        .confetti-container {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 100%;
          pointer-events: none;
          overflow: hidden;
        }
        
        .confetti {
          position: absolute;
          width: 8px;
          height: 8px;
          top: 0;
          animation: confetti-fall 2s linear forwards;
        }
        
        @keyframes confetti-fall {
          to {
            transform: translateY(200px) rotate(360deg);
            opacity: 0;
          }
        }
      `}</style>
    </div>
  );
}
