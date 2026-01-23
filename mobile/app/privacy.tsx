import React from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { styled } from 'nativewind';
import { ChevronLeft } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useOptions } from '../lib/options';

import { ThemedText } from '../components/ThemedText';
import { ThemedView } from '../components/ThemedView';
import { useThemeColor } from '../hooks/useThemeColor';

const StyledView = styled(View);
const StyledTouchableOpacity = styled(TouchableOpacity);
const StyledScrollView = styled(ScrollView);

export default function PrivacyScreen() {
    const router = useRouter();
    const { textScale } = useOptions();

    const surfaceColor = useThemeColor({}, 'surface');
    const borderColor = useThemeColor({}, 'border');
    const iconColor = useThemeColor({}, 'icon');
    const secondaryTextColor = useThemeColor({ light: '#64748b', dark: '#94a3b8' }, 'text');

    return (
        <ThemedView className="flex-1">
            <SafeAreaView edges={['top']} style={{ backgroundColor: surfaceColor }}>
                <StyledView
                    className="flex-row items-center justify-between px-4 py-3 border-b"
                    style={{ backgroundColor: surfaceColor, borderColor: borderColor }}
                >
                    <StyledTouchableOpacity
                        onPress={() => router.back()}
                        className="w-10 h-10 items-center justify-center"
                    >
                        <ChevronLeft size={28} color={iconColor} />
                    </StyledTouchableOpacity>
                    <ThemedText baseSize={20} className="font-n-bold">Privacy Policy</ThemedText>
                    <StyledView className="w-10" />
                </StyledView>
            </SafeAreaView>

            <StyledScrollView className="flex-1 px-4 py-4">
                <StyledView
                    className="rounded-2xl p-4 border"
                    style={{ backgroundColor: surfaceColor, borderColor: borderColor }}
                >
                    <ThemedText baseSize={16} className="mb-4">
                        Last updated: {new Date().toLocaleDateString()}
                    </ThemedText>

                    <ThemedText baseSize={18} className="font-n-bold mb-2">
                        Data Collection
                    </ThemedText>
                    <ThemedText baseSize={16} style={{ color: secondaryTextColor }} className="mb-4">
                        We collect minimal data necessary to provide you with the best experience. This includes your email, game progress, and preferences.
                    </ThemedText>

                    <ThemedText baseSize={18} className="font-n-bold mb-2">
                        Data Usage
                    </ThemedText>
                    <ThemedText baseSize={16} style={{ color: secondaryTextColor }} className="mb-4">
                        Your data is used solely to provide and improve our services. We never sell your personal information to third parties.
                    </ThemedText>

                    <ThemedText baseSize={18} className="font-n-bold mb-2">
                        Contact Us
                    </ThemedText>
                    <ThemedText baseSize={16} style={{ color: secondaryTextColor }}>
                        If you have any questions about our privacy policy, please contact us at support@elementle.com
                    </ThemedText>
                </StyledView>
            </StyledScrollView>
        </ThemedView>
    );
}
