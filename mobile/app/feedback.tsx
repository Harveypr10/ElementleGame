import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, TextInput, Alert } from 'react-native';
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
const StyledTextInput = styled(TextInput);

export default function FeedbackScreen() {
    const router = useRouter();
    const { textScale } = useOptions();
    const [feedback, setFeedback] = useState('');
    const [selectedType, setSelectedType] = useState<'feature' | 'general' | 'praise'>('general');

    const backgroundColor = useThemeColor({}, 'background');
    const surfaceColor = useThemeColor({}, 'surface');
    const borderColor = useThemeColor({}, 'border');
    const textColor = useThemeColor({}, 'text');
    const iconColor = useThemeColor({}, 'icon');

    // Manual colors for unselected toggle items
    const unselectedBg = useThemeColor({ light: '#ffffff', dark: '#334155' }, 'surface');
    const unselectedBorder = useThemeColor({ light: '#e2e8f0', dark: '#475569' }, 'border');
    const unselectedText = useThemeColor({ light: '#475569', dark: '#cbd5e1' }, 'text');

    const handleSubmit = () => {
        if (!feedback.trim()) {
            Alert.alert('Error', 'Please enter your feedback');
            return;
        }
        // TODO: Submit feedback
        Alert.alert('Thank You!', 'Your feedback has been submitted. We appreciate your input!');
        router.back();
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
                        className="w-10 h-10 items-center justify-center"
                    >
                        <ChevronLeft size={28} color={iconColor} />
                    </StyledTouchableOpacity>
                    <ThemedText baseSize={20} className="font-n-bold">Feedback</ThemedText>
                    <StyledView className="w-10" />
                </StyledView>
            </SafeAreaView>

            <StyledScrollView className="flex-1 px-4 py-4">
                {/* Feedback Type */}
                <StyledView
                    className="rounded-2xl p-4 mb-3 border"
                    style={{ backgroundColor: surfaceColor, borderColor: borderColor }}
                >
                    <ThemedText baseSize={14} className="font-n-bold mb-2 opacity-60">Feedback Type</ThemedText>
                    <StyledView className="flex-row gap-2">
                        {[
                            { value: 'feature' as const, label: 'Feature Request' },
                            { value: 'general' as const, label: 'General' },
                            { value: 'praise' as const, label: 'Praise' },
                        ].map((type) => {
                            const isSelected = selectedType === type.value;
                            return (
                                <StyledTouchableOpacity
                                    key={type.value}
                                    onPress={() => setSelectedType(type.value)}
                                    className="flex-1 py-2 rounded-xl border items-center justify-center"
                                    style={{
                                        backgroundColor: isSelected ? '#3b82f6' : unselectedBg,
                                        borderColor: isSelected ? '#3b82f6' : unselectedBorder,
                                    }}
                                >
                                    <ThemedText
                                        baseSize={14}
                                        style={{
                                            color: isSelected ? '#ffffff' : unselectedText,
                                            fontFamily: 'Nunito-SemiBold'
                                        }}
                                    >
                                        {type.label}
                                    </ThemedText>
                                </StyledTouchableOpacity>
                            );
                        })}
                    </StyledView>
                </StyledView>

                {/* Feedback Text */}
                <StyledView
                    className="rounded-2xl p-4 mb-3 border"
                    style={{ backgroundColor: surfaceColor, borderColor: borderColor }}
                >
                    <ThemedText baseSize={14} className="font-n-bold mb-2 opacity-60">Your Feedback</ThemedText>
                    <StyledTextInput
                        style={{
                            fontSize: 16 * textScale,
                            backgroundColor: backgroundColor,
                            color: textColor
                        }}
                        className="rounded-xl px-3 py-3 min-h-[120px]"
                        placeholder="Tell us what you think..."
                        placeholderTextColor="#94a3b8"
                        value={feedback}
                        onChangeText={setFeedback}
                        multiline
                        textAlignVertical="top"
                    />
                </StyledView>

                <StyledTouchableOpacity
                    onPress={handleSubmit}
                    className="bg-blue-500 rounded-2xl py-3 px-4"
                >
                    <ThemedText baseSize={16} className="text-center font-n-bold text-white">Submit Feedback</ThemedText>
                </StyledTouchableOpacity>
            </StyledScrollView>
        </ThemedView>
    );
}
