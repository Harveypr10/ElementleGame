
import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, Switch } from 'react-native';
import { useRouter } from 'expo-router';
import { styled } from 'nativewind';
import { ChevronLeft, Flame } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useOptions, TextSize, DateLength, DateFormatOrder } from '../../lib/options';
import { useSubscription } from '../../hooks/useSubscription';
import { useAuth } from '../../lib/auth';

const StyledView = styled(View);
const StyledText = styled(Text);
const StyledScrollView = styled(ScrollView);
const StyledTouchableOpacity = styled(TouchableOpacity);

export default function OptionsScreen() {
    const router = useRouter();
    const { isAuthenticated } = useAuth();
    const { isPro } = useSubscription();
    const {
        textSize, setTextSize,
        soundsEnabled, toggleSounds,
        darkMode, toggleDarkMode,
        cluesEnabled, toggleClues,
        dateLength, setDateLength,
        dateFormatOrder, setDateFormatOrder,
        streakSaverActive, toggleStreakSaver,
        holidaySaverActive, toggleHolidaySaver
    } = useOptions();

    const ToggleRow = ({ label, subLabel, value, onToggle, disabled = false }: {
        label: string,
        subLabel: string,
        value: boolean,
        onToggle: () => void,
        disabled?: boolean
    }) => (
        <StyledView className="flex-row justify-between items-center py-2.5">
            <StyledView className="flex-1 pr-3">
                <StyledText className={`text-base font-n-bold ${disabled ? 'text-slate-400' : 'text-slate-900 dark:text-white'}`}>
                    {label}
                </StyledText>
                <StyledText className="text-sm text-slate-500 dark:text-slate-400">{subLabel}</StyledText>
            </StyledView>
            <Switch
                value={value}
                onValueChange={onToggle}
                disabled={disabled}
                trackColor={{ false: '#e2e8f0', true: '#3b82f6' }}
                thumbColor={'#ffffff'}
                ios_backgroundColor="#e2e8f0"
            />
        </StyledView>
    );

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
            {label && <StyledText className="text-base font-n-bold text-slate-900 dark:text-white mb-2">{label}</StyledText>}
            <StyledView className="flex-row gap-2">
                {options.map((opt) => {
                    const isSelected = opt.value === selected;
                    return (
                        <StyledTouchableOpacity
                            key={String(opt.value)}
                            onPress={() => onSelect(opt.value)}
                            className={`flex-1 py-2.5 rounded-xl border items-center justify-center ${isSelected
                                    ? 'bg-blue-500 border-blue-500'
                                    : 'bg-white border-slate-200 dark:bg-slate-700 dark:border-slate-600'
                                }`}
                        >
                            <StyledText className={`font-n-semibold ${isSelected ? 'text-white' : 'text-slate-600 dark:text-slate-300'
                                }`}>
                                {opt.label}
                            </StyledText>
                        </StyledTouchableOpacity>
                    );
                })}
            </StyledView>
        </StyledView>
    );

    return (
        <StyledView className="flex-1 bg-white dark:bg-slate-900">
            {/* Compact Header */}
            <SafeAreaView edges={['top']} className="bg-white dark:bg-slate-900">
                <StyledView className="flex-row items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-800">
                    <StyledTouchableOpacity
                        onPress={() => router.back()}
                        className="w-10 h-10 items-center justify-center"
                    >
                        <ChevronLeft size={24} color="#1e293b" />
                    </StyledTouchableOpacity>
                    <StyledText className="text-2xl font-n-bold text-slate-900 dark:text-white">Options</StyledText>
                    <StyledView className="w-10" />
                </StyledView>
            </SafeAreaView>

            <StyledScrollView className="flex-1 px-4 py-4" contentContainerStyle={{ paddingBottom: 40 }}>
                {/* Display Options Card */}
                <StyledView className="bg-white dark:bg-slate-800 rounded-2xl p-4 mb-3 border border-slate-100 dark:border-slate-700">
                    <StyledText className="text-sm font-n-bold text-slate-500 uppercase tracking-wide mb-3">Display</StyledText>

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
                    <ToggleRow
                        label="Dark Mode"
                        subLabel="Toggle dark theme"
                        value={darkMode}
                        onToggle={toggleDarkMode}
                    />
                </StyledView>

                {/* Gameplay Card */}
                <StyledView className="bg-white dark:bg-slate-800 rounded-2xl p-4 mb-3 border border-slate-100 dark:border-slate-700">
                    <StyledText className="text-sm font-n-bold text-slate-500 uppercase tracking-wide mb-3">Gameplay</StyledText>

                    <ToggleRow
                        label="Sounds"
                        subLabel="Play sound effects"
                        value={soundsEnabled}
                        onToggle={toggleSounds}
                    />

                    <ToggleRow
                        label="Clues"
                        subLabel="Show event titles"
                        value={cluesEnabled}
                        onToggle={toggleClues}
                    />
                </StyledView>

                {/* Date Format Card */}
                <StyledView className="bg-white dark:bg-slate-800 rounded-2xl p-4 mb-3 border border-slate-100 dark:border-slate-700">
                    <StyledText className="text-sm font-n-bold text-slate-500 uppercase tracking-wide mb-3">Date Format</StyledText>

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
                <StyledView className="rounded-2xl p-4 mb-3 border border-orange-200 dark:border-orange-800" style={{ backgroundColor: '#fff7ed' }}>
                    <StyledView className="flex-row items-center mb-3">
                        <StyledView className="w-8 h-8 rounded-full items-center justify-center mr-2" style={{ backgroundColor: '#f97316' }}>
                            <Flame size={18} color="#ffffff" />
                        </StyledView>
                        <StyledText className="text-sm font-n-bold uppercase tracking-wide" style={{ color: '#9a3412' }}>
                            Streak Protection
                        </StyledText>
                    </StyledView>

                    <ToggleRow
                        label="Streak Saver Reminders"
                        subLabel="Show recovery popup"
                        value={streakSaverActive}
                        onToggle={toggleStreakSaver}
                    />

                    <StyledView className="flex-row justify-between items-center py-2 mt-1">
                        <StyledView className="flex-1 pr-3">
                            <StyledView className="flex-row items-center gap-2 mb-1">
                                <StyledText className={`text-base font-n-bold ${!isPro ? 'text-slate-400' : 'text-slate-900 dark:text-white'}`}>
                                    Holiday Protection
                                </StyledText>
                                {!isPro && (
                                    <StyledView className="px-2 py-0.5 rounded-full" style={{ backgroundColor: '#f97316' }}>
                                        <StyledText className="text-white text-xs font-n-bold">Pro</StyledText>
                                    </StyledView>
                                )}
                            </StyledView>
                            <StyledText className="text-sm text-slate-600 dark:text-slate-400">
                                {isPro ? 'Pause streak while away' : 'Upgrade to unlock'}
                            </StyledText>
                        </StyledView>
                        <Switch
                            value={holidaySaverActive}
                            onValueChange={toggleHolidaySaver}
                            disabled={!isPro}
                            trackColor={{ false: '#e2e8f0', true: '#3b82f6' }}
                            thumbColor={'#ffffff'}
                            ios_backgroundColor="#e2e8f0"
                        />
                    </StyledView>
                </StyledView>

                {/* Guest Notice */}
                {!isAuthenticated && (
                    <StyledView className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-3 border border-blue-200 dark:border-blue-800">
                        <StyledText className="text-sm text-blue-900 dark:text-blue-100 text-center">
                            Sign in to sync settings across devices
                        </StyledText>
                    </StyledView>
                )}
            </StyledScrollView>
        </StyledView>
    );
}
