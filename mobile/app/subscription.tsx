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
import { ThemedView } from '../components/ThemedView';
import { ThemedText } from '../components/ThemedText';
import { useThemeColor } from '../hooks/useThemeColor';

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

    const backgroundColor = useThemeColor({}, 'background');
    const surfaceColor = useThemeColor({}, 'surface');
    const borderColor = useThemeColor({}, 'border');
    const textColor = useThemeColor({}, 'text');
    const iconColor = useThemeColor({}, 'icon');

    return (
        <ThemedView className="flex-1">
            <SafeAreaView edges={['top']} className="z-10" style={{ backgroundColor: surfaceColor }}>
                {/* Header with back button */}
                <StyledView
                    className="flex-row items-center px-4 py-3 border-b"
                    style={{ backgroundColor: surfaceColor, borderColor: borderColor }}
                >
                    <StyledTouchableOpacity
                        onPress={() => router.back()}
                        className="p-2 -ml-2"
                    >
                        <ChevronLeft size={28} color={iconColor} />
                    </StyledTouchableOpacity>
                    <ThemedText className="text-xl font-n-bold ml-2">
                        Go Pro
                    </ThemedText>
                </StyledView>
            </SafeAreaView>

            {/* RevenueCat Paywall Component - Note: Paywall needs to support theming or be compatible */}
            <View style={{ flex: 1, backgroundColor: backgroundColor }}>
                <Paywall
                    onPurchaseSuccess={() => {
                        // After successful purchase, navigate to category selection
                        router.replace('/category-selection');
                    }}
                    onPurchaseCancel={() => {
                        console.log('[Subscription] Purchase cancelled by user');
                    }}
                />
            </View>
        </ThemedView>
    );
}
