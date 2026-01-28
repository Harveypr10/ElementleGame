/**
 * Subscription Page
 * Displays subscription options using RevenueCat Paywall component
 */

import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { styled } from 'nativewind';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft } from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSubscription } from '../hooks/useSubscription';
import { useAuth } from '../lib/auth';
import { supabase } from '../lib/supabase';
import Paywall from '../components/Paywall';
import { ThemedView } from '../components/ThemedView';
import { ThemedText } from '../components/ThemedText';
import { useThemeColor } from '../hooks/useThemeColor';

const StyledView = styled(View);
const StyledText = styled(Text);
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
                    className="flex-row items-center px-4 py-3"
                    style={{ backgroundColor: surfaceColor }}
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
