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
    { image: historianHamster, label: "Play", active: true, onClick: onPlayGame, testId: "button-play" },
    { image: mathHamster, label: "Stats", active: false, testId: "button-stats" },
    { image: archiveHamster, label: "Play Archive", active: false, testId: "button-archive" },
    { image: hamsterLogo, label: "Options", active: false, testId: "button-options" },
  ];

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative">
      <Button
        variant="ghost"
        size="icon"
        className="absolute top-4 left-4"
        data-testid="button-help"
      >
        <HelpCircle className="h-5 w-5" />
      </Button>

      <Button
        variant="ghost"
        size="icon"
        className="absolute top-4 right-4"
        data-testid="button-settings"
      >
        <Settings className="h-5 w-5" />
      </Button>

      <Card className="w-full max-w-md p-8">
        <h2 className="text-3xl font-semibold text-center mb-8">Elementle</h2>
        
        <div className="space-y-3">
          {menuItems.map((item) => (
            <Button
              key={item.label}
              variant={item.active ? "default" : "outline"}
              className="w-full h-16 flex items-center justify-start gap-4 px-6"
              onClick={item.onClick}
              disabled={!item.active}
              data-testid={item.testId}
            >
              <img src={item.image} alt={item.label} className="h-10 w-10" />
              <span className="text-lg font-medium">{item.label}</span>
            </Button>
          ))}
        </div>
      </Card>
    </div>
  );
}
