import { motion, usePresence } from "framer-motion";
import { ChevronLeft } from "lucide-react";
import { useState, useEffect, useRef, useCallback } from "react";
import { useSpinnerWithTimeout } from "@/lib/SpinnerProvider";
import welcomeHamsterGrey from "@assets/Welcome-Hamster-Grey.svg";

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
}: IntroScreenProps) {
  const [shouldRender, setShouldRender] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [isExiting, setIsExiting] = useState(false);
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
    
    // Show hamster spinner immediately
    if (!spinnerManagedRef.current) {
      console.log('[IntroScreen] Starting hamster spinner');
      spinner.start(0);
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
      className="fixed inset-0 z-50 flex flex-col items-center justify-center"
      style={{ backgroundColor: '#FAFAFA' }}
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
            className="absolute top-4 left-4 w-14 h-14 flex items-center justify-center rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
            data-testid="button-intro-back"
            style={{ pointerEvents: isReady && !isExiting ? 'auto' : 'none' }}
          >
            <ChevronLeft className="h-9 w-9 text-gray-700 dark:text-gray-300" />
          </motion.button>

          {/* Content - opacity controlled, layout always maintained */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: isReady && !isExiting ? 1 : 0 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            className="flex flex-col items-center justify-center max-w-md w-full p-4"
            style={{ pointerEvents: isReady && !isExiting ? 'auto' : 'none' }}
          >
            <div className="flex flex-col items-center justify-center w-full space-y-6">
              <div className="h-32 w-32 flex items-center justify-center">
                <img
                  src={welcomeHamsterGrey}
                  alt="Welcome"
                  className="h-32 w-auto object-contain"
                  data-testid="img-hamster-intro"
                />
              </div>

              <div className="text-center space-y-4">
                <p className="text-lg font-bold text-gray-700 dark:text-gray-500" data-testid="text-intro-clue-prompt" style={{ maxWidth: '280px', margin: '0 auto' }}>
                  {hasCluesEnabled ? promptText : "Take on the challenge of guessing a date in history!"}
                </p>
                
                <div className="space-y-0">
                  {hasCluesEnabled && categoryOrLocationLabel && (
                    <p className="text-xl font-bold dark:text-blue-400" style={{ color: '#1e3a8a' }} data-testid="text-intro-category-location">
                      {categoryOrLocationLabel}
                    </p>
                  )}
                  
                  {hasCluesEnabled && (
                    <p className="text-xl font-bold text-gray-600 dark:text-gray-400" data-testid="text-intro-event-title">
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

              <p className="text-sm text-gray-500 dark:text-gray-500" data-testid="text-intro-puzzle-date">
                Puzzle date: {displayDate}
              </p>
            </div>
          </motion.div>
        </>
      )}
    </motion.div>
  );
}
