import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { writeLocal, CACHE_KEYS } from '@/lib/localCache';

// Import images to preload
import historianHamsterBlue from '@assets/Historian-Hamster-Blue.svg';
import librarianHamsterYellow from '@assets/Librarian-Hamster-Yellow.svg';
import mathsHamsterGreen from '@assets/Maths-Hamster-Green.svg';
import mechanicHamsterGrey from '@assets/Mechanic-Hamster-Grey.svg';
import whiteTickBlue from '@assets/White-Tick-Blue.svg';
import whiteCrossBlue from '@assets/White-Cross-Blue.svg';

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

          // Prefetch profile
          queryClient.fetchQuery({
            queryKey: ['/api/auth/profile'],
            queryFn: async () => {
              const response = await fetch('/api/auth/profile', {
                credentials: 'include',
              });
              if (!response.ok) throw new Error('Failed to fetch profile');
              return response.json();
            },
            staleTime: 5 * 60 * 1000,
          }).then(data => ({ key: 'profile', data })).catch(() => ({ key: 'profile', data: null })),

          // Prefetch stats
          queryClient.fetchQuery({
            queryKey: ['/api/stats'],
            queryFn: async () => {
              const response = await fetch('/api/stats', {
                credentials: 'include',
              });
              if (!response.ok) throw new Error('Failed to fetch stats');
              return response.json();
            },
            staleTime: 5 * 60 * 1000,
          }).then(data => ({ key: 'stats', data })).catch(() => ({ key: 'stats', data: null })),

          // Prefetch game attempts
          queryClient.fetchQuery({
            queryKey: ['/api/game-attempts/user'],
            queryFn: async () => {
              const response = await fetch('/api/game-attempts/user', {
                credentials: 'include',
              });
              if (!response.ok) throw new Error('Failed to fetch attempts');
              return response.json();
            },
            staleTime: 5 * 60 * 1000,
          }).then(data => ({ key: 'attempts', data })).catch(() => ({ key: 'attempts', data: null })),

          // Prefetch puzzles (public data)
          queryClient.fetchQuery({
            queryKey: ['/api/puzzles'],
            queryFn: async () => {
              const response = await fetch('/api/puzzles', {
                credentials: 'include',
              });
              if (!response.ok) throw new Error('Failed to fetch puzzles');
              return response.json();
            },
            staleTime: 10 * 60 * 1000,
          }).then(data => ({ key: 'puzzles', data })).catch(() => ({ key: 'puzzles', data: null })),
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

        if (dataMap.profile?.user) {
          writeLocal(CACHE_KEYS.PROFILE, dataMap.profile.user);
        }

        if (dataMap.stats) {
          writeLocal(CACHE_KEYS.STATS, dataMap.stats);
        }

        if (dataMap.attempts) {
          writeLocal(CACHE_KEYS.ATTEMPTS, dataMap.attempts);
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
