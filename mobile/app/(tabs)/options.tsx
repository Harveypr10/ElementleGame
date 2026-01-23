
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

const StyledView = styled(View);
const StyledScrollView = styled(ScrollView);
const StyledTouchableOpacity = styled(TouchableOpacity);

export default function OptionsScreen() {
    const router = useRouter();
    const { isAuthenticated } = useAuth();
    const { isPro } = useSubscription();
    const { colorScheme } = useColorScheme();
    const {
        textSize, setTextSize, textScale,
        soundsEnabled, toggleSounds,
        darkMode, toggleDarkMode,
        cluesEnabled, toggleClues,
        dateLength, setDateLength,
        dateFormatOrder, setDateFormatOrder,
        streakSaverActive, toggleStreakSaver,
        holidaySaverActive, toggleHolidaySaver
    } = useOptions();

    // Use ToggleRow for all toggles to avoid overlay rendering issues
    const ToggleRow = ({ label, subLabel, value, onToggle, disabled = false }: {
        label: string,
        subLabel: string,
        value: boolean,
        onToggle: () => void,
        disabled?: boolean
    }) => {
        const isDark = colorScheme === 'dark';

        return (
            <StyledTouchableOpacity
                onPress={!disabled ? onToggle : undefined}
                className="flex-row justify-between items-center py-3 active:opacity-70 border-b border-gray-100 dark:border-gray-800 last:border-0"
                style={{ minHeight: 60 }}
                disabled={disabled}
            >
                <StyledView className="flex-1 pr-3 justify-center">
                    <ThemedText className={`font-n-bold ${disabled ? 'text-slate-400' : 'text-slate-900 dark:text-white'}`} size="base">
                        {label}
                    </ThemedText>
                    {subLabel && (
                        <ThemedText className="text-slate-500 dark:text-slate-400 mt-0.5" size="sm" numberOfLines={1}>
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
        label
    }: {
        options: { label: string, value: T }[],
        selected: T,
        onSelect: (val: T) => void,
        label?: string
    }) => (
        <StyledView className="mb-3">
            {label && <ThemedText className="font-n-bold text-slate-900 dark:text-white mb-2" size="base">{label}</ThemedText>}
            <StyledView className="flex-row gap-2">
                {options.map((opt) => {
                    const isSelected = opt.value === selected;
                    return (
                        <StyledTouchableOpacity
                            key={String(opt.value)}
                            onPress={() => onSelect(opt.value)}
                            style={{ minHeight: 48 }}
                            className={`flex-1 py-3 rounded-xl border items-center justify-center ${isSelected
                                ? 'bg-blue-500 border-blue-500'
                                : 'bg-white border-slate-200 dark:bg-slate-700 dark:border-slate-600'
                                }`}
                        >
                            <ThemedText className={`font-n-semibold ${isSelected ? 'text-white' : 'text-slate-600 dark:text-slate-300'
                                }`} size="sm">
                                {opt.label}
                            </ThemedText>
                        </StyledTouchableOpacity>
                    );
                })}
            </StyledView>
        </StyledView>
    );

    return (
        <AdBannerContext.Provider value={true}>
            <StyledView className="flex-1 bg-white dark:bg-slate-900" style={{ paddingBottom: 50 }}>
                {/* Compact Header */}
                <SafeAreaView edges={['top']} className="bg-white dark:bg-slate-900">
                    <StyledView className="flex-row items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-800">
                        <StyledTouchableOpacity
                            onPress={() => router.back()}
                            className="w-10 h-10 items-center justify-center"
                        >
                            <ChevronLeft size={28} color={colorScheme === 'dark' ? '#ffffff' : '#1e293b'} />
                        </StyledTouchableOpacity>
                        <ThemedText className="font-n-bold text-slate-900 dark:text-white" size="2xl">Options</ThemedText>
                        <StyledView className="w-10" />
                    </StyledView>
                </SafeAreaView>

                <StyledScrollView className="flex-1 px-4 py-4" contentContainerStyle={{ paddingBottom: 40 }}>
                    {/* Display Options Card */}
                    <StyledView className="bg-white dark:bg-slate-800 rounded-2xl p-4 mb-3 border border-slate-100 dark:border-slate-700">
                        <ThemedText className="font-n-bold text-slate-500 uppercase tracking-wide mb-3" size="sm">Display</ThemedText>

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
                        />

                        {/* Dark Mode */}
                        <ToggleRow label="Dark Mode" subLabel="Toggle dark theme" value={darkMode} onToggle={toggleDarkMode} />
                    </StyledView>

                    {/* Gameplay Card */}
                    <StyledView className="bg-white dark:bg-slate-800 rounded-2xl p-4 mb-3 border border-slate-100 dark:border-slate-700">
                        <ThemedText className="font-n-bold text-slate-500 uppercase tracking-wide mb-3" size="sm">Gameplay</ThemedText>

                        <ToggleRow label="Sounds" subLabel="Play sound effects" value={soundsEnabled} onToggle={toggleSounds} />

                        <ToggleRow label="Clues" subLabel="Show event titles" value={cluesEnabled} onToggle={toggleClues} />
                    </StyledView>

                    {/* Date Format Card */}
                    <StyledView className="bg-white dark:bg-slate-800 rounded-2xl p-4 mb-3 border border-slate-100 dark:border-slate-700">
                        <ThemedText className="font-n-bold text-slate-500 uppercase tracking-wide mb-3" size="sm">Date Format</ThemedText>

                        <SegmentControl<DateLength>
                            label="Digit Length"
                            selected={dateLength}
                            onSelect={setDateLength}
                            options={[
                                { label: '6 Digits', value: 6 },
                                { label: '8 Digits', value: 8 },
                            ]}
                        />

                        <SegmentControl<DateFormatOrder>
                            label="Format Order"
                            selected={dateFormatOrder}
                            onSelect={setDateFormatOrder}
                            options={[
                                { label: 'DD/MM/YY', value: 'ddmmyy' },
                                { label: 'MM/DD/YY', value: 'mmddyy' },
                            ]}
                        />
                    </StyledView>

                    {/* Streak Protection Card */}
                    <StyledView className="rounded-2xl p-4 mb-3 border border-orange-200 dark:border-orange-800" style={{ backgroundColor: colorScheme === 'dark' ? 'rgba(255, 247, 237, 0.1)' : '#fff7ed' }}>
                        <StyledView className="flex-row items-center mb-3">
                            <StyledView className="w-8 h-8 rounded-full items-center justify-center mr-2" style={{ backgroundColor: '#f97316' }}>
                                <Flame size={18} color="#ffffff" />
                            </StyledView>
                            <ThemedText className="font-n-bold uppercase tracking-wide" style={{ color: colorScheme === 'dark' ? '#fdba74' : '#9a3412' }} size="sm">
                                Streak Protection
                            </ThemedText>
                        </StyledView>

                        <ToggleRow label="Streak Saver Reminders" subLabel="Show recovery popup" value={streakSaverActive} onToggle={toggleStreakSaver} />

                        {isPro ? (
                            <ToggleRow
                                label="Holiday Protection"
                                subLabel="Pause streak while away"
                                value={holidaySaverActive}
                                onToggle={toggleHolidaySaver}
                            />
                        ) : (
                            <StyledTouchableOpacity
                                onPress={() => router.push('/subscription')}
                                className="flex-row justify-between items-center py-2.5 mt-1 active:opacity-70"
                            >
                                <StyledView className="flex-1 pr-3">
                                    <StyledView className="flex-row items-center gap-2 mb-1">
                                        <ThemedText className="font-n-bold text-slate-400" size="base">
                                            Holiday Protection
                                        </ThemedText>
                                        <StyledView className="px-2 py-0.5 rounded-full" style={{ backgroundColor: '#f97316' }}>
                                            <ThemedText className="text-white font-n-bold" size="xs">Pro</ThemedText>
                                        </StyledView>
                                    </StyledView>
                                    <ThemedText className="text-slate-600 dark:text-slate-400" size="sm">
                                        Upgrade to unlock
                                    </ThemedText>
                                </StyledView>
                                <Switch
                                    value={false}
                                    disabled={true}
                                    trackColor={{ false: '#e2e8f0', true: '#3b82f6' }}
                                    thumbColor={'#ffffff'}
                                    ios_backgroundColor={colorScheme === 'dark' ? '#334155' : '#e2e8f0'}
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
            </StyledView>
        </AdBannerContext.Provider>
    );
}
