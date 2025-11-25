import { Button } from "@/components/ui/button";
import historianHamsterBlue from "@assets/Historian-Hamster-Blue.svg";

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

  return (
    <div className="min-h-screen w-full bg-gray-100 dark:bg-gray-900 flex flex-col items-center justify-center p-4">
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
            {clueText}
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
          className="w-1/2 text-white font-bold text-base py-4"
          style={{ backgroundColor: buttonColor }}
          data-testid="button-intro-play"
        >
          Play
        </Button>
      </div>
    </div>
  );
}
