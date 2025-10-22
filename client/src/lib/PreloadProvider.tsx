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

      // Prefetch data if authenticated
      if (isAuthenticated && user) {
        try {
          // Prefetch settings
          const settings = await queryClient.fetchQuery({
            queryKey: ['/api/settings'],
            queryFn: async () => {
              const response = await fetch('/api/settings', {
                credentials: 'include',
              });
              if (!response.ok) throw new Error('Failed to fetch settings');
              return response.json();
            },
            staleTime: 5 * 60 * 1000, // 5 minutes
          });
          writeLocal(CACHE_KEYS.SETTINGS, settings);

          // Prefetch profile
          const profile = await queryClient.fetchQuery({
            queryKey: ['/api/auth/profile'],
            queryFn: async () => {
              const response = await fetch('/api/auth/profile', {
                credentials: 'include',
              });
              if (!response.ok) throw new Error('Failed to fetch profile');
              return response.json();
            },
            staleTime: 5 * 60 * 1000,
          });
          writeLocal(CACHE_KEYS.PROFILE, profile);

          // Prefetch stats
          const stats = await queryClient.fetchQuery({
            queryKey: ['/api/stats'],
            queryFn: async () => {
              const response = await fetch('/api/stats', {
                credentials: 'include',
              });
              if (!response.ok) throw new Error('Failed to fetch stats');
              return response.json();
            },
            staleTime: 5 * 60 * 1000,
          });
          writeLocal(CACHE_KEYS.STATS, stats);

          // Prefetch game attempts
          const attempts = await queryClient.fetchQuery({
            queryKey: ['/api/game-attempts/user'],
            queryFn: async () => {
              const response = await fetch('/api/game-attempts/user', {
                credentials: 'include',
              });
              if (!response.ok) throw new Error('Failed to fetch attempts');
              return response.json();
            },
            staleTime: 5 * 60 * 1000,
          });
          writeLocal(CACHE_KEYS.ATTEMPTS, attempts);

          // Prefetch current month's archive data
          const now = new Date();
          const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
          
          const puzzles = await queryClient.fetchQuery({
            queryKey: ['/api/puzzles'],
            queryFn: async () => {
              const response = await fetch('/api/puzzles', {
                credentials: 'include',
              });
              if (!response.ok) throw new Error('Failed to fetch puzzles');
              return response.json();
            },
            staleTime: 10 * 60 * 1000, // 10 minutes for puzzles
          });
          
          // Filter current month's puzzles
          const currentMonthPuzzles = puzzles.filter((puzzle: any) => {
            const puzzleDate = new Date(puzzle.date);
            const puzzleMonth = `${puzzleDate.getFullYear()}-${String(puzzleDate.getMonth() + 1).padStart(2, '0')}`;
            return puzzleMonth === currentMonth;
          });
          
          writeLocal(`${CACHE_KEYS.ARCHIVE_PREFIX}${currentMonth}`, currentMonthPuzzles);
        } catch (error) {
          console.error('Error prefetching data:', error);
          // Don't block the app if prefetch fails
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
