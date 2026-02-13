/**
 * Subscription Flow — "Subscribe First" workflow
 * Uses the same orange header style as the main subscription page
 */

import React from 'react';
import { View, Text, TouchableOpacity, useColorScheme, useWindowDimensions } from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { styled } from 'nativewind';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft } from 'lucide-react-native';
import Paywall from '../../components/Paywall';
import { useAuth } from '../../lib/auth';
import { ThemedText } from '../../components/ThemedText';
import { ThemedView } from '../../components/ThemedView';

const StyledView = styled(View);
const StyledTouchableOpacity = styled(TouchableOpacity);

export default function SubscriptionFlow() {
    const router = useRouter();
    const { user, isGuest } = useAuth();
    const colorScheme = useColorScheme();
    const isDark = colorScheme === 'dark';
    const { width: windowWidth } = useWindowDimensions();
    const isLargeScreen = windowWidth >= 768;

    const systemBackgroundColor = '#020617';

    return (
        <ThemedView className="flex-1" style={{ backgroundColor: isDark ? systemBackgroundColor : '#FAFBFC' }}>
            {/* Orange Header — matches category selection */}
            <StyledView style={{ backgroundColor: '#f97316' }}>
                <SafeAreaView edges={['top']} style={{ paddingHorizontal: 20, paddingBottom: 38 }}>
                    <StyledView style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8, position: 'relative' }}>
                        {/* Back Button */}
                        <StyledTouchableOpacity
                            onPress={() => {
                                if (user && !isGuest) {
                                    router.replace('/(auth)/category-selection');
                                } else {
                                    router.back();
                                }
                            }}
                            style={{ position: 'absolute', left: 0, top: 8, padding: 8, marginLeft: -8, zIndex: 10 }}
                        >
                            <ChevronLeft size={28} color="#FFFFFF" />
                        </StyledTouchableOpacity>

                        {/* Title */}
                        <StyledView style={{ flex: 1, alignItems: 'center', paddingHorizontal: isLargeScreen ? 48 : 40 }}>
                            <ThemedText className="font-n-bold font-heading" style={{ color: '#FFFFFF', lineHeight: isLargeScreen ? 48 : 36, textAlign: 'center' }} size={isLargeScreen ? "4xl" : "3xl"} numberOfLines={1}>
                                Go Pro
                            </ThemedText>
                        </StyledView>

                        {/* Hamster Image */}
                        <StyledView
                            style={{
                                position: 'absolute',
                                right: isLargeScreen ? 32 : 0,
                                top: isLargeScreen ? '50%' : 0,
                                transform: isLargeScreen ? [{ translateY: -36 }] : [],
                            }}
                        >
                            <Image
                                source={require('../../assets/ui/Signup-Hamster-Transparent.png')}
                                style={{ width: 61, height: 61 }}
                                contentFit="contain"
                                cachePolicy="disk"
                            />
                        </StyledView>
                    </StyledView>
                </SafeAreaView>
            </StyledView>

            {/* Paywall content */}
            <View style={{ flex: 1 }}>
                <Paywall
                    onLoginRequired={() => {
                        console.log('[SubscriptionFlow] Redirecting to signup...');
                        router.push('/(auth)/login?step=create-account&next=/subscription-flow');
                    }}
                    onPurchaseSuccess={() => {
                        console.log('[SubscriptionFlow] Purchase success');
                        router.replace('/(auth)/category-selection');
                    }}
                    onPurchaseCancel={() => {
                        console.log('[SubscriptionFlow] Purchase cancelled');
                    }}
                />
            </View>
        </ThemedView>
    );
}
