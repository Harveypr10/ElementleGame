/**
 * OTP Verification Screen
 * 
 * Verifies user email via OTP code
 */

import React, { useState, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { styled } from 'nativewind';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft } from 'lucide-react-native';
import hapticsManager from '../../lib/hapticsManager';

const StyledView = styled(View);
const StyledText = styled(Text);
const StyledTextInput = styled(TextInput);
const StyledTouchableOpacity = styled(TouchableOpacity);

const OTP_LENGTH = 6;

export default function OTPVerificationScreen() {
    const router = useRouter();
    const params = useLocalSearchParams();
    const email = params.email as string || '';

    const [otp, setOtp] = useState(['', '', '', '', '', '']);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [resending, setResending] = useState(false);

    const inputRefs = useRef<(TextInput | null)[]>([]);

    const handleOtpChange = (value: string, index: number) => {
        if (!/^\d*$/.test(value)) return; // Only allow digits

        const newOtp = [...otp];
        newOtp[index] = value;
        setOtp(newOtp);

        // Auto-focus next input
        if (value && index < OTP_LENGTH - 1) {
            inputRefs.current[index + 1]?.focus();
        }

        // Auto-submit when complete
        if (newOtp.every(digit => digit !== '') && newOtp.join('').length === OTP_LENGTH) {
            handleVerifyOtp(newOtp.join(''));
        }
    };

    const handleKeyPress = (key: string, index: number) => {
        if (key === 'Backspace' && !otp[index] && index > 0) {
            inputRefs.current[index - 1]?.focus();
        }
    };

    const handleVerifyOtp = async (code: string) => {
        setLoading(true);
        setError('');

        try {
            const { error: verifyError } = await supabase.auth.verifyOtp({
                email,
                token: code,
                type: 'email',
            });

            if (verifyError) {
                setError(verifyError.message);
                hapticsManager.error();
                // Clear OTP on error
                setOtp(['', '', '', '', '', '']);
                inputRefs.current[0]?.focus();
            } else {
                hapticsManager.success();
                router.replace('/(tabs)');
            }
        } catch (err: any) {
            setError(err?.message || 'Verification failed');
            hapticsManager.error();
        } finally {
            setLoading(false);
        }
    };

    const handleResendCode = async () => {
        setResending(true);
        setError('');

        try {
            const { error: resendError } = await supabase.auth.signInWithOtp({
                email,
            });

            if (resendError) {
                setError(resendError.message);
                hapticsManager.error();
            } else {
                hapticsManager.success();
                setError('Code sent! Check your email.');
            }
        } catch (err: any) {
            setError(err?.message || 'Failed to resend code');
            hapticsManager.error();
        } finally {
            setResending(false);
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
                            testID="otp-back"
                            onPress={() => {
                                hapticsManager.light();
                                router.back();
                            }}
                            className="mr-4"
                        >
                            <ChevronLeft size={28} color="#1e293b" />
                        </StyledTouchableOpacity>
                        <StyledText className="text-2xl font-n-bold text-slate-900 dark:text-white">
                            Verify Email
                        </StyledText>
                    </StyledView>

                    <StyledView className="flex-1 justify-center">
                        <StyledText className="text-slate-600 dark:text-slate-400 mb-8 text-center">
                            We've sent a 6-digit code to{'\n'}
                            <StyledText className="font-n-bold">{email}</StyledText>
                        </StyledText>

                        {/* OTP Input */}
                        <StyledView className="flex-row justify-center gap-2 mb-6">
                            {otp.map((digit, index) => (
                                <StyledTextInput
                                    key={index}
                                    ref={ref => inputRefs.current[index] = ref}
                                    testID={`otp-input-${index}`}
                                    className="bg-slate-100 dark:bg-slate-800 w-12 h-16 rounded-xl text-center text-2xl font-n-bold text-slate-900 dark:text-white"
                                    value={digit}
                                    onChangeText={value => handleOtpChange(value, index)}
                                    onKeyPress={({ nativeEvent: { key } }) => handleKeyPress(key, index)}
                                    keyboardType="number-pad"
                                    maxLength={1}
                                    selectTextOnFocus
                                    editable={!loading}
                                />
                            ))}
                        </StyledView>

                        {error && (
                            <StyledView className="bg-red-50 dark:bg-red-900/20 p-4 rounded-xl mb-4">
                                <StyledText className="text-red-600 dark:text-red-400 font-n-medium text-center">
                                    {error}
                                </StyledText>
                            </StyledView>
                        )}

                        {loading && (
                            <StyledView className="items-center mb-4">
                                <ActivityIndicator size="large" color="#3b82f6" />
                            </StyledView>
                        )}

                        {/* Resend Code */}
                        <StyledView className="flex-row justify-center items-center">
                            <StyledText className="text-slate-600 dark:text-slate-400 mr-2">
                                Didn't receive the code?
                            </StyledText>
                            <StyledTouchableOpacity
                                testID="otp-resend"
                                onPress={handleResendCode}
                                disabled={resending}
                            >
                                <StyledText className="text-blue-500 font-n-bold">
                                    {resending ? 'Sending...' : 'Resend'}
                                </StyledText>
                            </StyledTouchableOpacity>
                        </StyledView>
                    </StyledView>
                </StyledView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}
