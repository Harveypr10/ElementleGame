/**
 * Custom hook to access user's date format preferences
 * Returns the effective date format based on user settings and region
 */

import { useUserSettings } from "./useUserSettings";
import { useProfile } from "./useProfile";
import {
  getEffectiveDateFormat,
  type DateFormatPreference,
  getPlaceholders,
  getFormatDisplay,
  formatCanonicalDate,
  parseUserDate,
  validateGuess,
  formatCanonicalDateWithOrdinal
} from "@/lib/dateFormat";

export function useUserDateFormat() {
  const { settings } = useUserSettings();
  const { profile } = useProfile();

  // Get effective date format based on user preferences
  const dateFormat: DateFormatPreference = getEffectiveDateFormat(
    settings?.dateFormatPreference as DateFormatPreference | undefined,
    settings?.useRegionDefault,
    profile?.region,
    settings?.digitPreference as '6' | '8' | undefined
  );

  const placeholders = getPlaceholders(dateFormat);
  const formatDisplay = getFormatDisplay(dateFormat);
  const numDigits = dateFormat.endsWith('yyyy') ? 8 : 6;
  const isUK = dateFormat.startsWith('dd');
  const isUS = dateFormat.startsWith('mm');

  return {
    // Core format info
    dateFormat,
    numDigits,
    isUK,
    isUS,
    
    // Display helpers
    placeholders,
    formatDisplay,
    
    // Formatting functions
    formatCanonicalDate: (canonicalDate: string) => formatCanonicalDate(canonicalDate, dateFormat),
    parseUserDate: (input: string) => parseUserDate(input, dateFormat),
    validateGuess: (guess: string, canonicalAnswer: string) => validateGuess(guess, canonicalAnswer, dateFormat),
    formatWithOrdinal: formatCanonicalDateWithOrdinal,
    
    // Settings for reference
    settings,
    profile
  };
}
