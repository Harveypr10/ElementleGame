import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { HelpDialog } from "./HelpDialog";
import { ModeToggle } from "./ModeToggle";
import { GoProButton } from "./GoProButton";
import { ProSubscriptionDialog } from "./ProSubscriptionDialog";
import { GuestRestrictionPopup } from "./GuestRestrictionPopup";
import { CategorySelectionScreen } from "./CategorySelectionScreen";
import { StreakSaverPopup } from "./StreakSaverPopup";
import { BadgeCelebrationPopup } from "./badges/BadgeCelebrationPopup";
import { HolidayActivationOverlay } from "./HolidayActivationOverlay";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { useGameData } from "@/hooks/useGameData";
import { useSubscription } from "@/hooks/useSubscription";
import { useStreakSaverStatus } from "@/hooks/useStreakSaverStatus";
import { useRealtimeSubscriptions } from "@/hooks/useRealtimeSubscriptions";
import { useCategoryRestriction } from "@/hooks/useCategoryRestriction";
import { useToast } from "@/hooks/use-toast";
import { motion, useTransform, AnimatePresence } from "framer-motion";
import { useSwipeable } from "react-swipeable";
import { useModeController } from "@/hooks/useModeController";
import { readLocal, writeLocal, CACHE_KEYS } from "@/lib/localCache";
import type { UserProfile, UserBadgeWithDetails } from "@shared/schema";
import { getSupabaseClient } from "@/lib/supabaseClient";
import { useUserDateFormat } from "@/hooks/useUserDateFormat";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAdBannerActive } from "@/components/AdBanner";
import { apiRequest } from "@/lib/queryClient";
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
  onRegister?: () => void;
  todayPuzzleId?: number;
  todayPuzzleAnswerDateCanonical?: string;
  onPlayGameLocal?: () => void;
  onViewStatsLocal?: () => void;
  onViewArchiveLocal?: () => void;
  onOpenOptionsLocal?: () => void;
  onPlayYesterdaysPuzzle?: (gameType: "region" | "user", puzzleDate: string) => void;
  onViewStatsWithBadge?: (badge: UserBadgeWithDetails, gameType: 'USER' | 'REGION') => void;
}

export function GameSelectionPage({ 
  onPlayGame, 
  onViewStats, 
  onViewArchive, 
  onOpenSettings, 
  onOpenOptions, 
  onLogin,
  onRegister, 
  todayPuzzleId, 
  todayPuzzleAnswerDateCanonical,
  onPlayGameLocal,
  onViewStatsLocal,
  onViewArchiveLocal,
  onOpenOptionsLocal,
  onPlayYesterdaysPuzzle,
  onViewStatsWithBadge,
}: GameSelectionPageProps) {
  const { user, isAuthenticated } = useAuth();
  const { profile } = useProfile();
  const adBannerActive = useAdBannerActive();
  const { gameAttempts, loadingAttempts } = useGameData();
  const { formatCanonicalDate } = useUserDateFormat();
  const { isPro, tier } = useSubscription();
  const { containerRef, x, gameMode, snapTo, handleSwipeStart, handleSwiping, handleSwiped, isDesktop } = useModeController(() => setShowGuestRestriction('personal'));
  const { isRestricted, restrictionDays } = useCategoryRestriction();
  const { toast } = useToast();
  // Set up realtime subscriptions for automatic UI refresh when database changes occur
  const { refreshLocalData, refreshGlobalData } = useRealtimeSubscriptions({
    userId: user?.id,
    region: profile?.region || 'UK',
    isAuthenticated,
  });
  const queryClient = useQueryClient();
  const [showHelp, setShowHelp] = useState(false);
  const [showProDialog, setShowProDialog] = useState(false);
  const [showGuestRestriction, setShowGuestRestriction] = useState<'archive' | 'personal' | null>(null);
  const [showCategorySelection, setShowCategorySelection] = useState(false);
  const [showStreakSaverPopup, setShowStreakSaverPopup] = useState<'region' | 'user' | null>(null);
  const isLocalMode = gameMode === 'local';
  
  // Holiday activation overlay state (triggered from StreakSaverPopup)
  const [showHolidayOverlay, setShowHolidayOverlay] = useState(false);
  const [holidayOverlayData, setHolidayOverlayData] = useState<{
    regionHolidayDates: string[];
    userHolidayDates: string[];
    showUserAfterRegion: boolean;
    holidayDurationDays: number;
  }>({
    regionHolidayDates: [],
    userHolidayDates: [],
    showUserAfterRegion: false,
    holidayDurationDays: 0,
  });
  
  // Animation key - increments on each mount to force animation replay
  const [animationKey, setAnimationKey] = useState(0);
  useEffect(() => {
    setAnimationKey(prev => prev + 1);
  }, []);

  const {
    status: streakStatus,
    isLoading: streakStatusLoading,
    hasMissedRegion,
    hasMissedUser,
    holidayActive,
    holidayEndDate,
    clearHolidayMissedFlags,
  } = useStreakSaverStatus();

  const [hasShownRegionPopup, setHasShownRegionPopup] = useState(false);
  const [hasShownUserPopup, setHasShownUserPopup] = useState(false);
  
  // Pending badge popup state
  const [pendingBadgeToShow, setPendingBadgeToShow] = useState<UserBadgeWithDetails | null>(null);
  const [pendingBadgeGameType, setPendingBadgeGameType] = useState<'USER' | 'REGION'>('REGION');
  // Track which badge IDs we've already processed this session (to avoid re-showing)
  const [processedBadgeIds, setProcessedBadgeIds] = useState<Set<number>>(new Set());
  const [isAwarding, setIsAwarding] = useState(false);

  // Query for pending badges (isAwarded=false) - Global mode (always enabled for authenticated users)
  const { data: pendingGlobalBadges = [], refetch: refetchGlobalPending } = useQuery<UserBadgeWithDetails[]>({
    queryKey: ['/api/badges/pending'],
    queryFn: () => fetchAuthenticated('/api/badges/pending'),
    enabled: isAuthenticated,
  });
  
  // Query for pending badges (isAwarded=false) - Local mode (always enabled for authenticated users)
  const { data: pendingLocalBadges = [], refetch: refetchLocalPending } = useQuery<UserBadgeWithDetails[]>({
    queryKey: ['/api/user/badges/pending'],
    queryFn: () => fetchAuthenticated('/api/user/badges/pending'),
    enabled: isAuthenticated,
  });

  // Check for pending badges and show popup
  useEffect(() => {
    if (!isAuthenticated) return;
    
    // Don't show a new popup if one is already showing or we're in the process of awarding
    if (pendingBadgeToShow || isAwarding) return;
    
    // Find first unprocessed pending badge (prioritize global over local)
    const unprocessedGlobal = pendingGlobalBadges.find(b => !processedBadgeIds.has(b.id));
    const unprocessedLocal = pendingLocalBadges.find(b => !processedBadgeIds.has(b.id));
    
    if (unprocessedGlobal) {
      setPendingBadgeToShow(unprocessedGlobal);
      setPendingBadgeGameType('REGION');
    } else if (unprocessedLocal) {
      setPendingBadgeToShow(unprocessedLocal);
      setPendingBadgeGameType('USER');
    }
    // No pending badges or all already processed - nothing to do
  }, [isAuthenticated, pendingGlobalBadges, pendingLocalBadges, pendingBadgeToShow, processedBadgeIds, isAwarding]);

  // Track if we've already cleared holiday missed flags this session
  const [hasClearedHolidayFlags, setHasClearedHolidayFlags] = useState(false);

  useEffect(() => {
    // Wait for authentication and status to load
    if (!isAuthenticated || streakStatusLoading || !streakStatus) return;
    
    // If in holiday mode and there are missed flags, clear them silently instead of showing popup
    if (holidayActive && (hasMissedRegion || hasMissedUser) && !hasClearedHolidayFlags) {
      setHasClearedHolidayFlags(true);
      clearHolidayMissedFlags();
      return;
    }
    
    // Don't show popups if in holiday mode
    if (holidayActive) return;
    
    // Show region popup if missed and not yet shown
    if (hasMissedRegion && !hasShownRegionPopup && !showStreakSaverPopup) {
      setShowStreakSaverPopup('region');
      setHasShownRegionPopup(true);
    }
    // Show user popup if missed, not yet shown, and region popup is not active
    else if (hasMissedUser && !hasShownUserPopup && !showStreakSaverPopup && !hasMissedRegion) {
      setShowStreakSaverPopup('user');
      setHasShownUserPopup(true);
    }
  }, [isAuthenticated, streakStatusLoading, streakStatus, hasMissedRegion, hasMissedUser, hasShownRegionPopup, hasShownUserPopup, showStreakSaverPopup, holidayActive, hasClearedHolidayFlags, clearHolidayMissedFlags]);

  // Cache user name and region label locally to prevent flicker
  const [cachedUserName, setCachedUserName] = useState<string>(() => {
    const cached = readLocal<UserProfile>(CACHE_KEYS.PROFILE);
    return cached?.firstName || 'Personal';
  });
  const [cachedRegionLabel, setCachedRegionLabel] = useState<string>(() => {
    const cached = readLocal<UserProfile>(CACHE_KEYS.PROFILE);
    return cached?.region ? `${cached.region} Edition` : 'UK Edition';
  });

  // Update cache when profile loads
  useEffect(() => {
    if (profile) {
      if (profile.firstName) {
        // If name is 12+ characters, use "Personal" instead
        const displayName = profile.firstName.length >= 12 ? 'Personal' : profile.firstName;
        setCachedUserName(displayName);
      }
      if (profile.region) {
        setCachedRegionLabel(`${profile.region} Edition`);
      }
    }
  }, [profile]);

  // Handler for opening category selection with restriction check
  const handleOpenProCategories = () => {
    if (isRestricted) {
      toast({
        title: "Categories restricted",
        description: `You can update your categories once every ${restrictionDays} days and Hammie will regenerate your questions.`,
        variant: "default",
      });
      return;
    }
    setShowCategorySelection(true);
  };

  // Transform for Options button - moves based on content width, not viewport
  // Track container width, content width, and Stats row vertical position
  const [containerWidth, setContainerWidth] = useState(0);
  const [contentWidth, setContentWidth] = useState(0);
  const [statsRowTop, setStatsRowTop] = useState(0);
  const contentRef = useRef<HTMLDivElement>(null);
  const statsRowRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        setContainerWidth(containerRef.current.offsetWidth);
      }
      if (contentRef.current) {
        setContentWidth(contentRef.current.offsetWidth);
      }
      // Track Stats row position relative to the container
      if (statsRowRef.current && containerRef.current) {
        const containerRect = containerRef.current.getBoundingClientRect();
        const statsRect = statsRowRef.current.getBoundingClientRect();
        setStatsRowTop(statsRect.top - containerRect.top);
      }
    };
    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    // Also observe for layout changes (text size, etc.)
    const observer = new MutationObserver(updateDimensions);
    if (containerRef.current) {
      observer.observe(containerRef.current, { childList: true, subtree: true, attributes: true });
    }
    return () => {
      window.removeEventListener('resize', updateDimensions);
      observer.disconnect();
    };
  }, [containerRef]);

  // Options button moves to stay aligned with content area
  // Movement is based on content width (max-w-md), not full container width
  // Button width is calc(50% - 0.5rem), so to move from right-aligned to left-aligned:
  // needs to move by contentWidth/2 + 8px (the 8px accounts for the 0.5rem gap)
  const buttonX = useTransform(
    x,
    [0, -Math.max(containerWidth, 1)],
    [0, -Math.max(contentWidth, 1) / 2 - 8], // Align left edge with Archive button on Local
    { clamp: true }
  );

  // Authenticated fetch helper
  const fetchAuthenticated = async (endpoint: string) => {
    if (!isAuthenticated) return null;
    const supabase = await getSupabaseClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      // Throw error instead of returning null so TanStack Query retries
      // This handles race conditions where auth state is established before session
      throw new Error('Session not available yet');
    }

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

  // Fetch Global puzzles (for authenticated users - uses region data)
  const { data: globalPuzzles = [] } = useQuery<any[]>({
    queryKey: ['/api/puzzles'],
    queryFn: () => fetchAuthenticated('/api/puzzles'),
    enabled: isAuthenticated,
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 5000),
  });

  // Fetch Local puzzles (for authenticated users - uses user-specific data)
  const { data: localPuzzles = [], isLoading: localPuzzlesLoading } = useQuery<any[]>({
    queryKey: ['/api/user/puzzles'],
    queryFn: () => fetchAuthenticated('/api/user/puzzles'),
    enabled: isAuthenticated,
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 5000),
  });

  // Fetch guest puzzles (for unauthenticated users - Global mode only)
  const { data: guestPuzzles = [] } = useQuery<any[]>({
    queryKey: ['/api/puzzles/guest'],
    queryFn: async () => {
      const response = await fetch('/api/puzzles/guest');
      if (!response.ok) throw new Error('Failed to fetch guest puzzles');
      return response.json();
    },
    enabled: !isAuthenticated,
  });

  // Helper to find today's puzzle from a list
  const getTodayDateString = () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const hasTodayPuzzle = (puzzles: any[]): boolean => {
    if (!puzzles || puzzles.length === 0) return false;
    const todayDate = getTodayDateString();
    return puzzles.some(p => p.date === todayDate);
  };

  // Force data refresh for authenticated users if today's puzzle is missing
  // Triggers on: mount, mode switch (Global <-> Local), or when puzzle data changes
  const lastRefreshRef = useRef<number>(0);
  useEffect(() => {
    if (!isAuthenticated) return;
    
    const hasTodayGlobal = hasTodayPuzzle(globalPuzzles);
    const hasTodayLocal = hasTodayPuzzle(localPuzzles);
    
    // Only refresh if today's puzzle is missing from either mode
    if (!hasTodayGlobal || !hasTodayLocal) {
      // Prevent rapid refreshes - minimum 1 second between refreshes
      const now = Date.now();
      if (now - lastRefreshRef.current > 1000) {
        lastRefreshRef.current = now;
        console.log('[GameSelectionPage] Today puzzle missing - refreshing data', { gameMode, hasTodayGlobal, hasTodayLocal });
        queryClient.refetchQueries({ queryKey: ['/api/user/puzzles'] });
        queryClient.refetchQueries({ queryKey: ['/api/puzzles'] });
        queryClient.refetchQueries({ queryKey: ['/api/user/game-attempts/user'] });
        queryClient.refetchQueries({ queryKey: ['/api/game-attempts/user'] });
      }
    } else {
      console.log('[GameSelectionPage] Today puzzles loaded - no refresh needed');
    }
  }, [isAuthenticated, globalPuzzles, localPuzzles, queryClient, gameMode]);


  // Helper to find today's puzzle from a list
  const findTodayPuzzle = (puzzles: any[]): any | undefined => {
    if (!puzzles || puzzles.length === 0) return undefined;
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    const todayDate = `${year}-${month}-${day}`;
    return puzzles.find(p => p.date === todayDate);
  };

  // Compute today's puzzle ID for each mode independently
  const todayGlobalPuzzle = isAuthenticated ? findTodayPuzzle(globalPuzzles) : findTodayPuzzle(guestPuzzles);
  const todayLocalPuzzle = isAuthenticated ? findTodayPuzzle(localPuzzles) : undefined;
  const todayGlobalPuzzleId = todayGlobalPuzzle?.id;
  const todayLocalPuzzleId = todayLocalPuzzle?.id;

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
    const globalPlayStatus = computePlayButtonStatus(globalGameAttempts, todayGlobalPuzzleId);
    const totalGamesGlobal = globalGameAttempts.filter(attempt => attempt.result === "won" || attempt.result === "lost").length;
    const globalStreak = globalStats?.currentStreak || 0;
    
    // Use cumulative monthly percentile from stats (only show if day of month >= 5)
    const dayOfMonth = new Date().getDate();
    const globalCumulativePercentile = globalStats?.cumulativeMonthlyPercentile ?? null;

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
        // Only show percentile if day >= 5 and we have a valid percentile score
        if (dayOfMonth >= 5 && globalCumulativePercentile !== null && globalCumulativePercentile > 0) {
          const roundedPercentile = Math.floor(globalCumulativePercentile / 5) * 5;
          if (globalCumulativePercentile >= 50) {
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
          {/* Desktop: Show region label title */}
          {isDesktop && isAuthenticated && (
            <div className="text-center mb-0">
              <h2 className="text-2xl font-bold text-foreground font-bold">{cachedRegionLabel}</h2>
            </div>
          )}

          {/* Desktop: Show only secondary message (no "Welcome back") */}
          {isDesktop && isAuthenticated && globalIntroMessage && (
            <div className="text-center mb-2 h-12 flex flex-col justify-center" data-testid="intro-message-global">
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
              disabled={!todayGlobalPuzzleId}
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
              onClick={() => {
                if (!isAuthenticated) {
                  setShowGuestRestriction('archive');
                  return;
                }
                onViewArchive();
              }}
              data-testid="button-archive"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, delay: 0.15, ease: "easeOut" }}
            >
              <div className="flex flex-col items-start justify-center text-left">
                <span className="text-xl font-bold text-gray-800">Archive</span>
                <span className="text-sm font-medium text-gray-700 mt-0.5">
                  {isAuthenticated ? `${totalGamesGlobal} total games played` : 'Sign in to access'}
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
              <div ref={statsRowRef} className="relative h-40">
                {/* Global Stats button */}
                <motion.button
                  className="absolute left-0 h-40 w-[calc(50%-0.5rem)] flex flex-col items-center px-4 py-3 rounded-3xl shadow-sm hover:shadow-md"
                  style={{ backgroundColor: "#A4DB57", touchAction: 'pan-y' }}
                  onClick={() => {
                    if (!isAuthenticated) {
                      setShowGuestRestriction('personal');
                      return;
                    }
                    onViewStats();
                  }}
                  data-testid="button-stats-global"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25, delay: 0.3, ease: "easeOut" }}
                >
                  <span className="text-xl font-bold text-gray-800 text-center h-12 flex items-center">
                    {cachedRegionLabel.split(' ')[0]} Stats
                  </span>
                  <img
                    src={mathsHamsterGreen}
                    alt="Global Stats"
                    className="max-h-[72px] w-auto object-contain flex-1 mt-2"
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
    const localPlayStatus = computePlayButtonStatus(localGameAttempts, todayLocalPuzzleId);
    const totalGamesLocal = localGameAttempts.filter(attempt => attempt.result === "won" || attempt.result === "lost").length;
    const localStreak = localStats?.currentStreak || 0;
    
    // Use cumulative monthly percentile from stats (only show if day of month >= 5)
    const dayOfMonth = new Date().getDate();
    const localCumulativePercentile = localStats?.cumulativeMonthlyPercentile ?? null;

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
        let percentileMessage = "Play your personalised puzzles";
        // Only show percentile if day >= 5 and we have a valid percentile score
        if (dayOfMonth >= 5 && localCumulativePercentile !== null && localCumulativePercentile > 0) {
          const roundedPercentile = Math.floor(localCumulativePercentile / 5) * 5;
          if (localCumulativePercentile >= 50) {
            percentileMessage = `You're in the top ${roundedPercentile}% of players`;
          }
        }
        localIntroMessage = { 
          firstLine: "Welcome back", 
          secondLine: percentileMessage 
        };
      }
    }

    // Compute Local play button content
    // Differentiate between: still loading, no puzzle available, puzzle available
    const isStillLoading = isAuthenticated && localPuzzlesLoading;
    const noPuzzleAvailable = isAuthenticated && !localPuzzlesLoading && !todayLocalPuzzleId;
    
    let playContentLocal;
    if (isStillLoading) {
      // Data still loading - show default button text but disabled
      playContentLocal = {
        title: "Play today's puzzle",
        subtitle: "",
        image: historianHamsterLocal,
        isLoading: true
      };
    } else if (noPuzzleAvailable) {
      // Data loaded but no puzzle for today - show cooking message
      playContentLocal = {
        title: "Hammie is still cooking up today's personal puzzle for you - won't take long...",
        subtitle: "",
        image: historianHamsterLocal,
        isLoading: true
      };
    } else {
      switch (localPlayStatus.status) {
        case 'solved':
          playContentLocal = {
            title: "Today's puzzle solved!",
            subtitle: `Solved in ${localPlayStatus.count} ${localPlayStatus.count === 1 ? 'guess' : 'guesses'}`,
            image: winhamsterlocal,
            isLoading: false
          };
          break;
        case 'failed':
          playContentLocal = {
            title: "Better luck tomorrow...",
            subtitle: "",
            image: losthamsterlocal,
            isLoading: false
          };
          break;
        default:
          playContentLocal = {
            title: "Play today's puzzle",
            subtitle: getFormattedDate(),
            image: historianHamsterLocal,
            isLoading: false
          };
      }
    }

    return (
      <div className={isDesktop ? "w-full flex-shrink-0" : "w-1/2 flex-shrink-0"} style={{ paddingLeft: isDesktop ? 0 : '1rem', paddingRight: isDesktop ? 0 : '1rem' }}>
        <div className="max-w-md mx-auto w-full">
          {/* Desktop: Show user name title */}
          {isDesktop && isAuthenticated && (
            <div className="text-center mb-0">
              <h2 className="text-2xl font-bold text-foreground font-bold">{cachedUserName}</h2>
            </div>
          )}

          {/* Desktop: Show only secondary message (no "Welcome back") */}
          {isDesktop && isAuthenticated && localIntroMessage && (
            <div className="text-center mb-2 h-12 flex flex-col justify-center" data-testid="intro-message-local-desktop">
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
              onClick={() => {
                if (!isAuthenticated) {
                  setShowGuestRestriction('personal');
                  return;
                }
                onPlayGameLocal?.();
              }}
              disabled={!todayLocalPuzzleId}
              data-testid="button-play-local"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, ease: "easeOut" }}
            >
              <div className="flex flex-col items-start justify-center text-left">
                {playContentLocal.isLoading ? (
                  <span className="text-base text-gray-800">
                    <span className="font-bold">Hammie</span> is still cooking up today's personal puzzle for you - won't take long...
                  </span>
                ) : (
                  <span className={`font-bold text-gray-800 ${playContentLocal.isLoading ? 'text-base' : 'text-xl'}`}>
                    {isAuthenticated ? playContentLocal.title : 'Play today\'s puzzle'}
                  </span>
                )}
                {(isAuthenticated ? playContentLocal.subtitle : 'Sign in to access') && (
                  <span className="text-sm font-medium text-gray-700 mt-0.5">
                    {isAuthenticated ? playContentLocal.subtitle : 'Sign in to access'}
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
              onClick={() => {
                if (!isAuthenticated) {
                  setShowGuestRestriction('personal');
                  return;
                }
                onViewArchiveLocal?.();
              }}
              data-testid="button-archive-local"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, delay: 0.15, ease: "easeOut" }}
            >
              <div className="flex flex-col items-start justify-center text-left">
                <span className="text-xl font-bold text-gray-800">Archive</span>
                <span className="text-sm font-medium text-gray-700 mt-0.5">
                  {isAuthenticated ? `${totalGamesLocal} total games played` : 'Sign in to access'}
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
                  className="absolute right-0 h-40 w-[calc(50%-0.5rem)] flex flex-col items-center px-4 py-3 rounded-3xl shadow-sm hover:shadow-md"
                  style={{ backgroundColor: "#93cd78", touchAction: 'pan-y' }}
                  onClick={() => {
                    if (!isAuthenticated) {
                      setShowGuestRestriction('personal');
                      return;
                    }
                    onViewStatsLocal?.();
                  }}
                  data-testid="button-stats-local"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25, delay: 0.3, ease: "easeOut" }}
                >
                  <span className="text-xl font-bold text-gray-800 text-center h-12 flex items-center">
                    Personal Stats
                  </span>
                  <img
                    src={mathsHamsterLocal}
                    alt="Local Stats"
                    className="max-h-[72px] w-auto object-contain flex-1 mt-2"
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
    <div className={`flex flex-col min-h-screen overflow-hidden ${adBannerActive ? 'pb-[50px]' : ''}`}>
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

              <div className="flex items-center pr-2 mb-1 relative">
                {/* Mode toggle - always centered */}
                <div className="flex-1 flex justify-center">
                  <ModeToggle 
                    onModeChange={(mode) => {
                      if (mode === 'local' && !isAuthenticated) {
                        setShowGuestRestriction('personal');
                        snapTo('global'); // Snap back to global
                        return;
                      }
                      snapTo(mode);
                    }} 
                    onLocalClickGuest={() => setShowGuestRestriction('personal')}
                    globalLabel={cachedRegionLabel || profile?.region || 'UK Edition'}
                  />
                </div>

                {/* Go Pro / Ads button - right side, only for authenticated users */}
                {isAuthenticated && (
                  <div className={`absolute flex-shrink-0 ${isPro ? 'right-2' : 'right-0'}`}>
                    {isPro ? (
                      <GoProButton onClick={handleOpenProCategories} isPro />
                    ) : (
                      <GoProButton onClick={() => setShowProDialog(true)} />
                    )}
                  </div>
                )}
              </div>

              <div className="text-center mb-1">
                <div className="text-2xl sm:text-3xl font-bold text-gray-800 dark:text-gray-200" data-testid="intro-first-line-fixed">
                  {getGreeting()}
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* Desktop: Header (not fixed) */
        <div className="flex-shrink-0 p-4">
          <div className="max-w-[calc(2*28rem+0.5rem)] mx-auto w-full">
            <div className="relative flex items-center justify-between mb-2">
              <button
                onClick={() => setShowHelp(true)}
                data-testid="button-help"
                className="w-14 h-14 flex items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors z-10"
              >
                <img src={greyHelpIcon} alt="Help" className="h-9 w-9 block dark:hidden" />
                <img src={whiteHelpIcon} alt="Help" className="h-9 w-9 hidden dark:block" />
              </button>

              <h1 className="absolute left-1/2 -translate-x-1/2 text-4xl sm:text-5xl font-bold text-gray-900 dark:text-gray-100" data-testid="text-title">
                Elementle
              </h1>

              <div className="flex items-center gap-2 z-10">
                {/* Go Pro / Ads button - next to settings, only for authenticated users */}
                {isAuthenticated && (
                  <div className="flex-shrink-0">
                    {isPro ? (
                      <GoProButton onClick={handleOpenProCategories} isPro />
                    ) : (
                      <GoProButton onClick={() => setShowProDialog(true)} />
                    )}
                  </div>
                )}
                
                <button
                  onClick={onOpenSettings}
                  disabled={!onOpenSettings}
                  data-testid="button-settings"
                  className="w-14 h-14 flex items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors disabled:opacity-50"
                >
                  <img src={greyCogIcon} alt="Settings" className="h-9 w-9 block dark:hidden" />
                  <img src={whiteCogIcon} alt="Settings" className="h-9 w-9 hidden dark:block" />
                </button>
              </div>
            </div>

            <div className="flex justify-center mb-2">
              <div className="text-center">
                <div className="text-2xl font-bold text-foreground">
                  {getGreeting()}
                </div>
              </div>
            </div>
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

            {/* Desktop: Bottom buttons - Options always visible, Stats visible for all */}
            <div className="flex-shrink-0 px-4 pb-24 mt-4">
              <AnimatePresence mode="wait">
                <motion.div
                  key={`desktop-buttons-${animationKey}`}
                  className="max-w-[calc(2*28rem+0.5rem)] mx-auto flex gap-2"
                  initial="hidden"
                  animate="visible"
                  variants={{
                    hidden: {},
                    visible: {
                      transition: {
                        staggerChildren: 0.08,
                        delayChildren: 0.1
                      }
                    }
                  }}
                >
                  <motion.button
                    className="flex-1 h-36 flex flex-col items-center justify-center px-4 rounded-3xl shadow-sm hover:shadow-md"
                    style={{ backgroundColor: "#A4DB57" }}
                    onClick={() => {
                      if (!isAuthenticated) {
                        setShowGuestRestriction('personal');
                        return;
                      }
                      onViewStats();
                    }}
                    data-testid="button-stats-desktop-global"
                    variants={{
                      hidden: { opacity: 0, y: 20 },
                      visible: { opacity: 1, y: 0, transition: { duration: 0.25, ease: "easeOut" } }
                    }}
                  >
                    <span className="text-xl font-bold text-gray-800 text-center">
                      {cachedRegionLabel.split(' ')[0]} Stats
                    </span>
                    <img
                      src={mathsHamsterGreen}
                      alt="Global Stats"
                      className="max-h-[72px] w-auto object-contain mt-4"
                    />
                  </motion.button>

                  <motion.button
                    className="flex-1 h-36 flex flex-col items-center justify-center px-4 rounded-3xl shadow-sm hover:shadow-md"
                    style={{ backgroundColor: "#C4C9D4" }}
                    onClick={onOpenOptions}
                    data-testid="button-options-desktop"
                    variants={{
                      hidden: { opacity: 0, y: 20 },
                      visible: { opacity: 1, y: 0, transition: { duration: 0.25, ease: "easeOut" } }
                    }}
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
                    className="flex-1 h-36 flex flex-col items-center justify-center px-4 rounded-3xl shadow-sm hover:shadow-md"
                    style={{ backgroundColor: "#93cd78" }}
                    onClick={() => {
                      if (!isAuthenticated) {
                        setShowGuestRestriction('personal');
                        return;
                      }
                      onViewStatsLocal?.();
                    }}
                    data-testid="button-stats-desktop-local"
                    variants={{
                      hidden: { opacity: 0, y: 20 },
                      visible: { opacity: 1, y: 0, transition: { duration: 0.25, ease: "easeOut" } }
                    }}
                  >
                    <span className="text-xl font-bold text-gray-800 text-center">
                      Personal Stats
                    </span>
                    <img
                      src={mathsHamsterLocal}
                      alt="Local Stats"
                      className="max-h-[72px] w-auto object-contain mt-4"
                    />
                  </motion.button>
                </motion.div>
              </AnimatePresence>
            </div>
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
            {containerWidth > 0 && statsRowTop > 0 && (
              <div 
                className="absolute left-0 right-0 pointer-events-none"
                style={{
                  // Position at same vertical level as Stats row (dynamically tracked)
                  top: `${statsRowTop}px`
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

      {/* Pro Subscription Dialog */}
      <ProSubscriptionDialog
        isOpen={showProDialog}
        onClose={() => setShowProDialog(false)}
        onSuccess={(selectedTier) => {
          setShowProDialog(false);
          setShowCategorySelection(true);
        }}
        onLoginRequired={onLogin}
      />

      {/* Category Selection Screen (after Pro subscription) */}
      <CategorySelectionScreen
        isOpen={showCategorySelection}
        onClose={() => setShowCategorySelection(false)}
        onGenerate={() => {
          setShowCategorySelection(false);
        }}
      />

      {/* Guest Restriction Popups */}
      <GuestRestrictionPopup
        isOpen={showGuestRestriction !== null}
        type={showGuestRestriction || 'archive'}
        onClose={() => {
          setShowGuestRestriction(null);
          // Always snap back to Global mode when closing restriction popup
          snapTo('global');
        }}
        onRegister={() => {
          setShowGuestRestriction(null);
          if (onRegister) onRegister();
        }}
        onLogin={() => {
          setShowGuestRestriction(null);
          if (onLogin) onLogin();
        }}
      />

      {/* Streak Saver Popup */}
      {showStreakSaverPopup && streakStatus && (
        <StreakSaverPopup
          open={true}
          onClose={() => {
            const currentType = showStreakSaverPopup;
            setShowStreakSaverPopup(null);
            // If we just closed region popup and user also needs attention, show user popup
            if (currentType === 'region' && hasMissedUser && !hasShownUserPopup) {
              setHasShownUserPopup(true);
              setTimeout(() => setShowStreakSaverPopup('user'), 300);
            }
          }}
          gameType={showStreakSaverPopup}
          currentStreak={
            showStreakSaverPopup === 'region' 
              ? streakStatus.region?.currentStreak || 0
              : streakStatus.user?.currentStreak || 0
          }
          onPlayYesterdaysPuzzle={onPlayYesterdaysPuzzle}
          onStartHolidayWithAnimation={(data) => {
            setHolidayOverlayData(data);
            setShowHolidayOverlay(true);
          }}
          onShowCategorySelection={() => {
            setShowStreakSaverPopup(null);
            setShowCategorySelection(true);
          }}
        />
      )}

      {/* Holiday Activation Overlay */}
      <HolidayActivationOverlay
        show={showHolidayOverlay}
        regionHolidayDates={holidayOverlayData.regionHolidayDates}
        userHolidayDates={holidayOverlayData.userHolidayDates}
        showUserAfterRegion={holidayOverlayData.showUserAfterRegion}
        holidayDurationDays={holidayOverlayData.holidayDurationDays}
        onComplete={() => {
          setShowHolidayOverlay(false);
          toast({
            title: "Holiday mode activated",
            description: `Your streak is now protected for the next ${holidayOverlayData.holidayDurationDays} days.`,
          });
        }}
      />

      {/* Pending Badge Celebration Popup */}
      {pendingBadgeToShow && (
        <BadgeCelebrationPopup
          badge={pendingBadgeToShow}
          onDismiss={async () => {
            const badge = pendingBadgeToShow;
            const gameType = pendingBadgeGameType;
            
            // Mark this badge as processed so we don't re-show it
            setProcessedBadgeIds(prev => new Set(Array.from(prev).concat(badge.id)));
            setIsAwarding(true);
            
            // Mark the badge as awarded in the backend
            try {
              await apiRequest('POST', `/api/badges/${badge.id}/award`);
              
              // Invalidate badges queries and wait for them to complete
              const earnedEndpoint = gameType === 'USER' ? '/api/user/badges/earned' : '/api/badges/earned';
              const pendingEndpoint = gameType === 'USER' ? '/api/user/badges/pending' : '/api/badges/pending';
              await Promise.all([
                queryClient.invalidateQueries({ queryKey: [earnedEndpoint] }),
                queryClient.invalidateQueries({ queryKey: [pendingEndpoint] }),
                queryClient.invalidateQueries({ queryKey: ['/api/badges/pending'] }),
                queryClient.invalidateQueries({ queryKey: ['/api/user/badges/pending'] }),
              ]);
              
              // Refetch to get fresh pending badge data
              await Promise.all([
                refetchGlobalPending(),
                refetchLocalPending(),
              ]);
              
              // Clear current popup
              setPendingBadgeToShow(null);
              setIsAwarding(false);
              
              // Navigate to stats page with the badge info for animation
              if (onViewStatsWithBadge) {
                onViewStatsWithBadge(badge, gameType);
              }
            } catch (error) {
              console.error('[GameSelectionPage] Failed to mark badge as awarded:', error);
              // Show error toast
              toast({
                title: "Unable to save badge",
                description: "Please try again later.",
                variant: "destructive",
              });
              // Remove from processed so it can be retried
              setProcessedBadgeIds(prev => {
                const newSet = new Set(prev);
                newSet.delete(badge.id);
                return newSet;
              });
              // Dismiss popup but allow retry
              setPendingBadgeToShow(null);
              setIsAwarding(false);
            }
          }}
        />
      )}
    </div>
  );
}
