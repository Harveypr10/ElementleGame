import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowLeft, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

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
}

export function ArchivePage({ onBack, onPlayPuzzle, puzzles }: ArchivePageProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date(2025, 9, 1)); // October 2025
  const [dayStatuses, setDayStatuses] = useState<Record<string, DayStatus>>({});

  useEffect(() => {
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
          guessCount: completion.guessCount
        };
      }
    });
    
    setDayStatuses(statusMap);
  }, [puzzles]);

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
            !status?.completed && isPlayable && "bg-gray-100 dark:bg-gray-800",
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
          <ArrowLeft className="h-9 w-9" />
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
