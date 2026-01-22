import React, { useState, useEffect, useRef } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    ScrollView,
    StyleSheet,
    ActivityIndicator,
    useColorScheme,
    Platform,
    Alert,
    KeyboardAvoidingView,
    Keyboard,
} from 'react-native';
import { useRouter } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { PasswordInput } from '../../components/ui/PasswordInput';
import { validatePassword } from '../../lib/passwordValidation';
import { useAuth } from '../../lib/auth';
import { supabase } from '../../lib/supabase';
import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';

type LoginStep =
    | 'email'
    | 'password'
    | 'create-account'
    | 'magic-link'
    | 'set-password';

// Interface matching web app's /api/auth/check-user response
interface UserAuthInfo {
    exists: boolean;
    hasPassword: boolean;
    magicLinkEnabled: boolean;
    googleLinked: boolean;
    appleLinked: boolean;
}

// Email validation helper
const isValidEmail = (email: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
};

export default function LoginPage() {
    const router = useRouter();
    const colorScheme = useColorScheme();
    const isDarkMode = colorScheme === 'dark';
    const { signInWithEmail, signUpWithEmail } = useAuth();

    const [step, setStep] = useState<LoginStep>('email');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [sendingMagicLink, setSendingMagicLink] = useState(false);
    const [magicLinkSent, setMagicLinkSent] = useState(false);
    const [magicLinkCountdown, setMagicLinkCountdown] = useState(0);
    const [userAuthInfo, setUserAuthInfo] = useState<UserAuthInfo | null>(null);

    // Refs for keyboard navigation
    const emailRef = useRef<TextInput>(null);
    const passwordRef = useRef<TextInput>(null);
    const newPasswordRef = useRef<TextInput>(null);
    const confirmPasswordRef = useRef<TextInput>(null);

    const backgroundColor = isDarkMode ? 'hsl(222, 47%, 11%)' : '#FAFAFA';
    const textColor = isDarkMode ? '#FAFAFA' : '#54524F';
    const cardBg = isDarkMode ? '#1e293b' : '#fff';

    // Countdown timer for magic link resend
    useEffect(() => {
        if (magicLinkCountdown > 0) {
            const timer = setTimeout(() => setMagicLinkCountdown(magicLinkCountdown - 1), 1000);
            return () => clearTimeout(timer);
        }
    }, [magicLinkCountdown]);

    const handleEmailContinue = async () => {
        if (!isValidEmail(email)) {
            Alert.alert('Invalid Email', 'Please enter a valid email address');
            return;
        }

        setLoading(true);
        try {
            console.log('[Login] Checking user auth settings for:', email.trim().toLowerCase());

            // Call Edge Function to check user's auth settings (matches web app's /api/auth/check-user)
            const response = await fetch(
                `https://chhtmbrsxmdwwgrgsczd.supabase.co/functions/v1/check-user?email=${encodeURIComponent(email.trim().toLowerCase())}`
            );

            if (!response.ok) {
                console.error('[Login] Edge Function error:', response.status);
                Alert.alert('Error', 'Failed to check account. Please try again.');
                setLoading(false);
                return;
            }

            const authInfo = await response.json();
            console.log('[Login] User auth info:', authInfo);
            setUserAuthInfo(authInfo);

            // Route based on user's auth configuration
            if (!authInfo.exists) {
                // User doesn't exist - show create account
                setStep('create-account');
            } else if (authInfo.hasPassword) {
                // User has password - show password screen
                setStep('password');
            } else {
                // User exists but no password - show magic link
                setStep('magic-link');
            }
        } catch (error: any) {
            console.error('[Login] Error checking user:', error);
            Alert.alert('Error', 'Failed to check account. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const handlePasswordLogin = async () => {
        if (!password) return;

        setLoading(true);
        try {
            const { error } = await signInWithEmail(email, password);
            if (error) {
                Alert.alert('Error', error.message || 'Invalid email or password');
                return;
            }

            console.log('Login successful');
            router.replace('/');
        } catch (error: any) {
            console.error('Login error:', error);
            Alert.alert('Error', error.message || 'Failed to log in');
        } finally {
            setLoading(false);
        }
    };

    const handleCreateAccount = async () => {
        if (password !== confirmPassword) {
            Alert.alert('Error', 'Passwords don\'t match');
            return;
        }

        const validation = validatePassword(password);
        if (!validation.valid) {
            Alert.alert('Invalid Password', validation.errors.join('\n'));
            return;
        }

        setLoading(true);
        try {
            const { error } = await signUpWithEmail(email, password);
            if (error) {
                // Check if user already exists
                if (error.message?.includes('already registered') || error.message?.includes('already exists')) {
                    Alert.alert(
                        'Account Exists',
                        'An account with this email already exists. Please log in instead.',
                        [
                            {
                                text: 'Log in',
                                onPress: () => setStep('password'),
                            },
                        ]
                    );
                    return;
                }

                Alert.alert('Error', error.message || 'Failed to create account');
                return;
            }


            console.log('Account created successfully');
            router.push('/(auth)/personalise');
        } catch (error: any) {
            console.error('Signup error:', error);
            Alert.alert('Error', error.message || 'Failed to create account');
        } finally {
            setLoading(false);
        }
    };

    const handleSendMagicLink = async () => {
        setLoading(true);
        try {
            const { error } = await supabase.auth.signInWithOtp({
                email,
                options: {
                    emailRedirectTo: 'elementle://auth/callback',
                },
            });

            if (error) {
                Alert.alert('Error', error.message || 'Failed to send magic link');
                return;
            }

            console.log('Magic link sent to:', email);
            setMagicLinkSent(true);
            setMagicLinkCountdown(60);
        } catch (error: any) {
            console.error('Magic link error:', error);
            Alert.alert('Error', error.message || 'Failed to send magic link');
        } finally {
            setLoading(false);
        }
    };

    const handleGoogleSignIn = async () => {
        try {
            // Generate proper redirect URI that works in both Expo Go and standalone builds
            const redirectUri = AuthSession.makeRedirectUri({ path: 'google-auth' });
            console.log('[Login] OAuth redirect URI:', redirectUri);

            const { data, error } = await supabase.auth.signInWithOAuth({
                provider: 'google',
                options: {
                    redirectTo: redirectUri,
                    skipBrowserRedirect: false,
                },
            });

            if (error) {
                Alert.alert('Error', error.message || 'Failed to sign in with Google');
                return;
            }

            if (data?.url) {
                console.log('[Login] Opening OAuth URL:', data.url);
                // Manually open the OAuth URL in a browser
                const result = await WebBrowser.openAuthSessionAsync(
                    data.url,
                    redirectUri
                );

                console.log('[Login] Browser result:', result);

                if (result.type === 'success') {
                    console.log('[Login] OAuth success, session should update automatically');
                }
            }
        } catch (error: any) {
            console.error('Google sign-in error:', error);
            Alert.alert('Error', error.message || 'Failed to sign in with Google');
        }
    };

    const handleAppleSignIn = async () => {
        try {
            // Generate proper redirect URI that works in both Expo Go and standalone builds
            const redirectUri = AuthSession.makeRedirectUri({ path: 'apple-auth' });
            console.log('[Login] OAuth redirect URI:', redirectUri);

            const { data, error } = await supabase.auth.signInWithOAuth({
                provider: 'apple',
                options: {
                    redirectTo: redirectUri,
                    skipBrowserRedirect: true, // We'll handle browser manually
                },
            });

            if (error) {
                Alert.alert('Error', error.message || 'Failed to sign in with Apple');
                return;
            }

            if (data?.url) {
                console.log('[Login] Opening OAuth URL:', data.url);
                // Manually open the OAuth URL in a browser
                const result = await WebBrowser.openAuthSessionAsync(
                    data.url,
                    redirectUri
                );

                console.log('[Login] Browser result:', result);

                if (result.type === 'success') {
                    console.log('[Login] OAuth success, session should update automatically');
                }
            }
        } catch (error: any) {
            console.error('Apple sign-in error:', error);
            Alert.alert('Error', error.message || 'Failed to sign in with Apple');
        }
    };

    const handleBack = () => {
        if (step === 'email') {
            router.back();
        } else {
            setStep('email');
            setPassword('');
            setConfirmPassword('');
            setMagicLinkSent(false);
            setMagicLinkCountdown(0);
        }
    };

    return (
        <KeyboardAvoidingView
            style={[styles.container, { backgroundColor }]}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
        >
            <View style={styles.header}>
                <TouchableOpacity
                    onPress={handleBack}
                    style={styles.backButton}
                    onPressIn={() => Keyboard.dismiss()}
                >
                    <ChevronLeft size={28} color={textColor} />
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: textColor }]}>Log in</Text>
                <View style={styles.headerSpacer} />
            </View>

            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={styles.scrollContent}
                keyboardShouldPersistTaps="handled"
            >
                <View style={[styles.card, { backgroundColor: cardBg }]}>
                    {/* Step 1: Email Entry */}
                    {step === 'email' && (
                        <View style={styles.stepContainer}>
                            <TextInput
                                ref={emailRef}
                                style={[styles.input, { color: textColor }]}
                                className="font-nunito"
                                placeholder="Email"
                                placeholderTextColor="#999"
                                value={email}
                                onChangeText={setEmail}
                                keyboardType="email-address"
                                autoCapitalize="none"
                                autoCorrect={false}
                                returnKeyType="go"
                                onSubmitEditing={handleEmailContinue}
                                blurOnSubmit={false}
                            />

                            <TouchableOpacity
                                style={[
                                    styles.primaryButton,
                                    !isValidEmail(email) && styles.disabledButton
                                ]}
                                onPress={handleEmailContinue}
                                onPressIn={() => Keyboard.dismiss()}
                                disabled={!isValidEmail(email) || loading}
                            >
                                {loading ? (
                                    <ActivityIndicator color="#fff" />
                                ) : (
                                    <Text style={styles.primaryButtonText}>Continue</Text>
                                )}
                            </TouchableOpacity>

                            <View style={styles.divider}>
                                <View style={styles.dividerLine} />
                                <Text style={[styles.dividerText, { color: textColor }]}>or</Text>
                                <View style={styles.dividerLine} />
                            </View>

                            <TouchableOpacity
                                style={styles.oauthButton}
                                onPress={handleGoogleSignIn}
                                onPressIn={() => Keyboard.dismiss()}
                            >
                                <Text style={styles.oauthButtonText}>Continue with Google</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={styles.oauthButton}
                                onPress={handleAppleSignIn}
                                onPressIn={() => Keyboard.dismiss()}
                            >
                                <Text style={styles.oauthButtonText}>Continue with Apple</Text>
                            </TouchableOpacity>

                            <Text style={[styles.termsText, { color: textColor }]}>
                                By continuing, you agree to our{' '}
                                <Text style={styles.link}>Terms</Text> and{' '}
                                <Text style={styles.link}>Privacy Policy</Text>
                            </Text>
                        </View>
                    )}

                    {/* Step 2a: Password Login */}
                    {step === 'password' && (
                        <View style={styles.stepContainer}>
                            <Text style={[styles.stepTitle, { color: textColor }]}>Welcome back</Text>

                            <View style={styles.emailDisplay}>
                                <Text style={[styles.emailText, { color: textColor }]}>{email}</Text>
                                <TouchableOpacity onPress={() => setStep('email')}>
                                    <Text style={styles.editButton}>Edit</Text>
                                </TouchableOpacity>
                            </View>

                            <PasswordInput
                                ref={passwordRef}
                                value={password}
                                onChangeText={setPassword}
                                placeholder="Password"
                                returnKeyType="go"
                                onSubmitEditing={handlePasswordLogin}
                            />

                            <TouchableOpacity
                                style={styles.forgotPasswordButton}
                                onPress={() => Alert.alert('Forgot Password', 'Password reset functionality coming soon!')}
                            >
                                <Text style={styles.secondaryButtonText}>Forgot your password?</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={[styles.primaryButton, (!password || loading) && styles.disabledButton]}
                                onPress={handlePasswordLogin}
                                onPressIn={() => Keyboard.dismiss()}
                                disabled={!password || loading}
                            >
                                {loading ? (
                                    <ActivityIndicator color="#fff" />
                                ) : (
                                    <Text style={styles.primaryButtonText}>Log in</Text>
                                )}
                            </TouchableOpacity>

                            {/* Magic Link Option - only if enabled for this user */}
                            {userAuthInfo?.magicLinkEnabled && (
                                <TouchableOpacity
                                    style={[styles.outlineButton, (sendingMagicLink || magicLinkCountdown > 0) && styles.disabledButton]}
                                    onPress={handleSendMagicLink}
                                    disabled={sendingMagicLink || magicLinkCountdown > 0}
                                >
                                    {sendingMagicLink ? (
                                        <ActivityIndicator color="#7DAAE8" />
                                    ) : (
                                        <Text style={[styles.outlineButtonText, { color: textColor }]}>
                                            {magicLinkCountdown > 0
                                                ? `Resend in ${magicLinkCountdown}s`
                                                : magicLinkSent
                                                    ? 'Resend sign in link'
                                                    : 'Email me a one-time sign in link'}
                                        </Text>
                                    )}
                                </TouchableOpacity>
                            )}

                            {/* Google OAuth Option - only if linked */}
                            {userAuthInfo?.googleLinked && (
                                <TouchableOpacity
                                    style={styles.outlineButton}
                                    onPress={handleGoogleSignIn}
                                >
                                    <Text style={[styles.outlineButtonText, { color: textColor }]}>G  Continue with Google</Text>
                                </TouchableOpacity>
                            )}

                            {/* Apple OAuth Option - only if linked */}
                            {userAuthInfo?.appleLinked && (
                                <TouchableOpacity
                                    style={styles.outlineButton}
                                    onPress={handleAppleSignIn}
                                >
                                    <Text style={[styles.outlineButtonText, { color: textColor }]}>  Continue with Apple</Text>
                                </TouchableOpacity>
                            )}

                            {/* Magic Link Success Message */}
                            {magicLinkSent && (
                                <View style={styles.successMessage}>
                                    <Text style={styles.successMessageText}>
                                        Check your inbox for a secure login link. It expires in 5 minutes.
                                    </Text>
                                </View>
                            )}
                        </View>
                    )}

                    {/* Step 2b: Create Account */}
                    {step === 'create-account' && (
                        <View style={styles.stepContainer}>
                            <Text style={[styles.stepTitle, { color: textColor }]}>Create account</Text>

                            <View style={styles.emailDisplay}>
                                <Text style={[styles.emailText, { color: textColor }]}>{email}</Text>
                                <TouchableOpacity onPress={() => setStep('email')}>
                                    <Text style={styles.editButton}>Edit</Text>
                                </TouchableOpacity>
                            </View>

                            <PasswordInput
                                ref={newPasswordRef}
                                value={password}
                                onChangeText={setPassword}
                                placeholder="Password"
                                returnKeyType="next"
                                onSubmitEditing={() => confirmPasswordRef.current?.focus()}
                            />

                            <PasswordInput
                                ref={confirmPasswordRef}
                                value={confirmPassword}
                                onChangeText={setConfirmPassword}
                                placeholder="Confirm password"
                                returnKeyType="go"
                                onSubmitEditing={handleCreateAccount}
                            />

                            <Text style={[styles.helperText, { color: textColor }]}>
                                At least 8 characters including 1 letter, 1 number, and 1 special character
                            </Text>

                            <TouchableOpacity
                                style={[
                                    styles.primaryButton,
                                    (!password || !confirmPassword) && styles.disabledButton
                                ]}
                                onPress={handleCreateAccount}
                                onPressIn={() => Keyboard.dismiss()}
                                disabled={!password || !confirmPassword || loading}
                            >
                                {loading ? (
                                    <ActivityIndicator color="#fff" />
                                ) : (
                                    <Text style={styles.primaryButtonText}>Create account</Text>
                                )}
                            </TouchableOpacity>
                        </View>
                    )}

                    {/* Step 2c: Magic Link */}
                    {step === 'magic-link' && (
                        <View style={styles.stepContainer}>
                            <Text style={[styles.stepTitle, { color: textColor }]}>Welcome back</Text>

                            <View style={styles.emailDisplay}>
                                <Text style={[styles.emailText, { color: textColor }]}>{email}</Text>
                                <TouchableOpacity onPress={() => setStep('email')}>
                                    <Text style={styles.editButton}>Edit</Text>
                                </TouchableOpacity>
                            </View>

                            <Text style={[styles.messageText, { color: textColor }]}>
                                We'll send you a secure login link
                            </Text>

                            {magicLinkSent && (
                                <View style={styles.successMessage}>
                                    <Text style={styles.successMessageText}>
                                        Check your inbox for a secure login link. It expires in 5 minutes.
                                    </Text>
                                </View>
                            )}

                            <TouchableOpacity
                                style={[
                                    styles.primaryButton,
                                    magicLinkCountdown > 0 && styles.disabledButton
                                ]}
                                onPress={handleSendMagicLink}
                                onPressIn={() => Keyboard.dismiss()}
                                disabled={magicLinkCountdown > 0 || loading}
                            >
                                {loading ? (
                                    <ActivityIndicator color="#fff" />
                                ) : (
                                    <Text style={styles.primaryButtonText}>
                                        {magicLinkCountdown > 0
                                            ? `Resend in ${magicLinkCountdown}s`
                                            : magicLinkSent
                                                ? 'Resend link'
                                                : 'Email me a one-time sign in link'}
                                    </Text>
                                )}
                            </TouchableOpacity>

                            {userInfo?.hasPassword && (
                                <TouchableOpacity
                                    style={styles.secondaryButton}
                                    onPress={() => setStep('password')}
                                >
                                    <Text style={styles.secondaryButtonText}>Use password instead</Text>
                                </TouchableOpacity>
                            )}
                        </View>
                    )}

                    {/* Step 2d: Set Password (iOS PWA) */}
                    {step === 'set-password' && (
                        <View style={styles.stepContainer}>
                            <Text style={[styles.stepTitle, { color: textColor }]}>Set password</Text>

                            <View style={styles.emailDisplay}>
                                <Text style={[styles.emailText, { color: textColor }]}>{email}</Text>
                                <TouchableOpacity onPress={() => setStep('email')}>
                                    <Text style={styles.editButton}>Edit</Text>
                                </TouchableOpacity>
                            </View>

                            <Text style={[styles.messageText, { color: textColor }]}>
                                Magic links don't work well in iOS web apps. Please set a password to continue.
                            </Text>

                            <TouchableOpacity
                                style={styles.primaryButton}
                                onPress={() => Alert.alert('Send Email', 'Password reset email will be sent')}
                            >
                                <Text style={styles.primaryButtonText}>Send password reset email</Text>
                            </TouchableOpacity>
                        </View>
                    )}
                </View>

                {step !== 'email' && (
                    <TouchableOpacity
                        style={styles.returnLink}
                        onPress={() => setStep('email')}
                        onPressIn={() => Keyboard.dismiss()}
                    >
                        <Text style={styles.linkText}>Return to log in</Text>
                    </TouchableOpacity>
                )}
            </ScrollView>
        </KeyboardAvoidingView >
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
        paddingTop: Platform.OS === 'ios' ? 60 : 12,
    },
    backButton: {
        padding: 4,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        fontFamily: 'Nunito-Bold',
    },
    headerSpacer: {
        width: 32,
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        padding: 16,
    },
    card: {
        borderRadius: 12,
        padding: 24,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    stepContainer: {
        gap: 16,
    },
    stepTitle: {
        fontSize: 24,
        fontWeight: 'bold',
        fontFamily: 'Nunito-Bold',
        marginBottom: 8,
    },
    input: {
        borderWidth: 1,
        borderColor: '#d1d5db',
        borderRadius: 8,
        paddingHorizontal: 12,
        height: 48, // Explicit height instead of paddingVertical
        fontSize: 16,
        textAlignVertical: 'center', // Android fix
    },
    emailDisplay: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 8,
    },
    emailText: {
        fontSize: 16,
        fontFamily: 'Nunito',
    },
    editButton: {
        color: '#7DAAE8',
        fontSize: 14,
        fontFamily: 'Nunito-Bold',
    },
    primaryButton: {
        backgroundColor: '#7DAAE8',
        paddingVertical: 24,
        borderRadius: 9999,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 8,
    },
    primaryButtonText: {
        color: '#fff',
        fontSize: 18,
        fontWeight: 'bold',
        fontFamily: 'Nunito-Bold',
    },
    disabledButton: {
        opacity: 0.5,
    },
    secondaryButton: {
        paddingVertical: 12,
        alignItems: 'center',
    },
    forgotPasswordButton: {
        paddingVertical: 8,
        alignItems: 'flex-start',
    },
    secondaryButtonText: {
        color: '#7DAAE8',
        fontSize: 16,
        fontFamily: 'Nunito',
    },
    oauthButton: {
        borderWidth: 1,
        borderColor: '#d1d5db',
        paddingVertical: 12,
        borderRadius: 8,
        alignItems: 'center',
    },
    oauthButtonText: {
        fontSize: 16,
        fontFamily: 'Nunito',
    },
    outlineButton: {
        borderWidth: 2,
        borderColor: '#d1d5db',
        paddingVertical: 16,
        borderRadius: 8,
        alignItems: 'center',
        marginTop: 12,
    },
    outlineButtonText: {
        fontSize: 16,
        fontFamily: 'Nunito',
        fontWeight: '600',
    },
    successMessage: {
        backgroundColor: 'rgba(34, 197, 94, 0.1)',
        padding: 12,
        borderRadius: 8,
        marginTop: 12,
    },
    successMessageText: {
        color: '#16a34a',
        fontSize: 14,
        fontFamily: 'Nunito',
        textAlign: 'center',
    },
    divider: {
        flexDirection: 'row',
        alignItems: 'center',
        marginVertical: 8,
    },
    dividerLine: {
        flex: 1,
        height: 1,
        backgroundColor: '#d1d5db',
    },
    dividerText: {
        paddingHorizontal: 12,
        fontSize: 14,
        fontFamily: 'Nunito',
    },
    termsText: {
        fontSize: 12,
        textAlign: 'center',
        fontFamily: 'Nunito',
    },
    link: {
        color: '#7DAAE8',
        textDecorationLine: 'underline',
    },
    helperText: {
        fontSize: 12,
        fontFamily: 'Nunito',
    },
    messageText: {
        fontSize: 14,
        fontFamily: 'Nunito',
        marginVertical: 8,
    },
    returnLink: {
        marginTop: 16,
        alignItems: 'center',
    },
    linkText: {
        color: '#7DAAE8',
        fontSize: 14,
        fontFamily: 'Nunito',
    },
});
