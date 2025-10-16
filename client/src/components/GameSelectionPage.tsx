import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Play, BarChart3, Archive, Settings, HelpCircle, Sliders } from "lucide-react";

interface GameSelectionPageProps {
  onPlayGame: () => void;
}

export function GameSelectionPage({ onPlayGame }: GameSelectionPageProps) {
  const menuItems = [
    { icon: Play, label: "Play", active: true, onClick: onPlayGame, testId: "button-play" },
    { icon: BarChart3, label: "Stats", active: false, testId: "button-stats" },
    { icon: Archive, label: "Play Archive", active: false, testId: "button-archive" },
    { icon: Sliders, label: "Options", active: false, testId: "button-options" },
    { icon: HelpCircle, label: "Help", active: false, testId: "button-help" },
    { icon: Settings, label: "Settings", active: false, testId: "button-settings" },
  ];

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="w-full max-w-lg p-8">
        <h2 className="text-3xl font-semibold text-center mb-8">Elementle</h2>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {menuItems.map((item) => {
            const Icon = item.icon;
            return (
              <Button
                key={item.label}
                variant={item.active ? "default" : "outline"}
                className="h-32 flex flex-col items-center justify-center gap-3"
                onClick={item.onClick}
                disabled={!item.active}
                data-testid={item.testId}
              >
                <Icon className="h-8 w-8" />
                <span className="text-base font-medium">{item.label}</span>
              </Button>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
