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

// Styled Components
const StyledView = styled(View);
const StyledTouchableOpacity = styled(TouchableOpacity);
const StyledScrollView = styled(ScrollView);

export default function SettingsScreenWeb() {
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

    // Web-specific container styles for "Premium Card" look
    const cardStyle = {
        backgroundColor: colors.surface,
        borderColor: colors.border,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius: 12,
        elevation: 4
    };

    const MenuItem = ({
        icon: Icon,
        iconColor,
        iconBg,
        title,
        subtitle,
        onPress,
        isProAction = false,
        isDestructive = false
    }: any) => (
        <StyledTouchableOpacity
            onPress={onPress}
            className={`flex-row items-center p-4 mb-2 rounded-xl transition-all duration-200 hover:bg-slate-50 dark:hover:bg-slate-800 ${isDestructive ? 'hover:bg-red-50 dark:hover:bg-red-900/10' : ''}`}
            style={{
                borderWidth: 1,
                borderColor: 'transparent',
                // Web hover effect simulation via border or background is handled by className, 
                // but we can add explicit "cursor: pointer" equivalent here if needed, 
                // though TouchableOpacity handles it.
            }}
        >
            <StyledView className={`w-12 h-12 rounded-full items-center justify-center ${iconBg}`}>
                <Icon size={24} color={iconColor} />
            </StyledView>
            <StyledView className="flex-1 ml-4 justify-center">
                <ThemedText style={{ fontSize: 18 * textScale, color: isDestructive ? '#dc2626' : colors.text }} className="font-n-bold">
                    {title}
                </ThemedText>
                {subtitle && (
                    <ThemedText style={{ fontSize: 14 * textScale, color: colors.secondaryText }} className="mt-0.5">
                        {subtitle}
                    </ThemedText>
                )}
            </StyledView>
            <ChevronRight size={20} color={colors.icon} style={{ opacity: 0.5 }} />
        </StyledTouchableOpacity>
    );

    return (
        <ThemedView className="flex-1 bg-slate-50 dark:bg-slate-950">
            {/* Web Header - Centered & Clean */}
            <StyledView className="w-full bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 shadow-sm z-10 sticky top-0">
                <StyledView className="max-w-4xl w-full mx-auto px-6 py-4 flex-row items-center justify-between" style={{ flexDirection: 'row' }}>
                    <StyledTouchableOpacity
                        onPress={() => router.back()}
                        className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800"
                    >
                        <ChevronLeft size={28} color={colors.text} />
                    </StyledTouchableOpacity>

                    <ThemedText size="3xl" className="font-n-bold text-center absolute left-0 right-0 pointer-events-none">
                        Settings
                    </ThemedText>

                    <View style={{ width: 44 }} /> {/* Spacer for symmetry */}
                </StyledView>
            </StyledView>

            {/* Main Content - Centered Card Layout */}
            <StyledScrollView
                className="flex-1 w-full"
                contentContainerStyle={{ paddingVertical: 40, paddingHorizontal: 20, alignItems: 'center' }}
            >
                <StyledView className="w-full max-w-3xl">

                    {/* Welcome / User Card */}
                    {isAuthenticated && (
                        <StyledView className="mb-8 flex-row items-center p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800" style={cardStyle}>
                            <StyledView className="w-20 h-20 rounded-full bg-blue-100 dark:bg-blue-900/30 items-center justify-center mr-6">
                                <User size={40} color="#2563eb" />
                            </StyledView>
                            <View>
                                <ThemedText size="2xl" className="font-n-bold text-slate-900 dark:text-white">
                                    {user?.email ? user.email.split('@')[0] : 'User'}
                                </ThemedText>
                                <ThemedText className="text-slate-500 dark:text-slate-400 mt-1">
                                    {user?.email}
                                </ThemedText>
                                <StyledTouchableOpacity
                                    onPress={handleAccountInfo}
                                    className="mt-3 bg-slate-100 dark:bg-slate-800 px-4 py-2 rounded-lg self-start"
                                >
                                    <ThemedText className="text-sm font-n-bold text-slate-700 dark:text-slate-300">Manage Account</ThemedText>
                                </StyledTouchableOpacity>
                            </View>
                        </StyledView>
                    )}

                    <View className="flex-row gap-8 w-full" style={{ flexDirection: 'row', flexWrap: 'wrap' }}>

                        {/* Left Column: Gameplay & Subscription */}
                        <View className="flex-1 min-w-[340px]">
                            <ThemedText className="text-sm font-n-bold uppercase text-slate-500 mb-4 ml-2">Subscription & Gameplay</ThemedText>
                            <StyledView className="bg-white dark:bg-slate-900 rounded-2xl p-2 border border-slate-200 dark:border-slate-800 mb-8" style={cardStyle}>

                                {isPro ? (
                                    <MenuItem
                                        icon={Crown}
                                        iconColor="#ffffff"
                                        iconBg="bg-orange-500"
                                        title="Pro Membership"
                                        subtitle="Active"
                                        onPress={handleProManage}
                                    />
                                ) : (
                                    <MenuItem
                                        icon={Crown}
                                        iconColor="#d97706"
                                        iconBg="bg-amber-100"
                                        title="Go Pro"
                                        subtitle="Unlock unlimited play & features"
                                        onPress={handleGoProClick}
                                    />
                                )}

                                {isPro && (
                                    <MenuItem
                                        icon={Grid}
                                        iconColor="#ea580c"
                                        iconBg="bg-orange-100 dark:bg-orange-900/30"
                                        title="Puzzle Categories"
                                        subtitle="Customize your experience"
                                        onPress={handleCategories}
                                    />
                                )}

                                <MenuItem
                                    icon={Flame}
                                    iconColor="#f97316"
                                    iconBg="bg-orange-100 dark:bg-orange-900/30"
                                    title="Streak Savers"
                                    subtitle="Manage your streak protection"
                                    onPress={handleStreakSaver}
                                />

                                <MenuItem
                                    icon={SlidersHorizontal}
                                    iconColor="#9333ea"
                                    iconBg="bg-purple-100 dark:bg-purple-900/30"
                                    title="Game Options"
                                    subtitle="Display & Sound settings"
                                    onPress={handleOptions}
                                />
                            </StyledView>
                        </View>

                        {/* Right Column: Support */}
                        <View className="flex-1 min-w-[340px]">
                            <ThemedText className="text-sm font-n-bold uppercase text-slate-500 mb-4 ml-2">Support & Info</ThemedText>
                            <StyledView className="bg-white dark:bg-slate-900 rounded-2xl p-2 border border-slate-200 dark:border-slate-800 mb-8" style={cardStyle}>
                                <MenuItem
                                    icon={Bug}
                                    iconColor="#64748b"
                                    iconBg="bg-slate-100 dark:bg-slate-800"
                                    title="Report a Bug"
                                    onPress={handleBugReport}
                                />
                                <MenuItem
                                    icon={MessageSquare}
                                    iconColor="#64748b"
                                    iconBg="bg-slate-100 dark:bg-slate-800"
                                    title="Feedback"
                                    onPress={handleFeedback}
                                />
                                <MenuItem
                                    icon={Info}
                                    iconColor="#64748b"
                                    iconBg="bg-slate-100 dark:bg-slate-800"
                                    title="About Elementle"
                                    onPress={handleAbout}
                                />
                                <MenuItem
                                    icon={Lock}
                                    iconColor="#64748b"
                                    iconBg="bg-slate-100 dark:bg-slate-800"
                                    title="Privacy Policy"
                                    onPress={handlePrivacy}
                                />
                                <MenuItem
                                    icon={FileText}
                                    iconColor="#64748b"
                                    iconBg="bg-slate-100 dark:bg-slate-800"
                                    title="Terms of Service"
                                    onPress={handleTerms}
                                />
                            </StyledView>
                        </View>
                    </View>

                    {/* Footer Actions */}
                    <View className="mt-4 flex-row justify-center gap-4" style={{ flexDirection: 'row' }}>
                        {isAdmin && (
                            <StyledTouchableOpacity
                                onPress={handleAdmin}
                                className="flex-row items-center px-6 py-3 rounded-full bg-red-600 hover:bg-red-700 transition-colors"
                            >
                                <Shield size={20} color="#ffffff" className="mr-2" />
                                <Text className="text-white font-n-bold">Admin Panel</Text>
                            </StyledTouchableOpacity>
                        )}

                        {isAuthenticated && (
                            <StyledTouchableOpacity
                                onPress={handleSignOut}
                                disabled={signingOut}
                                className="flex-row items-center px-6 py-3 rounded-full border border-red-200 bg-white hover:bg-red-50 dark:bg-slate-900 dark:border-red-900 transition-colors"
                            >
                                <LogOut size={20} color="#dc2626" className="mr-2" />
                                <Text className="text-red-600 dark:text-red-400 font-n-bold">
                                    {signingOut ? 'Signing Out...' : 'Sign Out'}
                                </Text>
                            </StyledTouchableOpacity>
                        )}
                    </View>

                    <ThemedText className="text-center text-slate-400 text-sm mt-12 mb-8">
                        Version 1.0.0 (Web Beta)
                    </ThemedText>

                </StyledView>
            </StyledScrollView>
        </ThemedView>
    );
}
