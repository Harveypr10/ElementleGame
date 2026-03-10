import React, { createContext, useContext, useState, useEffect, useRef, useMemo, useCallback } from 'react';
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
    leagueAutoUnlockDone: boolean;
    setLeagueAutoUnlockDone: (val: boolean) => void;
    hasSeenHowToPlay: boolean;
    setHasSeenHowToPlay: (val: boolean) => void;

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
    userSettingsLoaded: boolean;
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
    leagueTablesEnabled: false,
    toggleLeagueTables: () => { },
    leagueAutoUnlockDone: false,
    setLeagueAutoUnlockDone: () => { },
    hasSeenHowToPlay: false,
    setHasSeenHowToPlay: () => { },

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
    userSettingsLoaded: false,
});

export function OptionsProvider({ children }: { children: React.ReactNode }) {
    const { user } = useAuth();
    const { setColorScheme } = useColorScheme();

    // ── User-scoped AsyncStorage key helper ──
    // Appends _${userId} or _guest so each user gets isolated local storage.
    const scopeKey = useCallback((key: string) => {
        return `${key}_${user?.id ?? 'guest'}`;
    }, [user?.id]);

    // Default States
    const [textSize, setTextSizeState] = useState<TextSize>('medium');
    const [soundsEnabled, setSoundsEnabled] = useState(false);
    const [darkMode, setDarkModeState] = useState(false);
    const [useDeviceDisplay, setUseDeviceDisplay] = useState(false);
    const [cluesEnabled, setCluesEnabled] = useState(true);
    const [quickMenuEnabled, setQuickMenuEnabled] = useState(true); // Default true (Shown)
    const [leagueTablesEnabled, setLeagueTablesEnabled] = useState(false); // Default false — hidden until unlocked
    const [leagueAutoUnlockDone, setLeagueAutoUnlockDoneState] = useState(false); // Persistent flag: once true, auto-unlock popup never re-fires
    const [hasSeenHowToPlay, setHasSeenHowToPlayState] = useState(false);

    const [dateLength, setDateLengthState] = useState<DateLength>(8);
    const [dateFormatOrder, setDateFormatOrderState] = useState<DateFormatOrder>('ddmmyy');
    const [streakSaverActive, setStreakSaverActive] = useState(true);
    const [holidaySaverActive, setHolidaySaverActive] = useState(true);
    const [streaksEnabled, setStreaksEnabledState] = useState(true);

    // Notification Reminder States (synced to Supabase for cross-device persistence)
    const [reminderEnabled, setReminderEnabledState] = useState(false);
    const [reminderTime, setReminderTimeState] = useState('09:00');
    const [streakReminderEnabled, setStreakReminderEnabledState] = useState(false);
    const [streakReminderTime, setStreakReminderTimeState] = useState('20:00');
    const [hasPromptedStreak2, setHasPromptedStreak2State] = useState(false);
    const [hasPromptedStreak7, setHasPromptedStreak7State] = useState(false);
    const [neverAskReminder, setNeverAskReminderState] = useState(false);

    // App State (Global — not user-scoped)
    const [gameModeState, setGameModeState] = useState<GameMode>('REGION');
    const [loading, setLoading] = useState(true);
    const [userSettingsLoaded, setUserSettingsLoaded] = useState(false);

    const setGameMode = useCallback(async (mode: GameMode) => {
        setGameModeState(mode);
        await AsyncStorage.setItem('app_game_mode', mode);
    }, []);

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
            console.log('[Options] User available, loading user-scoped settings...');

            // Load ALL user-scoped preferences from AsyncStorage (fast local cache)
            const loadUserScopedSettings = async () => {
                const uid = user.id;
                const sk = (key: string) => `${key}_${uid}`;

                // UI Preferences (also synced from Supabase, but load cache first for instant display)
                const storedTextSize = await AsyncStorage.getItem(sk('opt_text_size'));
                if (storedTextSize) setTextSizeState(storedTextSize as TextSize);

                const storedSounds = await AsyncStorage.getItem(sk('opt_sounds_enabled'));
                if (storedSounds !== null) setSoundsEnabled(storedSounds === 'true');

                const storedDarkMode = await AsyncStorage.getItem(sk('opt_dark_mode'));
                const storedUseDeviceDisplay = await AsyncStorage.getItem(sk('opt_use_device_display'));

                if (storedUseDeviceDisplay !== null) {
                    const useDevice = storedUseDeviceDisplay === 'true';
                    setUseDeviceDisplay(useDevice);
                    if (useDevice) {
                        const deviceScheme = Appearance.getColorScheme();
                        const deviceIsDark = deviceScheme === 'dark';
                        setDarkModeState(deviceIsDark);
                        setColorScheme(deviceIsDark ? 'dark' : 'light');
                    } else if (storedDarkMode !== null) {
                        setDarkModeState(storedDarkMode === 'true');
                    }
                } else if (storedDarkMode !== null) {
                    setDarkModeState(storedDarkMode === 'true');
                }

                const storedClues = await AsyncStorage.getItem(sk('opt_clues_enabled'));
                if (storedClues !== null) setCluesEnabled(storedClues === 'true');

                const storedDateLength = await AsyncStorage.getItem(sk('opt_date_length'));
                if (storedDateLength) setDateLengthState(parseInt(storedDateLength) as DateLength);

                const storedDateOrder = await AsyncStorage.getItem(sk('opt_date_order'));
                if (storedDateOrder) setDateFormatOrderState(storedDateOrder as DateFormatOrder);

                const storedStreakSaver = await AsyncStorage.getItem(sk('opt_streak_saver_active'));
                if (storedStreakSaver !== null) setStreakSaverActive(storedStreakSaver === 'true');

                const storedHolidaySaver = await AsyncStorage.getItem(sk('opt_holiday_saver_active'));
                if (storedHolidaySaver !== null) setHolidaySaverActive(storedHolidaySaver === 'true');

                const storedStreaksEnabled = await AsyncStorage.getItem(sk('opt_streaks_enabled'));
                if (storedStreaksEnabled !== null) setStreaksEnabledState(storedStreaksEnabled === 'true');

                const storedQuickMenu = await AsyncStorage.getItem(sk('opt_quick_menu'));
                if (storedQuickMenu !== null) setQuickMenuEnabled(storedQuickMenu === 'true');

                // League flags
                const storedLeagueTables = await AsyncStorage.getItem(sk('opt_league_tables'));
                if (storedLeagueTables !== null) {
                    setLeagueTablesEnabled(storedLeagueTables === 'true');
                } else {
                    setLeagueTablesEnabled(false);
                }
                const storedAutoUnlockDone = await AsyncStorage.getItem(sk('opt_league_auto_unlock_done'));
                if (storedAutoUnlockDone !== null) {
                    setLeagueAutoUnlockDoneState(storedAutoUnlockDone === 'true');
                } else {
                    setLeagueAutoUnlockDoneState(false);
                }

                const storedHowToPlay = await AsyncStorage.getItem(sk('opt_has_seen_how_to_play'));
                if (storedHowToPlay !== null) {
                    setHasSeenHowToPlayState(storedHowToPlay === 'true');
                }

                // Notification/prompt flags (also synced to Supabase for cross-device)
                const storedReminderEnabled = await AsyncStorage.getItem(sk('opt_reminder_enabled'));
                if (storedReminderEnabled !== null) setReminderEnabledState(storedReminderEnabled === 'true');

                const storedReminderTime = await AsyncStorage.getItem(sk('opt_reminder_time'));
                if (storedReminderTime !== null) setReminderTimeState(storedReminderTime);

                const storedStreakReminderEnabled = await AsyncStorage.getItem(sk('opt_streak_reminder_enabled'));
                if (storedStreakReminderEnabled !== null) setStreakReminderEnabledState(storedStreakReminderEnabled === 'true');

                const storedStreakReminderTime = await AsyncStorage.getItem(sk('opt_streak_reminder_time'));
                if (storedStreakReminderTime !== null) setStreakReminderTimeState(storedStreakReminderTime);

                const storedPrompted2 = await AsyncStorage.getItem(sk('opt_prompted_streak2'));
                if (storedPrompted2 !== null) setHasPromptedStreak2State(storedPrompted2 === 'true');

                const storedPrompted7 = await AsyncStorage.getItem(sk('opt_prompted_streak7'));
                if (storedPrompted7 !== null) setHasPromptedStreak7State(storedPrompted7 === 'true');

                const storedNeverAsk = await AsyncStorage.getItem(sk('opt_never_ask_reminder'));
                if (storedNeverAsk !== null) setNeverAskReminderState(storedNeverAsk === 'true');
            };

            loadUserScopedSettings().then(async () => {
                // After local cache, sync from Supabase (cloud source of truth overwrites).
                // IMPORTANT: userSettingsLoaded must be set AFTER sync completes, not before.
                // On a new device, AsyncStorage is empty so all settings use defaults.
                // If we set userSettingsLoaded=true before sync, code gated by it
                // (like the league auto-unlock check) fires with stale defaults.
                await syncWithSupabase();
                setUserSettingsLoaded(true);
            });
        } else {
            // Signed out: force device theme, reset all user-specific state to safe defaults
            const deviceScheme = Appearance.getColorScheme();
            const deviceIsDark = deviceScheme === 'dark';
            console.log('[Options] No user — defaulting to device scheme:', deviceScheme);
            setDarkModeState(deviceIsDark);
            setUseDeviceDisplay(true);
            setColorScheme(deviceIsDark ? 'dark' : 'light');

            // Reset all preference states to defaults
            setTextSizeState('medium');
            setSoundsEnabled(false);
            setCluesEnabled(true);
            setDateLengthState(8);
            setDateFormatOrderState('ddmmyy');
            setStreakSaverActive(true);
            setHolidaySaverActive(true);
            setStreaksEnabledState(true);
            setQuickMenuEnabled(true);
            setLeagueTablesEnabled(false);
            setLeagueAutoUnlockDoneState(false);
            setHasSeenHowToPlayState(false);
            setReminderEnabledState(false);
            setReminderTimeState('09:00');
            setStreakReminderEnabledState(false);
            setStreakReminderTimeState('20:00');
            setHasPromptedStreak2State(false);
            setHasPromptedStreak7State(false);
            setNeverAskReminderState(false);
            setUserSettingsLoaded(false);
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
        const sk = (key: string) => `${key}_${user.id}`;
        try {
            const { data, error } = await supabase
                .from('user_settings')
                .select('*')
                .eq('user_id', user.id)
                .single();

            if (data) {
                console.log('[Options] Synced settings from Supabase:', data);
                // Apply DB settings (override local cache)
                if (data.digit_preference) {
                    setDateLengthState(parseInt(data.digit_preference) as DateLength);
                    AsyncStorage.setItem(sk('opt_date_length'), data.digit_preference);
                }
                if (data.date_format_preference) {
                    setDateFormatOrderState(data.date_format_preference as DateFormatOrder);
                    AsyncStorage.setItem(sk('opt_date_order'), data.date_format_preference);
                }
                if (data.text_size) {
                    setTextSizeState(data.text_size as TextSize);
                    AsyncStorage.setItem(sk('opt_text_size'), data.text_size);
                }
                if (data.sounds_enabled !== undefined && data.sounds_enabled !== null) {
                    setSoundsEnabled(data.sounds_enabled);
                    AsyncStorage.setItem(sk('opt_sounds_enabled'), String(data.sounds_enabled));
                }
                if (data.dark_mode !== undefined && data.dark_mode !== null) {
                    // If device display is also enabled, device takes priority
                    if (!(data as any).use_device_display) {
                        setDarkModeState(data.dark_mode);
                        setColorScheme(data.dark_mode ? 'dark' : 'light');
                    }
                    AsyncStorage.setItem(sk('opt_dark_mode'), String(data.dark_mode));
                }
                if ((data as any).use_device_display !== undefined && (data as any).use_device_display !== null) {
                    setUseDeviceDisplay((data as any).use_device_display);
                    AsyncStorage.setItem(sk('opt_use_device_display'), String((data as any).use_device_display));
                    if ((data as any).use_device_display) {
                        const deviceScheme = Appearance.getColorScheme();
                        if (deviceScheme) {
                            const deviceIsDark = deviceScheme === 'dark';
                            setDarkModeState(deviceIsDark);
                            setColorScheme(deviceIsDark ? 'dark' : 'light');
                            AsyncStorage.setItem(sk('opt_dark_mode'), String(deviceIsDark));
                        }
                    }
                }
                if (data.clues_enabled !== undefined && data.clues_enabled !== null) {
                    setCluesEnabled(data.clues_enabled);
                    AsyncStorage.setItem(sk('opt_clues_enabled'), String(data.clues_enabled));
                }
                if ((data as any).streaks_enabled !== undefined) {
                    setStreaksEnabledState((data as any).streaks_enabled);
                    AsyncStorage.setItem(sk('opt_streaks_enabled'), String((data as any).streaks_enabled));
                }
                if (data.streak_saver_active !== undefined) {
                    setStreakSaverActive(data.streak_saver_active);
                    AsyncStorage.setItem(sk('opt_streak_saver_active'), String(data.streak_saver_active));
                }
                if (data.holiday_saver_active !== undefined) {
                    setHolidaySaverActive(data.holiday_saver_active);
                    AsyncStorage.setItem(sk('opt_holiday_saver_active'), String(data.holiday_saver_active));
                }
                if (data.quick_menu_enabled !== undefined) {
                    setQuickMenuEnabled(data.quick_menu_enabled);
                    AsyncStorage.setItem(sk('opt_quick_menu'), String(data.quick_menu_enabled));
                }

                // League flags (cross-device)
                if ((data as any).league_tables_enabled !== undefined) {
                    setLeagueTablesEnabled((data as any).league_tables_enabled);
                    AsyncStorage.setItem(sk('opt_league_tables'), String((data as any).league_tables_enabled));
                }
                if ((data as any).league_auto_unlock_done !== undefined) {
                    setLeagueAutoUnlockDoneState((data as any).league_auto_unlock_done);
                    AsyncStorage.setItem(sk('opt_league_auto_unlock_done'), String((data as any).league_auto_unlock_done));
                }

                // Tutorial flag
                if ((data as any).has_seen_how_to_play !== undefined) {
                    setHasSeenHowToPlayState((data as any).has_seen_how_to_play);
                    AsyncStorage.setItem(sk('opt_has_seen_how_to_play'), String((data as any).has_seen_how_to_play));
                }

                // Notification/prompt flags (new Supabase columns)
                if ((data as any).reminder_enabled !== undefined) {
                    setReminderEnabledState((data as any).reminder_enabled);
                    AsyncStorage.setItem(sk('opt_reminder_enabled'), String((data as any).reminder_enabled));
                }
                if ((data as any).reminder_time !== undefined) {
                    setReminderTimeState((data as any).reminder_time);
                    AsyncStorage.setItem(sk('opt_reminder_time'), (data as any).reminder_time);
                }
                if ((data as any).streak_reminder_enabled !== undefined) {
                    setStreakReminderEnabledState((data as any).streak_reminder_enabled);
                    AsyncStorage.setItem(sk('opt_streak_reminder_enabled'), String((data as any).streak_reminder_enabled));
                }
                if ((data as any).streak_reminder_time !== undefined) {
                    setStreakReminderTimeState((data as any).streak_reminder_time);
                    AsyncStorage.setItem(sk('opt_streak_reminder_time'), (data as any).streak_reminder_time);
                }
                if ((data as any).prompted_streak2 !== undefined) {
                    setHasPromptedStreak2State((data as any).prompted_streak2);
                    AsyncStorage.setItem(sk('opt_prompted_streak2'), String((data as any).prompted_streak2));
                }
                if ((data as any).prompted_streak7 !== undefined) {
                    setHasPromptedStreak7State((data as any).prompted_streak7);
                    AsyncStorage.setItem(sk('opt_prompted_streak7'), String((data as any).prompted_streak7));
                }
                if ((data as any).never_ask_reminder !== undefined) {
                    setNeverAskReminderState((data as any).never_ask_reminder);
                    AsyncStorage.setItem(sk('opt_never_ask_reminder'), String((data as any).never_ask_reminder));
                }
            }
        } catch (e) {
            console.error('[Options] Failed to sync with Supabase:', e);
        }
    };

    const loadOptions = async () => {
        try {
            // Only load GLOBAL keys here (runs on mount, before user is available)
            // All user-scoped keys are loaded in the user-available useEffect above.

            const storedMode = await AsyncStorage.getItem('app_game_mode');
            if (storedMode) setGameModeState(storedMode as GameMode);

            // On initial mount (before user is available), apply device theme as safe default
            const deviceScheme = Appearance.getColorScheme();
            const deviceIsDark = deviceScheme === 'dark';
            setUseDeviceDisplay(true);
            setDarkModeState(deviceIsDark);
            setColorScheme(deviceIsDark ? 'dark' : 'light');

        } catch (e) {
            console.error("Failed to load options", e);
        } finally {
            setLoading(false);
            console.log('[Options] Loaded global options (user-scoped keys loaded on auth)');
        }
    };

    // Helper to persist
    // Helper to persist a value to user-scoped AsyncStorage
    const persist = async (key: string, value: string) => {
        await AsyncStorage.setItem(scopeKey(key), value);
    };

    // ========================================================================
    // STABLE SETTERS — wrapped in useCallback to prevent context re-renders.
    // Toggle functions use the functional updater pattern (prev => !prev) so
    // they don't close over the state value and remain referentially stable.
    // ========================================================================

    const setTextSize = useCallback(async (size: TextSize) => {
        console.log('[Options] setTextSize called:', size);
        setTextSizeState(size);
        await AsyncStorage.setItem(scopeKey('opt_text_size'), size);
        if (user) {
            supabase.from('user_settings')
                .update({ text_size: size })
                .eq('user_id', user.id)
                .then(({ error }) => { if (error) console.log('[Options] Error updating text_size:', error) });
        }
    }, [user, scopeKey]);

    const toggleSounds = useCallback(async () => {
        setSoundsEnabled(prev => {
            const newValue = !prev;
            console.log('[Options] toggleSounds called:', { old: prev, new: newValue });
            AsyncStorage.setItem(scopeKey('opt_sounds_enabled'), newValue.toString());
            if (user) {
                supabase.from('user_settings')
                    .update({ sounds_enabled: newValue })
                    .eq('user_id', user.id)
                    .then(({ error }) => { if (error) console.log('[Options] Error updating sounds:', error) });
            }
            return newValue;
        });
    }, [user, scopeKey]);

    const toggleDarkMode = useCallback(async () => {
        setDarkModeState(prev => {
            const newValue = !prev;
            const newScheme = newValue ? 'dark' : 'light';
            console.log('[Options] toggleDarkMode called (Instant Apply):', { old: prev, new: newValue });

            setColorScheme(newScheme);

            AsyncStorage.setItem(scopeKey('opt_dark_mode'), newValue.toString());
            if (user) {
                supabase.from('user_settings')
                    .update({ dark_mode: newValue })
                    .eq('user_id', user.id)
                    .then(({ error }) => { if (error) console.log('[Options] Error updating dark mode:', error) });
            }
            return newValue;
        });
    }, [user, setColorScheme, scopeKey]);

    // Toggle "Use device display settings"
    // Returns true if successfully enabled, false otherwise
    const toggleUseDeviceDisplay = useCallback((): boolean => {
        // We need to read current useDeviceDisplay synchronously for the return value,
        // so we use a ref-based approach with the state setter
        let result = true;
        setUseDeviceDisplay(prev => {
            const newValue = !prev;
            if (newValue) {
                // Enabling: check if we can read the device scheme
                const deviceScheme = Appearance.getColorScheme();
                if (!deviceScheme) {
                    console.log('[Options] Cannot read device display settings');
                    result = false;
                    return prev; // Don't change state
                }
                // Successfully read device scheme
                const deviceIsDark = deviceScheme === 'dark';
                console.log('[Options] Enabling device display tracking, device is dark:', deviceIsDark);
                setDarkModeState(deviceIsDark);
                setColorScheme(deviceIsDark ? 'dark' : 'light');
                AsyncStorage.setItem(scopeKey('opt_use_device_display'), 'true');
                AsyncStorage.setItem(scopeKey('opt_dark_mode'), String(deviceIsDark));
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
                AsyncStorage.setItem(scopeKey('opt_use_device_display'), 'false');
                if (user) {
                    supabase.from('user_settings')
                        .update({ use_device_display: false } as any)
                        .eq('user_id', user.id)
                        .then(({ error }) => { if (error) console.log('[Options] Error updating use_device_display:', error) });
                }
                return false;
            }
        });
        return result;
    }, [user, setColorScheme, scopeKey]);

    // Sync dark mode with device (called from Home screen on focus)
    const syncDarkModeWithDevice = useCallback(() => {
        // Read current values via refs or state setter to avoid closures
        // We need to read both useDeviceDisplay and darkMode, so we chain state setters
        setUseDeviceDisplay(currentUseDevice => {
            setDarkModeState(currentDarkMode => {
                if (!currentUseDevice && user) return currentDarkMode; // No-op
                const deviceScheme = Appearance.getColorScheme();
                if (!deviceScheme) return currentDarkMode;
                const deviceIsDark = deviceScheme === 'dark';
                if (deviceIsDark !== currentDarkMode) {
                    console.log('[Options] Device display changed, syncing dark mode:', { deviceIsDark, wasDark: currentDarkMode, signedOut: !user });
                    setColorScheme(deviceIsDark ? 'dark' : 'light');
                    AsyncStorage.setItem(scopeKey('opt_dark_mode'), String(deviceIsDark));
                    return deviceIsDark;
                }
                return currentDarkMode;
            });
            return currentUseDevice; // Don't change useDeviceDisplay
        });
    }, [user, setColorScheme, scopeKey]);

    const toggleClues = useCallback(async () => {
        setCluesEnabled(prev => {
            const newValue = !prev;
            AsyncStorage.setItem(scopeKey('opt_clues_enabled'), newValue.toString());
            if (user) {
                supabase.from('user_settings')
                    .update({ clues_enabled: newValue })
                    .eq('user_id', user.id)
                    .then(({ error }) => { if (error) console.log('[Options] Error updating clues:', error) });
            }
            return newValue;
        });
    }, [user, scopeKey]);

    const toggleQuickMenu = useCallback(async () => {
        setQuickMenuEnabled(prev => {
            const newValue = !prev;
            AsyncStorage.setItem(scopeKey('opt_quick_menu'), newValue.toString());
            if (user) {
                supabase.from('user_settings')
                    .update({ quick_menu_enabled: newValue })
                    .eq('user_id', user.id)
                    .then(({ error }) => { if (error) console.log('[Options] Error updating quick menu:', error) });
            }
            return newValue;
        });
    }, [user, scopeKey]);

    const toggleLeagueTables = useCallback(async () => {
        setLeagueTablesEnabled(prev => {
            const newValue = !prev;
            AsyncStorage.setItem(scopeKey('opt_league_tables'), newValue.toString());
            if (newValue) {
                setLeagueAutoUnlockDoneState(true);
                AsyncStorage.setItem(scopeKey('opt_league_auto_unlock_done'), 'true');
                if (user) {
                    supabase.from('user_settings')
                        .update({ league_auto_unlock_done: true } as any)
                        .eq('user_id', user.id)
                        .then(({ error }) => { if (error) console.log('[Options] Error updating league auto unlock:', error) });
                }
            }
            if (user) {
                supabase.from('user_settings')
                    .update({ league_tables_enabled: newValue } as any)
                    .eq('user_id', user.id)
                    .then(({ error }) => { if (error) console.log('[Options] Error updating league tables:', error) });
            }
            return newValue;
        });
    }, [user, scopeKey]);

    const setLeagueAutoUnlockDone = useCallback(async (val: boolean) => {
        setLeagueAutoUnlockDoneState(val);
        await AsyncStorage.setItem(scopeKey('opt_league_auto_unlock_done'), String(val));
        if (user) {
            supabase.from('user_settings')
                .update({ league_auto_unlock_done: val } as any)
                .eq('user_id', user.id)
                .then(({ error }) => { if (error) console.log('[Options] Error updating league auto unlock done:', error) });
        }
    }, [user, scopeKey]);

    const setHasSeenHowToPlay = useCallback(async (val: boolean) => {
        setHasSeenHowToPlayState(val);
        await AsyncStorage.setItem(scopeKey('opt_has_seen_how_to_play'), String(val));
        if (user) {
            supabase.from('user_settings')
                .update({ has_seen_how_to_play: val } as any)
                .eq('user_id', user.id)
                .then(({ error }) => { if (error) console.log('[Options] Error updating has_seen_how_to_play:', error) });
        }
    }, [user, scopeKey]);

    // ── Notification/Prompt Setters (user-scoped AsyncStorage + Supabase sync) ──
    const setReminderEnabled = useCallback(async (enabled: boolean) => {
        setReminderEnabledState(enabled);
        await AsyncStorage.setItem(scopeKey('opt_reminder_enabled'), String(enabled));
        if (user) {
            supabase.from('user_settings')
                .update({ reminder_enabled: enabled } as any)
                .eq('user_id', user.id)
                .then(({ error }) => { if (error) console.log('[Options] Error updating reminder_enabled:', error) });
        }
        console.log('[Options] Reminder enabled:', enabled);
    }, [user, scopeKey]);

    const setReminderTime = useCallback(async (time: string) => {
        setReminderTimeState(time);
        await AsyncStorage.setItem(scopeKey('opt_reminder_time'), time);
        if (user) {
            supabase.from('user_settings')
                .update({ reminder_time: time } as any)
                .eq('user_id', user.id)
                .then(({ error }) => { if (error) console.log('[Options] Error updating reminder_time:', error) });
        }
        console.log('[Options] Reminder time:', time);
    }, [user, scopeKey]);

    const setHasPromptedStreak2 = useCallback(async (val: boolean) => {
        setHasPromptedStreak2State(val);
        await AsyncStorage.setItem(scopeKey('opt_prompted_streak2'), String(val));
        if (user) {
            supabase.from('user_settings')
                .update({ prompted_streak2: val } as any)
                .eq('user_id', user.id)
                .then(({ error }) => { if (error) console.log('[Options] Error updating prompted_streak2:', error) });
        }
    }, [user, scopeKey]);

    const setHasPromptedStreak7 = useCallback(async (val: boolean) => {
        setHasPromptedStreak7State(val);
        await AsyncStorage.setItem(scopeKey('opt_prompted_streak7'), String(val));
        if (user) {
            supabase.from('user_settings')
                .update({ prompted_streak7: val } as any)
                .eq('user_id', user.id)
                .then(({ error }) => { if (error) console.log('[Options] Error updating prompted_streak7:', error) });
        }
    }, [user, scopeKey]);

    const setNeverAskReminder = useCallback(async (val: boolean) => {
        setNeverAskReminderState(val);
        await AsyncStorage.setItem(scopeKey('opt_never_ask_reminder'), String(val));
        if (user) {
            supabase.from('user_settings')
                .update({ never_ask_reminder: val } as any)
                .eq('user_id', user.id)
                .then(({ error }) => { if (error) console.log('[Options] Error updating never_ask_reminder:', error) });
        }
    }, [user, scopeKey]);

    const setStreakReminderEnabled = useCallback(async (enabled: boolean) => {
        setStreakReminderEnabledState(enabled);
        await AsyncStorage.setItem(scopeKey('opt_streak_reminder_enabled'), String(enabled));
        if (user) {
            supabase.from('user_settings')
                .update({ streak_reminder_enabled: enabled } as any)
                .eq('user_id', user.id)
                .then(({ error }) => { if (error) console.log('[Options] Error updating streak_reminder_enabled:', error) });
        }
        console.log('[Options] Streak reminder enabled:', enabled);
    }, [user, scopeKey]);

    const setStreakReminderTime = useCallback(async (time: string) => {
        setStreakReminderTimeState(time);
        await AsyncStorage.setItem(scopeKey('opt_streak_reminder_time'), time);
        if (user) {
            supabase.from('user_settings')
                .update({ streak_reminder_time: time } as any)
                .eq('user_id', user.id)
                .then(({ error }) => { if (error) console.log('[Options] Error updating streak_reminder_time:', error) });
        }
        console.log('[Options] Streak reminder time:', time);
    }, [user, scopeKey]);

    const setDateLength = useCallback((length: DateLength) => {
        setDateLengthState(length);
        persist('opt_date_length', length.toString());
        if (user) {
            supabase.from('user_settings')
                .update({ digit_preference: length.toString() })
                .eq('user_id', user.id)
                .then(({ error }) => { if (error) console.log('[Options] Error updating date length:', error) });
        }
    }, [user]);

    const setDateFormatOrder = useCallback((order: DateFormatOrder) => {
        setDateFormatOrderState(order);
        persist('opt_date_order', order);
        if (user) {
            supabase.from('user_settings')
                .update({ date_format_preference: order })
                .eq('user_id', user.id)
                .then(({ error }) => { if (error) console.log('[Options] Error updating date order:', error) });
        }
    }, [user]);

    const toggleStreakSaver = useCallback(async () => {
        setStreakSaverActive(prev => {
            const newValue = !prev;
            AsyncStorage.setItem(scopeKey('opt_streak_saver_active'), newValue.toString());

            // [FIX] When turning OFF streak saver, also disable holiday saver
            if (!newValue) {
                setHolidaySaverActive(prevHoliday => {
                    if (prevHoliday) {
                        AsyncStorage.setItem(scopeKey('opt_holiday_saver_active'), 'false');
                    }
                    if (user) {
                        supabase.from('user_settings')
                            .update({ streak_saver_active: false, holiday_saver_active: false })
                            .eq('user_id', user.id)
                            .then(({ error }) => { if (error) console.log('[Options] Error updating streak saver:', error) });
                    }
                    return false;
                });
            } else if (user) {
                supabase.from('user_settings')
                    .update({ streak_saver_active: newValue })
                    .eq('user_id', user.id)
                    .then(({ error }) => { if (error) console.log('[Options] Error updating streak saver:', error) });
            }
            return newValue;
        });
    }, [user, scopeKey]);

    const toggleHolidaySaver = useCallback(async () => {
        // Use functional updater to check streakSaverActive without closing over it
        setStreakSaverActive(currentStreakSaver => {
            if (!currentStreakSaver) return currentStreakSaver; // Can't enable holiday if streak saver is off

            setHolidaySaverActive(prev => {
                const newValue = !prev;
                AsyncStorage.setItem(scopeKey('opt_holiday_saver_active'), newValue.toString());
                if (user) {
                    supabase.from('user_settings')
                        .update({ holiday_saver_active: newValue })
                        .eq('user_id', user.id)
                        .then(({ error }) => { if (error) console.log('[Options] Error updating holiday saver:', error) });
                }
                return newValue;
            });
            return currentStreakSaver; // Don't change streakSaverActive
        });
    }, [user, scopeKey]);

    // Set streaks enabled/disabled
    const setStreaksEnabled = useCallback(async (enabled: boolean) => {
        console.log('[Options] setStreaksEnabled:', enabled);
        setStreaksEnabledState(enabled);
        await AsyncStorage.setItem(scopeKey('opt_streaks_enabled'), String(enabled));

        // When disabling streaks, also disable streak saver and holiday saver
        if (!enabled) {
            setStreakSaverActive(prev => {
                if (prev) AsyncStorage.setItem(scopeKey('opt_streak_saver_active'), 'false');
                return false;
            });
            setHolidaySaverActive(prev => {
                if (prev) AsyncStorage.setItem(scopeKey('opt_holiday_saver_active'), 'false');
                return false;
            });
            if (user) {
                supabase.from('user_settings')
                    .update({ streaks_enabled: false, streak_saver_active: false, holiday_saver_active: false })
                    .eq('user_id', user.id)
                    .then(({ error }) => { if (error) console.log('[Options] Error disabling streaks:', error) });
            }
        } else {
            // Re-enable streak saver and holiday saver when streaks are turned back on
            setStreakSaverActive(true);
            await AsyncStorage.setItem(scopeKey('opt_streak_saver_active'), 'true');
            setHolidaySaverActive(true);
            await AsyncStorage.setItem(scopeKey('opt_holiday_saver_active'), 'true');
            if (user) {
                supabase.from('user_settings')
                    .update({ streaks_enabled: true, streak_saver_active: true, holiday_saver_active: true })
                    .eq('user_id', user.id)
                    .then(({ error }) => { if (error) console.log('[Options] Error enabling streaks:', error) });
            }
        }
    }, [user, scopeKey]);

    // ========================================================================
    // MEMOIZED CONTEXT VALUE
    // All functions above are wrapped in useCallback, so the useMemo only
    // recalculates when an actual state value changes — NOT on every render.
    // ========================================================================
    const contextValue = useMemo(() => ({
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
        leagueAutoUnlockDone, setLeagueAutoUnlockDone,
        hasSeenHowToPlay, setHasSeenHowToPlay,
        reminderEnabled, setReminderEnabled,
        reminderTime, setReminderTime,
        streakReminderEnabled, setStreakReminderEnabled,
        streakReminderTime, setStreakReminderTime,
        hasPromptedStreak2, setHasPromptedStreak2,
        hasPromptedStreak7, setHasPromptedStreak7,
        neverAskReminder, setNeverAskReminder,
        textScale: getTextScale(textSize),
        loading,
        userSettingsLoaded
    }), [
        // State values (trigger recalculation when they change):
        textSize, soundsEnabled, darkMode, useDeviceDisplay, cluesEnabled,
        dateLength, dateFormatOrder, gameModeState, streaksEnabled,
        streakSaverActive, holidaySaverActive, quickMenuEnabled,
        leagueTablesEnabled, leagueAutoUnlockDone, hasSeenHowToPlay, reminderEnabled, reminderTime,
        streakReminderEnabled, streakReminderTime,
        hasPromptedStreak2, hasPromptedStreak7, neverAskReminder, loading, userSettingsLoaded,
        // Stable useCallback refs (only change when `user` changes):
        setTextSize, toggleSounds, toggleDarkMode, toggleUseDeviceDisplay,
        syncDarkModeWithDevice, toggleClues, setDateLength, setDateFormatOrder,
        setGameMode, setStreaksEnabled, toggleStreakSaver, toggleHolidaySaver,
        toggleQuickMenu, toggleLeagueTables, setLeagueAutoUnlockDone, setHasSeenHowToPlay,
        setReminderEnabled, setReminderTime,
        setStreakReminderEnabled, setStreakReminderTime,
        setHasPromptedStreak2, setHasPromptedStreak7, setNeverAskReminder,
    ]);

    return (
        <OptionsContext.Provider value={contextValue}>
            {children}
        </OptionsContext.Provider>
    );
}

export const useOptions = () => useContext(OptionsContext);

