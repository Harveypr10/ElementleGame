import { Button } from "@/components/ui/button";
import happyHamster from "@assets/Celebration-Hamster-Grey.svg";
import sadHamster from "@assets/Commiseration-Hamster-Grey.svg";
import { useEffect, useState } from "react";
import { Home, BarChart3, Archive } from "lucide-react";
import { formatFullDateWithOrdinal, formatDateWithOrdinal } from "@/lib/dateFormat";
import { soundManager } from "@/lib/sounds";

interface EndGameModalProps {
  isOpen: boolean;
  isWin: boolean;
  targetDate: string;
  answerDate?: string;
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
  answerDate,
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
    if (isOpen) {
      // Play appropriate sound when modal opens
      if (isWin) {
        soundManager.playCelebration();
        setShowConfetti(true);
        // Keep confetti showing while modal is open
      } else {
        soundManager.playCommiseration();
      }
    } else {
      // Hide confetti when modal closes
      setShowConfetti(false);
    }
  }, [isOpen, isWin]);


  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-background z-50 flex items-center justify-center p-4" data-testid="end-game-modal">
      <div className="w-full max-w-md space-y-8">
        <h2 className="text-center text-3xl font-bold">
          {isWin ? "Congratulations!" : "Better Luck Next Time"}
        </h2>

        <div className="relative flex justify-center my-8">
          <img
            src={isWin ? happyHamster : sadHamster}
            alt={isWin ? "Happy hamster" : "Sad hamster"}
            className={`${isWin ? "max-w-[150px]" : "max-w-xs"} w-full h-auto object-contain ${!isWin ? "animate-fade-in" : ""}`}
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
              {(() => {
                console.log("EndGameModal answerDate prop:", answerDate);
                if (answerDate) {
                  return formatFullDateWithOrdinal(answerDate);
                }
                return "Unknown date";
              })()}
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
          animation: confetti-fall 2s linear infinite;
        }
        
        .animate-fade-in {
          animation: fade-in 0.8s ease-in forwards;
        }
        
        @keyframes confetti-fall {
          to {
            transform: translateY(200px) rotate(360deg);
            opacity: 0;
          }
        }
        
        @keyframes fade-in {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
}
