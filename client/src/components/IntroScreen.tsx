import { motion, usePresence } from "framer-motion";
import { ChevronLeft, X } from "lucide-react";
import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useSpinnerWithTimeout } from "@/lib/SpinnerProvider";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
} from "@/components/ui/alert-dialog";
import welcomeHamsterGrey from "@assets/Welcome-Hamster-Grey.svg";
import streakHamsterBlack from "@assets/Streak-Hamster-Black.svg";

interface IntroScreenProps {
  puzzleDateCanonical: string; // YYYY-MM-DD format
  eventTitle: string;
  hasCluesEnabled: boolean;
  isLocalMode: boolean;
  categoryName?: string;
  locationName?: string;
  onPlayClick: () => void;
  onBack: () => void;
  onExitStart?: () => void; // Called immediately when back is pressed, before animation starts
  formatDateForDisplay: (date: string) => string;
  currentStreak?: number; // Current streak for this game mode
  isStreakGame?: boolean; // Whether this game can continue/add to the streak
  isStreakSaverGame?: boolean; // Whether this is a streak saver game (playing yesterday's puzzle)
}

export function IntroScreen({
  puzzleDateCanonical,
  eventTitle,
  hasCluesEnabled,
  isLocalMode,
  categoryName,
  locationName,
  onPlayClick,
  onBack,
  onExitStart,
  formatDateForDisplay,
  currentStreak = 0,
  isStreakGame = false,
  isStreakSaverGame = false,
}: IntroScreenProps) {
  const [shouldRender, setShouldRender] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [isExiting, setIsExiting] = useState(false);
  const [showStreakSaverInfo, setShowStreakSaverInfo] = useState(false);
  const streakSaverInfoShown = useRef(false);
  const spinnerManagedRef = useRef(false);
  const hasStartedLoading = useRef(false);
  const exitCallbackRef = useRef<(() => void) | null>(null);
  const [isPresent, safeToRemove] = usePresence();
  
  const displayDate = formatDateForDisplay(puzzleDateCanonical);
  
  const buttonColor = isLocalMode ? "#66becb" : "#7DAAE8";
  
  const isCategoryQuestion = !!categoryName && !locationName;
  const isLocationQuestion = !!locationName && !categoryName;
  const isLocalHistoryCategory = categoryName?.startsWith("Local History") ?? false;
  const isLocalHistoryWithLocation = isLocalHistoryCategory && !!locationName;
  
  const promptText = hasCluesEnabled 
    ? (isLocalHistoryCategory ? "On what date did this local event occur?" : "On what date did this historical event occur?")
    : "Take on the challenge of guessing a date in history!";
    
  let categoryOrLocationLabel: string | null = null;
  if (isCategoryQuestion) {
    categoryOrLocationLabel = categoryName || null;
  } else if (isLocalHistoryWithLocation) {
    categoryOrLocationLabel = `Local History - ${locationName}:`;
  } else if (isLocationQuestion) {
    categoryOrLocationLabel = locationName || null;
  }

  // Track dark mode state
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
  
  // Determine background color based on streak game status and dark mode
  // Light mode: #FAFAFA (near white), Dark mode: hsl(222, 47%, 11%) = #0f172a (dark blue)
  const backgroundColor = useMemo(() => {
    if (isStreakGame) return '#000000';
    return isDarkMode ? 'hsl(222, 47%, 11%)' : '#FAFAFA';
  }, [isStreakGame, isDarkMode]);
  
  // Use the global hamster spinner with onFadeOutComplete to sequence animations
  const spinner = useSpinnerWithTimeout({
    retryDelayMs: 4000,
    timeoutMs: 8000,
    onRetry: () => {
      console.log('[IntroScreen] Spinner timeout - retrying asset load');
    },
    onTimeout: () => {
      console.log('[IntroScreen] Spinner timeout - proceeding anyway');
      setIsReady(true);
    },
    onFadeOutComplete: () => {
      // Only show content AFTER hamster has fully faded out
      console.log('[IntroScreen] Hamster fade complete - showing content');
      setIsReady(true);
    },
  });
  
  // Spinner always uses default background - don't pass streak's black background
  // For streak games, spinner uses default light bg, then IntroScreen fades in with black
  const spinnerBackgroundColor = isStreakGame ? undefined : backgroundColor;

  // Handle exit animation completion
  const handleExitComplete = useCallback(() => {
    if (exitCallbackRef.current) {
      exitCallbackRef.current();
      exitCallbackRef.current = null;
    }
  }, []);

  // Unified exit handler - used by both Play and Back buttons
  const triggerExit = useCallback((callback: () => void) => {
    exitCallbackRef.current = callback;
    setIsExiting(true);
  }, []);

  const handlePlayClick = useCallback(() => {
    triggerExit(onPlayClick);
  }, [onPlayClick, triggerExit]);
  
  const handleBack = useCallback(() => {
    // Call onExitStart immediately so parent can start fading its content
    onExitStart?.();
    // Small delay before starting slide animation - lets parent content fade first
    setTimeout(() => {
      triggerExit(onBack);
    }, 50);
  }, [onBack, onExitStart, triggerExit]);

  // Delay initial render by 150ms to let spinner fully paint first
  useEffect(() => {
    const timer = setTimeout(() => {
      setShouldRender(true);
    }, 150);
    return () => clearTimeout(timer);
  }, []);

  // Start spinner and preload assets on mount
  useEffect(() => {
    if (hasStartedLoading.current) return;
    hasStartedLoading.current = true;
    
    // Show hamster spinner immediately with matching background color
    if (!spinnerManagedRef.current) {
      console.log('[IntroScreen] Starting hamster spinner');
      spinner.start(0, spinnerBackgroundColor);
      spinnerManagedRef.current = true;
    }

    // Preload image and wait for fonts
    const img = new Image();
    img.src = welcomeHamsterGrey;
    
    Promise.all([
      img.decode().catch(() => {}),
      document.fonts?.ready || Promise.resolve(),
    ]).then(() => {
      // Use double requestAnimationFrame to ensure layout is committed
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          console.log('[IntroScreen] Assets ready, completing spinner (waiting for fade out)');
          spinner.complete();
          // Note: isReady is now set via onFadeOutComplete callback
        });
      });
    });
  }, [spinner]);

  // Only cancel spinner AFTER exit animation completes (when no longer present)
  useEffect(() => {
    if (!isPresent && spinnerManagedRef.current) {
      const timer = setTimeout(() => {
        if (spinnerManagedRef.current) {
          spinner.cancel();
          spinnerManagedRef.current = false;
        }
        safeToRemove?.();
      }, 300);
      
      return () => clearTimeout(timer);
    }
  }, [isPresent, spinner, safeToRemove]);

  // Text colors that adapt to dark mode
  const textColor = useMemo(() => {
    if (isStreakGame) return '#FFFFFF';
    return isDarkMode ? '#FAFAFA' : '#54524F';
  }, [isStreakGame, isDarkMode]);
  
  const categoryTextColor = useMemo(() => {
    if (isStreakGame) return '#FFD700';
    return isDarkMode ? '#7DAAE8' : '#1e3a8a'; // Lighter blue in dark mode
  }, [isStreakGame, isDarkMode]);
  
  const streakRedColor = '#DC2626'; // Same red as streak celebration popup (text-red-600)
  
  // Show streak saver info popup when entering a streak saver game
  useEffect(() => {
    if (isStreakSaverGame && isReady && !streakSaverInfoShown.current) {
      streakSaverInfoShown.current = true;
      setShowStreakSaverInfo(true);
    }
  }, [isStreakSaverGame, isReady]);
  
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={isExiting ? { x: "-100%", opacity: 0 } : { opacity: 1 }}
      exit={{ x: "-100%", opacity: 0 }}
      transition={{ duration: 0.25, ease: "easeInOut" }}
      onAnimationComplete={() => {
        if (isExiting) {
          handleExitComplete();
        }
      }}
      className="fixed z-50 flex flex-col items-center justify-center"
      style={{ 
        backgroundColor,
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        width: '100%',
        height: '100%',
      }}
    >
      {/* Only render content after 150ms delay to avoid flash behind spinner */}
      {shouldRender && (
        <>
          {/* Back button - fixed position, not affected by content layout */}
          <motion.button
            initial={{ opacity: 0 }}
            animate={{ opacity: isReady && !isExiting ? 1 : 0 }}
            transition={{ duration: 0.2 }}
            onClick={handleBack}
            className="absolute top-4 left-4 w-14 h-14 flex items-center justify-center rounded-full transition-colors"
            style={{
              pointerEvents: isReady && !isExiting ? 'auto' : 'none',
              backgroundColor: isStreakGame ? 'rgba(255, 255, 255, 0.1)' : 'transparent',
              ...(isStreakGame && { borderRadius: '50%' })
            }}
            data-testid="button-intro-back"
          >
            <ChevronLeft className="h-9 w-9" style={{ color: isStreakGame ? '#FFFFFF' : (isDarkMode ? '#FAFAFA' : '#54524F') }} />
          </motion.button>

          {/* Content - opacity controlled, layout always maintained */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: isReady && !isExiting ? 1 : 0 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            className="flex flex-col items-center justify-center max-w-md w-full p-4"
            style={{ pointerEvents: isReady && !isExiting ? 'auto' : 'none' }}
          >
            <div className="flex flex-col items-center justify-center w-full space-y-6 h-full">
              {isStreakGame && (
                <div className="relative w-48 h-48 flex items-center justify-center">
                  <img
                    src={streakHamsterBlack}
                    alt="Streak"
                    className="w-full h-full object-contain"
                    data-testid="img-hamster-intro"
                  />
                  <div 
                    className="absolute inset-0 flex items-center justify-center"
                    style={{ top: "50%" }}
                  >
                    <span
                      className={`font-bold drop-shadow-lg leading-none ${
                        String(currentStreak).length === 1
                          ? "text-5xl"
                          : String(currentStreak).length === 2
                          ? "text-4xl"
                          : "text-3xl"
                      }`}
                      style={{ color: streakRedColor }}
                      data-testid="text-intro-streak-number"
                    >
                      {currentStreak}
                    </span>
                  </div>
                </div>
              )}
              
              {!isStreakGame && (
                <div className="h-32 w-32 flex items-center justify-center">
                  <img
                    src={welcomeHamsterGrey}
                    alt="Welcome"
                    className="h-32 w-auto object-contain"
                    data-testid="img-hamster-intro"
                  />
                </div>
              )}

              <div className="text-center space-y-4 flex-grow flex flex-col justify-center">
                <p className="font-bold text-lg" data-testid="text-intro-clue-prompt" style={{ maxWidth: isLocalHistoryCategory ? '240px' : '280px', margin: '0 auto', color: isStreakGame ? streakRedColor : textColor }}>
                  {isStreakGame ? "Continue your streak!" : (hasCluesEnabled ? promptText : "Take on the challenge of guessing a date in history!")}
                </p>
                
                <div className="space-y-0">
                  {hasCluesEnabled && categoryOrLocationLabel && (
                    <p className="text-xl font-bold" data-testid="text-intro-category-location" style={{ color: categoryTextColor }}>
                      {categoryOrLocationLabel}
                    </p>
                  )}
                  
                  {hasCluesEnabled && (
                    <p className="text-xl font-bold" data-testid="text-intro-event-title" style={{ color: textColor }}>
                      {eventTitle}
                    </p>
                  )}
                </div>
              </div>

              <button
                onClick={handlePlayClick}
                className="w-1/2 text-white font-bold text-xl py-4 rounded-full hover:opacity-90 transition-opacity"
                style={{ backgroundColor: buttonColor }}
                data-testid="button-intro-play"
              >
                Play
              </button>

              <p className="text-sm" data-testid="text-intro-puzzle-date" style={{ color: isStreakGame ? 'rgba(255, 255, 255, 0.7)' : (isDarkMode ? 'rgba(255, 255, 255, 0.6)' : '#999') }}>
                Puzzle date: {displayDate}
              </p>
            </div>
          </motion.div>
        </>
      )}
      
      {/* Streak Saver Info Popup */}
      <AlertDialog open={showStreakSaverInfo} onOpenChange={setShowStreakSaverInfo}>
        <AlertDialogContent className="rounded-xl max-w-[calc(100vw-2rem)] sm:max-w-md" data-testid="streak-saver-info-dialog">
          <button
            onClick={() => setShowStreakSaverInfo(false)}
            className="absolute top-4 right-4 p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            data-testid="button-close-streak-saver-info"
          >
            <X className="h-5 w-5 text-gray-500" />
          </button>
          <AlertDialogHeader className="text-center pr-8">
            <AlertDialogTitle className="text-lg font-semibold">
              Streak Saver
            </AlertDialogTitle>
            <AlertDialogDescription className="text-center text-sm text-muted-foreground mt-2">
              To keep your streak going you must win this puzzle from yesterday. Exiting will reset your streak, without using your streak saver.
            </AlertDialogDescription>
          </AlertDialogHeader>
        </AlertDialogContent>
      </AlertDialog>
    </motion.div>
  );
}
