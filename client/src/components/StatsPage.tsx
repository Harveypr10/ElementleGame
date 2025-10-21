import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowLeft, BarChart3, TrendingUp, Award } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { useUserStats } from "@/hooks/useUserStats";
import { useGameData } from "@/hooks/useGameData";

interface StatsPageProps {
  onBack: () => void;
}

interface GameStats {
  played: number;
  won: number;
  currentStreak: number;
  maxStreak: number;
  guessDistribution: Record<number, number>;
  puzzleCompletions?: Record<string, {
    completed: boolean;
    won: boolean;
    guessCount: number;
    date: string;
  }>;
}

export function StatsPage({ onBack }: StatsPageProps) {
  const { isAuthenticated } = useAuth();
  const { stats: supabaseStats, isLoading: loadingStats } = useUserStats();
  const { gameAttempts, loadingAttempts } = useGameData();
  
  const [stats, setStats] = useState<GameStats>({
    played: 0,
    won: 0,
    currentStreak: 0,
    maxStreak: 0,
    guessDistribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
    puzzleCompletions: {}
  });

  useEffect(() => {
    if (isAuthenticated && supabaseStats && gameAttempts) {
      // Use Supabase stats for authenticated users
      const dist = supabaseStats.guessDistribution as any || {};
      setStats({
        played: supabaseStats.gamesPlayed ?? 0,
        won: supabaseStats.gamesWon ?? 0,
        currentStreak: supabaseStats.currentStreak ?? 0,
        maxStreak: supabaseStats.maxStreak ?? 0,
        guessDistribution: {
          1: dist["1"] || 0,
          2: dist["2"] || 0,
          3: dist["3"] || 0,
          4: dist["4"] || 0,
          5: dist["5"] || 0,
        },
        puzzleCompletions: gameAttempts.reduce((acc, attempt) => {
          if (attempt.result) {
            acc[attempt.puzzleId.toString()] = {
              completed: true,
              // Defensive normalization: handle both "won"/"win"
              won: attempt.result === 'won' || attempt.result === 'win',
              guessCount: attempt.numGuesses ?? 0,
              date: attempt.completedAt?.toString() || new Date().toISOString(),
            };
          }
          return acc;
        }, {} as any),
      });
    } else if (!isAuthenticated) {
      // Use localStorage for guest users
      const storedStats = localStorage.getItem("elementle-stats");
      if (storedStats) {
        setStats(JSON.parse(storedStats));
      }
    }
  }, [isAuthenticated, supabaseStats, gameAttempts]);

  const winPercentage = stats.played > 0 ? Math.round((stats.won / stats.played) * 100) : 0;
  const maxGuesses = Math.max(...Object.values(stats.guessDistribution), 1);
  
  const averageGuesses = stats.won > 0
    ? (Object.entries(stats.guessDistribution).reduce((sum, [guesses, count]) => 
        sum + (parseInt(guesses) * count), 0) / stats.won).toFixed(2)
    : "0";

  const getLast30DaysData = () => {
    const completions = stats.puzzleCompletions || {};
    const today = new Date();
    const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
    
    const recentCompletions = Object.entries(completions)
      .map(([key, value]) => ({ ...value, key, date: new Date(value.date) }))
      .filter(c => c.date >= thirtyDaysAgo)
      .sort((a, b) => a.date.getTime() - b.date.getTime())
      .slice(-30);
    
    return recentCompletions;
  };

  const last30Days = getLast30DaysData();
  const last30DaysWins = last30Days.filter(d => d.won).length;
  const last30DaysPlayed = last30Days.length;
  const last30DaysWinRate = last30DaysPlayed > 0 
    ? Math.round((last30DaysWins / last30DaysPlayed) * 100) 
    : 0;

  return (
    <div className="min-h-screen flex flex-col p-4">
      <div className="flex items-center justify-between mb-8">
        <button
          onClick={onBack}
          data-testid="button-back"
          className="w-14 h-14 flex items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
        >
          <ArrowLeft className="h-9 w-9" />
        </button>

        <h2 className="text-4xl font-bold">Statistics</h2>

        <div className="w-14" />
      </div>

      <div className="flex-1 flex items-start justify-center pb-8">
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
              <div className="text-xs text-muted-foreground mt-1">Current</div>
            </Card>
            <Card className="p-4 text-center">
              <div className="text-3xl font-bold" data-testid="stat-max-streak">{stats.maxStreak}</div>
              <div className="text-xs text-muted-foreground mt-1">Best</div>
            </Card>
          </div>

          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-muted-foreground">Average Guesses</div>
                <div className="text-2xl font-bold" data-testid="stat-avg-guesses">{averageGuesses}</div>
              </div>
              <Award className="h-8 w-8 text-muted-foreground" />
            </div>
          </Card>

          {last30DaysPlayed > 0 && (
            <div>
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Last 30 Days
              </h3>
              <Card className="p-4 space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Games Played</span>
                  <span className="font-semibold" data-testid="stat-30day-played">{last30DaysPlayed}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Wins</span>
                  <span className="font-semibold" data-testid="stat-30day-wins">{last30DaysWins}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Win Rate</span>
                  <span className="font-semibold" data-testid="stat-30day-winrate">{last30DaysWinRate}%</span>
                </div>
                
                <div className="pt-3">
                  <div className="flex gap-1 h-16 items-end">
                    {last30Days.slice(-14).map((day, i) => (
                      <div
                        key={i}
                        className={cn(
                          "flex-1 rounded-sm transition-all",
                          day.won ? "bg-green-500" : "bg-red-500"
                        )}
                        style={{ height: `${(day.guessCount / 5) * 100}%` }}
                        title={`${day.won ? 'Won' : 'Lost'} in ${day.guessCount} guesses`}
                        data-testid={`chart-bar-${i}`}
                      />
                    ))}
                  </div>
                  <div className="text-xs text-center text-muted-foreground mt-2">
                    Last 14 games (height = guesses)
                  </div>
                </div>
              </Card>
            </div>
          )}

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
                        data-testid={`dist-bar-${guessNum}`}
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
