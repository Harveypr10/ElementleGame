import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { HelpCircle, Settings } from "lucide-react";
import { HelpDialog } from "./HelpDialog";
import { useAuth } from "@/hooks/useAuth";
import historianHamster from "@assets/generated_images/Historian_hamster_icon_03a0d80a.png";
import mathHamster from "@assets/generated_images/Mathematician_hamster_icon_d981f693.png";
import archiveHamster from "@assets/generated_images/Archive_hamster_icon_bad10861.png";
import hamsterLogo from "@assets/generated_images/Hamster_logo_icon_5c761af3.png";

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
  const [todayCompleted, setTodayCompleted] = useState(false);

  useEffect(() => {
    if (!todayPuzzleTargetDate) return;

    const storedStats = localStorage.getItem("elementle-stats");
    if (storedStats) {
      const stats = JSON.parse(storedStats);
      const completions = stats.puzzleCompletions || {};
      setTodayCompleted(!!completions[todayPuzzleTargetDate]);
    }
  }, [todayPuzzleTargetDate]);

  const menuItems = [
    { 
      image: historianHamster, 
      label: todayCompleted ? "Completed Today!" : "Play", 
      active: !todayCompleted, 
      onClick: onPlayGame, 
      testId: "button-play",
      bgColor: todayCompleted ? "bg-gray-200 dark:bg-gray-700" : "bg-game-correct/20 hover:bg-game-correct/30"
    },
    { 
      image: mathHamster, 
      label: "Stats", 
      active: true, 
      onClick: onViewStats,
      testId: "button-stats",
      bgColor: "bg-game-inSequence/20 hover:bg-game-inSequence/30"
    },
    { 
      image: archiveHamster, 
      label: "Play Archive", 
      active: true, 
      onClick: onViewArchive,
      testId: "button-archive",
      bgColor: "bg-blue-300/20 hover:bg-blue-300/30"
    },
    { 
      image: hamsterLogo, 
      label: "Options", 
      active: true, 
      onClick: onOpenOptions,
      testId: "button-options",
      bgColor: "bg-purple-300/20 hover:bg-purple-300/30"
    },
  ];

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative">
      <div className="absolute top-4 left-4 right-4">
        <div className="flex items-center justify-between mb-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setShowHelp(true)}
            data-testid="button-help"
          >
            <HelpCircle className="h-5 w-5" />
          </Button>

          <h1 className="text-3xl font-bold text-foreground" data-testid="text-title">
            Elementle
          </h1>

          <div className="flex items-center gap-2 flex-wrap justify-end">
            {isAuthenticated && user ? (
              <span className="text-sm font-medium order-2 sm:order-1" data-testid="text-user-name">
                {user.user_metadata?.first_name || "User"}
              </span>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                onClick={onLogin}
                data-testid="link-login"
                className="text-sm order-2 sm:order-1"
              >
                Login
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={onOpenSettings}
              disabled={!onOpenSettings}
              data-testid="button-settings"
              className="order-1 sm:order-2"
            >
              <Settings className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </div>

      <div className="w-full max-w-md space-y-4 mt-20">
        {menuItems.map((item) => (
          <button
            key={item.label}
            className={`w-full h-32 flex items-center rounded-md transition-colors ${item.bgColor} ${!item.active && 'opacity-50'}`}
            onClick={item.onClick}
            disabled={!item.active}
            data-testid={item.testId}
          >
            <div className="w-1/3 flex items-center justify-center">
              <img src={item.image} alt={item.label} className="h-16 w-16 object-contain mix-blend-multiply dark:mix-blend-normal dark:brightness-0 dark:invert" />
            </div>
            <div className="flex-1 flex items-center">
              <span className="text-2xl font-medium">{item.label}</span>
            </div>
          </button>
        ))}
      </div>

      <HelpDialog isOpen={showHelp} onClose={() => setShowHelp(false)} />
    </div>
  );
}
