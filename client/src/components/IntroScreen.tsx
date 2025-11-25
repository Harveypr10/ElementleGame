import { Button } from "@/components/ui/button";
import historianHamsterBlue from "@assets/Historian-Hamster-Blue.svg";

interface IntroScreenProps {
  puzzleDateCanonical: string; // YYYY-MM-DD format
  eventTitle: string;
  hasCluesEnabled: boolean;
  isLocalMode: boolean;
  onPlayClick: () => void;
  onBackClick: () => void;
  formatDateForDisplay: (date: string) => string;
}

export function IntroScreen({
  puzzleDateCanonical,
  eventTitle,
  hasCluesEnabled,
  isLocalMode,
  onPlayClick,
  onBackClick,
  formatDateForDisplay,
}: IntroScreenProps) {
  const displayDate = formatDateForDisplay(puzzleDateCanonical);
  
  // Button colors match GameSelectionPage
  const buttonColor = isLocalMode ? "#66becb" : "#7DAAE8";

  return (
    <div className="min-h-screen w-full bg-gray-100 dark:bg-gray-900 flex flex-col items-center justify-center p-4">
      <button
        onClick={onBackClick}
        className="absolute top-4 left-4 w-10 h-10 flex items-center justify-center rounded-full hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors"
        data-testid="button-back-from-intro"
      >
        <svg
          className="w-6 h-6 text-gray-600 dark:text-gray-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 19l-7-7 7-7"
          />
        </svg>
      </button>

      <div className="flex flex-col items-center justify-center max-w-md w-full space-y-6">
        {/* Hamster Image */}
        <img
          src={historianHamsterBlue}
          alt="Welcome"
          className="h-32 w-auto object-contain"
          data-testid="img-hamster-intro"
        />

        {/* Date */}
        <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-100 text-center" data-testid="text-intro-date">
          {displayDate}
        </h1>

        {/* Clue Text */}
        <div className="text-center space-y-2">
          <p className="text-lg font-bold text-gray-600 dark:text-gray-400" data-testid="text-intro-clue-prompt">
            {hasCluesEnabled ? "On what date in history did this event occur?" : "Take on the challenge of guessing a date in history!"}
          </p>
          {hasCluesEnabled && (
            <p className="text-base text-gray-600 dark:text-gray-400" data-testid="text-intro-event-title">
              {eventTitle}
            </p>
          )}
        </div>

        {/* Play Button */}
        <Button
          onClick={onPlayClick}
          className="w-full text-white font-bold text-lg py-6"
          style={{ backgroundColor: buttonColor }}
          data-testid="button-intro-play"
        >
          Play
        </Button>
      </div>
    </div>
  );
}
