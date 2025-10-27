/**
 * LocalStorage caching for date format settings
 * Provides instant format initialization before async data loads
 */

const CACHE_KEY_REGION = 'cached-region';
const CACHE_KEY_DIGIT_PREF = 'cached-digit-preference';
const CACHE_KEY_USE_REGION_DEFAULT = 'cached-use-region-default';
const CACHE_KEY_DATE_FORMAT_PREF = 'cached-date-format-preference';

export interface CachedFormatSettings {
  region?: string | null;
  digitPreference?: '6' | '8' | null;
  useRegionDefault?: boolean | null;
  dateFormatPreference?: string | null;
}

/**
 * Get cached format settings from localStorage
 */
export function getCachedFormatSettings(): CachedFormatSettings {
  try {
    const region = localStorage.getItem(CACHE_KEY_REGION);
    const digitPreference = localStorage.getItem(CACHE_KEY_DIGIT_PREF) as '6' | '8' | null;
    const useRegionDefault = localStorage.getItem(CACHE_KEY_USE_REGION_DEFAULT);
    const dateFormatPreference = localStorage.getItem(CACHE_KEY_DATE_FORMAT_PREF);

    return {
      region: region || null,
      digitPreference: digitPreference || null,
      useRegionDefault: useRegionDefault ? JSON.parse(useRegionDefault) : null,
      dateFormatPreference: dateFormatPreference || null,
    };
  } catch (error) {
    console.error('[formatCache] Error reading cache:', error);
    return {};
  }
}

/**
 * Update cached region in localStorage
 */
export function setCachedRegion(region: string | null | undefined) {
  try {
    if (region) {
      localStorage.setItem(CACHE_KEY_REGION, region);
    } else {
      localStorage.removeItem(CACHE_KEY_REGION);
    }
  } catch (error) {
    console.error('[formatCache] Error setting region:', error);
  }
}

/**
 * Update cached digit preference in localStorage
 */
export function setCachedDigitPreference(digitPreference: '6' | '8' | null | undefined) {
  try {
    if (digitPreference) {
      localStorage.setItem(CACHE_KEY_DIGIT_PREF, digitPreference);
    } else {
      localStorage.removeItem(CACHE_KEY_DIGIT_PREF);
    }
  } catch (error) {
    console.error('[formatCache] Error setting digit preference:', error);
  }
}

/**
 * Update cached useRegionDefault setting in localStorage
 */
export function setCachedUseRegionDefault(useRegionDefault: boolean | null | undefined) {
  try {
    if (useRegionDefault !== null && useRegionDefault !== undefined) {
      localStorage.setItem(CACHE_KEY_USE_REGION_DEFAULT, JSON.stringify(useRegionDefault));
    } else {
      localStorage.removeItem(CACHE_KEY_USE_REGION_DEFAULT);
    }
  } catch (error) {
    console.error('[formatCache] Error setting useRegionDefault:', error);
  }
}

/**
 * Update cached date format preference in localStorage
 */
export function setCachedDateFormatPreference(dateFormatPreference: string | null | undefined) {
  try {
    if (dateFormatPreference) {
      localStorage.setItem(CACHE_KEY_DATE_FORMAT_PREF, dateFormatPreference);
    } else {
      localStorage.removeItem(CACHE_KEY_DATE_FORMAT_PREF);
    }
  } catch (error) {
    console.error('[formatCache] Error setting date format preference:', error);
  }
}

/**
 * Update all cached format settings at once
 */
export function setCachedFormatSettings(settings: CachedFormatSettings) {
  setCachedRegion(settings.region);
  setCachedDigitPreference(settings.digitPreference);
  setCachedUseRegionDefault(settings.useRegionDefault);
  setCachedDateFormatPreference(settings.dateFormatPreference);
}

/**
 * Clear all cached format settings
 */
export function clearCachedFormatSettings() {
  try {
    localStorage.removeItem(CACHE_KEY_REGION);
    localStorage.removeItem(CACHE_KEY_DIGIT_PREF);
    localStorage.removeItem(CACHE_KEY_USE_REGION_DEFAULT);
    localStorage.removeItem(CACHE_KEY_DATE_FORMAT_PREF);
  } catch (error) {
    console.error('[formatCache] Error clearing cache:', error);
  }
}
