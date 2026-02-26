import React, { useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, ScrollView, TextInput, Alert, Animated } from 'react-native';
import { styled } from 'nativewind';
import { ChevronLeft, CheckCircle } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useBugReportLogic } from '../hooks/useBugReportLogic';

import { ThemedText } from '../components/ThemedText';
import { ThemedView } from '../components/ThemedView';

const StyledView = styled(View);
const StyledTouchableOpacity = styled(TouchableOpacity);
const StyledScrollView = styled(ScrollView);
const StyledTextInput = styled(TextInput);

export default function BugReportScreen() {
    const {
        description,
        setDescription,
        isSubmitting,
        isSubmitted,
        submitBugReport,
        handleSubmitPress,
        goBack,
        textScale,
        hasAuthEmail,
        showEmailPrompt,
        guestEmail,
        setGuestEmail,
        colors
    } = useBugReportLogic();

    const successOpacity = useRef(new Animated.Value(0)).current;

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
        if (!description.trim()) {
            Alert.alert('Required', 'Please describe the bug.');
            return;
        }

        const status = handleSubmitPress();
        if (status === 'needs_email') return;

        const result = await submitBugReport();
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
                        <ThemedText size="2xl" className="font-n-bold">Report a Bug</ThemedText>
                        <StyledView className="w-10" />
                    </StyledView>
                </SafeAreaView>
                <Animated.View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', opacity: successOpacity, paddingHorizontal: 32 }}>
                    <CheckCircle size={64} color="#22c55e" />
                    <ThemedText size="xl" className="font-n-bold mt-4 text-center">Report Submitted</ThemedText>
                    <ThemedText size="base" className="mt-2 text-center opacity-60">
                        Thank you! We'll investigate this issue.
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
                    <ThemedText size="2xl" className="font-n-bold">Report a Bug</ThemedText>
                    <StyledView className="w-10" />
                </StyledView>
            </SafeAreaView>

            <StyledScrollView className="flex-1" contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 16 }}>
                <StyledView className="w-full max-w-3xl self-center">
                    <StyledView
                        className="rounded-2xl p-4 mb-4 border"
                        style={{ backgroundColor: colors.surface, borderColor: colors.border }}
                    >
                        <ThemedText size="base" className="font-n-bold mb-2 opacity-60">Describe the Bug</ThemedText>
                        <StyledTextInput
                            style={{
                                fontSize: 16 * textScale,
                                backgroundColor: colors.background,
                                color: colors.text
                            }}
                            className="rounded-xl px-3 py-3 min-h-[120px]"
                            placeholder="What went wrong? Please provide as much detail as possible..."
                            placeholderTextColor="#94a3b8"
                            value={description}
                            onChangeText={setDescription}
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
                            {isSubmitting ? 'Submitting...' : showEmailPrompt && !hasAuthEmail ? 'Submit Report' : 'Submit Report'}
                        </ThemedText>
                    </StyledTouchableOpacity>
                </StyledView>
            </StyledScrollView>
        </ThemedView>
    );
}
