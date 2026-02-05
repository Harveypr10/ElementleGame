import React from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { styled } from 'nativewind';
import {
    ChevronLeft,
    ChevronRight,
    User,
    Crown,
    Grid,
    Flame,
    Settings as SettingsIcon,
    Bug,
    MessageSquare,
    Info,
    Lock,
    FileText,
    LogOut,
    Shield,
    SlidersHorizontal
} from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '../../components/ThemedText';
import { ThemedView } from '../../components/ThemedView';
import { useSettingsScreenLogic } from '../../hooks/useSettingsScreenLogic';

const StyledView = styled(View);
const StyledTouchableOpacity = styled(TouchableOpacity);
const StyledScrollView = styled(ScrollView);

export default function SettingsScreen() {
    const {
        user,
        isAuthenticated,
        isAdmin,
        isPro,
        textScale,
        signingOut,
        handleSignOut,
        handleAccountInfo,
        handleProManage,
        handleGoProClick,
        handleCategories,
        handleStreakSaver,
        handleOptions,
        handleBugReport,
        handleFeedback,
        handleAbout,
        handlePrivacy,
        handleTerms,
        handleAdmin,
        router,
        colors
    } = useSettingsScreenLogic();

    return (
        <ThemedView className="flex-1">
            {/* Compact Header */}
            <SafeAreaView edges={['top']} style={{ backgroundColor: colors.surface }}>
                <StyledView
                    className="flex-row items-center justify-between px-4 py-3"
                    style={{ backgroundColor: colors.surface, flexDirection: 'row' }}
                >
                    <StyledView className="flex-row items-center justify-center relative flex-1" style={{ flexDirection: 'row' }}>
                        <StyledTouchableOpacity
                            onPress={() => router.back()}
                            className="absolute left-0 z-10 p-2"
                        >
                            <ChevronLeft size={28} color={colors.icon} />
                        </StyledTouchableOpacity>
                        <ThemedText size="2xl" className="font-n-bold text-center">
                            Settings
                        </ThemedText>
                    </StyledView>
                </StyledView>
            </SafeAreaView>

            <StyledScrollView
                className="flex-1"
                contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 16, alignItems: 'center' }}
            >
                <StyledView className="w-full" style={{ maxWidth: 768, alignSelf: 'center' }}>
                    {/* Group 1: Account, Subscription & Options */}
                    <StyledView
                        className="rounded-2xl p-4 mb-3 border"
                        style={{ backgroundColor: colors.surface, borderColor: colors.border }}
                    >
                        {/* Account Info */}
                        <StyledTouchableOpacity
                            onPress={handleAccountInfo}
                            className="flex-row items-center py-3"
                            style={{ flexDirection: 'row' }}
                        >
                            <StyledView className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 items-center justify-center">
                                <User size={20} color="#2563eb" />
                            </StyledView>
                            <StyledView className="flex-1 ml-3">
                                <ThemedText style={{ fontSize: 16 * textScale }} className="font-n-bold">Account</ThemedText>
                                <ThemedText style={{ fontSize: 14 * textScale, color: colors.secondaryText }}>
                                    {user?.email || 'Not signed in'}
                                </ThemedText>
                            </StyledView>
                            <ChevronRight size={20} color="#94a3b8" />
                        </StyledTouchableOpacity>

                        {/* Pro Badge or Go Pro */}
                        {isPro ? (
                            <StyledTouchableOpacity
                                onPress={handleProManage}
                                className="flex-row items-center py-3 mt-1 rounded-xl px-3"
                                style={{ backgroundColor: '#fb923c', flexDirection: 'row' }}
                            >
                                <StyledView className="w-10 h-10 rounded-full items-center justify-center" style={{ backgroundColor: 'rgba(255,255,255,0.2)' }}>
                                    <Crown size={20} color="#ffffff" />
                                </StyledView>
                                <StyledView className="flex-1 ml-3">
                                    <Text style={{ fontSize: 16 * textScale }} className="font-n-bold text-white">Pro</Text>
                                    <Text style={{ fontSize: 14 * textScale }} className="text-white opacity-80">Manage subscription</Text>
                                </StyledView>
                                <ChevronRight size={20} color="#ffffff" />
                            </StyledTouchableOpacity>
                        ) : (
                            <StyledTouchableOpacity
                                onPress={handleGoProClick}
                                className="flex-row items-center py-3 mt-1 rounded-xl px-3 border-2 border-amber-400"
                                style={{ backgroundColor: colors.goProBg, flexDirection: 'row' }}
                            >
                                <StyledView className="w-10 h-10 rounded-full bg-amber-100 items-center justify-center">
                                    <Crown size={20} color="#d97706" />
                                </StyledView>
                                <StyledView className="flex-1 ml-3">
                                    <Text style={{ fontSize: 16 * textScale }} className="font-n-bold text-amber-900 dark:text-amber-100">Go Pro</Text>
                                    <Text style={{ fontSize: 14 * textScale }} className="text-amber-700 dark:text-amber-300">Unlock all features</Text>
                                </StyledView>
                                <ChevronRight size={20} color="#d97706" />
                            </StyledTouchableOpacity>
                        )}

                        {/* Pro Only: Select Categories */}
                        {isPro && (
                            <StyledTouchableOpacity
                                onPress={handleCategories}
                                className="flex-row items-center py-3 mt-1"
                                style={{ flexDirection: 'row' }}
                            >
                                <StyledView className="w-10 h-10 rounded-full bg-orange-100 dark:bg-orange-900/30 items-center justify-center">
                                    <Grid size={20} color="#ea580c" />
                                </StyledView>
                                <StyledView className="flex-1 ml-3">
                                    <ThemedText style={{ fontSize: 16 * textScale }} className="font-n-bold">Categories</ThemedText>
                                    <ThemedText style={{ fontSize: 14 * textScale, color: colors.secondaryText }}>Customize your puzzles</ThemedText>
                                </StyledView>
                                <ChevronRight size={20} color="#94a3b8" />
                            </StyledTouchableOpacity>
                        )}

                        {/* Standard Users: Streak Saver */}
                        {!isPro && isAuthenticated && (
                            <StyledTouchableOpacity
                                onPress={handleStreakSaver}
                                className="flex-row items-center py-3 mt-1"
                                style={{ flexDirection: 'row' }}
                            >
                                <StyledView className="w-10 h-10 rounded-full bg-orange-100 dark:bg-orange-900/30 items-center justify-center">
                                    <Flame size={20} color="#f97316" />
                                </StyledView>
                                <StyledView className="flex-1 ml-3">
                                    <ThemedText style={{ fontSize: 16 * textScale }} className="font-n-bold">Streak Savers</ThemedText>
                                    <ThemedText style={{ fontSize: 14 * textScale, color: colors.secondaryText }}>View your allowances</ThemedText>
                                </StyledView>
                                <ChevronRight size={20} color="#94a3b8" />
                            </StyledTouchableOpacity>
                        )}

                        {/* Options (Moved from Preferences) */}
                        <StyledTouchableOpacity
                            onPress={handleOptions}
                            className="flex-row items-center py-3 mt-1"
                            style={{ flexDirection: 'row' }}
                        >
                            <StyledView className="w-10 h-10 rounded-full bg-purple-100 dark:bg-purple-900/30 items-center justify-center">
                                <SlidersHorizontal size={20} color="#9333ea" />
                            </StyledView>
                            <StyledView className="flex-1 ml-3">
                                <ThemedText style={{ fontSize: 16 * textScale }} className="font-n-bold">Options</ThemedText>
                                <ThemedText style={{ fontSize: 14 * textScale, color: colors.secondaryText }}>Display, Sound & Gameplay</ThemedText>
                            </StyledView>
                            <ChevronRight size={20} color="#94a3b8" />
                        </StyledTouchableOpacity>
                    </StyledView>

                    {/* Group 3: Help & Legal */}
                    <StyledView
                        className="rounded-2xl p-4 mb-3 border"
                        style={{ backgroundColor: colors.surface, borderColor: colors.border }}
                    >
                        <ThemedText style={{ fontSize: 14 * textScale, color: colors.secondaryText }} className="font-n-bold uppercase tracking-wide mb-2">Help & Info</ThemedText>

                        <StyledTouchableOpacity onPress={handleBugReport} className="flex-row items-center py-2.5" style={{ flexDirection: 'row' }}>
                            <Bug size={18} color="#64748b" />
                            <ThemedText style={{ fontSize: 16 * textScale }} className="flex-1 ml-3 font-n-medium">Report a Bug</ThemedText>
                            <ChevronRight size={18} color="#94a3b8" />
                        </StyledTouchableOpacity>

                        <StyledTouchableOpacity onPress={handleFeedback} className="flex-row items-center py-2.5" style={{ flexDirection: 'row' }}>
                            <MessageSquare size={18} color="#64748b" />
                            <ThemedText style={{ fontSize: 16 * textScale }} className="flex-1 ml-3 font-n-medium">Feedback</ThemedText>
                            <ChevronRight size={18} color="#94a3b8" />
                        </StyledTouchableOpacity>

                        <StyledView className="h-px my-1" style={{ backgroundColor: colors.border }} />

                        <StyledTouchableOpacity onPress={handleAbout} className="flex-row items-center py-2.5" style={{ flexDirection: 'row' }}>
                            <Info size={18} color="#64748b" />
                            <ThemedText style={{ fontSize: 16 * textScale }} className="flex-1 ml-3 font-n-medium">About</ThemedText>
                            <ChevronRight size={18} color="#94a3b8" />
                        </StyledTouchableOpacity>

                        <StyledTouchableOpacity onPress={handlePrivacy} className="flex-row items-center py-2.5" style={{ flexDirection: 'row' }}>
                            <Lock size={18} color="#64748b" />
                            <ThemedText style={{ fontSize: 16 * textScale }} className="flex-1 ml-3 font-n-medium">Privacy</ThemedText>
                            <ChevronRight size={18} color="#94a3b8" />
                        </StyledTouchableOpacity>

                        <StyledTouchableOpacity onPress={handleTerms} className="flex-row items-center py-2.5" style={{ flexDirection: 'row' }}>
                            <FileText size={18} color="#64748b" />
                            <ThemedText style={{ fontSize: 16 * textScale }} className="flex-1 ml-3 font-n-medium">Terms</ThemedText>
                            <ChevronRight size={18} color="#94a3b8" />
                        </StyledTouchableOpacity>
                    </StyledView>

                    {/* Group 4: Admin (Conditional) */}
                    {isAdmin && (
                        <StyledTouchableOpacity
                            onPress={handleAdmin}
                            className="rounded-2xl p-4 mb-3 flex-row items-center"
                            style={{ backgroundColor: '#dc2626', flexDirection: 'row' }}
                        >
                            <StyledView className="w-10 h-10 rounded-full items-center justify-center" style={{ backgroundColor: 'rgba(255,255,255,0.2)' }}>
                                <Shield size={20} color="#ffffff" />
                            </StyledView>
                            <StyledView className="flex-1 ml-3">
                                <Text style={{ fontSize: 16 * textScale }} className="font-n-bold text-white">Admin Panel</Text>
                                <Text style={{ fontSize: 14 * textScale }} className="text-white opacity-80">Manage application</Text>
                            </StyledView>
                            <ChevronRight size={20} color="#ffffff" />
                        </StyledTouchableOpacity>
                    )}

                    {/* Sign Out Button */}
                    {isAuthenticated && (
                        <StyledTouchableOpacity
                            onPress={handleSignOut}
                            disabled={signingOut}
                            className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-2xl p-4 mt-2 flex-row items-center justify-center"
                            style={{ flexDirection: 'row' }}
                        >
                            <LogOut size={20} color="#dc2626" />
                            <Text style={{ fontSize: 16 * textScale }} className="font-n-bold text-red-600 dark:text-red-400 ml-2">
                                {signingOut ? 'Signing Out...' : 'Sign Out'}
                            </Text>
                        </StyledTouchableOpacity>
                    )}
                </StyledView>
            </StyledScrollView>
        </ThemedView>
    );
}
