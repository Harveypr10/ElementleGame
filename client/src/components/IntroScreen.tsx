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
}: IntroScreenProps) {
  const displayDate = formatDateForDisplay(puzzleDateCanonical);
  
  // Button colors match GameSelectionPage
  const buttonColor = isLocalMode ? "#66becb" : "#7DAAE8";
  
  // Determine if this is a category question (local mode) or location question (global mode)
  const isCategoryQuestion = !!categoryName && !locationName;
  const isLocationQuestion = !!locationName && !categoryName;
  
  const promptText = hasCluesEnabled 
    ? (isCategoryQuestion ? "On what date did this historical event occur?" : "On what date did this local event occur?")
    : "Take on the challenge of guessing a date in history!";
    
  // Build category/location label
  const categoryOrLocationLabel = isCategoryQuestion 
    ? categoryName 
    : (isLocationQuestion ? locationName : null);

  const handlePlayClick = () => {
    console.log('[IntroScreen] Play button clicked');
    onPlayClick();
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
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
        />

        {/* Clue Text */}
        <div className="text-center space-y-4">
          <p className="text-lg font-bold text-gray-700 dark:text-gray-500" data-testid="text-intro-clue-prompt">
            {hasCluesEnabled ? promptText : "Take on the challenge of guessing a date in history!"}
          </p>
          
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
