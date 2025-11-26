import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { queryClient } from '@/lib/queryClient';
import { writeLocal, CACHE_KEYS, CachedProfile } from '@/lib/localCache';
import { getSupabaseClient } from '@/lib/supabaseClient';
import { setCachedRegion, setCachedDigitPreference, setCachedUseRegionDefault, setCachedDateFormatPreference } from '@/lib/formatCache';

import historianHamsterBlue from '@assets/Historian-Hamster-Blue.svg';
import historianHamsterLocal from '@assets/Historian-Hamster-Local.svg';
import librarianHamsterYellow from '@assets/Librarian-Hamster-Yellow.svg';
import librarianHamsterLocal from '@assets/Librarian-Hamster-Local.svg';
import mathsHamsterGreen from '@assets/Maths-Hamster-Green.svg';
import mathsHamsterLocal from '@assets/Maths-Hamster-Local.svg';
import mechanicHamsterGrey from '@assets/Mechanic-Hamster-Grey.svg';
import winHamsterBlue from '@assets/Win-Hamster-Blue.svg';
import winHamsterLocal from '@assets/Win-Hamster-Local.svg';
import lostHamsterBlue from '@assets/Lost-Hamster-Blue.svg';
import lostHamsterLocal from '@assets/Lost-Hamster-Local.svg';
import questionHamsterBlue from '@assets/Question-Hamster-Blue.svg';
import questionHamsterGrey from '@assets/Question-Hamster-Grey.svg';
import greyHelpIcon from '@assets/Grey-Help-Grey_1760979822771.png';
import greyCogIcon from '@assets/Grey-Cog-Grey_1760979822772.png';
import whiteHelpIcon from '@assets/White-Help-DarkMode.svg';
import whiteCogIcon from '@assets/White-Cog-DarkMode.svg';

const ALL_IMAGES = [
  historianHamsterBlue,
  historianHamsterLocal,
  librarianHamsterYellow,
  librarianHamsterLocal,
  mathsHamsterGreen,
  mathsHamsterLocal,
  mechanicHamsterGrey,
  winHamsterBlue,
  winHamsterLocal,
  lostHamsterBlue,
  lostHamsterLocal,
  questionHamsterBlue,
  questionHamsterGrey,
  greyHelpIcon,
  greyCogIcon,
  whiteHelpIcon,
  whiteCogIcon,
];

interface PreloadContextValue {
  isPreloaded: boolean;
  isDataReady: boolean;
  imagesReady: boolean;
  refreshUserData: () => Promise<void>;
  cachedFirstName: string | null;
  cachedRegion: string | null;
}

const PreloadContext = createContext<PreloadContextValue>({
  isPreloaded: false,
  isDataReady: false,
  imagesReady: false,
  refreshUserData: async () => {},
  cachedFirstName: null,
  cachedRegion: null,
});

export function usePreload() {
  return useContext(PreloadContext);
}

interface PreloadProviderProps {
  children: ReactNode;
}

async function fetchWithAuth(endpoint: string): Promise<any> {
  const supabase = await getSupabaseClient();
  const { data: { session } } = await supabase.auth.getSession();
  
  const headers: HeadersInit = {};
  if (session?.access_token) {
    headers['Authorization'] = `Bearer ${session.access_token}`;
  }

  const response = await fetch(endpoint, {
    credentials: 'include',
    headers,
  });

  if (!response.ok) throw new Error(`Failed to fetch ${endpoint}`);
  return response.json();
}

export function PreloadProvider({ children }: PreloadProviderProps) {
  const [isPreloaded, setIsPreloaded] = useState(false);
  const [isDataReady, setIsDataReady] = useState(false);
  const [imagesReady, setImagesReady] = useState(false);
  const [cachedFirstName, setCachedFirstName] = useState<string | null>(null);
  const [cachedRegion, setCachedRegion_State] = useState<string | null>(null);
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();

  const preloadImages = useCallback(async () => {
    const imagePromises = ALL_IMAGES.map(src => {
      return new Promise<void>((resolve) => {
        const img = new Image();
        img.onload = () => resolve();
        img.onerror = () => resolve();
        img.src = src;
      });
    });

    await Promise.all(imagePromises);
    setImagesReady(true);
  }, []);

  const prefetchUserData = useCallback(async () => {
    if (!isAuthenticated || !user) {
      setIsDataReady(true);
      return;
    }

    try {
      const prefetchTasks = [
        fetchWithAuth('/api/settings')
          .then(data => ({ key: 'settings', data }))
          .catch(() => ({ key: 'settings', data: null })),

        fetchWithAuth('/api/auth/profile')
          .then(data => ({ key: 'profile', data }))
          .catch(() => ({ key: 'profile', data: null })),

        fetchWithAuth('/api/stats')
          .then(data => ({ key: 'stats', data }))
          .catch(() => ({ key: 'stats', data: null })),

        fetchWithAuth('/api/game-attempts/user')
          .then(data => ({ key: 'attempts', data }))
          .catch(() => ({ key: 'attempts', data: null })),

        fetchWithAuth('/api/puzzles')
          .then(data => ({ key: 'puzzles', data }))
          .catch(() => ({ key: 'puzzles', data: null })),

        fetchWithAuth('/api/subscription')
          .then(data => ({ key: 'subscription', data }))
          .catch(() => ({ key: 'subscription', data: null })),

        fetchWithAuth('/api/user/pro-categories')
          .then(data => ({ key: 'categories', data }))
          .catch(() => ({ key: 'categories', data: null })),
      ];

      const results = await Promise.allSettled(prefetchTasks);

      const dataMap: Record<string, any> = {};
      results.forEach((result) => {
        if (result.status === 'fulfilled' && result.value?.data) {
          dataMap[result.value.key] = result.value.data;
        }
      });

      if (dataMap.settings) {
        writeLocal(CACHE_KEYS.SETTINGS, dataMap.settings);
        queryClient.setQueryData(['/api/settings'], dataMap.settings);
        
        if (dataMap.settings.digitPreference) {
          setCachedDigitPreference(dataMap.settings.digitPreference);
        }
        if (dataMap.settings.useRegionDefault !== undefined) {
          setCachedUseRegionDefault(dataMap.settings.useRegionDefault);
        }
        if (dataMap.settings.dateFormatPreference) {
          setCachedDateFormatPreference(dataMap.settings.dateFormatPreference);
        }
      }

      if (dataMap.profile?.user) {
        const profileData = dataMap.profile.user as CachedProfile;
        writeLocal(CACHE_KEYS.PROFILE, profileData);
        queryClient.setQueryData(['/api/auth/profile'], dataMap.profile);
        
        if (profileData.firstName) {
          const displayName = profileData.firstName.length >= 12 ? null : profileData.firstName;
          writeLocal(CACHE_KEYS.FIRST_NAME, displayName);
          setCachedFirstName(displayName);
        }
        
        if (profileData.region) {
          setCachedRegion(profileData.region);
          setCachedRegion_State(profileData.region);
        }
      }

      if (dataMap.stats) {
        writeLocal(CACHE_KEYS.STATS, dataMap.stats);
        queryClient.setQueryData(['/api/stats'], dataMap.stats);
      }

      if (dataMap.attempts) {
        writeLocal(CACHE_KEYS.ATTEMPTS, dataMap.attempts);
        queryClient.setQueryData(['/api/game-attempts/user'], dataMap.attempts);
      }

      if (dataMap.puzzles && Array.isArray(dataMap.puzzles)) {
        queryClient.setQueryData(['/api/puzzles'], dataMap.puzzles);
        
        const now = new Date();
        const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        
        const currentMonthPuzzles = dataMap.puzzles.filter((puzzle: any) => {
          const puzzleDate = new Date(puzzle.date);
          const puzzleMonth = `${puzzleDate.getFullYear()}-${String(puzzleDate.getMonth() + 1).padStart(2, '0')}`;
          return puzzleMonth === currentMonth;
        });
        
        writeLocal(`${CACHE_KEYS.ARCHIVE_PREFIX}${currentMonth}`, currentMonthPuzzles);
      }

      if (dataMap.subscription) {
        writeLocal(CACHE_KEYS.SUBSCRIPTION, dataMap.subscription);
        queryClient.setQueryData(['/api/subscription'], dataMap.subscription);
      }

      if (dataMap.categories?.categoryIds) {
        writeLocal(CACHE_KEYS.CATEGORY_PREFERENCES, dataMap.categories.categoryIds);
        queryClient.setQueryData(['/api/user/pro-categories'], dataMap.categories);
      }

    } catch (error) {
      console.error('[PreloadProvider] Error prefetching user data:', error);
    }

    setIsDataReady(true);
  }, [isAuthenticated, user]);

  const refreshUserData = useCallback(async () => {
    // Check Supabase session directly instead of relying on React state
    // This handles the case where auth state hasn't propagated yet after login
    const supabase = await getSupabaseClient();
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session?.user) {
      console.log('[PreloadProvider] No active session for refresh');
      return;
    }
    
    console.log('[PreloadProvider] Refreshing user data for:', session.user.id);
    setIsDataReady(false);
    
    // Force prefetch even if isAuthenticated state hasn't updated yet
    try {
      const prefetchTasks = [
        fetchWithAuth('/api/settings')
          .then(data => ({ key: 'settings', data }))
          .catch(() => ({ key: 'settings', data: null })),

        fetchWithAuth('/api/auth/profile')
          .then(data => ({ key: 'profile', data }))
          .catch(() => ({ key: 'profile', data: null })),

        fetchWithAuth('/api/stats')
          .then(data => ({ key: 'stats', data }))
          .catch(() => ({ key: 'stats', data: null })),

        fetchWithAuth('/api/game-attempts/user')
          .then(data => ({ key: 'attempts', data }))
          .catch(() => ({ key: 'attempts', data: null })),

        fetchWithAuth('/api/puzzles')
          .then(data => ({ key: 'puzzles', data }))
          .catch(() => ({ key: 'puzzles', data: null })),

        fetchWithAuth('/api/subscription')
          .then(data => ({ key: 'subscription', data }))
          .catch(() => ({ key: 'subscription', data: null })),

        fetchWithAuth('/api/user/pro-categories')
          .then(data => ({ key: 'categories', data }))
          .catch(() => ({ key: 'categories', data: null })),
      ];

      const results = await Promise.allSettled(prefetchTasks);

      const dataMap: Record<string, any> = {};
      results.forEach((result) => {
        if (result.status === 'fulfilled' && result.value?.data) {
          dataMap[result.value.key] = result.value.data;
        }
      });

      // Cache settings
      if (dataMap.settings) {
        writeLocal(CACHE_KEYS.SETTINGS, dataMap.settings);
        queryClient.setQueryData(['/api/settings'], dataMap.settings);
        
        if (dataMap.settings.digitPreference) {
          setCachedDigitPreference(dataMap.settings.digitPreference);
        }
        if (dataMap.settings.useRegionDefault !== undefined) {
          setCachedUseRegionDefault(dataMap.settings.useRegionDefault);
        }
        if (dataMap.settings.dateFormatPreference) {
          setCachedDateFormatPreference(dataMap.settings.dateFormatPreference);
        }
      }

      // Cache profile
      if (dataMap.profile?.user) {
        const profileData = dataMap.profile.user as CachedProfile;
        writeLocal(CACHE_KEYS.PROFILE, profileData);
        queryClient.setQueryData(['/api/auth/profile'], dataMap.profile);
        
        if (profileData.firstName) {
          const displayName = profileData.firstName.length >= 12 ? null : profileData.firstName;
          writeLocal(CACHE_KEYS.FIRST_NAME, displayName);
          setCachedFirstName(displayName);
        }
        
        if (profileData.region) {
          setCachedRegion(profileData.region);
          setCachedRegion_State(profileData.region);
        }
      }

      // Cache stats
      if (dataMap.stats) {
        writeLocal(CACHE_KEYS.STATS, dataMap.stats);
        queryClient.setQueryData(['/api/stats'], dataMap.stats);
      }

      // Cache attempts
      if (dataMap.attempts) {
        writeLocal(CACHE_KEYS.ATTEMPTS, dataMap.attempts);
        queryClient.setQueryData(['/api/game-attempts/user'], dataMap.attempts);
      }

      // Cache puzzles
      if (dataMap.puzzles && Array.isArray(dataMap.puzzles)) {
        queryClient.setQueryData(['/api/puzzles'], dataMap.puzzles);
      }

      // Cache subscription
      if (dataMap.subscription) {
        writeLocal(CACHE_KEYS.SUBSCRIPTION, dataMap.subscription);
        queryClient.setQueryData(['/api/subscription'], dataMap.subscription);
      }

      // Cache category preferences
      if (dataMap.categories?.categoryIds) {
        writeLocal(CACHE_KEYS.CATEGORY_PREFERENCES, dataMap.categories.categoryIds);
        queryClient.setQueryData(['/api/user/pro-categories'], dataMap.categories);
      }

      console.log('[PreloadProvider] User data refresh complete');
    } catch (error) {
      console.error('[PreloadProvider] Error refreshing user data:', error);
    }

    setIsDataReady(true);
  }, []);

  useEffect(() => {
    if (authLoading) return;

    const initializeApp = async () => {
      await Promise.all([
        preloadImages(),
        prefetchUserData(),
      ]);

      setIsPreloaded(true);
    };

    initializeApp();
  }, [authLoading, isAuthenticated, user, preloadImages, prefetchUserData]);

  useEffect(() => {
    if (!isAuthenticated) {
      setCachedFirstName(null);
      setCachedRegion_State(null);
      setIsDataReady(true);
    }
  }, [isAuthenticated]);

  return (
    <PreloadContext.Provider value={{
      isPreloaded,
      isDataReady,
      imagesReady,
      refreshUserData,
      cachedFirstName,
      cachedRegion,
    }}>
      {children}
    </PreloadContext.Provider>
  );
}
