import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import happyHamster from "@assets/generated_images/Dancing_celebration_hamster_mascot_12963875.png";
import sadHamster from "@assets/generated_images/Sad_defeated_hamster_mascot_c614cf35.png";
import { useEffect, useState } from "react";

interface EndGameModalProps {
  isOpen: boolean;
  isWin: boolean;
  targetDate: string;
  eventTitle: string;
  eventDescription: string;
  numGuesses?: number;
  onPlayAgain: () => void;
}

export function EndGameModal({
  isOpen,
  isWin,
  targetDate,
  eventTitle,
  eventDescription,
  numGuesses,
  onPlayAgain,
}: EndGameModalProps) {
  const [showConfetti, setShowConfetti] = useState(false);

  useEffect(() => {
    if (isOpen && isWin) {
      setShowConfetti(true);
      const timer = setTimeout(() => setShowConfetti(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [isOpen, isWin]);

  const formatDate = (date: string) => {
    if (date.length !== 8) return date;
    const day = date.substring(0, 2);
    const month = date.substring(2, 4);
    const year = date.substring(4, 8);
    return `${day}/${month}/${year}`;
  };

  return (
    <Dialog open={isOpen}>
      <DialogContent className="sm:max-w-lg" data-testid="end-game-modal">
        <DialogHeader>
          <DialogTitle className="text-center text-2xl">
            {isWin ? "Congratulations!" : "Better Luck Next Time"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          <div className="relative flex justify-center">
            <img
              src={isWin ? happyHamster : sadHamster}
              alt={isWin ? "Happy hamster" : "Sad hamster"}
              className={`h-32 w-32 ${isWin ? "animate-bounce" : "animate-pulse"}`}
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
              <p className="text-3xl font-bold" data-testid="text-target-date">
                {formatDate(targetDate)}
              </p>
            </div>

            <div className="bg-muted p-4 rounded-lg space-y-2">
              <h3 className="font-semibold text-lg" data-testid="text-event-title">
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

          <Button
            className="w-full h-12"
            onClick={onPlayAgain}
            data-testid="button-play-again"
          >
            {isWin ? "Play Next Puzzle" : "Try Next Puzzle"}
          </Button>
        </div>
      </DialogContent>

      <style>{`
        .confetti-container {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          pointer-events: none;
          overflow: hidden;
        }
        
        .confetti {
          position: absolute;
          width: 8px;
          height: 8px;
          top: -10px;
          animation: confetti-fall 2s linear forwards;
        }
        
        @keyframes confetti-fall {
          to {
            transform: translateY(400px) rotate(360deg);
            opacity: 0;
          }
        }
      `}</style>
    </Dialog>
  );
}
