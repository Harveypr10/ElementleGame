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
    Shield
} from 'lucide-react-native';
import { useSettingsScreenLogic } from '../../hooks/useSettingsScreenLogic';

// Styled Components
const StyledView = styled(View);
const StyledTouchableOpacity = styled(TouchableOpacity);
const StyledScrollView = styled(ScrollView);
const StyledText = styled(Text);

export default function SettingsScreenWeb() {
    const {
        user,
        isAuthenticated,
        isAdmin,
        isPro,
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

    // Replicating Legacy Item Logic but wired to our Hook Handlers

    // Subscription-related items
    const subscriptionItems = [
        {
            icon: Crown,
            label: isPro ? "Pro" : "Go Pro",
            inlineLabel: isPro ? "Manage your subscription" : null,
            sublabel: !isPro ? "Remove ads & customize categories" : null,
            onClick: isPro ? handleProManage : handleGoProClick,
            testId: "button-subscription",
            highlight: !isPro,
            proItem: isPro,
            disabled: false,
        },
        ...(isPro ? [{
            icon: Grid,
            label: "Select Categories",
            inlineLabel: null,
            sublabel: null,
            onClick: handleCategories,
            testId: "button-select-categories",
            highlight: false,
            proItem: true,
            disabled: false,
        }] : []),
        ...(!isPro && isAuthenticated ? [{
            icon: Flame,
            label: "Streak Saver",
            inlineLabel: null,
            sublabel: null,
            onClick: handleStreakSaver,
            testId: "button-streak-saver",
            highlight: false,
            proItem: false,
            disabled: false,
        }] : []),
    ];

    const adminItems = isAdmin ? [{
        icon: Shield,
        label: "Admin",
        onClick: handleAdmin,
        testId: "button-admin",
        adminItem: true,
    }] : [];

    const menuItems = [
        {
            icon: User,
            label: "Account Info",
            onClick: handleAccountInfo,
            testId: "button-account-info",
        },
        ...subscriptionItems,
        ...adminItems,
        {
            icon: SettingsIcon,
            label: "Options",
            onClick: handleOptions,
            testId: "button-options-from-settings",
        },
        {
            icon: Bug,
            label: "Report a Bug",
            onClick: handleBugReport,
            testId: "button-bug-report",
        },
        {
            icon: MessageSquare,
            label: "Feedback",
            onClick: handleFeedback,
            testId: "button-feedback",
        },
        {
            icon: Info,
            label: "About",
            onClick: handleAbout,
            testId: "button-about",
        },
        {
            icon: Lock,
            label: "Privacy",
            onClick: handlePrivacy,
            testId: "button-privacy",
        },
        {
            icon: FileText,
            label: "Terms",
            onClick: handleTerms,
            testId: "button-terms",
        },
    ];

    // Helper to determine Ad Banner activity (mocked/implied false for now or derived if needed)
    const adBannerActive = false;

    return (
        <StyledScrollView
            className={`min-h-screen flex flex-col p-4 bg-white dark:bg-slate-950 ${adBannerActive ? 'pb-[50px]' : ''}`}
            contentContainerStyle={{ flexGrow: 1 }}
        >
            <StyledView className="w-full max-w-md mx-auto space-y-4">

                {/* Header */}
                <StyledView className="flex-row items-center justify-between mb-6" style={{ flexDirection: 'row' }}>
                    <StyledTouchableOpacity
                        onPress={() => router.back()}
                        // data-testid="button-back-from-settings"
                        className="w-14 h-14 flex items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                    >
                        <ChevronLeft size={36} className="text-gray-700 dark:text-gray-200" color={colors.text} />
                    </StyledTouchableOpacity>

                    <StyledView className="flex flex-col items-center">
                        <StyledText className="text-4xl font-bold dark:text-white">Settings</StyledText>
                    </StyledView>

                    {/* Spacer */}
                    <StyledView className="w-14" />
                </StyledView>

                {/* Card */}
                <StyledView className="p-4 space-y-2 bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-800 shadow-sm">
                    {menuItems.map((item: any) => {
                        const Icon = item.icon;
                        const isProItem = item.proItem;
                        const isAdminItem = item.adminItem;
                        const inlineLabel = item.inlineLabel;
                        const sublabel = item.sublabel;
                        const highlight = item.highlight;
                        const isDisabled = item.disabled;

                        // Calculate dynamic classes
                        let bgClass = "";
                        let textClass = "";
                        let iconColor = "#64748b"; // muted foreground default

                        if (isDisabled) {
                            bgClass = "opacity-50";
                        }

                        // Exact logic from legacy: warning/danger/success gradients don't map 1:1 to Tailwind classes without config
                        // but I will use closest Tailwind standard colors to replicate "orange-400 to orange-500"

                        let styleOverride = {};

                        if (isAdminItem) {
                            // bg-gradient-to-r from-red-500 to-red-600 logic
                            // NativeWind supports gradients via linear-gradient library usually, but standard bg-red-500 is safer if gradient plugin not installed.
                            // I'll use simple colors.
                            bgClass += " bg-red-600 hover:bg-red-700";
                            textClass = "text-white";
                            iconColor = "white";
                        } else if (isProItem) {
                            // bg-gradient-to-r from-orange-400 to-orange-500
                            bgClass += " bg-orange-500 hover:bg-orange-600";
                            textClass = "text-white";
                            iconColor = "white";
                        } else if (highlight) {
                            bgClass += " bg-amber-50 dark:bg-amber-950/30";
                            // hover-elevate ... I will just use hover:bg-amber-100
                            iconColor = "#f59e0b"; // amber-500
                        } else {
                            bgClass += " hover:bg-gray-100 dark:hover:bg-gray-800";
                            textClass = "text-gray-900 dark:text-gray-100";
                            iconColor = colors.icon;
                        }

                        return (
                            <StyledTouchableOpacity
                                key={item.label}
                                onPress={item.onClick}
                                disabled={isDisabled}
                                className={`w-full flex-row items-center justify-between p-3 rounded-md transition-colors ${bgClass}`}
                                style={{ flexDirection: 'row' }}
                            >
                                <StyledView className="flex-row items-center gap-3 flex-1" style={{ flexDirection: 'row', gap: 12 }}>
                                    <Icon size={20} color={iconColor} />

                                    <StyledText className={`font-medium ${textClass}`}>
                                        {item.label}
                                    </StyledText>

                                    {inlineLabel && (
                                        <StyledText className={`text-sm ${isAdminItem || isProItem ? "text-white/90" : "text-gray-500"}`}>
                                            {inlineLabel}
                                        </StyledText>
                                    )}

                                    {sublabel && (
                                        <StyledView className="flex-1 justify-center items-center">
                                            <StyledText numberOfLines={1} className={`text-sm text-center ${isAdminItem || isProItem ? "text-white/90" : "text-gray-500"}`}>
                                                {sublabel}
                                            </StyledText>
                                        </StyledView>
                                    )}
                                </StyledView>

                                <ChevronRight size={20} color={isAdminItem || isProItem ? "white" : colors.icon} />
                            </StyledTouchableOpacity>
                        );
                    })}
                </StyledView>

                {/* Sign Out Button */}
                {isAuthenticated && (
                    <StyledTouchableOpacity
                        onPress={handleSignOut}
                        className="w-full flex-row items-center justify-center p-3 rounded-md bg-red-600 hover:bg-red-700 mt-4"
                        style={{ flexDirection: 'row' }}
                    >
                        <LogOut size={16} color="white" className="mr-2" style={{ marginRight: 8 }} />
                        <StyledText className="text-white font-bold">
                            Sign Out
                        </StyledText>
                    </StyledTouchableOpacity>
                )}
            </StyledView>
        </StyledScrollView>
    );
}
