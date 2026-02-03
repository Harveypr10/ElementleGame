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

    const sections = [
        {
            title: "1. Acceptance of Terms",
            content: "By accessing and using Elementle, you accept and agree to be bound by these Terms of Use. If you do not agree to these terms, please do not use the service."
        },
        {
            title: "2. Use of Service",
            content: "Elementle is a daily historical date-guessing puzzle game. You may:\n• Play as a guest with local storage only\n• Create an account to save progress permanently\n• Access daily puzzles and archived puzzles"
        },
        {
            title: "3. User Accounts",
            content: "When creating an account, you agree to provide accurate information and maintain the security of your password. You are responsible for all activities under your account."
        },
        {
            title: "4. Intellectual Property",
            content: "All content, including puzzles, design, and code, is owned by the service provider. You may not reproduce, distribute, or create derivative works without permission."
        },
        {
            title: "5. User Conduct",
            content: "You agree not to:\n• Use automated tools or bots to play the game\n• Attempt to hack or disrupt the service\n• Share solutions publicly before the daily puzzle expires"
        },
        {
            title: "6. Limitation of Liability",
            content: "The service is provided \"as is\" without warranties of any kind. We are not liable for any damages arising from your use of the service."
        },
        {
            title: "7. Changes to Terms",
            content: "We reserve the right to modify these terms at any time. Continued use of the service constitutes acceptance of any changes."
        },
        {
            title: "8. Contact",
            content: "For questions about these Terms of Use, please contact us through the Support section in Settings."
        }
    ];

    return (
        <ThemedView className="flex-1">
            <SafeAreaView edges={['top']} style={{ backgroundColor: surfaceColor }}>
                <StyledView
                    className="flex-row items-center justify-between px-4 py-3"
                    style={{ backgroundColor: surfaceColor }}
                >
                    <StyledTouchableOpacity
                        onPress={() => router.back()}
                        className="w-10 h-10 items-center justify-center p-2"
                    >
                        <ChevronLeft size={28} color={iconColor} />
                    </StyledTouchableOpacity>
                    <ThemedText size="2xl" className="font-n-bold">Terms of Service</ThemedText>
                    <StyledView className="w-10" />
                </StyledView>
            </SafeAreaView>

            <StyledScrollView className="flex-1 px-4 py-4" contentContainerStyle={{ paddingBottom: 40 }}>
                <StyledView className="w-full max-w-3xl self-center">
                    <ThemedText size="sm" style={{ color: secondaryTextColor }} className="mb-6 text-center">
                        Last updated: October 2025
                    </ThemedText>

                    <StyledView
                        className="rounded-2xl p-5 border mb-6"
                        style={{ backgroundColor: surfaceColor, borderColor: borderColor }}
                    >
                        {sections.map((section, index) => (
                            <StyledView key={index} className={`mb-6 ${index === sections.length - 1 ? 'mb-0' : ''}`}>
                                <ThemedText size="lg" className="font-n-bold mb-2">
                                    {section.title}
                                </ThemedText>
                                <ThemedText size="base" style={{ color: secondaryTextColor }} className="leading-6">
                                    {section.content}
                                </ThemedText>
                            </StyledView>
                        ))}
                    </StyledView>
                </StyledView>
            </StyledScrollView>
        </ThemedView>
    );
}
