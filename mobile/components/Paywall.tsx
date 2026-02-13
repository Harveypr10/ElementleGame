import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, Alert, ScrollView, useColorScheme } from 'react-native';
import { styled } from 'nativewind';
import { Check, RefreshCw } from 'lucide-react-native';
import { getOfferings, purchasePackage, restorePurchases, syncSubscriptionToDatabase } from '../lib/RevenueCat';
import { useOptions } from '../lib/options';
import { supabase } from '../lib/supabase';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../lib/auth';
import { ThemedText } from './ThemedText';

const StyledView = styled(View);
const StyledText = styled(Text);
const StyledTouchableOpacity = styled(TouchableOpacity);
const StyledScrollView = styled(ScrollView);

interface PaywallProps {
    onPurchaseSuccess?: () => void;
    onPurchaseCancel?: () => void;
    onLoginRequired?: () => void;
}

export default function Paywall({ onPurchaseSuccess, onPurchaseCancel, onLoginRequired }: PaywallProps) {
    const [offerings, setOfferings] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [purchasing, setPurchasing] = useState(false);
    const [restoring, setRestoring] = useState(false);
    const [selectedPackage, setSelectedPackage] = useState<any>(null);
    const { textScale } = useOptions();
    const queryClient = useQueryClient();
    const { user } = useAuth();
    const colorScheme = useColorScheme();
    const isDark = colorScheme === 'dark';

    // Dark mode system colors
    const systemBackgroundColor = '#020617'; // slate-950
    const systemSurfaceColor = '#1e293b'; // slate-800

    useEffect(() => {
        loadOfferings();
    }, []);

    const loadOfferings = async () => {
        try {
            setLoading(true);
            const fetchedOfferings = await getOfferings();
            setOfferings(fetchedOfferings);

            // Auto-select most expensive package (last after sort)
            if (fetchedOfferings?.current?.availablePackages) {
                const sorted = [...fetchedOfferings.current.availablePackages].sort(
                    (a: any, b: any) => (a.product?.price ?? 0) - (b.product?.price ?? 0)
                );
                setSelectedPackage(sorted[sorted.length - 1]);
            }
        } catch (error) {
            console.error('[Paywall] Error loading offerings:', error);
            Alert.alert('Error', 'Could not load subscription options. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const handlePurchase = async () => {
        if (!selectedPackage) {
            Alert.alert('Error', 'Please select a subscription plan');
            return;
        }

        if (!user) {
            if (onLoginRequired) {
                onLoginRequired();
                return;
            }
            Alert.alert('Error', 'You must be logged in to purchase a subscription');
            return;
        }

        try {
            setPurchasing(true);
            const result = await purchasePackage(selectedPackage);

            if (result.success && result.isPro) {
                // Sync to Supabase (server verifies entitlement)
                console.log('[Paywall] Syncing subscription to database...');
                const syncResult = await syncSubscriptionToDatabase(supabase);

                if (syncResult.success) {
                    // Refresh subscription hook
                    queryClient.invalidateQueries({ queryKey: ['subscription'] });

                    Alert.alert(
                        'Success!',
                        'You are now a Pro member. Enjoy unlimited features!',
                        [
                            {
                                text: 'OK',
                                onPress: () => {
                                    if (onPurchaseSuccess) {
                                        onPurchaseSuccess();
                                    }
                                }
                            }
                        ]
                    );
                } else {
                    // Purchase succeeded but sync failed
                    console.warn('[Paywall] Purchase succeeded but database sync failed');
                    Alert.alert(
                        'Purchase Successful',
                        'Your purchase was completed successfully! Please tap "Restore Purchases" to activate Pro features, or restart the app.',
                        [
                            {
                                text: 'OK',
                                onPress: () => {
                                    if (onPurchaseSuccess) {
                                        onPurchaseSuccess();
                                    }
                                }
                            }
                        ]
                    );
                }
            } else if (result.success && !result.isPro) {
                // Purchase succeeded but entitlement not found
                console.warn('[Paywall] Purchase succeeded but pro entitlement not active');
                Alert.alert(
                    'Purchase Successful',
                    'Your purchase was completed successfully! Please restart the app or tap "Restore Purchases" to activate Pro features.',
                    [
                        {
                            text: 'OK',
                            onPress: () => {
                                if (onPurchaseSuccess) {
                                    onPurchaseSuccess();
                                }
                            }
                        }
                    ]
                );
            } else if (result.cancelled) {
                if (onPurchaseCancel) {
                    onPurchaseCancel();
                }
            } else {
                Alert.alert('Error', 'Purchase failed. Please try again.');
            }
        } catch (error) {
            console.error('[Paywall] Purchase error:', error);
            Alert.alert('Error', 'An unexpected error occurred. Please try again.');
        } finally {
            setPurchasing(false);
        }
    };

    const handleRestore = async () => {
        if (!user) {
            Alert.alert('Error', 'You must be logged in to restore purchases');
            return;
        }

        try {
            setRestoring(true);
            const result = await restorePurchases();

            if (result.success && result.isPro) {
                // Sync to database after restore
                console.log('[Paywall] Syncing restored subscription to database...');
                const syncResult = await syncSubscriptionToDatabase(supabase);

                if (syncResult.success) {
                    // Refresh subscription hook
                    queryClient.invalidateQueries({ queryKey: ['subscription'] });
                }

                Alert.alert(
                    'Restored!',
                    'Your Pro subscription has been restored.',
                    [
                        {
                            text: 'OK',
                            onPress: () => {
                                if (onPurchaseSuccess) {
                                    onPurchaseSuccess();
                                }
                            }
                        }
                    ]
                );
            } else if (result.success && !result.isPro) {
                Alert.alert('No Active Subscription', 'No active Pro subscription found to restore.');
            } else {
                Alert.alert('Error', 'Could not restore purchases. Please try again.');
            }
        } catch (error) {
            console.error('[Paywall] Restore error:', error);
            Alert.alert('Error', 'An unexpected error occurred. Please try again.');
        } finally {
            setRestoring(false);
        }
    };

    // Derive labels from identifier first (safety override), then fall back to packageType
    const getPackageLabel = (pkg: any): string => {
        const id = (pkg.product?.identifier ?? pkg.identifier ?? '').toLowerCase();
        if (id.includes('quarterly') || id.includes('3month') || id.includes('three_month')) return 'Quarterly';
        if (id.includes('annual') || id.includes('yearly')) return 'Annual';
        if (id.includes('lifetime')) return 'Lifetime';
        // Fallback to RevenueCat packageType
        switch (pkg.packageType) {
            case 'ANNUAL': return 'Annual';
            case 'SIX_MONTH': return '6 Month';
            case 'THREE_MONTH': return 'Quarterly';
            case 'TWO_MONTH': return '2 Month';
            case 'MONTHLY': return 'Monthly';
            case 'WEEKLY': return 'Weekly';
            case 'LIFETIME': return 'Lifetime';
            default: return pkg.identifier;
        }
    };

    const getPackageDuration = (pkg: any): string => {
        const id = (pkg.product?.identifier ?? pkg.identifier ?? '').toLowerCase();
        if (id.includes('quarterly') || id.includes('3month') || id.includes('three_month')) return '/ 3 months';
        if (id.includes('annual') || id.includes('yearly')) return '/ year';
        if (id.includes('lifetime')) return '';
        // Fallback to RevenueCat packageType
        switch (pkg.packageType) {
            case 'ANNUAL': return '/ year';
            case 'SIX_MONTH': return '/ 6 months';
            case 'THREE_MONTH': return '/ 3 months';
            case 'TWO_MONTH': return '/ 2 months';
            case 'MONTHLY': return '/ month';
            case 'WEEKLY': return '/ week';
            case 'LIFETIME': return '';
            default: return '';
        }
    };

    if (loading) {
        return (
            <StyledView className="flex-1 justify-center items-center" style={{ backgroundColor: isDark ? systemBackgroundColor : '#FAFBFC' }}>
                <ActivityIndicator size="large" color="#fb923c" />
                <StyledText className="text-slate-600 dark:text-slate-400 mt-4">
                    Loading subscription options...
                </StyledText>
            </StyledView>
        );
    }

    const currentOffering = offerings?.current;
    // Sort packages by price: cheapest first, most expensive last
    const packages = [...(currentOffering?.availablePackages || [])].sort(
        (a: any, b: any) => (a.product?.price ?? 0) - (b.product?.price ?? 0)
    );

    if (!currentOffering || packages.length === 0) {
        return (
            <StyledView className="flex-1 justify-center items-center p-6" style={{ backgroundColor: isDark ? systemBackgroundColor : '#FAFBFC' }}>
                <StyledText className="text-slate-900 dark:text-white text-xl font-n-bold mb-2">
                    No Subscriptions Available
                </StyledText>
                <StyledText className="text-slate-600 dark:text-slate-400 text-center mb-4">
                    Could not load subscription options. Please try again later.
                </StyledText>
                <StyledTouchableOpacity
                    onPress={loadOfferings}
                    className="bg-blue-600 px-6 py-3 rounded-xl"
                >
                    <StyledText className="text-white font-n-bold">Retry</StyledText>
                </StyledTouchableOpacity>
            </StyledView>
        );
    }

    return (
        <StyledScrollView
            style={{ flex: 1, marginTop: -18 }}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 40 }}
        >
            <StyledView style={{ paddingHorizontal: 16, width: '100%', maxWidth: 768, alignSelf: 'center' }}>
                {/* Package Selection — card style matching category boxes */}
                <StyledView style={{ gap: 10, paddingBottom: 16 }}>
                    {packages.map((pkg: any) => {
                        const isSelected = selectedPackage?.identifier === pkg.identifier;
                        const label = getPackageLabel(pkg);
                        const duration = getPackageDuration(pkg);
                        const isAnnual = label === 'Annual';

                        // Box colors: white default → grey when selected (matching category-selection)
                        const itemBg = isSelected ? '#64748B' : (isDark ? systemSurfaceColor : '#FFFFFF');
                        const itemTextColor = isSelected ? '#FFFFFF' : (isDark ? '#FFFFFF' : '#1e293b');
                        const itemSubTextColor = isSelected ? 'rgba(255,255,255,0.8)' : (isDark ? '#94a3b8' : '#64748b');

                        return (
                            <StyledTouchableOpacity
                                key={pkg.identifier}
                                onPress={() => setSelectedPackage(pkg)}
                                style={{
                                    borderRadius: 12,
                                    paddingHorizontal: 16,
                                    paddingVertical: 16,
                                    backgroundColor: itemBg,
                                    borderColor: isSelected ? '#64748B' : 'transparent',
                                    borderWidth: 1,
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    shadowColor: '#000',
                                    shadowOffset: { width: 0, height: 2 },
                                    shadowOpacity: isSelected || isDark ? 0 : 0.05,
                                    shadowRadius: 3,
                                    elevation: isSelected || isDark ? 0 : 2,
                                }}
                            >
                                <StyledView style={{ flex: 1 }}>
                                    <StyledText
                                        style={{ fontSize: 18 * textScale, fontFamily: 'Nunito_700Bold', color: itemTextColor, marginBottom: 2 }}
                                    >
                                        {label}
                                    </StyledText>
                                    <StyledText
                                        style={{ fontSize: 14 * textScale, fontFamily: 'Nunito_400Regular', color: itemSubTextColor }}
                                    >
                                        {pkg.product.priceString} {duration}
                                    </StyledText>
                                </StyledView>

                                {/* Radio Button */}
                                <StyledView
                                    style={{
                                        width: 24,
                                        height: 24,
                                        borderRadius: 12,
                                        borderWidth: 2,
                                        borderColor: isSelected ? '#FFFFFF' : (isDark ? '#475569' : '#cbd5e1'),
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        backgroundColor: isSelected ? 'rgba(255,255,255,0.2)' : 'transparent',
                                    }}
                                >
                                    {isSelected && (
                                        <StyledView style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: '#FFFFFF' }} />
                                    )}
                                </StyledView>

                                {/* Best Value badge — Annual only, vertically centered */}
                                {isAnnual && (
                                    <StyledView
                                        style={{
                                            position: 'absolute',
                                            top: 0,
                                            bottom: 0,
                                            right: '20%',
                                            justifyContent: 'center',
                                        }}
                                    >
                                        <StyledView
                                            style={{
                                                backgroundColor: '#22c55e',
                                                borderRadius: 14,
                                                paddingHorizontal: 10,
                                                paddingVertical: 6,
                                                flexDirection: 'row',
                                                alignItems: 'center',
                                                shadowColor: '#000',
                                                shadowOffset: { width: 0, height: 1 },
                                                shadowOpacity: 0.15,
                                                shadowRadius: 2,
                                                elevation: 2,
                                            }}
                                        >
                                            <Check size={16} color="#FFFFFF" strokeWidth={3} style={{ marginRight: 4 }} />
                                            <StyledText style={{ fontSize: 14, fontFamily: 'Nunito_700Bold', color: '#FFFFFF' }}>
                                                Best Value
                                            </StyledText>
                                        </StyledView>
                                    </StyledView>
                                )}
                            </StyledTouchableOpacity>
                        );
                    })}
                </StyledView>

                {/* Features List — slightly darker than page bg */}
                <StyledView
                    style={{
                        backgroundColor: isDark ? systemSurfaceColor : '#E8EAED',
                        borderRadius: 16,
                        padding: 16,
                        marginBottom: 20,
                    }}
                >
                    <StyledText
                        style={{ fontSize: 18 * textScale, fontFamily: 'Nunito_700Bold', color: isDark ? '#FFFFFF' : '#1e293b', marginBottom: 14 }}
                    >
                        What's Included:
                    </StyledText>

                    {[
                        'No banner ads anywhere',
                        'No ads after completing puzzles',
                        'Unlimited personalised games',
                        'Choose your own categories',
                        '6 monthly Streak Savers (3 per game)',
                        '4 streak protecting annual holiday periods',
                    ].map((feature, index) => (
                        <StyledView key={index} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                            <StyledView style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: '#22c55e', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                                <Check size={16} color="#ffffff" />
                            </StyledView>
                            <StyledText
                                style={{ fontSize: 15 * textScale, fontFamily: 'Nunito_400Regular', color: isDark ? '#cbd5e1' : '#475569', flex: 1 }}
                            >
                                {feature}
                            </StyledText>
                        </StyledView>
                    ))}
                </StyledView>

                {/* Subscribe Button */}
                <StyledTouchableOpacity
                    onPress={handlePurchase}
                    disabled={purchasing || !selectedPackage}
                    style={{
                        backgroundColor: '#f97316',
                        paddingVertical: 16,
                        borderRadius: 16,
                        alignItems: 'center',
                        marginBottom: 12,
                        opacity: (purchasing || !selectedPackage) ? 0.7 : 1,
                    }}
                >
                    {purchasing ? (
                        <ActivityIndicator color="#ffffff" />
                    ) : (
                        <StyledText
                            style={{ fontSize: 18 * textScale, fontFamily: 'Nunito_700Bold', color: '#FFFFFF' }}
                        >
                            {selectedPackage
                                ? `Subscribe - ${selectedPackage.product.priceString}`
                                : 'Select a Plan'
                            }
                        </StyledText>
                    )}
                </StyledTouchableOpacity>

                {/* Restore Purchases Button */}
                <StyledTouchableOpacity
                    onPress={handleRestore}
                    disabled={restoring}
                    style={{ paddingVertical: 12, alignItems: 'center' }}
                >
                    {restoring ? (
                        <ActivityIndicator color="#94a3b8" size="small" />
                    ) : (
                        <StyledView style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <RefreshCw size={16} color="#94a3b8" style={{ marginRight: 8 }} />
                            <StyledText
                                style={{ fontSize: 14 * textScale, fontFamily: 'Nunito_400Regular', color: '#94a3b8' }}
                            >
                                Restore Purchases
                            </StyledText>
                        </StyledView>
                    )}
                </StyledTouchableOpacity>

                {/* Fine Print */}
                <StyledText
                    style={{ fontSize: 12 * textScale, fontFamily: 'Nunito_400Regular', color: isDark ? '#475569' : '#94a3b8', textAlign: 'center', marginTop: 8 }}
                >
                    Subscription automatically renews unless cancelled at least 24 hours before the end of the current period.
                </StyledText>
            </StyledView>
        </StyledScrollView>
    );
}
