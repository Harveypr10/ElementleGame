import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowLeft, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface ArchivePageProps {
  onBack: () => void;
  onPlayPuzzle: (puzzleId: string) => void;
  puzzles: Array<{
    date_id: string;
    target_date: string;
    event_title: string;
    event_description: string;
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
      const completion = completions[puzzle.target_date];
      
      if (completion) {
        statusMap[puzzle.target_date] = {
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
    const month = String(currentMonth.getMonth() + 1).padStart(2, '0');
    const dayStr = String(day).padStart(2, '0');
    const year = String(currentMonth.getFullYear()).slice(-2);
    const targetDate = `${dayStr}${month}${year}`;
    
    return puzzles.find(p => p.target_date === targetDate);
  };

  const getDayStatus = (day: number): DayStatus | null => {
    const month = String(currentMonth.getMonth() + 1).padStart(2, '0');
    const dayStr = String(day).padStart(2, '0');
    const year = String(currentMonth.getFullYear()).slice(-2);
    const targetDate = `${dayStr}${month}${year}`;
    
    return dayStatuses[targetDate] || null;
  };

  const renderCalendar = () => {
    const { daysInMonth, startingDayOfWeek } = getDaysInMonth(currentMonth);
    const days = [];
    
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(<div key={`empty-${i}`} className="aspect-square" />);
    }
    
    for (let day = 1; day <= daysInMonth; day++) {
      const puzzle = getPuzzleForDay(day);
      const status = getDayStatus(day);
      const isToday = day === 16 && currentMonth.getMonth() === 9;
      
      days.push(
        <Card
          key={day}
          className={cn(
            "aspect-square p-2 flex flex-col items-center justify-center cursor-pointer transition-all",
            !puzzle && "opacity-40 cursor-not-allowed",
            puzzle && "hover-elevate",
            status?.completed && status.won && "bg-green-100 dark:bg-green-900/30 border-green-300 dark:border-green-700",
            status?.completed && !status.won && "bg-red-100 dark:bg-red-900/30 border-red-300 dark:border-red-700",
            isToday && "ring-2 ring-primary"
          )}
          onClick={() => puzzle && onPlayPuzzle(puzzle.date_id)}
          data-testid={`calendar-day-${day}`}
        >
          <span className={cn(
            "text-sm font-semibold",
            status?.completed && status.won && "text-green-700 dark:text-green-300",
            status?.completed && !status.won && "text-red-700 dark:text-red-300",
            !status?.completed && puzzle && "text-foreground",
            !puzzle && "text-muted-foreground"
          )}>
            {day}
          </span>
          {status?.completed && (
            <span className="text-xs mt-1 opacity-70">
              {status.won ? `✓ ${status.guessCount}` : '✗'}
            </span>
          )}
        </Card>
      );
    }
    
    return days;
  };

  const monthYear = currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

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

        <h2 className="text-2xl font-semibold">Archive</h2>

        <div className="w-9" />
      </div>

      <div className="flex-1 w-full max-w-2xl mx-auto">
        <div className="mb-6 flex items-center justify-between">
          <Button
            variant="outline"
            size="icon"
            onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1))}
            data-testid="button-prev-month"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          
          <h3 className="text-lg font-semibold" data-testid="text-current-month">{monthYear}</h3>
          
          <Button
            variant="outline"
            size="icon"
            onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1))}
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

        <div className="mt-6 p-4 bg-muted/50 rounded-lg">
          <h4 className="font-semibold mb-3 text-sm">Legend</h4>
          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-green-100 dark:bg-green-900/30 border border-green-300 dark:border-green-700 rounded" />
              <span>Completed (Won)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-700 rounded" />
              <span>Completed (Lost)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-background border rounded" />
              <span>Not Attempted</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 ring-2 ring-primary rounded" />
              <span>Today's Puzzle</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
