/**
 * Password Reset Screen
 * 
 * Allows users to reset their password via email
 */

import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { styled } from 'nativewind';
import { useRouter } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft } from 'lucide-react-native';
import hapticsManager from '../../lib/hapticsManager';

const StyledView = styled(View);
const StyledText = styled(Text);
const StyledTextInput = styled(TextInput);
const StyledTouchableOpacity = styled(TouchableOpacity);

export default function PasswordResetScreen() {
    const router = useRouter();
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);
    const [error, setError] = useState('');

    const handleResetPassword = async () => {
        if (!email) {
            setError('Please enter your email address');
            hapticsManager.error();
            return;
        }

        setLoading(true);
        setError('');

        try {
            const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
                redirectTo: 'elementle://reset-password',
            });

            if (resetError) {
                setError(resetError.message);
                hapticsManager.error();
            } else {
                setSuccess(true);
                hapticsManager.success();
            }
        } catch (err: any) {
            setError(err?.message || 'Failed to send reset email');
            hapticsManager.error();
        } finally {
            setLoading(false);
        }
    };

    return (
        <SafeAreaView className="flex-1 bg-white dark:bg-slate-900">
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                className="flex-1"
            >
                <StyledView className="flex-1 px-6">
                    {/* Header */}
                    <StyledView className="flex-row items-center py-4">
                        <StyledTouchableOpacity
                            testID="password-reset-back"
                            onPress={() => {
                                hapticsManager.light();
                                router.back();
                            }}
                            className="mr-4"
                        >
                            <ChevronLeft size={28} color="#1e293b" />
                        </StyledTouchableOpacity>
                        <StyledText className="text-2xl font-n-bold text-slate-900 dark:text-white">
                            Reset Password
                        </StyledText>
                    </StyledView>

                    {success ? (
                        <StyledView className="flex-1 justify-center items-center px-6">
                            <StyledText className="text-6xl mb-4">✉️</StyledText>
                            <StyledText className="text-2xl font-n-bold text-slate-900 dark:text-white text-center mb-2">
                                Check Your Email
                            </StyledText>
                            <StyledText className="text-slate-600 dark:text-slate-400 text-center mb-6">
                                We've sent a password reset link to {email}
                            </StyledText>
                            <StyledTouchableOpacity
                                testID="password-reset-done"
                                onPress={() => {
                                    hapticsManager.light();
                                    router.back();
                                }}
                                className="bg-blue-500 py-4 px-8 rounded-xl"
                            >
                                <StyledText className="text-white font-n-bold text-lg">
                                    Done
                                </StyledText>
                            </StyledTouchableOpacity>
                        </StyledView>
                    ) : (
                        <StyledView className="flex-1 justify-center">
                            <StyledText className="text-slate-600 dark:text-slate-400 mb-6">
                                Enter your email address and we'll send you a link to reset your password.
                            </StyledText>

                            {/* Email Input */}
                            <StyledView className="mb-4">
                                <StyledText className="text-slate-700 dark:text-slate-300 font-n-medium mb-2">
                                    Email Address
                                </StyledText>
                                <StyledTextInput
                                    testID="password-reset-email-input"
                                    className="bg-slate-100 dark:bg-slate-800 px-4 py-4 rounded-xl text-slate-900 dark:text-white font-n-medium"
                                    placeholder="your@email.com"
                                    placeholderTextColor="#94a3b8"
                                    value={email}
                                    onChangeText={setEmail}
                                    keyboardType="email-address"
                                    autoCapitalize="none"
                                    autoCorrect={false}
                                    editable={!loading}
                                />
                            </StyledView>

                            {error && (
                                <StyledView className="bg-red-50 dark:bg-red-900/20 p-4 rounded-xl mb-4">
                                    <StyledText className="text-red-600 dark:text-red-400 font-n-medium">
                                        {error}
                                    </StyledText>
                                </StyledView>
                            )}

                            {/* Submit Button */}
                            <StyledTouchableOpacity
                                testID="password-reset-submit"
                                onPress={handleResetPassword}
                                disabled={loading}
                                className={`py-4 rounded-xl ${loading ? 'bg-blue-400' : 'bg-blue-500'}`}
                            >
                                {loading ? (
                                    <ActivityIndicator color="#ffffff" />
                                ) : (
                                    <StyledText className="text-white font-n-bold text-center text-lg">
                                        Send Reset Link
                                    </StyledText>
                                )}
                            </StyledTouchableOpacity>
                        </StyledView>
                    )}
                </StyledView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}
