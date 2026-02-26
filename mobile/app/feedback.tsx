import React, { useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, ScrollView, TextInput, Alert, Animated } from 'react-native';
import { styled } from 'nativewind';
import { ChevronLeft, Star, CheckCircle } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFeedbackLogic } from '../hooks/useFeedbackLogic';

import { ThemedText } from '../components/ThemedText';
import { ThemedView } from '../components/ThemedView';

const StyledView = styled(View);
const StyledTouchableOpacity = styled(TouchableOpacity);
const StyledScrollView = styled(ScrollView);
const StyledTextInput = styled(TextInput);

export default function FeedbackScreen() {
    const {
        feedback,
        setFeedback,
        rating,
        setRating,
        isSubmitting,
        isSubmitted,
        submitFeedback,
        handleSubmitPress,
        goBack,
        textScale,
        hasAuthEmail,
        showEmailPrompt,
        guestEmail,
        setGuestEmail,
        colors
    } = useFeedbackLogic();

    const successOpacity = useRef(new Animated.Value(0)).current;

    // Auto-navigate back after success
    useEffect(() => {
        if (isSubmitted) {
            Animated.timing(successOpacity, {
                toValue: 1,
                duration: 300,
                useNativeDriver: true,
            }).start();

            const timer = setTimeout(() => goBack(), 2000);
            return () => clearTimeout(timer);
        }
    }, [isSubmitted]);

    const handlePressSubmit = async () => {
        if (!feedback.trim()) {
            Alert.alert('Required', 'Please enter your feedback.');
            return;
        }

        const status = handleSubmitPress();
        if (status === 'needs_email') return;

        const result = await submitFeedback();
        if (!result.success && result.error) {
            Alert.alert('Error', result.error);
        }
    };

    if (isSubmitted) {
        return (
            <ThemedView className="flex-1">
                <SafeAreaView edges={['top']} style={{ backgroundColor: colors.surface }}>
                    <StyledView className="flex-row items-center justify-between px-4 py-3" style={{ backgroundColor: colors.surface }}>
                        <StyledView className="w-10" />
                        <ThemedText size="2xl" className="font-n-bold">Feedback</ThemedText>
                        <StyledView className="w-10" />
                    </StyledView>
                </SafeAreaView>
                <Animated.View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', opacity: successOpacity, paddingHorizontal: 32 }}>
                    <CheckCircle size={64} color="#22c55e" />
                    <ThemedText size="xl" className="font-n-bold mt-4 text-center">Thank you!</ThemedText>
                    <ThemedText size="base" className="mt-2 text-center opacity-60">
                        Your feedback has been submitted successfully.
                    </ThemedText>
                </Animated.View>
            </ThemedView>
        );
    }

    return (
        <ThemedView className="flex-1">
            <SafeAreaView edges={['top']} style={{ backgroundColor: colors.surface }}>
                <StyledView
                    className="flex-row items-center justify-between px-4 py-3"
                    style={{ backgroundColor: colors.surface }}
                >
                    <StyledTouchableOpacity
                        onPress={goBack}
                        className="w-10 h-10 items-center justify-center p-2"
                        hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
                    >
                        <ChevronLeft size={28} color={colors.icon} />
                    </StyledTouchableOpacity>
                    <ThemedText size="2xl" className="font-n-bold">Feedback</ThemedText>
                    <StyledView className="w-10" />
                </StyledView>
            </SafeAreaView>

            <StyledScrollView className="flex-1" contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 16 }}>
                <StyledView className="w-full max-w-3xl self-center">
                    {/* Rating */}
                    <StyledView
                        className="rounded-2xl p-5 mb-4 border"
                        style={{ backgroundColor: colors.surface, borderColor: colors.border }}
                    >
                        <ThemedText size="base" className="font-n-bold mb-3 opacity-80 text-center">Do you like playing Elementle?</ThemedText>
                        <StyledView className="flex-row justify-center gap-2">
                            {[1, 2, 3, 4, 5].map((star) => (
                                <TouchableOpacity key={star} onPress={() => setRating(star)}>
                                    <Star
                                        size={32}
                                        color={star <= rating ? '#fbbf24' : '#d1d5db'}
                                        fill={star <= rating ? '#fbbf24' : 'transparent'}
                                    />
                                </TouchableOpacity>
                            ))}
                        </StyledView>
                    </StyledView>

                    {/* Feedback Text */}
                    <StyledView
                        className="rounded-2xl p-4 mb-4 border"
                        style={{ backgroundColor: colors.surface, borderColor: colors.border }}
                    >
                        <ThemedText size="base" className="font-n-bold mb-2 opacity-60">Your Feedback</ThemedText>
                        <StyledTextInput
                            style={{
                                fontSize: 16 * textScale,
                                backgroundColor: colors.background,
                                color: colors.text
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

                    {/* Guest Email Prompt */}
                    {showEmailPrompt && !hasAuthEmail && (
                        <StyledView
                            className="rounded-2xl p-4 mb-4 border"
                            style={{ backgroundColor: colors.surface, borderColor: colors.border }}
                        >
                            <ThemedText size="sm" className="font-n-bold mb-2 opacity-70">
                                Would you like a response?
                            </ThemedText>
                            <ThemedText size="xs" className="mb-3 opacity-50">
                                Provide your email so we can get back to you (optional).
                            </ThemedText>
                            <StyledTextInput
                                style={{
                                    fontSize: 15 * textScale,
                                    backgroundColor: colors.background,
                                    color: colors.text
                                }}
                                className="rounded-xl px-3 py-3"
                                placeholder="your@email.com"
                                placeholderTextColor="#94a3b8"
                                value={guestEmail}
                                onChangeText={setGuestEmail}
                                keyboardType="email-address"
                                autoCapitalize="none"
                                autoCorrect={false}
                            />
                        </StyledView>
                    )}

                    <StyledTouchableOpacity
                        onPress={handlePressSubmit}
                        disabled={isSubmitting}
                        className={`bg-blue-500 rounded-2xl py-3 px-4 shadow-sm ${isSubmitting ? 'opacity-70' : ''}`}
                    >
                        <ThemedText size="lg" className="text-center font-n-bold text-white">
                            {isSubmitting ? 'Submitting...' : showEmailPrompt && !hasAuthEmail ? 'Submit Feedback' : 'Send Feedback'}
                        </ThemedText>
                    </StyledTouchableOpacity>
                </StyledView>
            </StyledScrollView>
        </ThemedView>
    );
}
