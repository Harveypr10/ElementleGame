import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { styled } from 'nativewind';
import { ChevronLeft, Crown, Flame, Umbrella } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSubscription } from '../hooks/useSubscription';
import { useStreakSaverStatus } from '../hooks/useStreakSaverStatus';
import { useProfile } from '../hooks/useProfile';
import { useOptions } from '../lib/options';
import { ThemedView } from '../components/ThemedView';
import { ThemedText } from '../components/ThemedText';
import { useThemeColor } from '../hooks/useThemeColor';
import { HolidayActivationModal } from '../components/game/HolidayActivationModal';
import { useUserStats } from '../hooks/useUserStats'; // Added for next_holiday_reset_date
import { format } from 'date-fns';

const StyledView = styled(View);
const StyledText = styled(Text);
const StyledTouchableOpacity = styled(TouchableOpacity);
const StyledScrollView = styled(ScrollView);

export default function ManageSubscriptionScreen() {
    const router = useRouter();
    const { subscription, isPro, tierType, streakSavers, holidaySavers, holidayDurationDays } = useSubscription();
    const { status, holidayActive, holidayStartDate, holidayEndDate, endHoliday, startHoliday, hasAnyValidStreakForHoliday } = useStreakSaverStatus();
    const { profile } = useProfile();
    const { textScale } = useOptions();
    const { stats: userStats } = useUserStats('USER');

    // [FIX] Separate animation states for Region and User modals
    const [regionAnimationVisible, setRegionAnimationVisible] = useState(false);
    const [userAnimationVisible, setUserAnimationVisible] = useState(false);
    const [regionFilledDates, setRegionFilledDates] = useState<string[]>([]);
    const [userFilledDates, setUserFilledDates] = useState<string[]>([]);

    const handleEndHoliday = () => {
        Alert.alert(
            'End Holiday Early?',
            'Are you sure you want to end your holiday? Your streak protection will stop immediately.',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'End Holiday',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await endHoliday(false);
                        } catch (error) {
                            console.error('Failed to end holiday:', error);
                            Alert.alert('Error', 'Failed to end holiday mode. Please try again.');
                        }
                    }
                }
            ]
        );
    };

    const handleStartHoliday = () => {
        if ((holidaySavers ?? 0) <= 0) {
            Alert.alert('No Holidays Remaining', 'You have used all your holiday allowances for this year.');
            return;
        }

        Alert.alert(
            'Start Holiday Mode?',
            `This will protect your streak for up to ${holidayDurationDays} days.`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Start Holiday',
                    onPress: async () => {
                        try {
                            const { regionDates, userDates } = await startHoliday();
                            console.log('[ManageSubscription] Holiday activated. Region dates:', regionDates, 'User dates:', userDates);

                            // [FIX] Store separate date arrays and show Region modal first
                            setRegionFilledDates(regionDates || []);
                            setUserFilledDates(userDates || []);
                            setRegionAnimationVisible(true);
                        } catch (error) {
                            console.error('Failed to start holiday:', error);
                            Alert.alert('Error', 'Failed to start holiday mode. Please try again.');
                        }
                    }
                }
            ]
        );
    };



    const regionLabel = profile?.region ? `${profile.region} Edition` : 'UK Edition';

    // Calculate allowances
    const regionUsed = status?.region?.streakSaversUsedMonth ?? 0;
    const userUsed = status?.user?.streakSaversUsedMonth ?? 0;
    const effectiveStreakSavers = streakSavers ?? (isPro ? 3 : 1);

    // Holiday calculations
    const holidaysUsed = status?.user?.holidaysUsedYear ?? 0;
    const holidaysTotal = holidaySavers ?? 0;
    const holidaysRemaining = Math.max(0, holidaysTotal - holidaysUsed);

    const formatDate = (dateStr: string | null): string => {
        if (!dateStr) return 'N/A';
        const date = new Date(dateStr);
        return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    };

    const backgroundColor = useThemeColor({}, 'background');
    const surfaceColor = useThemeColor({}, 'surface');
    const borderColor = useThemeColor({}, 'border');
    const textColor = useThemeColor({}, 'text');
    const iconColor = useThemeColor({}, 'icon');

    if (!isPro) {
        // Standard user view - encourage upgrade
        return (
            <ThemedView className="flex-1">
                <SafeAreaView edges={['top']} style={{ backgroundColor: surfaceColor }}>
                    <StyledView
                        className="flex-row items-center justify-between px-4 py-3"
                        style={{ backgroundColor: surfaceColor }}
                    >
                        <StyledTouchableOpacity
                            onPress={() => router.back()}
                            className="w-10 h-10 items-center justify-center"
                        >
                            <ChevronLeft size={28} color={iconColor} />
                        </StyledTouchableOpacity>
                        <ThemedText baseSize={20} className="font-n-bold">Subscription</ThemedText>
                        <StyledView className="w-10" />
                    </StyledView>
                </SafeAreaView>

                <StyledScrollView className="flex-1" contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 16 }}>
                    <StyledView className="w-full max-w-3xl self-center">
                        {/* Standard Tier Card */}
                        <StyledView
                            className="rounded-2xl p-4 mb-3 border"
                            style={{ backgroundColor: surfaceColor, borderColor: borderColor }}
                        >
                            <StyledView className="flex-row items-center mb-2">
                                <StyledView className="w-12 h-12 rounded-full items-center justify-center mr-3" style={{ backgroundColor: backgroundColor }}>
                                    <Crown size={24} color="#64748b" />
                                </StyledView>
                                <StyledView className="flex-1">
                                    <ThemedText baseSize={14} className="opacity-60">Subscription</ThemedText>
                                    <ThemedText baseSize={20} className="font-n-bold">Standard</ThemedText>
                                </StyledView>
                            </StyledView>
                        </StyledView>

                        {/* Allowances Card */}
                        <StyledView
                            className="rounded-2xl p-4 mb-3 border"
                            style={{ backgroundColor: surfaceColor, borderColor: borderColor }}
                        >
                            <ThemedText baseSize={14} className="font-n-bold uppercase tracking-wide mb-3 opacity-60">Your Allowances</ThemedText>

                            {/* Streak Savers */}
                            <StyledView className="flex-row items-start mb-3">
                                <StyledView className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900/30 items-center justify-center mr-3">
                                    <Flame size={20} color="#f59e0b" />
                                </StyledView>
                                <StyledView className="flex-1">
                                    <ThemedText baseSize={16} className="font-n-bold mb-1">Streak Savers</ThemedText>
                                    <ThemedText baseSize={14} className="opacity-80 mb-1">
                                        {regionLabel}: <ThemedText className="font-n-semibold">{Math.max(0, effectiveStreakSavers - regionUsed)} of {effectiveStreakSavers} remaining</ThemedText>
                                    </ThemedText>
                                    <ThemedText baseSize={14} className="opacity-80">
                                        Personal: <ThemedText className="font-n-semibold">{Math.max(0, effectiveStreakSavers - userUsed)} of {effectiveStreakSavers} remaining</ThemedText>
                                    </ThemedText>
                                </StyledView>
                            </StyledView>

                            {/* Holiday Mode - Locked */}
                            <StyledView className="flex-row items-start">
                                <StyledView className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 items-center justify-center mr-3">
                                    <Umbrella size={20} color="#3b82f6" />
                                </StyledView>
                                <StyledView className="flex-1">
                                    <ThemedText baseSize={16} className="font-n-bold opacity-50 mb-1">Holiday Mode</ThemedText>
                                    <ThemedText baseSize={14} className="opacity-60">{holidayDurationDays}-day protection: Locked</ThemedText>
                                    <ThemedText baseSize={12} className="opacity-50 mt-1">Pro members can pause their streak</ThemedText>
                                </StyledView>
                            </StyledView>
                        </StyledView>

                        {/* Upgrade Button */}
                        <StyledTouchableOpacity
                            onPress={() => router.push('/subscription')}
                            className="rounded-2xl p-4 flex-row items-center justify-center"
                            style={{ backgroundColor: '#fb923c' }}
                        >
                            <Crown size={20} color="#ffffff" />
                            <StyledText className="text-base font-n-bold text-white ml-2">
                                Go Pro to increase your allowances
                            </StyledText>
                        </StyledTouchableOpacity>
                    </StyledView>
                </StyledScrollView>
            </ThemedView>
        );
    }

    // Pro user view
    return (
        <ThemedView className="flex-1">
            <SafeAreaView edges={['top']} style={{ backgroundColor: surfaceColor }}>
                <StyledView
                    className="flex-row items-center justify-between px-4 py-3 border-b"
                    style={{ backgroundColor: surfaceColor, borderColor: borderColor }}
                >
                    <StyledTouchableOpacity
                        onPress={() => router.back()}
                        className="w-10 h-10 items-center justify-center"
                    >
                        <ChevronLeft size={28} color={iconColor} />
                    </StyledTouchableOpacity>
                    <ThemedText size="xl" className="font-n-bold">Subscription</ThemedText>
                    <StyledView className="w-10" />
                </StyledView>
            </SafeAreaView>

            <StyledScrollView className="flex-1" contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 16 }}>
                <StyledView className="w-full max-w-3xl self-center">
                    {/* Subscription Tier Card */}
                    <StyledView className="rounded-2xl p-4 mb-3" style={{ backgroundColor: '#fb923c' }}>
                        <StyledView className="flex-row items-center mb-2">
                            <StyledView className="w-12 h-12 rounded-full items-center justify-center mr-3" style={{ backgroundColor: 'rgba(255,255,255,0.2)' }}>
                                <Crown size={24} color="#ffffff" />
                            </StyledView>
                            <StyledView className="flex-1">
                                <StyledText className="text-sm text-white opacity-80">Subscription</StyledText>
                                <StyledText className="text-xl font-n-bold text-white">
                                    {tierType === 'lifetime' ? 'Pro - Lifetime' :
                                        tierType === 'annual' ? 'Pro - Annual' :
                                            tierType === 'monthly' ? 'Pro - Monthly' : 'Pro'}
                                </StyledText>
                            </StyledView>
                        </StyledView>

                        {tierType !== 'lifetime' && subscription?.endDate && (
                            <StyledView className="flex-row items-center justify-between mt-2 pt-2 border-t border-white/20">
                                <StyledView>
                                    <StyledText className="text-sm text-white opacity-80">Renews on</StyledText>
                                    <StyledText className="text-base font-n-semibold text-white">{formatDate(subscription.endDate)}</StyledText>
                                </StyledView>
                            </StyledView>
                        )}

                        {tierType === 'lifetime' && (
                            <StyledView className="mt-2 pt-2 border-t border-white/20">
                                <StyledText className="text-sm text-white opacity-90">Never expires</StyledText>
                            </StyledView>
                        )}
                    </StyledView>

                    {/* Allowances Card */}
                    <StyledView
                        className="rounded-2xl p-4 mb-3 border"
                        style={{ backgroundColor: surfaceColor, borderColor: borderColor }}
                    >
                        <ThemedText size="sm" className="font-n-bold uppercase tracking-wide mb-3 opacity-60">Your Allowances</ThemedText>

                        {/* Streak Savers */}
                        <StyledView className="flex-row items-start mb-3">
                            <StyledView className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900/30 items-center justify-center mr-3">
                                <Flame size={20} color="#f59e0b" />
                            </StyledView>
                            <StyledView className="flex-1">
                                <ThemedText size="base" className="font-n-bold mb-1">Streak Savers</ThemedText>
                                <ThemedText size="sm" className="opacity-80 mb-1">
                                    {regionLabel}: <ThemedText className="font-n-semibold">{Math.max(0, effectiveStreakSavers - regionUsed)} of {effectiveStreakSavers} remaining</ThemedText>
                                </ThemedText>
                                <ThemedText size="sm" className="opacity-80">
                                    Personal: <ThemedText className="font-n-semibold">{Math.max(0, effectiveStreakSavers - userUsed)} of {effectiveStreakSavers} remaining</ThemedText>
                                </ThemedText>
                            </StyledView>
                        </StyledView>

                        {/* Holiday Mode */}
                        <StyledView className="flex-row items-start">
                            <StyledView className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 items-center justify-center mr-3">
                                <Umbrella size={20} color="#3b82f6" />
                            </StyledView>
                            <StyledView className="flex-1">
                                <ThemedText size="base" className="font-n-bold mb-1">Holiday Mode</ThemedText>
                                <ThemedText size="sm" className="opacity-80">
                                    {holidayDurationDays}-day protection: <ThemedText className="font-n-semibold">{holidaysRemaining} of {holidaysTotal} remaining</ThemedText>
                                </ThemedText>
                            </StyledView>
                        </StyledView>
                    </StyledView>

                    {/* Holiday Mode Control */}
                    <StyledView
                        className="rounded-2xl p-4 border"
                        style={{ backgroundColor: useThemeColor({ dark: '#1e3a8a20', light: '#eff6ff' }, 'background'), borderColor: useThemeColor({ dark: '#1e3a8a', light: '#bfdbfe' }, 'border') }}
                    >
                        <StyledView className="flex-row items-center mb-2">
                            <Umbrella size={20} color="#2563eb" style={{ marginRight: 8 }} />
                            <ThemedText size="lg" className="font-n-bold" style={{ color: '#2563eb' }}>Holiday Mode</ThemedText>
                        </StyledView>
                        <ThemedText size="sm" className="mb-3 opacity-80" style={{ color: '#1e40af' }}>
                            {holidayActive ? 'Your streak is protected' : `Protect your streak for up to ${holidayDurationDays} days`}
                        </ThemedText>

                        {holidayActive ? (
                            <StyledView>
                                <StyledView className="flex-row justify-between mb-2">
                                    <ThemedText size="sm" style={{ color: '#1d4ed8' }}>Started:</ThemedText>
                                    <ThemedText size="sm" className="font-n-semibold" style={{ color: '#1e3a8a' }}>{formatDate(holidayStartDate)}</ThemedText>
                                </StyledView>
                                <StyledView className="flex-row justify-between mb-3">
                                    <ThemedText size="sm" style={{ color: '#1d4ed8' }}>Ends:</ThemedText>
                                    <ThemedText size="sm" className="font-n-semibold" style={{ color: '#1e3a8a' }}>{formatDate(holidayEndDate)}</ThemedText>
                                </StyledView>
                                <StyledTouchableOpacity
                                    onPress={handleEndHoliday}
                                    className="bg-white rounded-xl py-3 px-4 border border-blue-300"
                                >
                                    <StyledText className="text-center font-n-bold text-blue-600">End Holiday Early</StyledText>
                                </StyledTouchableOpacity>
                            </StyledView>
                        ) : (
                            <StyledView>
                                {/* Disabled State Logic: Either no streak OR no allowance */}
                                {(hasAnyValidStreakForHoliday && holidaysRemaining > 0) ? (
                                    <StyledTouchableOpacity
                                        onPress={handleStartHoliday}
                                        className="bg-blue-600 rounded-xl py-3 px-4"
                                    >
                                        <StyledText className="text-center font-n-bold text-white">
                                            Start holiday mode
                                        </StyledText>
                                    </StyledTouchableOpacity>
                                ) : (
                                    <StyledView className="bg-slate-100 dark:bg-slate-800 rounded-xl py-3 px-4 opacity-70">
                                        <StyledText className="text-center font-n-bold text-slate-500 dark:text-slate-400">
                                            {!hasAnyValidStreakForHoliday
                                                ? 'No streak to protect'
                                                // [FIX] Use next_holiday_reset_date format
                                                : `Holiday mode allowance will reset on ${userStats?.next_holiday_reset_date ? format(new Date(userStats.next_holiday_reset_date), profile?.date_format_preference === 'mmddyy' || profile?.date_format_preference === 'mmddyyyy' ? 'MM/dd/yyyy' : 'dd/MM/yyyy') : '...'}`
                                            }
                                        </StyledText>
                                    </StyledView>
                                )}
                            </StyledView>
                        )}
                    </StyledView>
                </StyledView>
            </StyledScrollView>

            {/* [FIX] Region Animation Modal - Shows First */}
            <HolidayActivationModal
                visible={regionAnimationVisible}
                filledDates={regionFilledDates}
                gameType="REGION"
                onClose={() => {
                    setRegionAnimationVisible(false);
                    // [FIX] Delay User modal to let iOS finish Region modal fade-out animation
                    console.log('[ManageSubscription] Region modal closed, scheduling User modal');
                    setTimeout(() => {
                        console.log('[ManageSubscription] Showing User modal');
                        setUserAnimationVisible(true);
                    }, 500);
                }}
            />

            {/* [FIX] User Animation Modal - Shows Second */}
            <HolidayActivationModal
                visible={userAnimationVisible}
                filledDates={userFilledDates}
                gameType="USER"
                onClose={() => {
                    setUserAnimationVisible(false);
                    console.log('[ManageSubscription] User modal closed, holiday activation complete');
                }}
            />
        </ThemedView>
    );
}
