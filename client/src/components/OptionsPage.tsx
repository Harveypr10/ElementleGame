import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { ChevronLeft } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

interface OptionsPageProps {
  onBack: () => void;
}

export function OptionsPage({ onBack }: OptionsPageProps) {
  const { isAuthenticated } = useAuth();
  const [textSize, setTextSize] = useState<"small" | "medium" | "large">("medium");
  const [soundsEnabled, setSoundsEnabled] = useState(true);
  const [darkMode, setDarkMode] = useState(false);
  const [cluesEnabled, setCluesEnabled] = useState(true);

  useEffect(() => {
    const storedTheme = localStorage.getItem("theme");
    setDarkMode(storedTheme === "dark");
    
    const storedTextSize = localStorage.getItem("textSize") as "small" | "medium" | "large" | null;
    if (storedTextSize) {
      setTextSize(storedTextSize);
      document.documentElement.style.setProperty(
        "--text-scale",
        storedTextSize === "small" ? "0.875" : storedTextSize === "large" ? "1.125" : "1"
      );
    }
    
    const storedSounds = localStorage.getItem("soundsEnabled");
    if (storedSounds !== null) setSoundsEnabled(storedSounds === "true");
    
    const storedClues = localStorage.getItem("cluesEnabled");
    if (storedClues !== null) setCluesEnabled(storedClues === "true");
  }, []);

  const handleTextSizeChange = (size: "small" | "medium" | "large") => {
    setTextSize(size);
    localStorage.setItem("textSize", size);
    document.documentElement.style.setProperty(
      "--text-scale",
      size === "small" ? "0.875" : size === "large" ? "1.125" : "1"
    );
  };

  const handleDarkModeToggle = (checked: boolean) => {
    setDarkMode(checked);
    const newTheme = checked ? "dark" : "light";
    localStorage.setItem("theme", newTheme);
    document.documentElement.classList.toggle("dark", checked);
  };

  const handleSoundsToggle = (checked: boolean) => {
    setSoundsEnabled(checked);
    localStorage.setItem("soundsEnabled", String(checked));
  };

  const handleCluesToggle = (checked: boolean) => {
    setCluesEnabled(checked);
    localStorage.setItem("cluesEnabled", String(checked));
  };

  return (
    <div className="min-h-screen flex flex-col p-4">
      <div className="w-full max-w-md mx-auto space-y-4">
        <div className="flex items-center gap-2 mb-6">
          <Button
            variant="ghost"
            size="icon"
            onClick={onBack}
            data-testid="button-back-from-options"
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-2xl font-bold">Options</h1>
        </div>

        <Card className="p-6 space-y-6">
          <div className="space-y-4">
            <Label className="text-base font-semibold">Text Size</Label>
            <div className="flex gap-2">
              {(["small", "medium", "large"] as const).map((size) => (
                <Button
                  key={size}
                  variant={textSize === size ? "default" : "outline"}
                  onClick={() => handleTextSizeChange(size)}
                  className="flex-1"
                  data-testid={`button-text-size-${size}`}
                >
                  {size.charAt(0).toUpperCase() + size.slice(1)}
                </Button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="sounds" className="text-base">
                Sounds
              </Label>
              <p className="text-sm text-muted-foreground">
                Play sound effects
              </p>
            </div>
            <Switch
              id="sounds"
              checked={soundsEnabled}
              onCheckedChange={handleSoundsToggle}
              data-testid="switch-sounds"
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="darkMode" className="text-base">
                Dark Mode
              </Label>
              <p className="text-sm text-muted-foreground">
                Toggle dark theme
              </p>
            </div>
            <Switch
              id="darkMode"
              checked={darkMode}
              onCheckedChange={handleDarkModeToggle}
              data-testid="switch-dark-mode"
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="clues" className="text-base">
                Clues
              </Label>
              <p className="text-sm text-muted-foreground">
                Show hints after wrong guesses
              </p>
            </div>
            <Switch
              id="clues"
              checked={cluesEnabled}
              onCheckedChange={handleCluesToggle}
              data-testid="switch-clues"
            />
          </div>
        </Card>

        {!isAuthenticated && (
          <p className="text-sm text-muted-foreground text-center">
            Sign in to sync your settings across devices
          </p>
        )}
      </div>
    </div>
  );
}
