import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';
import { useAuth } from './auth';
import { Appearance, ColorSchemeName } from 'react-native';

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
    loading: true,
});

export function OptionsProvider({ children }: { children: React.ReactNode }) {
    const { user } = useAuth();

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
        console.log('[Options] Applying dark mode:', { darkMode, scheme: darkMode ? 'dark' : 'light' });
        // Use React Native's Appearance API to set color scheme
        const colorScheme: ColorSchemeName = darkMode ? 'dark' : 'light';
        Appearance.setColorScheme(colorScheme);
    }, [darkMode]);

    // Initial Load
    useEffect(() => {
        loadOptions();
    }, [user]);

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

            // 2. If User, Sync from Supabase 'user_settings'
            if (user) {
                const { data, error } = await supabase
                    .from('user_settings')
                    .select('*')
                    .eq('user_id', user.id)
                    .single();

                if (data) {
                    // Apply DB settings (override AsyncStorage)
                    if (data.date_format_length) setDateLengthState(data.date_format_length);
                    if (data.date_format_order) setDateFormatOrderState(data.date_format_order);
                    if (data.text_size) setTextSizeState(data.text_size);
                    if (data.sounds_enabled !== undefined) setSoundsEnabled(data.sounds_enabled);
                    if (data.dark_mode !== undefined) setDarkModeState(data.dark_mode);
                    if (data.clues_enabled !== undefined) setCluesEnabled(data.clues_enabled);
                    if (data.streak_saver_active !== undefined) setStreakSaverActive(data.streak_saver_active);
                    if (data.holiday_saver_active !== undefined) setHolidaySaverActive(data.holiday_saver_active);
                }
            }
        } catch (e) {
            console.error("Failed to load options", e);
        } finally {
            setLoading(false);
            console.log('[Options] Loaded:', {
                textSize,
                soundsEnabled,
                darkMode,
                cluesEnabled,
                dateLength,
                dateFormatOrder
            });
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
        console.log('[Options] toggleDarkMode called:', { old: darkMode, new: newValue });
        setDarkModeState(newValue);
        // The useEffect above will handle applying the Appearance change
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
                .update({ date_format_length: length })
                .eq('user_id', user.id)
                .then(({ error }) => { if (error) console.log('[Options] Error updating date length:', error) });
        }
    };

    const setDateFormatOrder = (order: DateFormatOrder) => {
        setDateFormatOrderState(order);
        persist('opt_date_order', order);
        if (user) {
            supabase.from('user_settings')
                .update({ date_format_order: order })
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
            loading
        }}>
            {children}
        </OptionsContext.Provider>
    );
}

export const useOptions = () => useContext(OptionsContext);
