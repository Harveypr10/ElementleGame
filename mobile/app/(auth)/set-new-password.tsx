/**
 * Set New Password Screen
 * 
 * Handles 3 modes:
 * - 'create': Social auth user setting first password
 * - 'change': Existing password user changing password
 * - 'reset': Coming from forgot password deep link
 */

import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform,
    Alert,
    ScrollView
} from 'react-native';
import { styled } from 'nativewind';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/auth';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft, Eye, EyeOff, Check, X } from 'lucide-react-native';
import hapticsManager from '../../lib/hapticsManager';
import { validatePassword, getPasswordRequirementsText } from '../../lib/passwordValidation';

const StyledView = styled(View);
const StyledText = styled(Text);
const StyledTextInput = styled(TextInput);
const StyledTouchableOpacity = styled(TouchableOpacity);
const StyledScrollView = styled(ScrollView);

type PasswordMode = 'create' | 'change' | 'reset';

export default function SetNewPasswordScreen() {
    const router = useRouter();
    const { user, session } = useAuth();
    const params = useLocalSearchParams<{ mode?: string }>();

    // Determine mode from params, default to 'create'
    const mode: PasswordMode = (params.mode as PasswordMode) || 'create';

    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);

    // Password visibility toggles
    const [showCurrentPassword, setShowCurrentPassword] = useState(false);
    const [showNewPassword, setShowNewPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);

    // Session validity for reset mode
    const [sessionValid, setSessionValid] = useState<boolean | null>(null);

    // For reset mode, verify the session was recovered from the deep link
    useEffect(() => {
        if (mode === 'reset') {
            // Check if we have a valid session with recovery type
            const checkSession = async () => {
                const { data: { session: currentSession } } = await supabase.auth.getSession();

                if (currentSession) {
                    // Session exists - user was authenticated via the reset link
                    console.log('[SetNewPassword] Session recovered for password reset');
                    setSessionValid(true);
                } else {
                    console.log('[SetNewPassword] No session - cannot reset password');
                    setSessionValid(false);
                    setError('Password reset link has expired. Please request a new one.');
                }
            };

            checkSession();
        } else {
            // For create/change modes, session should already be valid
            setSessionValid(!!session);
        }
    }, [mode, session]);

    // Get screen title based on mode
    const getTitle = () => {
        switch (mode) {
            case 'create': return 'Create Password';
            case 'change': return 'Change Password';
            case 'reset': return 'Set New Password';
        }
    };

    // Validate password in real-time
    const validation = validatePassword(newPassword);

    // Check if passwords match
    const passwordsMatch = newPassword === confirmPassword && confirmPassword.length > 0;

    const handleSubmit = async () => {
        setError('');

        // Validate new password
        if (!validation.valid) {
            setError(validation.errors.join('\n'));
            hapticsManager.error();
            return;
        }

        // Check passwords match
        if (newPassword !== confirmPassword) {
            setError('Passwords do not match');
            hapticsManager.error();
            return;
        }

        // For change mode, verify current password first
        if (mode === 'change') {
            if (!currentPassword) {
                setError('Please enter your current password');
                hapticsManager.error();
                return;
            }

            // Verify current password by attempting sign-in
            const { error: signInError } = await supabase.auth.signInWithPassword({
                email: user?.email || '',
                password: currentPassword,
            });

            if (signInError) {
                setError('Current password is incorrect');
                hapticsManager.error();
                return;
            }
        }

        // For reset mode, verify session is valid
        if (mode === 'reset' && !sessionValid) {
            setError('Password reset link has expired. Please request a new one.');
            hapticsManager.error();
            return;
        }

        setLoading(true);

        try {
            // Update password using Supabase
            const { error: updateError } = await supabase.auth.updateUser({
                password: newPassword,
            });

            if (updateError) {
                throw updateError;
            }

            // Update password_created flag in user_profiles
            if (user?.id) {
                await supabase
                    .from('user_profiles')
                    .update({ password_created: true })
                    .eq('user_id', user.id);
            }

            setSuccess(true);
            hapticsManager.success();

            // Show success and navigate back after delay
            setTimeout(() => {
                if (mode === 'reset') {
                    // After reset, go to login
                    router.replace('/(auth)/login');
                } else {
                    // After create/change, go back to account info
                    router.back();
                }
            }, 2000);

        } catch (err: any) {
            console.error('[SetNewPassword] Error:', err);
            setError(err.message || 'Failed to update password');
            hapticsManager.error();
        } finally {
            setLoading(false);
        }
    };

    // Helper to mask email (e.g., "p...y@gmail.com")
    const maskEmail = (email: string) => {
        if (!email) return '';
        const [local, domain] = email.split('@');
        if (local.length <= 2) return email;
        return `${local[0]}...${local[local.length - 1]}@${domain}`;
    };

    const handleForgotPassword = () => {
        const email = user?.email;
        if (!email) {
            Alert.alert('Error', 'No email address associated with this account.');
            return;
        }

        Alert.alert(
            'Reset Password',
            `A password reset link will be sent to ${email}. Continue?`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Continue',
                    onPress: async () => {
                        try {
                            const { error } = await supabase.auth.resetPasswordForEmail(email, {
                                redirectTo: 'https://elementle.tech/reset-password',
                            });
                            if (error) throw error;
                            hapticsManager.success();
                            Alert.alert('Email Sent', 'Check your inbox for the password reset link.');
                        } catch (err: any) {
                            hapticsManager.error();
                            Alert.alert('Error', err.message || 'Failed to send reset email.');
                        }
                    },
                },
            ]
        );
    };

    // Show loading while checking session for reset mode
    if (mode === 'reset' && sessionValid === null) {
        return (
            <SafeAreaView className="flex-1 bg-white dark:bg-slate-900 justify-center items-center">
                <ActivityIndicator size="large" color="#3b82f6" />
                <StyledText className="text-slate-600 dark:text-slate-400 mt-4">
                    Verifying reset link...
                </StyledText>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView className="flex-1 bg-white dark:bg-slate-900">
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                className="flex-1"
            >
                <StyledScrollView className="flex-1" contentContainerStyle={{ paddingHorizontal: 24 }} keyboardShouldPersistTaps="handled">
                    {/* Header */}
                    <StyledView className="flex-row items-center py-4">
                        <StyledTouchableOpacity
                            testID="password-back"
                            onPress={() => {
                                hapticsManager.light();
                                router.back();
                            }}
                            className="mr-4"
                        >
                            <ChevronLeft size={28} color="#1e293b" />
                        </StyledTouchableOpacity>
                        <StyledText className="text-2xl font-n-bold text-slate-900 dark:text-white">
                            {getTitle()}
                        </StyledText>
                    </StyledView>

                    {success ? (
                        <StyledView className="flex-1 justify-center items-center py-20">
                            <StyledView className="w-20 h-20 rounded-full bg-green-100 items-center justify-center mb-4">
                                <Check size={40} color="#22c55e" />
                            </StyledView>
                            <StyledText className="text-2xl font-n-bold text-slate-900 dark:text-white text-center mb-2">
                                Password Updated!
                            </StyledText>
                            <StyledText className="text-slate-600 dark:text-slate-400 text-center">
                                {mode === 'reset'
                                    ? 'Redirecting to login...'
                                    : 'Your password has been updated successfully.'}
                            </StyledText>
                        </StyledView>
                    ) : (
                        <StyledView className="py-4">
                            {/* Description */}
                            <StyledText className="text-slate-600 dark:text-slate-400 mb-6">
                                {mode === 'create' && 'Create a password to enable email login alongside your social account.'}
                                {mode === 'change' && 'Enter your current password and choose a new one.'}
                                {mode === 'reset' && 'Choose a new password for your account.'}
                            </StyledText>

                            {/* Current Password - only for change mode */}
                            {mode === 'change' && (
                                <StyledView className="mb-4">
                                    <StyledText className="text-slate-700 dark:text-slate-300 font-n-medium mb-2">
                                        Current Password
                                    </StyledText>
                                    <StyledView style={{ position: 'relative' }}>
                                        <StyledTextInput
                                            testID="current-password-input"
                                            className="bg-slate-100 dark:bg-slate-800 px-4 py-4 rounded-xl text-slate-900 dark:text-white font-n-medium pr-12"
                                            style={{ paddingLeft: 16, paddingVertical: 16, paddingRight: 48 }}
                                            placeholder="Enter current password"
                                            placeholderTextColor="#94a3b8"
                                            value={currentPassword}
                                            onChangeText={setCurrentPassword}
                                            secureTextEntry={!showCurrentPassword}
                                            autoCapitalize="none"
                                            autoCorrect={false}
                                            editable={!loading}
                                        />
                                        <StyledTouchableOpacity
                                            onPress={() => setShowCurrentPassword(!showCurrentPassword)}
                                            style={{ position: 'absolute', right: 16, top: 16 }}
                                        >
                                            {showCurrentPassword ? (
                                                <EyeOff size={20} color="#94a3b8" />
                                            ) : (
                                                <Eye size={20} color="#94a3b8" />
                                            )}
                                        </StyledTouchableOpacity>
                                    </StyledView>
                                    <StyledTouchableOpacity
                                        onPress={handleForgotPassword}
                                        className="mt-2"
                                    >
                                        <StyledText className="text-blue-500 text-sm">
                                            Forgot your password?
                                        </StyledText>
                                    </StyledTouchableOpacity>
                                </StyledView>
                            )}

                            {/* New Password */}
                            <StyledView className="mb-4">
                                <StyledText className="text-slate-700 dark:text-slate-300 font-n-medium mb-2">
                                    {mode === 'change' ? 'New Password' : 'Password'}
                                </StyledText>
                                <StyledView style={{ position: 'relative' }}>
                                    <StyledTextInput
                                        testID="new-password-input"
                                        className="bg-slate-100 dark:bg-slate-800 px-4 py-4 rounded-xl text-slate-900 dark:text-white font-n-medium pr-12"
                                        style={{ paddingLeft: 16, paddingVertical: 16, paddingRight: 48 }}
                                        placeholder="Enter new password"
                                        placeholderTextColor="#94a3b8"
                                        value={newPassword}
                                        onChangeText={setNewPassword}
                                        secureTextEntry={!showNewPassword}
                                        autoCapitalize="none"
                                        autoCorrect={false}
                                        editable={!loading}
                                    />
                                    <StyledTouchableOpacity
                                        onPress={() => setShowNewPassword(!showNewPassword)}
                                        style={{ position: 'absolute', right: 16, top: 16 }}
                                    >
                                        {showNewPassword ? (
                                            <EyeOff size={20} color="#94a3b8" />
                                        ) : (
                                            <Eye size={20} color="#94a3b8" />
                                        )}
                                    </StyledTouchableOpacity>
                                </StyledView>
                            </StyledView>

                            {/* Password Requirements */}
                            {newPassword.length > 0 && (
                                <StyledView className="mb-4 bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl">
                                    <StyledText className="text-slate-700 dark:text-slate-300 font-n-medium mb-2 text-sm">
                                        Password Requirements
                                    </StyledText>
                                    <PasswordRequirement
                                        met={newPassword.length >= 8}
                                        text="At least 8 characters"
                                    />
                                    <PasswordRequirement
                                        met={/[a-zA-Z]/.test(newPassword)}
                                        text="At least one letter"
                                    />
                                    <PasswordRequirement
                                        met={/[0-9]/.test(newPassword)}
                                        text="At least one number"
                                    />
                                    <PasswordRequirement
                                        met={/[^a-zA-Z0-9]/.test(newPassword)}
                                        text="At least one special character"
                                    />
                                </StyledView>
                            )}

                            {/* Confirm Password */}
                            <StyledView className="mb-4">
                                <StyledText className="text-slate-700 dark:text-slate-300 font-n-medium mb-2">
                                    Confirm Password
                                </StyledText>
                                <StyledView style={{ position: 'relative' }}>
                                    <StyledTextInput
                                        testID="confirm-password-input"
                                        className={`bg-slate-100 dark:bg-slate-800 px-4 py-4 rounded-xl text-slate-900 dark:text-white font-n-medium pr-12 ${confirmPassword.length > 0 && !passwordsMatch
                                            ? 'border-2 border-red-500'
                                            : confirmPassword.length > 0 && passwordsMatch
                                                ? 'border-2 border-green-500'
                                                : ''
                                            }`}
                                        style={{ paddingLeft: 16, paddingVertical: 16, paddingRight: 48 }}
                                        placeholder="Confirm new password"
                                        placeholderTextColor="#94a3b8"
                                        value={confirmPassword}
                                        onChangeText={setConfirmPassword}
                                        secureTextEntry={!showConfirmPassword}
                                        autoCapitalize="none"
                                        autoCorrect={false}
                                        editable={!loading}
                                    />
                                    <StyledTouchableOpacity
                                        onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                                        style={{ position: 'absolute', right: 16, top: 16 }}
                                    >
                                        {showConfirmPassword ? (
                                            <EyeOff size={20} color="#94a3b8" />
                                        ) : (
                                            <Eye size={20} color="#94a3b8" />
                                        )}
                                    </StyledTouchableOpacity>
                                </StyledView>
                                {confirmPassword.length > 0 && !passwordsMatch && (
                                    <StyledText className="text-red-500 text-sm mt-1">
                                        Passwords do not match
                                    </StyledText>
                                )}
                            </StyledView>

                            {/* Error */}
                            {error && (
                                <StyledView className="bg-red-50 dark:bg-red-900/20 p-4 rounded-xl mb-4">
                                    <StyledText className="text-red-600 dark:text-red-400 font-n-medium">
                                        {error}
                                    </StyledText>
                                </StyledView>
                            )}

                            {/* Submit Button */}
                            <StyledTouchableOpacity
                                testID="password-submit"
                                onPress={handleSubmit}
                                disabled={loading || !validation.valid || !passwordsMatch}
                                className={`py-4 rounded-xl ${loading || !validation.valid || !passwordsMatch
                                    ? 'bg-blue-400'
                                    : 'bg-blue-500'
                                    }`}
                            >
                                {loading ? (
                                    <ActivityIndicator color="#ffffff" />
                                ) : (
                                    <StyledText className="text-white font-n-bold text-center text-lg">
                                        {mode === 'create' ? 'Create Password' : 'Update Password'}
                                    </StyledText>
                                )}
                            </StyledTouchableOpacity>
                        </StyledView>
                    )}
                </StyledScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

// Helper component for password requirements
function PasswordRequirement({ met, text }: { met: boolean; text: string }) {
    return (
        <StyledView className="flex-row items-center my-1">
            {met ? (
                <Check size={16} color="#22c55e" />
            ) : (
                <X size={16} color="#94a3b8" />
            )}
            <StyledText
                className={`ml-2 text-sm ${met ? 'text-green-600' : 'text-slate-500'}`}
            >
                {text}
            </StyledText>
        </StyledView>
    );
}
