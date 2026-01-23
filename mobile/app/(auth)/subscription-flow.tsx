/**
 * Subscription Flow
 * "Subscribe First" workflow
 */

import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { styled } from 'nativewind';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft } from 'lucide-react-native';
import Paywall from '../../components/Paywall';
import { useAuth } from '../../lib/auth';

const StyledView = styled(View);
const StyledText = styled(Text);
const StyledTouchableOpacity = styled(TouchableOpacity);

export default function SubscriptionFlow() {
    const router = useRouter();
    const { user, isGuest } = useAuth();

    return (
        <StyledView className="flex-1 bg-white dark:bg-slate-900">
            <SafeAreaView edges={['top']} className="bg-white dark:bg-slate-900">
                {/* Header with back button */}
                <StyledView className="flex-row items-center px-4 py-3 border-b border-slate-200 dark:border-slate-700">
                    <StyledTouchableOpacity
                        onPress={() => {
                            if (user && !isGuest) {
                                // If logged in, go to category selection (likely skipping sub)
                                router.replace('/(auth)/category-selection');
                            } else {
                                // If guest, go back to landing
                                router.back();
                            }
                        }}
                        className="p-2 -ml-2"
                    >
                        <ChevronLeft size={28} color="#1e293b" />
                    </StyledTouchableOpacity>
                    <StyledText className="text-xl font-n-bold text-slate-900 dark:text-white ml-2">
                        Go Pro
                    </StyledText>
                </StyledView>
            </SafeAreaView>

            {/* RevenueCat Paywall Component */}
            <Paywall
                // If guest/not logged in, redirect to signup first
                onLoginRequired={() => {
                    console.log('[SubscriptionFlow] Redirecting to signup...');
                    router.push('/(auth)/login?step=create-account&next=/subscription-flow');
                }}

                // On success, go to pro onboarding
                onPurchaseSuccess={() => {
                    console.log('[SubscriptionFlow] Purchase success');
                    router.replace('/(auth)/category-selection');
                }}

                // On cancel (if handled by paywall internally)
                onPurchaseCancel={() => {
                    console.log('[SubscriptionFlow] Purchase cancelled');
                }}
            />
        </StyledView>
    );
}
