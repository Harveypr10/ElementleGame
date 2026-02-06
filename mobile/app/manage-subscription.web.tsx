/**
 * manage-subscription.web.tsx
 * Web implementation with Stripe billing portal
 */

import React, { useState, useEffect } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView, ActivityIndicator, Switch } from 'react-native';
import { ChevronLeft, Crown, Flame, Umbrella, Calendar, ExternalLink } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useManageSubscriptionLogic } from '../hooks/useManageSubscriptionLogic';

export default function ManageSubscriptionWeb() {
    const {
        isPro,
        tierType,
        endDate,
        stripeCustomerId,
        autoRenew,
        isUpdatingAutoRenew,
        isOpeningBillingPortal,
        holidayActive,
        holidayStartDate,
        holidayEndDate,
        holidaysRemaining,
        holidaysTotal,
        holidayDurationDays,
        hasAnyValidStreakForHoliday,
        regionUsed,
        userUsed,
        effectiveStreakSavers,
        regionLabel,
        formatDate,
        getFormattedNextHolidayResetDate,
        handleEndHoliday,
        handleStartHoliday,
        handleManageBilling,
        handleAutoRenewToggle,
        goBack,
        goToSubscription,
    } = useManageSubscriptionLogic();

    const router = useRouter();

    // Hover states
    const [backHover, setBackHover] = useState(false);
    const [upgradeHover, setUpgradeHover] = useState(false);
    const [billingHover, setBillingHover] = useState(false);
    const [holidayHover, setHolidayHover] = useState(false);

    const isLifetime = tierType === 'lifetime';

    // Standard (Free) user view
    if (!isPro) {
        return (
            <View style={styles.container}>
                <View style={styles.contentWrapper}>
                    {/* Header */}
                    <View style={styles.header}>
                        <Pressable
                            onPress={goBack}
                            onHoverIn={() => setBackHover(true)}
                            onHoverOut={() => setBackHover(false)}
                            style={[styles.backButton, backHover && styles.backButtonHover]}
                        >
                            <ChevronLeft size={24} color="#334155" />
                            <Text style={styles.backButtonText}>Settings</Text>
                        </Pressable>
                        <Text style={styles.title}>Subscription</Text>
                        <View style={{ width: 80 }} />
                    </View>

                    {/* Standard Tier Card */}
                    <View style={styles.card}>
                        <View style={styles.tierRow}>
                            <View style={[styles.tierIcon, { backgroundColor: '#f1f5f9' }]}>
                                <Crown size={24} color="#64748b" />
                            </View>
                            <View style={styles.tierInfo}>
                                <Text style={styles.tierLabel}>Subscription</Text>
                                <Text style={styles.tierName}>Standard</Text>
                            </View>
                        </View>
                    </View>

                    {/* Allowances Card */}
                    <View style={styles.card}>
                        <Text style={styles.sectionHeader}>Your Allowances</Text>

                        {/* Streak Savers */}
                        <View style={styles.allowanceRow}>
                            <View style={[styles.allowanceIcon, { backgroundColor: '#fef3c7' }]}>
                                <Flame size={20} color="#f59e0b" />
                            </View>
                            <View style={styles.allowanceInfo}>
                                <Text style={styles.allowanceTitle}>Monthly Streak Savers</Text>
                                <Text style={styles.allowanceDetail}>
                                    {regionLabel}: {Math.max(0, effectiveStreakSavers - regionUsed)} of {effectiveStreakSavers} remaining
                                </Text>
                                <Text style={styles.allowanceDetail}>
                                    Personal Game: {Math.max(0, effectiveStreakSavers - userUsed)} of {effectiveStreakSavers} remaining
                                </Text>
                            </View>
                        </View>

                        {/* Holiday Mode - Locked */}
                        <View style={styles.allowanceRow}>
                            <View style={[styles.allowanceIcon, { backgroundColor: '#dbeafe', opacity: 0.5 }]}>
                                <Umbrella size={20} color="#3b82f6" />
                            </View>
                            <View style={[styles.allowanceInfo, { opacity: 0.5 }]}>
                                <Text style={styles.allowanceTitle}>Holiday Mode</Text>
                                <Text style={styles.allowanceDetail}>{holidayDurationDays}-day protection: Locked</Text>
                                <Text style={styles.allowanceHint}>Pro members can pause their streak</Text>
                            </View>
                        </View>
                    </View>

                    {/* Upgrade Button */}
                    <Pressable
                        onPress={goToSubscription}
                        onHoverIn={() => setUpgradeHover(true)}
                        onHoverOut={() => setUpgradeHover(false)}
                        style={[styles.upgradeButton, upgradeHover && styles.upgradeButtonHover]}
                    >
                        <Crown size={20} color="#ffffff" />
                        <Text style={styles.upgradeButtonText}>Go Pro to increase your allowances</Text>
                    </Pressable>
                </View>
            </View>
        );
    }

    // Pro user view
    return (
        <View style={styles.container}>
            <View style={styles.contentWrapper}>
                {/* Header */}
                <View style={styles.header}>
                    <Pressable
                        onPress={goBack}
                        onHoverIn={() => setBackHover(true)}
                        onHoverOut={() => setBackHover(false)}
                        style={[styles.backButton, backHover && styles.backButtonHover]}
                    >
                        <ChevronLeft size={24} color="#334155" />
                        <Text style={styles.backButtonText}>Settings</Text>
                    </Pressable>
                    <Text style={styles.title}>Manage Subscription</Text>
                    <View style={{ width: 80 }} />
                </View>

                {/* Pro Tier Card */}
                <View style={styles.proCard}>
                    <View style={styles.tierRow}>
                        <View style={[styles.tierIcon, { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
                            <Crown size={24} color="#ffffff" />
                        </View>
                        <View style={styles.tierInfo}>
                            <Text style={styles.proTierLabel}>Subscription</Text>
                            <Text style={styles.proTierName}>
                                {tierType === 'lifetime' ? 'Pro - Lifetime' :
                                    tierType === 'annual' ? 'Pro - Annual' :
                                        tierType === 'monthly' ? 'Pro - Monthly' : 'Pro'}
                            </Text>
                        </View>
                    </View>

                    {/* Renewal / Expiry info */}
                    {!isLifetime && endDate && (
                        <View style={styles.renewalRow}>
                            <View style={styles.renewalInfo}>
                                <View style={styles.renewalIconRow}>
                                    <Calendar size={16} color="rgba(255,255,255,0.7)" />
                                    <Text style={styles.renewalLabel}>
                                        {autoRenew ? 'Renews on' : 'Expires on'}
                                    </Text>
                                </View>
                                <Text style={styles.renewalDate}>{formatDate(endDate)}</Text>
                            </View>
                            <View style={styles.autoRenewToggle}>
                                <Text style={styles.autoRenewLabel}>Auto-renew</Text>
                                <Switch
                                    value={autoRenew}
                                    onValueChange={handleAutoRenewToggle}
                                    disabled={isUpdatingAutoRenew}
                                    trackColor={{ false: 'rgba(255,255,255,0.3)', true: '#ffffff' }}
                                    thumbColor={autoRenew ? '#fb923c' : '#ffffff'}
                                />
                            </View>
                        </View>
                    )}

                    {isLifetime && (
                        <View style={styles.lifetimeRow}>
                            <Calendar size={16} color="rgba(255,255,255,0.7)" />
                            <Text style={styles.lifetimeText}>Never expires</Text>
                        </View>
                    )}

                    {/* Manage Billing Button (Stripe) */}
                    {!isLifetime && stripeCustomerId && (
                        <Pressable
                            onPress={handleManageBilling}
                            disabled={isOpeningBillingPortal}
                            onHoverIn={() => setBillingHover(true)}
                            onHoverOut={() => setBillingHover(false)}
                            style={[styles.billingButton, billingHover && styles.billingButtonHover]}
                        >
                            {isOpeningBillingPortal ? (
                                <ActivityIndicator size="small" color="#fb923c" />
                            ) : (
                                <>
                                    <ExternalLink size={18} color="#fb923c" />
                                    <Text style={styles.billingButtonText}>Manage Billing & Subscription</Text>
                                </>
                            )}
                        </Pressable>
                    )}
                </View>

                {/* Allowances Card */}
                <View style={styles.card}>
                    <Text style={styles.sectionHeader}>Your Allowances</Text>

                    {/* Streak Savers */}
                    <View style={styles.allowanceRow}>
                        <View style={[styles.allowanceIcon, { backgroundColor: '#fef3c7' }]}>
                            <Flame size={20} color="#f59e0b" />
                        </View>
                        <View style={styles.allowanceInfo}>
                            <Text style={styles.allowanceTitle}>Monthly Streak Savers</Text>
                            <Text style={styles.allowanceDetail}>
                                {regionLabel}: {Math.max(0, effectiveStreakSavers - regionUsed)} of {effectiveStreakSavers} remaining
                            </Text>
                            <Text style={styles.allowanceDetail}>
                                Personal Game: {Math.max(0, effectiveStreakSavers - userUsed)} of {effectiveStreakSavers} remaining
                            </Text>
                        </View>
                    </View>

                    {/* Holiday Mode */}
                    <View style={styles.allowanceRow}>
                        <View style={[styles.allowanceIcon, { backgroundColor: '#dbeafe' }]}>
                            <Umbrella size={20} color="#3b82f6" />
                        </View>
                        <View style={styles.allowanceInfo}>
                            <Text style={styles.allowanceTitle}>Annual {holidayDurationDays}-Day Holiday</Text>
                            <Text style={styles.allowanceDetail}>
                                {holidaysRemaining} of {holidaysTotal} remaining
                            </Text>
                        </View>
                    </View>
                </View>

                {/* Holiday Mode Control */}
                <View style={styles.holidayCard}>
                    <View style={styles.holidayHeader}>
                        <Umbrella size={20} color="#2563eb" />
                        <Text style={styles.holidayTitle}>Holiday Mode</Text>
                    </View>
                    <Text style={styles.holidaySubtitle}>
                        {holidayActive
                            ? 'Your streak is currently protected'
                            : `Protect your streak for up to ${holidayDurationDays} days`}
                    </Text>

                    {holidayActive ? (
                        <View style={styles.holidayActiveSection}>
                            <View style={styles.holidayDateRow}>
                                <Text style={styles.holidayDateLabel}>Started</Text>
                                <Text style={styles.holidayDateValue}>{formatDate(holidayStartDate)}</Text>
                            </View>
                            <View style={styles.holidayDateRow}>
                                <Text style={styles.holidayDateLabel}>Ends</Text>
                                <Text style={styles.holidayDateValue}>{formatDate(holidayEndDate)}</Text>
                            </View>
                            <Pressable
                                onPress={handleEndHoliday}
                                onHoverIn={() => setHolidayHover(true)}
                                onHoverOut={() => setHolidayHover(false)}
                                style={[styles.endHolidayButton, holidayHover && styles.endHolidayButtonHover]}
                            >
                                <Text style={styles.endHolidayButtonText}>End Holiday Early</Text>
                            </Pressable>
                        </View>
                    ) : (
                        <View>
                            {hasAnyValidStreakForHoliday && holidaysRemaining > 0 ? (
                                <Pressable
                                    onPress={handleStartHoliday}
                                    onHoverIn={() => setHolidayHover(true)}
                                    onHoverOut={() => setHolidayHover(false)}
                                    style={[styles.startHolidayButton, holidayHover && styles.startHolidayButtonHover]}
                                >
                                    <Text style={styles.startHolidayButtonText}>Start Holiday Mode</Text>
                                </Pressable>
                            ) : (
                                <View style={styles.holidayDisabled}>
                                    <Text style={styles.holidayDisabledText}>
                                        {!hasAnyValidStreakForHoliday
                                            ? 'No streak to protect'
                                            : `Holiday allowance resets on ${getFormattedNextHolidayResetDate()}`}
                                    </Text>
                                </View>
                            )}
                        </View>
                    )}
                </View>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F8FAFC',
        alignItems: 'center',
        paddingTop: 40,
        paddingBottom: 40,
        minHeight: '100vh' as any,
    },
    contentWrapper: {
        width: '100%',
        maxWidth: 480,
        paddingHorizontal: 16,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 24,
    },
    backButton: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 8,
        borderRadius: 8,
    },
    backButtonHover: {
        backgroundColor: '#E2E8F0',
    },
    backButtonText: {
        fontFamily: 'Nunito_600SemiBold',
        color: '#334155',
        fontSize: 16,
        marginLeft: 4,
    },
    title: {
        fontFamily: 'Nunito_700Bold',
        fontSize: 22,
        color: '#0f172a',
    },
    card: {
        backgroundColor: '#FFFFFF',
        borderRadius: 20,
        padding: 20,
        marginBottom: 16,
        shadowColor: '#64748B',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.08,
        shadowRadius: 16,
    },
    sectionHeader: {
        fontFamily: 'Nunito_700Bold',
        fontSize: 12,
        color: '#94a3b8',
        textTransform: 'uppercase',
        letterSpacing: 1,
        marginBottom: 16,
    },
    tierRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    tierIcon: {
        width: 48,
        height: 48,
        borderRadius: 24,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
    },
    tierInfo: {
        flex: 1,
    },
    tierLabel: {
        fontFamily: 'Nunito_500Medium',
        fontSize: 14,
        color: '#64748b',
    },
    tierName: {
        fontFamily: 'Nunito_700Bold',
        fontSize: 20,
        color: '#0f172a',
    },
    proCard: {
        backgroundColor: '#fb923c',
        borderRadius: 20,
        padding: 20,
        marginBottom: 16,
    },
    proTierLabel: {
        fontFamily: 'Nunito_500Medium',
        fontSize: 14,
        color: 'rgba(255,255,255,0.8)',
    },
    proTierName: {
        fontFamily: 'Nunito_700Bold',
        fontSize: 20,
        color: '#ffffff',
    },
    renewalRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginTop: 16,
        paddingTop: 16,
        borderTopWidth: 1,
        borderTopColor: 'rgba(255,255,255,0.2)',
    },
    renewalInfo: {
        flex: 1,
    },
    renewalIconRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    renewalLabel: {
        fontFamily: 'Nunito_500Medium',
        fontSize: 14,
        color: 'rgba(255,255,255,0.8)',
    },
    renewalDate: {
        fontFamily: 'Nunito_700Bold',
        fontSize: 16,
        color: '#ffffff',
        marginTop: 2,
    },
    autoRenewToggle: {
        alignItems: 'center',
    },
    autoRenewLabel: {
        fontFamily: 'Nunito_500Medium',
        fontSize: 11,
        color: 'rgba(255,255,255,0.7)',
        marginBottom: 4,
    },
    lifetimeRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginTop: 16,
        paddingTop: 16,
        borderTopWidth: 1,
        borderTopColor: 'rgba(255,255,255,0.2)',
    },
    lifetimeText: {
        fontFamily: 'Nunito_600SemiBold',
        fontSize: 14,
        color: 'rgba(255,255,255,0.9)',
    },
    billingButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#ffffff',
        borderRadius: 12,
        paddingVertical: 12,
        marginTop: 16,
        gap: 8,
    },
    billingButtonHover: {
        backgroundColor: '#fff7ed',
    },
    billingButtonText: {
        fontFamily: 'Nunito_700Bold',
        fontSize: 14,
        color: '#fb923c',
    },
    allowanceRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        marginBottom: 16,
    },
    allowanceIcon: {
        width: 40,
        height: 40,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
    },
    allowanceInfo: {
        flex: 1,
    },
    allowanceTitle: {
        fontFamily: 'Nunito_700Bold',
        fontSize: 16,
        color: '#0f172a',
        marginBottom: 4,
    },
    allowanceDetail: {
        fontFamily: 'Nunito_500Medium',
        fontSize: 14,
        color: '#64748b',
        marginBottom: 2,
    },
    allowanceHint: {
        fontFamily: 'Nunito_500Medium',
        fontSize: 12,
        color: '#94a3b8',
        marginTop: 4,
    },
    upgradeButton: {
        backgroundColor: '#fb923c',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 16,
        paddingVertical: 16,
        gap: 8,
    },
    upgradeButtonHover: {
        backgroundColor: '#f97316',
    },
    upgradeButtonText: {
        fontFamily: 'Nunito_700Bold',
        fontSize: 16,
        color: '#ffffff',
    },
    holidayCard: {
        backgroundColor: '#eff6ff',
        borderRadius: 20,
        padding: 20,
        borderWidth: 1,
        borderColor: '#bfdbfe',
    },
    holidayHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 4,
    },
    holidayTitle: {
        fontFamily: 'Nunito_700Bold',
        fontSize: 18,
        color: '#2563eb',
    },
    holidaySubtitle: {
        fontFamily: 'Nunito_500Medium',
        fontSize: 14,
        color: '#1e40af',
        marginBottom: 16,
    },
    holidayActiveSection: {},
    holidayDateRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 8,
    },
    holidayDateLabel: {
        fontFamily: 'Nunito_500Medium',
        fontSize: 14,
        color: '#1d4ed8',
    },
    holidayDateValue: {
        fontFamily: 'Nunito_700Bold',
        fontSize: 14,
        color: '#1e3a8a',
    },
    endHolidayButton: {
        backgroundColor: '#ffffff',
        borderRadius: 12,
        paddingVertical: 12,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#93c5fd',
        marginTop: 8,
    },
    endHolidayButtonHover: {
        backgroundColor: '#f0f9ff',
    },
    endHolidayButtonText: {
        fontFamily: 'Nunito_700Bold',
        fontSize: 14,
        color: '#2563eb',
    },
    startHolidayButton: {
        backgroundColor: '#2563eb',
        borderRadius: 12,
        paddingVertical: 14,
        alignItems: 'center',
    },
    startHolidayButtonHover: {
        backgroundColor: '#1d4ed8',
    },
    startHolidayButtonText: {
        fontFamily: 'Nunito_700Bold',
        fontSize: 16,
        color: '#ffffff',
    },
    holidayDisabled: {
        backgroundColor: '#e2e8f0',
        borderRadius: 12,
        paddingVertical: 14,
        alignItems: 'center',
    },
    holidayDisabledText: {
        fontFamily: 'Nunito_600SemiBold',
        fontSize: 14,
        color: '#64748b',
    },
});
