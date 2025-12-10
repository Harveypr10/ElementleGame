/**
 * Local cache utility for storing and retrieving data from localStorage
 * with type safety and error handling
 */

export function readLocal<T>(key: string): T | null {
  try {
    const item = localStorage.getItem(key);
    if (!item) return null;
    return JSON.parse(item) as T;
  } catch (error) {
    console.error(`Error reading from localStorage key "${key}":`, error);
    return null;
  }
}

export function writeLocal(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.error(`Error writing to localStorage key "${key}":`, error);
  }
}

export function removeLocal(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch (error) {
    console.error(`Error removing from localStorage key "${key}":`, error);
  }
}

export function clearUserCache(): void {
  // Clear all user-specific cached data on logout/login
  // This must include ALL cache keys to prevent data leakage between users
  const userKeys = [
    'cached-profile',
    'cached-settings',
    'cached-stats',
    'cached-attempts',
    'cached-today-outcome',
    'cached-percentile',
    'cached-pro-categories',
    'cached-categories-list',
    'cached-subscription',
    'cached-regions',
    'elementle-stats',
    'cluesEnabled',
  ];
  
  userKeys.forEach(key => removeLocal(key));
  
  // Clear dynamic keys: archive caches, puzzle progress, guess cache, format cache, and any other cached- prefixed keys
  try {
    const allKeys = Object.keys(localStorage);
    allKeys.forEach(key => {
      // Clear cached archive data
      if (key.startsWith('cached-archive-')) {
        removeLocal(key);
      }
      // Clear in-progress puzzle data (critical for multi-user scenarios)
      if (key.startsWith('puzzle-progress-')) {
        removeLocal(key);
      }
      // Clear guess cache data
      if (key.startsWith('guess-cache-')) {
        removeLocal(key);
      }
      // Clear format cache (region/digit preferences)
      if (key.startsWith('elementle-format-')) {
        removeLocal(key);
      }
      // Clear any other cached- prefixed data that might have been missed
      if (key.startsWith('cached-') && !userKeys.includes(key)) {
        removeLocal(key);
      }
      // Clear Supabase session tokens to ensure full sign out
      if (key.startsWith('sb-') && key.includes('-auth-token')) {
        removeLocal(key);
      }
      // Clear first login tracking
      if (key === 'elementle-first-login-completed') {
        removeLocal(key);
      }
      // Clear demand call idempotency keys
      if (key.startsWith('elementle_demand_call_')) {
        removeLocal(key);
      }
    });
  } catch (error) {
    console.error('Error clearing user caches:', error);
  }
}

/**
 * Clear all archive-related caches
 * Call this after holiday mode activation/deactivation to ensure
 * fresh data displays with correct holiday styling
 */
export function clearArchiveCache(): void {
  try {
    const allKeys = Object.keys(localStorage);
    allKeys.forEach(key => {
      if (key.startsWith('cached-archive-')) {
        removeLocal(key);
      }
    });
  } catch (error) {
    console.error('Error clearing archive cache:', error);
  }
}

// Cache key constants for consistency
export const CACHE_KEYS = {
  SETTINGS: 'cached-settings',
  PROFILE: 'cached-profile',
  STATS: 'cached-stats',
  ATTEMPTS: 'cached-attempts',
  TODAY_OUTCOME: 'cached-today-outcome',
  ARCHIVE_PREFIX: 'cached-archive-',
  PERCENTILE: 'cached-percentile',
  PRO_CATEGORIES: 'cached-pro-categories',
  CATEGORIES_LIST: 'cached-categories-list',
  SUBSCRIPTION: 'cached-subscription',
  REGIONS: 'cached-regions',
} as const;
