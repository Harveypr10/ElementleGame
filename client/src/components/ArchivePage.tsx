import { useState, useEffect, useRef, useCallback } from "react";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowLeft, ChevronLeft, ChevronRight, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { useGameData } from "@/hooks/useGameData";
import { useUserDateFormat } from "@/hooks/useUserDateFormat";
import { useGameMode } from "@/contexts/GameModeContext";
import { readLocal, writeLocal, CACHE_KEYS } from "@/lib/localCache";
import { motion, AnimatePresence } from "framer-motion";
import { pageVariants, pageTransition } from "@/lib/pageAnimations";
import { useSwipeable } from "react-swipeable";

interface ArchivePageProps {
  onBack: () => void;
  onPlayPuzzle: (puzzleId: string) => void;
  puzzles: Array<{
    id: number;
    date: string;
    answerDateCanonical: string;
    eventTitle: string;
    eventDescription: string;
    clue1?: string;
    clue2?: string;
  }>;
  initialMonth?: Date | null;
  onMonthChange?: (month: Date) => void;
}

interface DayStatus {
  completed: boolean;
  won: boolean;
  guessCount?: number;
  inProgress?: boolean;
}

export function ArchivePage({ onBack, onPlayPuzzle, puzzles, initialMonth, onMonthChange }: ArchivePageProps) {
  const { isAuthenticated } = useAuth();
  const { gameAttempts, loadingAttempts } = useGameData();
  const { formatCanonicalDate } = useUserDateFormat();
  const { isLocalMode } = useGameMode();
  const queryClient = useQueryClient();
  
  const [currentMonth, setCurrentMonth] = useState(() => {
    if (initialMonth) {
      return new Date(initialMonth);
    }
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [dayStatuses, setDayStatuses] = useState<Record<string, DayStatus>>({});
  const [showMonthPicker, setShowMonthPicker] = useState(false);
  const [swipeOffset, setSwipeOffset] = useState(0);
  const swipeStartX = useRef<number>(0);
  const containerRef = useRef<HTMLDivElement>(null);

  // Refetch game attempts whenever Archive mounts (from any navigation source)
  useEffect(() => {
    if (isAuthenticated) {
      console.log('[Archive] Refetching game attempts on mount');
      const queryKey = isLocalMode ? ["/api/user/game-attempts/user"] : ["/api/game-attempts/user"];
      queryClient.refetchQueries({ queryKey });
    }
  }, [isAuthenticated, isLocalMode, queryClient]);

  // Update month when initialMonth prop changes
  useEffect(() => {
    if (initialMonth) {
      const newMonth = new Date(initialMonth);
      setCurrentMonth(newMonth);
    }
  }, [initialMonth]);

  // Load from cache first for instant rendering
  useEffect(() => {
    const monthKey = `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, '0')}`;
    const cachedMonthData = readLocal<any>(`${CACHE_KEYS.ARCHIVE_PREFIX}${monthKey}`);
    
    if (cachedMonthData && Array.isArray(cachedMonthData)) {
      const statusMap: Record<string, DayStatus> = {};
      cachedMonthData.forEach((puzzle: any) => {
        if (puzzle.completed) {
          statusMap[puzzle.answerDateCanonical] = {
            completed: true,
            won: puzzle.won || false,
            guessCount: puzzle.guessCount || 0
          };
        }
      });
      setDayStatuses(statusMap);
    }
  }, [currentMonth]);

  // Background reconciliation with Supabase/localStorage
  useEffect(() => {
    if (isAuthenticated && gameAttempts && !loadingAttempts) {
      console.log('[Archive] Building status map from gameAttempts:', gameAttempts.length, 'attempts');
      const statusMap: Record<string, DayStatus> = {};

      gameAttempts.forEach(attempt => {
        const puzzle = puzzles.find(p => p.id === attempt.puzzleId);
        if (puzzle) {
          const isCompleted = attempt.result !== null;
          const isWon = attempt.result === "won";
          const isInProgress = attempt.result === null && (attempt.numGuesses ?? 0) > 0;
          
          statusMap[puzzle.answerDateCanonical] = {
            completed: isCompleted,
            won: isWon,
            guessCount: attempt.numGuesses ?? 0,
            inProgress: isInProgress,
          };
        }
      });
      
      setDayStatuses(statusMap);
      
      const monthKey = `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, '0')}`;
      const monthPuzzles = puzzles.map(puzzle => ({
        ...puzzle,
        completed: statusMap[puzzle.answerDateCanonical]?.completed || false,
        won: statusMap[puzzle.answerDateCanonical]?.won || false,
        guessCount: statusMap[puzzle.answerDateCanonical]?.guessCount || 0,
      }));
      writeLocal(`${CACHE_KEYS.ARCHIVE_PREFIX}${monthKey}`, monthPuzzles);
    } else if (!isAuthenticated) {
      const storedStats = localStorage.getItem("elementle-stats");
      const stats = storedStats ? JSON.parse(storedStats) : { puzzleCompletions: {} };
      
      const statusMap: Record<string, DayStatus> = {};
      const completions = stats.puzzleCompletions || {};
      
      puzzles.forEach(puzzle => {
        const formattedAnswer = formatCanonicalDate(puzzle.answerDateCanonical);
        const completion = completions[formattedAnswer];
        
        if (completion) {
          statusMap[puzzle.answerDateCanonical] = {
            completed: completion.completed || false,
            won: completion.won || false,
            guessCount: completion.guessCount,
            inProgress: !completion.completed && (completion.guessCount > 0)
          };
        }
      });
      
      setDayStatuses(statusMap);
    }
  }, [isAuthenticated, gameAttempts, puzzles, currentMonth, loadingAttempts]);

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
    
    return dayStatuses[puzzle.answerDateCanonical] || null;
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
  
  const earliestMonth = (() => {
    if (puzzles.length === 0) {
      return new Date(2025, 9, 1);
    }
    
    const earliestPuzzle = puzzles.reduce((earliest, puzzle) => {
      return puzzle.date < earliest.date ? puzzle : earliest;
    }, puzzles[0]);
    
    const [year, month, day] = earliestPuzzle.date.split('-').map(Number);
    return new Date(year, month - 1, 1);
  })();
  
  const currentDate = new Date();
  const currentMonthDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
  
  const canGoPrevious = currentMonth > earliestMonth;
  const canGoNext = currentMonth < currentMonthDate;

  // Check if a month has available puzzles
  const hasMonthPuzzles = (year: number, month: number) => {
    const monthStr = String(month + 1).padStart(2, '0');
    return puzzles.some(p => p.date.startsWith(`${year}-${monthStr}`));
  };

  // Swipe handlers for calendar with continuous scrolling
  const handleSwipeStart = useCallback(() => {
    swipeStartX.current = swipeOffset;
  }, [swipeOffset]);

  const handleSwiping = useCallback((deltaX: number) => {
    // Allow slight overshoot (50px) on either side but mainly stay in center
    const newOffset = Math.max(-50, Math.min(50, swipeStartX.current + deltaX));
    setSwipeOffset(newOffset);
  }, [swipeOffset]);

  const handleSwiped = useCallback((velocity: number, direction: 'Left' | 'Right') => {
    const threshold = 30;
    const velocityThreshold = 0.5;
    
    let shouldNavigate = false;
    let navigateDirection: 'prev' | 'next' | null = null;
    
    if (Math.abs(velocity) > velocityThreshold) {
      // Flick-based navigation
      if (direction === 'Left' && canGoNext) {
        shouldNavigate = true;
        navigateDirection = 'next';
      } else if (direction === 'Right' && canGoPrevious) {
        shouldNavigate = true;
        navigateDirection = 'prev';
      }
    } else if (Math.abs(swipeOffset) > threshold) {
      // Drag-based navigation
      if (swipeOffset > 0 && canGoPrevious) {
        shouldNavigate = true;
        navigateDirection = 'prev';
      } else if (swipeOffset < 0 && canGoNext) {
        shouldNavigate = true;
        navigateDirection = 'next';
      }
    }
    
    if (shouldNavigate && navigateDirection) {
      if (navigateDirection === 'next') {
        const nextMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1);
        setCurrentMonth(nextMonth);
        onMonthChange?.(nextMonth);
      } else if (navigateDirection === 'prev') {
        const prevMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1);
        setCurrentMonth(prevMonth);
        onMonthChange?.(prevMonth);
      }
    }
    
    // Always snap back to center
    setSwipeOffset(0);
  }, [currentMonth, canGoNext, canGoPrevious, swipeOffset, onMonthChange]);

  const swipeHandlers = useSwipeable({
    onSwipeStart: handleSwipeStart,
    onSwiping: (eventData) => handleSwiping(eventData.deltaX),
    onSwiped: (eventData) => {
      const velocity = eventData.velocity;
      const direction = eventData.dir as 'Left' | 'Right';
      handleSwiped(velocity, direction);
    },
    trackMouse: true,
    preventScrollOnSwipe: true,
  });

  const { ref: swipeRef, ...swipeProps } = swipeHandlers;

  return (
    <motion.div 
      className="min-h-screen flex flex-col p-4"
      initial={pageVariants.fadeIn.initial}
      animate={pageVariants.fadeIn.animate}
      exit={pageVariants.fadeIn.exit}
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

        <h2 className="text-4xl font-bold">Archive</h2>

        <div className="w-14" />
      </div>

      <div className="flex-1 w-full max-w-[31.5rem] mx-auto">
        <div className="mb-6 flex items-center justify-between">
          <Button
            variant="outline"
            size="icon"
            onClick={() => {
              const newMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1);
              setCurrentMonth(newMonth);
              onMonthChange?.(newMonth);
            }}
            disabled={!canGoPrevious}
            data-testid="button-prev-month"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          
          <button
            onClick={() => setShowMonthPicker(true)}
            className="text-xl font-bold hover:opacity-70 transition-opacity cursor-pointer"
            data-testid="button-month-picker"
          >
            {monthYear}
          </button>
          
          <Button
            variant="outline"
            size="icon"
            onClick={() => {
              const newMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1);
              setCurrentMonth(newMonth);
              onMonthChange?.(newMonth);
            }}
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

        <div 
          className="grid grid-cols-7 gap-2"
        >
          {renderCalendar()}
        </div>
      </div>

      {/* Month/Year Picker Modal */}
      <AnimatePresence>
        {showMonthPicker && (
          <motion.div
            className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowMonthPicker(false)}
          >
            <motion.div
              className="bg-white dark:bg-gray-900 rounded-lg p-6 max-w-sm w-full"
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-2xl font-bold">Select Month</h3>
                <button
                  onClick={() => setShowMonthPicker(false)}
                  className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded transition-colors"
                  data-testid="button-close-picker"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="mb-6 flex items-center justify-between">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const newYear = new Date(currentMonth.getFullYear() - 1, currentMonth.getMonth(), 1);
                    setCurrentMonth(newYear);
                    setShowMonthPicker(false);
                    onMonthChange?.(newYear);
                  }}
                  disabled={currentMonth.getFullYear() === earliestMonth.getFullYear()}
                  data-testid="button-prev-year"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>

                <span className="text-lg font-bold" data-testid="text-year">
                  {currentMonth.getFullYear()}
                </span>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const newYear = new Date(currentMonth.getFullYear() + 1, currentMonth.getMonth(), 1);
                    setCurrentMonth(newYear);
                    setShowMonthPicker(false);
                    onMonthChange?.(newYear);
                  }}
                  disabled={currentMonth.getFullYear() === currentMonthDate.getFullYear()}
                  data-testid="button-next-year"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>

              <div className="grid grid-cols-3 gap-2">
                {Array.from({ length: 12 }).map((_, i) => {
                  // Check if this month has data AND is not in the future
                  const hasData = hasMonthPuzzles(currentMonth.getFullYear(), i);
                  const isFutureMonth = currentMonth.getFullYear() === currentDate.getFullYear() && i > currentDate.getMonth();
                  const isSelectable = hasData && !isFutureMonth;
                  const isSelected = i === currentMonth.getMonth();
                  const monthName = new Date(2025, i, 1).toLocaleDateString('en-US', { month: 'short' });

                  return (
                    <button
                      key={i}
                      onClick={() => {
                        if (isSelectable) {
                          const newMonth = new Date(currentMonth.getFullYear(), i, 1);
                          setCurrentMonth(newMonth);
                          setShowMonthPicker(false);
                          onMonthChange?.(newMonth);
                        }
                      }}
                      disabled={!isSelectable}
                      className={cn(
                        "py-2 px-3 rounded-md font-medium transition-colors",
                        isSelectable && "cursor-pointer",
                        !isSelectable && "opacity-40 cursor-not-allowed",
                        isSelected && isSelectable && "bg-primary text-primary-foreground",
                        !isSelected && isSelectable && "bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700",
                      )}
                      data-testid={`button-month-${i}`}
                    >
                      {monthName}
                    </button>
                  );
                })}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
