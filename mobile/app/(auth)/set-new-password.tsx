/**
 * Set New Password Screen
 * 
 * Handles 2 modes:
 * - 'create': Social auth user setting first password
 * - 'change': Existing user changing password (no current password required — user is already authenticated)
 */

import React, { useState, useRef } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    ScrollView,
    SafeAreaView,
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform,
    Alert,
} from 'react-native';
import { styled } from 'nativewind';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { ChevronLeft, Eye, EyeOff, Check, X } from 'lucide-react-native';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/auth';
import { validatePassword } from '../../lib/passwordValidation';
import { hapticsManager } from '../../lib/hapticsManager';

const StyledView = styled(View);
const StyledText = styled(Text);
const StyledTextInput = styled(TextInput);
const StyledTouchableOpacity = styled(TouchableOpacity);
const StyledScrollView = styled(ScrollView);

type PasswordMode = 'create' | 'change';

export default function SetNewPasswordScreen() {
    const router = useRouter();
    const { user, session } = useAuth();
    const params = useLocalSearchParams<{ mode?: string }>();

    // Determine mode from params, default to 'create'
    const mode: PasswordMode = (params.mode === 'change') ? 'change' : 'create';

    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);

    // Password visibility toggles
    const [showNewPassword, setShowNewPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);

    // Refs for keyboard navigation
    const newPasswordRef = useRef<TextInput>(null);
    const confirmPasswordRef = useRef<TextInput>(null);

    // Get screen title based on mode
    const getTitle = () => {
        return mode === 'create' ? 'Create Password' : 'Change Password';
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

        setLoading(true);

        try {
            // Update password using Supabase (works for authenticated users without old password)
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

            // Navigate back after showing success
            setTimeout(() => {
                router.back();
            }, 2000);

        } catch (err: any) {
            console.error('[SetNewPassword] Error:', err);
            setError(err.message || 'Failed to update password');
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
                <StyledScrollView className="flex-1" contentContainerStyle={{ paddingHorizontal: 24 }} keyboardShouldPersistTaps="handled">
                    {/* Header — centered title with absolute-positioned back button */}
                    <StyledView className="py-4" style={{ position: 'relative', alignItems: 'center', justifyContent: 'center', minHeight: 48 }}>
                        <StyledTouchableOpacity
                            testID="password-back"
                            onPress={() => {
                                hapticsManager.light();
                                router.back();
                            }}
                            style={{ position: 'absolute', left: 0, top: 16 }}
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
                                Your password has been updated successfully.
                            </StyledText>
                        </StyledView>
                    ) : (
                        <StyledView className="py-4">
                            {/* Description */}
                            <StyledText className="text-slate-600 dark:text-slate-400 mb-6">
                                {mode === 'create' && 'Create a password to enable email login alongside your social account.'}
                                {mode === 'change' && 'Choose a new password for your account.'}
                            </StyledText>

                            {/* New Password */}
                            <StyledView className="mb-4">
                                <StyledText className="text-slate-700 dark:text-slate-300 font-n-medium mb-2">
                                    {mode === 'change' ? 'New Password' : 'Password'}
                                </StyledText>
                                <StyledView style={{ position: 'relative' }}>
                                    <StyledTextInput
                                        ref={newPasswordRef}
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
                                        textContentType="newPassword"
                                        returnKeyType="next"
                                        onSubmitEditing={() => confirmPasswordRef.current?.focus()}
                                        blurOnSubmit={false}
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
                                        ref={confirmPasswordRef}
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
                                        textContentType="newPassword"
                                        returnKeyType="done"
                                        onSubmitEditing={handleSubmit}
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
