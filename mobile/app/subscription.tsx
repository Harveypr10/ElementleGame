/**
 * Subscription Page
 * Displays subscription options using RevenueCat Paywall component
 */

import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { styled } from 'nativewind';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft } from 'lucide-react-native';
import { useSubscription } from '../hooks/useSubscription';
import Paywall from '../components/Paywall';

const StyledView = styled(View);
const StyledText = styled(Text);
const StyledTouchableOpacity = styled(TouchableOpacity);

export default function SubscriptionPage() {
    const router = useRouter();
    const { isPro } = useSubscription();

    // If already Pro, redirect to manage subscription
    React.useEffect(() => {
        if (isPro) {
            router.replace('/manage-subscription');
        }
    }, [isPro]);

    return (
        <StyledView className="flex-1 bg-white dark:bg-slate-900">
            <SafeAreaView edges={['top']} className="bg-white dark:bg-slate-900">
                {/* Header with back button */}
                <StyledView className="flex-row items-center px-4 py-3 border-b border-slate-200 dark:border-slate-700">
                    <StyledTouchableOpacity
                        onPress={() => router.back()}
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
                onPurchaseSuccess={() => {
                    // After successful purchase, navigate to category selection
                    router.replace('/category-selection');
                }}
                onPurchaseCancel={() => {
                    console.log('[Subscription] Purchase cancelled by user');
                }}
            />
        </StyledView>
    );
}
