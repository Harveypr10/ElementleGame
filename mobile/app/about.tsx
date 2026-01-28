import React from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { styled } from 'nativewind';
import { ChevronLeft } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Constants from 'expo-constants';
import { useOptions } from '../lib/options';

import { ThemedText } from '../components/ThemedText';
import { ThemedView } from '../components/ThemedView';
import { useThemeColor } from '../hooks/useThemeColor';

const StyledView = styled(View);
const StyledTouchableOpacity = styled(TouchableOpacity);
const StyledScrollView = styled(ScrollView);

export default function AboutScreen() {
    const router = useRouter();
    const { textScale } = useOptions();

    const surfaceColor = useThemeColor({}, 'surface');
    const borderColor = useThemeColor({}, 'border');
    const iconColor = useThemeColor({}, 'icon');
    const secondaryTextColor = useThemeColor({ light: '#64748b', dark: '#94a3b8' }, 'text');
    const tintColor = useThemeColor({}, 'tint');

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
                    <ThemedText baseSize={20} className="font-n-bold">About</ThemedText>
                    <StyledView className="w-10" />
                </StyledView>
            </SafeAreaView>

            <StyledScrollView className="flex-1 px-4 py-4">
                {/* App Info */}
                <StyledView
                    className="rounded-2xl p-4 mb-3 border"
                    style={{ backgroundColor: surfaceColor, borderColor: borderColor }}
                >
                    <ThemedText baseSize={24} className="font-n-bold text-center mb-2">
                        Elementle
                    </ThemedText>
                    <ThemedText baseSize={14} style={{ color: secondaryTextColor }} className="text-center mb-4">
                        Version {Constants.expoConfig?.version || '1.0.0'}
                    </ThemedText>
                    <ThemedText baseSize={16} className="text-center">
                        A daily puzzle game where you guess dates of historical events
                    </ThemedText>
                </StyledView>

                {/* Credits */}
                <StyledView
                    className="rounded-2xl p-4 mb-3 border"
                    style={{ backgroundColor: surfaceColor, borderColor: borderColor }}
                >
                    <ThemedText baseSize={14} style={{ color: secondaryTextColor }} className="font-n-bold uppercase tracking-wide mb-2">Credits</ThemedText>
                    <ThemedText baseSize={16} className="mb-1">
                        Developed by Elementle Team
                    </ThemedText>
                    <ThemedText baseSize={14} style={{ color: secondaryTextColor }}>
                        © {new Date().getFullYear()} Elementle. All rights reserved.
                    </ThemedText>
                </StyledView>

                {/* Contact */}
                <StyledView
                    className="rounded-2xl p-4 border"
                    style={{ backgroundColor: surfaceColor, borderColor: borderColor }}
                >
                    <ThemedText baseSize={14} style={{ color: secondaryTextColor }} className="font-n-bold uppercase tracking-wide mb-2">Contact</ThemedText>
                    <ThemedText baseSize={16} style={{ color: tintColor }}>
                        support@elementle.com
                    </ThemedText>
                </StyledView>
            </StyledScrollView>
        </ThemedView>
    );
}
