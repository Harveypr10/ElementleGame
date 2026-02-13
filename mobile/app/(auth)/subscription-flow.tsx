/**
 * Subscription Flow — "Subscribe First" workflow
 * Uses the same orange header style as the main subscription page
 */

import React, { useEffect } from 'react';
import { View, Text, TouchableOpacity, useColorScheme, useWindowDimensions } from 'react-native';
import { Image } from 'expo-image';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { styled } from 'nativewind';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft } from 'lucide-react-native';
import Paywall from '../../components/Paywall';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/auth';
import { useSubscription } from '../../hooks/useSubscription';
import { ThemedText } from '../../components/ThemedText';
import { ThemedView } from '../../components/ThemedView';

const StyledView = styled(View);
const StyledTouchableOpacity = styled(TouchableOpacity);

export default function SubscriptionFlow() {
    const router = useRouter();
    const params = useLocalSearchParams<{ newSignup?: string }>();
    const { user, isGuest } = useAuth();
    const { isPro, isLoading: isSubLoading } = useSubscription();
    const colorScheme = useColorScheme();
    const isDark = colorScheme === 'dark';
    const { width: windowWidth } = useWindowDimensions();
    const isLargeScreen = windowWidth >= 768;

    const isNewSignup = params.newSignup === '1';
    const systemBackgroundColor = '#020617';

    // If user is already Pro, skip directly to the appropriate next screen
    useEffect(() => {
        if (!isSubLoading && user && !isGuest && isPro) {
            console.log('[SubscriptionFlow] User is already Pro, skipping subscribe screen');
            if (isNewSignup) {
                // New signup who is somehow already Pro — go to category selection
                router.replace('/(auth)/category-selection');
            } else {
                // Existing Pro user — go home
                router.replace('/');
            }
        }
    }, [isPro, isSubLoading, user, isGuest]);

    const handleBack = async () => {
        if (user && !isGuest) {
            if (isNewSignup) {
                // New signup skipping subscribe — need to generate questions first
                try {
                    const { data: profile } = await supabase
                        .from('user_profiles')
                        .select('region, postcode')
                        .eq('id', user.id)
                        .single();

                    router.replace({
                        pathname: '/(auth)/generating-questions',
                        params: {
                            userId: user.id,
                            region: profile?.region || 'UK',
                            postcode: profile?.postcode || '',
                        },
                    });
                } catch {
                    router.replace('/(auth)/generating-questions');
                }
            } else {
                // Existing user skipping subscribe — already has questions, go home
                router.replace('/');
            }
        } else {
            router.back();
        }
    };

    return (
        <ThemedView className="flex-1" style={{ backgroundColor: isDark ? systemBackgroundColor : '#FAFBFC' }}>
            {/* Orange Header — matches category selection */}
            <StyledView style={{ backgroundColor: '#f97316' }}>
                <SafeAreaView edges={['top']} style={{ paddingHorizontal: 20, paddingBottom: 38 }}>
                    <StyledView style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8, position: 'relative' }}>
                        {/* Back Button */}
                        <StyledTouchableOpacity
                            onPress={handleBack}
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
                        console.log('[SubscriptionFlow] Redirecting to login...');
                        router.push('/(auth)/login?subscribeFirst=1');
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

