import { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowLeft, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { useGameData } from "@/hooks/useGameData";
import { readLocal, writeLocal, CACHE_KEYS } from "@/lib/localCache";

interface ArchivePageProps {
  onBack: () => void;
  onPlayPuzzle: (puzzleId: string) => void;
  puzzles: Array<{
    id: number;
    date: string;
    targetDate: string;
    eventTitle: string;
    eventDescription: string;
    clue1?: string;
    clue2?: string;
  }>;
}

interface DayStatus {
  completed: boolean;
  won: boolean;
  guessCount?: number;
  inProgress?: boolean;
}

export function ArchivePage({ onBack, onPlayPuzzle, puzzles }: ArchivePageProps) {
  const { isAuthenticated } = useAuth();
  const { gameAttempts, loadingAttempts } = useGameData();
  const queryClient = useQueryClient();
  const [currentMonth, setCurrentMonth] = useState(new Date(2025, 9, 1)); // October 2025
  const [dayStatuses, setDayStatuses] = useState<Record<string, DayStatus>>({});

  // Explicitly refetch game attempts when Archive mounts
  // Archive is conditionally rendered and unmounts when navigating away,
  // so this effect runs every time user navigates to Archive
  // This ensures in-progress games show updated guess counts after playing
  useEffect(() => {
    if (isAuthenticated) {
      queryClient.refetchQueries({ queryKey: ["/api/game-attempts/user"] });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty array is intentional - runs on mount (which happens on every navigation to Archive)

  // Load from cache first for instant rendering
  useEffect(() => {
    const monthKey = `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, '0')}`;
    const cachedMonthData = readLocal<any>(`${CACHE_KEYS.ARCHIVE_PREFIX}${monthKey}`);
    
    if (cachedMonthData && Array.isArray(cachedMonthData)) {
      // Build status map from cached data
      const statusMap: Record<string, DayStatus> = {};
      
      cachedMonthData.forEach((puzzle: any) => {
        if (puzzle.completed) {
          statusMap[puzzle.targetDate] = {
            completed: true,
            won: puzzle.won || false,
            guessCount: puzzle.guessCount || 0
          };
        }
      });
      
      setDayStatuses(statusMap);
    }
  }, [currentMonth]); // Re-run when month changes

  // Background reconciliation with Supabase/localStorage
  useEffect(() => {
    if (isAuthenticated && gameAttempts && !loadingAttempts) {
      // Use Supabase game attempts ONLY for authenticated users
      const statusMap: Record<string, DayStatus> = {};
      
      puzzles.forEach(puzzle => {
        // Find ANY attempt (including in-progress ones with result=null)
        const attempt = gameAttempts.find(a => a.puzzleId === puzzle.id);
        
        if (attempt) {
          statusMap[puzzle.targetDate] = {
            completed: attempt.result !== null,
            // Defensive normalization: handle both "won"/"lost" and "win"/"loss"
            won: attempt.result === 'won' || attempt.result === 'win',
            guessCount: attempt.numGuesses ?? 0,
            inProgress: attempt.result === null && (attempt.numGuesses ?? 0) > 0
          };
        }
      });
      
      setDayStatuses(statusMap);
      
      // Update cache for current month
      const monthKey = `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, '0')}`;
      const monthPuzzles = puzzles.map(puzzle => ({
        ...puzzle,
        completed: statusMap[puzzle.targetDate]?.completed || false,
        won: statusMap[puzzle.targetDate]?.won || false,
        guessCount: statusMap[puzzle.targetDate]?.guessCount || 0,
      }));
      writeLocal(`${CACHE_KEYS.ARCHIVE_PREFIX}${monthKey}`, monthPuzzles);
    } else if (!isAuthenticated) {
      // Use localStorage for guest users
      const storedStats = localStorage.getItem("elementle-stats");
      const stats = storedStats ? JSON.parse(storedStats) : { puzzleCompletions: {} };
      
      const statusMap: Record<string, DayStatus> = {};
      const completions = stats.puzzleCompletions || {};
      
      puzzles.forEach(puzzle => {
        const completion = completions[puzzle.targetDate];
        
        if (completion) {
          statusMap[puzzle.targetDate] = {
            completed: completion.completed || false,
            won: completion.won || false,
            guessCount: completion.guessCount,
            inProgress: !completion.completed && (completion.guessCount > 0)
          };
        }
      });
      
      setDayStatuses(statusMap);
    }
  }, [isAuthenticated, gameAttempts, puzzles, currentMonth]);

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();
    
    return { daysInMonth, startingDayOfWeek };
  };

  const getPuzzleForDay = (day: number) => {
    const year = currentMonth.getFullYear();
    const month = String(currentMonth.getMonth() + 1).padStart(2, '0');
    const dayStr = String(day).padStart(2, '0');
    const puzzleDate = `${year}-${month}-${dayStr}`;
    
    return puzzles.find(p => p.date === puzzleDate);
  };

  const getDayStatus = (day: number): DayStatus | null => {
    const puzzle = getPuzzleForDay(day);
    if (!puzzle) return null;
    
    return dayStatuses[puzzle.targetDate] || null;
  };

  const renderCalendar = () => {
    const { daysInMonth, startingDayOfWeek } = getDaysInMonth(currentMonth);
    const days = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(<div key={`empty-${i}`} className="aspect-square" />);
    }
    
    for (let day = 1; day <= daysInMonth; day++) {
      const puzzle = getPuzzleForDay(day);
      const status = getDayStatus(day);
      
      const puzzleDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
      puzzleDate.setHours(0, 0, 0, 0);
      const isFuture = puzzleDate > today;
      const isToday = puzzleDate.getTime() === today.getTime();
      const isPlayable = puzzle && !isFuture;
      
      days.push(
        <div
          key={day}
          className={cn(
            "aspect-square p-2 flex flex-col items-center justify-center transition-all min-h-[48px] min-w-[48px] rounded-md",
            isPlayable && "cursor-pointer hover-elevate",
            !isPlayable && "cursor-not-allowed",
            status?.completed && status.won && "bg-green-100 dark:bg-green-900/30",
            status?.completed && !status.won && "bg-red-100 dark:bg-red-900/30",
            status?.inProgress && "bg-blue-100 dark:bg-blue-900/30",
            !status?.completed && !status?.inProgress && isPlayable && "bg-gray-100 dark:bg-gray-800",
            (!puzzle || isFuture) && "bg-background opacity-40",
            isToday && "ring-2 ring-primary"
          )}
          onClick={() => isPlayable && onPlayPuzzle(puzzle.id.toString())}
          data-testid={`calendar-day-${day}`}
        >
          <span className={cn(
            "text-sm font-semibold",
            status?.completed && status.won && "text-green-700 dark:text-green-300",
            status?.completed && !status.won && "text-red-700 dark:text-red-300",
            status?.inProgress && "text-blue-700 dark:text-blue-300",
            !status?.completed && isPlayable && "text-foreground",
            (!puzzle || isFuture) && "text-muted-foreground"
          )}>
            {day}
          </span>
          {status?.completed && (
            <span className="text-xs mt-1 opacity-70">
              {status.won ? `✓ ${status.guessCount}` : '✗'}
            </span>
          )}
          {status?.inProgress && (
            <span className="text-xs mt-1 opacity-70">
              {status.guessCount}
            </span>
          )}
        </div>
      );
    }
    
    return days;
  };

  const monthYear = currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  
  // Determine earliest puzzle month (October 2025)
  const earliestMonth = new Date(2025, 9, 1); // October 2025
  const currentDate = new Date();
  const currentMonthDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
  
  const canGoPrevious = currentMonth > earliestMonth;
  const canGoNext = currentMonth < currentMonthDate;

  return (
    <div className="min-h-screen flex flex-col p-4">
      <div className="flex items-center justify-between mb-8">
        <button
          onClick={onBack}
          data-testid="button-back"
          className="w-14 h-14 flex items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
        >
          <ChevronLeft className="h-10 w-10 text-gray-700" />
        </button>

        <h2 className="text-4xl font-bold">Archive</h2>

        <div className="w-14" />
      </div>

      <div className="flex-1 w-full max-w-[31.5rem] mx-auto">
        <div className="mb-6 flex items-center justify-between">
          <Button
            variant="outline"
            size="icon"
            onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1))}
            disabled={!canGoPrevious}
            data-testid="button-prev-month"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          
          <h3 className="text-xl font-bold" data-testid="text-current-month">{monthYear}</h3>
          
          <Button
            variant="outline"
            size="icon"
            onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1))}
            disabled={!canGoNext}
            data-testid="button-next-month"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        <div className="grid grid-cols-7 gap-2 mb-2">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
            <div key={day} className="text-center text-sm font-semibold text-muted-foreground">
              {day}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-2">
          {renderCalendar()}
        </div>
      </div>
    </div>
  );
}
