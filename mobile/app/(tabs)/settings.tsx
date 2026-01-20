import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { useRouter } from 'expo-router';
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
    Shield
} from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../lib/auth';
import { useProfile } from '../../hooks/useProfile';
import { useSubscription } from '../../hooks/useSubscription';
import { useOptions } from '../../lib/options';

const StyledView = styled(View);
const StyledText = styled(Text);
const StyledTouchableOpacity = styled(TouchableOpacity);
const StyledScrollView = styled(ScrollView);

export default function SettingsScreen() {
    const router = useRouter();
    const { user, isAuthenticated, signOut } = useAuth();
    const { profile, isAdmin } = useProfile();
    const { isPro, tierName, tierType } = useSubscription();
    const { textScale } = useOptions();

    const [signingOut, setSigningOut] = useState(false);

    const handleSignOut = async () => {
        Alert.alert(
            'Sign Out',
            'Are you sure you want to sign out?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Sign Out',
                    style: 'destructive',
                    onPress: async () => {
                        setSigningOut(true);
                        try {
                            await signOut();
                            router.replace('/(auth)/onboarding');
                        } catch (error) {
                            console.error('[Settings] Sign out error:', error);
                            Alert.alert('Error', 'Failed to sign out. Please try again.');
                        } finally {
                            setSigningOut(false);
                        }
                    },
                },
            ]
        );
    };

    const handleAccountInfo = () => {
        if (!isAuthenticated) {
            Alert.alert('Sign In Required', 'Please sign in to view account information.');
            return;
        }
        router.push('/settings/account-info');
    };

    const handleProManage = () => {
        // TODO: Navigate to manage subscription
        router.push('/manage-subscription');
    };

    const handleGoProClick = () => {
        // TODO: Show Pro upgrade dialog
        Alert.alert('Go Pro', 'Pro subscription coming soon!');
    };

    const handleCategories = () => {
        router.push('/category-selection');
    };

    const handleStreakSaver = () => {
        // For Standard users, show manage subscription (limited view)
        router.push('/manage-subscription');
    };

    const handleOptions = () => {
        router.push('/(tabs)/options');
    };

    const handleBugReport = () => {
        router.push('/bug-report');
    };

    const handleFeedback = () => {
        router.push('/feedback');
    };

    const handleAbout = () => {
        router.push('/about');
    };

    const handlePrivacy = () => {
        router.push('/privacy');
    };

    const handleTerms = () => {
        router.push('/terms');
    };

    const handleAdmin = () => {
        Alert.alert('Admin', 'Admin panel coming soon!');
    };

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
                    <StyledText style={{ fontSize: 24 * textScale }} className="font-n-bold text-slate-900 dark:text-white">Settings</StyledText>
                    <StyledView className="w-10" />
                </StyledView>
            </SafeAreaView>

            <StyledScrollView className="flex-1 px-4 py-4">
                {/* Group 1: Account & Subscription */}
                <StyledView className="bg-white dark:bg-slate-800 rounded-2xl p-4 mb-3 border border-slate-100 dark:border-slate-700">
                    {/* Account Info */}
                    <StyledTouchableOpacity
                        onPress={handleAccountInfo}
                        className="flex-row items-center py-3"
                    >
                        <StyledView className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 items-center justify-center">
                            <User size={20} color="#2563eb" />
                        </StyledView>
                        <StyledView className="flex-1 ml-3">
                            <StyledText style={{ fontSize: 16 * textScale }} className="font-n-bold text-slate-900 dark:text-white">Account</StyledText>
                            <StyledText style={{ fontSize: 14 * textScale }} className="text-slate-500">
                                {user?.email || 'Not signed in'}
                            </StyledText>
                        </StyledView>
                        <ChevronRight size={20} color="#94a3b8" />
                    </StyledTouchableOpacity>

                    {/* Pro Badge or Go Pro */}
                    {isPro ? (
                        <StyledTouchableOpacity
                            onPress={handleProManage}
                            className="flex-row items-center py-3 mt-1 rounded-xl px-3"
                            style={{ backgroundColor: '#fb923c' }}
                        >
                            <StyledView className="w-10 h-10 rounded-full items-center justify-center" style={{ backgroundColor: 'rgba(255,255,255,0.2)' }}>
                                <Crown size={20} color="#ffffff" />
                            </StyledView>
                            <StyledView className="flex-1 ml-3">
                                <StyledText style={{ fontSize: 16 * textScale }} className="font-n-bold text-white">Pro</StyledText>
                                <StyledText style={{ fontSize: 14 * textScale }} className="text-white opacity-80">Manage subscription</StyledText>
                            </StyledView>
                            <ChevronRight size={20} color="#ffffff" />
                        </StyledTouchableOpacity>
                    ) : (
                        <StyledTouchableOpacity
                            onPress={handleGoProClick}
                            className="flex-row items-center py-3 mt-1 bg-amber-50 dark:bg-amber-900/20 rounded-xl px-3 border-2 border-amber-400"
                        >
                            <StyledView className="w-10 h-10 rounded-full bg-amber-100 items-center justify-center">
                                <Crown size={20} color="#d97706" />
                            </StyledView>
                            <StyledView className="flex-1 ml-3">
                                <StyledText style={{ fontSize: 16 * textScale }} className="font-n-bold text-amber-900 dark:text-amber-100">Go Pro</StyledText>
                                <StyledText style={{ fontSize: 14 * textScale }} className="text-amber-700 dark:text-amber-300">Unlock all features</StyledText>
                            </StyledView>
                            <ChevronRight size={20} color="#d97706" />
                        </StyledTouchableOpacity>
                    )}

                    {/* Pro Only: Select Categories */}
                    {isPro && (
                        <StyledTouchableOpacity
                            onPress={handleCategories}
                            className="flex-row items-center py-3 mt-1"
                        >
                            <StyledView className="w-10 h-10 rounded-full bg-orange-100 dark:bg-orange-900/30 items-center justify-center">
                                <Grid size={20} color="#ea580c" />
                            </StyledView>
                            <StyledView className="flex-1 ml-3">
                                <StyledText style={{ fontSize: 16 * textScale }} className="font-n-bold text-slate-900 dark:text-white">Categories</StyledText>
                                <StyledText style={{ fontSize: 14 * textScale }} className="text-slate-500">Customize your puzzles</StyledText>
                            </StyledView>
                            <ChevronRight size={20} color="#94a3b8" />
                        </StyledTouchableOpacity>
                    )}

                    {/* Standard Users: Streak Saver */}
                    {!isPro && isAuthenticated && (
                        <StyledTouchableOpacity
                            onPress={handleStreakSaver}
                            className="flex-row items-center py-3 mt-1"
                        >
                            <StyledView className="w-10 h-10 rounded-full bg-orange-100 dark:bg-orange-900/30 items-center justify-center">
                                <Flame size={20} color="#f97316" />
                            </StyledView>
                            <StyledView className="flex-1 ml-3">
                                <StyledText style={{ fontSize: 16 * textScale }} className="font-n-bold text-slate-900 dark:text-white">Streak Savers</StyledText>
                                <StyledText style={{ fontSize: 14 * textScale }} className="text-slate-500">View your allowances</StyledText>
                            </StyledView>
                            <ChevronRight size={20} color="#94a3b8" />
                        </StyledTouchableOpacity>
                    )}
                </StyledView>

                {/* Group 2: Preferences */}
                <StyledView className="bg-white dark:bg-slate-800 rounded-2xl p-4 mb-3 border border-slate-100 dark:border-slate-700">
                    <StyledText style={{ fontSize: 14 * textScale }} className="font-n-bold text-slate-500 uppercase tracking-wide mb-2">Preferences</StyledText>

                    <StyledTouchableOpacity
                        onPress={handleOptions}
                        className="flex-row items-center py-3"
                    >
                        <SettingsIcon size={20} color="#64748b" />
                        <StyledText style={{ fontSize: 16 * textScale }} className="flex-1 ml-3 font-n-medium text-slate-900 dark:text-white">Options</StyledText>
                        <ChevronRight size={20} color="#94a3b8" />
                    </StyledTouchableOpacity>
                </StyledView>

                {/* Group 3: Help & Legal */}
                <StyledView className="bg-white dark:bg-slate-800 rounded-2xl p-4 mb-3 border border-slate-100 dark:border-slate-700">
                    <StyledText style={{ fontSize: 14 * textScale }} className="font-n-bold text-slate-500 uppercase tracking-wide mb-2">Help & Info</StyledText>

                    <StyledTouchableOpacity onPress={handleBugReport} className="flex-row items-center py-2.5">
                        <Bug size={18} color="#64748b" />
                        <StyledText style={{ fontSize: 16 * textScale }} className="flex-1 ml-3 font-n-medium text-slate-900 dark:text-white">Report a Bug</StyledText>
                        <ChevronRight size={18} color="#94a3b8" />
                    </StyledTouchableOpacity>

                    <StyledTouchableOpacity onPress={handleFeedback} className="flex-row items-center py-2.5">
                        <MessageSquare size={18} color="#64748b" />
                        <StyledText style={{ fontSize: 16 * textScale }} className="flex-1 ml-3 font-n-medium text-slate-900 dark:text-white">Feedback</StyledText>
                        <ChevronRight size={18} color="#94a3b8" />
                    </StyledTouchableOpacity>

                    <StyledView className="h-px bg-slate-100 dark:bg-slate-700 my-1" />

                    <StyledTouchableOpacity onPress={handleAbout} className="flex-row items-center py-2.5">
                        <Info size={18} color="#64748b" />
                        <StyledText style={{ fontSize: 16 * textScale }} className="flex-1 ml-3 font-n-medium text-slate-900 dark:text-white">About</StyledText>
                        <ChevronRight size={18} color="#94a3b8" />
                    </StyledTouchableOpacity>

                    <StyledTouchableOpacity onPress={handlePrivacy} className="flex-row items-center py-2.5">
                        <Lock size={18} color="#64748b" />
                        <StyledText style={{ fontSize: 16 * textScale }} className="flex-1 ml-3 font-n-medium text-slate-900 dark:text-white">Privacy</StyledText>
                        <ChevronRight size={18} color="#94a3b8" />
                    </StyledTouchableOpacity>

                    <StyledTouchableOpacity onPress={handleTerms} className="flex-row items-center py-2.5">
                        <FileText size={18} color="#64748b" />
                        <StyledText style={{ fontSize: 16 * textScale }} className="flex-1 ml-3 font-n-medium text-slate-900 dark:text-white">Terms</StyledText>
                        <ChevronRight size={18} color="#94a3b8" />
                    </StyledTouchableOpacity>
                </StyledView>

                {/* Group 4: Admin (Conditional) */}
                {isAdmin && (
                    <StyledTouchableOpacity
                        onPress={handleAdmin}
                        className="rounded-2xl p-4 mb-3 flex-row items-center"
                        style={{ backgroundColor: '#dc2626' }}
                    >
                        <StyledView className="w-10 h-10 rounded-full items-center justify-center" style={{ backgroundColor: 'rgba(255,255,255,0.2)' }}>
                            <Shield size={20} color="#ffffff" />
                        </StyledView>
                        <StyledView className="flex-1 ml-3">
                            <StyledText style={{ fontSize: 16 * textScale }} className="font-n-bold text-white">Admin Panel</StyledText>
                            <StyledText style={{ fontSize: 14 * textScale }} className="text-white opacity-80">Manage application</StyledText>
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
                    >
                        <LogOut size={20} color="#dc2626" />
                        <StyledText style={{ fontSize: 16 * textScale }} className="font-n-bold text-red-600 dark:text-red-400 ml-2">
                            {signingOut ? 'Signing Out...' : 'Sign Out'}
                        </StyledText>
                    </StyledTouchableOpacity>
                )}
            </StyledScrollView>
        </StyledView>
    );
}
