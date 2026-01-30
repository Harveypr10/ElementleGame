
import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Switch } from 'react-native';
import { useRouter } from 'expo-router';
import { styled, useColorScheme } from 'nativewind';
import { ChevronLeft, Flame } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useOptions, TextSize, DateLength, DateFormatOrder } from '../../lib/options';
import { useSubscription } from '../../hooks/useSubscription';
import { useAuth } from '../../lib/auth';
import { AdBanner } from '../../components/AdBanner';
import { AdBannerContext } from '../../contexts/AdBannerContext';

import { ThemedText } from '../../components/ThemedText';
import { ThemedView } from '../../components/ThemedView';
import { useThemeColor } from '../../hooks/useThemeColor';

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
    borderColor
}: {
    label: string,
    subLabel: string,
    value: boolean,
    onToggle: () => void,
    disabled?: boolean,
    borderColor: string
}) => {
    return (
        <StyledTouchableOpacity
            onPress={!disabled ? onToggle : undefined}
            className="flex-row justify-between items-center py-3 active:opacity-70 border-b last:border-0"
            style={{ minHeight: 60, borderColor: borderColor }}
            disabled={disabled}
        >
            <StyledView className="flex-1 pr-3 justify-center">
                <ThemedText className={`font-n-bold ${disabled ? 'opacity-50' : ''}`} size="base">
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
                onValueChange={onToggle}
                disabled={disabled}
                trackColor={{ false: '#e2e8f0', true: '#3b82f6' }}
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

export default function OptionsScreen() {
    const router = useRouter();
    const { isAuthenticated } = useAuth();
    const { isPro } = useSubscription();
    const { colorScheme } = useColorScheme();
    const {
        textSize, setTextSize,
        soundsEnabled, toggleSounds,
        darkMode, toggleDarkMode,
        cluesEnabled, toggleClues,
        dateLength, setDateLength,
        dateFormatOrder, setDateFormatOrder,
        streakSaverActive, toggleStreakSaver,
        holidaySaverActive, toggleHolidaySaver,
        quickMenuEnabled, toggleQuickMenu
    } = useOptions();

    const iconColor = useThemeColor({}, 'icon');
    const surfaceColor = useThemeColor({}, 'surface');
    const borderColor = useThemeColor({}, 'border');
    const textColor = useThemeColor({}, 'text');

    return (
        <AdBannerContext.Provider value={true}>
            <ThemedView className="flex-1" style={{ paddingBottom: 0 }}>
                <SafeAreaView edges={['top']} style={{ backgroundColor: surfaceColor }}>
                    <StyledView
                        className="flex-row items-center justify-between px-4 py-3"
                        style={{ backgroundColor: surfaceColor }}
                    >
                        <StyledView className="flex-row items-center justify-center relative flex-1">
                            <StyledTouchableOpacity
                                onPress={() => router.back()}
                                className="absolute left-0 z-10 p-2"
                            >
                                <ChevronLeft size={28} color={iconColor} />
                            </StyledTouchableOpacity>
                            <ThemedText size="2xl" className="font-n-bold text-center">
                                Options
                            </ThemedText>
                        </StyledView>
                    </StyledView>
                </SafeAreaView>

                <StyledScrollView className="flex-1 px-4 py-4" contentContainerStyle={{ paddingBottom: 100 }}>
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

                        {/* Dark Mode */}
                        <ToggleRow
                            label="Dark Mode"
                            subLabel="Toggle dark theme"
                            value={darkMode}
                            onToggle={toggleDarkMode}
                            borderColor={borderColor}
                        />

                        {/* Quick Menu */}
                        <ToggleRow
                            label="Quick Menu"
                            subLabel="Show navigation menu"
                            value={quickMenuEnabled}
                            onToggle={toggleQuickMenu}
                            borderColor={borderColor}
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
                                { label: 'DD/MM/YY', value: 'ddmmyy' },
                                { label: 'MM/DD/YY', value: 'mmddyy' },
                            ]}
                            surfaceColor={surfaceColor}
                            borderColor={borderColor}
                            textColor={textColor}
                        />
                    </StyledView>

                    {/* Streak Protection Card */}
                    <StyledView
                        className="rounded-2xl p-4 mb-3 border border-orange-200 dark:border-orange-800"
                        style={{ backgroundColor: darkMode ? 'rgba(255, 247, 237, 0.1)' : '#fff7ed' }}
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
                                label="Holiday Protection"
                                subLabel="Pause streak while away"
                                value={holidaySaverActive}
                                onToggle={toggleHolidaySaver}
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
                                            Holiday Protection
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
                                    trackColor={{ false: '#e2e8f0', true: '#3b82f6' }}
                                    thumbColor={'#ffffff'}
                                // Removed ios_backgroundColor manual override which was causing layering issues
                                />
                            </StyledTouchableOpacity>
                        )}
                    </StyledView>

                    {/* Guest Notice */}
                    {!isAuthenticated && (
                        <StyledView className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-3 border border-blue-200 dark:border-blue-800">
                            <ThemedText className="text-blue-900 dark:text-blue-100 text-center" size="sm">
                                Sign in to sync settings across devices
                            </ThemedText>
                        </StyledView>
                    )}
                </StyledScrollView>

                {/* Ad Banner */}
                <AdBanner />
            </ThemedView>
        </AdBannerContext.Provider>
    );
}
