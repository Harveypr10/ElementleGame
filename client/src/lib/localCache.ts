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
  // Clear all user-specific cached data on logout
  const userKeys = [
    'cached-profile',
    'cached-settings',
    'cached-stats',
    'cached-attempts',
    'cached-today-outcome',
    'cached-percentile',
  ];
  
  userKeys.forEach(key => removeLocal(key));
  
  // Clear archive caches and in-progress puzzle data
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
    });
  } catch (error) {
    console.error('Error clearing archive caches and puzzle progress:', error);
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
} as const;
