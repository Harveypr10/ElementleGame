import { createContext, useContext, useEffect, ReactNode } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useUserSettings } from '@/hooks/useUserSettings';
import { readLocal, writeLocal, CACHE_KEYS } from '@/lib/localCache';
import { soundManager } from '@/lib/sounds';

interface SettingsContextValue {
  // Context value can be extended in the future if needed
}

const SettingsContext = createContext<SettingsContextValue>({});

export function useSettings() {
  return useContext(SettingsContext);
}

interface SettingsProviderProps {
  children: ReactNode;
}

interface CachedSettings {
  textSize?: 'small' | 'medium' | 'large';
  soundsEnabled?: boolean;
  darkMode?: boolean;
  cluesEnabled?: boolean;
}

function applySettingsToDOM(settings: CachedSettings) {
  // Apply text size
  const textSize = settings.textSize || 'medium';
  document.documentElement.style.setProperty(
    '--text-scale',
    textSize === 'small' ? '0.875' : textSize === 'large' ? '1.125' : '1'
  );

  // Apply dark mode
  const darkMode = settings.darkMode ?? false;
  document.documentElement.classList.toggle('dark', darkMode);

  // Apply sound setting (default to OFF for new users)
  const soundsEnabled = settings.soundsEnabled ?? false;
  soundManager.setEnabled(soundsEnabled);
}

export function SettingsProvider({ children }: SettingsProviderProps) {
  const { isAuthenticated } = useAuth();
  const { settings } = useUserSettings();

  // Load and apply settings from cache immediately on mount (instant, no flicker)
  useEffect(() => {
    const cachedSettings = readLocal<CachedSettings>(CACHE_KEYS.SETTINGS);
    
    if (cachedSettings) {
      console.log('[SettingsProvider] Applying cached settings:', cachedSettings);
      applySettingsToDOM(cachedSettings);
    } else if (!isAuthenticated) {
      // For guest users, load from localStorage
      const guestSettings: CachedSettings = {
        textSize: (localStorage.getItem('textSize') as 'small' | 'medium' | 'large') || 'medium',
        soundsEnabled: localStorage.getItem('soundsEnabled') !== null 
          ? localStorage.getItem('soundsEnabled') === 'true' 
          : false,
        darkMode: localStorage.getItem('theme') === 'dark',
        cluesEnabled: localStorage.getItem('cluesEnabled') !== null
          ? localStorage.getItem('cluesEnabled') === 'true'
          : true,
      };
      console.log('[SettingsProvider] Applying guest settings from localStorage:', guestSettings);
      applySettingsToDOM(guestSettings);
    }
  }, []); // Run once on mount

  // Background reconciliation: Apply fresh settings from Supabase when they arrive
  useEffect(() => {
    if (isAuthenticated && settings) {
      console.log('[SettingsProvider] Applying fresh Supabase settings:', settings);
      
      const freshSettings: CachedSettings = {
        textSize: (settings.textSize as 'small' | 'medium' | 'large') || 'medium',
        soundsEnabled: settings.soundsEnabled ?? false,
        darkMode: settings.darkMode ?? false,
        cluesEnabled: settings.cluesEnabled ?? true,
      };
      
      applySettingsToDOM(freshSettings);
      
      // Update cache with fresh data
      writeLocal(CACHE_KEYS.SETTINGS, freshSettings);
    }
  }, [isAuthenticated, settings]);

  return (
    <SettingsContext.Provider value={{}}>
      {children}
    </SettingsContext.Provider>
  );
}
