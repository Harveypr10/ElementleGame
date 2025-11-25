import { motion } from "framer-motion";
import welcomeHamsterGrey from "@assets/Welcome-Hamster-Grey.svg";

interface IntroScreenProps {
  puzzleDateCanonical: string; // YYYY-MM-DD format
  eventTitle: string;
  hasCluesEnabled: boolean;
  isLocalMode: boolean;
  categoryName?: string;
  onPlayClick: () => void;
  formatDateForDisplay: (date: string) => string;
}

export function IntroScreen({
  puzzleDateCanonical,
  eventTitle,
  hasCluesEnabled,
  isLocalMode,
  categoryName,
  onPlayClick,
  formatDateForDisplay,
}: IntroScreenProps) {
  const displayDate = formatDateForDisplay(puzzleDateCanonical);
  
  // Button colors match GameSelectionPage
  const buttonColor = isLocalMode ? "#66becb" : "#7DAAE8";
  
  const clueText = hasCluesEnabled 
    ? `${categoryName ? categoryName + ": " : ""}On what date in history did this event occur?`
    : "Take on the challenge of guessing a date in history!";

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
      <div className="flex flex-col items-center justify-center max-w-md w-full space-y-6">
        {/* Hamster Image */}
        <img
          src={welcomeHamsterGrey}
          alt="Welcome"
          className="h-32 w-auto object-contain"
          data-testid="img-hamster-intro"
        />

        {/* Clue Text */}
        <div className="text-center space-y-2">
          <p className="text-lg font-bold text-gray-600 dark:text-gray-400" data-testid="text-intro-clue-prompt">
            {clueText}
          </p>
          {hasCluesEnabled && (
            <p className="text-base text-gray-600 dark:text-gray-400" data-testid="text-intro-event-title">
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
