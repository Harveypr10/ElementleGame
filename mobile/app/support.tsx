import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, TouchableOpacity, ScrollView, TextInput, Alert, Animated, Platform } from 'react-native';
import { styled } from 'nativewind';
import { ChevronLeft, CheckCircle } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Constants from 'expo-constants';

import { ThemedText } from '../components/ThemedText';
import { ThemedView } from '../components/ThemedView';
import { useThemeColor } from '../hooks/useThemeColor';
import { useOptions } from '../lib/options';
import { useAuth } from '../lib/auth';
import { supabase } from '../lib/supabase';

const StyledView = styled(View);
const StyledTouchableOpacity = styled(TouchableOpacity);
const StyledScrollView = styled(ScrollView);
const StyledTextInput = styled(TextInput);

export default function SupportScreen() {
    const router = useRouter();
    const { user } = useAuth();
    const { textScale } = useOptions();

    const [message, setMessage] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isSubmitted, setIsSubmitted] = useState(false);

    // Guest email prompt
    const [guestEmail, setGuestEmail] = useState('');
    const [showEmailPrompt, setShowEmailPrompt] = useState(false);
    const hasAuthEmail = !!user?.email;

    const surfaceColor = useThemeColor({}, 'surface');
    const borderColor = useThemeColor({}, 'border');
    const backgroundColor = useThemeColor({}, 'background');
    const textColor = useThemeColor({}, 'text');
    const iconColor = useThemeColor({}, 'icon');

    let appVersion = Constants.expoConfig?.version || '1.0.0';
    try {
        const Application = require('expo-application');
        if (Application.nativeApplicationVersion) {
            appVersion = Application.nativeApplicationVersion;
        }
    } catch { }
    const deviceOs = `${Platform.OS} ${Platform.Version}`;

    const successOpacity = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        if (isSubmitted) {
            Animated.timing(successOpacity, {
                toValue: 1,
                duration: 300,
                useNativeDriver: true,
            }).start();

            const timer = setTimeout(() => router.back(), 2000);
            return () => clearTimeout(timer);
        }
    }, [isSubmitted]);

    const handleSubmit = async () => {
        if (!message.trim()) {
            Alert.alert('Required', 'Please describe how we can help.');
            return;
        }

        // Show email prompt for guests on first tap
        if (!hasAuthEmail && !showEmailPrompt) {
            setShowEmailPrompt(true);
            return;
        }

        setIsSubmitting(true);
        try {
            const resolvedEmail = user?.email || guestEmail.trim() || null;

            const { error } = await supabase.from('user_feedback').insert({
                user_id: user?.id || null,
                email: resolvedEmail,
                type: 'support',
                message: message.trim(),
                rating: null,
                app_version: appVersion,
                device_os: deviceOs,
            });

            if (error) {
                console.error('[Support] Supabase insert error:', error);
                Alert.alert('Error', 'Failed to send your request. Please try again.');
                return;
            }

            setIsSubmitted(true);
        } catch (error: any) {
            console.error('[Support] Submit error:', error);
            Alert.alert('Error', 'Something went wrong. Please try again.');
        } finally {
            setIsSubmitting(false);
        }
    };

    if (isSubmitted) {
        return (
            <ThemedView className="flex-1">
                <SafeAreaView edges={['top']} style={{ backgroundColor: surfaceColor }}>
                    <StyledView className="flex-row items-center justify-between px-4 py-3" style={{ backgroundColor: surfaceColor }}>
                        <StyledView className="w-10" />
                        <ThemedText size="2xl" className="font-n-bold">Support</ThemedText>
                        <StyledView className="w-10" />
                    </StyledView>
                </SafeAreaView>
                <Animated.View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', opacity: successOpacity, paddingHorizontal: 32 }}>
                    <CheckCircle size={64} color="#22c55e" />
                    <ThemedText size="xl" className="font-n-bold mt-4 text-center">Request Received</ThemedText>
                    <ThemedText size="base" className="mt-2 text-center opacity-60">
                        We'll get back to you as soon as possible.
                    </ThemedText>
                </Animated.View>
            </ThemedView>
        );
    }

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
                        hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
                    >
                        <ChevronLeft size={28} color={iconColor} />
                    </StyledTouchableOpacity>
                    <ThemedText size="2xl" className="font-n-bold">Support</ThemedText>
                    <StyledView className="w-10" />
                </StyledView>
            </SafeAreaView>

            <StyledScrollView className="flex-1" contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 16 }}>
                <StyledView className="w-full max-w-3xl self-center">
                    {/* Message */}
                    <StyledView
                        className="rounded-2xl p-4 mb-4 border"
                        style={{ backgroundColor: surfaceColor, borderColor }}
                    >
                        <ThemedText size="base" className="font-n-bold mb-2 opacity-60">How can we help?</ThemedText>
                        <StyledTextInput
                            style={{
                                fontSize: 16 * textScale,
                                backgroundColor,
                                color: textColor
                            }}
                            className="rounded-xl px-3 py-3 min-h-[120px]"
                            placeholder="Describe your issue or question..."
                            placeholderTextColor="#94a3b8"
                            value={message}
                            onChangeText={setMessage}
                            multiline
                            textAlignVertical="top"
                        />
                    </StyledView>

                    {/* Guest Email Prompt */}
                    {showEmailPrompt && !hasAuthEmail && (
                        <StyledView
                            className="rounded-2xl p-4 mb-4 border"
                            style={{ backgroundColor: surfaceColor, borderColor }}
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
                                    backgroundColor,
                                    color: textColor
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
                        onPress={handleSubmit}
                        disabled={isSubmitting}
                        className={`bg-blue-500 rounded-2xl py-3 px-4 shadow-sm ${isSubmitting ? 'opacity-70' : ''}`}
                    >
                        <ThemedText size="lg" className="text-center font-n-bold text-white">
                            {isSubmitting ? 'Submitting...' : 'Contact Support'}
                        </ThemedText>
                    </StyledTouchableOpacity>
                </StyledView>
            </StyledScrollView>
        </ThemedView>
    );
}
