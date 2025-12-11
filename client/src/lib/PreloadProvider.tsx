import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { writeLocal, readLocal, CACHE_KEYS } from '@/lib/localCache';
import { getSupabaseClient } from '@/lib/supabaseClient';

// Import images to preload
import historianHamsterBlue from '@assets/Historian-Hamster-Blue.svg';
import librarianHamsterYellow from '@assets/Librarian-Hamster-Yellow.svg';
import mathsHamsterGreen from '@assets/Maths-Hamster-Green.svg';
import mechanicHamsterGrey from '@assets/Mechanic-Hamster-Grey.svg';
import whiteTickBlue from '@assets/Win-Hamster-Blue.svg';
import whiteCrossBlue from '@assets/Lost-Hamster-Blue.svg';

interface PreloadContextValue {
  isPreloaded: boolean;
}

const PreloadContext = createContext<PreloadContextValue>({ isPreloaded: false });

export function usePreload() {
  return useContext(PreloadContext);
}

interface PreloadProviderProps {
  children: ReactNode;
}

export function PreloadProvider({ children }: PreloadProviderProps) {
  const [isPreloaded, setIsPreloaded] = useState(false);
  const { user, isAuthenticated } = useAuth();

  // Hydrate query cache from localStorage immediately on mount (synchronous)
  // This ensures isAdmin and region are available instantly before network requests
  useEffect(() => {
    if (isAuthenticated) {
      const cachedProfile = readLocal<any>(CACHE_KEYS.PROFILE);
      if (cachedProfile) {
        queryClient.setQueryData(['/api/auth/profile'], cachedProfile);
        console.log('[PreloadProvider] Hydrated profile from cache with isAdmin:', cachedProfile.isAdmin, 'region:', cachedProfile.region);
      }
    }
  }, [isAuthenticated]);

  useEffect(() => {
    const preloadAssets = async () => {
      // Preload images
      const imagesToPreload = [
        historianHamsterBlue,
        librarianHamsterYellow,
        mathsHamsterGreen,
        mechanicHamsterGrey,
        whiteTickBlue,
        whiteCrossBlue,
      ];

      const imagePromises = imagesToPreload.map(src => {
        return new Promise((resolve, reject) => {
          const img = new Image();
          img.onload = resolve;
          img.onerror = reject;
          img.src = src;
        });
      });

      // Wait for all images to load (but don't block on errors)
      await Promise.allSettled(imagePromises);

      // Prefetch data if authenticated - handle each independently
      if (isAuthenticated && user) {
        // Get auth token once for authenticated requests
        let authToken: string | null = null;
        try {
          const supabase = await getSupabaseClient();
          const { data: { session } } = await supabase.auth.getSession();
          authToken = session?.access_token || null;
        } catch {
          console.warn('[PreloadProvider] Failed to get auth session');
        }

        const prefetchTasks = [
          // Prefetch settings
          queryClient.fetchQuery({
            queryKey: ['/api/settings'],
            queryFn: async () => {
              const response = await fetch('/api/settings', {
                credentials: 'include',
              });
              if (!response.ok) throw new Error('Failed to fetch settings');
              return response.json();
            },
            staleTime: 5 * 60 * 1000,
          }).then(data => ({ key: 'settings', data })).catch(() => ({ key: 'settings', data: null })),

          // Prefetch profile with auth token for faster Account Info page load
          queryClient.fetchQuery({
            queryKey: ['/api/auth/profile'],
            queryFn: async () => {
              const headers: Record<string, string> = {};
              if (authToken) {
                headers['Authorization'] = `Bearer ${authToken}`;
              }
              const response = await fetch('/api/auth/profile', {
                credentials: 'include',
                headers,
              });
              if (!response.ok) throw new Error('Failed to fetch profile');
              return response.json();
            },
            staleTime: 5 * 60 * 1000,
          }).then(data => ({ key: 'profile', data })).catch(() => ({ key: 'profile', data: null })),

          // Prefetch regions for Account Info page (public data, no auth needed)
          queryClient.fetchQuery({
            queryKey: ['/api/regions'],
            queryFn: async () => {
              const response = await fetch('/api/regions', {
                credentials: 'include',
              });
              if (!response.ok) throw new Error('Failed to fetch regions');
              return response.json();
            },
            staleTime: 30 * 60 * 1000, // Cache for 30 mins since regions rarely change
          }).then(data => ({ key: 'regions', data })).catch(() => ({ key: 'regions', data: null })),

          // Prefetch stats (requires auth)
          authToken ? queryClient.fetchQuery({
            queryKey: ['/api/stats'],
            queryFn: async () => {
              const response = await fetch('/api/stats', {
                credentials: 'include',
                headers: {
                  'Authorization': `Bearer ${authToken}`,
                },
              });
              if (!response.ok) throw new Error('Failed to fetch stats');
              return response.json();
            },
            staleTime: 5 * 60 * 1000,
          }).then(data => ({ key: 'stats', data })).catch(() => ({ key: 'stats', data: null }))
          : Promise.resolve({ key: 'stats', data: null }),

          // Prefetch game attempts (requires auth)
          authToken ? queryClient.fetchQuery({
            queryKey: ['/api/game-attempts/user'],
            queryFn: async () => {
              const response = await fetch('/api/game-attempts/user', {
                credentials: 'include',
                headers: {
                  'Authorization': `Bearer ${authToken}`,
                },
              });
              if (!response.ok) throw new Error('Failed to fetch attempts');
              return response.json();
            },
            staleTime: 5 * 60 * 1000,
          }).then(data => ({ key: 'attempts', data })).catch(() => ({ key: 'attempts', data: null }))
          : Promise.resolve({ key: 'attempts', data: null }),

          // Prefetch user pro-categories (requires auth)
          authToken ? queryClient.fetchQuery({
            queryKey: ['/api/user/pro-categories'],
            queryFn: async () => {
              const response = await fetch('/api/user/pro-categories', {
                credentials: 'include',
                headers: {
                  'Authorization': `Bearer ${authToken}`,
                },
              });
              if (!response.ok) throw new Error('Failed to fetch user categories');
              return response.json();
            },
            staleTime: 30 * 60 * 1000, // Cache for 30 mins since categories rarely change
          }).then(data => ({ key: 'userCategories', data })).catch(() => ({ key: 'userCategories', data: null }))
          : Promise.resolve({ key: 'userCategories', data: null }),
          
          // Prefetch categories list (public, no auth needed)
          queryClient.fetchQuery({
            queryKey: ['/api/categories'],
            queryFn: async () => {
              const response = await fetch('/api/categories', {
                credentials: 'include',
              });
              if (!response.ok) throw new Error('Failed to fetch categories list');
              return response.json();
            },
            staleTime: 60 * 60 * 1000, // Cache for 60 mins since categories list rarely changes
          }).then(data => ({ key: 'categoriesList', data })).catch(() => ({ key: 'categoriesList', data: null })),

          // Prefetch subscription data (includes autoRenew state) - uses shared auth token
          authToken ? queryClient.fetchQuery({
            queryKey: ['/api/subscription', user.id],
            queryFn: async () => {
              const response = await fetch('/api/subscription', {
                credentials: 'include',
                headers: {
                  'Authorization': `Bearer ${authToken}`,
                },
              });
              if (!response.ok) throw new Error('Failed to fetch subscription');
              return response.json();
            },
            staleTime: 5 * 60 * 1000,
          }).then(data => ({ key: 'subscription', data })).catch(() => ({ key: 'subscription', data: null }))
          : Promise.resolve({ key: 'subscription', data: null }),

          // Prefetch puzzles (requires auth for user's region)
          authToken ? queryClient.fetchQuery({
            queryKey: ['/api/puzzles'],
            queryFn: async () => {
              const response = await fetch('/api/puzzles', {
                credentials: 'include',
                headers: {
                  'Authorization': `Bearer ${authToken}`,
                },
              });
              if (!response.ok) throw new Error('Failed to fetch puzzles');
              return response.json();
            },
            staleTime: 10 * 60 * 1000,
          }).then(data => ({ key: 'puzzles', data })).catch(() => ({ key: 'puzzles', data: null }))
          : Promise.resolve({ key: 'puzzles', data: null }),
          
          // Preload badge images
          (async () => {
            try {
              const response = await fetch('/api/badges', {
                credentials: 'include',
              });
              if (!response.ok) throw new Error('Failed to fetch badges');
              const badges = await response.json();
              
              // Preload all badge images
              const badgeImagePromises = badges.map((badge: any) => {
                return new Promise((resolve) => {
                  if (!badge.iconUrl) {
                    resolve(null);
                    return;
                  }
                  const img = new Image();
                  img.onload = resolve;
                  img.onerror = resolve; // Don't fail on image load errors
                  img.src = badge.iconUrl;
                });
              });
              
              await Promise.allSettled(badgeImagePromises);
              console.log('[PreloadProvider] Preloaded', badges.length, 'badge images');
              return { key: 'badgeImages', data: null };
            } catch {
              return { key: 'badgeImages', data: null };
            }
          })(),
          
          // Check for pending percentile badges (REGION mode) - silent check on app load
          authToken ? (async () => {
            try {
              const response = await fetch('/api/badges/check-percentile', {
                method: 'POST',
                credentials: 'include',
                headers: {
                  'Authorization': `Bearer ${authToken}`,
                  'Content-Type': 'application/json',
                },
              });
              if (response.ok) {
                const data = await response.json();
                if (data.awarded && data.badge) {
                  console.log('[PreloadProvider] Awarded percentile badge (REGION):', data.badge);
                }
              }
              return { key: 'regionBadgeCheck', data: null };
            } catch {
              return { key: 'regionBadgeCheck', data: null };
            }
          })() : Promise.resolve({ key: 'regionBadgeCheck', data: null }),
          
          // Check for pending percentile badges (USER mode) - silent check on app load
          authToken ? (async () => {
            try {
              const response = await fetch('/api/user/badges/check-percentile', {
                method: 'POST',
                credentials: 'include',
                headers: {
                  'Authorization': `Bearer ${authToken}`,
                  'Content-Type': 'application/json',
                },
              });
              if (response.ok) {
                const data = await response.json();
                if (data.awarded && data.badge) {
                  console.log('[PreloadProvider] Awarded percentile badge (USER):', data.badge);
                }
              }
              return { key: 'userBadgeCheck', data: null };
            } catch {
              return { key: 'userBadgeCheck', data: null };
            }
          })() : Promise.resolve({ key: 'userBadgeCheck', data: null }),
        ];

        // Execute all prefetch tasks in parallel
        const results = await Promise.allSettled(prefetchTasks);

        // Process results and update caches independently
        const dataMap: Record<string, any> = {};
        results.forEach((result) => {
          if (result.status === 'fulfilled' && result.value.data) {
            dataMap[result.value.key] = result.value.data;
          }
        });

        // Cache each piece of data if available
        if (dataMap.settings) {
          writeLocal(CACHE_KEYS.SETTINGS, dataMap.settings);
        }

        if (dataMap.profile) {
          writeLocal(CACHE_KEYS.PROFILE, dataMap.profile);
          console.log('[PreloadProvider] Cached profile with isAdmin:', dataMap.profile.isAdmin, 'region:', dataMap.profile.region);
        }

        if (dataMap.stats) {
          writeLocal(CACHE_KEYS.STATS, dataMap.stats);
        }

        if (dataMap.attempts) {
          writeLocal(CACHE_KEYS.ATTEMPTS, dataMap.attempts);
        }

        if (dataMap.userCategories?.categoryIds && Array.isArray(dataMap.userCategories.categoryIds)) {
          writeLocal(CACHE_KEYS.PRO_CATEGORIES, dataMap.userCategories.categoryIds);
          console.log('[PreloadProvider] Cached user pro-categories:', dataMap.userCategories.categoryIds);
        }
        
        if (dataMap.categoriesList && Array.isArray(dataMap.categoriesList)) {
          writeLocal(CACHE_KEYS.CATEGORIES_LIST, dataMap.categoriesList);
          console.log('[PreloadProvider] Cached categories list:', dataMap.categoriesList.length);
        }

        if (dataMap.subscription) {
          writeLocal(CACHE_KEYS.SUBSCRIPTION, dataMap.subscription);
          console.log('[PreloadProvider] Cached subscription with autoRenew:', dataMap.subscription.autoRenew);
        }

        if (dataMap.regions && Array.isArray(dataMap.regions)) {
          writeLocal(CACHE_KEYS.REGIONS, dataMap.regions);
          console.log('[PreloadProvider] Cached regions:', dataMap.regions.length);
        }

        // Cache current month's archive if we have puzzles
        if (dataMap.puzzles && Array.isArray(dataMap.puzzles)) {
          const now = new Date();
          const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
          
          const currentMonthPuzzles = dataMap.puzzles.filter((puzzle: any) => {
            const puzzleDate = new Date(puzzle.date);
            const puzzleMonth = `${puzzleDate.getFullYear()}-${String(puzzleDate.getMonth() + 1).padStart(2, '0')}`;
            return puzzleMonth === currentMonth;
          });
          
          writeLocal(`${CACHE_KEYS.ARCHIVE_PREFIX}${currentMonth}`, currentMonthPuzzles);
        }
      }

      setIsPreloaded(true);
    };

    preloadAssets();
  }, [isAuthenticated, user]);

  return (
    <PreloadContext.Provider value={{ isPreloaded }}>
      {children}
    </PreloadContext.Provider>
  );
}
