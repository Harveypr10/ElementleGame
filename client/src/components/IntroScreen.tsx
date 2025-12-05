import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { ChevronLeft } from "lucide-react";
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
  onContentReady?: () => void; // Called when image and content are fully ready
  isContentPreloaded?: boolean; // If true, content is already loaded (skip internal loading)
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
  formatDateForDisplay,
  onContentReady,
  isContentPreloaded = false,
}: IntroScreenProps) {
  const [imageLoaded, setImageLoaded] = useState(isContentPreloaded);
  const [isReady, setIsReady] = useState(isContentPreloaded);
  const hasNotifiedReady = useRef(false);
  
  // Notify parent when content is ready
  useEffect(() => {
    if (imageLoaded && !hasNotifiedReady.current) {
      hasNotifiedReady.current = true;
      // Small delay to ensure layout has settled
      requestAnimationFrame(() => {
        setIsReady(true);
        onContentReady?.();
      });
    }
  }, [imageLoaded, onContentReady]);
  
  const displayDate = formatDateForDisplay(puzzleDateCanonical);
  
  // Button colors match GameSelectionPage
  const buttonColor = isLocalMode ? "#66becb" : "#7DAAE8";
  
  // Determine if this is a category question (local mode) or location question (global mode)
  const isCategoryQuestion = !!categoryName && !locationName;
  const isLocationQuestion = !!locationName && !categoryName;
  // Check if category starts with "Local History" (e.g., "Local History" or "Local History: London")
  const isLocalHistoryCategory = categoryName?.startsWith("Local History") ?? false;
  const isLocalHistoryWithLocation = isLocalHistoryCategory && !!locationName;
  
  const promptText = hasCluesEnabled 
    ? (isLocalHistoryCategory ? "On what date did this local event occur?" : "On what date did this historical event occur?")
    : "Take on the challenge of guessing a date in history!";
    
  // Build category/location label
  let categoryOrLocationLabel: string | null = null;
  if (isCategoryQuestion) {
    categoryOrLocationLabel = categoryName || null;
  } else if (isLocalHistoryWithLocation) {
    categoryOrLocationLabel = `Local History - ${locationName}:`;
  } else if (isLocationQuestion) {
    categoryOrLocationLabel = locationName || null;
  }

  const handlePlayClick = () => {
    console.log('[IntroScreen] Play button clicked');
    onPlayClick();
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: isReady ? 1 : 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      className="fixed inset-0 flex flex-col items-center justify-center p-4 z-50"
      style={{ backgroundColor: '#FAFAFA' }}
    >
      {/* Back Button - top left corner */}
      <button
        onClick={onBack}
        className="absolute top-4 left-4 w-14 h-14 flex items-center justify-center rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
        data-testid="button-intro-back"
        style={{ opacity: isReady ? 1 : 0 }}
      >
        <ChevronLeft className="h-9 w-9 text-gray-700 dark:text-gray-300" />
      </button>

      <div className="flex flex-col items-center justify-center max-w-md w-full space-y-6">
        {/* Hamster Image */}
        <img
          src={welcomeHamsterGrey}
          alt="Welcome"
          className="h-32 w-auto object-contain"
          data-testid="img-hamster-intro"
          onLoad={() => setImageLoaded(true)}
        />

        {/* Clue Text */}
        <div className="text-center space-y-4">
          <p className="text-lg font-bold text-gray-700 dark:text-gray-500" data-testid="text-intro-clue-prompt">
            {hasCluesEnabled ? promptText : "Take on the challenge of guessing a date in history!"}
          </p>
          
          {/* Category/Location and Event Title - no gap between them */}
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

        {/* Play Button - rounder corners and larger font */}
        <button
          onClick={handlePlayClick}
          className="w-1/2 text-white font-bold text-xl py-4 rounded-full hover:opacity-90 transition-opacity"
          style={{ backgroundColor: buttonColor }}
          data-testid="button-intro-play"
        >
          Play
        </button>

        {/* Puzzle Date - below Play button with smaller font */}
        <p className="text-sm text-gray-500 dark:text-gray-500" data-testid="text-intro-puzzle-date">
          Puzzle date: {displayDate}
        </p>
      </div>
    </motion.div>
  );
}
