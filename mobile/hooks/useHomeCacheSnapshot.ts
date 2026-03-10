/**
 * useHomeCacheSnapshot.ts
 * 
 * Loads ALL home-screen-relevant cached data from AsyncStorage in a
 * single multiGet call. This snapshot is used to populate the first
 * render frame with correct values, eliminating layout shift and
 * content-popping during entry animations.
 * 
 * IMPORTANT: This reads the SAME keys that are already written by
 * useHomeLogic, useSubscription, and index.tsx — no new caching
 * system is introduced.
 */

import { useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getTodaysPuzzleDate } from '../lib/dateUtils';

export interface CachedStats {
    current_streak: number;
    games_played: number;
    games_won: number;
    guess_distribution: Record<string, number>;
    cumulative_monthly_percentile: number | null;
}

export interface HomeCacheSnapshot {
    firstName: string;
    todayStatusRegion: 'not-played' | 'solved' | 'failed';
    todayStatusUser: 'not-played' | 'solved' | 'failed';
    guessesRegion: number;
    guessesUser: number;
    isPro: boolean;
    regionStats: CachedStats;
    userStats: CachedStats;
}

const DEFAULT_STATS: CachedStats = {
    current_streak: 0,
    games_played: 0,
    games_won: 0,
    guess_distribution: {},
    cumulative_monthly_percentile: null,
};

const DEFAULT_SNAPSHOT: HomeCacheSnapshot = {
    firstName: 'User',
    todayStatusRegion: 'not-played',
    todayStatusUser: 'not-played',
    guessesRegion: 0,
    guessesUser: 0,
    isPro: false,
    regionStats: DEFAULT_STATS,
    userStats: DEFAULT_STATS,
};

/**
 * Cache key helpers — matches the keys already written by existing code.
 */
function cacheKeys(userId: string) {
    return [
        `cached_first_name_${userId}`,
        `cached_game_status_region_${userId}`,
        `cached_game_status_user_${userId}`,
        `cached_is_pro_${userId}`,
        `cached_home_stats_region_${userId}`,
        `cached_home_stats_user_${userId}`,
    ];
}

export function useHomeCacheSnapshot(userId: string | undefined) {
    const [snapshot, setSnapshot] = useState<HomeCacheSnapshot>(DEFAULT_SNAPSHOT);
    const [isLoaded, setIsLoaded] = useState(false);

    useEffect(() => {
        const load = async () => {
            const id = userId ?? 'guest';
            const todayStr = getTodaysPuzzleDate();
            const keys = cacheKeys(id);

            try {
                const results = await AsyncStorage.multiGet(keys);
                const map: Record<string, string | null> = {};
                for (const [k, v] of results) {
                    map[k] = v;
                }

                // Parse game statuses (date-gated — stale cache from yesterday is ignored)
                let todayStatusRegion: 'not-played' | 'solved' | 'failed' = 'not-played';
                let guessesRegion = 0;
                const regionStatusRaw = map[`cached_game_status_region_${id}`];
                if (regionStatusRaw) {
                    try {
                        const parsed = JSON.parse(regionStatusRaw);
                        if (parsed.date === todayStr) {
                            todayStatusRegion = parsed.status;
                            guessesRegion = parsed.guesses ?? 0;
                        }
                    } catch { /* corrupt cache — use defaults */ }
                }

                let todayStatusUser: 'not-played' | 'solved' | 'failed' = 'not-played';
                let guessesUser = 0;
                const userStatusRaw = map[`cached_game_status_user_${id}`];
                if (userStatusRaw) {
                    try {
                        const parsed = JSON.parse(userStatusRaw);
                        if (parsed.date === todayStr) {
                            todayStatusUser = parsed.status;
                            guessesUser = parsed.guesses ?? 0;
                        }
                    } catch { /* corrupt cache — use defaults */ }
                }

                // Parse stats (not date-gated — stats are cumulative)
                let regionStats = DEFAULT_STATS;
                const regionStatsRaw = map[`cached_home_stats_region_${id}`];
                if (regionStatsRaw) {
                    try {
                        regionStats = { ...DEFAULT_STATS, ...JSON.parse(regionStatsRaw) };
                    } catch { /* corrupt cache — use defaults */ }
                }

                let userStatsData = DEFAULT_STATS;
                const userStatsRaw = map[`cached_home_stats_user_${id}`];
                if (userStatsRaw) {
                    try {
                        userStatsData = { ...DEFAULT_STATS, ...JSON.parse(userStatsRaw) };
                    } catch { /* corrupt cache — use defaults */ }
                }

                setSnapshot({
                    firstName: map[`cached_first_name_${id}`] || 'User',
                    todayStatusRegion,
                    todayStatusUser,
                    guessesRegion,
                    guessesUser,
                    isPro: map[`cached_is_pro_${id}`] === 'true',
                    regionStats,
                    userStats: userStatsData,
                });
            } catch (e) {
                console.warn('[HomeCacheSnapshot] Failed to load:', e);
                setSnapshot(DEFAULT_SNAPSHOT);
            } finally {
                setIsLoaded(true);
            }
        };

        load();
    }, [userId]);

    return { snapshot, isLoaded };
}
