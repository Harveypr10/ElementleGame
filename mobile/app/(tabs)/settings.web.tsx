import React from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
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

// Styled Components for NativeWind
const StyledView = styled(View);
const StyledText = styled(Text);
const StyledPressable = styled(Pressable);
const StyledScrollView = styled(ScrollView);

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

    // Replicating Legacy Item Logic
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

    const adBannerActive = false;

    return (
        <StyledView className={`min-h-screen flex-1 bg-gray-50 dark:bg-slate-950 items-center p-4 ${adBannerActive ? 'pb-[50px]' : ''}`}>
            {/* ScrollView container to allow scrolling if content overflows */}
            <StyledScrollView
                className="w-full max-w-md"
                contentContainerStyle={{ alignItems: 'center' }}
                showsVerticalScrollIndicator={false}
            >
                <StyledView className="w-full space-y-4">

                    {/* Header */}
                    <StyledView className="flex-row items-center justify-between mb-6 w-full">
                        <StyledPressable
                            onPress={() => router.back()}
                            className="w-14 h-14 items-center justify-center rounded-full hover:bg-gray-200 dark:hover:bg-slate-800"
                        >
                            <ChevronLeft size={36} className="text-gray-700 dark:text-gray-200" color={colors.text} />
                        </StyledPressable>

                        <StyledView className="items-center">
                            <StyledText className="text-4xl font-bold text-gray-900 dark:text-white">Settings</StyledText>
                        </StyledView>

                        {/* Spacer */}
                        <StyledView className="w-14" />
                    </StyledView>

                    {/* Card */}
                    <StyledView className="w-full bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-800 shadow-sm p-4 space-y-2">
                        {menuItems.map((item: any, index: number) => {
                            const Icon = item.icon;
                            const isProItem = item.proItem;
                            const isAdminItem = item.adminItem;
                            const inlineLabel = item.inlineLabel;
                            const sublabel = item.sublabel;
                            const highlight = item.highlight;
                            const isDisabled = item.disabled;

                            // Dynamic Classes
                            let bgClass = "";
                            let textClass = "";
                            let iconColor = "#64748b"; // slate-500

                            if (isDisabled) {
                                bgClass = "opacity-50";
                            }

                            if (isAdminItem) {
                                bgClass += " bg-red-600 hover:bg-red-700";
                                textClass = "text-white";
                                iconColor = "white";
                            } else if (isProItem) {
                                bgClass += " bg-orange-500 hover:bg-orange-600";
                                textClass = "text-white";
                                iconColor = "white";
                            } else if (highlight) {
                                bgClass += " bg-amber-50 dark:bg-amber-950/30 hover:bg-amber-100 dark:hover:bg-amber-900/40";
                                iconColor = "#f59e0b"; // amber-500
                            } else {
                                bgClass += " hover:bg-gray-100 dark:hover:bg-slate-800";
                                textClass = "text-gray-900 dark:text-gray-100";
                                iconColor = colors.icon;
                            }

                            return (
                                <StyledPressable
                                    key={item.label || index}
                                    onPress={item.onClick}
                                    disabled={isDisabled}
                                    className={`w-full flex-row items-center justify-between p-3 rounded-md transition-colors ${bgClass}`}
                                >
                                    <StyledView className="flex-row items-center gap-3 flex-1">
                                        <Icon size={20} color={iconColor} />

                                        <StyledText className={`font-medium ${textClass}`}>
                                            {item.label}
                                        </StyledText>

                                        {inlineLabel && (
                                            <StyledText className={`text-sm ml-2 ${isAdminItem || isProItem ? "text-white/90" : "text-gray-500"}`}>
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
                                </StyledPressable>
                            );
                        })}
                    </StyledView>

                    {/* Sign Out Button */}
                    {isAuthenticated && (
                        <StyledPressable
                            onPress={handleSignOut}
                            className="w-full flex-row items-center justify-center p-3 rounded-md bg-red-600 hover:bg-red-700 mt-4"
                        >
                            <LogOut size={16} color="white" style={{ marginRight: 8 }} />
                            <StyledText className="text-white font-bold">
                                Sign Out
                            </StyledText>
                        </StyledPressable>
                    )}
                </StyledView>
            </StyledScrollView>
        </StyledView>
    );
}
