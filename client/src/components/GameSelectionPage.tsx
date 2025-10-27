import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { HelpDialog } from "./HelpDialog";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { useGameData } from "@/hooks/useGameData";
import { motion } from "framer-motion";
import { readLocal, writeLocal, CACHE_KEYS } from "@/lib/localCache";
import { getSupabaseClient } from "@/lib/supabaseClient";
import { useUserDateFormat } from "@/hooks/useUserDateFormat";
import historianHamsterBlue from "@assets/Historian-Hamster-Blue.svg";
import librarianHamsterYellow from "@assets/Librarian-Hamster-Yellow.svg";
import mathsHamsterGreen from "@assets/Maths-Hamster-Green.svg";
import mechanicHamsterGrey from "@assets/Mechanic-Hamster-Grey.svg";
import whiteTickBlue from "@assets/Win-Hamster-Blue.svg";
import whiteCrossBlue from "@assets/Lost-Hamster-Blue.svg";
import greyHelpIcon from "@assets/Grey-Help-Grey_1760979822771.png";
import greyCogIcon from "@assets/Grey-Cog-Grey_1760979822772.png";
import whiteHelpIcon from "@assets/White-Help-DarkMode.svg";
import whiteCogIcon from "@assets/White-Cog-DarkMode.svg";

interface TodayOutcome {
  date: string;
  puzzleId?: number;
  isWin: boolean;
  guessCount: number;
}

interface GameSelectionPageProps {
  onPlayGame: () => void;
  onViewStats: () => void;
  onViewArchive: () => void;
  onOpenSettings?: () => void;
  onOpenOptions?: () => void;
  onLogin?: () => void;
  todayPuzzleId?: number;
  todayPuzzleAnswerDateCanonical?: string; // YYYY-MM-DD format - the canonical date
}

export function GameSelectionPage({ onPlayGame, onViewStats, onViewArchive, onOpenSettings, onOpenOptions, onLogin, todayPuzzleId, todayPuzzleAnswerDateCanonical }: GameSelectionPageProps) {
  const { user, isAuthenticated } = useAuth();
  const { profile } = useProfile();
  const { gameAttempts, loadingAttempts } = useGameData();
  const { formatCanonicalDate } = useUserDateFormat();
  const [showHelp, setShowHelp] = useState(false);
  const [todayPuzzleStatus, setTodayPuzzleStatus] = useState<'not-played' | 'solved' | 'failed'>('not-played');
  const [guessCount, setGuessCount] = useState<number>(0);
  const [currentStreak, setCurrentStreak] = useState<number>(0);
  const [percentile, setPercentile] = useState<number | null>(null);
  const playButtonRef = useRef<HTMLButtonElement>(null);

  // Auto-focus the Play button on mount instead of help icon
  useEffect(() => {
    playButtonRef.current?.focus();
  }, []);

  // Load from cache immediately on mount for instant rendering
  useEffect(() => {
    const cachedOutcome = readLocal<TodayOutcome>(CACHE_KEYS.TODAY_OUTCOME);
    
    if (cachedOutcome) {
      // Check if cache is for today's puzzle
      const isCacheForToday = cachedOutcome.puzzleId === todayPuzzleId || 
                              cachedOutcome.date === todayPuzzleAnswerDateCanonical;
      
      if (isCacheForToday) {
        if (cachedOutcome.isWin) {
          setTodayPuzzleStatus('solved');
          setGuessCount(cachedOutcome.guessCount);
        } else {
          setTodayPuzzleStatus('failed');
        }
      }
    }
  }, []); // Run once on mount for instant rendering

  // Fetch user stats for streak information
  useEffect(() => {
    if (!isAuthenticated || !user) return;

    const fetchStats = async () => {
      try {
        // Get Supabase session for auth header
        const supabase = await getSupabaseClient();
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session) return;

        const response = await fetch('/api/stats', {
          credentials: 'include',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
          },
        });
        if (response.ok) {
          const stats = await response.json();
          setCurrentStreak(stats.currentStreak || 0);
        }
      } catch (error) {
        console.error('Error fetching stats:', error);
      }
    };

    fetchStats();
  }, [isAuthenticated, user]);

  // Load percentile from cache first for instant rendering
  useEffect(() => {
    if (!isAuthenticated || todayPuzzleStatus === 'not-played') return;
    
    const cachedPercentile = readLocal<{percentile: number}>(CACHE_KEYS.PERCENTILE);
    if (cachedPercentile && typeof cachedPercentile.percentile === 'number') {
      setPercentile(cachedPercentile.percentile);
    }
  }, []); // Run once on mount for instant rendering

  // Fetch percentile ranking if user has played today (background refresh)
  useEffect(() => {
    if (!isAuthenticated || !user || todayPuzzleStatus === 'not-played') return;

    const fetchPercentile = async () => {
      try {
        // Get Supabase session for auth header
        const supabase = await getSupabaseClient();
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session) return;

        const response = await fetch('/api/stats/percentile', {
          credentials: 'include',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
          },
        });
        if (response.ok) {
          const data = await response.json();
          setPercentile(data.percentile);
          // Update cache with fresh data
          writeLocal(CACHE_KEYS.PERCENTILE, data);
        }
      } catch (error) {
        console.error('Error fetching percentile:', error);
      }
    };

    fetchPercentile();
  }, [isAuthenticated, user, todayPuzzleStatus]);

  // Background reconciliation with Supabase/localStorage
  useEffect(() => {
    if (!todayPuzzleId && !todayPuzzleAnswerDateCanonical) return;

    if (isAuthenticated && gameAttempts && !loadingAttempts) {
      // Use Supabase game attempts ONLY for authenticated users
      const todayAttempt = gameAttempts.find(attempt => 
        attempt.puzzleId === todayPuzzleId && attempt.result !== null
      );
      
      if (todayAttempt) {
        // Defensive normalization: handle both "won"/"lost" and "win"/"loss"
        const isWin = todayAttempt.result === 'won' || todayAttempt.result === 'win';
        const count = todayAttempt.numGuesses ?? 0;
        
        if (isWin) {
          setTodayPuzzleStatus('solved');
          setGuessCount(count);
        } else {
          setTodayPuzzleStatus('failed');
        }
        
        // Update cache with fresh data from Supabase
        writeLocal(CACHE_KEYS.TODAY_OUTCOME, {
          date: todayPuzzleAnswerDateCanonical || '',
          puzzleId: todayPuzzleId,
          isWin,
          guessCount: count,
        });
      } else {
        setTodayPuzzleStatus('not-played');
      }
    } else if (!isAuthenticated && todayPuzzleAnswerDateCanonical) {
      // Use localStorage ONLY for guest users
      // IMPORTANT: Use formatted date as key (matches PlayPage localStorage keys)
      const formattedAnswer = formatCanonicalDate(todayPuzzleAnswerDateCanonical);
      const storedStats = localStorage.getItem("elementle-stats");
      if (storedStats) {
        const stats = JSON.parse(storedStats);
        const completions = stats.puzzleCompletions || {};
        const completion = completions[formattedAnswer];
        
        if (completion && completion.completed) {
          const count = Array.isArray(completion.guesses) ? completion.guesses.length : completion.guesses;
          
          if (completion.won) {
            setTodayPuzzleStatus('solved');
            setGuessCount(count);
          } else {
            setTodayPuzzleStatus('failed');
          }
          
          // Update cache with fresh data from localStorage
          writeLocal(CACHE_KEYS.TODAY_OUTCOME, {
            date: todayPuzzleAnswerDateCanonical,
            isWin: completion.won,
            guessCount: count,
          });
        } else {
          setTodayPuzzleStatus('not-played');
        }
      }
    }
  }, [isAuthenticated, gameAttempts, loadingAttempts, todayPuzzleId, todayPuzzleAnswerDateCanonical]);

   // Format today's date as "Monday 20th Oct"
  const getFormattedDate = () => {
    const today = new Date();
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    
    const dayName = days[today.getDay()];
    const date = today.getDate();
    const month = months[today.getMonth()];
    
    // Add ordinal suffix
    const getOrdinal = (n: number) => {
      const s = ["th", "st", "nd", "rd"];
      const v = n % 100;
      return n + (s[(v - 20) % 10] || s[v] || s[0]);
    };
    
    return `${dayName} ${getOrdinal(date)} ${month}`;
  };

  // Get time-based greeting
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) return "Good morning";
    if (hour >= 12 && hour < 18) return "Good afternoon";
    return "Good evening";
  };

  // Get intro message based on play status
  const getIntroMessage = () => {
    if (!isAuthenticated) {
      return null; // No message for guests
    }

    if (todayPuzzleStatus === 'not-played') {
      // User hasn't played today
      const greeting = getGreeting();
      const streakMessage = currentStreak === 0
        ? "Start your streak with today's puzzle"
        : `Continue your streak of ${currentStreak} ${currentStreak === 1 ? 'day' : 'days'} in a row`;
      
      return { firstLine: greeting, secondLine: streakMessage };
    } else {
      // User has played today
      let percentileMessage = "Play the archive to boost your ranking";
      
      if (percentile !== null) {
        // Round down to nearest 5%
        const roundedPercentile = Math.floor(percentile / 5) * 5;
        
        // Show percentage only if 50th percentile or above
        if (percentile >= 50) {
          percentileMessage = `You're in the top ${roundedPercentile}% of players - play the archive to boost your ranking`;
        }
        // Below 50th percentile: use the default message
      }
      
      return { firstLine: "Welcome back", secondLine: percentileMessage };
    }
  };

  // Render intro message block
  const renderIntroMessage = () => {
    const intro = getIntroMessage();
    if (!intro) return null;
    return (
      <div className="text-center mb-4">
        <p className="text-lg font-bold text-gray-800">{intro.firstLine}</p>
        <p className="text-sm text-gray-600">{intro.secondLine}</p>
      </div>
    );
  };

  const getPlayButtonContent = () => {
    switch (todayPuzzleStatus) {
      case 'solved':
        return {
          title: "Today's puzzle solved!",
          subtitle: `Solved in ${guessCount} ${guessCount === 1 ? 'guess' : 'guesses'}`,
          image: whiteTickBlue
        };
      case 'failed':
        return {
          title: "Better luck tomorrow...",
          subtitle: "",
          image: whiteCrossBlue
        };
      default:
        return {
          title: "Play today's puzzle",
          subtitle: getFormattedDate(),
          image: historianHamsterBlue
        };
    }
  };


  const playContent = getPlayButtonContent();

  const totalGames = gameAttempts?.length || 0;

  const menuItems = [
    { 
      title: playContent.title,
      subtitle: playContent.subtitle,
      image: playContent.image,
      bgColor: "#7DAAE8",
      onClick: onPlayGame, 
      testId: "button-play",
      height: "h-32", // Taller play button
      disabled: false
    },
    {
      title: "Archive",
      subtitle: `${totalGames} total games played`,
      image: librarianHamsterYellow,
      bgColor: "#FFD429",
      onClick: onViewArchive,
      testId: "button-archive",
      height: "h-24",
      disabled: false
    },
    { 
      title: "Stats",
      subtitle: "",
      image: mathsHamsterGreen,
      bgColor: "#A4DB57",
      onClick: onViewStats,
      testId: "button-stats",
      height: "h-24",
      disabled: false
    },
    { 
      title: "Options",
      subtitle: "",
      image: mechanicHamsterGrey,
      bgColor: "#C4C9D4",
      onClick: onOpenOptions,
      testId: "button-options",
      height: "h-24",
      disabled: false
    },
  ];

return (
  <div className="flex flex-col min-h-screen p-4">
    {/* Header stays at the top */}
    <div className="max-w-md mx-auto w-full">
      <div className="flex items-center justify-between mb-2">
        {/* Help button with dark mode swap */}
        <button
          onClick={() => setShowHelp(true)}
          data-testid="button-help"
          className="w-14 h-14 flex items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
        >
          <img
            src={greyHelpIcon}
            alt="Help"
            className="h-9 w-9 block dark:hidden"
          />
          <img
            src={whiteHelpIcon}
            alt="Help"
            className="h-9 w-9 hidden dark:block"
          />
        </button>

        {/* Title */}
        <h1
          className="text-4xl sm:text-5xl font-bold text-foreground"
          data-testid="text-title"
        >
          Elementle
        </h1>

        {/* Settings button with dark mode swap */}
        <button
          onClick={onOpenSettings}
          disabled={!onOpenSettings}
          data-testid="button-settings"
          className="w-14 h-14 flex items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors disabled:opacity-50 mr-1"
        >
          <img
            src={greyCogIcon}
            alt="Settings"
            className="h-9 w-9 block dark:hidden"
          />
          <img
            src={whiteCogIcon}
            alt="Settings"
            className="h-9 w-9 hidden dark:block"
          />
        </button>
      </div>

      <div className="flex justify-end pr-2 mb-4">
        {!isAuthenticated && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onLogin}
            data-testid="link-login"
            className="text-sm"
          >
            Login
          </Button>
        )}
      </div>
    </div>

    {/* Main content flexes vertically */}
    <div className="flex-grow flex flex-col justify-center">
      {/* Intro message now appears above the buttons */}
      {(() => {
        const introMessage = getIntroMessage();
        if (!introMessage) return null;
        return (
          <div
            className="text-center mb-6"
            data-testid="intro-message"
          >
            <div
              className="text-2xl sm:text-3xl font-bold text-gray-800 dark:text-gray-200 mb-2"
              data-testid="intro-first-line"
            >
              {introMessage.firstLine}
            </div>
            <div
              className="text-lg sm:text-xl text-gray-600 dark:text-gray-400"
              data-testid="intro-second-line"
            >
              {introMessage.secondLine}
            </div>
          </div>
        );
      })()}

      {/* Group: buttons + invisible spacer */}
      <div className="max-w-md mx-auto w-full flex flex-col items-stretch space-y-4 mt-1">
        {/* Play button */}
        <motion.button
          ref={playButtonRef}
          className="w-full h-32 flex items-center justify-between px-6 rounded-3xl shadow-sm hover:shadow-md"
          style={{ backgroundColor: "#7DAAE8" }}
          onClick={onPlayGame}
          data-testid="button-play"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, ease: "easeOut" }}
        >
          <div className="flex flex-col items-start justify-center text-left">
            <span className="text-xl font-bold text-gray-800">
              {playContent.title}
            </span>
            {playContent.subtitle && (
              <span className="text-sm font-medium text-gray-700 mt-0.5">
                {playContent.subtitle}
              </span>
            )}
          </div>
          <div className="flex-shrink-0 flex items-center">
            <img
              src={playContent.image}
              alt={playContent.title}
              className="max-h-20 w-auto object-contain"
            />
          </div>
        </motion.button>

    {/* Archive button */}
    <motion.button
      className="w-full h-24 flex items-center justify-between px-6 rounded-3xl shadow-sm hover:shadow-md"
      style={{ backgroundColor: "#FFD429" }}
      onClick={onViewArchive}
      data-testid="button-archive"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: 0.15, ease: "easeOut" }}
    >
      <div className="flex flex-col items-start justify-center text-left">
        <span className="text-xl font-bold text-gray-800">Archive</span>
        <span className="text-sm font-medium text-gray-700 mt-0.5">
          {totalGames} total games played
        </span>
      </div>
      <div className="flex-shrink-0 flex items-center">
        <img
          src={librarianHamsterYellow}
          alt="Archive"
          className="max-h-20 w-auto object-contain"
        />
      </div>
    </motion.button>

    {/* Stats + Options row */}
    <div className="flex space-x-4">
      {[
        {
          title: "Stats",
          image: mathsHamsterGreen,
          bgColor: "#A4DB57",
          onClick: onViewStats,
          testId: "button-stats",
        },
        {
          title: "Options",
          image: mechanicHamsterGrey,
          bgColor: "#C4C9D4",
          onClick: onOpenOptions,
          testId: "button-options",
        },
      ].map((item, index) => (
        <motion.button
          key={item.testId}
          className="flex-1 h-40 flex flex-col items-center justify-center px-4 rounded-3xl shadow-sm hover:shadow-md"
          style={{ backgroundColor: item.bgColor }}
          onClick={item.onClick}
          data-testid={item.testId}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            duration: 0.25,
            delay: 0.3 + index * 0.15,
            ease: "easeOut",
          }}
        >
          <span className="text-xl font-bold text-gray-800 text-center">
            {item.title}
          </span>
          <img
            src={item.image}
            alt={item.title}
            className="max-h-[72px] w-auto object-contain mt-4"
          />
        </motion.button>
      ))}
    </div>

    {/* Invisible spacer to push buttons upward on tall screens */}
    <div className="h-24" />
  </div>
</div>

<HelpDialog isOpen={showHelp} onClose={() => setShowHelp(false)} />
</div>
);
}







