import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, Alert, ScrollView } from 'react-native';
import { styled } from 'nativewind';
import { Crown, Check, RefreshCw } from 'lucide-react-native';
import { getOfferings, purchasePackage, restorePurchases, syncSubscriptionToDatabase } from '../lib/RevenueCat';
import { useOptions } from '../lib/options';
import { supabase } from '../lib/supabase';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../lib/auth';

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

    useEffect(() => {
        loadOfferings();
    }, []);

    const loadOfferings = async () => {
        try {
            setLoading(true);
            const fetchedOfferings = await getOfferings();
            setOfferings(fetchedOfferings);

            // Auto-select annual package by default (or first package if annual not found)
            if (fetchedOfferings?.current?.availablePackages) {
                const annualPkg = fetchedOfferings.current.availablePackages.find((pkg: any) =>
                    pkg.identifier === '$rc_annual' || pkg.identifier.toLowerCase().includes('annual')
                );
                setSelectedPackage(annualPkg || fetchedOfferings.current.availablePackages[0]);
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

    const getPackageLabel = (identifier: string) => {
        const lower = identifier.toLowerCase();
        if (lower.includes('annual') || lower.includes('year')) return 'Annual';
        if (lower.includes('quarter') || lower.includes('3month')) return 'Quarterly';
        if (lower.includes('month') && !lower.includes('3month')) return 'Monthly';
        return identifier;
    };

    const getPackageDuration = (identifier: string) => {
        const lower = identifier.toLowerCase();
        if (lower.includes('annual') || lower.includes('year')) return '/ year';
        if (lower.includes('quarter') || lower.includes('3month')) return '/ 3 months';
        if (lower.includes('month') && !lower.includes('3month')) return '/ month';
        return '';
    };

    if (loading) {
        return (
            <StyledView className="flex-1 justify-center items-center bg-white dark:bg-slate-900">
                <ActivityIndicator size="large" color="#fb923c" />
                <StyledText className="text-slate-600 dark:text-slate-400 mt-4">
                    Loading subscription options...
                </StyledText>
            </StyledView>
        );
    }

    const currentOffering = offerings?.current;
    const packages = currentOffering?.availablePackages || [];

    if (!currentOffering || packages.length === 0) {
        return (
            <StyledView className="flex-1 justify-center items-center p-6 bg-white dark:bg-slate-900">
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
        <StyledScrollView className="flex-1 bg-white dark:bg-slate-900">
            <StyledView className="p-6">
                {/* Header */}
                <StyledView className="items-center mb-6">
                    <StyledView className="w-20 h-20 rounded-full bg-orange-100 dark:bg-orange-900/30 items-center justify-center mb-4">
                        <Crown size={40} color="#fb923c" />
                    </StyledView>
                    <StyledText
                        style={{ fontSize: 28 * textScale }}
                        className="font-n-bold text-slate-900 dark:text-white text-center mb-2"
                    >
                        Go Pro
                    </StyledText>
                    <StyledText
                        style={{ fontSize: 16 * textScale }}
                        className="text-slate-600 dark:text-slate-400 text-center"
                    >
                        Choose your plan
                    </StyledText>
                </StyledView>

                {/* Package Selection */}
                <StyledView className="mb-6">
                    {packages.map((pkg: any, index: number) => {
                        const isSelected = selectedPackage?.identifier === pkg.identifier;
                        const label = getPackageLabel(pkg.identifier);
                        const duration = getPackageDuration(pkg.identifier);

                        return (
                            <StyledTouchableOpacity
                                key={pkg.identifier}
                                onPress={() => setSelectedPackage(pkg)}
                                className={`mb-3 p-4 rounded-2xl border-2 ${isSelected
                                    ? 'border-orange-500 bg-orange-50 dark:bg-orange-950/20'
                                    : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800'
                                    }`}
                            >
                                <StyledView className="flex-row items-center justify-between">
                                    <StyledView className="flex-1">
                                        <StyledText
                                            style={{ fontSize: 18 * textScale }}
                                            className={`font-n-bold mb-1 ${isSelected ? 'text-orange-900 dark:text-orange-100' : 'text-slate-900 dark:text-white'
                                                }`}
                                        >
                                            {label}
                                        </StyledText>
                                        <StyledText
                                            style={{ fontSize: 14 * textScale }}
                                            className={isSelected ? 'text-orange-700 dark:text-orange-300' : 'text-slate-600 dark:text-slate-400'}
                                        >
                                            {pkg.product.priceString} {duration}
                                        </StyledText>
                                    </StyledView>
                                    <StyledView
                                        className={`w-6 h-6 rounded-full border-2 items-center justify-center ${isSelected
                                            ? 'border-orange-500 bg-orange-500'
                                            : 'border-slate-300 dark:border-slate-600'
                                            }`}
                                    >
                                        {isSelected && <StyledView className="w-3 h-3 rounded-full bg-white" />}
                                    </StyledView>
                                </StyledView>
                            </StyledTouchableOpacity>
                        );
                    })}
                </StyledView>

                {/* Features List */}
                <StyledView className="bg-slate-50 dark:bg-slate-800 rounded-2xl p-4 mb-6">
                    <StyledText
                        style={{ fontSize: 18 * textScale }}
                        className="font-n-bold text-slate-900 dark:text-white mb-4"
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
                        <StyledView key={index} className="flex-row items-center mb-3">
                            <StyledView className="w-6 h-6 rounded-full bg-green-500 items-center justify-center mr-3">
                                <Check size={16} color="#ffffff" />
                            </StyledView>
                            <StyledText
                                style={{ fontSize: 15 * textScale }}
                                className="text-slate-700 dark:text-slate-300 flex-1"
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
                    className="bg-orange-500 py-4 rounded-2xl items-center mb-4"
                    style={{ opacity: (purchasing || !selectedPackage) ? 0.7 : 1 }}
                >
                    {purchasing ? (
                        <ActivityIndicator color="#ffffff" />
                    ) : (
                        <StyledText
                            style={{ fontSize: 18 * textScale }}
                            className="font-n-bold text-white"
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
                    className="py-3 items-center"
                >
                    {restoring ? (
                        <ActivityIndicator color="#94a3b8" size="small" />
                    ) : (
                        <StyledView className="flex-row items-center">
                            <RefreshCw size={16} color="#94a3b8" style={{ marginRight: 8 }} />
                            <StyledText
                                style={{ fontSize: 14 * textScale }}
                                className="text-slate-500 dark:text-slate-400"
                            >
                                Restore Purchases
                            </StyledText>
                        </StyledView>
                    )}
                </StyledTouchableOpacity>

                {/* Fine Print */}
                <StyledText
                    style={{ fontSize: 12 * textScale }}
                    className="text-slate-400 dark:text-slate-600 text-center mt-4"
                >
                    Subscription automatically renews unless cancelled at least 24 hours before the end of the current period.
                </StyledText>
            </StyledView>
        </StyledScrollView>
    );
}
