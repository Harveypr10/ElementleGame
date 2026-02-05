import React from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
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

                        // Icons & Text Colors
                        let iconColor = "#64748b"; // Slate-500
                        let labelColor = "#334155"; // Slate-700
                        let sublabelColor = "#64748b"; // Slate-500
                        let hoverColor = "#f1f5f9"; // Slate-100

                        if (isAdminItem || isProItem) {
                            iconColor = "white";
                            labelColor = "white";
                            sublabelColor = "rgba(255,255,255,0.9)";
                            hoverColor = "transparent"; // Gradients handle their own hover visually roughly, or we just overlay? 
                            // Actually pure gradients don't change much on hover in the native sense unless we swap the gradient colors.
                            // For simplicity, we'll keep gradient static but add opacity on press.
                        } else if (highlight) {
                            hoverColor = "#fef3c7"; // Amber-100
                            iconColor = "#f59e0b"; // Amber-500
                        }

                        // Gradient Colors
                        let gradientColors: readonly [string, string] | null = null;
                        if (isAdminItem) gradientColors = ['#ef4444', '#dc2626']; // Red-500 -> Red-600
                        if (isProItem) gradientColors = ['#fb923c', '#f97316']; // Orange-400 -> Orange-500

                        const Content = (
                            <View style={[
                                styles.menuItemContent,
                                highlight && { backgroundColor: '#fffbeb' }, // Amber-50 base
                            ]}>
                                <View style={styles.menuItemLeft}>
                                    <Icon size={22} color={iconColor} />

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
                            </View>
                        );

                        // If Gradient, wrap Content in LinearGradient
                        const InnerComponent = gradientColors ? (
                            <LinearGradient
                                colors={gradientColors}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 0 }}
                                style={styles.gradientItem}
                            >
                                {Content}
                            </LinearGradient>
                        ) : Content;

                        return (
                            <Pressable
                                key={item.label || index}
                                onPress={item.onClick}
                                disabled={isDisabled}
                                style={({ hovered, pressed }: any) => [
                                    styles.menuItemWrapper,
                                    // Hover Logic (Non-Gradient items only)
                                    (!gradientColors && hovered) && { backgroundColor: hoverColor },
                                    // Pressed Logic
                                    pressed && { opacity: 0.9 },
                                    isDisabled && { opacity: 0.5 },
                                ]}
                            >
                                {InnerComponent}
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
        backgroundColor: '#F8FAFC', // Slate-50
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
        color: '#0f172a', // Slate-900
        fontFamily: 'Nunito_700Bold',
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
        backgroundColor: '#e2e8f0', // Slate-200
    },
    headerSpacer: {
        width: 48,
    },
    card: {
        width: '100%',
        maxWidth: 500,
        backgroundColor: 'white',
        borderRadius: 24, // Vibe Check: Roundness increased
        // Shadow
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 10,
        elevation: 3,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: '#e2e8f0',
    },
    menuItemWrapper: {
        width: '100%',
        borderBottomWidth: 1,
        borderBottomColor: '#F1F5F9', // Subtle separator
    },
    gradientItem: {
        width: '100%',
    },
    menuItemContent: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 18, // Vibe Check: Spacing
        paddingHorizontal: 20,
        width: '100%',
    },
    menuItemLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
        marginRight: 12,
    },
    menuItemTextContainer: {
        flex: 1,
        justifyContent: 'center',
        marginLeft: 16, // Vibe Check: Spacing
    },
    labelRow: {
        flexDirection: 'row',
        alignItems: 'center',
        flexWrap: 'wrap',
    },
    menuItemLabel: {
        fontSize: 17, // Slight bump for premium feel
        fontFamily: 'Nunito_600SemiBold',
    },
    inlineLabel: {
        fontSize: 14,
        marginLeft: 8,
        fontFamily: 'Nunito_600SemiBold',
    },
    sublabel: {
        fontSize: 13,
        marginTop: 3,
        fontFamily: 'Nunito_600SemiBold',
    },
    signOutButton: {
        marginTop: 24,
        width: '100%',
        maxWidth: 500,
        backgroundColor: '#dc2626', // Red-600
        padding: 16,
        borderRadius: 16,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#dc2626',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
    },
    signOutButtonHovered: {
        backgroundColor: '#b91c1c', // Red-700
    },
    signOutText: {
        color: 'white',
        fontFamily: 'Nunito_700Bold',
        fontSize: 16,
    },
});
