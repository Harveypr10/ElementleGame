import { Button } from "@/components/ui/button";
import happyHamster from "@assets/Celebration-Hamster-Grey.svg";
import sadHamster from "@assets/Commiseration-Hamster-Grey.svg";
import happyHamsterDark from "@assets/Celebration-Hamster-DarkMode.svg";
import sadHamsterDark from "@assets/Commiseration-Hamster-DarkMode.svg";
import historianHamsterBlue from "@assets/Historian-Hamster-Blue.svg";
import librarianHamsterYellow from "@assets/Librarian-Hamster-Yellow.svg";
import mathsHamsterGreen from "@assets/Maths-Hamster-Green.svg";
import { useEffect, useState } from "react";
import { Home, BarChart3, Archive } from "lucide-react";
import { formatFullDateWithOrdinal, formatDateWithOrdinal } from "@/lib/dateFormat";
import { soundManager } from "@/lib/sounds";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";

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
  const { isAuthenticated } = useAuth();
  const { profile } = useProfile();
  const [showConfetti, setShowConfetti] = useState(false);
  const [showRain, setShowRain] = useState(false);

  useEffect(() => {
    if (isOpen) {
      if (isWin) {
        soundManager.playCelebration();
        setShowConfetti(true);
        setShowRain(false);
      } else {
        soundManager.playCommiseration();
        setShowRain(true);
        setShowConfetti(false);
      }
    } else {
      setShowConfetti(false);
      setShowRain(false);
    }
  }, [isOpen, isWin]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-background z-50 overflow-y-auto" data-testid="end-game-modal">
      <div className="min-h-screen p-4 pt-8">
        <div className="w-full max-w-md mx-auto space-y-6">
          <h2 className="text-center text-3xl font-bold">
            {isWin ? "Congratulations!" : "Unlucky!"}
          </h2>

          <div className="relative flex justify-center my-4">
            {/* Light mode hamster */}
            <img
              src={isWin ? happyHamster : sadHamster}
              alt={isWin ? "Happy hamster" : "Sad hamster"}
              className={`${isWin ? "max-w-[150px]" : "max-w-[150px]"} w-full h-auto object-contain ${!isWin ? "animate-fade-in" : ""} block dark:hidden`}
              data-testid="hamster-image"
            />

            {/* Dark mode hamster */}
            <img
              src={isWin ? happyHamsterDark : sadHamsterDark}
              alt={isWin ? "Happy hamster dark" : "Sad hamster dark"}
              className={`${isWin ? "max-w-[150px]" : "max-w-[150px]"} w-full h-auto object-contain ${!isWin ? "animate-fade-in" : ""} hidden dark:block`}
              data-testid="hamster-image-dark"
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

            {showRain && (
              <div className="rain-container">
                {Array.from({ length: 40 }).map((_, i) => (
                  <div
                    key={i}
                    className="raindrop"
                    style={{
                      left: `${Math.random() * 100}%`,
                      animationDuration: `${1 + Math.random() * 1.5}s`,
                      animationDelay: `${Math.random() * 2}s`,
                    }}
                  />
                ))}
              </div>
            )}
          </div>

          <div className="space-y-4 text-center">
            <p
              className="text-2xl font-bold truncate max-w-full overflow-hidden text-ellipsis"
              data-testid="text-target-date"
            >
              {answerDate ? formatFullDateWithOrdinal(answerDate) : "Unknown date"}
            </p>

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

          <div className="space-y-3">
            {/* Stats button: full width, green */}
            <Button
              variant="success"
              className="w-full h-16 sm:h-20 md:h-24 flex items-center justify-between px-6 rounded-3xl shadow-sm"
              onClick={onViewStats}
              data-testid="button-stats"
            >
              <span className="text-lg sm:text-xl md:text-2xl font-bold text-gray-800">Stats</span>
              <div className="flex-shrink-0 flex items-center">
                <img
                  src={mathsHamsterGreen}
                  alt="Stats"
                  className="h-14 sm:h-16 md:h-20 w-auto object-contain"
                />
              </div>
            </Button>

            <div className="flex gap-3">
              {/* Home button: half width, blue */}
              <Button
                variant="default"
                className="flex-1 h-16 sm:h-20 md:h-24 flex items-center justify-between px-4 rounded-3xl shadow-sm"
                onClick={onHome}
                data-testid="button-home"
              >
                <span className="text-base sm:text-lg md:text-xl font-bold text-gray-800">Home</span>
                <div className="flex-shrink-0 flex items-center">
                  <img
                    src={historianHamsterBlue}
                    alt="Home"
                    className="h-14 sm:h-16 md:h-20 w-auto object-contain"
                  />
                </div>
              </Button>

              {/* Archive button: half width, yellow */}
              <Button
                variant="warning"
                className="flex-1 h-16 sm:h-20 md:h-24 flex items-center justify-between px-4 rounded-3xl shadow-sm"
                onClick={onViewArchive}
                data-testid="button-archive"
              >
                <div className="flex flex-col items-start flex-1">
                  <span className="text-base sm:text-lg md:text-xl font-bold text-gray-800">Archive</span>
                </div>
                <div className="flex-shrink-0 flex items-center">
                  <img
                    src={librarianHamsterYellow}
                    alt="Archive"
                    className="h-14 sm:h-16 md:h-20 w-auto object-contain"
                  />
                </div>
              </Button>
            </div>
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

        .rain-container {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 100%;
          pointer-events: none;
          overflow: hidden;
        }

        .raindrop {
          position: absolute;
          top: -20px;
          width: 2px;
          height: 12px;
          background: linear-gradient(to bottom, #60a5fa, #3b82f6); /* light to darker blue */
          opacity: 0.7;
          border-radius: 1px;
          animation: rain-fall linear infinite;
        }

        @keyframes rain-fall {
          to {
            transform: translateY(110vh);
            opacity: 0.2;
          }
        }
        
      `}</style>
    </div>
  );
}
