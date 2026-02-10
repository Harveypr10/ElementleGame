import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, Linking } from 'react-native';
import { useRouter } from 'expo-router';
import { styled } from 'nativewind';
import { ChevronLeft, ChevronRight, Share2, Shield, FileText } from 'lucide-react-native';
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

    const handleShare = async () => {
        // Simple share logic if needed later
    };

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
                    <ThemedText size="2xl" className="font-n-bold">About</ThemedText>
                    <StyledView className="w-10" />
                </StyledView>
            </SafeAreaView>

            <StyledScrollView className="flex-1" contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 16, paddingBottom: 40 }}>
                <StyledView className="w-full max-w-3xl self-center">
                    {/* Intro Card */}
                    <StyledView
                        className="rounded-2xl p-5 mb-4 border"
                        style={{ backgroundColor: surfaceColor, borderColor: borderColor }}
                    >
                        <ThemedText size="2xl" className="font-n-extrabold text-center mb-1">
                            Elementle
                        </ThemedText>
                        <ThemedText size="base" style={{ color: secondaryTextColor }} className="text-center mb-6 font-n-medium">
                            Version {Constants.expoConfig?.version || '1.0.0'}
                        </ThemedText>

                        <ThemedText size="lg" className="mb-4 leading-7">
                            Elementle is a daily historical date puzzle game. Each day, you're challenged to pin down the exact date of a key event from history. You'll make guesses, get feedback, and refine your answer until you land on the correct date — or run out of tries.
                        </ThemedText>

                        <ThemedText size="base" className="font-n-bold mb-2 mt-2">The game blends learning with play:</ThemedText>

                        <StyledView className="mb-2 flex-row">
                            <ThemedText size="base" className="mr-2">🧩</ThemedText>
                            <StyledView className="flex-1">
                                <ThemedText size="base"><ThemedText className="font-n-bold">Daily Challenge</ThemedText> – A new puzzle every day, tied to a real historical event.</ThemedText>
                            </StyledView>
                        </StyledView>

                        <StyledView className="mb-2 flex-row">
                            <ThemedText size="base" className="mr-2">📚</ThemedText>
                            <StyledView className="flex-1">
                                <ThemedText size="base"><ThemedText className="font-n-bold">Learn as you play</ThemedText> – Each puzzle comes with event details, so you walk away knowing more than when you started.</ThemedText>
                            </StyledView>
                        </StyledView>

                        <StyledView className="mb-2 flex-row">
                            <ThemedText size="base" className="mr-2">📊</ThemedText>
                            <StyledView className="flex-1">
                                <ThemedText size="base"><ThemedText className="font-n-bold">Track your progress</ThemedText> – Stats and streaks let you see how your knowledge (and intuition) grows over time.</ThemedText>
                            </StyledView>
                        </StyledView>

                        <StyledView className="mb-2 flex-row">
                            <ThemedText size="base" className="mr-2">🎉</ThemedText>
                            <StyledView className="flex-1">
                                <ThemedText size="base"><ThemedText className="font-n-bold">Celebrate wins</ThemedText> – Animated hamster companions cheer you on when you succeed.</ThemedText>
                            </StyledView>
                        </StyledView>
                    </StyledView>

                    {/* Credits */}
                    <StyledView
                        className="rounded-2xl p-5 mb-4 border"
                        style={{ backgroundColor: surfaceColor, borderColor: borderColor }}
                    >
                        <ThemedText size="lg" className="font-n-bold mb-3">Credits</ThemedText>
                        <ThemedText size="base" className="leading-6 mb-4">
                            Elementle was created by <ThemedText className="font-n-bold">dobl Ltd</ThemedText>, a team dedicated to helping people get the very best from technology in ways that feel simple, engaging, and enjoyable. The game reflects that mission — blending thoughtful design, playful interaction, and a touch of curiosity to make learning history both accessible and fun.
                        </ThemedText>
                        <ThemedText size="sm" style={{ color: secondaryTextColor }}>
                            © {new Date().getFullYear()} Elementle. All rights reserved.
                        </ThemedText>
                    </StyledView>

                    {/* Links */}
                    <StyledView
                        className="rounded-2xl mb-6 border overflow-hidden"
                        style={{ backgroundColor: surfaceColor, borderColor: borderColor }}
                    >
                        <StyledTouchableOpacity
                            onPress={() => router.push('/privacy')}
                            className="flex-row items-center p-4 border-b active:opacity-70"
                            style={{ borderColor: borderColor }}
                        >
                            <Shield size={20} color={iconColor} className="mr-3" />
                            <ThemedText size="base" className="font-n-bold flex-1">Privacy Policy</ThemedText>
                            <ChevronRight size={20} color={secondaryTextColor} />
                        </StyledTouchableOpacity>

                        <StyledTouchableOpacity
                            onPress={() => router.push('/terms')}
                            className="flex-row items-center p-4 active:opacity-70"
                        >
                            <FileText size={20} color={iconColor} className="mr-3" />
                            <ThemedText size="base" className="font-n-bold flex-1">Terms of Service</ThemedText>
                            <ChevronRight size={20} color={secondaryTextColor} />
                        </StyledTouchableOpacity>
                    </StyledView>

                </StyledView>

            </StyledScrollView>
        </ThemedView>
    );
}
