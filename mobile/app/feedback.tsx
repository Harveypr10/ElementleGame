import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, TextInput, Alert, Linking } from 'react-native';
import { useRouter } from 'expo-router';
import { styled } from 'nativewind';
import { ChevronLeft, Star } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useOptions } from '../lib/options';
import { useAuth } from '../lib/auth';

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
    const { user } = useAuth();
    const [feedback, setFeedback] = useState('');
    const [rating, setRating] = useState(0);

    const backgroundColor = useThemeColor({}, 'background');
    const surfaceColor = useThemeColor({}, 'surface');
    const borderColor = useThemeColor({}, 'border');
    const textColor = useThemeColor({}, 'text');
    const iconColor = useThemeColor({}, 'icon');

    const handleSubmit = async () => {
        if (!feedback.trim()) {
            Alert.alert('Error', 'Please enter your feedback');
            return;
        }

        const userEmail = user?.email || 'Anonymous';
        const subject = 'Feedback - Elementle';
        const ratingText = rating > 0 ? `Rating: ${rating}/5 stars\n\n` : '';
        const body = `Feedback from: ${userEmail}\n\n${ratingText}Feedback:\n${feedback}`;
        const mailtoUrl = `mailto:no-reply@dobl.uk?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

        try {
            const canOpen = await Linking.canOpenURL(mailtoUrl);
            if (canOpen) {
                await Linking.openURL(mailtoUrl);
                // Optional: Clear form or go back, but staying lets them adjust if mail app fails
                Alert.alert('Opening Mail', 'Redirecting to your email app to send feedback.');
            } else {
                Alert.alert('Error', 'Could not open email client. Please email us at no-reply@dobl.uk');
            }
        } catch (error) {
            console.error('Error opening email:', error);
            Alert.alert('Error', 'An unexpected error occurred.');
        }
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
                    <ThemedText size="2xl" className="font-n-bold">Feedback</ThemedText>
                    <StyledView className="w-10" />
                </StyledView>
            </SafeAreaView>

            <StyledScrollView className="flex-1 px-4 py-4">
                {/* Rating */}
                <StyledView
                    className="rounded-2xl p-5 mb-4 border"
                    style={{ backgroundColor: surfaceColor, borderColor: borderColor }}
                >
                    <ThemedText size="base" className="font-n-bold mb-3 opacity-80 text-center">Do you like playing Elementle?</ThemedText>
                    <StyledView className="flex-row justify-center gap-2">
                        {[1, 2, 3, 4, 5].map((star) => (
                            <TouchableOpacity key={star} onPress={() => setRating(star)}>
                                <Star
                                    size={32}
                                    color={star <= rating ? '#fbbf24' : '#d1d5db'} // Amber-400 vs Gray-300
                                    fill={star <= rating ? '#fbbf24' : 'transparent'}
                                />
                            </TouchableOpacity>
                        ))}
                    </StyledView>
                </StyledView>

                {/* Feedback Text */}
                <StyledView
                    className="rounded-2xl p-4 mb-4 border"
                    style={{ backgroundColor: surfaceColor, borderColor: borderColor }}
                >
                    <ThemedText size="base" className="font-n-bold mb-2 opacity-60">Your Feedback</ThemedText>
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
                    className="bg-blue-500 rounded-2xl py-3 px-4 shadow-sm"
                >
                    <ThemedText size="lg" className="text-center font-n-bold text-white">Send Feedback</ThemedText>
                </StyledTouchableOpacity>

                <ThemedText size="sm" className="text-center mt-4 opacity-50">
                    This will open your default email app.
                </ThemedText>
            </StyledScrollView>
        </ThemedView>
    );
}
