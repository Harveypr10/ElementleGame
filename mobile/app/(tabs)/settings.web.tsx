import React from 'react';
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
        <div
            className={`min-h-screen flex flex-col p-4 bg-white dark:bg-slate-950 ${adBannerActive ? 'pb-[50px]' : ''}`}
            style={{ fontFamily: 'Nunito, sans-serif' }}
        >
            <div className="w-full max-w-md mx-auto space-y-4">

                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                    <button
                        onClick={() => router.back()}
                        data-testid="button-back-from-settings"
                        className="w-14 h-14 flex items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                        style={{ cursor: 'pointer' }}
                    >
                        <ChevronLeft size={36} className="text-gray-700 dark:text-gray-200" color={colors.text} />
                    </button>

                    <div className="flex flex-col items-center">
                        <h1 className="text-4xl font-bold dark:text-white">Settings</h1>
                    </div>

                    {/* Spacer */}
                    <div className="w-14" />
                </div>

                {/* Card */}
                <div className="p-4 space-y-2 bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-800 shadow-sm">
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
                            bgClass = "opacity-50 cursor-not-allowed";
                        } else {
                            bgClass = "cursor-pointer";
                        }

                        if (isAdminItem) {
                            bgClass += " bg-red-600 hover:bg-red-700 text-white";
                            textClass = "text-white";
                            iconColor = "white";
                        } else if (isProItem) {
                            bgClass += " bg-orange-500 hover:bg-orange-600 text-white";
                            textClass = "text-white";
                            iconColor = "white";
                        } else if (highlight) {
                            bgClass += " bg-amber-50 dark:bg-amber-950/30 hover:bg-amber-100 dark:hover:bg-amber-900/40";
                            iconColor = "#f59e0b"; // amber-500
                        } else {
                            bgClass += " hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors";
                            textClass = "text-gray-900 dark:text-gray-100";
                            iconColor = colors.icon;
                        }

                        return (
                            <button
                                key={item.label}
                                onClick={item.onClick}
                                disabled={isDisabled}
                                className={`w-full flex items-center justify-between p-3 rounded-md transition-colors ${bgClass}`}
                            >
                                <div className="flex items-center gap-3 flex-1">
                                    <Icon size={20} color={iconColor} className="flex-shrink-0" />

                                    <span className={`font-medium whitespace-nowrap ${textClass}`}>
                                        {item.label}
                                    </span>

                                    {inlineLabel && (
                                        <span className={`text-sm ${isAdminItem || isProItem ? "text-white/90" : "text-gray-500"}`}>
                                            {inlineLabel}
                                        </span>
                                    )}

                                    {sublabel && (
                                        <div className="flex-1 flex justify-center">
                                            <div className={`text-sm max-w-[150px] text-center ${isAdminItem || isProItem ? "text-white/90" : "text-gray-500"}`}>
                                                {sublabel}
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <ChevronRight size={20} color={isAdminItem || isProItem ? "white" : colors.icon} className="flex-shrink-0" />
                            </button>
                        );
                    })}
                </div>

                {/* Sign Out Button */}
                {isAuthenticated && (
                    <button
                        onClick={handleSignOut}
                        className="w-full flex items-center justify-center p-3 rounded-md bg-red-600 hover:bg-red-700 mt-4 transition-colors cursor-pointer"
                    >
                        <LogOut size={16} color="white" className="mr-2" />
                        <span className="text-white font-bold">
                            Sign Out
                        </span>
                    </button>
                )}
            </div>
        </div>
    );
}
