import React from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { styled } from 'nativewind';
import { ChevronLeft, Crown, Calendar, Flame, Umbrella } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSubscription } from '../hooks/useSubscription';
import { useStreakSaverStatus } from '../hooks/useStreakSaverStatus';
import { useProfile } from '../hooks/useProfile';

const StyledView = styled(View);
const StyledText = styled(Text);
const StyledTouchableOpacity = styled(TouchableOpacity);
const StyledScrollView = styled(ScrollView);

export default function ManageSubscriptionScreen() {
    const router = useRouter();
    const { subscription, isPro, tierName, tierType, streakSavers, holidaySavers, holidayDurationDays } = useSubscription();
    const { status, holidayActive, holidayStartDate, holidayEndDate } = useStreakSaverStatus();
    const { profile } = useProfile();

    const regionLabel = profile?.region ? `${profile.region} Edition` : 'UK Edition';

    // Calculate allowances
    const regionUsed = status?.region?.streakSaversUsedMonth ?? 0;
    const userUsed = status?.user?.streakSaversUsedMonth ?? 0;
    const effectiveStreakSavers = streakSavers ?? (isPro ? 3 : 1);

    const formatDate = (dateStr: string | null): string => {
        if (!dateStr) return 'N/A';
        const date = new Date(dateStr);
        return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    };

    if (!isPro) {
        // Standard user view - encourage upgrade
        return (
            <StyledView className="flex-1 bg-white dark:bg-slate-900">
                <SafeAreaView edges={['top']} className="bg-white dark:bg-slate-900">
                    <StyledView className="flex-row items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-800">
                        <StyledTouchableOpacity
                            onPress={() => router.back()}
                            className="w-10 h-10 items-center justify-center"
                        >
                            <ChevronLeft size={24} color="#1e293b" />
                        </StyledTouchableOpacity>
                        <StyledText className="text-xl font-n-bold text-slate-900 dark:text-white">Subscription</StyledText>
                        <StyledView className="w-10" />
                    </StyledView>
                </SafeAreaView>

                <StyledScrollView className="flex-1 px-4 py-4">
                    {/* Standard Tier Card */}
                    <StyledView className="bg-white dark:bg-slate-800 rounded-2xl p-4 mb-3 border border-slate-100 dark:border-slate-700">
                        <StyledView className="flex-row items-center mb-2">
                            <StyledView className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-700 items-center justify-center mr-3">
                                <Crown size={24} color="#64748b" />
                            </StyledView>
                            <StyledView className="flex-1">
                                <StyledText className="text-sm text-slate-500">Subscription</StyledText>
                                <StyledText className="text-xl font-n-bold text-slate-900 dark:text-white">Standard</StyledText>
                            </StyledView>
                        </StyledView>
                    </StyledView>

                    {/* Allowances Card */}
                    <StyledView className="bg-white dark:bg-slate-800 rounded-2xl p-4 mb-3 border border-slate-100 dark:border-slate-700">
                        <StyledText className="text-sm font-n-bold text-slate-500 uppercase tracking-wide mb-3">Your Allowances</StyledText>

                        {/* Streak Savers */}
                        <StyledView className="flex-row items-start mb-3">
                            <StyledView className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900/30 items-center justify-center mr-3">
                                <Flame size={20} color="#f59e0b" />
                            </StyledView>
                            <StyledView className="flex-1">
                                <StyledText className="text-base font-n-bold text-slate-900 dark:text-white mb-1">Streak Savers</StyledText>
                                <StyledText className="text-sm text-slate-600 dark:text-slate-400 mb-1">
                                    {regionLabel}: <StyledText className="font-n-semibold">{Math.max(0, 1 - regionUsed)} of 1 remaining</StyledText>
                                </StyledText>
                                <StyledText className="text-sm text-slate-600 dark:text-slate-400">
                                    Personal: <StyledText className="font-n-semibold">{Math.max(0, 1 - userUsed)} of 1 remaining</StyledText>
                                </StyledText>
                            </StyledView>
                        </StyledView>

                        {/* Holiday Mode - Locked */}
                        <StyledView className="flex-row items-start">
                            <StyledView className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 items-center justify-center mr-3">
                                <Umbrella size={20} color="#3b82f6" />
                            </StyledView>
                            <StyledView className="flex-1">
                                <StyledText className="text-base font-n-bold text-slate-400 mb-1">Holiday Mode</StyledText>
                                <StyledText className="text-sm text-slate-500">14-day protection: 0 of 0 remaining</StyledText>
                                <StyledText className="text-xs text-slate-400 mt-1">Pro members can pause their streak</StyledText>
                            </StyledView>
                        </StyledView>
                    </StyledView>

                    {/* Upgrade Button */}
                    <StyledTouchableOpacity className="rounded-2xl p-4 flex-row items-center justify-center" style={{ backgroundColor: '#fb923c' }}>
                        <Crown size={20} color="#ffffff" />
                        <StyledText className="text-base font-n-bold text-white ml-2">
                            Go Pro to increase your allowances
                        </StyledText>
                    </StyledTouchableOpacity>
                </StyledScrollView>
            </StyledView>
        );
    }

    // Pro user view
    return (
        <StyledView className="flex-1 bg-white dark:bg-slate-900">
            <SafeAreaView edges={['top']} className="bg-white dark:bg-slate-900">
                <StyledView className="flex-row items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-800">
                    <StyledTouchableOpacity
                        onPress={() => router.back()}
                        className="w-10 h-10 items-center justify-center"
                    >
                        <ChevronLeft size={24} color="#1e293b" />
                    </StyledTouchableOpacity>
                    <StyledText className="text-xl font-n-bold text-slate-900 dark:text-white">Subscription</StyledText>
                    <StyledView className="w-10" />
                </StyledView>
            </SafeAreaView>

            <StyledScrollView className="flex-1 px-4 py-4">
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
                <StyledView className="bg-white dark:bg-slate-800 rounded-2xl p-4 mb-3 border border-slate-100 dark:border-slate-700">
                    <StyledText className="text-sm font-n-bold text-slate-500 uppercase tracking-wide mb-3">Your Allowances</StyledText>

                    {/* Streak Savers */}
                    <StyledView className="flex-row items-start mb-3">
                        <StyledView className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900/30 items-center justify-center mr-3">
                            <Flame size={20} color="#f59e0b" />
                        </StyledView>
                        <StyledView className="flex-1">
                            <StyledText className="text-base font-n-bold text-slate-900 dark:text-white mb-1">Streak Savers</StyledText>
                            <StyledText className="text-sm text-slate-600 dark:text-slate-400 mb-1">
                                {regionLabel}: <StyledText className="font-n-semibold">{Math.max(0, effectiveStreakSavers - regionUsed)} of {effectiveStreakSavers} remaining</StyledText>
                            </StyledText>
                            <StyledText className="text-sm text-slate-600 dark:text-slate-400">
                                Personal: <StyledText className="font-n-semibold">{Math.max(0, effectiveStreakSavers - userUsed)} of {effectiveStreakSavers} remaining</StyledText>
                            </StyledText>
                        </StyledView>
                    </StyledView>

                    {/* Holiday Mode */}
                    <StyledView className="flex-row items-start">
                        <StyledView className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 items-center justify-center mr-3">
                            <Umbrella size={20} color="#3b82f6" />
                        </StyledView>
                        <StyledView className="flex-1">
                            <StyledText className="text-base font-n-bold text-slate-900 dark:text-white mb-1">Holiday Mode</StyledText>
                            <StyledText className="text-sm text-slate-600 dark:text-slate-400">
                                {holidayDurationDays}-day protection: <StyledText className="font-n-semibold">{holidaySavers} of {holidaySavers} remaining</StyledText>
                            </StyledText>
                        </StyledView>
                    </StyledView>
                </StyledView>

                {/* Holiday Mode Control */}
                <StyledView className="bg-blue-50 dark:bg-blue-900/20 rounded-2xl p-4 border border-blue-200 dark:border-blue-800">
                    <StyledView className="flex-row items-center mb-2">
                        <Umbrella size={20} color="#2563eb" style={{ marginRight: 8 }} />
                        <StyledText className="text-lg font-n-bold text-blue-900 dark:text-blue-100">Holiday Mode</StyledText>
                    </StyledView>
                    <StyledText className="text-sm text-blue-800 dark:text-blue-200 mb-3">
                        {holidayActive ? 'Your streak is protected' : `Protect your streak for up to ${holidayDurationDays} days`}
                    </StyledText>

                    {holidayActive ? (
                        <StyledView>
                            <StyledView className="flex-row justify-between mb-2">
                                <StyledText className="text-sm text-blue-700 dark:text-blue-300">Started:</StyledText>
                                <StyledText className="text-sm font-n-semibold text-blue-900 dark:text-blue-100">{formatDate(holidayStartDate)}</StyledText>
                            </StyledView>
                            <StyledView className="flex-row justify-between mb-3">
                                <StyledText className="text-sm text-blue-700 dark:text-blue-300">Ends:</StyledText>
                                <StyledText className="text-sm font-n-semibold text-blue-900 dark:text-blue-100">{formatDate(holidayEndDate)}</StyledText>
                            </StyledView>
                            <StyledTouchableOpacity className="bg-white rounded-xl py-3 px-4 border border-blue-300">
                                <StyledText className="text-center font-n-bold text-blue-600">End Holiday Early</StyledText>
                            </StyledTouchableOpacity>
                        </StyledView>
                    ) : (
                        <StyledTouchableOpacity className="bg-blue-600 rounded-xl py-3 px-4">
                            <StyledText className="text-center font-n-bold text-white">Start Holiday Mode</StyledText>
                        </StyledTouchableOpacity>
                    )}
                </StyledView>
            </StyledScrollView>
        </StyledView>
    );
}
