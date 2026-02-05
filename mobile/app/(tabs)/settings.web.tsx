import React from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet, Platform } from 'react-native';
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

    return (
        <View style={styles.container}>
            <ScrollView
                contentContainerStyle={styles.scrollContent}
                style={styles.scrollView}
                showsVerticalScrollIndicator={false}
            >
                {/* Header */}
                <View style={styles.header}>
                    <Pressable
                        onPress={() => router.back()}
                        style={({ hovered }: any) => [
                            styles.backButton,
                            hovered && styles.backButtonHovered
                        ]}
                    >
                        <ChevronLeft size={32} color="#334155" />
                    </Pressable>

                    <Text style={styles.headerTitle}>Settings</Text>

                    <View style={styles.headerSpacer} />
                </View>

                {/* Card */}
                <View style={styles.card}>
                    {menuItems.map((item: any, index: number) => {
                        const Icon = item.icon;
                        const isProItem = item.proItem;
                        const isAdminItem = item.adminItem;
                        const inlineLabel = item.inlineLabel;
                        const sublabel = item.sublabel;
                        const highlight = item.highlight;
                        const isDisabled = item.disabled;

                        // Colors
                        let iconColor = "#64748b"; // slate-500
                        let labelColor = "#1e293b"; // slate-800
                        let sublabelColor = "#64748b"; // slate-500
                        let backgroundColor = "transparent";
                        let hoverColor = "#f1f5f9"; // slate-100

                        if (isAdminItem) {
                            backgroundColor = "#dc2626"; // red-600
                            hoverColor = "#b91c1c"; // red-700
                            iconColor = "white";
                            labelColor = "white";
                            sublabelColor = "rgba(255,255,255,0.9)";
                        } else if (isProItem) {
                            backgroundColor = "#f97316"; // orange-500
                            hoverColor = "#ea580c"; // orange-600
                            iconColor = "white";
                            labelColor = "white";
                            sublabelColor = "rgba(255,255,255,0.9)";
                        } else if (highlight) {
                            backgroundColor = "#fffbeb"; // amber-50
                            hoverColor = "#fef3c7"; // amber-100
                            iconColor = "#f59e0b"; // amber-500
                        }

                        // Determine styles based on state
                        const getButtonStyle = ({ hovered, pressed }: any) => [
                            styles.menuItem,
                            // Background overrides
                            isAdminItem && { backgroundColor: hovered ? hoverColor : backgroundColor },
                            isProItem && { backgroundColor: hovered ? hoverColor : backgroundColor },
                            highlight && { backgroundColor: hovered ? hoverColor : backgroundColor },
                            // Default hover
                            (!isAdminItem && !isProItem && !highlight && hovered) && { backgroundColor: hoverColor },
                            // Pressed state
                            pressed && { opacity: 0.9 },
                            isDisabled && { opacity: 0.5 },
                        ];

                        return (
                            <Pressable
                                key={item.label || index}
                                onPress={item.onClick}
                                disabled={isDisabled}
                                style={getButtonStyle}
                            >
                                <View style={styles.menuItemLeft}>
                                    <Icon size={20} color={iconColor} />

                                    <View style={styles.menuItemTextContainer}>
                                        <View style={styles.labelRow}>
                                            <Text style={[styles.menuItemLabel, { color: labelColor }]}>
                                                {item.label}
                                            </Text>
                                            {inlineLabel && (
                                                <Text style={[styles.inlineLabel, { color: sublabelColor }]}>
                                                    {inlineLabel}
                                                </Text>
                                            )}
                                        </View>

                                        {sublabel && (
                                            <Text style={[styles.sublabel, { color: sublabelColor }]}>
                                                {sublabel}
                                            </Text>
                                        )}
                                    </View>
                                </View>

                                <ChevronRight size={20} color={isAdminItem || isProItem ? "white" : "#94a3b8"} />
                            </Pressable>
                        );
                    })}
                </View>

                {/* Sign Out Button */}
                {isAuthenticated && (
                    <Pressable
                        onPress={handleSignOut}
                        style={({ hovered }: any) => [
                            styles.signOutButton,
                            hovered && styles.signOutButtonHovered
                        ]}
                    >
                        <LogOut size={18} color="white" style={{ marginRight: 8 }} />
                        <Text style={styles.signOutText}>Sign Out</Text>
                    </Pressable>
                )}
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F8FAFC', // slate-50
        alignItems: 'center',
    },
    scrollView: {
        width: '100%',
    },
    scrollContent: {
        alignItems: 'center',
        padding: 16,
        paddingBottom: 60,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        width: '100%',
        maxWidth: 500,
        marginBottom: 24,
        marginTop: 12,
    },
    headerTitle: {
        fontSize: 32,
        fontWeight: 'bold',
        color: '#0f172a', // slate-900
        fontFamily: Platform.OS === 'web' ? 'Nunito, sans-serif' : 'System',
    },
    backButton: {
        width: 48,
        height: 48,
        borderRadius: 24,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'transparent',
    },
    backButtonHovered: {
        backgroundColor: '#e2e8f0', // slate-200
    },
    headerSpacer: {
        width: 48,
    },
    card: {
        width: '100%',
        maxWidth: 500,
        backgroundColor: 'white',
        borderRadius: 16,
        paddingVertical: 8,
        // Shadow (iOS/Web)
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 10,
        // Elevation (Android)
        elevation: 3,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: '#e2e8f0', // slate-200
    },
    menuItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#F1F5F9', // slate-100
        transitionDuration: '0.2s', // Web only
    },
    menuItemLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
        gap: 12,
    },
    menuItemTextContainer: {
        flex: 1,
        justifyContent: 'center',
        marginLeft: 12,
    },
    labelRow: {
        flexDirection: 'row',
        alignItems: 'center',
        flexWrap: 'wrap',
    },
    menuItemLabel: {
        fontSize: 16,
        fontWeight: '600',
        fontFamily: Platform.OS === 'web' ? 'Nunito, sans-serif' : 'System',
    },
    inlineLabel: {
        fontSize: 14,
        marginLeft: 8,
    },
    sublabel: {
        fontSize: 13,
        marginTop: 2,
    },
    signOutButton: {
        marginTop: 24,
        width: '100%',
        maxWidth: 500,
        backgroundColor: '#dc2626', // red-600
        padding: 14,
        borderRadius: 12,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#dc2626',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
    },
    signOutButtonHovered: {
        backgroundColor: '#b91c1c', // red-700
    },
    signOutText: {
        color: 'white',
        fontWeight: 'bold',
        fontSize: 16,
    },
});
