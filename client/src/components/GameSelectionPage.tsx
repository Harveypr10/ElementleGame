import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { HelpDialog } from "./HelpDialog";
import { ModeToggle } from "./ModeToggle";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { useGameData } from "@/hooks/useGameData";
import { motion, useTransform } from "framer-motion";
import { useSwipeable } from "react-swipeable";
import { useModeController } from "@/hooks/useModeController";
import { readLocal, writeLocal, CACHE_KEYS } from "@/lib/localCache";
import { getSupabaseClient } from "@/lib/supabaseClient";
import { useUserDateFormat } from "@/hooks/useUserDateFormat";
import { useQuery } from "@tanstack/react-query";
import historianHamsterBlue from "@assets/Historian-Hamster-Blue.svg";
import historianHamsterLocal from "@assets/Historian-Hamster-Local.svg";
import librarianHamsterYellow from "@assets/Librarian-Hamster-Yellow.svg";
import librarianHamsterLocal from "@assets/Librarian-Hamster-Local.svg";
import mathsHamsterGreen from "@assets/Maths-Hamster-Green.svg";
import mathsHamsterLocal from "@assets/Maths-Hamster-Local.svg";
import mechanicHamsterGrey from "@assets/Mechanic-Hamster-Grey.svg";
import winhamsterblue from "@assets/Win-Hamster-Blue.svg";
import winhamsterlocal from "@assets/Win-Hamster-Local.svg";
import losthamsterblue from "@assets/Lost-Hamster-Blue.svg";
import losthamsterlocal from "@assets/Lost-Hamster-Local.svg";
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
  const { containerRef, x, gameMode, snapTo, handleSwipeStart, handleSwiping, handleSwiped, isDesktop } = useModeController();
  const [showHelp, setShowHelp] = useState(false);
  const isLocalMode = gameMode === 'local';

  // Transform for Options button - moves based on content width, not viewport
  // Track both container width (for swipe input range) and content width (for movement limit)
  const [containerWidth, setContainerWidth] = useState(0);
  const [contentWidth, setContentWidth] = useState(0);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const updateWidth = () => {
      if (containerRef.current) {
        setContainerWidth(containerRef.current.offsetWidth);
      }
      if (contentRef.current) {
        setContentWidth(contentRef.current.offsetWidth);
      }
    };
    updateWidth();
    window.addEventListener('resize', updateWidth);
    return () => window.removeEventListener('resize', updateWidth);
  }, [containerRef]);

  // Options button moves to stay aligned with content area
  // Movement is based on content width (max-w-md), not full container width
  // This prevents the button from going past the left edge of content on wider screens
  const buttonX = useTransform(
    x,
    [0, -Math.max(containerWidth, 1)],
    [0, -Math.max(contentWidth, 1) / 2 + 4], // Move by half content width (button is half-width, moves from right to center-left)
    { clamp: true }
  );

  // Authenticated fetch helper
  const fetchAuthenticated = async (endpoint: string) => {
    if (!isAuthenticated) return null;
    const supabase = await getSupabaseClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return null;

    const response = await fetch(endpoint, {
      credentials: 'include',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
      },
    });
    if (!response.ok) throw new Error(`Failed to fetch ${endpoint}`);
    return response.json();
  };

  // Fetch Global game attempts (always from region data)
  const { data: globalGameAttempts = [] } = useQuery<any[]>({
    queryKey: ['/api/game-attempts/user'],
    queryFn: () => fetchAuthenticated('/api/game-attempts/user'),
    enabled: isAuthenticated,
  });

  // Fetch Local game attempts (always from user data)
  const { data: localGameAttempts = [] } = useQuery<any[]>({
    queryKey: ['/api/user/game-attempts/user'],
    queryFn: () => fetchAuthenticated('/api/user/game-attempts/user'),
    enabled: isAuthenticated,
  });

  // Fetch Global stats
  const { data: globalStats } = useQuery<any>({
    queryKey: ['/api/stats'],
    queryFn: () => fetchAuthenticated('/api/stats'),
    enabled: isAuthenticated,
  });

  // Fetch Local stats  
  const { data: localStats } = useQuery<any>({
    queryKey: ['/api/user/stats'],
    queryFn: () => fetchAuthenticated('/api/user/stats'),
    enabled: isAuthenticated,
  });

  // Fetch Global percentile (always enabled when authenticated)
  const { data: globalPercentileData } = useQuery<any>({
    queryKey: ['/api/stats/percentile'],
    queryFn: () => fetchAuthenticated('/api/stats/percentile'),
    enabled: isAuthenticated,
  });

  // Fetch Local percentile (always enabled when authenticated)
  const { data: localPercentileData } = useQuery<any>({
    queryKey: ['/api/user/stats/percentile'],
    queryFn: () => fetchAuthenticated('/api/user/stats/percentile'),
    enabled: isAuthenticated,
  });

  // Helper function to compute play button status for a given set of attempts
  const computePlayButtonStatus = (attempts: any[], puzzleId?: number) => {
    if (!isAuthenticated || !puzzleId || !attempts) {
      return { status: 'not-played' as const, count: 0 };
    }

    const todayAttempt = attempts.find(attempt => 
      attempt.puzzleId === puzzleId && attempt.result !== null
    );

    if (todayAttempt) {
      const isWin = todayAttempt.result === 'won' || todayAttempt.result === 'win';
      const count = todayAttempt.numGuesses ?? 0;

      return {
        status: (isWin ? 'solved' : 'failed') as 'solved' | 'failed',
        count
      };
    }

    return { status: 'not-played' as const, count: 0 };
  };

  // NOTE: Old shared state effects removed - each pane now independently fetches and computes its own data

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

  // Track the locked direction for the current swipe gesture using a ref for synchronous updates
  const swipeDirectionRef = useRef<'horizontal' | 'vertical' | null>(null);

  const swipeHandlers = useSwipeable({
    onSwipeStart: () => {
      handleSwipeStart();
      swipeDirectionRef.current = null; // Reset direction lock at start of each gesture
    },
    onSwiping: (eventData) => {
      // Determine and lock direction on first significant movement
      if (swipeDirectionRef.current === null) {
        const absX = Math.abs(eventData.deltaX);
        const absY = Math.abs(eventData.deltaY);
        
        // Only lock direction if there's meaningful movement (threshold of 10px)
        if (absX > 10 || absY > 10) {
          swipeDirectionRef.current = absX > absY ? 'horizontal' : 'vertical';
        }
      }

      // Only apply horizontal movement if locked to horizontal
      if (swipeDirectionRef.current === 'horizontal') {
        handleSwiping(eventData.deltaX);
      }
      // Vertical scrolling happens naturally when direction is vertical or null
    },
    onSwiped: (eventData) => {
      const velocity = eventData.velocity;
      const direction = eventData.dir as 'Left' | 'Right' | 'Up' | 'Down';
      
      // Only handle horizontal swipes for pane switching
      if (swipeDirectionRef.current === 'horizontal' && (direction === 'Left' || direction === 'Right')) {
        handleSwiped(velocity, direction);
      }
      
      // Reset direction lock
      swipeDirectionRef.current = null;
    },
    trackMouse: true,
    preventScrollOnSwipe: false, // Allow vertical scrolling
  });

  // Extract ref from swipeHandlers to avoid duplicate ref warning
  const { ref: swipeRef, ...swipeProps} = swipeHandlers;

  // Render Global Pane
  const renderGlobalPane = () => {
    // Compute Global-specific data
    const globalPlayStatus = computePlayButtonStatus(globalGameAttempts, todayPuzzleId);
    const totalGamesGlobal = globalGameAttempts.filter(attempt => attempt.result === "won" || attempt.result === "lost").length;
    const globalStreak = globalStats?.currentStreak || 0;
    const globalPercentile = globalPercentileData?.percentile ?? null;

    // Compute Global intro message
    let globalIntroMessage = null;
    if (isAuthenticated) {
      if (globalPlayStatus.status === 'not-played') {
        const greeting = getGreeting();
        const streakMessage = globalStreak === 0
          ? "Start your streak with today's puzzle"
          : `Continue your streak of ${globalStreak} ${globalStreak === 1 ? 'day' : 'days'} in a row`;
        globalIntroMessage = { firstLine: greeting, secondLine: streakMessage };
      } else {
        let percentileMessage = "Play the archive to boost your ranking";
        if (globalPercentile !== null) {
          const roundedPercentile = Math.floor(globalPercentile / 5) * 5;
          if (globalPercentile >= 50) {
            percentileMessage = `You're in the top ${roundedPercentile}% of players - play the archive to boost your ranking`;
          }
        }
        globalIntroMessage = { firstLine: "Welcome back", secondLine: percentileMessage };
      }
    }

    // Compute Global play button content
    let playContentGlobal;
    switch (globalPlayStatus.status) {
      case 'solved':
        playContentGlobal = {
          title: "Today's puzzle solved!",
          subtitle: `Solved in ${globalPlayStatus.count} ${globalPlayStatus.count === 1 ? 'guess' : 'guesses'}`,
          image: winhamsterblue
        };
        break;
      case 'failed':
        playContentGlobal = {
          title: "Better luck tomorrow...",
          subtitle: "",
          image: losthamsterblue
        };
        break;
      default:
        playContentGlobal = {
          title: "Play today's puzzle",
          subtitle: getFormattedDate(),
          image: historianHamsterBlue
        };
    }

    return (
      <div className={isDesktop ? "w-full flex-shrink-0" : "w-1/2 flex-shrink-0"} style={{ paddingLeft: isDesktop ? 0 : '1rem', paddingRight: isDesktop ? 0 : '1rem' }}>
        <div className="max-w-md mx-auto w-full">
          {/* Desktop: Show "Global" title */}
          {isDesktop && isAuthenticated && (
            <div className="text-center mb-4">
              <h2 className="text-2xl font-bold text-foreground font-bold">Global</h2>
            </div>
          )}

          {/* Desktop: Show only secondary message (no "Welcome back") */}
          {isDesktop && isAuthenticated && globalIntroMessage && (
            <div className="text-center mb-4 h-16 flex flex-col justify-center" data-testid="intro-message-global">
              <div className="text-base text-gray-600 dark:text-gray-400" data-testid="intro-second-line-global">
                {globalIntroMessage.secondLine}
              </div>
            </div>
          )}

          {/* Mobile: Show only secondary message with fixed height (first line is in fixed header) */}
          {!isDesktop && isAuthenticated && globalIntroMessage && (
            <div className="text-center mt-2 mb-3 h-[3rem] flex items-center justify-center" data-testid="intro-message">
              <div className="text-lg sm:text-xl text-gray-600 dark:text-gray-400 line-clamp-2" data-testid="intro-second-line">
                {globalIntroMessage.secondLine}
              </div>
            </div>
          )}

          <div className="flex flex-col items-stretch space-y-4 mt-1">
            {/* Play Today's Puzzle (Global) */}
            <motion.button
              className="w-full h-32 flex items-center justify-between px-6 rounded-3xl shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ backgroundColor: "#7DAAE8", touchAction: 'pan-y' }}
              onClick={onPlayGame}
              disabled={!todayPuzzleId}
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
              style={{ backgroundColor: "#FFD429", touchAction: 'pan-y' }}
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

            {/* Mobile only: Stats row - contains Global Stats button */}
            {!isDesktop && (
              <div className="relative h-40">
                {/* Global Stats button */}
                <motion.button
                  className="absolute left-0 h-40 w-[calc(50%-0.5rem)] flex flex-col items-center justify-center px-4 rounded-3xl shadow-sm hover:shadow-md"
                  style={{ backgroundColor: "#A4DB57", touchAction: 'pan-y' }}
                  onClick={onViewStats}
                  data-testid="button-stats-global"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25, delay: 0.3, ease: "easeOut" }}
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
              </div>
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
    // Compute Local-specific data
    const localPlayStatus = computePlayButtonStatus(localGameAttempts, todayPuzzleId);
    const totalGamesLocal = localGameAttempts.filter(attempt => attempt.result === "won" || attempt.result === "lost").length;
    const localStreak = localStats?.currentStreak || 0;
    const localPercentile = localPercentileData?.percentile ?? null;

    // Compute Local intro message
    let localIntroMessage = null;
    if (isAuthenticated) {
      if (localPlayStatus.status === 'not-played') {
        const greeting = getGreeting();
        const streakMessage = localStreak === 0
          ? "Start your streak with today's puzzle"
          : `Continue your streak of ${localStreak} ${localStreak === 1 ? 'day' : 'days'} in a row`;
        localIntroMessage = { firstLine: greeting, secondLine: streakMessage };
      } else {
        localIntroMessage = { 
          firstLine: "Welcome back", 
          secondLine: "Play your local puzzles" 
        };
      }
    }

    // Compute Local play button content
    let playContentLocal;
    switch (localPlayStatus.status) {
      case 'solved':
        playContentLocal = {
          title: "Today's puzzle solved!",
          subtitle: `Solved in ${localPlayStatus.count} ${localPlayStatus.count === 1 ? 'guess' : 'guesses'}`,
          image: winhamsterlocal
        };
        break;
      case 'failed':
        playContentLocal = {
          title: "Better luck tomorrow...",
          subtitle: "",
          image: losthamsterlocal
        };
        break;
      default:
        playContentLocal = {
          title: "Play today's puzzle",
          subtitle: getFormattedDate(),
          image: historianHamsterLocal
        };
    }

    return (
      <div className={isDesktop ? "w-full flex-shrink-0" : "w-1/2 flex-shrink-0"} style={{ paddingLeft: isDesktop ? 0 : '1rem', paddingRight: isDesktop ? 0 : '1rem' }}>
        <div className="max-w-md mx-auto w-full">
          {/* Desktop: Show "Local" title */}
          {isDesktop && isAuthenticated && (
            <div className="text-center mb-4">
              <h2 className="text-2xl font-bold text-foreground font-bold">Local</h2>
            </div>
          )}

          {/* Desktop: Show only secondary message (no "Welcome back") */}
          {isDesktop && isAuthenticated && localIntroMessage && (
            <div className="text-center mb-4 h-16 flex flex-col justify-center" data-testid="intro-message-local-desktop">
              <div className="text-base text-gray-600 dark:text-gray-400" data-testid="intro-second-line-local">
                {localIntroMessage.secondLine}
              </div>
            </div>
          )}

          {/* Mobile: Show only secondary message with fixed height (first line is in fixed header) */}
          {!isDesktop && isAuthenticated && localIntroMessage && (
            <div className="text-center mt-2 mb-3 h-[3rem] flex items-center justify-center" data-testid="intro-message-local">
              <div className="text-lg sm:text-xl text-gray-600 dark:text-gray-400 line-clamp-2">
                {localIntroMessage.secondLine}
              </div>
            </div>
          )}

          <div className="flex flex-col items-stretch space-y-4 mt-1">
            {/* Play Today's Puzzle (Local) */}
            <motion.button
              className="w-full h-32 flex items-center justify-between px-6 rounded-3xl shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ backgroundColor: "#66becb", touchAction: 'pan-y' }}
              onClick={onPlayGameLocal}
              disabled={!todayPuzzleId}
              data-testid="button-play-local"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, ease: "easeOut" }}
            >
              <div className="flex flex-col items-start justify-center text-left">
                <span className="text-xl font-bold text-gray-800">
                  {playContentLocal.title}
                </span>
                {playContentLocal.subtitle && (
                  <span className="text-sm font-medium text-gray-700 mt-0.5">
                    {playContentLocal.subtitle}
                  </span>
                )}
              </div>
              <div className="flex-shrink-0 flex items-center">
                <img
                  src={playContentLocal.image}
                  alt={playContentLocal.title}
                  className="max-h-20 w-auto object-contain"
                />
              </div>
            </motion.button>

            {/* Archive (Local) */}
            <motion.button
              className="w-full h-24 flex items-center justify-between px-6 rounded-3xl shadow-sm hover:shadow-md"
              style={{ backgroundColor: "#fdab58", touchAction: 'pan-y' }}
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
                  src={librarianHamsterLocal}
                  alt="Archive"
                  className="max-h-20 w-auto object-contain"
                />
              </div>
            </motion.button>

            {/* Mobile only: Stats row - contains Local Stats button (Options is in Global pane) */}
            {!isDesktop && (
              <div className="relative h-40">
                {/* Local Stats button */}
                <motion.button
                  className="absolute right-0 h-40 w-[calc(50%-0.5rem)] flex flex-col items-center justify-center px-4 rounded-3xl shadow-sm hover:shadow-md"
                  style={{ backgroundColor: "#93cd78", touchAction: 'pan-y' }}
                  onClick={onViewStatsLocal}
                  data-testid="button-stats-local"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25, delay: 0.3, ease: "easeOut" }}
                >
                  <span className="text-xl font-bold text-gray-800 text-center">
                    Local Stats
                  </span>
                  <img
                    src={mathsHamsterLocal}
                    alt="Local Stats"
                    className="max-h-[72px] w-auto object-contain mt-4"
                  />
                </motion.button>
              </div>
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
      {/* Mobile: Fixed Header with dynamic greeting text */}
      {!isDesktop ? (
        <div className="fixed top-0 left-0 right-0 z-50 bg-background">
          <div className="p-3 pb-2">
            <div className="max-w-md mx-auto w-full">
              <div className="flex items-center justify-between mb-1">
                <button
                  onClick={() => setShowHelp(true)}
                  data-testid="button-help"
                  className="w-14 h-14 flex items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                >
                  <img src={greyHelpIcon} alt="Help" className="h-9 w-9 block dark:hidden" />
                  <img src={whiteHelpIcon} alt="Help" className="h-9 w-9 hidden dark:block" />
                </button>

                <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 dark:text-gray-100" data-testid="text-title">
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

              <div className="flex justify-end pr-2 mb-1">
                {!isAuthenticated && (
                  <Button variant="ghost" size="sm" onClick={onLogin} data-testid="link-login" className="text-sm">
                    Login
                  </Button>
                )}
              </div>

              {isAuthenticated && (
                <>
                  <div className="flex justify-center mb-1">
                    <ModeToggle onModeChange={(mode) => snapTo(mode)} />
                  </div>
                  <div className="text-center mb-1">
                    <div className="text-2xl sm:text-3xl font-bold text-gray-800 dark:text-gray-200" data-testid="intro-first-line-fixed">
                      {getGreeting()}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      ) : (
        /* Desktop: Header (not fixed) */
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

              <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 dark:text-gray-100" data-testid="text-title">
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
              <div className="flex justify-center mb-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-foreground">
                    {getGreeting()}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Sliding Viewport Container */}
      <div className={`flex-grow overflow-hidden relative ${!isDesktop ? 'pt-[160px]' : ''}`} style={{minHeight: !isDesktop ? '100vh' : 'auto'}}>
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
              <div className="flex-shrink-0 px-4 pb-24 mt-4">
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
                    style={{ backgroundColor: "#93cd78" }}
                    onClick={onViewStatsLocal}
                    data-testid="button-stats-desktop-local"
                    layout
                    transition={{ duration: 0.25 }}
                  >
                    <span className="text-xl font-bold text-gray-800 text-center">
                      Local Stats
                    </span>
                    <img
                      src={mathsHamsterLocal}
                      alt="Local Stats"
                      className="max-h-[72px] w-auto object-contain mt-4"
                    />
                  </motion.button>
                </div>
              </div>
            )}
          </div>
        ) : (
          /* Mobile: Swipeable panes with floating Options button */
          <div className="h-full w-full flex flex-col relative overflow-y-auto">
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
              className="flex-grow min-h-full"
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

            {/* Options button overlay - positioned at Stats row level, moves at half-speed */}
            {isAuthenticated && containerWidth > 0 && (
              <div 
                className="absolute left-0 right-0 pointer-events-none"
                style={{
                  // Position at same vertical level as Stats row in document flow
                  top: '324px'
                }}
              >
                <div style={{ paddingLeft: '1rem', paddingRight: '1rem' }}>
                  <div ref={contentRef} className="max-w-md mx-auto w-full relative h-40">
                    <motion.button
                      className="absolute h-40 w-[calc(50%-0.5rem)] flex flex-col items-center justify-center px-4 rounded-3xl shadow-sm hover:shadow-md pointer-events-auto"
                      style={{ 
                        backgroundColor: "#C4C9D4",
                        right: '-0px',
                        x: buttonX,
                        touchAction: 'pan-y'
                      }}
                      onClick={gameMode === 'global' ? onOpenOptions : onOpenOptionsLocal}
                      data-testid="button-options-mobile"
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.25, delay: 0.3, ease: "easeOut" }}
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
                  </div>
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
