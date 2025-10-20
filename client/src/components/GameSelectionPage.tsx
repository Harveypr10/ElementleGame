import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { HelpDialog } from "./HelpDialog";
import { useAuth } from "@/hooks/useAuth";
import { motion } from "framer-motion";
import historianHamsterBlue from "@assets/Historian-Hamster-Blue_1760977182002.png";
import librarianHamsterYellow from "@assets/Librarian-Hamster-Yellow_1760977182002.png";
import mathsHamsterGreen from "@assets/Maths-Hamster-Green_1760977182003.png";
import mechanicHamsterGrey from "@assets/Mechanic-Hamster-Grey_1760977182003.png";
import whiteTickBlue from "@assets/White-Tick-Blue_1760977182003.png";
import whiteCrossBlue from "@assets/White-Cross-Blue_1760977182003.png";
import greyHelpWhite from "@assets/Grey-Help-White_1760977262303.png";
import greyCogWhite from "@assets/Grey-Cog-White_1760977262301.png";

interface GameSelectionPageProps {
  onPlayGame: () => void;
  onViewStats: () => void;
  onViewArchive: () => void;
  onOpenSettings?: () => void;
  onOpenOptions?: () => void;
  onLogin?: () => void;
  todayPuzzleTargetDate?: string;
}

export function GameSelectionPage({ onPlayGame, onViewStats, onViewArchive, onOpenSettings, onOpenOptions, onLogin, todayPuzzleTargetDate }: GameSelectionPageProps) {
  const { user, isAuthenticated } = useAuth();
  const [showHelp, setShowHelp] = useState(false);
  const [todayPuzzleStatus, setTodayPuzzleStatus] = useState<'not-played' | 'solved' | 'failed'>('not-played');
  const [guessCount, setGuessCount] = useState<number>(0);

  useEffect(() => {
    if (!todayPuzzleTargetDate) return;

    const storedStats = localStorage.getItem("elementle-stats");
    if (storedStats) {
      const stats = JSON.parse(storedStats);
      const completions = stats.puzzleCompletions || {};
      const completion = completions[todayPuzzleTargetDate];
      
      if (completion) {
        if (completion.won) {
          setTodayPuzzleStatus('solved');
          setGuessCount(completion.guesses);
        } else {
          setTodayPuzzleStatus('failed');
        }
      } else {
        setTodayPuzzleStatus('not-played');
      }
    }
  }, [todayPuzzleTargetDate]);

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
    <div className="min-h-screen flex items-center justify-center p-4 relative">
      <div className="absolute top-4 left-4 right-4">
        <div className="flex items-start justify-between mb-4">
          <button
            onClick={() => setShowHelp(true)}
            data-testid="button-help"
            className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <img src={greyHelpWhite} alt="Help" className="h-6 w-6" />
          </button>

          <h1 className="text-5xl font-bold text-foreground absolute left-1/2 -translate-x-1/2" data-testid="text-title">
            Elementle
          </h1>

          <div className="flex flex-col items-end gap-1">
            <button
              onClick={onOpenSettings}
              disabled={!onOpenSettings}
              data-testid="button-settings"
              className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors disabled:opacity-50"
            >
              <img src={greyCogWhite} alt="Settings" className="h-6 w-6" />
            </button>
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
        </div>
      </div>

      <div className="w-full max-w-md space-y-3 mt-20 px-2">
        {menuItems.map((item, index) => (
          <motion.button
            key={item.title}
            className={`w-full ${item.height} flex items-center justify-between px-6 rounded-3xl transition-all shadow-sm hover:shadow-md active:scale-[0.98]`}
            style={{ backgroundColor: item.bgColor }}
            onClick={item.onClick}
            data-testid={item.testId}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: index * 0.15 }}
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
              <img src={item.image} alt={item.title} className="h-20 w-20 object-contain" />
            </div>
          </motion.button>
        ))}
      </div>

      <HelpDialog isOpen={showHelp} onClose={() => setShowHelp(false)} />
    </div>
  );
}
