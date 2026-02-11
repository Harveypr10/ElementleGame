/**
 * options.web.tsx
 * Web implementation for Options screen
 */

import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView, Switch } from 'react-native';
import { useRouter } from 'expo-router';
import { ChevronLeft, Flame, Settings, CalendarDays, Monitor, GamepadIcon, Crown } from 'lucide-react-native';
import { useOptions, TextSize, DateLength, DateFormatOrder } from '../../lib/options';
import { useSubscription } from '../../hooks/useSubscription';
import { useAuth } from '../../lib/auth';
import { useThemeColor } from '../../hooks/useThemeColor';

export default function OptionsWeb() {
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
        holidaySaverActive, toggleHolidaySaver,
        quickMenuEnabled, toggleQuickMenu
    } = useOptions();

    const surfaceColor = useThemeColor({}, 'surface');
    const borderColor = useThemeColor({}, 'border');
    const textColor = useThemeColor({}, 'text');

    // Hover states
    const [backHover, setBackHover] = useState(false);
    const [upgradeHover, setUpgradeHover] = useState(false);

    const handleBack = () => {
        router.back();
    };

    return (
        <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
            <View style={styles.contentWrapper}>
                {/* Header */}
                <View style={styles.header}>
                    <Pressable
                        onPress={handleBack}
                        onHoverIn={() => setBackHover(true)}
                        onHoverOut={() => setBackHover(false)}
                        style={[styles.backButton, backHover && styles.backButtonHover]}
                    >
                        <ChevronLeft size={24} color="#334155" />
                        <Text style={styles.backButtonText}>Settings</Text>
                    </Pressable>
                    <Text style={styles.title}>Options</Text>
                    <View style={{ width: 80 }} />
                </View>

                {/* Display Card */}
                <View style={styles.card}>
                    <View style={styles.cardHeader}>
                        <Monitor size={18} color="#6366f1" />
                        <Text style={styles.cardTitle}>Display</Text>
                    </View>

                    {/* Text Size */}
                    <View style={styles.settingSection}>
                        <Text style={styles.settingLabel}>Text Size</Text>
                        <SegmentControl
                            options={[
                                { label: 'Small', value: 'small' as TextSize },
                                { label: 'Medium', value: 'medium' as TextSize },
                                { label: 'Large', value: 'large' as TextSize },
                            ]}
                            selected={textSize}
                            onSelect={setTextSize}
                        />
                    </View>

                    <ToggleRow
                        label="Dark Mode"
                        subLabel="Use dark theme"
                        value={darkMode}
                        onToggle={toggleDarkMode}
                    />

                    <ToggleRow
                        label="Quick Menu"
                        subLabel="Show navigation shortcuts"
                        value={quickMenuEnabled}
                        onToggle={toggleQuickMenu}
                    />
                </View>

                {/* Gameplay Card */}
                <View style={styles.card}>
                    <View style={styles.cardHeader}>
                        <GamepadIcon size={18} color="#22c55e" />
                        <Text style={styles.cardTitle}>Gameplay</Text>
                    </View>

                    <ToggleRow
                        label="Sound Effects"
                        subLabel="Play sounds during game"
                        value={soundsEnabled}
                        onToggle={toggleSounds}
                    />

                    <ToggleRow
                        label="Clues"
                        subLabel="Show event titles on cards"
                        value={cluesEnabled}
                        onToggle={toggleClues}
                    />
                </View>

                {/* Date Format Card */}
                <View style={styles.card}>
                    <View style={styles.cardHeader}>
                        <CalendarDays size={18} color="#3b82f6" />
                        <Text style={styles.cardTitle}>Date Format</Text>
                    </View>

                    <View style={styles.settingSection}>
                        <Text style={styles.settingLabel}>Digit Length</Text>
                        <SegmentControl
                            options={[
                                { label: '6 Digits', value: 6 as DateLength },
                                { label: '8 Digits', value: 8 as DateLength },
                            ]}
                            selected={dateLength}
                            onSelect={setDateLength}
                        />
                    </View>

                    <View style={styles.settingSection}>
                        <Text style={styles.settingLabel}>Format Order</Text>
                        <SegmentControl
                            options={[
                                { label: 'DD/MM/YY', value: 'ddmmyy' as DateFormatOrder },
                                { label: 'MM/DD/YY', value: 'mmddyy' as DateFormatOrder },
                            ]}
                            selected={dateFormatOrder}
                            onSelect={setDateFormatOrder}
                        />
                    </View>
                </View>

                {/* Streak Protection Card */}
                <View style={styles.streakCard}>
                    <View style={styles.cardHeader}>
                        <View style={styles.streakIcon}>
                            <Flame size={16} color="#ffffff" />
                        </View>
                        <Text style={styles.streakCardTitle}>Streak Protection</Text>
                    </View>

                    <ToggleRow
                        label="Streak Saver Reminders"
                        subLabel="Show recovery popup when streak is at risk"
                        value={streakSaverActive}
                        onToggle={toggleStreakSaver}
                        isStreakCard
                    />

                    {isPro ? (
                        <ToggleRow
                            label="Holiday Protection Reminders"
                            subLabel="Show holiday protection popup"
                            value={holidaySaverActive}
                            onToggle={toggleHolidaySaver}
                            disabled={!streakSaverActive}
                            isStreakCard
                        />
                    ) : (
                        <Pressable
                            onPress={() => router.push('/subscription')}
                            onHoverIn={() => setUpgradeHover(true)}
                            onHoverOut={() => setUpgradeHover(false)}
                            style={[styles.upgradeRow, upgradeHover && styles.upgradeRowHover]}
                        >
                            <View style={styles.upgradeInfo}>
                                <View style={styles.upgradeLabel}>
                                    <Text style={styles.upgradeLabelText}>Holiday Protection Reminders</Text>
                                    <View style={styles.proBadge}>
                                        <Crown size={10} color="#ffffff" />
                                        <Text style={styles.proBadgeText}>PRO</Text>
                                    </View>
                                </View>
                                <Text style={styles.upgradeSubLabel}>Upgrade to unlock</Text>
                            </View>
                            <Switch
                                value={false}
                                disabled
                                trackColor={{ false: '#d1d5db' }}
                            />
                        </Pressable>
                    )}
                </View>

                {/* Guest Notice */}
                {!isAuthenticated && (
                    <View style={styles.guestNotice}>
                        <Text style={styles.guestNoticeText}>
                            Sign in to sync settings across devices
                        </Text>
                    </View>
                )}
            </View>
        </ScrollView>
    );
}

// ============================================================
// COMPONENTS
// ============================================================

interface ToggleRowProps {
    label: string;
    subLabel: string;
    value: boolean;
    onToggle: () => void;
    disabled?: boolean;
    isStreakCard?: boolean;
}

function ToggleRow({ label, subLabel, value, onToggle, disabled = false, isStreakCard }: ToggleRowProps) {
    const [hover, setHover] = useState(false);

    return (
        <Pressable
            onPress={!disabled ? onToggle : undefined}
            onHoverIn={() => setHover(true)}
            onHoverOut={() => setHover(false)}
            disabled={disabled}
            style={[
                styles.toggleRow,
                hover && styles.toggleRowHover,
                disabled && styles.toggleRowDisabled,
            ]}
        >
            <View style={styles.toggleInfo}>
                <Text style={[
                    styles.toggleLabel,
                    isStreakCard && styles.toggleLabelStreak,
                    disabled && styles.toggleLabelDisabled
                ]}>{label}</Text>
                <Text style={[
                    styles.toggleSubLabel,
                    isStreakCard && styles.toggleSubLabelStreak,
                    disabled && styles.toggleSubLabelDisabled
                ]}>{subLabel}</Text>
            </View>
            <Switch
                value={value}
                onValueChange={onToggle}
                disabled={disabled}
                trackColor={{ false: '#e2e8f0', true: '#3b82f6' }}
                thumbColor="#ffffff"
            />
        </Pressable>
    );
}

interface SegmentControlProps<T extends string | number> {
    options: { label: string; value: T }[];
    selected: T;
    onSelect: (val: T) => void;
}

function SegmentControl<T extends string | number>({ options, selected, onSelect }: SegmentControlProps<T>) {
    return (
        <View style={styles.segmentContainer}>
            {options.map((opt) => {
                const isSelected = opt.value === selected;
                return (
                    <SegmentButton
                        key={String(opt.value)}
                        label={opt.label}
                        selected={isSelected}
                        onPress={() => onSelect(opt.value)}
                    />
                );
            })}
        </View>
    );
}

function SegmentButton({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
    const [hover, setHover] = useState(false);

    return (
        <Pressable
            onPress={onPress}
            onHoverIn={() => setHover(true)}
            onHoverOut={() => setHover(false)}
            style={[
                styles.segmentButton,
                selected && styles.segmentButtonSelected,
                hover && !selected && styles.segmentButtonHover,
            ]}
        >
            <Text style={[
                styles.segmentButtonText,
                selected && styles.segmentButtonTextSelected,
            ]}>{label}</Text>
        </Pressable>
    );
}

// ============================================================
// STYLES
// ============================================================

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F8FAFC',
    },
    scrollContent: {
        alignItems: 'center',
        paddingTop: 40,
        paddingBottom: 80,
        minHeight: '100%' as any,
    },
    contentWrapper: {
        width: '100%',
        maxWidth: 480,
        paddingHorizontal: 16,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 24,
    },
    backButton: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 8,
        borderRadius: 8,
    },
    backButtonHover: {
        backgroundColor: '#E2E8F0',
    },
    backButtonText: {
        fontFamily: 'Nunito_600SemiBold',
        color: '#334155',
        fontSize: 16,
        marginLeft: 4,
    },
    title: {
        fontFamily: 'Nunito_700Bold',
        fontSize: 22,
        color: '#0f172a',
    },
    card: {
        backgroundColor: '#FFFFFF',
        borderRadius: 20,
        padding: 20,
        marginBottom: 16,
        shadowColor: '#64748B',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.08,
        shadowRadius: 16,
    },
    cardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 16,
    },
    cardTitle: {
        fontFamily: 'Nunito_700Bold',
        fontSize: 12,
        color: '#94a3b8',
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    streakCard: {
        backgroundColor: '#fff7ed',
        borderRadius: 20,
        padding: 20,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: '#fed7aa',
    },
    streakIcon: {
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: '#f97316',
        alignItems: 'center',
        justifyContent: 'center',
    },
    streakCardTitle: {
        fontFamily: 'Nunito_700Bold',
        fontSize: 12,
        color: '#9a3412',
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    settingSection: {
        marginBottom: 16,
    },
    settingLabel: {
        fontFamily: 'Nunito_600SemiBold',
        fontSize: 15,
        color: '#0f172a',
        marginBottom: 8,
    },
    segmentContainer: {
        flexDirection: 'row',
        gap: 8,
    },
    segmentButton: {
        flex: 1,
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderRadius: 12,
        backgroundColor: '#f1f5f9',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#e2e8f0',
    },
    segmentButtonSelected: {
        backgroundColor: '#3b82f6',
        borderColor: '#3b82f6',
    },
    segmentButtonHover: {
        backgroundColor: '#e2e8f0',
    },
    segmentButtonText: {
        fontFamily: 'Nunito_600SemiBold',
        fontSize: 14,
        color: '#475569',
    },
    segmentButtonTextSelected: {
        color: '#ffffff',
    },
    toggleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 14,
        paddingHorizontal: 4,
        borderRadius: 8,
        marginHorizontal: -4,
    },
    toggleRowHover: {
        backgroundColor: 'rgba(0,0,0,0.02)',
    },
    toggleRowDisabled: {
        opacity: 0.5,
    },
    toggleInfo: {
        flex: 1,
        paddingRight: 12,
    },
    toggleLabel: {
        fontFamily: 'Nunito_700Bold',
        fontSize: 15,
        color: '#0f172a',
    },
    toggleLabelStreak: {
        color: '#7c2d12',
    },
    toggleLabelDisabled: {
        opacity: 0.6,
    },
    toggleSubLabel: {
        fontFamily: 'Nunito_500Medium',
        fontSize: 13,
        color: '#64748b',
        marginTop: 2,
    },
    toggleSubLabelStreak: {
        color: '#9a3412',
    },
    toggleSubLabelDisabled: {
        opacity: 0.6,
    },
    upgradeRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 14,
        paddingHorizontal: 8,
        borderRadius: 12,
        marginHorizontal: -4,
    },
    upgradeRowHover: {
        backgroundColor: 'rgba(249, 115, 22, 0.1)',
    },
    upgradeInfo: {
        flex: 1,
    },
    upgradeLabel: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    upgradeLabelText: {
        fontFamily: 'Nunito_700Bold',
        fontSize: 15,
        color: '#7c2d12',
        opacity: 0.6,
    },
    proBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f97316',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 6,
        gap: 3,
    },
    proBadgeText: {
        fontFamily: 'Nunito_700Bold',
        fontSize: 9,
        color: '#ffffff',
    },
    upgradeSubLabel: {
        fontFamily: 'Nunito_500Medium',
        fontSize: 13,
        color: '#9a3412',
        opacity: 0.6,
        marginTop: 2,
    },
    guestNotice: {
        backgroundColor: '#eff6ff',
        borderRadius: 12,
        padding: 16,
        borderWidth: 1,
        borderColor: '#bfdbfe',
    },
    guestNoticeText: {
        fontFamily: 'Nunito_600SemiBold',
        fontSize: 14,
        color: '#1e40af',
        textAlign: 'center',
    },
});
