import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { Appearance } from 'react-native';
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

    useDeviceDisplay: boolean;
    toggleUseDeviceDisplay: () => boolean;
    syncDarkModeWithDevice: () => void;

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
    streaksEnabled: boolean;
    setStreaksEnabled: (enabled: boolean) => void;

    streakSaverActive: boolean;
    toggleStreakSaver: () => void;

    holidaySaverActive: boolean;
    toggleHolidaySaver: () => void;

    // Display settings
    quickMenuEnabled: boolean;
    toggleQuickMenu: () => void;
    leagueTablesEnabled: boolean;
    toggleLeagueTables: () => void;

    // Notification Reminders (local-only, no Supabase sync)
    reminderEnabled: boolean;
    setReminderEnabled: (enabled: boolean) => void;
    reminderTime: string;
    setReminderTime: (time: string) => void;
    streakReminderEnabled: boolean;
    setStreakReminderEnabled: (enabled: boolean) => void;
    streakReminderTime: string;
    setStreakReminderTime: (time: string) => void;
    hasPromptedStreak2: boolean;
    setHasPromptedStreak2: (val: boolean) => void;
    hasPromptedStreak7: boolean;
    setHasPromptedStreak7: (val: boolean) => void;
    neverAskReminder: boolean;
    setNeverAskReminder: (val: boolean) => void;

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
    useDeviceDisplay: false,
    toggleUseDeviceDisplay: () => false,
    syncDarkModeWithDevice: () => { },
    cluesEnabled: true,
    toggleClues: () => { },

    dateLength: 8,
    setDateLength: () => { },
    dateFormatOrder: 'ddmmyy',
    setDateFormatOrder: () => { },

    gameMode: 'REGION',
    setGameMode: () => { },

    streaksEnabled: true,
    setStreaksEnabled: () => { },
    streakSaverActive: true,
    toggleStreakSaver: () => { },
    holidaySaverActive: true,
    toggleHolidaySaver: () => { },

    quickMenuEnabled: true,
    toggleQuickMenu: () => { },
    leagueTablesEnabled: true,
    toggleLeagueTables: () => { },

    reminderEnabled: false,
    setReminderEnabled: () => { },
    reminderTime: '09:00',
    setReminderTime: () => { },
    streakReminderEnabled: false,
    setStreakReminderEnabled: () => { },
    streakReminderTime: '20:00',
    setStreakReminderTime: () => { },
    hasPromptedStreak2: false,
    setHasPromptedStreak2: () => { },
    hasPromptedStreak7: false,
    setHasPromptedStreak7: () => { },
    neverAskReminder: false,
    setNeverAskReminder: () => { },

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
    const [useDeviceDisplay, setUseDeviceDisplay] = useState(false);
    const [cluesEnabled, setCluesEnabled] = useState(true);
    const [quickMenuEnabled, setQuickMenuEnabled] = useState(true); // Default true (Shown)
    const [leagueTablesEnabled, setLeagueTablesEnabled] = useState(true); // Default true (Shown)

    const [dateLength, setDateLengthState] = useState<DateLength>(8);
    const [dateFormatOrder, setDateFormatOrderState] = useState<DateFormatOrder>('ddmmyy');
    const [streakSaverActive, setStreakSaverActive] = useState(true);
    const [holidaySaverActive, setHolidaySaverActive] = useState(true);
    const [streaksEnabled, setStreaksEnabledState] = useState(true);

    // Notification Reminder States (local-only)
    const [reminderEnabled, setReminderEnabledState] = useState(false);
    const [reminderTime, setReminderTimeState] = useState('09:00');
    const [streakReminderEnabled, setStreakReminderEnabledState] = useState(false);
    const [streakReminderTime, setStreakReminderTimeState] = useState('20:00');
    const [hasPromptedStreak2, setHasPromptedStreak2State] = useState(false);
    const [hasPromptedStreak7, setHasPromptedStreak7State] = useState(false);
    const [neverAskReminder, setNeverAskReminderState] = useState(false);

    // App State (Local Only usually)
    const [gameModeState, setGameModeState] = useState<GameMode>('REGION');
    const [loading, setLoading] = useState(true);

    const setGameMode = async (mode: GameMode) => {
        setGameModeState(mode);
        await AsyncStorage.setItem('app_game_mode', mode);
    };

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
    // When user signs OUT, revert to device display settings
    useEffect(() => {
        if (user) {
            console.log('[Options] User available, syncing settings...');
            syncWithSupabase();
        } else {
            // Signed out: always follow device's light/dark setting
            const deviceScheme = Appearance.getColorScheme();
            const deviceIsDark = deviceScheme === 'dark';
            console.log('[Options] No user — defaulting to device scheme:', deviceScheme);
            setDarkModeState(deviceIsDark);
            setColorScheme(deviceIsDark ? 'dark' : 'light');
        }
    }, [user]);

    // Listen for device appearance changes — apply when signed out or useDeviceDisplay is on
    useEffect(() => {
        const subscription = Appearance.addChangeListener(({ colorScheme }) => {
            if (!user || useDeviceDisplay) {
                const deviceIsDark = colorScheme === 'dark';
                console.log('[Options] Device appearance changed:', { colorScheme, applyReason: !user ? 'signed-out' : 'useDeviceDisplay' });
                setDarkModeState(deviceIsDark);
                setColorScheme(deviceIsDark ? 'dark' : 'light');
            }
        });
        return () => subscription.remove();
    }, [user, useDeviceDisplay, setColorScheme]);

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
                if ((data as any).use_device_display !== undefined && (data as any).use_device_display !== null) {
                    setUseDeviceDisplay((data as any).use_device_display);
                    AsyncStorage.setItem('opt_use_device_display', String((data as any).use_device_display));
                    // If device display is enabled, sync dark mode with device NOW
                    if ((data as any).use_device_display) {
                        const deviceScheme = Appearance.getColorScheme();
                        if (deviceScheme) {
                            const deviceIsDark = deviceScheme === 'dark';
                            setDarkModeState(deviceIsDark);
                            setColorScheme(deviceIsDark ? 'dark' : 'light');
                            AsyncStorage.setItem('opt_dark_mode', String(deviceIsDark));
                        }
                    }
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
                if (data.quick_menu_enabled !== undefined) {
                    setQuickMenuEnabled(data.quick_menu_enabled);
                    AsyncStorage.setItem('opt_quick_menu', String(data.quick_menu_enabled));
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
            if (storedMode) setGameModeState(storedMode as GameMode);

            const storedTextSize = await AsyncStorage.getItem('opt_text_size');
            if (storedTextSize) setTextSizeState(storedTextSize as TextSize);

            const storedSounds = await AsyncStorage.getItem('opt_sounds_enabled');
            if (storedSounds !== null) setSoundsEnabled(storedSounds === 'true');

            const storedDarkMode = await AsyncStorage.getItem('opt_dark_mode');
            const storedUseDeviceDisplay = await AsyncStorage.getItem('opt_use_device_display');

            if (storedUseDeviceDisplay !== null) {
                const useDevice = storedUseDeviceDisplay === 'true';
                setUseDeviceDisplay(useDevice);
                if (useDevice) {
                    // Device display mode: sync dark mode from device
                    const deviceScheme = Appearance.getColorScheme();
                    if (deviceScheme) {
                        const deviceIsDark = deviceScheme === 'dark';
                        setDarkModeState(deviceIsDark);
                        await AsyncStorage.setItem('opt_dark_mode', String(deviceIsDark));
                    } else if (storedDarkMode !== null) {
                        setDarkModeState(storedDarkMode === 'true');
                    }
                } else if (storedDarkMode !== null) {
                    setDarkModeState(storedDarkMode === 'true');
                }
            } else if (storedDarkMode !== null) {
                // Existing user with no device display setting stored — keep manual mode
                setDarkModeState(storedDarkMode === 'true');
                setUseDeviceDisplay(false);
            } else {
                // First launch: check if we can read device scheme
                const systemScheme = Appearance.getColorScheme();
                if (systemScheme) {
                    // Device scheme readable — default to using device display
                    const systemIsDark = systemScheme === 'dark';
                    setUseDeviceDisplay(true);
                    setDarkModeState(systemIsDark);
                    await AsyncStorage.setItem('opt_use_device_display', 'true');
                    await AsyncStorage.setItem('opt_dark_mode', String(systemIsDark));
                } else {
                    // Can't read device scheme — default to manual off
                    setUseDeviceDisplay(false);
                    setDarkModeState(false);
                    await AsyncStorage.setItem('opt_use_device_display', 'false');
                    await AsyncStorage.setItem('opt_dark_mode', 'false');
                }
            }

            const storedClues = await AsyncStorage.getItem('opt_clues_enabled');
            if (storedClues !== null) setCluesEnabled(storedClues === 'true');

            const storedStreakSaver = await AsyncStorage.getItem('opt_streak_saver_active');
            if (storedStreakSaver !== null) setStreakSaverActive(storedStreakSaver === 'true');

            const storedHolidaySaver = await AsyncStorage.getItem('opt_holiday_saver_active');
            if (storedHolidaySaver !== null) setHolidaySaverActive(storedHolidaySaver === 'true');

            const storedStreaksEnabled = await AsyncStorage.getItem('opt_streaks_enabled');
            if (storedStreaksEnabled !== null) setStreaksEnabledState(storedStreaksEnabled === 'true');

            const storedQuickMenu = await AsyncStorage.getItem('opt_quick_menu');
            if (storedQuickMenu !== null) setQuickMenuEnabled(storedQuickMenu === 'true');

            const storedLeagueTables = await AsyncStorage.getItem('opt_league_tables');
            if (storedLeagueTables !== null) setLeagueTablesEnabled(storedLeagueTables === 'true');

            // Load Reminder Settings
            const storedReminderEnabled = await AsyncStorage.getItem('opt_reminder_enabled');
            if (storedReminderEnabled !== null) setReminderEnabledState(storedReminderEnabled === 'true');

            const storedReminderTime = await AsyncStorage.getItem('opt_reminder_time');
            if (storedReminderTime !== null) setReminderTimeState(storedReminderTime);

            const storedStreakReminderEnabled = await AsyncStorage.getItem('opt_streak_reminder_enabled');
            if (storedStreakReminderEnabled !== null) setStreakReminderEnabledState(storedStreakReminderEnabled === 'true');

            const storedStreakReminderTime = await AsyncStorage.getItem('opt_streak_reminder_time');
            if (storedStreakReminderTime !== null) setStreakReminderTimeState(storedStreakReminderTime);

            const storedPrompted2 = await AsyncStorage.getItem('opt_prompted_streak2');
            if (storedPrompted2 !== null) setHasPromptedStreak2State(storedPrompted2 === 'true');

            const storedPrompted7 = await AsyncStorage.getItem('opt_prompted_streak7');
            if (storedPrompted7 !== null) setHasPromptedStreak7State(storedPrompted7 === 'true');

            const storedNeverAsk = await AsyncStorage.getItem('opt_never_ask_reminder');
            if (storedNeverAsk !== null) setNeverAskReminderState(storedNeverAsk === 'true');

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

    // Toggle "Use device display settings"
    // Returns true if successfully enabled, false otherwise
    const toggleUseDeviceDisplay = (): boolean => {
        const newValue = !useDeviceDisplay;
        if (newValue) {
            // Enabling: check if we can read the device scheme
            const deviceScheme = Appearance.getColorScheme();
            if (!deviceScheme) {
                console.log('[Options] Cannot read device display settings');
                return false; // Signal failure — caller should show error
            }
            // Successfully read device scheme
            const deviceIsDark = deviceScheme === 'dark';
            console.log('[Options] Enabling device display tracking, device is dark:', deviceIsDark);
            setUseDeviceDisplay(true);
            setDarkModeState(deviceIsDark);
            setColorScheme(deviceIsDark ? 'dark' : 'light');
            AsyncStorage.setItem('opt_use_device_display', 'true');
            AsyncStorage.setItem('opt_dark_mode', String(deviceIsDark));
            if (user) {
                supabase.from('user_settings')
                    .update({ use_device_display: true, dark_mode: deviceIsDark } as any)
                    .eq('user_id', user.id)
                    .then(({ error }) => { if (error) console.log('[Options] Error updating use_device_display:', error) });
            }
            return true;
        } else {
            // Disabling: just turn off, leave dark mode as-is
            console.log('[Options] Disabling device display tracking');
            setUseDeviceDisplay(false);
            AsyncStorage.setItem('opt_use_device_display', 'false');
            if (user) {
                supabase.from('user_settings')
                    .update({ use_device_display: false } as any)
                    .eq('user_id', user.id)
                    .then(({ error }) => { if (error) console.log('[Options] Error updating use_device_display:', error) });
            }
            return true;
        }
    };

    // Sync dark mode with device (called from Home screen on focus)
    const syncDarkModeWithDevice = () => {
        // Always sync when signed out, or when useDeviceDisplay is enabled
        if (!useDeviceDisplay && user) return;
        const deviceScheme = Appearance.getColorScheme();
        if (!deviceScheme) return;
        const deviceIsDark = deviceScheme === 'dark';
        if (deviceIsDark !== darkMode) {
            console.log('[Options] Device display changed, syncing dark mode:', { deviceIsDark, wasDark: darkMode, signedOut: !user });
            setDarkModeState(deviceIsDark);
            setColorScheme(deviceIsDark ? 'dark' : 'light');
            AsyncStorage.setItem('opt_dark_mode', String(deviceIsDark));
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

    const toggleQuickMenu = async () => {
        const newValue = !quickMenuEnabled;
        setQuickMenuEnabled(newValue);
        await AsyncStorage.setItem('opt_quick_menu', newValue.toString());
        if (user) {
            supabase.from('user_settings')
                .update({ quick_menu_enabled: newValue })
                .eq('user_id', user.id)
                .then(({ error }) => { if (error) console.log('[Options] Error updating quick menu:', error) });
        }
    };

    const toggleLeagueTables = async () => {
        const newValue = !leagueTablesEnabled;
        setLeagueTablesEnabled(newValue);
        await AsyncStorage.setItem('opt_league_tables', newValue.toString());
    };

    // ── Notification Reminder Setters (local-only, no Supabase sync) ──
    const setReminderEnabled = async (enabled: boolean) => {
        setReminderEnabledState(enabled);
        await AsyncStorage.setItem('opt_reminder_enabled', String(enabled));
        console.log('[Options] Reminder enabled:', enabled);
    };

    const setReminderTime = async (time: string) => {
        setReminderTimeState(time);
        await AsyncStorage.setItem('opt_reminder_time', time);
        console.log('[Options] Reminder time:', time);
    };

    const setHasPromptedStreak2 = async (val: boolean) => {
        setHasPromptedStreak2State(val);
        await AsyncStorage.setItem('opt_prompted_streak2', String(val));
    };

    const setHasPromptedStreak7 = async (val: boolean) => {
        setHasPromptedStreak7State(val);
        await AsyncStorage.setItem('opt_prompted_streak7', String(val));
    };

    const setNeverAskReminder = async (val: boolean) => {
        setNeverAskReminderState(val);
        await AsyncStorage.setItem('opt_never_ask_reminder', String(val));
    };

    const setStreakReminderEnabled = async (enabled: boolean) => {
        setStreakReminderEnabledState(enabled);
        await AsyncStorage.setItem('opt_streak_reminder_enabled', String(enabled));
        console.log('[Options] Streak reminder enabled:', enabled);
    };

    const setStreakReminderTime = async (time: string) => {
        setStreakReminderTimeState(time);
        await AsyncStorage.setItem('opt_streak_reminder_time', time);
        console.log('[Options] Streak reminder time:', time);
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

        // [FIX] When turning OFF streak saver, also disable holiday saver
        if (!newValue && holidaySaverActive) {
            setHolidaySaverActive(false);
            await AsyncStorage.setItem('opt_holiday_saver_active', 'false');
            if (user) {
                supabase.from('user_settings')
                    .update({ streak_saver_active: false, holiday_saver_active: false })
                    .eq('user_id', user.id)
                    .then(({ error }) => { if (error) console.log('[Options] Error updating streak saver:', error) });
            }
        } else if (user) {
            supabase.from('user_settings')
                .update({ streak_saver_active: newValue })
                .eq('user_id', user.id)
                .then(({ error }) => { if (error) console.log('[Options] Error updating streak saver:', error) });
        }
    };

    const toggleHolidaySaver = async () => {
        // [FIX] Can't enable holiday if streak saver is off
        if (!streakSaverActive) return;

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

    // Set streaks enabled/disabled
    const setStreaksEnabled = async (enabled: boolean) => {
        console.log('[Options] setStreaksEnabled:', enabled);
        setStreaksEnabledState(enabled);
        await AsyncStorage.setItem('opt_streaks_enabled', String(enabled));

        // When disabling streaks, also disable streak saver and holiday saver
        if (!enabled) {
            if (streakSaverActive) {
                setStreakSaverActive(false);
                await AsyncStorage.setItem('opt_streak_saver_active', 'false');
            }
            if (holidaySaverActive) {
                setHolidaySaverActive(false);
                await AsyncStorage.setItem('opt_holiday_saver_active', 'false');
            }
            if (user) {
                supabase.from('user_settings')
                    .update({ streaks_enabled: false, streak_saver_active: false, holiday_saver_active: false } as any)
                    .eq('user_id', user.id)
                    .then(({ error }) => { if (error) console.log('[Options] Error disabling streaks:', error) });
            }
        } else {
            // Re-enable streak saver and holiday saver when streaks are turned back on
            setStreakSaverActive(true);
            await AsyncStorage.setItem('opt_streak_saver_active', 'true');
            setHolidaySaverActive(true);
            await AsyncStorage.setItem('opt_holiday_saver_active', 'true');
            if (user) {
                supabase.from('user_settings')
                    .update({ streaks_enabled: true, streak_saver_active: true, holiday_saver_active: true } as any)
                    .eq('user_id', user.id)
                    .then(({ error }) => { if (error) console.log('[Options] Error enabling streaks:', error) });
            }
        }
    };

    return (
        <OptionsContext.Provider value={{
            textSize, setTextSize,
            soundsEnabled, toggleSounds,
            darkMode, toggleDarkMode,
            useDeviceDisplay, toggleUseDeviceDisplay, syncDarkModeWithDevice,
            cluesEnabled, toggleClues,
            dateLength, setDateLength,
            dateFormatOrder, setDateFormatOrder,
            gameMode: gameModeState, setGameMode,
            streaksEnabled, setStreaksEnabled,
            streakSaverActive, toggleStreakSaver,
            holidaySaverActive, toggleHolidaySaver,
            quickMenuEnabled, toggleQuickMenu,
            leagueTablesEnabled, toggleLeagueTables,
            reminderEnabled, setReminderEnabled,
            reminderTime, setReminderTime,
            streakReminderEnabled, setStreakReminderEnabled,
            streakReminderTime, setStreakReminderTime,
            hasPromptedStreak2, setHasPromptedStreak2,
            hasPromptedStreak7, setHasPromptedStreak7,
            neverAskReminder, setNeverAskReminder,
            textScale: getTextScale(textSize),
            loading
        }}>
            {children}
        </OptionsContext.Provider>
    );
}

export const useOptions = () => useContext(OptionsContext);
