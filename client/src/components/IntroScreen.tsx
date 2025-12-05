import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, Loader2 } from "lucide-react";
import { useState, useEffect, useRef } from "react";
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
  formatDateForDisplay: (date: string) => string;
}

type IntroStatus = 'loading' | 'ready';

export function IntroScreen({
  puzzleDateCanonical,
  eventTitle,
  hasCluesEnabled,
  isLocalMode,
  categoryName,
  locationName,
  onPlayClick,
  onBack,
  formatDateForDisplay,
}: IntroScreenProps) {
  const [status, setStatus] = useState<IntroStatus>('loading');
  const hasStartedLoading = useRef(false);
  
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

  const handlePlayClick = () => {
    onPlayClick();
  };

  useEffect(() => {
    if (hasStartedLoading.current) return;
    hasStartedLoading.current = true;

    const img = new Image();
    img.src = welcomeHamsterGrey;
    
    Promise.all([
      img.decode().catch(() => {}),
      document.fonts?.ready || Promise.resolve(),
    ]).then(() => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setStatus('ready');
        });
      });
    });
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 flex flex-col items-center justify-center p-4 z-50"
      style={{ backgroundColor: '#FAFAFA' }}
    >
      <AnimatePresence mode="wait">
        {status === 'loading' ? (
          <motion.div
            key="spinner"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="flex items-center justify-center"
          >
            <Loader2 className="w-12 h-12 text-gray-400 animate-spin" />
          </motion.div>
        ) : (
          <motion.div
            key="content"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="flex flex-col items-center justify-center max-w-md w-full"
          >
            <button
              onClick={onBack}
              className="absolute top-4 left-4 w-14 h-14 flex items-center justify-center rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
              data-testid="button-intro-back"
            >
              <ChevronLeft className="h-9 w-9 text-gray-700 dark:text-gray-300" />
            </button>

            <div className="flex flex-col items-center justify-center space-y-6">
              <div className="h-32 w-32 flex items-center justify-center">
                <img
                  src={welcomeHamsterGrey}
                  alt="Welcome"
                  className="h-32 w-auto object-contain"
                  data-testid="img-hamster-intro"
                />
              </div>

              <div className="text-center space-y-4">
                <p className="text-lg font-bold text-gray-700 dark:text-gray-500" data-testid="text-intro-clue-prompt">
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
        )}
      </AnimatePresence>
    </motion.div>
  );
}
