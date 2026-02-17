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
import { useThemeColor } from '../../hooks/useThemeColor';

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

    // Theme colors
    const backgroundColor = useThemeColor({}, 'background');
    const textColor = useThemeColor({}, 'text');
    const surfaceColor = useThemeColor({}, 'surface');
    const iconColor = useThemeColor({}, 'icon');
    const secondaryTextColor = useThemeColor({ light: '#64748b', dark: '#94a3b8' }, 'icon');
    const inputBg = useThemeColor({ light: '#f1f5f9', dark: '#1e293b' }, 'surface');
    const reqBg = useThemeColor({ light: '#f8fafc', dark: 'rgba(30,41,59,0.5)' }, 'surface');

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
        <SafeAreaView style={{ flex: 1, backgroundColor }}>
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
                            <ChevronLeft size={28} color={iconColor} />
                        </StyledTouchableOpacity>
                        <StyledText style={{ fontSize: 24, fontWeight: 'bold', color: textColor }} className="font-n-bold">
                            {getTitle()}
                        </StyledText>
                    </StyledView>

                    {success ? (
                        <StyledView className="flex-1 justify-center items-center py-20">
                            <StyledView className="w-20 h-20 rounded-full bg-green-100 items-center justify-center mb-4">
                                <Check size={40} color="#22c55e" />
                            </StyledView>
                            <StyledText style={{ fontSize: 24, fontWeight: 'bold', color: textColor, textAlign: 'center', marginBottom: 8 }} className="font-n-bold">
                                Password Updated!
                            </StyledText>
                            <StyledText style={{ color: secondaryTextColor, textAlign: 'center' }}>
                                Your password has been updated successfully.
                            </StyledText>
                        </StyledView>
                    ) : (
                        <StyledView className="py-4">
                            {/* Description */}
                            <StyledText style={{ color: secondaryTextColor, marginBottom: 24 }}>
                                {mode === 'create' && 'Create a password to enable email login alongside your social account.'}
                                {mode === 'change' && 'Choose a new password for your account.'}
                            </StyledText>

                            {/* New Password */}
                            <StyledView className="mb-4">
                                <StyledText style={{ color: textColor, marginBottom: 8 }} className="font-n-medium">
                                    {mode === 'change' ? 'New Password' : 'Password'}
                                </StyledText>
                                <View style={{ position: 'relative' }}>
                                    {/* Secure input — always secureTextEntry=true */}
                                    <StyledTextInput
                                        ref={!showNewPassword ? newPasswordRef : undefined}
                                        testID="new-password-input"
                                        className="font-n-medium"
                                        style={[
                                            { backgroundColor: inputBg, paddingHorizontal: 16, paddingVertical: 16, borderRadius: 12, color: textColor, paddingRight: 48 },
                                            showNewPassword && { position: 'absolute', width: 0, height: 0, opacity: 0 },
                                        ]}
                                        placeholder="Enter new password"
                                        placeholderTextColor="#94a3b8"
                                        value={newPassword}
                                        onChangeText={setNewPassword}
                                        secureTextEntry={true}
                                        autoCapitalize="none"
                                        autoCorrect={false}
                                        textContentType="newPassword"
                                        returnKeyType="next"
                                        onSubmitEditing={() => confirmPasswordRef.current?.focus()}
                                        blurOnSubmit={false}
                                        editable={!loading}
                                        pointerEvents={showNewPassword ? 'none' : 'auto'}
                                    />
                                    {/* Plain text input — always secureTextEntry=false */}
                                    <StyledTextInput
                                        ref={showNewPassword ? newPasswordRef : undefined}
                                        testID="new-password-input-visible"
                                        className="font-n-medium"
                                        style={[
                                            { backgroundColor: inputBg, paddingHorizontal: 16, paddingVertical: 16, borderRadius: 12, color: textColor, paddingRight: 48 },
                                            !showNewPassword && { position: 'absolute', width: 0, height: 0, opacity: 0 },
                                        ]}
                                        placeholder="Enter new password"
                                        placeholderTextColor="#94a3b8"
                                        value={newPassword}
                                        onChangeText={setNewPassword}
                                        secureTextEntry={false}
                                        autoCapitalize="none"
                                        autoCorrect={false}
                                        returnKeyType="next"
                                        onSubmitEditing={() => confirmPasswordRef.current?.focus()}
                                        blurOnSubmit={false}
                                        editable={!loading}
                                        pointerEvents={showNewPassword ? 'auto' : 'none'}
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
                                </View>
                            </StyledView>

                            {/* Password Requirements */}
                            {newPassword.length > 0 && (
                                <StyledView style={{ backgroundColor: reqBg, padding: 16, borderRadius: 12, marginBottom: 16 }}>
                                    <StyledText style={{ color: textColor, fontSize: 14, marginBottom: 8 }} className="font-n-medium">
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
                                <StyledText style={{ color: textColor, marginBottom: 8 }} className="font-n-medium">
                                    Confirm Password
                                </StyledText>
                                <View style={{ position: 'relative' }}>
                                    {/* Secure confirm input */}
                                    <StyledTextInput
                                        ref={!showConfirmPassword ? confirmPasswordRef : undefined}
                                        testID="confirm-password-input"
                                        className="font-n-medium"
                                        style={[
                                            { backgroundColor: inputBg, paddingHorizontal: 16, paddingVertical: 16, borderRadius: 12, color: textColor, paddingRight: 48 },
                                            confirmPassword.length > 0 && !passwordsMatch && { borderWidth: 2, borderColor: '#ef4444' },
                                            confirmPassword.length > 0 && passwordsMatch && { borderWidth: 2, borderColor: '#22c55e' },
                                            showConfirmPassword && { position: 'absolute', width: 0, height: 0, opacity: 0 },
                                        ]}
                                        placeholder="Confirm new password"
                                        placeholderTextColor="#94a3b8"
                                        value={confirmPassword}
                                        onChangeText={setConfirmPassword}
                                        secureTextEntry={true}
                                        autoCapitalize="none"
                                        autoCorrect={false}
                                        textContentType="newPassword"
                                        returnKeyType="done"
                                        onSubmitEditing={handleSubmit}
                                        editable={!loading}
                                        pointerEvents={showConfirmPassword ? 'none' : 'auto'}
                                    />
                                    {/* Plain text confirm input */}
                                    <StyledTextInput
                                        ref={showConfirmPassword ? confirmPasswordRef : undefined}
                                        testID="confirm-password-input-visible"
                                        className="font-n-medium"
                                        style={[
                                            { backgroundColor: inputBg, paddingHorizontal: 16, paddingVertical: 16, borderRadius: 12, color: textColor, paddingRight: 48 },
                                            confirmPassword.length > 0 && !passwordsMatch && { borderWidth: 2, borderColor: '#ef4444' },
                                            confirmPassword.length > 0 && passwordsMatch && { borderWidth: 2, borderColor: '#22c55e' },
                                            !showConfirmPassword && { position: 'absolute', width: 0, height: 0, opacity: 0 },
                                        ]}
                                        placeholder="Confirm new password"
                                        placeholderTextColor="#94a3b8"
                                        value={confirmPassword}
                                        onChangeText={setConfirmPassword}
                                        secureTextEntry={false}
                                        autoCapitalize="none"
                                        autoCorrect={false}
                                        returnKeyType="done"
                                        onSubmitEditing={handleSubmit}
                                        editable={!loading}
                                        pointerEvents={showConfirmPassword ? 'auto' : 'none'}
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
                                </View>
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
        </SafeAreaView >
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
