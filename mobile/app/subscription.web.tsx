/**
 * subscription.web.tsx
 * Web implementation with Stripe checkout pricing cards
 */

import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView, ActivityIndicator, Modal } from 'react-native';
import { ChevronLeft, Crown, Flame, Umbrella, Check, X, AlertTriangle } from 'lucide-react-native';
import { useGoProLogic, TierData, formatPrice, getTierStyle } from '../hooks/useGoProLogic';

export default function SubscriptionWeb() {
    const {
        isPro,
        isAuthenticated,
        tiers,
        tiersLoading,
        selectedTier,
        showConfirmDialog,
        isProcessing,
        error,
        handleTierClick,
        handleCancelConfirm,
        handleConfirmSubscription,
        goBack,
    } = useGoProLogic();

    // Hover states
    const [backHover, setBackHover] = useState(false);
    const [tierHoverIndex, setTierHoverIndex] = useState<number | null>(null);
    const [cancelHover, setCancelHover] = useState(false);
    const [confirmHover, setConfirmHover] = useState(false);

    if (isPro) {
        return null; // Will redirect in hook
    }

    // Benefits list
    const proBenefits = [
        { icon: Flame, text: '3 Monthly Streak Savers (per game)', color: '#f59e0b' },
        { icon: Umbrella, text: '14-Day Holiday Mode yearly', color: '#3b82f6' },
        { icon: Crown, text: 'Support the developer!', color: '#fb923c' },
    ];

    return (
        <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
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
                        <Text style={styles.backButtonText}>Back</Text>
                    </Pressable>
                </View>

                {/* Hero Section */}
                <View style={styles.heroSection}>
                    <View style={styles.crownCircle}>
                        <Crown size={48} color="#fb923c" />
                    </View>
                    <Text style={styles.heroTitle}>Go Pro</Text>
                    <Text style={styles.heroSubtitle}>Unlock the full Elementle experience</Text>
                </View>

                {/* Benefits */}
                <View style={styles.benefitsCard}>
                    <Text style={styles.benefitsTitle}>Pro Benefits</Text>
                    {proBenefits.map((benefit, index) => (
                        <View key={index} style={styles.benefitRow}>
                            <View style={[styles.benefitIcon, { backgroundColor: `${benefit.color}20` }]}>
                                <benefit.icon size={18} color={benefit.color} />
                            </View>
                            <Text style={styles.benefitText}>{benefit.text}</Text>
                        </View>
                    ))}
                </View>

                {/* Error message */}
                {error && (
                    <View style={styles.errorBanner}>
                        <AlertTriangle size={20} color="#dc2626" />
                        <Text style={styles.errorText}>{error}</Text>
                    </View>
                )}

                {/* Pricing Cards */}
                <View style={styles.pricingSection}>
                    <Text style={styles.pricingTitle}>Choose Your Plan</Text>

                    {tiersLoading ? (
                        <View style={styles.loadingContainer}>
                            <ActivityIndicator size="large" color="#fb923c" />
                            <Text style={styles.loadingText}>Loading plans...</Text>
                        </View>
                    ) : (
                        <View style={styles.tiersGrid}>
                            {tiers.map((tier, index) => {
                                const tierStyle = getTierStyle(tier.tierType);
                                const isHovered = tierHoverIndex === index;
                                const isBestValue = tier.tierType === 'annual';

                                return (
                                    <Pressable
                                        key={tier.id}
                                        onPress={() => handleTierClick(tier)}
                                        disabled={isProcessing}
                                        onHoverIn={() => setTierHoverIndex(index)}
                                        onHoverOut={() => setTierHoverIndex(null)}
                                        style={[
                                            styles.tierCard,
                                            isHovered && styles.tierCardHover,
                                            isBestValue && styles.tierCardBestValue,
                                        ]}
                                    >
                                        {isBestValue && (
                                            <View style={styles.bestValueBadge}>
                                                <Text style={styles.bestValueBadgeText}>Best Value</Text>
                                            </View>
                                        )}

                                        <Text style={[styles.tierLabel, { color: tierStyle.color }]}>
                                            {tierStyle.displayName}
                                        </Text>

                                        <Text style={styles.tierPrice}>
                                            {formatPrice(tier.subscriptionCost, tier.currency)}
                                        </Text>

                                        {tier.subscriptionDurationMonths && tier.subscriptionDurationMonths > 1 && (
                                            <Text style={styles.tierPriceNote}>
                                                ({formatPrice((tier.subscriptionCost || 0) / tier.subscriptionDurationMonths, tier.currency)}/mo)
                                            </Text>
                                        )}

                                        {tier.description && (
                                            <Text style={styles.tierDescription}>{tier.description}</Text>
                                        )}

                                        <View style={styles.tierFeatures}>
                                            <View style={styles.tierFeatureRow}>
                                                <Check size={16} color="#22c55e" />
                                                <Text style={styles.tierFeatureText}>{tier.streakSavers} streak savers/mo</Text>
                                            </View>
                                            <View style={styles.tierFeatureRow}>
                                                <Check size={16} color="#22c55e" />
                                                <Text style={styles.tierFeatureText}>{tier.holidaySavers}× {tier.holidayDurationDays}-day holiday</Text>
                                            </View>
                                        </View>

                                        <View style={[styles.selectButton, isHovered && styles.selectButtonHover]}>
                                            <Text style={[styles.selectButtonText, isHovered && styles.selectButtonTextHover]}>
                                                Select Plan
                                            </Text>
                                        </View>
                                    </Pressable>
                                );
                            })}
                        </View>
                    )}

                    <Text style={styles.lifetimeNote}>
                        * Lifetime access is valid for the current version of Elementle
                    </Text>
                </View>

                {/* Login prompt for unauthenticated users */}
                {!isAuthenticated && !tiersLoading && (
                    <View style={styles.loginPrompt}>
                        <Text style={styles.loginPromptText}>
                            Please sign in to subscribe
                        </Text>
                    </View>
                )}
            </View>

            {/* Confirm Dialog */}
            <Modal
                visible={showConfirmDialog}
                transparent
                animationType="fade"
                onRequestClose={handleCancelConfirm}
            >
                <Pressable style={styles.modalOverlay} onPress={handleCancelConfirm}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Crown size={32} color="#fb923c" />
                            <Text style={styles.modalTitle}>Confirm Subscription</Text>
                        </View>

                        {selectedTier && (
                            <View style={styles.modalBody}>
                                <Text style={styles.modalDescription}>
                                    Subscribe to <Text style={styles.modalBold}>Pro {getTierStyle(selectedTier.tierType).displayName}</Text> for{' '}
                                    <Text style={styles.modalBold}>{formatPrice(selectedTier.subscriptionCost, selectedTier.currency)}</Text>?
                                </Text>
                                <Text style={styles.modalNote}>
                                    You'll be redirected to Stripe's secure checkout.
                                </Text>
                            </View>
                        )}

                        <View style={styles.modalActions}>
                            <Pressable
                                onPress={handleCancelConfirm}
                                onHoverIn={() => setCancelHover(true)}
                                onHoverOut={() => setCancelHover(false)}
                                style={[styles.cancelButton, cancelHover && styles.cancelButtonHover]}
                            >
                                <Text style={styles.cancelButtonText}>Cancel</Text>
                            </Pressable>
                            <Pressable
                                onPress={handleConfirmSubscription}
                                onHoverIn={() => setConfirmHover(true)}
                                onHoverOut={() => setConfirmHover(false)}
                                style={[styles.confirmButton, confirmHover && styles.confirmButtonHover]}
                            >
                                <Text style={styles.confirmButtonText}>Continue to Checkout</Text>
                            </Pressable>
                        </View>
                    </View>
                </Pressable>
            </Modal>

            {/* Processing Overlay */}
            {isProcessing && (
                <View style={styles.processingOverlay}>
                    <View style={styles.processingCard}>
                        <ActivityIndicator size="large" color="#fb923c" />
                        <Text style={styles.processingText}>Redirecting to checkout...</Text>
                    </View>
                </View>
            )}
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F8FAFC',
    },
    scrollContent: {
        alignItems: 'center',
        paddingTop: 40,
        paddingBottom: 80,
        minHeight: '100%' as any,
    },
    contentWrapper: {
        width: '100%',
        maxWidth: 640,
        paddingHorizontal: 16,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
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
    heroSection: {
        alignItems: 'center',
        marginBottom: 32,
    },
    crownCircle: {
        width: 96,
        height: 96,
        borderRadius: 48,
        backgroundColor: '#fff7ed',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 16,
        shadowColor: '#fb923c',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 12,
    },
    heroTitle: {
        fontFamily: 'Nunito_800ExtraBold',
        fontSize: 36,
        color: '#0f172a',
        marginBottom: 8,
    },
    heroSubtitle: {
        fontFamily: 'Nunito_500Medium',
        fontSize: 18,
        color: '#64748b',
    },
    benefitsCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 20,
        padding: 24,
        marginBottom: 32,
        shadowColor: '#64748B',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.08,
        shadowRadius: 16,
    },
    benefitsTitle: {
        fontFamily: 'Nunito_700Bold',
        fontSize: 18,
        color: '#0f172a',
        marginBottom: 16,
    },
    benefitRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
    },
    benefitIcon: {
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
    },
    benefitText: {
        fontFamily: 'Nunito_600SemiBold',
        fontSize: 15,
        color: '#334155',
        flex: 1,
    },
    errorBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fef2f2',
        borderRadius: 12,
        padding: 16,
        marginBottom: 16,
        gap: 12,
        borderWidth: 1,
        borderColor: '#fecaca',
    },
    errorText: {
        fontFamily: 'Nunito_600SemiBold',
        fontSize: 14,
        color: '#dc2626',
        flex: 1,
    },
    pricingSection: {
        marginBottom: 24,
    },
    pricingTitle: {
        fontFamily: 'Nunito_700Bold',
        fontSize: 20,
        color: '#0f172a',
        textAlign: 'center',
        marginBottom: 16,
    },
    loadingContainer: {
        alignItems: 'center',
        paddingVertical: 48,
    },
    loadingText: {
        fontFamily: 'Nunito_500Medium',
        fontSize: 16,
        color: '#64748b',
        marginTop: 12,
    },
    tiersGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'center',
        gap: 16,
    },
    tierCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 20,
        padding: 24,
        width: 200,
        alignItems: 'center',
        borderWidth: 2,
        borderColor: '#e2e8f0',
        shadowColor: '#64748B',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.08,
        shadowRadius: 12,
    },
    tierCardHover: {
        borderColor: '#fb923c',
        shadowOpacity: 0.15,
    },
    tierCardBestValue: {
        borderColor: '#fb923c',
    },
    bestValueBadge: {
        position: 'absolute',
        top: -12,
        backgroundColor: '#fb923c',
        paddingHorizontal: 12,
        paddingVertical: 4,
        borderRadius: 12,
    },
    bestValueBadgeText: {
        fontFamily: 'Nunito_700Bold',
        fontSize: 11,
        color: '#ffffff',
        textTransform: 'uppercase',
    },
    tierLabel: {
        fontFamily: 'Nunito_700Bold',
        fontSize: 16,
        marginTop: 4,
        marginBottom: 8,
    },
    tierPrice: {
        fontFamily: 'Nunito_800ExtraBold',
        fontSize: 28,
        color: '#0f172a',
    },
    tierPriceNote: {
        fontFamily: 'Nunito_500Medium',
        fontSize: 13,
        color: '#64748b',
        marginTop: 2,
    },
    tierDescription: {
        fontFamily: 'Nunito_500Medium',
        fontSize: 13,
        color: '#64748b',
        textAlign: 'center',
        marginTop: 8,
    },
    tierFeatures: {
        marginTop: 16,
        alignItems: 'flex-start',
    },
    tierFeatureRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginBottom: 6,
    },
    tierFeatureText: {
        fontFamily: 'Nunito_500Medium',
        fontSize: 13,
        color: '#475569',
    },
    selectButton: {
        marginTop: 16,
        backgroundColor: '#f1f5f9',
        paddingVertical: 10,
        paddingHorizontal: 24,
        borderRadius: 12,
    },
    selectButtonHover: {
        backgroundColor: '#fb923c',
    },
    selectButtonText: {
        fontFamily: 'Nunito_700Bold',
        fontSize: 14,
        color: '#334155',
    },
    selectButtonTextHover: {
        color: '#ffffff',
    },
    lifetimeNote: {
        fontFamily: 'Nunito_400Regular',
        fontSize: 12,
        color: '#94a3b8',
        textAlign: 'center',
        marginTop: 16,
    },
    loginPrompt: {
        alignItems: 'center',
        paddingVertical: 24,
    },
    loginPromptText: {
        fontFamily: 'Nunito_600SemiBold',
        fontSize: 16,
        color: '#64748b',
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    modalContent: {
        backgroundColor: '#FFFFFF',
        borderRadius: 24,
        padding: 32,
        width: '90%',
        maxWidth: 400,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.25,
        shadowRadius: 24,
    },
    modalHeader: {
        alignItems: 'center',
        marginBottom: 20,
    },
    modalTitle: {
        fontFamily: 'Nunito_700Bold',
        fontSize: 22,
        color: '#0f172a',
        marginTop: 12,
    },
    modalBody: {
        alignItems: 'center',
        marginBottom: 24,
    },
    modalDescription: {
        fontFamily: 'Nunito_500Medium',
        fontSize: 16,
        color: '#334155',
        textAlign: 'center',
    },
    modalBold: {
        fontFamily: 'Nunito_700Bold',
    },
    modalNote: {
        fontFamily: 'Nunito_500Medium',
        fontSize: 14,
        color: '#64748b',
        textAlign: 'center',
        marginTop: 12,
    },
    modalActions: {
        flexDirection: 'row',
        gap: 12,
    },
    cancelButton: {
        flex: 1,
        backgroundColor: '#f1f5f9',
        paddingVertical: 14,
        borderRadius: 12,
        alignItems: 'center',
    },
    cancelButtonHover: {
        backgroundColor: '#e2e8f0',
    },
    cancelButtonText: {
        fontFamily: 'Nunito_700Bold',
        fontSize: 15,
        color: '#475569',
    },
    confirmButton: {
        flex: 1,
        backgroundColor: '#fb923c',
        paddingVertical: 14,
        borderRadius: 12,
        alignItems: 'center',
    },
    confirmButtonHover: {
        backgroundColor: '#f97316',
    },
    confirmButtonText: {
        fontFamily: 'Nunito_700Bold',
        fontSize: 15,
        color: '#ffffff',
    },
    processingOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(255,255,255,0.9)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    processingCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 20,
        padding: 32,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.15,
        shadowRadius: 24,
    },
    processingText: {
        fontFamily: 'Nunito_600SemiBold',
        fontSize: 16,
        color: '#334155',
        marginTop: 16,
    },
});
