
import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Switch, Alert, Platform, Linking } from 'react-native';
import { useRouter } from 'expo-router';
import { styled, useColorScheme } from 'nativewind';
import { ChevronLeft, Flame, Bell } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useOptions, TextSize, DateLength, DateFormatOrder } from '../../lib/options';
import { useSubscription } from '../../hooks/useSubscription';
import { useAuth } from '../../lib/auth';
import { useMyLeaguesAll, LeagueWithMembership } from '../../hooks/useLeagueData';
import { AdBanner } from '../../components/AdBanner';
import { AdBannerContext } from '../../contexts/AdBannerContext';

import { ThemedText } from '../../components/ThemedText';
import { ThemedView } from '../../components/ThemedView';
import { useThemeColor } from '../../hooks/useThemeColor';
import * as NotificationService from '../../lib/NotificationService';
import { useNotificationData } from '../../hooks/useNotificationData';

// Lazy import: native module may not be available until native build
let DateTimePicker: any = null;
try {
    DateTimePicker = require('@react-native-community/datetimepicker').default;
} catch (e) {
    console.warn('[OptionsScreen] DateTimePicker native module not available yet');
}

const StyledView = styled(View);
const StyledScrollView = styled(ScrollView);
const StyledTouchableOpacity = styled(TouchableOpacity);

// TextScaling: Use size props on ThemedText, avoid manual style fontSize where possible
// Switch Colors: consistent with app theme

const ToggleRow = ({
    label,
    subLabel,
    value,
    onToggle,
    disabled = false,
    onDisabledPress,
    borderColor,
    noBorder = false,
    compact = false,
    labelAsSubheading = false
}: {
    label: string,
    subLabel?: string,
    value: boolean,
    onToggle: () => void,
    disabled?: boolean,
    onDisabledPress?: () => void,
    borderColor: string,
    noBorder?: boolean,
    compact?: boolean,
    labelAsSubheading?: boolean
}) => {
    return (
        <StyledTouchableOpacity
            onPress={disabled ? onDisabledPress : onToggle}
            className={`flex-row justify-between items-center ${compact ? 'py-1' : 'py-3'} active:opacity-70 ${noBorder ? '' : 'border-b last:border-0'}`}
            style={{ minHeight: compact ? 36 : 60, borderColor: noBorder ? 'transparent' : borderColor }}
        >
            <StyledView className="flex-1 pr-3 justify-center">
                <ThemedText
                    className={`${labelAsSubheading ? 'opacity-60' : 'font-n-bold'} ${disabled ? 'opacity-50' : ''}`}
                    size={labelAsSubheading ? 'sm' : 'base'}
                >
                    {label}
                </ThemedText>
                {subLabel && (
                    <ThemedText className="mt-0.5 opacity-60" size="sm" numberOfLines={1}>
                        {subLabel}
                    </ThemedText>
                )}
            </StyledView>
            <Switch
                value={value}
                onValueChange={disabled ? undefined : onToggle}
                disabled={disabled}
                trackColor={{ false: '#cbd5e1', true: '#3b82f6' }}
                thumbColor={'#ffffff'}
            />
        </StyledTouchableOpacity>
    );
};

const SegmentControl = <T extends string | number>({
    options,
    selected,
    onSelect,
    label,
    surfaceColor,
    borderColor,
    textColor
}: {
    options: { label: string, value: T }[],
    selected: T,
    onSelect: (val: T) => void,
    label?: string,
    surfaceColor: string,
    borderColor: string,
    textColor: string
}) => (
    <StyledView className="mb-3">
        {label && <ThemedText className="font-n-bold mb-2" size="base">{label}</ThemedText>}
        <StyledView className="flex-row gap-2">
            {options.map((opt) => {
                const isSelected = opt.value === selected;
                return (
                    <StyledTouchableOpacity
                        key={String(opt.value)}
                        onPress={() => onSelect(opt.value)}
                        style={{
                            minHeight: 48,
                            backgroundColor: isSelected ? '#3b82f6' : surfaceColor,
                            borderColor: isSelected ? '#3b82f6' : borderColor
                        }}
                        className="flex-1 py-3 rounded-xl border items-center justify-center"
                    >
                        <ThemedText
                            className="font-n-semibold"
                            style={{ color: isSelected ? 'white' : textColor }}
                            size="sm"
                        >
                            {opt.label}
                        </ThemedText>
                    </StyledTouchableOpacity>
                );
            })}
        </StyledView>
    </StyledView>
);

export default function OptionsScreen({ customBackAction }: { customBackAction?: () => void }) {
    const router = useRouter();
    const { isAuthenticated } = useAuth();
    const { isPro } = useSubscription();
    const { colorScheme } = useColorScheme();
    const {
        textSize, setTextSize,
        soundsEnabled, toggleSounds,
        darkMode, toggleDarkMode,
        useDeviceDisplay, toggleUseDeviceDisplay,
        cluesEnabled, toggleClues,
        dateLength, setDateLength,
        dateFormatOrder, setDateFormatOrder,
        streaksEnabled, setStreaksEnabled,
        streakSaverActive, toggleStreakSaver,
        holidaySaverActive, toggleHolidaySaver,
        quickMenuEnabled, toggleQuickMenu,
        leagueTablesEnabled, toggleLeagueTables,
        reminderEnabled, setReminderEnabled,
        reminderTime, setReminderTime,
        streakReminderEnabled, setStreakReminderEnabled,
        streakReminderTime, setStreakReminderTime,
    } = useOptions();

    // Check if all leagues are inactive (for disabling the League Tables toggle)
    const { data: allLeaguesData } = useMyLeaguesAll();
    const allLeaguesInactive = React.useMemo(() => {
        if (!allLeaguesData || allLeaguesData.length === 0) return false;
        return (allLeaguesData as LeagueWithMembership[]).every(l => {
            if (!l.is_active) return true;
            // Check if user has left all enabled boards
            const regionLeft = !l.has_region_board || !l.is_active_region;
            const userLeft = !l.has_user_board || !l.is_active_user;
            return regionLeft && userLeft;
        });
    }, [allLeaguesData]);

    const { data: notifData, hydrate: hydrateNotifs } = useNotificationData();

    const [showDailyTimePicker, setShowDailyTimePicker] = useState(false);
    const [showStreakTimePicker, setShowStreakTimePicker] = useState(false);

    // Pending time values for iOS confirm/cancel pattern
    const [pendingDailyTime, setPendingDailyTime] = useState<Date | null>(null);
    const [pendingStreakTime, setPendingStreakTime] = useState<Date | null>(null);

    // Parse time strings to Dates for pickers
    const dailyTimeAsDate = (() => {
        const [h, m] = (reminderTime || '09:00').split(':').map(Number);
        const d = new Date();
        d.setHours(h, m, 0, 0);
        return d;
    })();

    const streakTimeAsDate = (() => {
        const [h, m] = (streakReminderTime || '20:00').split(':').map(Number);
        const d = new Date();
        d.setHours(h, m, 0, 0);
        return d;
    })();

    // Format time for display
    const formatTimeDisplay = (time24: string) => {
        const [hours, minutes] = time24.split(':').map(Number);
        const period = hours >= 12 ? 'PM' : 'AM';
        const displayHour = hours % 12 || 12;
        return `${displayHour}:${minutes.toString().padStart(2, '0')} ${period}`;
    };

    // Helper: hydrate + reschedule
    const reschedule = async (overrides?: { rEnabled?: boolean; rTime?: string; sEnabled?: boolean; sTime?: string }) => {
        const freshData = await hydrateNotifs();
        await NotificationService.scheduleAll({
            reminderEnabled: overrides?.rEnabled ?? reminderEnabled,
            reminderTime: overrides?.rTime ?? (reminderTime || '09:00'),
            streakReminderEnabled: overrides?.sEnabled ?? streakReminderEnabled,
            streakReminderTime: overrides?.sTime ?? (streakReminderTime || '20:00'),
        }, freshData);
    };

    // Permission flow shared by both toggles
    const ensurePermissions = async (): Promise<boolean> => {
        const granted = await NotificationService.requestPermissions();
        if (!granted) {
            Alert.alert(
                'Enable Notifications',
                'To receive reminders, please enable notifications for Elementle in your device Settings.',
                [
                    { text: 'Cancel', style: 'cancel' },
                    {
                        text: 'Open Settings',
                        onPress: () => {
                            if (Platform.OS === 'ios') {
                                Linking.openURL('app-settings:');
                            } else {
                                Linking.openSettings();
                            }
                        },
                    },
                ]
            );
            return false;
        }
        return true;
    };

    const handleDailyReminderToggle = async () => {
        const newValue = !reminderEnabled;
        if (newValue) {
            if (!(await ensurePermissions())) return;
            await setReminderEnabled(true);
            await reschedule({ rEnabled: true });
        } else {
            await setReminderEnabled(false);
            if (!streakReminderEnabled) {
                await NotificationService.cancelAll();
            } else {
                await reschedule({ rEnabled: false });
            }
        }
    };

    const handleStreakReminderToggle = async () => {
        const newValue = !streakReminderEnabled;
        if (newValue) {
            if (!(await ensurePermissions())) return;
            await setStreakReminderEnabled(true);
            await reschedule({ sEnabled: true });
        } else {
            await setStreakReminderEnabled(false);
            if (!reminderEnabled) {
                await NotificationService.cancelAll();
            } else {
                await reschedule({ sEnabled: false });
            }
        }
    };

    const handleDailyTimeChange = async (_event: any, selectedDate?: Date) => {
        if (Platform.OS === 'android') {
            setShowDailyTimePicker(false);
            if (selectedDate) {
                const h = selectedDate.getHours().toString().padStart(2, '0');
                const m = selectedDate.getMinutes().toString().padStart(2, '0');
                const newTime = `${h}:${m}`;
                await setReminderTime(newTime);
                if (reminderEnabled || streakReminderEnabled) {
                    await reschedule({ rTime: newTime });
                }
            }
        } else {
            // iOS: just update pending value (don't commit until confirm)
            if (selectedDate) setPendingDailyTime(selectedDate);
        }
    };

    const handleStreakTimeChange = async (_event: any, selectedDate?: Date) => {
        if (Platform.OS === 'android') {
            setShowStreakTimePicker(false);
            if (selectedDate) {
                const h = selectedDate.getHours().toString().padStart(2, '0');
                const m = selectedDate.getMinutes().toString().padStart(2, '0');
                const newTime = `${h}:${m}`;
                await setStreakReminderTime(newTime);
                if (reminderEnabled || streakReminderEnabled) {
                    await reschedule({ sTime: newTime });
                }
            }
        } else {
            // iOS: just update pending value (don't commit until confirm)
            if (selectedDate) setPendingStreakTime(selectedDate);
        }
    };

    // iOS confirm/cancel handlers for time pickers
    const confirmDailyTime = async () => {
        const date = pendingDailyTime || dailyTimeAsDate;
        const h = date.getHours().toString().padStart(2, '0');
        const m = date.getMinutes().toString().padStart(2, '0');
        const newTime = `${h}:${m}`;
        await setReminderTime(newTime);
        if (reminderEnabled || streakReminderEnabled) {
            await reschedule({ rTime: newTime });
        }
        setPendingDailyTime(null);
        setShowDailyTimePicker(false);
    };

    const cancelDailyTime = () => {
        setPendingDailyTime(null);
        setShowDailyTimePicker(false);
    };

    const confirmStreakTime = async () => {
        const date = pendingStreakTime || streakTimeAsDate;
        const h = date.getHours().toString().padStart(2, '0');
        const m = date.getMinutes().toString().padStart(2, '0');
        const newTime = `${h}:${m}`;
        await setStreakReminderTime(newTime);
        if (reminderEnabled || streakReminderEnabled) {
            await reschedule({ sTime: newTime });
        }
        setPendingStreakTime(null);
        setShowStreakTimePicker(false);
    };

    const cancelStreakTime = () => {
        setPendingStreakTime(null);
        setShowStreakTimePicker(false);
    };

    const iconColor = useThemeColor({}, 'icon');
    const surfaceColor = useThemeColor({}, 'surface');
    const borderColor = useThemeColor({}, 'border');
    const textColor = useThemeColor({}, 'text');

    const handleBack = () => {
        if (customBackAction) {
            customBackAction();
        } else {
            router.back();
        }
    };

    return (
        <AdBannerContext.Provider value={true}>
            <ThemedView className="flex-1" style={{ paddingBottom: 0 }}>
                <SafeAreaView edges={['top']} style={{ backgroundColor: surfaceColor }}>
                    <StyledView
                        className="flex-row items-center justify-between px-4 py-3"
                        style={{ backgroundColor: surfaceColor }}
                    >
                        <StyledTouchableOpacity
                            onPress={handleBack}
                            className="w-10 h-10 items-center justify-center"
                            hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
                        >
                            <ChevronLeft size={28} color={iconColor} />
                        </StyledTouchableOpacity>
                        <ThemedText size="2xl" className="font-n-bold text-center">
                            Options
                        </ThemedText>
                        <StyledView className="w-10" />
                    </StyledView>
                </SafeAreaView>

                <StyledScrollView className="flex-1" contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 16, paddingBottom: 100, alignItems: 'center' }}>
                    <StyledView className="w-full" style={{ maxWidth: 768, alignSelf: 'center' }}>
                        {/* Display Options Card */}
                        <StyledView
                            className="rounded-2xl p-4 mb-3 border"
                            style={{ backgroundColor: surfaceColor, borderColor: borderColor }}
                        >
                            <ThemedText className="font-n-bold uppercase tracking-wide mb-3 opacity-60" size="sm">Display</ThemedText>

                            {/* Text Size */}
                            <SegmentControl<TextSize>
                                label="Text Size"
                                selected={textSize}
                                onSelect={setTextSize}
                                options={[
                                    { label: 'Small', value: 'small' },
                                    { label: 'Medium', value: 'medium' },
                                    { label: 'Large', value: 'large' },
                                ]}
                                surfaceColor={surfaceColor}
                                borderColor={borderColor}
                                textColor={textColor}
                            />

                            {/* Dark Mode Group */}
                            <StyledView
                                className="py-2 border-b"
                                style={{ borderColor: borderColor }}
                            >
                                <ThemedText className="font-n-bold" size="base">
                                    Dark Mode
                                </ThemedText>
                                <ToggleRow
                                    label="Use device's settings"
                                    value={useDeviceDisplay}
                                    onToggle={() => {
                                        const success = toggleUseDeviceDisplay();
                                        if (!success) {
                                            Alert.alert(
                                                'Cannot Read Device Settings',
                                                "Cannot read the device's display settings. Please set the mode manually.",
                                                [{ text: 'OK' }]
                                            );
                                        }
                                    }}
                                    borderColor={borderColor}
                                    noBorder
                                    compact
                                    labelAsSubheading
                                />
                                <ToggleRow
                                    label="Enable dark theme"
                                    value={darkMode}
                                    onToggle={toggleDarkMode}
                                    disabled={useDeviceDisplay}
                                    onDisabledPress={() => {
                                        Alert.alert(
                                            'Setting Locked',
                                            "Cannot change display theme when the device's settings are engaged.",
                                            [{ text: 'OK' }]
                                        );
                                    }}
                                    borderColor={borderColor}
                                    noBorder
                                    compact
                                    labelAsSubheading
                                />
                            </StyledView>

                            <ToggleRow
                                label="Quick Menu"
                                subLabel="Show navigation menu"
                                value={quickMenuEnabled}
                                onToggle={toggleQuickMenu}
                                borderColor={borderColor}
                            />

                            <ToggleRow
                                label="League Tables"
                                subLabel="Show buttons on home screen"
                                value={leagueTablesEnabled}
                                onToggle={toggleLeagueTables}
                                disabled={allLeaguesInactive}
                                onDisabledPress={() => {
                                    Alert.alert(
                                        'Leagues Inactive',
                                        'You have removed yourself from all leagues. Rejoin at least one league to enable the Leagues screen.',
                                        [{ text: 'OK' }]
                                    );
                                }}
                                borderColor={borderColor}
                            />
                        </StyledView>

                        {/* Date Format Card */}
                        <StyledView
                            className="rounded-2xl p-4 mb-3 border"
                            style={{ backgroundColor: surfaceColor, borderColor: borderColor }}
                        >
                            <ThemedText className="font-n-bold uppercase tracking-wide mb-3 opacity-60" size="sm">Date Format</ThemedText>

                            <SegmentControl<DateLength>
                                label="Digit Length"
                                selected={dateLength}
                                onSelect={setDateLength}
                                options={[
                                    { label: '6 Digits', value: 6 },
                                    { label: '8 Digits', value: 8 },
                                ]}
                                surfaceColor={surfaceColor}
                                borderColor={borderColor}
                                textColor={textColor}
                            />

                            <SegmentControl<DateFormatOrder>
                                label="Format Order"
                                selected={dateFormatOrder}
                                onSelect={setDateFormatOrder}
                                options={[
                                    { label: dateLength === 8 ? 'DD/MM/YYYY' : 'DD/MM/YY', value: 'ddmmyy' },
                                    { label: dateLength === 8 ? 'MM/DD/YYYY' : 'MM/DD/YY', value: 'mmddyy' },
                                ]}
                                surfaceColor={surfaceColor}
                                borderColor={borderColor}
                                textColor={textColor}
                            />
                        </StyledView>

                        {/* Gameplay Card */}
                        <StyledView
                            className="rounded-2xl p-4 mb-3 border"
                            style={{ backgroundColor: surfaceColor, borderColor: borderColor }}
                        >
                            <ThemedText className="font-n-bold uppercase tracking-wide mb-3 opacity-60" size="sm">Gameplay</ThemedText>

                            <ToggleRow
                                label="Sounds"
                                subLabel="Play sound effects"
                                value={soundsEnabled}
                                onToggle={toggleSounds}
                                borderColor={borderColor}
                            />

                            <ToggleRow
                                label="Clues"
                                subLabel="Show event titles"
                                value={cluesEnabled}
                                onToggle={toggleClues}
                                borderColor={borderColor}
                            />

                            <ToggleRow
                                label="Disable Streaks"
                                subLabel="Turn off streaks"
                                value={!streaksEnabled}
                                onToggle={() => {
                                    if (streaksEnabled) {
                                        // Turning streaks OFF — confirm first
                                        Alert.alert(
                                            'Disable Streaks?',
                                            "Turning off streaks will mean that you don't build a streak as you win the daily puzzles and you don't get awarded the Streak badges when you hit the streak milestones. Are you sure you want to disable streaks?",
                                            [
                                                { text: 'Continue', onPress: () => setStreaksEnabled(false) },
                                                { text: 'Cancel', style: 'default' },
                                            ]
                                        );
                                    } else {
                                        // Turning streaks back ON — also re-enable streak protection toggles
                                        setStreaksEnabled(true);
                                    }
                                }}
                                borderColor={borderColor}
                            />
                        </StyledView>

                        {/* Streak Protection Card */}
                        <StyledView
                            className="rounded-2xl p-4 mb-3 border border-orange-200 dark:border-orange-800"
                            style={{
                                backgroundColor: darkMode ? 'rgba(255, 247, 237, 0.1)' : '#fff7ed',
                                opacity: streaksEnabled ? 1 : 0.4
                            }}
                            pointerEvents={streaksEnabled ? 'auto' : 'none'}
                        >
                            <StyledView className="flex-row items-center mb-3">
                                <StyledView className="w-8 h-8 rounded-full items-center justify-center mr-2" style={{ backgroundColor: '#f97316' }}>
                                    <Flame size={18} color="#ffffff" />
                                </StyledView>
                                <ThemedText className="font-n-bold uppercase tracking-wide" style={{ color: darkMode ? '#fdba74' : '#9a3412' }} size="sm">
                                    Streak Protection
                                </ThemedText>
                            </StyledView>

                            <ToggleRow
                                label="Streak Saver Reminders"
                                subLabel="Show recovery popup"
                                value={streakSaverActive}
                                onToggle={toggleStreakSaver}
                                borderColor={borderColor}
                            />

                            {isPro ? (
                                <ToggleRow
                                    label="Holiday Protection Reminders"
                                    subLabel="Show holiday protection popup"
                                    value={holidaySaverActive}
                                    onToggle={toggleHolidaySaver}
                                    disabled={!streakSaverActive}
                                    borderColor={borderColor}
                                />
                            ) : (
                                <StyledTouchableOpacity
                                    onPress={() => router.push('/subscription')}
                                    className="flex-row justify-between items-center py-3 active:opacity-70 border-b last:border-0"
                                    style={{ minHeight: 60, borderColor: borderColor }}
                                >
                                    <StyledView className="flex-1 pr-3 justify-center">
                                        <StyledView className="flex-row items-center gap-2 mb-0.5">
                                            <ThemedText className="font-n-bold opacity-60" size="base">
                                                Holiday Protection Reminders
                                            </ThemedText>
                                            <StyledView className="px-2 py-0.5 rounded-full" style={{ backgroundColor: '#f97316' }}>
                                                <ThemedText className="text-white font-n-bold" size="xs">Pro</ThemedText>
                                            </StyledView>
                                        </StyledView>
                                        <ThemedText className="mt-0.5 opacity-60" size="sm" numberOfLines={1}>
                                            Upgrade to unlock
                                        </ThemedText>
                                    </StyledView>
                                    <Switch
                                        value={false}
                                        disabled={true}
                                        trackColor={{ false: '#cbd5e1', true: '#3b82f6' }}
                                        thumbColor={'#ffffff'}
                                    // Removed ios_backgroundColor manual override which was causing layering issues
                                    />
                                </StyledTouchableOpacity>
                            )}
                        </StyledView>

                        {/* Notifications Card */}
                        {isAuthenticated && (
                            <StyledView
                                className="rounded-2xl p-4 mb-3 border border-blue-200 dark:border-blue-800"
                                style={{ backgroundColor: darkMode ? 'rgba(219, 234, 254, 0.1)' : '#eff6ff' }}
                            >
                                <StyledView className="flex-row items-center mb-3">
                                    <StyledView className="w-8 h-8 rounded-full items-center justify-center mr-2" style={{ backgroundColor: '#7DAAE8' }}>
                                        <Bell size={18} color="#ffffff" />
                                    </StyledView>
                                    <ThemedText className="font-n-bold uppercase tracking-wide" style={{ color: darkMode ? '#93c5fd' : '#1e40af' }} size="sm">
                                        Notifications
                                    </ThemedText>
                                </StyledView>

                                {/* ── Daily Reminder ── */}
                                <ToggleRow
                                    label="Daily Reminder"
                                    subLabel="Get notified to play"
                                    value={reminderEnabled}
                                    onToggle={handleDailyReminderToggle}
                                    borderColor={borderColor}
                                />

                                {reminderEnabled && (
                                    <>
                                        <StyledTouchableOpacity
                                            onPress={() => setShowDailyTimePicker(true)}
                                            className="flex-row justify-between items-center py-3 border-b"
                                            style={{ minHeight: 52, borderColor }}
                                        >
                                            <StyledView className="flex-1 pr-3 justify-center">
                                                <ThemedText className="font-n-bold" size="base">
                                                    Reminder Time
                                                </ThemedText>
                                            </StyledView>
                                            <StyledView className="px-3 py-1.5 rounded-lg" style={{ backgroundColor: '#7DAAE8' }}>
                                                <ThemedText className="text-white font-n-bold" size="base">
                                                    {formatTimeDisplay(reminderTime || '09:00')}
                                                </ThemedText>
                                            </StyledView>
                                        </StyledTouchableOpacity>

                                        {showDailyTimePicker && DateTimePicker && (
                                            <View>
                                                {/* Confirm / Cancel buttons (iOS spinner has no built-in dismiss) */}
                                                {Platform.OS === 'ios' && (
                                                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 8, paddingBottom: 4 }}>
                                                        <TouchableOpacity
                                                            onPress={cancelDailyTime}
                                                            style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: '#d1d5db', alignItems: 'center', justifyContent: 'center' }}
                                                        >
                                                            <Text style={{ color: '#ffffff', fontSize: 18, fontWeight: '700', fontFamily: 'Nunito_700Bold' }}>✕</Text>
                                                        </TouchableOpacity>
                                                        <TouchableOpacity
                                                            onPress={confirmDailyTime}
                                                            style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: '#7DAAE8', alignItems: 'center', justifyContent: 'center' }}
                                                        >
                                                            <Text style={{ color: '#ffffff', fontSize: 18, fontWeight: '700', fontFamily: 'Nunito_700Bold' }}>✓</Text>
                                                        </TouchableOpacity>
                                                    </View>
                                                )}
                                                <DateTimePicker
                                                    value={pendingDailyTime || dailyTimeAsDate}
                                                    mode="time"
                                                    is24Hour={false}
                                                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                                                    onChange={handleDailyTimeChange}
                                                />
                                            </View>
                                        )}
                                    </>
                                )}

                                {/* ── Streak Reminder ── */}
                                <ToggleRow
                                    label="Streak Reminder"
                                    subLabel="Get notified when at risk of losing your streak"
                                    value={streakReminderEnabled}
                                    onToggle={handleStreakReminderToggle}
                                    borderColor={borderColor}
                                />

                                {streakReminderEnabled && (
                                    <>
                                        <StyledTouchableOpacity
                                            onPress={() => setShowStreakTimePicker(true)}
                                            className="flex-row justify-between items-center py-3"
                                            style={{ minHeight: 52 }}
                                        >
                                            <StyledView className="flex-1 pr-3 justify-center">
                                                <ThemedText className="font-n-bold" size="base">
                                                    Streak Time
                                                </ThemedText>
                                            </StyledView>
                                            <StyledView className="px-3 py-1.5 rounded-lg" style={{ backgroundColor: '#f97316' }}>
                                                <ThemedText className="text-white font-n-bold" size="base">
                                                    {formatTimeDisplay(streakReminderTime || '20:00')}
                                                </ThemedText>
                                            </StyledView>
                                        </StyledTouchableOpacity>

                                        {showStreakTimePicker && DateTimePicker && (
                                            <View>
                                                {/* Confirm / Cancel buttons (iOS spinner has no built-in dismiss) */}
                                                {Platform.OS === 'ios' && (
                                                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 8, paddingBottom: 4 }}>
                                                        <TouchableOpacity
                                                            onPress={cancelStreakTime}
                                                            style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: '#d1d5db', alignItems: 'center', justifyContent: 'center' }}
                                                        >
                                                            <Text style={{ color: '#ffffff', fontSize: 18, fontWeight: '700', fontFamily: 'Nunito_700Bold' }}>✕</Text>
                                                        </TouchableOpacity>
                                                        <TouchableOpacity
                                                            onPress={confirmStreakTime}
                                                            style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: '#f97316', alignItems: 'center', justifyContent: 'center' }}
                                                        >
                                                            <Text style={{ color: '#ffffff', fontSize: 18, fontWeight: '700', fontFamily: 'Nunito_700Bold' }}>✓</Text>
                                                        </TouchableOpacity>
                                                    </View>
                                                )}
                                                <DateTimePicker
                                                    value={pendingStreakTime || streakTimeAsDate}
                                                    mode="time"
                                                    is24Hour={false}
                                                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                                                    onChange={handleStreakTimeChange}
                                                />
                                            </View>
                                        )}
                                    </>
                                )}
                            </StyledView>
                        )}

                        {/* Guest Notice */}
                        {!isAuthenticated && (
                            <StyledView className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-3 border border-blue-200 dark:border-blue-800">
                                <ThemedText className="text-blue-900 dark:text-blue-100 text-center" size="sm">
                                    Sign in to sync settings across devices
                                </ThemedText>
                            </StyledView>
                        )}
                    </StyledView>
                </StyledScrollView>

                {/* Ad Banner */}
                <AdBanner />
            </ThemedView>
        </AdBannerContext.Provider>
    );
}
