/**
 * Centralized date formatting utilities for Elementle (Mobile Port)
 * Handles region-based formatting with 6-digit and 8-digit date support.
 * Ported from client/src/lib/dateFormat.ts
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

    // Apply digit preference - default to 8 digits if not specified
    const digits = digitPreference === '6' ? 'yy' : 'yyyy';
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

    // Year must be positive (1 AD or later)
    if (year < 1) {
        return false;
    }

    // Create a Date object (month is 0-indexed in JavaScript Date)
    // Use setFullYear to avoid the JS quirk where years 0-99 are treated as 1900-1999
    const date = new Date(0);
    date.setFullYear(year, month - 1, day);

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
 * CRITICAL: Single Source of Truth for "Today's Puzzle Date"
 * 
 * Get today's puzzle date in YYYY-MM-DD format using device local time.
 * 
 * This is the canonical "today" for all puzzle-related logic.
 * 
 * IMPORTANT: This should be called ONCE when the home screen loads,
 * and the result should be passed to all functions that need "today".
 * 
 * Strategy: Use device local time to match user expectation. Once set,
 * this date remains fixed throughout the user's session.
 * 
 * @returns Date string in YYYY-MM-DD format (device local time)
 */
export function getTodaysPuzzleDate(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

/**
 * Legacy alias for getTodaysPuzzleDate
 * @deprecated Use getTodaysPuzzleDate() instead
 */
export function getTodayCanonical(): string {
    return getTodaysPuzzleDate();
}

/**
 * Check if a given date string is today's puzzle date.
 * 
 * @param dateStr - Date string in YYYY-MM-DD format
 * @param todaysPuzzleDate - Optional override for "today" (for testing or fixed sessions)
 * @returns True if the date is today
 */
export function isPuzzleToday(dateStr: string, todaysPuzzleDate?: string): boolean {
    const today = todaysPuzzleDate || getTodaysPuzzleDate();
    return dateStr === today;
}

/**
 * Parse a date string (YYYY-MM-DD) as a Date object at local midnight.
 * 
 * This ensures consistent date handling across the app.
 * 
 * @param dateStr - Date string in YYYY-MM-DD format
 * @returns Date object at local midnight
 */
export function parseLocalDate(dateStr: string): Date {
    const [year, month, day] = dateStr.split('-').map(Number);
    return new Date(year, month - 1, day, 0, 0, 0, 0);
}

/**
 * Format a Date object as YYYY-MM-DD in local time.
 * 
 * @param date - Date object
 * @returns Date string in YYYY-MM-DD format
 */
export function formatLocalDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

/**
 * Calculate the number of days between two date strings.
 * 
 * @param fromDate - Start date (YYYY-MM-DD)
 * @param toDate - End date (YYYY-MM-DD)
 * @returns Number of days between dates (positive if toDate is after fromDate)
 */
export function daysBetween(fromDate: string, toDate: string): number {
    const from = parseLocalDate(fromDate);
    const to = parseLocalDate(toDate);
    const diffMs = to.getTime() - from.getTime();
    return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

/**
 * Add days to a date string.
 * 
 * @param dateStr - Date string in YYYY-MM-DD format
 * @param days - Number of days to add (can be negative)
 * @returns New date string in YYYY-MM-DD format
 */
export function addDays(dateStr: string, days: number): string {
    const date = parseLocalDate(dateStr);
    date.setDate(date.getDate() + days);
    return formatLocalDate(date);
}

/**
 * Get yesterday's date.
 * 
 * @param todayStr - Today's date string (YYYY-MM-DD)
 * @returns Yesterday's date string in YYYY-MM-DD format
 */
export function getYesterday(todayStr: string): string {
    return addDays(todayStr, -1);
}

