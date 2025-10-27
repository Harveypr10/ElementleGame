/**
 * Centralized date formatting utilities for Elementle
 * Handles region-based formatting with 6-digit and 8-digit date support
 */

export type DateFormatPreference = 'ddmmyy' | 'mmddyy' | 'ddmmyyyy' | 'mmddyyyy';
export type RegionCode = 'GB' | 'US' | string;

/**
 * Get the default date format for a given region
 */
export function getRegionDefaultFormat(region: RegionCode | null | undefined): DateFormatPreference {
  if (region === 'US') {
    return 'mmddyy';
  }
  // Default to UK format (DD/MM/YY) for all other regions including GB
  return 'ddmmyy';
}

/**
 * Get the effective date format based on user settings
 */
export function getEffectiveDateFormat(
  dateFormatPreference: DateFormatPreference | null | undefined,
  useRegionDefault: boolean | null | undefined,
  region: RegionCode | null | undefined,
  digitPreference: '6' | '8' | null | undefined
): DateFormatPreference {
  let baseFormat: 'ddmm' | 'mmdd';
  
  if (useRegionDefault) {
    // Use region default
    const regionFormat = getRegionDefaultFormat(region);
    baseFormat = regionFormat.startsWith('dd') ? 'ddmm' : 'mmdd';
  } else {
    // Use explicit preference
    baseFormat = (dateFormatPreference || 'ddmmyy').startsWith('dd') ? 'ddmm' : 'mmdd';
  }
  
  // Apply digit preference
  const digits = digitPreference === '8' ? 'yyyy' : 'yy';
  return `${baseFormat}${digits}` as DateFormatPreference;
}

/**
 * Format a canonical date (YYYY-MM-DD) to the user's preferred format
 * Returns a string like "010125" or "01011925" depending on settings
 */
export function formatCanonicalDate(
  canonicalDate: string,
  format: DateFormatPreference
): string {
  const [year, month, day] = canonicalDate.split('-');
  
  // Determine year format
  const yearStr = format.endsWith('yyyy') ? year : year.slice(2);
  
  // Determine day/month order
  if (format.startsWith('dd')) {
    // DD/MM format
    return `${day}${month}${yearStr}`;
  } else {
    // MM/DD format
    return `${month}${day}${yearStr}`;
  }
}

/**
 * Helper function to validate that a date actually exists on the calendar
 * Checks for invalid dates like Feb 31, leap years, etc.
 */
function isCalendarDateValid(day: number, month: number, year: number): boolean {
  // Month must be 1-12
  if (month < 1 || month > 12) {
    return false;
  }
  
  // Create a Date object (month is 0-indexed in JavaScript Date)
  const date = new Date(year, month - 1, day);
  
  // Check if the date round-trips correctly
  // If you set Feb 31, JavaScript will roll it to Mar 3
  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  );
}

/**
 * Parse a user-entered date string based on format
 * Returns canonical format (YYYY-MM-DD) or null if invalid
 */
export function parseUserDate(
  input: string,
  format: DateFormatPreference
): string | null {
  const expectedLength = format.endsWith('yyyy') ? 8 : 6;
  if (input.length !== expectedLength) {
    return null;
  }
  
  let day: string, month: string, year: string;
  
  if (format.startsWith('dd')) {
    // DD/MM format
    day = input.slice(0, 2);
    month = input.slice(2, 4);
    year = input.slice(4);
  } else {
    // MM/DD format
    month = input.slice(0, 2);
    day = input.slice(2, 4);
    year = input.slice(4);
  }
  
  // Expand 2-digit year to 4-digit
  if (year.length === 2) {
    const yearNum = parseInt(year, 10);
    // Assume 20th century for years >= 50, 21st otherwise
    year = yearNum >= 50 ? `19${year}` : `20${year}`;
  }
  
  // Parse to integers
  const dayNum = parseInt(day, 10);
  const monthNum = parseInt(month, 10);
  const yearNum = parseInt(year, 10);
  
  // Validate that this is a real calendar date
  if (!isCalendarDateValid(dayNum, monthNum, yearNum)) {
    return null;
  }
  
  // Return in canonical format
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
}

/**
 * Get placeholder text for input grid based on format
 * Returns array like ['D', 'D', 'M', 'M', 'Y', 'Y'] or ['M', 'M', 'D', 'D', 'Y', 'Y', 'Y', 'Y']
 */
export function getPlaceholders(format: DateFormatPreference): string[] {
  const digits = format.endsWith('yyyy') ? 4 : 2;
  const yearPlaceholders = Array(digits).fill('Y');
  
  if (format.startsWith('dd')) {
    return ['D', 'D', 'M', 'M', ...yearPlaceholders];
  } else {
    return ['M', 'M', 'D', 'D', ...yearPlaceholders];
  }
}

/**
 * Get display format string for UI (e.g., "DD/MM/YY" or "MM/DD/YYYY")
 */
export function getFormatDisplay(format: DateFormatPreference): string {
  if (format === 'ddmmyy') return 'DD/MM/YY';
  if (format === 'ddmmyyyy') return 'DD/MM/YYYY';
  if (format === 'mmddyy') return 'MM/DD/YY';
  if (format === 'mmddyyyy') return 'MM/DD/YYYY';
  return 'DD/MM/YY'; // fallback
}

/**
 * Format canonical date for display with ordinal (e.g., "1st January 1925")
 */
export function formatCanonicalDateWithOrdinal(canonicalDate: string): string {
  const [year, month, day] = canonicalDate.split('-');
  const d = parseInt(day, 10);
  const m = parseInt(month, 10) - 1;
  const y = parseInt(year, 10);

  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  const getOrdinalSuffix = (n: number): string => {
    if (n > 3 && n < 21) return "th";
    switch (n % 10) {
      case 1: return "st";
      case 2: return "nd";
      case 3: return "rd";
      default: return "th";
    }
  };

  return `${d}${getOrdinalSuffix(d)} ${monthNames[m]} ${y}`;
}

/**
 * Validate a guess against the canonical answer
 */
export function validateGuess(
  guess: string,
  canonicalAnswer: string,
  format: DateFormatPreference
): boolean {
  const parsedGuess = parseUserDate(guess, format);
  return parsedGuess === canonicalAnswer;
}

// Legacy functions for backward compatibility (to be removed after migration)
export function formatDateWithOrdinal(dateString: string): string {
  // Parse date in DDMMYY format
  const day = parseInt(dateString.slice(0, 2), 10);
  const month = parseInt(dateString.slice(2, 4), 10) - 1;
  const year = parseInt(dateString.slice(4, 6), 10);
  
  const fullYear = year >= 50 ? 1900 + year : 2000 + year;
  
  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];
  
  const getOrdinalSuffix = (day: number): string => {
    if (day > 3 && day < 21) return "th";
    switch (day % 10) {
      case 1: return "st";
      case 2: return "nd";
      case 3: return "rd";
      default: return "th";
    }
  };
  
  const ordinalDay = `${day}${getOrdinalSuffix(day)}`;
  const monthName = monthNames[month];
  
  return `${ordinalDay} ${monthName} ${fullYear}`;
}

export function formatFullDateWithOrdinal(dateString: string): string {
  // Parse date in DD/MM/YYYY format
  const parts = dateString.split('/');
  const day = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1;
  const year = parseInt(parts[2], 10);
  
  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];
  
  const getOrdinalSuffix = (day: number): string => {
    if (day > 3 && day < 21) return "th";
    switch (day % 10) {
      case 1: return "st";
      case 2: return "nd";
      case 3: return "rd";
      default: return "th";
    }
  };
  
  const ordinalDay = `${day}${getOrdinalSuffix(day)}`;
  const monthName = monthNames[month];
  
  return `${ordinalDay} ${monthName} ${year}`;
}

export function isoToDisplayDate(isoString: string): string {
  const [year, month, day] = isoString.split("-");
  return `${day}/${month}/${year}`;
}

export function formatIsoDateWithOrdinal(isoString: string): string {
  return formatCanonicalDateWithOrdinal(isoString);
}
