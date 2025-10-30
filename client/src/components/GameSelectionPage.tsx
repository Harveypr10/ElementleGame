import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { HelpDialog } from "./HelpDialog";
import { ModeToggle } from "./ModeToggle";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { useGameData } from "@/hooks/useGameData";
import { motion } from "framer-motion";
import { useSwipeable } from "react-swipeable";
import { useModeController } from "@/hooks/useModeController";
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
  todayPuzzleAnswerDateCanonical?: string;
  onPlayGameLocal?: () => void;
  onViewStatsLocal?: () => void;
  onViewArchiveLocal?: () => void;
  onOpenOptionsLocal?: () => void;
}

export function GameSelectionPage({ 
  onPlayGame, 
  onViewStats, 
  onViewArchive, 
  onOpenSettings, 
  onOpenOptions, 
  onLogin, 
  todayPuzzleId, 
  todayPuzzleAnswerDateCanonical,
  onPlayGameLocal,
  onViewStatsLocal,
  onViewArchiveLocal,
  onOpenOptionsLocal,
}: GameSelectionPageProps) {
  const { user, isAuthenticated } = useAuth();
  const { profile } = useProfile();
  const { gameAttempts, loadingAttempts } = useGameData();
  const { formatCanonicalDate } = useUserDateFormat();
  const { containerRef, x, gameMode, snapTo, handleSwiping, handleSwiped, isDesktop } = useModeController();
  const [showHelp, setShowHelp] = useState(false);
  const [todayPuzzleStatus, setTodayPuzzleStatus] = useState<'not-played' | 'solved' | 'failed'>('not-played');
  const [guessCount, setGuessCount] = useState<number>(0);
  const [currentStreak, setCurrentStreak] = useState<number>(0);
  const [percentile, setPercentile] = useState<number | null>(null);
  const playButtonRef = useRef<HTMLButtonElement>(null);

  const isLocalMode = gameMode === 'local';

  // Auto-focus the Play button on mount instead of help icon
  useEffect(() => {
    playButtonRef.current?.focus();
  }, []);

  // Load from cache immediately on mount for instant rendering
  useEffect(() => {
    const cachedOutcome = readLocal<TodayOutcome>(CACHE_KEYS.TODAY_OUTCOME);
    
    if (cachedOutcome) {
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
  }, []);

  // Fetch user stats for streak information
  useEffect(() => {
    if (!isAuthenticated || !user) return;

    const fetchStats = async () => {
      try {
        const supabase = await getSupabaseClient();
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session) return;

        const statsEndpoint = isLocalMode ? '/api/user/stats' : '/api/stats';
        const response = await fetch(statsEndpoint, {
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
  }, [isAuthenticated, user, isLocalMode]);

  // Load percentile from cache first for instant rendering
  useEffect(() => {
    if (!isAuthenticated || todayPuzzleStatus === 'not-played') return;
    
    const cachedPercentile = readLocal<{percentile: number}>(CACHE_KEYS.PERCENTILE);
    if (cachedPercentile && typeof cachedPercentile.percentile === 'number') {
      setPercentile(cachedPercentile.percentile);
    }
  }, []);

  // Fetch percentile ranking if user has played today (background refresh)
  useEffect(() => {
    if (!isAuthenticated || !user || todayPuzzleStatus === 'not-played') return;

    const fetchPercentile = async () => {
      try {
        const supabase = await getSupabaseClient();
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session) return;

        const percentileEndpoint = isLocalMode ? '/api/user/stats/percentile' : '/api/stats/percentile';
        const response = await fetch(percentileEndpoint, {
          credentials: 'include',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
          },
        });
        if (response.ok) {
          const data = await response.json();
          setPercentile(data.percentile);
          writeLocal(CACHE_KEYS.PERCENTILE, data);
        }
      } catch (error) {
        console.error('Error fetching percentile:', error);
      }
    };

    fetchPercentile();
  }, [isAuthenticated, user, todayPuzzleStatus, isLocalMode]);

  // Background reconciliation with Supabase/localStorage
  useEffect(() => {
    if (!todayPuzzleId && !todayPuzzleAnswerDateCanonical) return;

    if (isAuthenticated && gameAttempts && !loadingAttempts) {
      const todayAttempt = gameAttempts.find(attempt => 
        attempt.puzzleId === todayPuzzleId && attempt.result !== null
      );
      
      if (todayAttempt) {
        const isWin = todayAttempt.result === 'won' || todayAttempt.result === 'win';
        const count = todayAttempt.numGuesses ?? 0;
        
        if (isWin) {
          setTodayPuzzleStatus('solved');
          setGuessCount(count);
        } else {
          setTodayPuzzleStatus('failed');
        }
        
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

  const getFormattedDate = () => {
    const today = new Date();
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    
    const dayName = days[today.getDay()];
    const date = today.getDate();
    const month = months[today.getMonth()];
    
    const getOrdinal = (n: number) => {
      const s = ["th", "st", "nd", "rd"];
      const v = n % 100;
      return n + (s[(v - 20) % 10] || s[v] || s[0]);
    };
    
    return `${dayName} ${getOrdinal(date)} ${month}`;
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) return "Good morning";
    if (hour >= 12 && hour < 18) return "Good afternoon";
    return "Good evening";
  };

  const getIntroMessage = () => {
    if (!isAuthenticated) {
      return null;
    }

    if (todayPuzzleStatus === 'not-played') {
      const greeting = getGreeting();
      const streakMessage = currentStreak === 0
        ? "Start your streak with today's puzzle"
        : `Continue your streak of ${currentStreak} ${currentStreak === 1 ? 'day' : 'days'} in a row`;
      
      return { firstLine: greeting, secondLine: streakMessage };
    } else {
      let percentileMessage = "Play the archive to boost your ranking";
      
      if (percentile !== null) {
        const roundedPercentile = Math.floor(percentile / 5) * 5;
        
        if (percentile >= 50) {
          percentileMessage = `You're in the top ${roundedPercentile}% of players - play the archive to boost your ranking`;
        }
      }
      
      return { firstLine: "Welcome back", secondLine: percentileMessage };
    }
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
  const totalGames = gameAttempts?.filter(attempt => attempt.result === "won" || attempt.result === "lost").length || 0;

  const swipeHandlers = useSwipeable({
    onSwiping: (eventData) => handleSwiping(eventData.deltaX),
    onSwiped: () => handleSwiped(),
    trackMouse: true,
    preventScrollOnSwipe: true,
  });

  // Extract ref from swipeHandlers to avoid duplicate ref warning
  const { ref: swipeRef, ...swipeProps } = swipeHandlers;

  // Render Global Pane
  const renderGlobalPane = () => {
    const playContentGlobal = getPlayButtonContent();
    const totalGamesGlobal = gameAttempts?.filter(attempt => attempt.result === "won" || attempt.result === "lost").length || 0;
    const introMessage = getIntroMessage();

    return (
      <div className="w-full flex-shrink-0" style={{ paddingLeft: isDesktop ? 0 : '1rem', paddingRight: isDesktop ? 0 : '1rem' }}>
        <div className="max-w-md mx-auto w-full">
          {/* Desktop: Show "Global" title */}
          {isDesktop && isAuthenticated && (
            <div className="text-center mb-4">
              <h2 className="text-2xl font-bold text-foreground">Global</h2>
            </div>
          )}
          
          {/* Desktop: Show intro message between title and buttons */}
          {isDesktop && isAuthenticated && introMessage && (
            <div className="text-center mb-4 h-16 flex flex-col justify-center" data-testid="intro-message-global">
              <div className="text-xl font-bold text-gray-800 dark:text-gray-200" data-testid="intro-first-line-global">
                {introMessage.firstLine}
              </div>
              <div className="text-base text-gray-600 dark:text-gray-400" data-testid="intro-second-line-global">
                {introMessage.secondLine}
              </div>
            </div>
          )}
          
          {/* Mobile: Show intro message */}
          {!isDesktop && isAuthenticated && introMessage && (
            <div className="text-center mb-6" data-testid="intro-message">
              <div className="text-2xl sm:text-3xl font-bold text-gray-800 dark:text-gray-200 mb-2" data-testid="intro-first-line">
                {introMessage.firstLine}
              </div>
              <div className="text-lg sm:text-xl text-gray-600 dark:text-gray-400" data-testid="intro-second-line">
                {introMessage.secondLine}
              </div>
            </div>
          )}

          <div className="flex flex-col items-stretch space-y-4 mt-1">
            {/* Play Today's Puzzle (Global) */}
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
                  {playContentGlobal.title}
                </span>
                {playContentGlobal.subtitle && (
                  <span className="text-sm font-medium text-gray-700 mt-0.5">
                    {playContentGlobal.subtitle}
                  </span>
                )}
              </div>
              <div className="flex-shrink-0 flex items-center">
                <img
                  src={playContentGlobal.image}
                  alt={playContentGlobal.title}
                  className="max-h-20 w-auto object-contain"
                />
              </div>
            </motion.button>

            {/* Archive (Global) */}
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
                  {totalGamesGlobal} total games played
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

            {/* Mobile only: Global Stats button */}
            {!isDesktop && (
              <motion.button
                className="w-full h-40 flex flex-col items-center justify-center px-4 rounded-3xl shadow-sm hover:shadow-md"
                style={{ backgroundColor: "#A4DB57" }}
                onClick={onViewStats}
                data-testid="button-stats-global"
                layout
                transition={{ duration: 0.3 }}
              >
                <span className="text-xl font-bold text-gray-800 text-center">
                  Global Stats
                </span>
                <img
                  src={mathsHamsterGreen}
                  alt="Global Stats"
                  className="max-h-[72px] w-auto object-contain mt-4"
                />
              </motion.button>
            )}

            {/* Mobile only: Add bottom spacing */}
            {!isDesktop && <div className="h-24" />}
          </div>
        </div>
      </div>
    );
  };

  // Render Local Pane
  const renderLocalPane = () => {
    // Use gameAttempts for now - will fetch correct data based on mode
    const totalGamesLocal = gameAttempts?.filter(attempt => attempt.result === "won" || attempt.result === "lost").length || 0;
    
    // For Local mode, show simpler intro text
    const localIntroMessage = isAuthenticated ? {
      firstLine: "Welcome back",
      secondLine: "Play your local puzzles"
    } : null;

    return (
      <div className="w-full flex-shrink-0" style={{ paddingLeft: isDesktop ? 0 : '1rem', paddingRight: isDesktop ? 0 : '1rem' }}>
        <div className="max-w-md mx-auto w-full">
          {/* Desktop: Show "Local" title */}
          {isDesktop && isAuthenticated && (
            <div className="text-center mb-4">
              <h2 className="text-2xl font-bold text-foreground">Local</h2>
            </div>
          )}
          
          {/* Desktop: Show intro message between title and buttons */}
          {isDesktop && isAuthenticated && localIntroMessage && (
            <div className="text-center mb-4 h-16 flex flex-col justify-center" data-testid="intro-message-local-desktop">
              <div className="text-xl font-bold text-gray-800 dark:text-gray-200" data-testid="intro-first-line-local">
                {localIntroMessage.firstLine}
              </div>
              <div className="text-base text-gray-600 dark:text-gray-400" data-testid="intro-second-line-local">
                {localIntroMessage.secondLine}
              </div>
            </div>
          )}
          
          {/* Mobile: Show intro message */}
          {!isDesktop && isAuthenticated && getIntroMessage() && (
            <div className="text-center mb-6" data-testid="intro-message-local">
              <div className="text-2xl sm:text-3xl font-bold text-gray-800 dark:text-gray-200 mb-2">
                {getIntroMessage()?.firstLine}
              </div>
              <div className="text-lg sm:text-xl text-gray-600 dark:text-gray-400">
                {getIntroMessage()?.secondLine}
              </div>
            </div>
          )}

          <div className="flex flex-col items-stretch space-y-4 mt-1">
            {/* Play Today's Puzzle (Local) */}
            <motion.button
              className="w-full h-32 flex items-center justify-between px-6 rounded-3xl shadow-sm hover:shadow-md"
              style={{ backgroundColor: "#7DAAE8" }}
              onClick={onPlayGameLocal}
              data-testid="button-play-local"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, ease: "easeOut" }}
            >
              <div className="flex flex-col items-start justify-center text-left">
                <span className="text-xl font-bold text-gray-800">
                  Play today's puzzle
                </span>
                <span className="text-sm font-medium text-gray-700 mt-0.5">
                  Local mode
                </span>
              </div>
              <div className="flex-shrink-0 flex items-center">
                <img
                  src={historianHamsterBlue}
                  alt="Play Local Puzzle"
                  className="max-h-20 w-auto object-contain"
                />
              </div>
            </motion.button>

            {/* Archive (Local) */}
            <motion.button
              className="w-full h-24 flex items-center justify-between px-6 rounded-3xl shadow-sm hover:shadow-md"
              style={{ backgroundColor: "#FFD429" }}
              onClick={onViewArchiveLocal}
              data-testid="button-archive-local"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, delay: 0.15, ease: "easeOut" }}
            >
              <div className="flex flex-col items-start justify-center text-left">
                <span className="text-xl font-bold text-gray-800">Archive</span>
                <span className="text-sm font-medium text-gray-700 mt-0.5">
                  {totalGamesLocal} total games played
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

            {/* Mobile only: Local Stats button */}
            {!isDesktop && (
              <motion.button
                className="w-full h-40 flex flex-col items-center justify-center px-4 rounded-3xl shadow-sm hover:shadow-md"
                style={{ backgroundColor: "#A4DB57" }}
                onClick={onViewStatsLocal}
                data-testid="button-stats-local"
                layout
                transition={{ duration: 0.3 }}
              >
                <span className="text-xl font-bold text-gray-800 text-center">
                  Local Stats
                </span>
                <img
                  src={mathsHamsterGreen}
                  alt="Local Stats"
                  className="max-h-[72px] w-auto object-contain mt-4"
                />
              </motion.button>
            )}

            {/* Mobile only: Add bottom spacing */}
            {!isDesktop && <div className="h-24" />}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col min-h-screen overflow-hidden">
      {/* Fixed Header */}
      <div className="flex-shrink-0 p-4">
        <div className="max-w-md mx-auto w-full">
          <div className="flex items-center justify-between mb-2">
            <button
              onClick={() => setShowHelp(true)}
              data-testid="button-help"
              className="w-14 h-14 flex items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              <img src={greyHelpIcon} alt="Help" className="h-9 w-9 block dark:hidden" />
              <img src={whiteHelpIcon} alt="Help" className="h-9 w-9 hidden dark:block" />
            </button>

            <h1 className="text-4xl sm:text-5xl font-bold text-foreground" data-testid="text-title">
              Elementle
            </h1>

            <button
              onClick={onOpenSettings}
              disabled={!onOpenSettings}
              data-testid="button-settings"
              className="w-14 h-14 flex items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors disabled:opacity-50 mr-1"
            >
              <img src={greyCogIcon} alt="Settings" className="h-9 w-9 block dark:hidden" />
              <img src={whiteCogIcon} alt="Settings" className="h-9 w-9 hidden dark:block" />
            </button>
          </div>

          <div className="flex justify-end pr-2 mb-2">
            {!isAuthenticated && (
              <Button variant="ghost" size="sm" onClick={onLogin} data-testid="link-login" className="text-sm">
                Login
              </Button>
            )}
          </div>
          
          {isAuthenticated && (
            <>
              {/* Mobile: Show toggle */}
              {!isDesktop && (
                <div className="flex justify-center mb-4">
                  <ModeToggle onModeChange={(mode) => snapTo(mode)} />
                </div>
              )}
              
              {/* Desktop: Show greeting */}
              {isDesktop && (
                <div className="flex justify-center mb-4">
                  <div className="text-center">
                    <div className="text-xl font-semibold text-foreground">
                      {getGreeting()}
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Sliding Viewport Container */}
      <div className="flex-grow overflow-hidden relative">
        {isDesktop ? (
          /* Desktop: Side-by-side layout centered around middle */
          <div className="h-full w-full flex flex-col">
            {/* Panes Container */}
            <div className="flex-grow flex justify-center gap-2 px-4 overflow-hidden">
              {/* Global Pane */}
              <div className="w-full max-w-md flex flex-col">
                {renderGlobalPane()}
              </div>
              
              {/* Local Pane */}
              <div className="w-full max-w-md flex flex-col">
                {renderLocalPane()}
              </div>
            </div>
            
            {/* Desktop: Three equal-width bottom buttons spanning both panes */}
            {isAuthenticated && (
              <div className="flex-shrink-0 px-4 pb-24">
                <div className="max-w-[calc(2*28rem+0.5rem)] mx-auto flex gap-2">
                  <motion.button
                    className="flex-1 h-40 flex flex-col items-center justify-center px-4 rounded-3xl shadow-sm hover:shadow-md"
                    style={{ backgroundColor: "#A4DB57" }}
                    onClick={onViewStats}
                    data-testid="button-stats-desktop-global"
                    layout
                    transition={{ duration: 0.25 }}
                  >
                    <span className="text-xl font-bold text-gray-800 text-center">
                      Global Stats
                    </span>
                    <img
                      src={mathsHamsterGreen}
                      alt="Global Stats"
                      className="max-h-[72px] w-auto object-contain mt-4"
                    />
                  </motion.button>

                  <motion.button
                    className="flex-1 h-40 flex flex-col items-center justify-center px-4 rounded-3xl shadow-sm hover:shadow-md"
                    style={{ backgroundColor: "#C4C9D4" }}
                    onClick={onOpenOptions}
                    data-testid="button-options-desktop"
                    layout
                    transition={{ duration: 0.25 }}
                  >
                    <span className="text-xl font-bold text-gray-800 text-center">
                      Options
                    </span>
                    <img
                      src={mechanicHamsterGrey}
                      alt="Options"
                      className="max-h-[72px] w-auto object-contain mt-4"
                    />
                  </motion.button>

                  <motion.button
                    className="flex-1 h-40 flex flex-col items-center justify-center px-4 rounded-3xl shadow-sm hover:shadow-md"
                    style={{ backgroundColor: "#A4DB57" }}
                    onClick={onViewStatsLocal}
                    data-testid="button-stats-desktop-local"
                    layout
                    transition={{ duration: 0.25 }}
                  >
                    <span className="text-xl font-bold text-gray-800 text-center">
                      Local Stats
                    </span>
                    <img
                      src={mathsHamsterGreen}
                      alt="Local Stats"
                      className="max-h-[72px] w-auto object-contain mt-4"
                    />
                  </motion.button>
                </div>
              </div>
            )}
          </div>
        ) : (
          /* Mobile: Swipeable panes with fixed Options button */
          <div className="h-full w-full flex flex-col">
            {/* Swipeable Content */}
            <div 
              ref={(node) => {
                // Set containerRef from hook
                if (containerRef && 'current' in containerRef) {
                  (containerRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
                }
                // Set swipeRef
                if (swipeRef) {
                  if (typeof swipeRef === 'function') {
                    swipeRef(node);
                  } else if ('current' in swipeRef) {
                    (swipeRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
                  }
                }
              }}
              className="flex-grow overflow-hidden"
              {...swipeProps}
            >
              <motion.div
                className="flex h-full"
                style={{ 
                  x: x,
                  width: '200%'
                }}
              >
                {/* Global Pane */}
                {renderGlobalPane()}

                {/* Local Pane */}
                {renderLocalPane()}
              </motion.div>
            </div>

            {/* Mobile: Fixed Options button that shifts position */}
            {isAuthenticated && (
              <div className="flex-shrink-0 px-4 pb-24">
                <div className="max-w-md mx-auto">
                  <motion.div 
                    className="flex gap-4"
                    layout
                  >
                    {/* Global mode: Stats on left, Options on right */}
                    {gameMode === 'global' ? (
                      <>
                        <motion.button
                          className="flex-1 h-40 flex flex-col items-center justify-center px-4 rounded-3xl shadow-sm hover:shadow-md"
                          style={{ backgroundColor: "#A4DB57" }}
                          onClick={onViewStats}
                          data-testid="button-stats-mobile-global"
                          layout
                          layoutId="stats-button"
                          transition={{ duration: 0.3 }}
                        >
                          <span className="text-xl font-bold text-gray-800 text-center">
                            Global Stats
                          </span>
                          <img
                            src={mathsHamsterGreen}
                            alt="Global Stats"
                            className="max-h-[72px] w-auto object-contain mt-4"
                          />
                        </motion.button>

                        <motion.button
                          className="flex-1 h-40 flex flex-col items-center justify-center px-4 rounded-3xl shadow-sm hover:shadow-md"
                          style={{ backgroundColor: "#C4C9D4" }}
                          onClick={onOpenOptions}
                          data-testid="button-options-mobile"
                          layout
                          layoutId="options-button"
                          transition={{ duration: 0.3 }}
                        >
                          <span className="text-xl font-bold text-gray-800 text-center">
                            Options
                          </span>
                          <img
                            src={mechanicHamsterGrey}
                            alt="Options"
                            className="max-h-[72px] w-auto object-contain mt-4"
                          />
                        </motion.button>
                      </>
                    ) : (
                      /* Local mode: Options on left, Stats on right */
                      <>
                        <motion.button
                          className="flex-1 h-40 flex flex-col items-center justify-center px-4 rounded-3xl shadow-sm hover:shadow-md"
                          style={{ backgroundColor: "#C4C9D4" }}
                          onClick={onOpenOptionsLocal}
                          data-testid="button-options-mobile"
                          layout
                          layoutId="options-button"
                          transition={{ duration: 0.3 }}
                        >
                          <span className="text-xl font-bold text-gray-800 text-center">
                            Options
                          </span>
                          <img
                            src={mechanicHamsterGrey}
                            alt="Options"
                            className="max-h-[72px] w-auto object-contain mt-4"
                          />
                        </motion.button>

                        <motion.button
                          className="flex-1 h-40 flex flex-col items-center justify-center px-4 rounded-3xl shadow-sm hover:shadow-md"
                          style={{ backgroundColor: "#A4DB57" }}
                          onClick={onViewStatsLocal}
                          data-testid="button-stats-mobile-local"
                          layout
                          layoutId="stats-button"
                          transition={{ duration: 0.3 }}
                        >
                          <span className="text-xl font-bold text-gray-800 text-center">
                            Local Stats
                          </span>
                          <img
                            src={mathsHamsterGreen}
                            alt="Local Stats"
                            className="max-h-[72px] w-auto object-contain mt-4"
                          />
                        </motion.button>
                      </>
                    )}
                  </motion.div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <HelpDialog isOpen={showHelp} onClose={() => setShowHelp(false)} />
    </div>
  );
}
