import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";
import { BarChart3 } from "lucide-react";

interface StatsPageProps {
  onBack: () => void;
}

interface GameStats {
  played: number;
  won: number;
  currentStreak: number;
  maxStreak: number;
  guessDistribution: Record<number, number>;
}

export function StatsPage({ onBack }: StatsPageProps) {
  const [stats, setStats] = useState<GameStats>({
    played: 0,
    won: 0,
    currentStreak: 0,
    maxStreak: 0,
    guessDistribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
  });

  useEffect(() => {
    const storedStats = localStorage.getItem("elementle-stats");
    if (storedStats) {
      setStats(JSON.parse(storedStats));
    }
  }, []);

  const winPercentage = stats.played > 0 ? Math.round((stats.won / stats.played) * 100) : 0;
  const maxGuesses = Math.max(...Object.values(stats.guessDistribution), 1);

  return (
    <div className="min-h-screen flex flex-col p-4">
      <div className="flex items-center justify-between mb-8">
        <Button
          variant="ghost"
          size="icon"
          onClick={onBack}
          data-testid="button-back"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>

        <h2 className="text-2xl font-semibold">Statistics</h2>

        <div className="w-9" />
      </div>

      <div className="flex-1 flex items-start justify-center">
        <div className="w-full max-w-md space-y-6">
          <div className="grid grid-cols-4 gap-4">
            <Card className="p-4 text-center">
              <div className="text-3xl font-bold" data-testid="stat-played">{stats.played}</div>
              <div className="text-xs text-muted-foreground mt-1">Played</div>
            </Card>
            <Card className="p-4 text-center">
              <div className="text-3xl font-bold" data-testid="stat-win-percentage">{winPercentage}</div>
              <div className="text-xs text-muted-foreground mt-1">Win %</div>
            </Card>
            <Card className="p-4 text-center">
              <div className="text-3xl font-bold" data-testid="stat-current-streak">{stats.currentStreak}</div>
              <div className="text-xs text-muted-foreground mt-1">Current Streak</div>
            </Card>
            <Card className="p-4 text-center">
              <div className="text-3xl font-bold" data-testid="stat-max-streak">{stats.maxStreak}</div>
              <div className="text-xs text-muted-foreground mt-1">Max Streak</div>
            </Card>
          </div>

          <div>
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Guess Distribution
            </h3>
            <div className="space-y-2">
              {[1, 2, 3, 4, 5].map((guessNum) => {
                const count = stats.guessDistribution[guessNum] || 0;
                const percentage = maxGuesses > 0 ? (count / maxGuesses) * 100 : 0;
                
                return (
                  <div key={guessNum} className="flex items-center gap-2">
                    <div className="w-4 text-sm font-medium">{guessNum}</div>
                    <div className="flex-1 bg-muted rounded-sm h-8 relative overflow-hidden">
                      <div
                        className="bg-game-correct h-full transition-all duration-300 flex items-center justify-end pr-2"
                        style={{ width: `${Math.max(percentage, count > 0 ? 10 : 0)}%` }}
                      >
                        {count > 0 && (
                          <span className="text-sm font-medium text-white">{count}</span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {stats.played === 0 && (
            <Card className="p-6 text-center">
              <p className="text-muted-foreground">
                No games played yet. Start playing to see your statistics!
              </p>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
