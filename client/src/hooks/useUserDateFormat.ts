/**
 * Custom hook to access user's date format preferences
 * Returns the effective date format based on user settings and region
 */

import { useMemo } from "react";
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
import { getCachedFormatSettings } from "@/lib/formatCache";

export function useUserDateFormat() {
  const { settings, isLoading: settingsLoading } = useUserSettings();
  const { profile, isLoading: profileLoading } = useProfile();

  // Get cached values for instant initialization
  const cachedSettings = useMemo(() => getCachedFormatSettings(), []);

  // Get effective date format based on user preferences
  // Use cached values if server data isn't loaded yet
  const dateFormat: DateFormatPreference = getEffectiveDateFormat(
    (settings?.dateFormatPreference || cachedSettings.dateFormatPreference) as DateFormatPreference | undefined,
    settings?.useRegionDefault ?? cachedSettings.useRegionDefault,
    profile?.region || cachedSettings.region,
    (settings?.digitPreference || cachedSettings.digitPreference) as '6' | '8' | undefined
  );

  // Only consider it loading if we have no data at all (not even cached)
  // If we have cached data, we can render immediately even if server data is loading
  const hasAnyData = settings || profile || cachedSettings.region;
  const isLoading = (settingsLoading || profileLoading) && !hasAnyData;

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
    isLoading,
    
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
