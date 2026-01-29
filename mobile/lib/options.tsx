import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';
import { useAuth } from './auth';
import { useColorScheme } from 'nativewind';
import soundManager from './soundManager';
import { getTextScale } from './textScaling';

export type DateFormatOrder = 'ddmmyy' | 'mmddyy';
export type DateLength = 6 | 8;
export type GameMode = 'REGION' | 'USER';
export type TextSize = 'small' | 'medium' | 'large';

// Expanded Settings Type
type OptionsContextType = {
    // Preferences
    textSize: TextSize;
    setTextSize: (size: TextSize) => void;

    soundsEnabled: boolean;
    toggleSounds: () => void;

    darkMode: boolean;
    toggleDarkMode: () => void;

    cluesEnabled: boolean;
    toggleClues: () => void;

    // Date Settings
    dateLength: DateLength;
    setDateLength: (length: DateLength) => void;

    dateFormatOrder: DateFormatOrder;
    setDateFormatOrder: (order: DateFormatOrder) => void;

    // Game Mode (Global/Region vs User/Endless)
    gameMode: GameMode;
    setGameMode: (mode: GameMode) => void;

    // Streak Protection
    streakSaverActive: boolean;
    toggleStreakSaver: () => void;

    holidaySaverActive: boolean;
    toggleHolidaySaver: () => void;

    // Computed from textSize
    textScale: number;

    loading: boolean;
};

const OptionsContext = createContext<OptionsContextType>({
    textSize: 'medium',
    setTextSize: () => { },
    soundsEnabled: false,
    toggleSounds: () => { },
    darkMode: false,
    toggleDarkMode: () => { },
    cluesEnabled: true,
    toggleClues: () => { },
    dateLength: 8,
    setDateLength: () => { },
    dateFormatOrder: 'ddmmyy',
    setDateFormatOrder: () => { },
    gameMode: 'REGION',
    setGameMode: () => { },
    streakSaverActive: true,
    toggleStreakSaver: () => { },
    holidaySaverActive: true,
    toggleHolidaySaver: () => { },
    textScale: 1.0,
    loading: true,
});

export function OptionsProvider({ children }: { children: React.ReactNode }) {
    const { user } = useAuth();
    const { setColorScheme } = useColorScheme();

    // Default States
    const [textSize, setTextSizeState] = useState<TextSize>('medium');
    const [soundsEnabled, setSoundsEnabled] = useState(false);
    const [darkMode, setDarkModeState] = useState(false);
    const [cluesEnabled, setCluesEnabled] = useState(true);
    const [dateLength, setDateLengthState] = useState<DateLength>(8);
    const [dateFormatOrder, setDateFormatOrderState] = useState<DateFormatOrder>('ddmmyy');
    const [streakSaverActive, setStreakSaverActive] = useState(true);
    const [holidaySaverActive, setHolidaySaverActive] = useState(true);

    // App State (Local Only usually)
    const [gameMode, setGameMode] = useState<GameMode>('REGION');
    const [loading, setLoading] = useState(true);

    // Apply dark mode when it changes
    useEffect(() => {
        const scheme = darkMode ? 'dark' : 'light';
        console.log('[Options] Applying dark mode:', { darkMode, scheme });
        setColorScheme(scheme);
    }, [darkMode, setColorScheme]);

    // Sync sound settings with SoundManager
    useEffect(() => {
        soundManager.setEnabled(soundsEnabled);
        console.log('[Options] Sound manager synced:', soundsEnabled);
    }, [soundsEnabled]);

    // Track if we've loaded initially to prevent re-loading on every change
    const hasLoadedRef = useRef(false);

    // Initial Load - only run ONCE when component mounts
    useEffect(() => {
        if (!hasLoadedRef.current) {
            console.log('[Options] Running initial loadOptions');
            loadOptions();
            // Initialize sound manager
            soundManager.initialize().catch(err => {
                console.error('[Options] Failed to initialize sound manager:', err);
            });
            hasLoadedRef.current = true;
        }
    }, []); // Empty deps = run once on mount

    // Sync with Supabase when User becomes available
    useEffect(() => {
        if (user) {
            console.log('[Options] User available, syncing settings...');
            syncWithSupabase();
        }
    }, [user]);

    const syncWithSupabase = async () => {
        if (!user) return;
        try {
            const { data, error } = await supabase
                .from('user_settings')
                .select('*')
                .eq('user_id', user.id)
                .single();

            if (data) {
                console.log('[Options] Synced settings from Supabase:', data);
                // Apply DB settings (override AsyncStorage)
                if (data.digit_preference) {
                    setDateLengthState(parseInt(data.digit_preference) as DateLength);
                    AsyncStorage.setItem('opt_date_length', data.digit_preference);
                }
                if (data.date_format_preference) {
                    setDateFormatOrderState(data.date_format_preference as DateFormatOrder);
                    AsyncStorage.setItem('opt_date_order', data.date_format_preference);
                }
                if (data.text_size) {
                    setTextSizeState(data.text_size as TextSize);
                    AsyncStorage.setItem('opt_text_size', data.text_size);
                }
                if (data.sounds_enabled !== undefined && data.sounds_enabled !== null) {
                    setSoundsEnabled(data.sounds_enabled);
                    AsyncStorage.setItem('opt_sounds_enabled', String(data.sounds_enabled));
                }
                if (data.dark_mode !== undefined && data.dark_mode !== null) {
                    setDarkModeState(data.dark_mode);
                    AsyncStorage.setItem('opt_dark_mode', String(data.dark_mode));
                    // Force immediate apply
                    setColorScheme(data.dark_mode ? 'dark' : 'light');
                }
                if (data.clues_enabled !== undefined && data.clues_enabled !== null) {
                    setCluesEnabled(data.clues_enabled);
                    AsyncStorage.setItem('opt_clues_enabled', String(data.clues_enabled));
                }
                if (data.streak_saver_active !== undefined) {
                    setStreakSaverActive(data.streak_saver_active);
                    AsyncStorage.setItem('opt_streak_saver_active', String(data.streak_saver_active));
                }
                if (data.holiday_saver_active !== undefined) {
                    setHolidaySaverActive(data.holiday_saver_active);
                    AsyncStorage.setItem('opt_holiday_saver_active', String(data.holiday_saver_active));
                }
            }
        } catch (e) {
            console.error('[Options] Failed to sync with Supabase:', e);
        }
    };

    const loadOptions = async () => {
        try {
            // 1. Load from AsyncStorage first (fast)
            const storedDateLength = await AsyncStorage.getItem('opt_date_length');
            if (storedDateLength) setDateLengthState(parseInt(storedDateLength) as DateLength);

            const storedDateOrder = await AsyncStorage.getItem('opt_date_order');
            if (storedDateOrder) setDateFormatOrderState(storedDateOrder as DateFormatOrder);

            const storedMode = await AsyncStorage.getItem('app_game_mode');
            if (storedMode) setGameMode(storedMode as GameMode);

            const storedTextSize = await AsyncStorage.getItem('opt_text_size');
            if (storedTextSize) setTextSizeState(storedTextSize as TextSize);

            const storedSounds = await AsyncStorage.getItem('opt_sounds_enabled');
            if (storedSounds !== null) setSoundsEnabled(storedSounds === 'true');

            const storedDarkMode = await AsyncStorage.getItem('opt_dark_mode');
            if (storedDarkMode !== null) setDarkModeState(storedDarkMode === 'true');

            const storedClues = await AsyncStorage.getItem('opt_clues_enabled');
            if (storedClues !== null) setCluesEnabled(storedClues === 'true');

            const storedStreakSaver = await AsyncStorage.getItem('opt_streak_saver_active');
            if (storedStreakSaver !== null) setStreakSaverActive(storedStreakSaver === 'true');

            const storedHolidaySaver = await AsyncStorage.getItem('opt_holiday_saver_active');
            if (storedHolidaySaver !== null) setHolidaySaverActive(storedHolidaySaver === 'true');

            // NOTE: Logic moved to separate useEffect
            // Trigger sync if user is already present (rare case on pure mount)
            if (user) {
                syncWithSupabase();
            }

        } catch (e) {
            console.error("Failed to load options", e);
        } finally {
            setLoading(false);
            console.log('[Options] Loaded local options');
        }
    };

    // Helper to persist
    const persist = async (key: string, value: string) => {
        await AsyncStorage.setItem(key, value);
        // Sync to Supabase if logged in
        if (user) {
            // Mapping keys to DB columns needs to be precise
            // Let's assume table exists. If not, this might fail silently or error.
            // We'll implemented "optimistic" updates in the setters.
        }
    };

    // Setters
    const setTextSize = async (size: TextSize) => {
        console.log('[Options] setTextSize called:', size);
        setTextSizeState(size);
        await AsyncStorage.setItem('opt_text_size', size);
        if (user) {
            supabase.from('user_settings')
                .update({ text_size: size })
                .eq('user_id', user.id)
                .then(({ error }) => { if (error) console.log('[Options] Error updating text_size:', error) });
        }
    };

    const toggleSounds = async () => {
        const newValue = !soundsEnabled;
        console.log('[Options] toggleSounds called:', { old: soundsEnabled, new: newValue });
        setSoundsEnabled(newValue);
        await AsyncStorage.setItem('opt_sounds_enabled', newValue.toString());
        if (user) {
            supabase.from('user_settings')
                .update({ sounds_enabled: newValue })
                .eq('user_id', user.id)
                .then(({ error }) => { if (error) console.log('[Options] Error updating sounds:', error) });
        }
    };

    const toggleDarkMode = async () => {
        const newValue = !darkMode;
        const newScheme = newValue ? 'dark' : 'light';
        console.log('[Options] toggleDarkMode called (Instant Apply):', { old: darkMode, new: newValue });

        // IMMEDIATE ACTION: Apply theme before React state updates trigger re-renders
        setColorScheme(newScheme);

        setDarkModeState(newValue);
        // The useEffect above will handle ensuring sync, but this makes it feel instant
        await AsyncStorage.setItem('opt_dark_mode', newValue.toString());
        if (user) {
            supabase.from('user_settings')
                .update({ dark_mode: newValue })
                .eq('user_id', user.id)
                .then(({ error }) => { if (error) console.log('[Options] Error updating dark mode:', error) });
        }
    };

    const toggleClues = async () => {
        const newValue = !cluesEnabled;
        setCluesEnabled(newValue);
        await AsyncStorage.setItem('opt_clues_enabled', newValue.toString());
        if (user) {
            supabase.from('user_settings')
                .update({ clues_enabled: newValue })
                .eq('user_id', user.id)
                .then(({ error }) => { if (error) console.log('[Options] Error updating clues:', error) });
        }
    };

    const setDateLength = (length: DateLength) => {
        setDateLengthState(length);
        persist('opt_date_length', length.toString());
        if (user) {
            supabase.from('user_settings')
                .update({ digit_preference: length.toString() })
                .eq('user_id', user.id)
                .then(({ error }) => { if (error) console.log('[Options] Error updating date length:', error) });
        }
    };

    const setDateFormatOrder = (order: DateFormatOrder) => {
        setDateFormatOrderState(order);
        persist('opt_date_order', order);
        if (user) {
            supabase.from('user_settings')
                .update({ date_format_preference: order })
                .eq('user_id', user.id)
                .then(({ error }) => { if (error) console.log('[Options] Error updating date order:', error) });
        }
    };

    const toggleStreakSaver = async () => {
        const newValue = !streakSaverActive;
        setStreakSaverActive(newValue);
        await AsyncStorage.setItem('opt_streak_saver_active', newValue.toString());
        if (user) {
            supabase.from('user_settings')
                .update({ streak_saver_active: newValue })
                .eq('user_id', user.id)
                .then(({ error }) => { if (error) console.log('[Options] Error updating streak saver:', error) });
        }
    };

    const toggleHolidaySaver = async () => {
        const newValue = !holidaySaverActive;
        setHolidaySaverActive(newValue);
        await AsyncStorage.setItem('opt_holiday_saver_active', newValue.toString());
        if (user) {
            supabase.from('user_settings')
                .update({ holiday_saver_active: newValue })
                .eq('user_id', user.id)
                .then(({ error }) => { if (error) console.log('[Options] Error updating holiday saver:', error) });
        }
    };

    return (
        <OptionsContext.Provider value={{
            textSize, setTextSize,
            soundsEnabled, toggleSounds,
            darkMode, toggleDarkMode,
            cluesEnabled, toggleClues,
            dateLength, setDateLength,
            dateFormatOrder, setDateFormatOrder,
            gameMode, setGameMode,
            streakSaverActive, toggleStreakSaver,
            holidaySaverActive, toggleHolidaySaver,
            textScale: getTextScale(textSize),
            loading
        }}>
            {children}
        </OptionsContext.Provider>
    );
}

export const useOptions = () => useContext(OptionsContext);
