/**
 * Subscription Page — Orange header style (matches Category Selection)
 * Displays subscription options using RevenueCat Paywall component
 */

import React from 'react';
import { View, Text, TouchableOpacity, useColorScheme, useWindowDimensions } from 'react-native';
import { Image } from 'expo-image';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { styled } from 'nativewind';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft } from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSubscription } from '../hooks/useSubscription';
import { useAuth } from '../lib/auth';
import { supabase } from '../lib/supabase';
import Paywall from '../components/Paywall';
import { ThemedText } from '../components/ThemedText';
import { ThemedView } from '../components/ThemedView';

const StyledView = styled(View);
const StyledTouchableOpacity = styled(TouchableOpacity);

// Helper for resetting date
const initializeHolidayResetDate = async (userId: string) => {
    try {
        const { data } = await supabase
            .from('user_stats_user')
            .select('next_holiday_reset_date')
            .eq('user_id', userId)
            .maybeSingle();

        if (!data?.next_holiday_reset_date) {
            const nextYear = new Date();
            nextYear.setFullYear(nextYear.getFullYear() + 1);
            console.log('[Subscription] Initializing next_holiday_reset_date to:', nextYear.toISOString());

            await supabase
                .from('user_stats_user')
                .update({ next_holiday_reset_date: nextYear.toISOString() })
                .eq('user_id', userId);
        }
    } catch (e) {
        console.error('[Subscription] Error init reset date:', e);
    }
};

export default function SubscriptionPage() {
    const router = useRouter();
    const { from } = useLocalSearchParams();
    const { isPro } = useSubscription();
    const { user } = useAuth();
    const colorScheme = useColorScheme();
    const isDark = colorScheme === 'dark';
    const { width: windowWidth } = useWindowDimensions();
    const isLargeScreen = windowWidth >= 768;

    // Dark mode system colors
    const systemBackgroundColor = '#020617'; // slate-950

    // If already Pro, redirect to manage subscription
    React.useEffect(() => {
        if (isPro) {
            router.replace('/manage-subscription');
        }
    }, [isPro]);

    return (
        <ThemedView className="flex-1" style={{ backgroundColor: isDark ? systemBackgroundColor : '#FAFBFC' }}>
            {/* Orange Header — matches Category Selection */}
            <StyledView style={{ backgroundColor: '#f97316' }}>
                <SafeAreaView edges={['top']} style={{ paddingHorizontal: 20, paddingBottom: 38 }}>
                    <StyledView style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8, position: 'relative' }}>
                        {/* Back Button - Absolute Left */}
                        <StyledTouchableOpacity
                            onPress={() => router.back()}
                            style={{ position: 'absolute', left: 0, top: 8, padding: 8, marginLeft: -8, zIndex: 10 }}
                        >
                            <ChevronLeft size={28} color="#FFFFFF" />
                        </StyledTouchableOpacity>

                        {/* Title - Centered */}
                        <StyledView style={{ flex: 1, alignItems: 'center', paddingHorizontal: isLargeScreen ? 48 : 40 }}>
                            <ThemedText className="font-n-bold font-heading" style={{ color: '#FFFFFF', lineHeight: isLargeScreen ? 48 : 36, textAlign: 'center', maxWidth: '100%' }} size={isLargeScreen ? "4xl" : "3xl"} numberOfLines={1} adjustsFontSizeToFit>
                                Go Pro
                            </ThemedText>
                        </StyledView>

                        {/* Hamster Image - Absolute Right */}
                        <StyledView
                            style={{
                                position: 'absolute',
                                right: isLargeScreen ? 32 : 0,
                                top: isLargeScreen ? '50%' : 0,
                                transform: isLargeScreen ? [{ translateY: -36 }] : [],
                            }}
                        >
                            <Image
                                source={require('../assets/ui/Signup-Hamster-Transparent.png')}
                                style={{ width: 61, height: 61 }}
                                contentFit="contain"
                                cachePolicy="disk"
                            />
                        </StyledView>
                    </StyledView>
                </SafeAreaView>
            </StyledView>

            {/* Paywall content — overlapping orange header */}
            <View style={{ flex: 1 }}>
                <Paywall
                    onPurchaseSuccess={async () => {
                        // [NEW] Initialize Reset Date if needed
                        if (user?.id) {
                            await initializeHolidayResetDate(user.id);
                        }

                        // After successful purchase, navigate accordingly
                        if (from === 'streakSaver') {
                            await AsyncStorage.setItem('streak_saver_upgrade_pending', 'true');
                            router.back();
                        } else {
                            router.replace('/category-selection');
                        }
                    }}
                    onPurchaseCancel={() => {
                        console.log('[Subscription] Purchase cancelled by user');
                    }}
                />
            </View>
        </ThemedView>
    );
}
