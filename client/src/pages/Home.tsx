import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { pageVariants, pageTransition } from "@/lib/pageAnimations";
import { WelcomePage } from "@/components/WelcomePage";
import { GameSelectionPage } from "@/components/GameSelectionPage";
import { PlayPage } from "@/components/PlayPage";
import { StatsPage } from "@/components/StatsPage";
import { ArchivePage } from "@/components/ArchivePage";
import { SettingsPage } from "@/components/SettingsPage";
import { OptionsPage } from "@/components/OptionsPage";
import { SplashScreen } from "@/components/SplashScreen";
import AuthPage from "@/components/AuthPage";
import ForgotPasswordPage from "@/components/ForgotPasswordPage";
import AccountInfoPage from "@/components/AccountInfoPage";
import { PrivacyPage } from "@/components/PrivacyPage";
import { TermsPage } from "@/components/TermsPage";
import { AboutPage } from "@/components/AboutPage";
import { BugReportForm } from "@/components/BugReportForm";
import { FeedbackForm } from "@/components/FeedbackForm";
import { GeneratingQuestionsScreen } from "@/components/GeneratingQuestionsScreen";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { useGameData } from "@/hooks/useGameData";
import { useUserDateFormat } from "@/hooks/useUserDateFormat";
import { useGameMode } from "@/contexts/GameModeContext";
import { useSpinnerWithTimeout } from "@/lib/SpinnerProvider";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { AdBanner, AdBannerContext } from "@/components/AdBanner";
import type { UserBadgeWithDetails } from "@shared/schema";

type Screen = "splash" | "welcome" | "login" | "signup" | "forgot-password" | "selection" | "play" | "stats" | "archive" | "settings" | "options" | "account-info" | "privacy" | "terms" | "about" | "bug-report" | "feedback" | "generating-questions";

interface Puzzle {
  id: number;
  date: string;
  answerDateCanonical: string; // YYYY-MM-DD format - the canonical historical date
  eventTitle: string;
  eventDescription: string;
  clue1?: string;
  clue2?: string;
  category?: string; // Only present in Local mode (user-specific puzzles)
}

export default function Home() {
  const { isAuthenticated, isLoading, user, hasCompletedFirstLogin, markFirstLoginCompleted } = useAuth();
  const { profile } = useProfile();
  // Fetch BOTH global and local game attempts to avoid race conditions when switching modes
  const { gameAttempts: globalGameAttempts, loadingAttempts: loadingGlobalAttempts } = useGameData({ modeOverride: 'global' });
  const { gameAttempts: localGameAttempts, loadingAttempts: loadingLocalAttempts } = useGameData({ modeOverride: 'local' });
  const { formatCanonicalDate } = useUserDateFormat();
  const { isLocalMode, setGameMode } = useGameMode();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [currentScreen, setCurrentScreen] = useState<Screen>("splash");
  const [selectedPuzzleId, setSelectedPuzzleId] = useState<string | null>(null);
  const [showSplash, setShowSplash] = useState(true);
  const [previousScreen, setPreviousScreen] = useState<Screen>("selection");
  const [statsReturnScreen, setStatsReturnScreen] = useState<Screen>("selection");
  const [statsGameType, setStatsGameType] = useState<'REGION' | 'USER'>('REGION');
  const [showCelebrationFirst, setShowCelebrationFirst] = useState(false);
  const [hasOpenedCelebration, setHasOpenedCelebration] = useState(false);
  const [archiveMonthContext, setArchiveMonthContext] = useState<Date | null>(null);
  const [hasExistingProgress, setHasExistingProgress] = useState(false);
  const [needsFirstLoginSetup, setNeedsFirstLoginSetup] = useState(false);
  const [showAuthButtons, setShowAuthButtons] = useState(false);
  const [hasShownGeneratingScreen, setHasShownGeneratingScreen] = useState(false);
  // Track which mode the puzzle was selected in (to prevent mode mismatch issues)
  const [puzzleSourceMode, setPuzzleSourceMode] = useState<'global' | 'local'>('global');
  // Track newly awarded badge for animation on stats page
  const [newlyAwardedBadge, setNewlyAwardedBadge] = useState<UserBadgeWithDetails | null>(null);
  // Track pending play navigation (waiting for data to load)
  const [pendingPlayMode, setPendingPlayMode] = useState<'global' | 'local' | null>(null);
  // Track pending yesterday puzzle navigation (for streak saver)
  // NOTE: pendingYesterdayPuzzle state has been removed - streak saver now fetches directly from API
  // Track directly-fetched streak saver puzzle (for yesterday's puzzle navigation)
  const [streakSaverPuzzle, setStreakSaverPuzzle] = useState<Puzzle | null>(null);
  // Track if we're loading the streak saver puzzle
  const [loadingStreakSaverPuzzle, setLoadingStreakSaverPuzzle] = useState(false);
  
  // Fetch BOTH global and local puzzles to avoid race conditions when switching modes
  const globalPuzzlesEndpoint = isAuthenticated ? '/api/puzzles' : '/api/puzzles/guest';
  const localPuzzlesEndpoint = '/api/user/puzzles';
  
  const { data: globalPuzzles = [], isLoading: globalPuzzlesLoading, refetch: refetchGlobalPuzzles } = useQuery<Puzzle[]>({
    queryKey: [globalPuzzlesEndpoint],
  });
  
  const { data: localPuzzles = [], isLoading: localPuzzlesLoading, refetch: refetchLocalPuzzles } = useQuery<Puzzle[]>({
    queryKey: [localPuzzlesEndpoint],
    enabled: isAuthenticated, // Only fetch local puzzles for authenticated users
  });
  
  // Use the current mode's puzzles for display (backward compatible)
  const puzzles = isLocalMode ? localPuzzles : globalPuzzles;
  const puzzlesLoading = isLocalMode ? localPuzzlesLoading : globalPuzzlesLoading;
  const refetchPuzzles = isLocalMode ? refetchLocalPuzzles : refetchGlobalPuzzles;
  
  // Retry mechanism for missing puzzle data - handles case where realtime events were missed
  const puzzleRetryCountRef = useRef(0);
  const maxPuzzleRetries = 5;
  const puzzleRetryDelayMs = 2000;
  
  useEffect(() => {
    // Only retry for authenticated users when puzzle data is missing
    if (!isAuthenticated) {
      puzzleRetryCountRef.current = 0;
      return;
    }

    const hasMissingData = puzzles.length === 0;
    
    if (hasMissingData && puzzleRetryCountRef.current < maxPuzzleRetries && !puzzlesLoading) {
      const timer = setTimeout(() => {
        console.log('[Home] Retrying puzzles fetch, attempt:', puzzleRetryCountRef.current + 1);
        puzzleRetryCountRef.current++;
        refetchPuzzles();
      }, puzzleRetryDelayMs);
      
      return () => clearTimeout(timer);
    }
    
    // Reset retry count when we have data
    if (!hasMissingData) {
      puzzleRetryCountRef.current = 0;
    }
  }, [isAuthenticated, puzzles.length, puzzlesLoading, refetchPuzzles]);

  // Track if we've shown welcome page and auto-navigated to selection
  const [hasAutoNavigated, setHasAutoNavigated] = useState(false);
  
  useEffect(() => {
    if (isLoading) return;
    
    if (showSplash) {
      // Show splash, then welcome page briefly, then auto-navigate to selection
      setTimeout(() => {
        setShowSplash(false);
        setCurrentScreen("welcome");
      }, 3000);
    }
  }, [isLoading, showSplash]);
  
  // Auto-navigate from welcome to selection after a brief display (2 seconds)
  // Only auto-navigate if we're not showing auth buttons (after sign-out, we show buttons)
  useEffect(() => {
    if (currentScreen === "welcome" && !hasAutoNavigated && !showAuthButtons) {
      const timer = setTimeout(() => {
        setCurrentScreen("selection");
        setHasAutoNavigated(true);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [currentScreen, hasAutoNavigated, showAuthButtons]);
  
  // Check for first login when user becomes authenticated and is on selection screen
  // This catches cases where onSuccess callback ran before auth state was fully updated
  // hasShownGeneratingScreen prevents the screen from showing twice in the same session
  useEffect(() => {
    if (currentScreen === "selection" && isAuthenticated && user && !needsFirstLoginSetup && !hasShownGeneratingScreen) {
      if (!hasCompletedFirstLogin()) {
        setNeedsFirstLoginSetup(true);
        setHasShownGeneratingScreen(true);
        setCurrentScreen("generating-questions");
      }
    }
  }, [currentScreen, isAuthenticated, user, needsFirstLoginSetup, hasCompletedFirstLogin, hasShownGeneratingScreen]);

  // Scroll to top when screen changes
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [currentScreen]);

  // Handle pending play navigation - waits for BOTH puzzles AND attempts to load before navigating
  // This fixes the race condition where navigation happens before data is ready
  useEffect(() => {
    if (!pendingPlayMode) return;
    
    const modePuzzlesLoading = pendingPlayMode === 'local' ? localPuzzlesLoading : globalPuzzlesLoading;
    const modeAttemptsLoading = pendingPlayMode === 'local' ? loadingLocalAttempts : loadingGlobalAttempts;
    
    // Derive "data ready" flags from loading states
    // When loading is false, the query has completed and data is available (even if empty)
    const puzzlesReady = !modePuzzlesLoading;
    const attemptsReady = !isAuthenticated || !modeAttemptsLoading; // Guests don't need attempts
    
    // Wait for both puzzles AND attempts to finish loading
    if (!puzzlesReady || !attemptsReady) {
      console.log('[pendingPlayMode] Still waiting for data to load for mode:', pendingPlayMode, 
        '- puzzlesReady:', puzzlesReady, 'attemptsReady:', attemptsReady);
      return;
    }
    
    // Data is ready - compute completion status and navigate
    console.log('[pendingPlayMode] Data loaded, proceeding with navigation for mode:', pendingPlayMode);
    const mode = pendingPlayMode;
    setPendingPlayMode(null); // Clear pending state
    
    // Get today's puzzle from the correct mode's puzzle list
    const modePuzzles = mode === 'local' ? localPuzzles : globalPuzzles;
    const todayDate = getTodayDateString();
    const todayPuzzle = modePuzzles.find(p => p.date === todayDate);
    
    let isCompleted = false;
    let hasProgress = false;
    
    if (todayPuzzle) {
      const modeGameAttempts = mode === 'local' ? localGameAttempts : globalGameAttempts;
      
      if (isAuthenticated && modeGameAttempts) {
        const existingAttempt = modeGameAttempts.find(
          attempt => attempt.puzzleId === todayPuzzle.id
        );
        if (existingAttempt) {
          isCompleted = existingAttempt.result !== null && existingAttempt.result !== undefined;
          hasProgress = isCompleted || (existingAttempt.numGuesses ?? 0) > 0;
        }
      } else if (!isAuthenticated) {
        const storedStats = localStorage.getItem("elementle-stats");
        if (storedStats) {
          const stats = JSON.parse(storedStats);
          const formattedAnswer = formatCanonicalDate(todayPuzzle.answerDateCanonical);
          const completion = stats.puzzleCompletions?.[formattedAnswer];
          isCompleted = !!(completion && completion.completed);
          hasProgress = isCompleted;
        }
        const inProgressKey = `puzzle-progress-${formatCanonicalDate(todayPuzzle.answerDateCanonical)}`;
        const savedProgress = localStorage.getItem(inProgressKey);
        if (savedProgress) {
          const progress = JSON.parse(savedProgress);
          if (progress.guessRecords && progress.guessRecords.length > 0) {
            hasProgress = true;
          }
        }
      }
    }
    
    if (isCompleted) {
      setShowCelebrationFirst(true);
      setHasOpenedCelebration(false);
    } else {
      setShowCelebrationFirst(false);
      setHasOpenedCelebration(false);
    }
    
    setHasExistingProgress(hasProgress);
    setSelectedPuzzleId(null);
    setPreviousScreen("selection");
    setCurrentScreen("play");
  }, [pendingPlayMode, localPuzzlesLoading, globalPuzzlesLoading, loadingLocalAttempts, loadingGlobalAttempts, localPuzzles, globalPuzzles, localGameAttempts, globalGameAttempts, isAuthenticated]);

  // NOTE: The old pendingYesterdayPuzzle useEffect has been removed.
  // Streak saver navigation now fetches yesterday's puzzle directly from the API
  // in handlePlayYesterdaysPuzzle, which is more reliable than finding it in the cached list.

  // Helper to get today's date string
  const getTodayDateString = () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Get daily puzzle - uses context mode for display, explicit mode for game logic
  const getDailyPuzzle = (mode?: 'global' | 'local'): Puzzle | undefined => {
    // Use explicit mode if provided, otherwise fall back to context mode
    const puzzleList = mode 
      ? (mode === 'local' ? localPuzzles : globalPuzzles)
      : puzzles;
    
    if (puzzleList.length === 0) return undefined;
    
    const todayDate = getTodayDateString();
    
    // Try to find today's puzzle - return undefined if no puzzle for today
    // This ensures the Play button is disabled when there's no puzzle available
    return puzzleList.find(p => p.date === todayDate);
  };

  // Get puzzle by ID from the appropriate mode's puzzle list
  const getPuzzleById = (puzzleId: string, mode: 'global' | 'local'): Puzzle | undefined => {
    const puzzleList = mode === 'local' ? localPuzzles : globalPuzzles;
    return puzzleList.find(p => p.id.toString() === puzzleId);
  };

  // Current puzzle for PlayPage - uses puzzleSourceMode to ensure correct mode's data
  // Priority: 1. Streak saver puzzle (fetched directly), 2. Puzzle from list by ID, 3. Daily puzzle
  const currentPuzzle = selectedPuzzleId 
    ? (streakSaverPuzzle && streakSaverPuzzle.id.toString() === selectedPuzzleId 
        ? streakSaverPuzzle 
        : getPuzzleById(selectedPuzzleId, puzzleSourceMode)) || getDailyPuzzle(puzzleSourceMode)
    : getDailyPuzzle(puzzleSourceMode);

  const handlePlayPuzzle = (puzzleId: string) => {
    // Capture the current mode when the puzzle is selected
    // This ensures PlayPage uses the correct mode for data fetching
    const mode = isLocalMode ? 'local' : 'global';
    
    // Use the explicit mode's puzzle list (not context mode - avoids race condition)
    const puzzle = getPuzzleById(puzzleId, mode);
    if (!puzzle) return;
    
    console.log('[handlePlayPuzzle] Setting puzzleSourceMode:', mode, 'for puzzleId:', puzzleId);
    setPuzzleSourceMode(mode);
    
    // Check if this puzzle has any existing progress (completed or in-progress)
    let isCompleted = false;
    let hasProgress = false;
    
    // Use the explicit mode's game attempts (based on captured mode)
    const modeGameAttempts = mode === 'local' ? localGameAttempts : globalGameAttempts;
    const modeLoadingAttempts = mode === 'local' ? loadingLocalAttempts : loadingGlobalAttempts;
    
    if (isAuthenticated && !modeLoadingAttempts && modeGameAttempts) {
      // For authenticated users, check Supabase data
      const numericPuzzleId = parseInt(puzzleId);
      const existingAttempt = modeGameAttempts.find(
        attempt => attempt.puzzleId === numericPuzzleId
      );
      if (existingAttempt) {
        isCompleted = existingAttempt.result !== null && existingAttempt.result !== undefined;
        hasProgress = isCompleted || (existingAttempt.numGuesses ?? 0) > 0;
      }
    } else if (!isAuthenticated) {
      // For guest users, check localStorage
      const storedStats = localStorage.getItem("elementle-stats");
      if (storedStats) {
        const stats = JSON.parse(storedStats);
        // Format the canonical date to match the key format used in localStorage
        const formattedAnswer = formatCanonicalDate(puzzle.answerDateCanonical);
        const completion = stats.puzzleCompletions?.[formattedAnswer];
        isCompleted = !!(completion && completion.completed);
        hasProgress = isCompleted;
      }
      // Also check for in-progress games in localStorage
      const inProgressKey = `puzzle-progress-${formatCanonicalDate(puzzle.answerDateCanonical)}`;
      const savedProgress = localStorage.getItem(inProgressKey);
      if (savedProgress) {
        const progress = JSON.parse(savedProgress);
        if (progress.guessRecords && progress.guessRecords.length > 0) {
          hasProgress = true;
        }
      }
    }
    
    if (isCompleted) {
      // Show game screen first, then celebration
      setShowCelebrationFirst(true);
      setHasOpenedCelebration(false);
    } else {
      setShowCelebrationFirst(false);
      setHasOpenedCelebration(false);
    }
    
    setHasExistingProgress(hasProgress);
    setSelectedPuzzleId(puzzleId);
    setPreviousScreen("archive");
    setCurrentScreen("play");
  };
  
  // Version of handlePlayToday that takes explicit mode to avoid race conditions
  // This is called by handlePlayGlobal/handlePlayLocal where mode is already set
  const handlePlayTodayWithMode = (mode: 'global' | 'local') => {
    // Always set puzzleSourceMode explicitly
    setPuzzleSourceMode(mode);
    
    // Check if the mode's data is still loading
    const modePuzzlesLoading = mode === 'local' ? localPuzzlesLoading : globalPuzzlesLoading;
    const modeAttemptsLoading = mode === 'local' ? loadingLocalAttempts : loadingGlobalAttempts;
    const dataLoading = modePuzzlesLoading || modeAttemptsLoading;
    
    if (dataLoading) {
      // Data still loading - set pending state and let useEffect handle navigation when ready
      console.log('[handlePlayTodayWithMode] Data still loading, setting pending mode:', mode);
      setPendingPlayMode(mode);
      return;
    }
    
    // Data is ready - compute completion status and navigate immediately
    console.log('[handlePlayTodayWithMode] Data ready, computing completion for mode:', mode);
    
    // Get today's puzzle from the correct mode's puzzle list (using explicit mode)
    const todayPuzzle = getDailyPuzzle(mode);
    
    let isCompleted = false;
    let hasProgress = false;
    
    if (todayPuzzle) {
      // Use the explicit mode's game attempts (not context mode - avoids race condition)
      const modeGameAttempts = mode === 'local' ? localGameAttempts : globalGameAttempts;
      
      if (isAuthenticated && modeGameAttempts) {
        // For authenticated users, check Supabase data
        const existingAttempt = modeGameAttempts.find(
          attempt => attempt.puzzleId === todayPuzzle.id
        );
        if (existingAttempt) {
          isCompleted = existingAttempt.result !== null && existingAttempt.result !== undefined;
          hasProgress = isCompleted || (existingAttempt.numGuesses ?? 0) > 0;
        }
      } else if (!isAuthenticated) {
        // For guest users, check localStorage
        const storedStats = localStorage.getItem("elementle-stats");
        if (storedStats) {
          const stats = JSON.parse(storedStats);
          // Format canonical date to match the key format used in localStorage
          const formattedAnswer = formatCanonicalDate(todayPuzzle.answerDateCanonical);
          const completion = stats.puzzleCompletions?.[formattedAnswer];
          isCompleted = !!(completion && completion.completed);
          hasProgress = isCompleted;
        }
        // Also check for in-progress games in localStorage
        const inProgressKey = `puzzle-progress-${formatCanonicalDate(todayPuzzle.answerDateCanonical)}`;
        const savedProgress = localStorage.getItem(inProgressKey);
        if (savedProgress) {
          const progress = JSON.parse(savedProgress);
          if (progress.guessRecords && progress.guessRecords.length > 0) {
            hasProgress = true;
          }
        }
      }
    }
    
    if (isCompleted) {
      setShowCelebrationFirst(true);
      setHasOpenedCelebration(false);
    } else {
      setShowCelebrationFirst(false);
      setHasOpenedCelebration(false);
    }
    
    setHasExistingProgress(hasProgress);
    setSelectedPuzzleId(null);
    setPreviousScreen("selection");
    setCurrentScreen("play");
  };
  
  // Global mode handlers (always use region data)
  const handlePlayGlobal = () => {
    console.log('[handlePlayGlobal] Setting mode to global explicitly');
    setGameMode('global');
    // CRITICAL: Explicitly set puzzleSourceMode to 'global' BEFORE calling handlePlayToday
    // This avoids race condition where isLocalMode still has old value from context
    setPuzzleSourceMode('global');
    handlePlayTodayWithMode('global');
  };

  const handleStatsGlobal = () => {
    setGameMode('global');
    setStatsGameType('REGION');
    setStatsReturnScreen("selection");
    setCurrentScreen("stats");
  };

  const handleArchiveGlobal = () => {
    setGameMode('global');
    setCurrentScreen("archive");
  };

  const handleOptionsGlobal = () => {
    setGameMode('global');
    setPreviousScreen("selection");
    setCurrentScreen("options");
  };

  // Local mode handlers (always use user data)
  const handlePlayLocal = () => {
    console.log('[handlePlayLocal] Setting mode to local explicitly');
    setGameMode('local');
    // CRITICAL: Explicitly set puzzleSourceMode to 'local' BEFORE calling handlePlayToday
    // This avoids race condition where isLocalMode still has old value from context
    setPuzzleSourceMode('local');
    handlePlayTodayWithMode('local');
  };

  const handleStatsLocal = () => {
    setGameMode('local');
    setStatsGameType('USER');
    setStatsReturnScreen("selection");
    setCurrentScreen("stats");
  };

  const handleArchiveLocal = () => {
    setGameMode('local');
    setCurrentScreen("archive");
  };

  const handleOptionsLocal = () => {
    setGameMode('local');
    setPreviousScreen("selection");
    setCurrentScreen("options");
  };
  
  // Handle playing yesterday's puzzle for streak saver flow
  const handlePlayYesterdaysPuzzle = async (gameType: "region" | "user", puzzleDate: string) => {
    // Determine the explicit mode from game type
    const mode = gameType === 'region' ? 'global' : 'local';
    
    // Set the appropriate game mode
    setGameMode(mode);
    setPuzzleSourceMode(mode);
    
    console.log('[handlePlayYesterdaysPuzzle] Fetching puzzle for date:', puzzleDate, 'mode:', mode);
    
    // Show loading state
    setLoadingStreakSaverPuzzle(true);
    
    try {
      // Fetch yesterday's puzzle directly from the API (it may not be in the normal puzzle list)
      const endpoint = mode === 'local' 
        ? `/api/user/puzzles/${puzzleDate}` 
        : `/api/puzzles/${puzzleDate}`;
      
      const response = await apiRequest("GET", endpoint);
      
      if (!response.ok) {
        throw new Error("Puzzle not found");
      }
      
      const yesterdayPuzzle = await response.json() as Puzzle;
      
      console.log('[handlePlayYesterdaysPuzzle] Fetched puzzle:', yesterdayPuzzle.id, yesterdayPuzzle.eventTitle);
      
      // Store the fetched puzzle and navigate
      setStreakSaverPuzzle(yesterdayPuzzle);
      setSelectedPuzzleId(yesterdayPuzzle.id.toString());
      setShowCelebrationFirst(false);
      setHasOpenedCelebration(false);
      setHasExistingProgress(false);
      setPreviousScreen("selection");
      setCurrentScreen("play");
    } catch (error) {
      console.error('[handlePlayYesterdaysPuzzle] Error fetching puzzle:', error);
      toast({
        title: "Puzzle not available",
        description: "Yesterday's puzzle could not be loaded. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoadingStreakSaverPuzzle(false);
    }
  };
  
  // Handle login success - check if user needs first login setup
  const handleLoginSuccess = () => {
    if (isAuthenticated && !hasCompletedFirstLogin() && !hasShownGeneratingScreen) {
      // User hasn't completed first login - show GeneratingQuestionsScreen
      setNeedsFirstLoginSetup(true);
      setHasShownGeneratingScreen(true);
      setCurrentScreen("generating-questions");
    } else {
      setCurrentScreen("selection");
    }
  };
  
  // Handle completion of GeneratingQuestionsScreen (from first login)
  const handleGeneratingQuestionsComplete = async () => {
    await markFirstLoginCompleted();
    setNeedsFirstLoginSetup(false);
    setCurrentScreen("selection");
  };
  
  // Track spinner state for auth loading
  const authSpinnerShownRef = useRef(false);
  
  // Auth loading spinner timeout callbacks
  const handleAuthRetry = useCallback(() => {
    console.log('[Home] Auth spinner timeout - page will reload for retry');
  }, []);
  
  const handleAuthTimeout = useCallback(() => {
    console.log('[Home] Auth spinner timeout - failed to load');
    toast({
      title: 'Failed to load',
      description: 'Please try again in a bit.',
      variant: 'destructive',
    });
    window.location.reload();
  }, [toast]);
  
  // Spinner with timeout for auth loading
  const authSpinner = useSpinnerWithTimeout({
    retryDelayMs: 4000,
    timeoutMs: 8000,
    onRetry: handleAuthRetry,
    onTimeout: handleAuthTimeout,
  });
  
  // Puzzle loading spinner timeout callbacks
  const handlePuzzleRetry = useCallback(() => {
    console.log('[Home] Puzzle spinner timeout - triggering retry');
    refetchPuzzles();
  }, [refetchPuzzles]);
  
  const handlePuzzleTimeout = useCallback(() => {
    console.log('[Home] Puzzle spinner timeout - failed to load');
    toast({
      title: 'Failed to load',
      description: 'Please try again in a bit.',
      variant: 'destructive',
    });
    setCurrentScreen("selection");
  }, [toast]);
  
  // Spinner with timeout for puzzle loading
  const puzzleSpinner = useSpinnerWithTimeout({
    retryDelayMs: 4000,
    timeoutMs: 8000,
    onRetry: handlePuzzleRetry,
    onTimeout: handlePuzzleTimeout,
  });
  
  // Show spinner during auth loading - with 150ms delay to avoid flash on fast loads
  useEffect(() => {
    if (isLoading && !authSpinnerShownRef.current) {
      authSpinner.start(150);
      authSpinnerShownRef.current = true;
    } else if (!isLoading && authSpinnerShownRef.current) {
      authSpinner.complete();
      authSpinnerShownRef.current = false;
    }
  }, [isLoading, authSpinner]);
  
  // Track puzzle spinner state
  const puzzleSpinnerShownRef = useRef(false);
  
  // Manage puzzle loading spinner when on play screen without puzzle
  useEffect(() => {
    const isPuzzleLoading = currentScreen === "play" && !currentPuzzle;
    
    if (isPuzzleLoading && !puzzleSpinnerShownRef.current) {
      puzzleSpinner.start(150);
      puzzleSpinnerShownRef.current = true;
    } else if (!isPuzzleLoading && puzzleSpinnerShownRef.current) {
      puzzleSpinner.complete();
      puzzleSpinnerShownRef.current = false;
    }
  }, [currentScreen, currentPuzzle, puzzleSpinner]);

  // While auth is loading, show minimal loading state (spinner overlay handles the visual)
  if (isLoading) {
    return (
      <div className="min-h-screen" data-testid="auth-loading" />
    );
  }

  if (showSplash) {
    return (
      <AdBannerContext.Provider value={false}>
        <SplashScreen 
          onLogin={() => setCurrentScreen("login")}
          onSignup={() => setCurrentScreen("signup")}
        />
      </AdBannerContext.Provider>
    );
  }

  // Screens where ad banner should never appear (splash, welcome, play/intro, login, signup, forgot-password, generating-questions)
  const hideAdOnScreens: Screen[] = ["splash", "welcome", "play", "login", "signup", "forgot-password", "generating-questions"];
  const shouldShowAd = !hideAdOnScreens.includes(currentScreen);

  return (
    <AdBannerContext.Provider value={shouldShowAd}>
      <div className="relative w-full min-h-screen bg-background">
        <AnimatePresence mode="popLayout">
        {currentScreen === "welcome" && (
          <motion.div key="welcome" className="w-full" {...pageVariants.fadeIn} transition={pageTransition}>
            <WelcomePage 
              onLogin={() => {
                setShowAuthButtons(false);
                setCurrentScreen("login");
              }}
              onSignup={() => {
                setShowAuthButtons(false);
                setCurrentScreen("signup");
              }}
              onContinueAsGuest={() => {
                setShowAuthButtons(false);
                setCurrentScreen("selection");
              }}
              showAuthButtons={showAuthButtons}
            />
          </motion.div>
        )}

        {currentScreen === "login" && (
          <motion.div key="login" className="w-full" {...pageVariants.fadeIn} transition={pageTransition}>
            <AuthPage 
              mode="login"
              onSuccess={handleLoginSuccess}
              onSwitchMode={() => setCurrentScreen("signup")}
              onBack={() => setCurrentScreen("welcome")}
              onForgotPassword={() => setCurrentScreen("forgot-password")}
              onContinueAsGuest={() => setCurrentScreen("selection")}
            />
          </motion.div>
        )}

        {currentScreen === "signup" && (
          <motion.div key="signup" className="w-full" {...pageVariants.fadeIn} transition={pageTransition}>
            <AuthPage 
              mode="signup"
              onSuccess={() => setCurrentScreen("selection")}
              onSwitchMode={() => setCurrentScreen("login")}
              onBack={() => setCurrentScreen("welcome")}
              onContinueAsGuest={() => setCurrentScreen("selection")}
            />
          </motion.div>
        )}

        {currentScreen === "forgot-password" && (
          <motion.div key="forgot-password" className="absolute w-full top-0 left-0" {...pageVariants.slideRight} transition={pageTransition}>
            <ForgotPasswordPage 
              onBack={() => setCurrentScreen("login")}
            />
          </motion.div>
        )}

        {currentScreen === "generating-questions" && user && (
          <motion.div key="generating-questions" className="w-full" {...pageVariants.fadeIn} transition={pageTransition}>
            <GeneratingQuestionsScreen
              userId={user.id}
              region={profile?.region || "GB"}
              postcode={profile?.postcode || ""}
              onComplete={handleGeneratingQuestionsComplete}
              regenerationType="first_login"
            />
          </motion.div>
        )}

        {currentScreen === "selection" && (
          <motion.div key="selection" className="w-full" {...pageVariants.fadeIn} transition={pageTransition}>
            <GameSelectionPage 
              onPlayGame={handlePlayGlobal}
              onViewStats={handleStatsGlobal}
              onViewArchive={handleArchiveGlobal}
              onOpenSettings={() => setCurrentScreen("settings")}
              onOpenOptions={handleOptionsGlobal}
              onLogin={() => setCurrentScreen("login")}
              onRegister={() => setCurrentScreen("signup")}
              todayPuzzleId={getDailyPuzzle()?.id}
              todayPuzzleAnswerDateCanonical={getDailyPuzzle()?.answerDateCanonical}
              onPlayGameLocal={handlePlayLocal}
              onViewStatsLocal={handleStatsLocal}
              onViewArchiveLocal={handleArchiveLocal}
              onOpenOptionsLocal={handleOptionsLocal}
              onPlayYesterdaysPuzzle={handlePlayYesterdaysPuzzle}
              onViewStatsWithBadge={(badge, gameType) => {
                setNewlyAwardedBadge(badge);
                setStatsGameType(gameType);
                setStatsReturnScreen("selection");
                setCurrentScreen("stats");
              }}
            />
          </motion.div>
        )}

        {currentScreen === "play" && currentPuzzle && (
          <motion.div key="play" className="absolute w-full top-0 left-0" {...pageVariants.slideLeft} transition={pageTransition}>
            <PlayPage
              puzzleId={currentPuzzle.id}
              puzzleDate={currentPuzzle.date}
              answerDateCanonical={currentPuzzle.answerDateCanonical}
              eventTitle={currentPuzzle.eventTitle}
              eventDescription={currentPuzzle.eventDescription}
              category={currentPuzzle.category}
              clue1={currentPuzzle.clue1}
              clue2={currentPuzzle.clue2}
              maxGuesses={5}
              fromArchive={previousScreen === "archive"}
              hasExistingProgress={hasExistingProgress}
              showCelebrationFirst={showCelebrationFirst}
              hasOpenedCelebration={hasOpenedCelebration}
              puzzleSourceMode={puzzleSourceMode}
              onSetHasOpenedCelebration={setHasOpenedCelebration}
              onBack={() => {
                // Clear streak saver puzzle state to prevent stale navigation
                setStreakSaverPuzzle(null);
                setCurrentScreen(previousScreen === "archive" ? "archive" : "selection");
              }}
              onHomeFromCelebration={() => {
                setShowCelebrationFirst(false);
                setCurrentScreen("selection");
              }}
              onViewStats={() => {
                setStatsReturnScreen("play");
                setCurrentScreen("stats");
              }}
              onViewArchive={() => setCurrentScreen("archive")}
            />
          </motion.div>
        )}

        {currentScreen === "play" && !currentPuzzle && (
          <div className="min-h-screen" data-testid="puzzle-loading" />
        )}

        {currentScreen === "stats" && (
          <motion.div key="stats" className="absolute w-full top-0 left-0" {...pageVariants.slideLeft} transition={pageTransition}>
            <StatsPage 
              onBack={() => {
                setNewlyAwardedBadge(null);
                setCurrentScreen(statsReturnScreen);
              }}
              gameType={statsGameType}
              newlyAwardedBadge={newlyAwardedBadge}
              onBadgeAnimationComplete={() => setNewlyAwardedBadge(null)}
            />
          </motion.div>
        )}

        {currentScreen === "archive" && (
          <motion.div key="archive" className="absolute w-full top-0 left-0" {...pageVariants.slideLeft} transition={pageTransition}>
            <ArchivePage 
              onBack={() => {
                setArchiveMonthContext(null);
                setCurrentScreen("selection");
              }}
              onPlayPuzzle={handlePlayPuzzle}
              puzzles={puzzles as any[]}
              initialMonth={archiveMonthContext}
              onMonthChange={setArchiveMonthContext}
            />
          </motion.div>
        )}

        {currentScreen === "settings" && (
          <motion.div key="settings" className="absolute w-full top-0 left-0" {...pageVariants.slideDown} transition={pageTransition}>
            <SettingsPage 
              onBack={() => setCurrentScreen("selection")}
              onOpenOptions={() => {
                setPreviousScreen("settings");
                setCurrentScreen("options");
              }}
              onAccountInfo={() => setCurrentScreen("account-info")}
              onBugReport={() => setCurrentScreen("bug-report")}
              onFeedback={() => setCurrentScreen("feedback")}
              onPrivacy={() => setCurrentScreen("privacy")}
              onTerms={() => setCurrentScreen("terms")}
              onAbout={() => setCurrentScreen("about")}
              onSignOut={() => {
                setShowAuthButtons(true);
                setCurrentScreen("welcome");
              }}
              onLogin={() => setCurrentScreen("login")}
              onRegister={() => setCurrentScreen("signup")}
            />
          </motion.div>
        )}

        {currentScreen === "options" && (
          <motion.div key="options" className="absolute w-full top-0 left-0" {...pageVariants.slideLeft} transition={pageTransition}>
            <OptionsPage 
              onBack={() => setCurrentScreen(previousScreen)}
            />
          </motion.div>
        )}

        {currentScreen === "account-info" && (
          <motion.div key="account-info" className="absolute w-full top-0 left-0" {...pageVariants.slideLeft} transition={pageTransition}>
            <AccountInfoPage 
              onBack={() => setCurrentScreen("settings")}
            />
          </motion.div>
        )}

        {currentScreen === "bug-report" && (
          <motion.div key="bug-report" className="absolute w-full top-0 left-0" {...pageVariants.slideLeft} transition={pageTransition}>
            <BugReportForm onBack={() => setCurrentScreen("settings")} />
          </motion.div>
        )}

        {currentScreen === "feedback" && (
          <motion.div key="feedback" className="absolute w-full top-0 left-0" {...pageVariants.slideLeft} transition={pageTransition}>
            <FeedbackForm onBack={() => setCurrentScreen("settings")} />
          </motion.div>
        )}

        {currentScreen === "privacy" && (
          <motion.div key="privacy" className="absolute w-full top-0 left-0" {...pageVariants.slideLeft} transition={pageTransition}>
            <PrivacyPage onBack={() => setCurrentScreen("settings")} />
          </motion.div>
        )}

        {currentScreen === "terms" && (
          <motion.div key="terms" className="absolute w-full top-0 left-0" {...pageVariants.slideLeft} transition={pageTransition}>
            <TermsPage onBack={() => setCurrentScreen("settings")} />
          </motion.div>
        )}

        {currentScreen === "about" && (
          <motion.div key="about" className="absolute w-full top-0 left-0" {...pageVariants.slideLeft} transition={pageTransition}>
            <AboutPage onBack={() => setCurrentScreen("settings")} />
          </motion.div>
        )}
      </AnimatePresence>
      </div>
      <AdBanner />
    </AdBannerContext.Provider>
  );
}
