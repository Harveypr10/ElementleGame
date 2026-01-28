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

export default function TermsScreen() {
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
                    className="flex-row items-center justify-between px-4 py-3"
                    style={{ backgroundColor: surfaceColor }}
                >
                    <StyledTouchableOpacity
                        onPress={() => router.back()}
                        className="w-10 h-10 items-center justify-center"
                    >
                        <ChevronLeft size={28} color={iconColor} />
                    </StyledTouchableOpacity>
                    <ThemedText baseSize={20} className="font-n-bold">Terms of Service</ThemedText>
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
                        Acceptance of Terms
                    </ThemedText>
                    <ThemedText baseSize={16} style={{ color: secondaryTextColor }} className="mb-4">
                        By accessing and using Elementle, you accept and agree to be bound by the terms and provision of this agreement.
                    </ThemedText>

                    <ThemedText baseSize={18} className="font-n-bold mb-2">
                        Use License
                    </ThemedText>
                    <ThemedText baseSize={16} style={{ color: secondaryTextColor }} className="mb-4">
                        Permission is granted to temporarily use Elementle for personal, non-commercial use only.
                    </ThemedText>

                    <ThemedText baseSize={18} className="font-n-bold mb-2">
                        Contact
                    </ThemedText>
                    <ThemedText baseSize={16} style={{ color: secondaryTextColor }}>
                        For questions about these terms, please contact support@elementle.com
                    </ThemedText>
                </StyledView>
            </StyledScrollView>
        </ThemedView>
    );
}
