import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { HelpCircle, Settings } from "lucide-react";
import historianHamster from "@assets/generated_images/Historian_hamster_icon_03a0d80a.png";
import mathHamster from "@assets/generated_images/Mathematician_hamster_icon_d981f693.png";
import archiveHamster from "@assets/generated_images/Archive_hamster_icon_bad10861.png";
import hamsterLogo from "@assets/generated_images/Hamster_logo_icon_5c761af3.png";

interface GameSelectionPageProps {
  onPlayGame: () => void;
}

export function GameSelectionPage({ onPlayGame }: GameSelectionPageProps) {
  const menuItems = [
    { 
      image: historianHamster, 
      label: "Play", 
      active: true, 
      onClick: onPlayGame, 
      testId: "button-play",
      bgColor: "bg-game-correct/20 hover:bg-game-correct/30 border-game-correct/30"
    },
    { 
      image: mathHamster, 
      label: "Stats", 
      active: false, 
      testId: "button-stats",
      bgColor: "bg-game-inSequence/20 hover:bg-game-inSequence/30 border-game-inSequence/30"
    },
    { 
      image: archiveHamster, 
      label: "Play Archive", 
      active: false, 
      testId: "button-archive",
      bgColor: "bg-blue-300/20 hover:bg-blue-300/30 border-blue-300/30"
    },
    { 
      image: hamsterLogo, 
      label: "Options", 
      active: false, 
      testId: "button-options",
      bgColor: "bg-purple-300/20 hover:bg-purple-300/30 border-purple-300/30"
    },
  ];

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative">
      <div className="absolute top-4 left-4 right-4 flex items-center justify-between">
        <Button
          variant="ghost"
          size="icon"
          data-testid="button-help"
        >
          <HelpCircle className="h-5 w-5" />
        </Button>

        <h2 className="text-2xl font-semibold">Elementle</h2>

        <Button
          variant="ghost"
          size="icon"
          data-testid="button-settings"
        >
          <Settings className="h-5 w-5" />
        </Button>
      </div>

      <div className="w-full max-w-md space-y-4 mt-16">
        {menuItems.map((item) => (
          <button
            key={item.label}
            className={`w-full h-32 flex items-center justify-center gap-6 px-8 rounded-md border-2 transition-colors ${item.bgColor} ${!item.active && 'opacity-50'}`}
            onClick={item.onClick}
            disabled={!item.active}
            data-testid={item.testId}
          >
            <img src={item.image} alt={item.label} className="h-16 w-16 object-contain mix-blend-multiply dark:mix-blend-normal dark:brightness-0 dark:invert" />
            <span className="text-2xl font-medium">{item.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
