import { useState, useEffect, useCallback, useRef, useMemo, useLayoutEffect } from "react";
import { InputGrid, type CellFeedback } from "./InputGrid";
import { NumericKeyboard, type KeyState } from "./NumericKeyboard";
import { EndGameModal } from "./EndGameModal";
import { HelpDialog } from "./HelpDialog";
import { StreakCelebrationPopup } from "./StreakCelebrationPopup";
import { StreakSaverExitWarning } from "./StreakSaverExitWarning";
import { IntroScreen } from "./IntroScreen";
import { useInterstitialAd } from "./InterstitialAd";
import { BadgeCelebrationPopup } from "./badges";
import { useBadgeChecker } from "@/hooks/useBadgeChecker";
import type { UserBadgeWithDetails } from "@shared/schema";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ChevronLeft, Umbrella } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import { useGameData } from "@/hooks/useGameData";
import { useUserStats } from "@/hooks/useUserStats";
import { useUserSettings } from "@/hooks/useUserSettings";
import { useStreakSaverStatus } from "@/hooks/useStreakSaverStatus";
import { useStreakSaver } from "@/contexts/StreakSaverContext";
import { useGuessCache } from "@/contexts/GuessCacheContext";
import { useUserDateFormat } from "@/hooks/useUserDateFormat";
import { useGameMode } from "@/contexts/GameModeContext";
import { useSpinner, useSpinnerWithTimeout } from "@/lib/SpinnerProvider";
import { useToast } from "@/hooks/use-toast";
import { parseUserDateWithContext, formatCanonicalDate as formatCanonicalDateUtil } from "@/lib/dateFormat";
import greyHelpIcon from "@assets/Grey-Help-Grey_1760979822771.png";
import whiteHelpIcon from "@assets/White-Help-DarkMode.svg";
import mechanicHamsterGrey from "@assets/Mechanic-Hamster-Grey.svg";
import { readLocal, writeLocal, CACHE_KEYS } from "@/lib/localCache";
import { getSupabaseClient } from "@/lib/supabaseClient";
import { motion, AnimatePresence } from "framer-motion";
import { pageVariants, pageTransition } from "@/lib/pageAnimations";

interface PlayPageProps {
  answerDateCanonical: string; // YYYY-MM-DD format - the canonical historical date
  eventTitle: string;
  eventDescription: string;
  category?: string; // Only present in Local mode (user-specific puzzles)
  clue1?: string;
  clue2?: string;
  maxGuesses?: number;
  viewOnly?: boolean;
  puzzleId?: number;
  puzzleDate?: string; // The date this puzzle should be played (YYYY-MM-DD format)
  fromArchive?: boolean;
  hasExistingProgress?: boolean; // Whether the game has any existing guesses or is completed
  skipIntro?: boolean; // Whether to skip the intro screen (e.g., when coming from OnboardingScreen)
  showCelebrationFirst?: boolean;
  hasOpenedCelebration?: boolean;
  puzzleSourceMode?: 'global' | 'local'; // Explicit mode from parent - overrides context when set
  onBack: () => void;
  onHomeFromCelebration?: () => void;
  onSetHasOpenedCelebration?: (value: boolean) => void;
  onViewStats?: () => void;
  onViewArchive?: () => void;
  onContinueToLogin?: () => void; // For guest users after game ends
}

interface GuessRecord {
  guessValue: string;
  feedbackResult: CellFeedback[];
  categoryName?: string | null; // add this field
}

type AllocatedGuessRow = {
  id: number;
  gameAttemptId: number;
  guessValue: string;
  slot_type: string;
  category_id: number | null;
  categories?: { name: string } | null;
};

export function PlayPage({
  answerDateCanonical,
  eventTitle,
  eventDescription,
  category,
  clue1,
  clue2,
  maxGuesses = 5,
  viewOnly = false,
  puzzleId,
  puzzleDate,
  fromArchive = false,
  hasExistingProgress = false,
  skipIntro = false,
  showCelebrationFirst = false,
  hasOpenedCelebration = false,
  puzzleSourceMode,
  onBack,
  onHomeFromCelebration,
  onSetHasOpenedCelebration,
  onViewStats,
  onViewArchive,
  onContinueToLogin,
}: PlayPageProps) {
  const { user, isAuthenticated } = useAuth();
  const { toast } = useToast();
  // Pass puzzleSourceMode to useGameData to ensure we fetch from the correct tables
  const { gameAttempts, getAllGuesses, loadingAttempts } = useGameData(
    puzzleSourceMode ? { modeOverride: puzzleSourceMode } : undefined
  );
  const { stats: supabaseStats } = useUserStats();
  const { settings } = useUserSettings();
  const { holidayActive, holidayEndDate, endHoliday, isEndingHoliday, useStreakSaver: useStreakSaverMutation, declineStreakSaver, refetch: refetchStreakStatus } = useStreakSaverStatus();
  const { isInStreakSaverMode, session: streakSaverSession, completeStreakSaverSession, cancelStreakSaverSession } = useStreakSaver();
  const { getGuessesForPuzzle, setGuessesForPuzzle, addGuessToCache } = useGuessCache();
  const { isLocalMode: contextIsLocalMode } = useGameMode();
  
  // Use explicit puzzleSourceMode if provided, otherwise fall back to context mode
  // This ensures we use the correct mode that was active when the puzzle was selected
  const isLocalMode = puzzleSourceMode ? puzzleSourceMode === 'local' : contextIsLocalMode;
  
  // Debug logging to help trace mode issues (CRITICAL for detecting cross-contamination bugs)
  // Log once on mount and when mode changes
  useEffect(() => {
    console.log('[PlayPage] Mode configuration:', {
      puzzleSourceMode,
      contextIsLocalMode,
      resolvedIsLocalMode: isLocalMode,
      puzzleId,
      puzzleDate,
      willUseEndpoint: isLocalMode ? '/api/user/*' : '/api/*'
    });
  }, [puzzleSourceMode, contextIsLocalMode, isLocalMode, puzzleId, puzzleDate]);
  
  // Cache mode for guess cache operations - must match the data source mode
  const cacheMode: 'global' | 'local' = isLocalMode ? 'local' : 'global';
  const { showAd, triggerAd, handleClose: closeInterstitialAd, InterstitialAdComponent } = useInterstitialAd();
  
  // Get user's date format preferences
  const {
    formatCanonicalDate,
    parseUserDate,
    validateGuess,
    formatWithOrdinal,
    placeholders,
    numDigits,
    dateFormat,
    isLoading: formatLoading
  } = useUserDateFormat();
  
  // Format the answer in user's preferred format (e.g., "010125" or "01011925")
  const formattedAnswer = formatCanonicalDate(answerDateCanonical);
  
  // Helper function to check if this puzzle is today's puzzle
  const isPlayingTodaysPuzzle = (): boolean => {
    if (!puzzleDate) return false;
    
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    const todayDate = `${year}-${month}-${day}`;
    
    return puzzleDate === todayDate;
  };
  const [currentInput, setCurrentInput] = useState("");
  const [guesses, setGuesses] = useState<CellFeedback[][]>([]);
  const [keyStates, setKeyStates] = useState<Record<string, KeyState>>({});
  const [gameOver, setGameOver] = useState(false);
  const [isWin, setIsWin] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [cluesEnabled, setCluesEnabled] = useState(true);
  const [wrongGuessCount, setWrongGuessCount] = useState(0);
  const [guessRecords, setGuessRecords] = useState<GuessRecord[]>([]);
  const [showStreakCelebration, setShowStreakCelebration] = useState(false);
  const [currentStreak, setCurrentStreak] = useState(0);
  const [showCelebrationModal, setShowCelebrationModal] = useState(false);
  const [pendingEndModal, setPendingEndModal] = useState(false); // Track if EndGameModal should show after streak celebration
  const [earnedBadge, setEarnedBadge] = useState<UserBadgeWithDetails | null>(null);
  const [pendingBadgeCheck, setPendingBadgeCheck] = useState(false); // Track if badge check should run after streak celebration
  const [finalGuessCount, setFinalGuessCount] = useState<number | null>(null); // Store final guess count when game ends - prevents race condition issues
  const [endModalDelayElapsed, setEndModalDelayElapsed] = useState(false); // Track when 2.5s delay has passed
  const [endModalReady, setEndModalReady] = useState(false); // Track when modal data is ready to show
  
  // Badge checker hook
  const { checkAllBadgesOnGameComplete } = useBadgeChecker();
  const [currentGameAttemptId, setCurrentGameAttemptId] = useState<number | null>(null);
  const [showEndModal, setShowEndModal] = useState(false);
  const [lockedDigits, setLockedDigits] = useState<string | null>(null);
  const [digitsCheckComplete, setDigitsCheckComplete] = useState(false);
  const [showIntroScreen, setShowIntroScreen] = useState(false);
  const [introExitingViaBack, setIntroExitingViaBack] = useState(false); // Track if IntroScreen is animating off via back button
  const introScreenChecked = useRef(false); // Track if we've already made the intro screen decision
  
  // Streak saver exit warning dialog state
  const [showStreakSaverExitWarning, setShowStreakSaverExitWarning] = useState(false);
  
  // Holiday mode warning dialog state
  const [showHolidayWarning, setShowHolidayWarning] = useState(false);
  const [holidayWarningDismissed, setHolidayWarningDismissed] = useState(false);
  
  // Track when guesses are being fetched asynchronously
  const [guessesLoading, setGuessesLoading] = useState(false);
  // Track when guesses have fully loaded (for triggering the 0.6s delay)
  const [guessesLoaded, setGuessesLoaded] = useState(false);
  
  // Delay showing grid data for games with existing progress (smoother transition)
  // Starts false and only becomes true 0.6s AFTER guesses have loaded
  const [gridDataReady, setGridDataReady] = useState(false);
  
  // Track spinner state for game loading
  const gameLoadingSpinnerRef = useRef(false);
  
  // Track dark mode state for background color
  const [isDarkMode, setIsDarkMode] = useState(() => 
    document.documentElement.classList.contains('dark')
  );
  
  // Listen for dark mode changes
  useEffect(() => {
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.attributeName === 'class') {
          setIsDarkMode(document.documentElement.classList.contains('dark'));
        }
      });
    });
    
    observer.observe(document.documentElement, { attributes: true });
    return () => observer.disconnect();
  }, []);
  
  // Background color that adapts to dark mode
  // Light mode: #FAFAFA (near white), Dark mode: hsl(222, 47%, 11%) = dark blue
  const pageBackgroundColor = isDarkMode ? 'hsl(222, 47%, 11%)' : '#FAFAFA';
  
  // Show EndGameModal when both delay has elapsed AND modal is ready
  // This ensures minimum 2.5s delay without adding delay on top of async work
  useEffect(() => {
    if (endModalDelayElapsed && endModalReady && !showEndModal && !showStreakCelebration) {
      setShowEndModal(true);
    }
  }, [endModalDelayElapsed, endModalReady, showEndModal, showStreakCelebration]);
  
  // Spinner timeout callbacks for game loading
  const handleGameLoadRetry = useCallback(() => {
    console.log('[PlayPage] Game loading spinner timeout - triggering retry');
    // Force re-check by invalidating and refetching
    window.location.reload();
  }, []);
  
  const handleGameLoadTimeout = useCallback(() => {
    console.log('[PlayPage] Game loading spinner timeout - failed to load');
    toast({
      title: 'Failed to load',
      description: 'Please try again in a bit.',
      variant: 'destructive',
    });
    onBack();
  }, [toast, onBack]);
  
  // Check if this is a streak saver game in progress
  const isCurrentStreakSaverGame = isInStreakSaverMode && streakSaverSession && !gameOver;
  
  // Handle back button press - show warning if in streak saver mode
  const handleBackButtonPress = useCallback(() => {
    if (isCurrentStreakSaverGame) {
      setShowStreakSaverExitWarning(true);
    } else {
      onBack();
    }
  }, [isCurrentStreakSaverGame, onBack]);
  
  // Spinner for cancel streak saver operation
  const { showSpinner, hideSpinner } = useSpinner();
  
  // Handle cancel streak saver and lose streak
  // This is called when user confirms they want to exit without completing the puzzle
  // The streak is reset to 0 but the streak saver is NOT consumed
  const handleCancelStreakSaver = useCallback(async () => {
    setShowStreakSaverExitWarning(false);
    
    // Show spinner during async operations
    showSpinner();
    
    // Reset streak via decline API (does NOT use a streak saver)
    if (streakSaverSession) {
      try {
        console.log('[CancelStreakSaver] Declining streak saver - resetting streak without consuming saver');
        await declineStreakSaver(streakSaverSession.gameType);
        // Refetch streak status to update UI
        await refetchStreakStatus();
      } catch (error) {
        console.error('[CancelStreakSaver] Failed to decline streak saver:', error);
      }
    }
    
    // Clear the session context
    cancelStreakSaverSession();
    
    // Hide spinner before navigating back
    hideSpinner();
    onBack();
  }, [streakSaverSession, declineStreakSaver, refetchStreakStatus, cancelStreakSaverSession, onBack, showSpinner, hideSpinner]);
  
  // Handle continue playing - reset exit animation state and close dialog
  const handleContinuePlaying = useCallback(() => {
    setShowStreakSaverExitWarning(false);
    // Reset the exit animation state so the IntroScreen content is visible again
    setIntroExitingViaBack(false);
  }, []);
  
  // Spinner with timeout for game loading
  // Note: /api/puzzles can take 5-7 seconds, so we use a generous 15s timeout
  const gameLoadingSpinner = useSpinnerWithTimeout({
    retryDelayMs: 6000,
    timeoutMs: 15000,
    onRetry: handleGameLoadRetry,
    onTimeout: handleGameLoadTimeout,
  });
  
  
  // Check if game is loading based on actual data loading states
  // Show spinner when: format loading, attempts loading, or guesses being fetched
  // But NEVER show spinner when game is already over (prevents spinner after win/loss)
  const isGameLoading = !gameOver && (formatLoading || loadingAttempts || guessesLoading);
  
  // Manage game loading spinner with timeout
  useEffect(() => {
    if (isGameLoading && !gameLoadingSpinnerRef.current) {
      console.log('[PlayPage] Showing spinner with timeout - waiting for game data');
      gameLoadingSpinner.start(0);
      gameLoadingSpinnerRef.current = true;
    } else if (!isGameLoading && gameLoadingSpinnerRef.current) {
      console.log('[PlayPage] Game data loaded - completing spinner');
      gameLoadingSpinner.complete();
      gameLoadingSpinnerRef.current = false;
    }
    
    // Cleanup on unmount
    return () => {
      if (gameLoadingSpinnerRef.current) {
        gameLoadingSpinner.cancel();
        gameLoadingSpinnerRef.current = false;
      }
    };
  }, [isGameLoading, gameLoadingSpinner]);
  
  // Ref to always have the latest puzzleId (prevents stale closure issues)
  const puzzleIdRef = useRef<number | undefined>(puzzleId);
  useEffect(() => {
    puzzleIdRef.current = puzzleId;
  }, [puzzleId]);
  
  // Queue for pending guesses that failed to save (for retry)
  const pendingGuessesRef = useRef<Array<{ attemptId: number; guess: GuessRecord }>>([]);

  // Use locked digits if available, otherwise use user's current preference
  const activeNumDigits = lockedDigits ? parseInt(lockedDigits) : numDigits;

  // Generate active placeholders based on locked digit mode
  const activePlaceholders = useMemo(() => {
    const yearDigits = activeNumDigits === 8 ? 4 : 2;
    const yearPlaceholders = Array(yearDigits).fill('Y');
    
    // Respect the user's region preference (DD/MM or MM/DD)
    if (dateFormat.startsWith('dd')) {
      return ['D', 'D', 'M', 'M', ...yearPlaceholders];
    } else {
      return ['M', 'M', 'D', 'D', ...yearPlaceholders];
    }
  }, [activeNumDigits, dateFormat]);

  // Format the answer in the active digit mode
  const activeFormattedAnswer = useMemo(() => {
    // Create a date format string that matches the active digit mode
    const activeFormat = activeNumDigits === 8 
      ? (dateFormat.startsWith('dd') ? 'ddmmyyyy' : 'mmddyyyy')
      : (dateFormat.startsWith('dd') ? 'ddmmyy' : 'mmddyy');
    
    return formatCanonicalDateUtil(answerDateCanonical, activeFormat as any);
  }, [answerDateCanonical, activeNumDigits, dateFormat]);

  // Check if current input is a valid date (memoized to avoid recomputation)
  const isValidGuess = useMemo(() => {
    if (currentInput.length !== activeNumDigits) {
      return false;
    }
    // parseUserDate from useUserDateFormat already has format baked in
    return parseUserDate(currentInput) !== null;
  }, [currentInput, activeNumDigits, parseUserDate]);

  // Load clues setting from Supabase or localStorage
  useEffect(() => {
    if (isAuthenticated && settings) {
      setCluesEnabled(settings.cluesEnabled ?? true);
    } else if (!isAuthenticated) {
      const storedCluesEnabled = localStorage.getItem("cluesEnabled");
      setCluesEnabled(storedCluesEnabled ? storedCluesEnabled === "true" : true);
    }
  }, [isAuthenticated, settings]);

  // Reset state when answerDateCanonical changes
  // Note: This runs before loadCompletedPuzzle, so completed puzzles will reload their guesses after reset
  useEffect(() => {
    setCurrentInput("");
    setGuesses([]);
    setKeyStates({});
    setGameOver(false);
    setIsWin(false);
    setWrongGuessCount(0);
    setGuessRecords([]);
    setCurrentGameAttemptId(null);
    setShowEndModal(false);
    setFinalGuessCount(null);
    setLockedDigits(null);
    setDigitsCheckComplete(false);
    setShowIntroScreen(false);
    introScreenChecked.current = false; // Reset so intro screen can show for new puzzle
    // Reset loading and ready states
    setGuessesLoading(false);
    setGuessesLoaded(false);
    setGridDataReady(false);
    // Reset holiday warning state for new puzzle
    setHolidayWarningDismissed(false);
    setShowHolidayWarning(false);
  }, [answerDateCanonical]);
  
  // Show holiday warning popup when playing today's puzzle while holiday mode is active
  // Applies to both Global and Local puzzles since streaks work the same way
  // Wait for spinner to finish, then delay 300ms before showing popup
  useEffect(() => {
    if (
      holidayActive &&
      isPlayingTodaysPuzzle() &&
      !gameOver &&
      !holidayWarningDismissed &&
      !showHolidayWarning &&
      !isGameLoading // Wait for spinner to finish
    ) {
      const timer = setTimeout(() => {
        setShowHolidayWarning(true);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [holidayActive, puzzleDate, gameOver, holidayWarningDismissed, showHolidayWarning, isGameLoading]);
  
  // Delay showing grid data after guesses have loaded (smoother page transition)
  // Only applies to games with existing progress - triggers 0.6s after guesses load
  useEffect(() => {
    if (guessesLoaded && !gridDataReady) {
      const timer = setTimeout(() => {
        setGridDataReady(true);
      }, 600); // 0.6 second delay after guesses load
      
      return () => clearTimeout(timer);
    }
  }, [guessesLoaded, gridDataReady]);
  
  // For new games (no existing progress), show grid immediately
  // This runs after attempts are checked and no prior attempt is found
  useEffect(() => {
    if (!hasExistingProgress && digitsCheckComplete && !gridDataReady) {
      setGridDataReady(true);
    }
  }, [hasExistingProgress, digitsCheckComplete, gridDataReady]);

  // Check if puzzle is already completed and redirect if needed
  // IMPORTANT: Skip if gameOver is already true - means we just completed the game in this session
  // and already have the correct guesses in state. Re-running would cause a race condition where
  // stale data from cache/DB overwrites the correct guesses.
  useEffect(() => {
    let mounted = true;
    
    const loadCompletedPuzzle = async () => {
      // Skip if game is already over in this session - we already have correct state
      if (gameOver) return;
      
      if (!viewOnly && !loadingAttempts) {
        if (isAuthenticated && gameAttempts && puzzleId) {
          // For authenticated users, check Supabase data using result !== null as completion check
          const completedAttempt = gameAttempts.find(
            attempt => attempt.puzzleId === puzzleId && attempt.result !== null
          );
          
          if (completedAttempt && mounted) {
            // Puzzle already completed - set to view-only mode
            setGameOver(true);
            setShowEndModal(true); // Show modal immediately for completed puzzles
            // Defensive normalization: handle both "won"/"lost" (current) and "win"/"loss" (legacy)
            const isWinResult = completedAttempt.result === "won" || completedAttempt.result === "win";
            setIsWin(isWinResult);
            // Set finalGuessCount immediately from attempt data to prevent race condition
            // where user clicks Continue before guesses are loaded from async operation
            if (completedAttempt.numGuesses != null) {
              setFinalGuessCount(completedAttempt.numGuesses);
            }
            
            // Lock digit mode from the completed attempt if it's set
            if ((completedAttempt as any).digits) {
              console.log('[loadCompletedPuzzle] Locking digit mode to:', (completedAttempt as any).digits);
              setLockedDigits((completedAttempt as any).digits);
            }
            setDigitsCheckComplete(true);
            
            // Try to load guesses from cache first for faster loading (using mode-aware cache)
            const cachedGuesses = puzzleId ? getGuessesForPuzzle(puzzleId, cacheMode) : null;
            let attemptGuesses = cachedGuesses;
            
            if (!cachedGuesses) {
              // Cache miss - need to fetch from Supabase
              setGuessesLoading(true);
              try {
                const allGuesses = await getAllGuesses();
                attemptGuesses = allGuesses.filter(g => g.gameAttemptId === completedAttempt.id);
                
                // Always cache results (including empty arrays) to avoid refetching
                if (puzzleId) {
                  setGuessesForPuzzle(puzzleId, cacheMode, attemptGuesses || []);
                }
              } finally {
                if (mounted) {
                  setGuessesLoading(false);
                }
              }
            }
            
            if (mounted && attemptGuesses && attemptGuesses.length > 0) {
              // Recalculate feedback client-side (not stored in DB)
              // Convert canonical guesses from DB using LOCKED digit mode, not current preference
              
              // Create format based on locked digit mode from attempt
              const lockedDigits = (completedAttempt as any).digits || '6';
              const baseFormat = dateFormat.startsWith('dd') ? 'dd' : 'mm';
              const lockedFormat = lockedDigits === '8' 
                ? (baseFormat === 'dd' ? 'ddmmyyyy' : 'mmddyyyy')
                : (baseFormat === 'dd' ? 'ddmmyy' : 'mmddyy');
              
              let newKeyStates: Record<string, KeyState> = {};
              const feedbackArrays = attemptGuesses.map(guess => {
                // Convert canonical format (YYYY-MM-DD) using LOCKED digit mode
                const displayFormat = formatCanonicalDateUtil(guess.guessValue, lockedFormat as any);
                const feedback = calculateFeedbackForGuess(displayFormat, newKeyStates);
                newKeyStates = updateKeyStates(displayFormat, feedback, newKeyStates);
                return feedback;
              });
              setGuesses(feedbackArrays);
              setKeyStates(newKeyStates);
              // Set final guess count for completed puzzles (fixes bug where count shows 0 when returning from Archive)
              setFinalGuessCount(feedbackArrays.length);
              
              // Reconstruct guess records for display with recalculated feedback
              const records: GuessRecord[] = [];
              let recordKeyStates: Record<string, KeyState> = {};
              for (const guess of attemptGuesses) {
                // Convert canonical format using LOCKED digit mode
                const displayFormat = formatCanonicalDateUtil(guess.guessValue, lockedFormat as any);
                const feedback = calculateFeedbackForGuess(displayFormat, recordKeyStates);
                recordKeyStates = updateKeyStates(displayFormat, feedback, recordKeyStates);
                records.push({
                  guessValue: displayFormat,
                  feedbackResult: feedback,
                  categoryName: (guess as any).categoryName ?? null
                });
              }
              setGuessRecords(records);
              // Mark guesses as loaded to trigger the 0.6s delay
              setGuessesLoaded(true);
            } else if (mounted) {
              // No guesses found but attempt exists - mark as loaded
              setGuessesLoaded(true);
            }
          } else if (mounted) {
            // No completed attempt found for authenticated users
            setDigitsCheckComplete(true);
            // Mark guesses as loaded so grid can show for new games
            setGuessesLoaded(true);
          }
        } else {
          // For guest users, check localStorage
          const storedStats = localStorage.getItem("elementle-stats");
          if (storedStats) {
            const stats = JSON.parse(storedStats);
            const completion = stats.puzzleCompletions?.[formattedAnswer];
            
            if (completion && completion.completed && mounted) {
              // Puzzle already completed - set to view-only mode
              setGameOver(true);
              setIsWin(completion.won);
              if (completion.guesses && Array.isArray(completion.guesses)) {
                const feedbackArrays = completion.guesses.map((gr: GuessRecord) => gr.feedbackResult);
                setGuesses(feedbackArrays);
                setGuessRecords(completion.guesses);
                // Set final guess count for completed puzzles (fixes bug where count shows 0 when returning from Archive)
                setFinalGuessCount(feedbackArrays.length);
              }
              // Guest data is sync from localStorage - mark as loaded immediately
              setGuessesLoaded(true);
            }
          }
          // For guest users, always mark digits check complete and guesses loaded (no database to check)
          if (mounted) {
            setDigitsCheckComplete(true);
            setGuessesLoaded(true);
          }
        }
      }
    };
    
    loadCompletedPuzzle();
    
    return () => { mounted = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formattedAnswer, viewOnly, isAuthenticated, gameAttempts, loadingAttempts, puzzleId, dateFormat, cacheMode, gameOver]);

  // Load completed puzzle guesses for view-only mode
  useEffect(() => {
    let mounted = true;
    
    const loadViewOnlyPuzzle = async () => {
      if (viewOnly && !loadingAttempts) {
        if (isAuthenticated && gameAttempts && puzzleId) {
          // For authenticated users, check Supabase data using result !== null as completion check
          const completedAttempt = gameAttempts.find(
            attempt => attempt.puzzleId === puzzleId && attempt.result !== null
          );
          
          if (completedAttempt && mounted) {
            setGameOver(true);
            setShowEndModal(true); // Show modal immediately for view-only mode
            // Defensive normalization: handle both "won"/"lost" (current) and "win"/"loss" (legacy)
            const isWinResult = completedAttempt.result === "won" || completedAttempt.result === "win";
            setIsWin(isWinResult);
            // Set finalGuessCount immediately from attempt data to prevent race condition
            // where user clicks Continue before guesses are loaded from async operation
            if (completedAttempt.numGuesses != null) {
              setFinalGuessCount(completedAttempt.numGuesses);
            }
            
            // Lock digit mode from the completed attempt if it's set
            if ((completedAttempt as any).digits) {
              console.log('[loadViewOnlyPuzzle] Locking digit mode to:', (completedAttempt as any).digits);
              setLockedDigits((completedAttempt as any).digits);
            }
            setDigitsCheckComplete(true);
            
            // Try to load guesses from cache first for faster loading (using mode-aware cache)
            const cachedGuesses = puzzleId ? getGuessesForPuzzle(puzzleId, cacheMode) : null;
            let attemptGuesses = cachedGuesses;
            
            if (!cachedGuesses) {
              // Cache miss - need to fetch from Supabase
              setGuessesLoading(true);
              try {
                const allGuesses = await getAllGuesses();
                attemptGuesses = allGuesses.filter(g => g.gameAttemptId === completedAttempt.id);
                
                // Always cache results (including empty arrays) to avoid refetching
                if (puzzleId) {
                  setGuessesForPuzzle(puzzleId, cacheMode, attemptGuesses || []);
                }
              } finally {
                if (mounted) {
                  setGuessesLoading(false);
                }
              }
            }
            
            if (mounted && attemptGuesses && attemptGuesses.length > 0) {
              // Recalculate feedback client-side (not stored in DB)
              // Convert canonical guesses from DB using LOCKED digit mode, not current preference
              
              // Create format based on locked digit mode from attempt
              const lockedDigits = (completedAttempt as any).digits || '6';
              const baseFormat = dateFormat.startsWith('dd') ? 'dd' : 'mm';
              const lockedFormat = lockedDigits === '8' 
                ? (baseFormat === 'dd' ? 'ddmmyyyy' : 'mmddyyyy')
                : (baseFormat === 'dd' ? 'ddmmyy' : 'mmddyy');
              
              let newKeyStates: Record<string, KeyState> = {};
              const feedbackArrays = attemptGuesses.map(guess => {
                // Convert canonical format (YYYY-MM-DD) using LOCKED digit mode
                const displayFormat = formatCanonicalDateUtil(guess.guessValue, lockedFormat as any);
                const feedback = calculateFeedbackForGuess(displayFormat, newKeyStates);
                newKeyStates = updateKeyStates(displayFormat, feedback, newKeyStates);
                return feedback;
              });
              setGuesses(feedbackArrays);
              setKeyStates(newKeyStates);
              // Set final guess count for completed puzzles (fixes bug where count shows 0 when returning from Archive)
              setFinalGuessCount(feedbackArrays.length);
              
              // Reconstruct guess records for display with recalculated feedback
              const records: GuessRecord[] = [];
              let recordKeyStates: Record<string, KeyState> = {};
              for (const guess of attemptGuesses) {
                // Convert canonical format using LOCKED digit mode
                const displayFormat = formatCanonicalDateUtil(guess.guessValue, lockedFormat as any);
                const feedback = calculateFeedbackForGuess(displayFormat, recordKeyStates);
                recordKeyStates = updateKeyStates(displayFormat, feedback, recordKeyStates);
                records.push({
                  guessValue: displayFormat,
                  feedbackResult: feedback,
                  categoryName: (guess as any).categoryName ?? null
                });
              }
              setGuessRecords(records);
              // Mark guesses as loaded to trigger the 0.6s delay
              setGuessesLoaded(true);
            } else if (mounted) {
              // No guesses found but attempt exists - mark as loaded
              setGuessesLoaded(true);
            }
          } else if (mounted) {
            // No completed attempt found
            setDigitsCheckComplete(true);
            // Mark guesses as loaded so grid can show
            setGuessesLoaded(true);
          }
        } else {
          // For guest users, check localStorage
          const storedStats = localStorage.getItem("elementle-stats");
          if (storedStats) {
            const stats = JSON.parse(storedStats);
            const completion = stats.puzzleCompletions?.[formattedAnswer];
            
            if (completion && mounted) {
              setGameOver(true);
              setIsWin(completion.won);
              if (completion.guesses && Array.isArray(completion.guesses)) {
                const feedbackArrays = completion.guesses.map((gr: GuessRecord) => gr.feedbackResult);
                setGuesses(feedbackArrays);
                setGuessRecords(completion.guesses);
                // Set final guess count for completed puzzles (fixes bug where count shows 0 when returning from Archive)
                setFinalGuessCount(feedbackArrays.length);
              }
              // Guest data is sync from localStorage - mark as loaded immediately
              setGuessesLoaded(true);
            }
          }
          // For guest users, always mark digits check complete and guesses loaded (no database to check)
          if (mounted) {
            setDigitsCheckComplete(true);
            setGuessesLoaded(true);
          }
        }
      }
    };
    
    loadViewOnlyPuzzle();
    
    return () => { mounted = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewOnly, formattedAnswer, isAuthenticated, gameAttempts, loadingAttempts, puzzleId, dateFormat, cacheMode]);

  // Auto-open celebration modal when returning from stats for completed archive puzzles
  useEffect(() => {
    if (showCelebrationFirst && gameOver && hasOpenedCelebration && !showCelebrationModal) {
      setShowCelebrationModal(true);
    }
  }, [showCelebrationFirst, gameOver, hasOpenedCelebration, showCelebrationModal]);

  // Load in-progress guesses when resuming a puzzle
  useEffect(() => {
    let mounted = true;
    
    const loadInProgressGame = async () => {
      console.log('[loadInProgressGame] Starting...', {
        viewOnly,
        gameOver,
        loadingAttempts,
        isAuthenticated,
        puzzleId,
        gameAttemptsLength: gameAttempts?.length
      });
      
      if (!viewOnly && !gameOver && !loadingAttempts) {
        if (isAuthenticated && gameAttempts && puzzleId) {
          console.log('[loadInProgressGame] Looking for in-progress attempt for puzzleId:', puzzleId, 'type:', typeof puzzleId);
          console.log('[loadInProgressGame] gameAttempts:', gameAttempts.map(a => ({ id: a.id, puzzleId: a.puzzleId, result: a.result, numGuesses: a.numGuesses })));
          
          // For authenticated users, load from database
          const inProgressAttempt = gameAttempts.find(
            attempt => attempt.puzzleId === puzzleId && attempt.result === null && (attempt.numGuesses ?? 0) > 0
          );
          
          console.log('[loadInProgressGame] Found in-progress attempt:', inProgressAttempt);
          
          if (inProgressAttempt && mounted) {
            console.log('[loadInProgressGame] Setting currentGameAttemptId to:', inProgressAttempt.id);
            // Set the current attempt ID so future guesses save to the correct attempt
            setCurrentGameAttemptId(inProgressAttempt.id);
            
            // Lock digit mode from the game attempt if it's set
            if ((inProgressAttempt as any).digits) {
              console.log('[loadInProgressGame] Locking digit mode to:', (inProgressAttempt as any).digits);
              setLockedDigits((inProgressAttempt as any).digits);
            }
            setDigitsCheckComplete(true);
            
            // Try to load guesses from cache first for faster loading (using mode-aware cache)
            console.log('[loadInProgressGame] Checking cache for puzzleId:', puzzleId, 'mode:', cacheMode);
            const cachedGuesses = puzzleId ? getGuessesForPuzzle(puzzleId, cacheMode) : null;
            let attemptGuesses = cachedGuesses;
            
            if (!cachedGuesses) {
              // Cache miss - need to fetch from Supabase
              console.log('[loadInProgressGame] Cache miss - fetching from API for attemptId:', inProgressAttempt.id);
              setGuessesLoading(true);
              try {
                const allGuesses = await getAllGuesses();
                console.log('[loadInProgressGame] Fetched all guesses:', allGuesses.length);
                attemptGuesses = allGuesses.filter((g: any) => g.gameAttemptId === inProgressAttempt.id);
                
                // Always cache results (including empty arrays) to avoid refetching
                if (puzzleId) {
                  console.log('[loadInProgressGame] Caching', attemptGuesses?.length || 0, 'guesses for puzzle', puzzleId);
                  setGuessesForPuzzle(puzzleId, cacheMode, attemptGuesses || []);
                }
              } finally {
                if (mounted) {
                  setGuessesLoading(false);
                }
              }
            } else {
              console.log('[loadInProgressGame] Cache hit - using', cachedGuesses.length, 'cached guesses');
            }
            
            if (mounted && attemptGuesses && attemptGuesses.length > 0) {
              console.log('[loadInProgressGame] Recalculating feedback for', attemptGuesses.length, 'guesses');
              // Recalculate feedback for each guess (don't use stored feedbackResult)
              const freshGuessRecords: GuessRecord[] = [];
              const freshFeedbackArrays: CellFeedback[][] = [];
              let newKeyStates = {};
              
              // Create format based on locked digit mode from attempt, not current user preference
              const lockedDigits = (inProgressAttempt as any).digits || '6';
              const baseFormat = dateFormat.startsWith('dd') ? 'dd' : 'mm';
              const lockedFormat = lockedDigits === '8' 
                ? (baseFormat === 'dd' ? 'ddmmyyyy' : 'mmddyyyy')
                : (baseFormat === 'dd' ? 'ddmmyy' : 'mmddyy');
              
              attemptGuesses.forEach((guess: any) => {
                // Convert canonical format (YYYY-MM-DD) to display format using LOCKED digit mode
                const displayFormat = formatCanonicalDateUtil(guess.guessValue, lockedFormat as any);
                const feedback = calculateFeedbackForGuess(displayFormat, newKeyStates);
                freshFeedbackArrays.push(feedback);
                freshGuessRecords.push({
                  guessValue: displayFormat,
                  feedbackResult: feedback
                });
                newKeyStates = updateKeyStates(displayFormat, feedback, newKeyStates);
              });
              
              console.log('[loadInProgressGame] Setting state with', freshFeedbackArrays.length, 'guesses');
              setGuesses(freshFeedbackArrays);
              setGuessRecords(freshGuessRecords);
              setKeyStates(newKeyStates);
              setWrongGuessCount(freshFeedbackArrays.length - freshFeedbackArrays.filter(fb => fb.every(cell => cell.state === 'correct')).length);
              console.log('[loadInProgressGame] State updated successfully');
              // Mark guesses as loaded to trigger the 0.6s delay
              setGuessesLoaded(true);
            } else if (mounted) {
              console.log('[loadInProgressGame] No guesses to load or component unmounted');
              // No guesses found but attempt exists - mark as loaded
              setGuessesLoaded(true);
            }
          } else if (mounted) {
            // No in-progress attempt found for authenticated users
            setDigitsCheckComplete(true);
            // Mark guesses as loaded so grid can show for new games
            setGuessesLoaded(true);
          }
        } else if (!isAuthenticated) {
          // For guest users, load from localStorage
          const inProgressKey = `puzzle-progress-${formattedAnswer}`;
          const savedProgress = localStorage.getItem(inProgressKey);
          
          if (savedProgress && mounted) {
            const progress = JSON.parse(savedProgress);
            if (progress.guessRecords && Array.isArray(progress.guessRecords)) {
              const feedbackArrays = progress.guessRecords.map((gr: GuessRecord) => gr.feedbackResult);
              setGuesses(feedbackArrays);
              setGuessRecords(progress.guessRecords);
              setWrongGuessCount(progress.wrongGuessCount || 0);
              
              // Restore key states
              if (progress.keyStates) {
                setKeyStates(progress.keyStates);
              }
              // Guest data is sync from localStorage - mark as loaded immediately
              setGuessesLoaded(true);
            }
          }
          // For guest users, always mark digits check complete and guesses loaded (no database to check)
          if (mounted) {
            setDigitsCheckComplete(true);
            setGuessesLoaded(true);
          }
        }
      }
    };
    
    loadInProgressGame();
    
    return () => { mounted = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewOnly, formattedAnswer, isAuthenticated, gameAttempts, loadingAttempts, puzzleId, dateFormat, cacheMode]);

  // Check if we should show the intro screen (new game with no guesses)
  // IntroScreen handles its own loading state internally, so we just set showIntroScreen to true
  useEffect(() => {
    // Only proceed if all conditions are met and we haven't decided yet
    if (!viewOnly && !gameOver && guessRecords.length === 0 && digitsCheckComplete && !introScreenChecked.current) {
      // Mark as checked so we don't re-run this logic
      introScreenChecked.current = true;
      
      // Skip intro if parent tells us there's existing progress or skipIntro is true
      if (hasExistingProgress || skipIntro) {
        return;
      }
      
      // Show the intro screen - it handles its own loading spinner internally
      setShowIntroScreen(true);
    }
  }, [guessRecords.length, digitsCheckComplete, gameOver, viewOnly, hasExistingProgress, skipIntro]);

  // Helper function to format date for intro display
  const formatDateForIntro = (dateCanonical: string): string => {
    // dateCanonical is in YYYY-MM-DD format
    const [year, month, day] = dateCanonical.split('-');
    const date = new Date(dateCanonical + 'T00:00:00Z'); // Add time to avoid timezone issues
    
    const dayNum = parseInt(day, 10);
    const monthNum = parseInt(month, 10);
    
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'];
    const monthName = monthNames[monthNum - 1];
    
    const getOrdinal = (n: number) => {
      if (n > 3 && n < 21) return 'th';
      switch (n % 10) {
        case 1: return 'st';
        case 2: return 'nd';
        case 3: return 'rd';
        default: return 'th';
      }
    };
    
    // Format based on user's date preference
    if (dateFormat.startsWith('dd')) {
      // DD/MM/YY -> "25th November 2025"
      return `${dayNum}${getOrdinal(dayNum)} ${monthName} ${year}`;
    } else {
      // MM/DD/YY -> "November 25, 2025"
      return `${monthName} ${dayNum}, ${year}`;
    }
  };
  
  // Helper function to calculate feedback without updating state
  const calculateFeedbackForGuess = (guess: string, currentKeyStates: Record<string, KeyState>, targetAnswer?: string): CellFeedback[] => {
    const feedback: CellFeedback[] = [];
    const answer = targetAnswer || activeFormattedAnswer;
    const numDigits = guess.length; // Use guess length instead of activeNumDigits
    
    for (let i = 0; i < numDigits; i++) {
      const guessDigit = guess[i];
      const targetDigit = answer[i];
      
      if (guessDigit === targetDigit) {
        feedback.push({ digit: guessDigit, state: "correct" });
      } else if (answer.includes(guessDigit)) {
        const arrow = parseInt(guessDigit) < parseInt(targetDigit) ? "up" : "down";
        feedback.push({ digit: guessDigit, state: "inSequence", arrow });
      } else {
        const arrow = parseInt(guessDigit) < parseInt(targetDigit) ? "up" : "down";
        feedback.push({ digit: guessDigit, state: "notInSequence", arrow });
      }
    }
    
    return feedback;
  };
  
  // Helper function to update key states without modifying state
  const updateKeyStates = (guess: string, feedback: CellFeedback[], currentKeyStates: Record<string, KeyState>): Record<string, KeyState> => {
    const newKeyStates = { ...currentKeyStates };
    const numDigits = guess.length; // Use guess length instead of activeNumDigits
    
    for (let i = 0; i < numDigits; i++) {
      const guessDigit = guess[i];
      const cellFeedback = feedback[i];
      
      if (cellFeedback.state === "correct") {
        newKeyStates[guessDigit] = "correct";
      } else if (cellFeedback.state === "inSequence") {
        if (newKeyStates[guessDigit] !== "correct") {
          newKeyStates[guessDigit] = "inSequence";
        }
      } else if (cellFeedback.state === "notInSequence") {
        newKeyStates[guessDigit] = "ruledOut";
      }
    }
    
    return newKeyStates;
  };

  const calculateFeedback = (guess: string): CellFeedback[] => {
    const feedback: CellFeedback[] = [];
    const newKeyStates = { ...keyStates };

    for (let i = 0; i < activeNumDigits; i++) {
      const guessDigit = guess[i];
      const targetDigit = activeFormattedAnswer[i];
      
      if (guessDigit === targetDigit) {
        feedback.push({ digit: guessDigit, state: "correct" });
        newKeyStates[guessDigit] = "correct";
      } else if (activeFormattedAnswer.includes(guessDigit)) {
        const arrow = parseInt(guessDigit) < parseInt(targetDigit) ? "up" : "down";
        feedback.push({ digit: guessDigit, state: "inSequence", arrow });
        if (newKeyStates[guessDigit] !== "correct") {
          newKeyStates[guessDigit] = "inSequence";
        }
      } else {
        const arrow = parseInt(guessDigit) < parseInt(targetDigit) ? "up" : "down";
        feedback.push({ digit: guessDigit, state: "notInSequence", arrow });
        newKeyStates[guessDigit] = "ruledOut";
      }
    }

    setKeyStates(newKeyStates);
    return feedback;
  };

  useEffect(() => {
    const storedClues = localStorage.getItem("cluesEnabled");
    if (storedClues !== null) setCluesEnabled(storedClues === "true");
  }, []);

  const handleSubmit = useCallback(async () => {
    if (currentInput.length !== activeNumDigits || gameOver) return;

    const feedback = calculateFeedback(currentInput);
    const newGuesses = [...guesses, feedback];
    const newGuessRecords = [...guessRecords, { guessValue: currentInput, feedbackResult: feedback }];
    const newWrongGuessCount = currentInput !== activeFormattedAnswer ? wrongGuessCount + 1 : wrongGuessCount;
    
    // Convert user input to canonical format for database storage
    const canonicalGuess = parseUserDateWithContext(currentInput, dateFormat, answerDateCanonical);
    
    // For local state, keep the user-formatted version
    const currentGuess = { guessValue: currentInput, feedbackResult: feedback };
    // For database storage, use canonical format
    const dbGuess = { guessValue: canonicalGuess || currentInput, feedbackResult: feedback };
    
    setGuesses(newGuesses);
    setGuessRecords(newGuessRecords);
    setCurrentInput("");

    // For guest users: update archive progress immediately
    if (!isAuthenticated) {
      const storedStats = localStorage.getItem("elementle-stats");
      const stats = storedStats ? JSON.parse(storedStats) : { puzzleCompletions: {} };

      const completion = stats.puzzleCompletions[formattedAnswer] || {
        completed: false,
        won: false,
        guessCount: 0,
        guesses: []
      };

      completion.guessCount = newGuesses.length;
      completion.guesses = newGuessRecords;
      completion.completed = false; // still in progress
      completion.won = false;

      stats.puzzleCompletions[formattedAnswer] = completion;
      localStorage.setItem("elementle-stats", JSON.stringify(stats));
    }
    
    // For authenticated users: progressive database saving
    // Use ref to get latest puzzleId (handles race conditions where prop isn't set yet)
    let attemptId: number | null = null;
    const currentPuzzleId = puzzleIdRef.current;
    
    if (isAuthenticated) {
      if (!currentPuzzleId) {
        console.warn('[handleSubmit] puzzleId is undefined for authenticated user - will retry in createOrGetGameAttempt');
      }
      
      // Create or get game attempt on first guess (includes retry logic for missing puzzleId)
      attemptId = await createOrGetGameAttempt();
      
      // Save this guess to database (using canonical format)
      if (attemptId) {
        await saveGuessToDatabase(attemptId, dbGuess);
      } else {
        console.error('[handleSubmit] CRITICAL: Could not create/get game attempt. Guess NOT saved to database!', {
          puzzleId: currentPuzzleId,
          isLocalMode,
          guessValue: dbGuess.guessValue
        });
      }
    }

    const isWinningGuess = currentInput === activeFormattedAnswer;
    const isLosingGuess = !isWinningGuess && newGuesses.length >= maxGuesses;

    if (isWinningGuess) {
      // Game won
      setIsWin(true);
      setGameOver(true);
      setFinalGuessCount(newGuesses.length); // Store final count to prevent race condition issues
      localStorage.removeItem(`puzzle-progress-${formattedAnswer}`);
      
      // Start 2.5s timer immediately - modal will show when BOTH timer elapses AND ready
      setTimeout(() => {
        setEndModalDelayElapsed(true);
      }, 2500);
      
      // Track if we're showing a streak celebration (to delay EndGameModal)
      let hasStreakCelebration = false;
      
      if (isAuthenticated && attemptId) {
        // Complete game attempt and recalculate stats from database (use attemptId, not state)
        await completeGameAttempt(attemptId, true, newGuesses.length);
        
        // Show streak celebration only when playing today's puzzle (regardless of access method)
        if (isPlayingTodaysPuzzle()) {
          const statsEndpoint = isLocalMode ? "/api/user/stats" : "/api/stats";
          const statsRes = await apiRequest("GET", statsEndpoint);
          if (statsRes.ok) {
            const freshStats = await statsRes.json();
            console.log('[Win] Fresh stats loaded for streak celebration:', freshStats);
            if (freshStats.currentStreak) {
              setCurrentStreak(freshStats.currentStreak);
              setShowStreakCelebration(true);
              hasStreakCelebration = true;
              // Mark that EndGameModal should show after streak celebration is dismissed
              setPendingEndModal(true);
              // Mark that badge check should run after streak celebration
              setPendingBadgeCheck(true);
            } else {
              // No streak celebration, check badges immediately
              const gameType = isLocalMode ? 'USER' : 'REGION';
              console.log('[Win] Checking badges for game completion:', { 
                guessCount: newGuesses.length, 
                streak: freshStats.currentStreak || 0,
                gameType 
              });
              const badge = await checkAllBadgesOnGameComplete(
                true, 
                newGuesses.length, 
                freshStats.currentStreak || 0,
                gameType
              );
              if (badge) {
                setEarnedBadge(badge);
              }
            }
          }
        } else {
          // Not playing today's puzzle but still check for elementle badges
          const gameType = isLocalMode ? 'USER' : 'REGION';
          const statsEndpoint = isLocalMode ? "/api/user/stats" : "/api/stats";
          const statsRes = await apiRequest("GET", statsEndpoint);
          const freshStats = statsRes.ok ? await statsRes.json() : { currentStreak: 0 };
          
          const badge = await checkAllBadgesOnGameComplete(
            true, 
            newGuesses.length, 
            freshStats.currentStreak || 0,
            gameType
          );
          if (badge) {
            setEarnedBadge(badge);
          }
        }
      } else if (isAuthenticated && !attemptId) {
        // CRITICAL: Authenticated user won but we couldn't save to database!
        console.error('[handleSubmit] CRITICAL: Game WON but could not save to database!', {
          puzzleId: puzzleIdRef.current,
          numGuesses: newGuesses.length,
          isLocalMode
        });
        // Still show celebration locally even though DB save failed
      } else if (!isAuthenticated) {
        // Guest user: use localStorage stats
        await updateStats(true, newGuesses.length, newGuessRecords);
        
        // Show streak celebration only when playing today's puzzle (regardless of access method)
        if (isPlayingTodaysPuzzle()) {
          const stats = JSON.parse(localStorage.getItem("elementle-stats") || "{}");
          if (stats.currentStreak) {
            setCurrentStreak(stats.currentStreak);
            setShowStreakCelebration(true);
            hasStreakCelebration = true;
            // Mark that EndGameModal should show after streak celebration is dismissed
            setPendingEndModal(true);
          }
        }
      }
      
      // Mark modal as ready (will show when 2.5s timer also elapses)
      // If there IS a streak celebration, pendingEndModal handles showing after dismissal
      if (!hasStreakCelebration) {
        setEndModalReady(true);
      }
      
      // Cache today's outcome (only if playing today's puzzle)
      if (isPlayingTodaysPuzzle()) {
        writeLocal(CACHE_KEYS.TODAY_OUTCOME, {
          date: answerDateCanonical,
          puzzleId: puzzleId,
          isWin: true,
          guessCount: newGuesses.length,
        });
      }
      
      // Handle streak saver completion - mark as used only after puzzle played to conclusion
      if (isInStreakSaverMode && streakSaverSession && isAuthenticated) {
        const gameType = streakSaverSession.gameType;
        console.log('[Win] Completing streak saver session:', { gameType, won: true });
        try {
          // Mark streak saver as used in database
          await useStreakSaverMutation(gameType);
          // Refetch streak status to update UI
          await refetchStreakStatus();
          // Complete the session context
          completeStreakSaverSession(true);
          console.log('[Win] Streak saver used successfully - streak extended by 1 day');
        } catch (error) {
          console.error('[Win] Failed to use streak saver:', error);
          // Still complete the session to clear the mode
          completeStreakSaverSession(true);
        }
      }
    } else if (isLosingGuess) {
      // Game lost
      setIsWin(false);
      setGameOver(true);
      setFinalGuessCount(newGuesses.length); // Store final count to prevent race condition issues
      localStorage.removeItem(`puzzle-progress-${formattedAnswer}`);
      
      // Start 2.5s timer immediately - modal will show when BOTH timer elapses AND ready
      setTimeout(() => {
        setEndModalDelayElapsed(true);
      }, 2500);
      
      // Mark modal as ready immediately (losses don't have streak celebrations)
      setEndModalReady(true);
      
      if (isAuthenticated && attemptId) {
        // Complete game attempt and recalculate stats from database (use attemptId, not state)
        await completeGameAttempt(attemptId, false, newGuesses.length);
      } else if (isAuthenticated && !attemptId) {
        // CRITICAL: Authenticated user lost but we couldn't save to database!
        console.error('[handleSubmit] CRITICAL: Game LOST but could not save to database!', {
          puzzleId: puzzleIdRef.current,
          numGuesses: newGuesses.length,
          isLocalMode
        });
      } else if (!isAuthenticated) {
        // Guest user: use localStorage stats
        await updateStats(false, newGuesses.length, newGuessRecords);
      }
      
      // Cache today's outcome (only if playing today's puzzle)
      if (isPlayingTodaysPuzzle()) {
        writeLocal(CACHE_KEYS.TODAY_OUTCOME, {
          date: answerDateCanonical,
          puzzleId: puzzleId,
          isWin: false,
          guessCount: newGuesses.length,
        });
      }
      
      // Handle streak saver completion - mark as used only after puzzle played to conclusion
      // On loss: still uses streak saver, but streak resets to 0
      if (isInStreakSaverMode && streakSaverSession && isAuthenticated) {
        const gameType = streakSaverSession.gameType;
        console.log('[Lose] Completing streak saver session:', { gameType, won: false });
        try {
          // Mark streak saver as used in database
          await useStreakSaverMutation(gameType);
          // Refetch streak status to update UI
          await refetchStreakStatus();
          // Complete the session context (with false to indicate loss)
          completeStreakSaverSession(false);
          console.log('[Lose] Streak saver used - streak reset to 0 due to loss');
        } catch (error) {
          console.error('[Lose] Failed to use streak saver:', error);
          // Still complete the session to clear the mode
          completeStreakSaverSession(false);
        }
      }
    } else {
      // Game in progress - save current state to localStorage
      setWrongGuessCount(newWrongGuessCount);
      const inProgressKey = `puzzle-progress-${formattedAnswer}`;
      const newKeyStates = { ...keyStates };
      
      // Update key states from the feedback we just calculated
      for (let i = 0; i < activeNumDigits; i++) {
        const digit = currentInput[i];
        const state = feedback[i].state;
        if (state === "correct") {
          newKeyStates[digit] = "correct";
        } else if (state === "inSequence" && newKeyStates[digit] !== "correct") {
          newKeyStates[digit] = "inSequence";
        } else if (state === "notInSequence") {
          newKeyStates[digit] = "ruledOut";
        }
      }
      
      localStorage.setItem(inProgressKey, JSON.stringify({
        guessRecords: newGuessRecords,
        wrongGuessCount: newWrongGuessCount,
        keyStates: newKeyStates
      }));
    }
  }, [currentInput, gameOver, guesses, guessRecords, formattedAnswer, maxGuesses, keyStates, wrongGuessCount, isAuthenticated, puzzleId, currentGameAttemptId, activeNumDigits, isInStreakSaverMode, streakSaverSession, useStreakSaverMutation, refetchStreakStatus, completeStreakSaverSession]);

  const handleKeyPress = useCallback((e: KeyboardEvent) => {
    if (gameOver || viewOnly) return;

    if (e.key >= "0" && e.key <= "9") {
      if (currentInput.length < activeNumDigits) {
        setCurrentInput(currentInput + e.key);
      }
    } else if (e.key === "Backspace" || e.key === "Delete") {
      setCurrentInput(currentInput.slice(0, -1));
    } else if (e.key === "Enter") {
      handleSubmit();
    } else if (e.key === "Escape") {
      setCurrentInput("");
    }
  }, [currentInput, gameOver, handleSubmit, activeNumDigits]);

  useEffect(() => {
    window.addEventListener("keydown", handleKeyPress);
    return () => window.removeEventListener("keydown", handleKeyPress);
  }, [handleKeyPress]);

  const createOrGetGameAttempt = async (retryCount = 0): Promise<number | null> => {
    // Use ref to get the LATEST puzzleId (prevents stale closure issues)
    const currentPuzzleId = puzzleIdRef.current;
    
    if (!isAuthenticated) {
      console.log('[createOrGetGameAttempt] Not authenticated, skipping database save');
      return null;
    }
    
    if (!currentPuzzleId) {
      console.warn('[createOrGetGameAttempt] CRITICAL: puzzleId is undefined for authenticated user!', {
        puzzleIdFromRef: puzzleIdRef.current,
        puzzleIdFromProps: puzzleId,
        isLocalMode,
        retryCount
      });
      
      // Retry up to 3 times with exponential backoff if puzzleId is missing
      // This handles race conditions where puzzle data hasn't loaded yet
      if (retryCount < 3) {
        const delay = Math.pow(2, retryCount) * 500; // 500ms, 1s, 2s
        console.log(`[createOrGetGameAttempt] Retrying in ${delay}ms (attempt ${retryCount + 1}/3)`);
        await new Promise(resolve => setTimeout(resolve, delay));
        return createOrGetGameAttempt(retryCount + 1);
      }
      
      console.error('[createOrGetGameAttempt] FAILED: puzzleId still undefined after 3 retries. Game data will NOT be saved!');
      return null;
    }

    // If we already have one in state, reuse it
    if (currentGameAttemptId) {
      console.log('[createOrGetGameAttempt] Reusing existing attemptId from state:', currentGameAttemptId);
      return currentGameAttemptId;
    }

    try {
      console.log('[createOrGetGameAttempt] POSTing to find or create attempt for puzzleId:', currentPuzzleId);
      
      // POST to mode-aware endpoint - server will find existing open attempt or create new one
      const endpoint = isLocalMode ? "/api/user/game-attempts" : "/api/game-attempts";
      const res = await apiRequest("POST", endpoint, {
        puzzleId: currentPuzzleId,
        result: null,
        numGuesses: 0
      });
      
      const gameAttempt = await res.json();
      console.log('[createOrGetGameAttempt] Got attemptId:', gameAttempt.id, 'numGuesses:', gameAttempt.numGuesses);
      
      setCurrentGameAttemptId(gameAttempt.id);
      return gameAttempt.id;
    } catch (error) {
      console.error("[createOrGetGameAttempt] Error:", error);
      
      // Retry on network/server errors (up to 2 additional attempts)
      if (retryCount < 2) {
        const delay = Math.pow(2, retryCount) * 1000; // 1s, 2s
        console.log(`[createOrGetGameAttempt] Network error, retrying in ${delay}ms (attempt ${retryCount + 1}/2)`);
        await new Promise(resolve => setTimeout(resolve, delay));
        return createOrGetGameAttempt(retryCount + 1);
      }
      
      console.error('[createOrGetGameAttempt] FAILED after retries. Game data may not be saved!');
      return null;
    }
  };

  const saveGuessToDatabase = async (gameAttemptId: number, guess: GuessRecord, retryCount = 0): Promise<boolean> => {
    if (!isAuthenticated) return false;

    try {
      console.log('[saveGuessToDatabase] Saving guess:', {
        gameAttemptId,
        guessValue: guess.guessValue,
        feedbackLength: guess.feedbackResult.length,
        retryCount
      });
      
      const endpoint = isLocalMode ? "/api/user/guesses" : "/api/guesses";
      const res = await apiRequest("POST", endpoint, {
        gameAttemptId,
        guessValue: guess.guessValue,
        feedbackResult: guess.feedbackResult
      });
      
      const savedGuess = await res.json();
      console.log('[saveGuessToDatabase] Guess saved successfully:', savedGuess.id);
      return true;
    } catch (error) {
      console.error("[saveGuessToDatabase] Error:", error);
      
      // Retry on network/server errors (up to 2 additional attempts)
      if (retryCount < 2) {
        const delay = Math.pow(2, retryCount) * 500; // 500ms, 1s
        console.log(`[saveGuessToDatabase] Retrying in ${delay}ms (attempt ${retryCount + 1}/2)`);
        await new Promise(resolve => setTimeout(resolve, delay));
        return saveGuessToDatabase(gameAttemptId, guess, retryCount + 1);
      }
      
      // Queue for later retry if all attempts fail
      console.error('[saveGuessToDatabase] FAILED after retries. Queuing for later retry.');
      pendingGuessesRef.current.push({ attemptId: gameAttemptId, guess });
      return false;
    }
  };

  const completeGameAttempt = async (gameAttemptId: number, won: boolean, numGuesses: number) => {
    if (!isAuthenticated) return;

    try {
      // Determine if this is a streak saver play (accessed via streak saver popup, not archive)
      const isStreakSaverPlay = isInStreakSaverMode && !!streakSaverSession;
      
      console.log('[completeGameAttempt] Completing attempt:', {
        gameAttemptId,
        won,
        numGuesses,
        isStreakSaverPlay
      });
      
      // Update the game attempt with result and completion time
      // Pass isStreakSaverPlay to server so it knows whether to update streak_day_status
      const patchEndpoint = isLocalMode ? `/api/user/game-attempts/${gameAttemptId}` : `/api/game-attempts/${gameAttemptId}`;
      const patchRes = await apiRequest("PATCH", patchEndpoint, {
        result: won ? "won" : "lost",
        numGuesses,
        isStreakSaverPlay
      });
      
      if (!patchRes.ok) {
        console.error('[completeGameAttempt] Failed to PATCH attempt:', patchRes.status);
        return;
      }
      
      const updatedAttempt = await patchRes.json();
      console.log('[completeGameAttempt] Attempt updated:', updatedAttempt);

      // Recalculate stats from database
      console.log('[completeGameAttempt] Recalculating stats...');
      const recalcEndpoint = isLocalMode ? "/api/user/stats/recalculate" : "/api/stats/recalculate";
      const recalcRes = await apiRequest("POST", recalcEndpoint);
      
      if (!recalcRes.ok) {
        console.error('[completeGameAttempt] Failed to recalculate stats:', recalcRes.status);
      } else {
        const recalcStats = await recalcRes.json();
        console.log('[completeGameAttempt] Stats recalculated:', recalcStats);
      }

      // Invalidate caches to refetch fresh data
      const { queryClient } = await import("@/lib/queryClient");
      const statsQueryKey = isLocalMode ? ['/api/user/stats'] : ['/api/stats'];
      const attemptsQueryKey = isLocalMode ? ['/api/user/game-attempts/user'] : ['/api/game-attempts/user'];
      await queryClient.invalidateQueries({ queryKey: statsQueryKey });
      await queryClient.invalidateQueries({ queryKey: attemptsQueryKey });
      
      // Pre-load percentile and stats for instant rendering
      try {
        console.log('[completeGameAttempt] Pre-loading percentile and stats...');
        
        // Fetch and cache percentile
        const percentileEndpoint = isLocalMode ? "/api/user/stats/percentile" : "/api/stats/percentile";
        const percentileRes = await apiRequest("GET", percentileEndpoint);
        if (percentileRes.ok) {
          const percentileData = await percentileRes.json();
          writeLocal(CACHE_KEYS.PERCENTILE, percentileData);
          console.log('[completeGameAttempt] Percentile cached:', percentileData);
        }
        
        // Fetch and cache stats
        const statsEndpoint = isLocalMode ? "/api/user/stats" : "/api/stats";
        const statsRes = await apiRequest("GET", statsEndpoint);
        if (statsRes.ok) {
          const statsData = await statsRes.json();
          writeLocal(CACHE_KEYS.STATS, statsData);
          console.log('[completeGameAttempt] Stats cached:', statsData);
        }
      } catch (error) {
        console.error("[completeGameAttempt] Error pre-loading data:", error);
      }
    } catch (error) {
      console.error("[completeGameAttempt] Error:", error);
    }
  };

  const updateStats = async (won: boolean, numGuesses: number, allGuessRecords: GuessRecord[]) => {
    // For authenticated users, stats are now calculated from database
    // This function only handles localStorage for guest users
    if (isAuthenticated) {
      // Authenticated users: database handles everything via recalculate
      return;
    }

    console.log('[updateStats] Updating guest stats:', { won, numGuesses });

    // Guest users: use old localStorage increment logic
    const storedStats = localStorage.getItem("elementle-stats");
    const currentStats = storedStats ? JSON.parse(storedStats) : {
      played: 0,
      won: 0,
      currentStreak: 0,
      maxStreak: 0,
      guessDistribution: { "1": 0, "2": 0, "3": 0, "4": 0, "5": 0 },
      puzzleCompletions: {}
    };

    // Ensure guessDistribution is always initialized with string keys
    if (!currentStats.guessDistribution || typeof currentStats.guessDistribution !== 'object') {
      currentStats.guessDistribution = { "1": 0, "2": 0, "3": 0, "4": 0, "5": 0 };
    }

    if (!currentStats.puzzleCompletions) {
      currentStats.puzzleCompletions = {};
    }

    // Use formattedAnswer as the key (formatted date) to match user's format
    currentStats.puzzleCompletions[formattedAnswer] = {
      completed: true,
      won,
      guessCount: numGuesses,
      guesses: allGuessRecords,
      puzzleTargetDate: answerDateCanonical,
      date: new Date().toISOString()
    };

    currentStats.played += 1;
    if (won) {
      currentStats.won += 1;
      currentStats.currentStreak += 1;
      currentStats.maxStreak = Math.max(currentStats.maxStreak, currentStats.currentStreak);
      
      // Use string key for guessDistribution (convert numGuesses to string)
      const guessKey = numGuesses.toString();
      if (numGuesses >= 1 && numGuesses <= 5) {
        currentStats.guessDistribution[guessKey] = (currentStats.guessDistribution[guessKey] || 0) + 1;
      }
      
      console.log('[updateStats] Updated distribution:', currentStats.guessDistribution);
    } else {
      currentStats.currentStreak = 0;
    }

    // Save to localStorage for guest users
    localStorage.setItem("elementle-stats", JSON.stringify(currentStats));
    console.log('[updateStats] Stats saved to localStorage');
  };

  const handlePlayAgain = () => {
    setCurrentInput("");
    setGuesses([]);
    setKeyStates({});
    setGameOver(false);
    setIsWin(false);
    setWrongGuessCount(0);
    setFinalGuessCount(null);
  };

  // Show loading state until date format and digit mode are ready
  // This prevents the grid from rendering in the wrong format and then flipping
  // The spinner overlay is managed by the gameLoadingSpinner effect above
  if (formatLoading || !digitsCheckComplete) {
    return (
      <div className="h-dvh" data-testid="game-loading" />
    );
  }


  // Calculate puzzle date for intro screen
  const today = new Date();
  const puzzleDateToShow = puzzleDate || `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  // Calculate streak info for intro screen
  const todayDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const isPlayingToday = puzzleDateToShow === todayDate;
  
  // Check if there's an existing attempt for this puzzle
  const hasExistingAttempt = isAuthenticated && gameAttempts && puzzleId 
    ? gameAttempts.some(attempt => attempt.puzzleId === puzzleId && attempt.result !== null)
    : false;
  
  // Get current streak from Supabase stats if authenticated, otherwise from localStorage
  let currentStreakValue = 0;
  if (isAuthenticated && supabaseStats) {
    currentStreakValue = supabaseStats.currentStreak || 0;
  } else {
    const guestStats = localStorage.getItem("elementle-stats");
    if (guestStats) {
      try {
        const stats = JSON.parse(guestStats);
        currentStreakValue = stats.currentStreak || 0;
      } catch (e) {}
    }
  }
  
  // This is a streak game if: playing today, no existing attempt, and has a streak to continue
  const isStreakGame = isPlayingToday && !hasExistingAttempt && currentStreakValue > 0;

  return (
    <>
      {/* IntroScreen overlay - handles its own loading state internally */}
      <AnimatePresence>
        {showIntroScreen && (
          <IntroScreen
            puzzleDateCanonical={puzzleDateToShow}
            eventTitle={eventTitle}
            hasCluesEnabled={cluesEnabled}
            isLocalMode={isLocalMode}
            categoryName={category}
            locationName={undefined}
            onPlayClick={() => setShowIntroScreen(false)}
            onBack={handleBackButtonPress}
            onExitStart={() => setIntroExitingViaBack(true)}
            formatDateForDisplay={formatDateForIntro}
            currentStreak={currentStreakValue}
            isStreakGame={isStreakGame}
            isStreakSaverGame={isInStreakSaverMode && !!streakSaverSession}
          />
        )}
      </AnimatePresence>
      
      {/* Main game content - fades out when IntroScreen is exiting via back button */}
      {/* When introExitingViaBack is true, content fades out so IntroScreen animates over solid background */}
      <div 
        className="fixed inset-0 flex flex-col overflow-hidden touch-none"
        style={{ 
          backgroundColor: pageBackgroundColor,
          opacity: introExitingViaBack ? 0 : 1,
          transition: 'opacity 150ms ease-out',
          pointerEvents: introExitingViaBack ? 'none' : 'auto'
        }}
      >
      {/* Fixed Header */}
      <div className="shrink-0 flex items-center justify-between px-4 pt-4">
        <button
          onClick={handleBackButtonPress}
          data-testid="button-back"
          className="w-14 h-14 flex items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
        >
          <ChevronLeft className="h-10 w-10 text-gray-700 dark:text-gray-200" />
        </button>

        <h2 className="text-4xl font-bold text-foreground">
          {viewOnly ? "View Puzzle" : "Elementle"}
        </h2>

        <button
          onClick={() => setShowHelp(true)}
          data-testid="button-help"
          className="w-14 h-14 flex items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
        >
          {/* Light mode icon */}
          <img
            src={greyHelpIcon}
            alt="Help"
            className="h-9 w-9 block dark:hidden"
          />
          {/* Dark mode icon */}
          <img
            src={whiteHelpIcon}
            alt="Help"
            className="h-9 w-9 hidden dark:block"
          />
        </button>

      </div>

      {/* Middle Content - fills remaining space */}
      <div className="flex-1 min-h-0 flex flex-col justify-center items-center px-4 overflow-hidden">
        <div className="w-full max-w-md space-y-0.5 sm:space-y-1">
          {cluesEnabled && (
            <div className="text-center mb-3">
              {isLocalMode && (
                <div
                  className="text-sm font-medium text-muted-foreground mb-1 tracking-wide"
                  data-testid="text-category"
                >
                  {guessRecords[0]?.categoryName || category || ""}
                </div>
              )}

              <h3
                className="text-xl font-semibold text-foreground"
                data-testid="text-event-title"
              >
                {eventTitle}
              </h3>
            </div>
          )}

          <InputGrid
            guesses={gridDataReady ? guesses : []}
            currentInput={gridDataReady ? currentInput : ""}
            maxGuesses={maxGuesses}
            placeholders={activePlaceholders}
          />
          
          {gameOver && !isWin && (
            <div className="w-full mt-6 sm:mt-12">
              <p className="text-center text-sm text-muted-foreground mb-2 sm:mb-3">Correct answer:</p>
              <div className="flex gap-2 justify-center">
                {activeFormattedAnswer.split('').map((digit, i) => (
                  <div
                    key={i}
                    className="flex-1 basis-0 shrink min-h-[40px] sm:min-h-[56px] md:min-h-[64px]"
                    data-testid={`answer-container-${i}`}
                  >
                    <div
                      className="w-full h-full flex items-center justify-center bg-game-correct text-white border-2 border-game-correct text-2xl sm:text-3xl md:text-4xl font-semibold rounded-md"
                      data-testid={`answer-digit-${i}`}
                    >
                      {digit}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Fixed Bottom - Numpad or Continue button */}
      <div className="shrink-0 px-4 pb-4">
        {showCelebrationFirst && gameOver && !hasOpenedCelebration && (
          <div className="w-full max-w-md mx-auto">
            <Button
              variant="outline"
              className="w-full h-14 sm:h-16 md:h-20 flex items-center justify-center px-6 rounded-3xl shadow-sm bg-brand-grey"
              onClick={() => {
                onSetHasOpenedCelebration?.(true);
                setShowCelebrationModal(true);
              }}
              data-testid="button-continue"
            >
              <span className="text-lg sm:text-xl md:text-2xl font-bold text-gray-800">
                Continue
              </span>
            </Button>
          </div>
        )}

        {!viewOnly && !showCelebrationFirst && (
          <div className="w-full max-w-md mx-auto">
            <NumericKeyboard
              onDigitPress={(digit) => {
                if (currentInput.length < activeNumDigits) {
                  setCurrentInput(currentInput + digit);
                }
              }}
              onDelete={() => setCurrentInput(currentInput.slice(0, -1))}
              onClear={() => setCurrentInput("")}
              onEnter={handleSubmit}
              keyStates={keyStates}
              canSubmit={isValidGuess}
            />
          </div>
        )}
      </div>

      <EndGameModal
        isOpen={showCelebrationFirst ? showCelebrationModal : showEndModal}
        isWin={isWin}
        answerDateCanonical={answerDateCanonical}
        formattedAnswer={formattedAnswer}
        eventTitle={eventTitle}
        eventDescription={eventDescription}
        numGuesses={finalGuessCount ?? guesses.length}
        onPlayAgain={handlePlayAgain}
        onHome={() => {
          const isTodaysPuzzle = isPlayingTodaysPuzzle();
          if (!isTodaysPuzzle && fromArchive) {
            triggerAd(() => {
              (onHomeFromCelebration || onBack)();
            });
          } else {
            (onHomeFromCelebration || onBack)();
          }
        }}
        onViewStats={onViewStats}
        onViewArchive={onViewArchive}
        isLocalMode={isLocalMode}
        isGuest={!isAuthenticated}
        onContinueToLogin={onContinueToLogin}
      />

      <HelpDialog isOpen={showHelp} onClose={() => setShowHelp(false)} />
      
      <StreakSaverExitWarning
        open={showStreakSaverExitWarning}
        onClose={() => setShowStreakSaverExitWarning(false)}
        onCancelAndLoseStreak={handleCancelStreakSaver}
        onContinuePlaying={handleContinuePlaying}
      />
      
      <AlertDialog 
        open={showHolidayWarning} 
        onOpenChange={(open) => {
          if (!open) {
            setHolidayWarningDismissed(true);
            setShowHolidayWarning(false);
          }
        }}
      >
        <AlertDialogContent className="rounded-xl max-w-[calc(100vw-2rem)] sm:max-w-md" data-testid="holiday-warning-dialog">
          <AlertDialogHeader className="text-center">
            <AlertDialogTitle className="flex items-center justify-center gap-2">
              <Umbrella className="h-5 w-5 text-yellow-500" />
              Holiday Mode Active
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="text-center space-y-3 text-sm text-muted-foreground">
                <p>
                  Playing today won't extend your streak unless you exit holiday mode.
                </p>
                {holidayEndDate && (
                  <p className="font-medium text-foreground">
                    Holiday runs until {new Date(holidayEndDate).toLocaleDateString('en-GB', { 
                      weekday: 'long', 
                      day: 'numeric', 
                      month: 'long' 
                    })}
                  </p>
                )}
                <p>
                  Choose how you'd like to continue:
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2 justify-center items-center">
            <AlertDialogCancel 
              onClick={async () => {
                // Exit holiday mode first, then allow normal play
                try {
                  await endHoliday(false);
                  await refetchStreakStatus();
                } catch (error) {
                  console.error('[HolidayWarning] Failed to end holiday:', error);
                }
                setHolidayWarningDismissed(true);
                setShowHolidayWarning(false);
              }}
              className="w-3/4 sm:w-auto mx-auto"
              data-testid="button-holiday-exit-mode"
            >
              Exit Holiday Mode
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => {
                // Continue playing in holiday mode - attempt will be recorded with streak_day_status = 0
                setHolidayWarningDismissed(true);
                setShowHolidayWarning(false);
              }}
              className="w-3/4 sm:w-auto mx-auto"
              data-testid="button-holiday-continue-playing"
            >
              Continue in Holiday Mode
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {showStreakCelebration && (
        <StreakCelebrationPopup
          streak={currentStreak}
          onDismiss={async () => {
            setShowStreakCelebration(false);
            
            // If badge check was pending (waiting for streak celebration to finish), run it now
            if (pendingBadgeCheck) {
              setPendingBadgeCheck(false);
              const gameType = isLocalMode ? 'USER' : 'REGION';
              const guessCountForBadge = finalGuessCount ?? guesses.length;
              console.log('[StreakCelebration] Checking badges after streak celebration:', { 
                guessCount: guessCountForBadge, 
                streak: currentStreak,
                gameType 
              });
              const badge = await checkAllBadgesOnGameComplete(
                true, 
                guessCountForBadge, 
                currentStreak,
                gameType
              );
              if (badge) {
                setEarnedBadge(badge);
                return; // Wait for badge celebration before showing end modal
              }
            }
            
            // If EndGameModal was pending (waiting for streak celebration to finish), mark as ready
            // Modal will show when both 2.5s delay has elapsed AND ready flag is set
            if (pendingEndModal) {
              setPendingEndModal(false);
              setEndModalReady(true);
            }
          }}
        />
      )}
      
      {earnedBadge && (
        <BadgeCelebrationPopup
          badge={earnedBadge}
          onDismiss={async () => {
            // Mark the badge as awarded in the backend
            try {
              await apiRequest('POST', `/api/badges/${earnedBadge.id}/award`);
              // Invalidate badges queries so stats page shows the new badge
              const { queryClient } = await import("@/lib/queryClient");
              const endpoint = isLocalMode ? '/api/user/badges/earned' : '/api/badges/earned';
              queryClient.invalidateQueries({ queryKey: [endpoint] });
            } catch (error) {
              console.error('[BadgeCelebration] Failed to mark badge as awarded:', error);
            }
            
            setEarnedBadge(null);
            // If EndGameModal was pending, mark as ready
            // Modal will show when both 2.5s delay has elapsed AND ready flag is set
            if (pendingEndModal) {
              setPendingEndModal(false);
              setEndModalReady(true);
            }
          }}
        />
      )}
      
      <InterstitialAdComponent />
      </div>
    </>
  );
}
