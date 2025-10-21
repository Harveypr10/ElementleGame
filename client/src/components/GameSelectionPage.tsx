import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { HelpDialog } from "./HelpDialog";
import { useAuth } from "@/hooks/useAuth";
import { useGameData } from "@/hooks/useGameData";
import { motion } from "framer-motion";
import historianHamsterBlue from "@assets/Historian-Hamster-Blue.svg";
import librarianHamsterYellow from "@assets/Librarian-Hamster-Yellow.svg";
import mathsHamsterGreen from "@assets/Maths-Hamster-Green.svg";
import mechanicHamsterGrey from "@assets/Mechanic-Hamster-Grey.svg";
import whiteTickBlue from "@assets/White-Tick-Blue.svg";
import whiteCrossBlue from "@assets/White-Cross-Blue.svg";
import greyHelpIcon from "@assets/Grey-Help-Grey_1760979822771.png";
import greyCogIcon from "@assets/Grey-Cog-Grey_1760979822772.png";

interface GameSelectionPageProps {
  onPlayGame: () => void;
  onViewStats: () => void;
  onViewArchive: () => void;
  onOpenSettings?: () => void;
  onOpenOptions?: () => void;
  onLogin?: () => void;
  todayPuzzleId?: number;
  todayPuzzleTargetDate?: string;
}

export function GameSelectionPage({ onPlayGame, onViewStats, onViewArchive, onOpenSettings, onOpenOptions, onLogin, todayPuzzleId, todayPuzzleTargetDate }: GameSelectionPageProps) {
  const { user, isAuthenticated } = useAuth();
  const { gameAttempts, loadingAttempts } = useGameData();
  const [showHelp, setShowHelp] = useState(false);
  const [todayPuzzleStatus, setTodayPuzzleStatus] = useState<'not-played' | 'solved' | 'failed'>('not-played');
  const [guessCount, setGuessCount] = useState<number>(0);

  useEffect(() => {
    if (!todayPuzzleId && !todayPuzzleTargetDate) return;

    if (isAuthenticated && gameAttempts && !loadingAttempts) {
      // Use Supabase game attempts ONLY for authenticated users
      const todayAttempt = gameAttempts.find(attempt => 
        attempt.puzzleId === todayPuzzleId && attempt.result !== null
      );
      
      if (todayAttempt) {
        // Defensive normalization: handle both "won"/"lost" and "win"/"loss"
        const isWin = todayAttempt.result === 'won' || todayAttempt.result === 'win';
        if (isWin) {
          setTodayPuzzleStatus('solved');
          setGuessCount(todayAttempt.numGuesses ?? 0);
        } else {
          setTodayPuzzleStatus('failed');
        }
      } else {
        setTodayPuzzleStatus('not-played');
      }
    } else if (!isAuthenticated && todayPuzzleTargetDate) {
      // Use localStorage ONLY for guest users
      const storedStats = localStorage.getItem("elementle-stats");
      if (storedStats) {
        const stats = JSON.parse(storedStats);
        const completions = stats.puzzleCompletions || {};
        const completion = completions[todayPuzzleTargetDate];
        
        if (completion && completion.completed) {
          if (completion.won) {
            setTodayPuzzleStatus('solved');
            const count = Array.isArray(completion.guesses) ? completion.guesses.length : completion.guesses;
            setGuessCount(count);
          } else {
            setTodayPuzzleStatus('failed');
          }
        } else {
          setTodayPuzzleStatus('not-played');
        }
      }
    }
  }, [isAuthenticated, gameAttempts, loadingAttempts, todayPuzzleId, todayPuzzleTargetDate]);

  // Format today's date as "Monday 20th Oct"
  const getFormattedDate = () => {
    const today = new Date();
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    
    const dayName = days[today.getDay()];
    const date = today.getDate();
    const month = months[today.getMonth()];
    
    // Add ordinal suffix
    const getOrdinal = (n: number) => {
      const s = ["th", "st", "nd", "rd"];
      const v = n % 100;
      return n + (s[(v - 20) % 10] || s[v] || s[0]);
    };
    
    return `${dayName} ${getOrdinal(date)} ${month}`;
  };

  const getPlayButtonContent = () => {
    switch (todayPuzzleStatus) {
      case 'solved':
        return {
          title: "Today's puzzle solved!",
          subtitle: `${guessCount} ${guessCount === 1 ? 'guess' : 'guesses'}`,
          image: whiteTickBlue
        };
      case 'failed':
        return {
          title: "Better luck tomorrow...",
          subtitle: "",
          image: whiteCrossBlue
        };
      default:
        return {
          title: "Play today's puzzle",
          subtitle: getFormattedDate(),
          image: historianHamsterBlue
        };
    }
  };

  const playContent = getPlayButtonContent();

  const menuItems = [
    { 
      title: playContent.title,
      subtitle: playContent.subtitle,
      image: playContent.image,
      bgColor: "#7DAAE8",
      onClick: onPlayGame, 
      testId: "button-play",
      height: "h-32" // Taller play button
    },
    { 
      title: "Archive",
      subtitle: "",
      image: librarianHamsterYellow,
      bgColor: "#FFD429",
      onClick: onViewArchive,
      testId: "button-archive",
      height: "h-[89px]" // 30% shorter than 128px = ~89px
    },
    { 
      title: "Stats",
      subtitle: "",
      image: mathsHamsterGreen,
      bgColor: "#A4DB57",
      onClick: onViewStats,
      testId: "button-stats",
      height: "h-[89px]"
    },
    { 
      title: "Options",
      subtitle: "",
      image: mechanicHamsterGrey,
      bgColor: "#C4C9D4",
      onClick: onOpenOptions,
      testId: "button-options",
      height: "h-[89px]"
    },
  ];

  return (
    <div className="min-h-screen p-4">
      <div className="max-w-md mx-auto">
        <div className="flex items-center justify-between mb-2">
          <button
            onClick={() => setShowHelp(true)}
            data-testid="button-help"
            className="w-14 h-14 flex items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <img src={greyHelpIcon} alt="Help" className="h-9 w-9" />
          </button>

          <h1 className="text-5xl font-bold text-foreground" data-testid="text-title">
            Elementle
          </h1>

          <button
            onClick={onOpenSettings}
            disabled={!onOpenSettings}
            data-testid="button-settings"
            className="w-14 h-14 flex items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors disabled:opacity-50 mr-1"
          >
            <img src={greyCogIcon} alt="Settings" className="h-9 w-9" />
          </button>
        </div>
        
        <div className="flex justify-end pr-2 mb-16">
          {isAuthenticated && user ? (
            <span className="text-sm font-medium" data-testid="text-user-name">
              {user.user_metadata?.first_name || "User"}
            </span>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              onClick={onLogin}
              data-testid="link-login"
              className="text-sm"
            >
              Login
            </Button>
          )}
        </div>

        <div className="w-full space-y-3">
        {menuItems.map((item, index) => (
          <motion.button
            key={item.testId}
            className={`w-full ${item.height} flex items-center justify-between px-6 rounded-3xl shadow-sm hover:shadow-md`}
            style={{ backgroundColor: item.bgColor }}
            onClick={item.onClick}
            data-testid={item.testId}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ 
              duration: 0.25,
              delay: index * 0.15,
              ease: "easeOut"
            }}
          >
            <div className="flex flex-col items-start justify-center text-left">
              <span className="text-xl font-bold text-gray-800" data-testid={`text-${item.testId}-title`}>
                {item.title}
              </span>
              {item.subtitle && (
                <span className="text-sm font-medium text-gray-700 mt-0.5" data-testid={`text-${item.testId}-subtitle`}>
                  {item.subtitle}
                </span>
              )}
            </div>
            <div className="flex-shrink-0">
              <img src={item.image} alt={item.title} className="h-18 w-18 object-contain" />
            </div>
          </motion.button>
        ))}
        </div>
      </div>

      <HelpDialog isOpen={showHelp} onClose={() => setShowHelp(false)} />
    </div>
  );
}
