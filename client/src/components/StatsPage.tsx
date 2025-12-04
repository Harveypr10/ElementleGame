import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ChevronLeft, BarChart3, TrendingUp, Award, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { useUserStats } from "@/hooks/useUserStats";
import { useGameData } from "@/hooks/useGameData";
import { useProfile } from "@/hooks/useProfile";
import { readLocal, writeLocal, CACHE_KEYS } from "@/lib/localCache";
import type { UserProfile } from "@shared/schema";
import { motion } from "framer-motion";
import { pageVariants, pageTransition } from "@/lib/pageAnimations";
import { useAdBannerActive } from "@/components/AdBanner";
import { BadgesRow } from "@/components/badges";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface StatsPageProps {
  onBack: () => void;
  gameType?: 'USER' | 'REGION';
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

export function StatsPage({ onBack, gameType = 'REGION' }: StatsPageProps) {
  const { isAuthenticated } = useAuth();
  const { stats: supabaseStats, isLoading: loadingStats } = useUserStats();
  const { gameAttempts, loadingAttempts } = useGameData();
  const { profile } = useProfile();
  const adBannerActive = useAdBannerActive();

  // Get cached profile for instant display
  const cachedProfile = readLocal<UserProfile>(CACHE_KEYS.PROFILE);
  
  // Determine the title based on gameType
  const title = gameType === 'USER' 
    ? 'Personal Edition'
    : (profile?.region || cachedProfile?.region || 'UK') + ' Edition';
  
  const [stats, setStats] = useState<GameStats>({
    played: 0,
    won: 0,
    currentStreak: 0,
    maxStreak: 0,
    guessDistribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
    puzzleCompletions: {}
  });

  // Load from cache first for instant rendering
  useEffect(() => {
    const cachedStats = readLocal<any>(CACHE_KEYS.STATS);
    if (cachedStats) {
      const dist = cachedStats.guessDistribution as any || {};
      setStats({
        played: cachedStats.gamesPlayed ?? cachedStats.played ?? 0,
        won: cachedStats.gamesWon ?? cachedStats.won ?? 0,
        currentStreak: cachedStats.currentStreak ?? 0,
        maxStreak: cachedStats.maxStreak ?? 0,
        guessDistribution: {
          1: dist["1"] || dist[1] || 0,
          2: dist["2"] || dist[2] || 0,
          3: dist["3"] || dist[3] || 0,
          4: dist["4"] || dist[4] || 0,
          5: dist["5"] || dist[5] || 0,
        },
        puzzleCompletions: cachedStats.puzzleCompletions || {},
      });
    }
  }, []); // Run once on mount

  // Background reconciliation with Supabase/localStorage
  useEffect(() => {
    if (isAuthenticated && supabaseStats) {
      // Use Supabase stats for authenticated users - always show user_stats data
      const dist = supabaseStats.guessDistribution as any || {};
      const newStats = {
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
        // Build puzzle completions from game attempts if available
        puzzleCompletions: gameAttempts ? gameAttempts.reduce((acc, attempt) => {
          if (attempt.result) {
            acc[attempt.puzzleId.toString()] = {
              completed: true,
              // Defensive normalization: handle both "won"/"win"
              won: attempt.result === 'won' || attempt.result === 'win',
              guessCount: attempt.numGuesses ?? 0,
              date: attempt.completedAt?.toString() || attempt.startedAt?.toString() || new Date().toISOString(),
            };
          }
          return acc;
        }, {} as any) : {},
      };
      setStats(newStats);
      
      // Update cache
      writeLocal(CACHE_KEYS.STATS, { ...supabaseStats, puzzleCompletions: newStats.puzzleCompletions });
    } else if (!isAuthenticated) {
      // Use localStorage for guest users
      const storedStats = localStorage.getItem("elementle-stats");
      if (storedStats) {
        setStats(JSON.parse(storedStats));
      }
    }
  }, [isAuthenticated, supabaseStats, gameAttempts]);

  const winPercentage = stats.played > 0 ? Math.round((stats.won / stats.played) * 100) : 0;
  const maxGuesses = Math.max(...Object.values(stats.guessDistribution || {}), 1);
  
  const averageGuesses = stats.won > 0 && stats.guessDistribution
    ? (Object.entries(stats.guessDistribution).reduce((sum, [guesses, count]) => 
        sum + (parseInt(guesses) * count), 0) / stats.won).toFixed(1)
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
    <motion.div 
      className={`min-h-screen flex flex-col p-4 bg-background ${adBannerActive ? 'pb-[50px]' : ''}`}
      initial={pageVariants.slideLeft.initial}
      animate={pageVariants.slideLeft.animate}
      exit={pageVariants.slideLeft.exit}
      transition={pageTransition}
    >
      <div className="flex items-center justify-between mb-8">
        <button
          onClick={onBack}
          data-testid="button-back"
          className="w-14 h-14 flex items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
        >
          <ChevronLeft className="h-10 w-10 text-gray-700" />
        </button>

        <h2 className="text-4xl font-bold">Statistics</h2>

        <div className="w-14" />
      </div>

      <div className="flex-1 flex items-start justify-center pb-8">
        <div className="w-full max-w-md space-y-6">
          <div className="grid grid-cols-2 gap-3">
            {/* Left Box - Full height with Played, Win %, Average Guesses */}
            <Card className="p-4 flex flex-col">
              <div className="font-bold text-sm mb-4">{title}</div>
              <div className="flex-1 flex flex-col justify-between">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Played</span>
                  <span className="text-xl font-bold" data-testid="stat-played">{stats.played}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Win %</span>
                  <span className="text-xl font-bold" data-testid="stat-win-percentage">{winPercentage}%</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Average Guesses</span>
                  <span className="text-xl font-bold" data-testid="stat-avg-guesses">{averageGuesses}</span>
                </div>
              </div>
            </Card>

            {/* Right Column - Two stacked boxes */}
            <div className="flex flex-col gap-3">
              {/* Top Right Box - Streak */}
              <Card className="p-4 flex-1">
                <div className="font-bold text-sm mb-2">Streak</div>
                <div className="flex justify-between items-center mb-1 pr-2">
                  <span className="text-sm text-muted-foreground">Current</span>
                  <span className="text-xl font-bold" data-testid="stat-current-streak">{stats.currentStreak}</span>
                </div>
                <div className="flex justify-between items-center pr-2">
                  <span className="text-sm text-muted-foreground">Best</span>
                  <span className="text-xl font-bold" data-testid="stat-max-streak">{stats.maxStreak}</span>
                </div>
              </Card>

              {/* Bottom Right Box - Percentile Month to Date */}
              <Card className="p-4 flex-1">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <span className="font-bold text-sm">Percentile</span>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help flex-shrink-0" />
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-[200px] text-center">
                      <p>You must have played at least 5 days this month for a percentile to be calculated</p>
                    </TooltipContent>
                  </Tooltip>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground max-w-[50%]">Month to Date</span>
                  <span className="text-xl font-bold" data-testid="stat-percentile-mtd">
                    {(() => {
                      const dayOfMonth = new Date().getDate();
                      const percentile = (supabaseStats as any)?.cumulativeMonthlyPercentile;
                      if (dayOfMonth < 5 || percentile === null || percentile === undefined || percentile <= 0) {
                        return "NA";
                      }
                      const rounded = Math.floor(percentile / 5) * 5;
                      return `Top ${rounded}%`;
                    })()}
                  </span>
                </div>
              </Card>
            </div>
          </div>

          <BadgesRow gameType={gameType} />

          {last30DaysPlayed > 0 && (
            <Card className="p-4 space-y-3">
              <div className="font-bold text-sm mb-2 flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Last 30 Days
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Games Played</span>
                <span className="text-xl font-bold" data-testid="stat-30day-played">{last30DaysPlayed}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Wins</span>
                <span className="text-xl font-bold" data-testid="stat-30day-wins">{last30DaysWins}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Win Rate</span>
                <span className="text-xl font-bold" data-testid="stat-30day-winrate">{last30DaysWinRate}%</span>
              </div>
              
              <div className="pt-3">
                <div className="flex gap-1 h-16 items-end">
                  {last30Days.slice(-14).map((day, i) => (
                    <div
                      key={i}
                      className={cn(
                        "flex-1 rounded-sm transition-all",
                        day.won ? "bg-brand-green" : "bg-brand-purple"
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
          )}

          <Card className="p-4 space-y-3">
            <div className="font-bold text-sm mb-2 flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Guess Distribution
            </div>
            <div className="space-y-2">
              {[1, 2, 3, 4, 5].map((guessNum) => {
                const count = (stats.guessDistribution && stats.guessDistribution[guessNum]) || 0;
                const percentage = maxGuesses > 0 ? (count / maxGuesses) * 100 : 0;
                
                return (
                  <div key={guessNum} className="flex items-center gap-2">
                    <div className="w-4 text-sm font-medium">{guessNum}</div>
                    <div className="flex-1 bg-muted rounded-sm h-8 relative overflow-hidden">
                      <div
                        className="bg-brand-green h-full transition-all duration-300 flex items-center justify-end pr-2"
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
              <div className="flex items-center gap-2">
                <div className="w-4 text-sm font-medium">X</div>
                <div className="flex-1 bg-muted rounded-sm h-8 relative overflow-hidden">
                  <div
                    className="bg-brand-purple h-full transition-all duration-300 flex items-center justify-end pr-2"
                    style={{ width: `${Math.max((stats.played - stats.won) > 0 ? ((stats.played - stats.won) / maxGuesses) * 100 : 0, (stats.played - stats.won) > 0 ? 10 : 0)}%` }}
                    data-testid="dist-bar-lost"
                  >
                    {(stats.played - stats.won) > 0 && (
                      <span className="text-sm font-medium text-white">{stats.played - stats.won}</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </Card>

          {stats.played === 0 && (
            <Card className="p-6 text-center">
              <p className="text-muted-foreground">
                No games played yet. Start playing to see your statistics!
              </p>
            </Card>
          )}
        </div>
      </div>
    </motion.div>
  );
}
