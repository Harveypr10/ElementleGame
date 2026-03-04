import React, { useState, useEffect, useRef } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    ScrollView,
    StyleSheet,
    ActivityIndicator,
    Platform,
    Alert,
    KeyboardAvoidingView,
    Keyboard,
    Animated,
    Dimensions,
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { ChevronLeft, Mail } from 'lucide-react-native';
import { GoogleLogo } from '../../components/icons/GoogleLogo';
import { PasswordInput } from '../../components/ui/PasswordInput';

import { validatePassword } from '../../lib/passwordValidation';
import { useAuth } from '../../lib/auth';
import { useOptions } from '../../lib/options';
import { ThemedText } from '../../components/ThemedText';
import { ThemedView } from '../../components/ThemedView';
import { supabase, checkLinkedIdentity, signInWithLinkedIdentity } from '../../lib/supabase';
import { signInWithGoogle, signInWithApple, isAppleSignInAvailable, configureGoogleSignIn } from '../../lib/socialAuth';


// Conditionally import native-only modules to prevent web build failures
const AppleAuthentication = Platform.OS !== 'web'
    ? require('expo-apple-authentication')
    : null;
const GoogleSignin = Platform.OS !== 'web'
    ? require('@react-native-google-signin/google-signin').GoogleSignin
    : null;


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
    const params = useLocalSearchParams();
    const nextRoute = params.next as string;
    const initialStep = params.step as LoginStep;
    const subscribeFirst = params.subscribeFirst === '1';
    const fromGuest = params.fromGuest === '1';
    const intent = params.intent as string | undefined;
    const fromLeague = params.fromLeague === '1';

    const { darkMode: isDarkMode } = useOptions();
    const { signInWithEmail, signUpWithEmail, markSigningIn } = useAuth();

    const [step, setStep] = useState<LoginStep>(initialStep || 'email');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [sendingMagicLink, setSendingMagicLink] = useState(false);
    const [magicLinkSent, setMagicLinkSent] = useState(false);
    const [magicLinkCountdown, setMagicLinkCountdown] = useState(0);
    const [userAuthInfo, setUserAuthInfo] = useState<UserAuthInfo | null>(null);
    const [appleAvailable, setAppleAvailable] = useState(false);
    const [socialAuthHelperText, setSocialAuthHelperText] = useState<string | null>(null);

    // Promo banner for guests coming from game-result
    const [showPromoBanner, setShowPromoBanner] = useState(false);
    const [showLeagueBanner, setShowLeagueBanner] = useState(false);
    const leagueBannerAnim = useRef(new Animated.Value(250)).current;
    const insets = useSafeAreaInsets();
    const promoBannerAnim = useRef(new Animated.Value(250)).current; // starts off-screen (below)

    useEffect(() => {
        if (fromGuest && step === 'email') {
            // Small delay to let the screen render first
            const showTimer = setTimeout(() => {
                setShowPromoBanner(true);
                Animated.spring(promoBannerAnim, {
                    toValue: 0,
                    damping: 18,
                    stiffness: 120,
                    useNativeDriver: true,
                }).start();
            }, 400);

            // Auto-dismiss after 8 seconds
            const hideTimer = setTimeout(() => {
                Animated.timing(promoBannerAnim, {
                    toValue: 250,
                    duration: 300,
                    useNativeDriver: true,
                }).start(() => setShowPromoBanner(false));
            }, 8400);

            return () => {
                clearTimeout(showTimer);
                clearTimeout(hideTimer);
            };
        }
    }, [fromGuest, step]);

    // League invitation banner (similar to guest promo banner)
    useEffect(() => {
        if (fromLeague && step === 'email') {
            const showTimer = setTimeout(() => {
                setShowLeagueBanner(true);
                Animated.spring(leagueBannerAnim, {
                    toValue: 0,
                    damping: 18,
                    stiffness: 120,
                    useNativeDriver: true,
                }).start();
            }, 400);

            const hideTimer = setTimeout(() => {
                Animated.timing(leagueBannerAnim, {
                    toValue: 250,
                    duration: 300,
                    useNativeDriver: true,
                }).start(() => setShowLeagueBanner(false));
            }, 8400);

            return () => {
                clearTimeout(showTimer);
                clearTimeout(hideTimer);
            };
        }
    }, [fromLeague, step]);

    // Check Apple Sign-In availability on mount
    useEffect(() => {
        isAppleSignInAvailable().then(setAppleAvailable);
    }, []);

    // Clear helper text when navigating away
    useEffect(() => {
        if (step !== 'email') {
            setSocialAuthHelperText(null);
        }
    }, [step]);



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

            if (subscribeFirst) {
                router.replace('/(auth)/subscription-flow');
            } else {
                router.replace('/');
            }
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
            if (nextRoute) {
                router.replace(nextRoute);
            } else if (subscribeFirst) {
                router.push({
                    pathname: '/(auth)/personalise',
                    params: { subscribeFirst: '1' },
                });
            } else {
                router.push('/(auth)/personalise');
            }
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
        setLoading(true);
        setSocialAuthHelperText(null);
        try {
            console.log('[Login] Starting native Google sign-in');

            // Configure and get Google credential first
            configureGoogleSignIn();
            await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });

            // Sign out first to ensure fresh account selection
            try {
                await GoogleSignin.signOut();
            } catch (e) {
                // Ignore signout errors
            }

            const userInfo = await GoogleSignin.signIn();

            if (!userInfo.data?.idToken) {
                Alert.alert('Error', 'No identity token returned from Google');
                return;
            }

            const userName = {
                firstName: userInfo.data.user?.givenName || '',
                lastName: userInfo.data.user?.familyName || '',
            };

            // Check if this Google account is already linked to an existing user
            console.log('[Login] Checking for linked Google identity...');
            const linkCheck = await checkLinkedIdentity('google', userInfo.data.idToken);

            if (linkCheck.found) {
                // Account exists - use the Edge Function to sign in as the linked user
                console.log('[Login] Found linked Google account, signing in via Edge Function...');
                markSigningIn();
                const signInResult = await signInWithLinkedIdentity('google', userInfo.data.idToken);

                if (!signInResult.success) {
                    if (signInResult.isDisabled) {
                        Alert.alert('Account Disabled', 'This Google account has been disabled. Please re-enable it in Settings → Account Info.');
                    } else {
                        Alert.alert('Error', signInResult.error || 'Failed to sign in with linked Google account');
                    }
                    return;
                }

                console.log('[Login] Successfully signed in as linked user:', signInResult.userId);
                if (subscribeFirst) {
                    router.replace('/(auth)/subscription-flow');
                } else {
                    router.replace('/');
                }
            } else {
                // No linked account - show confirmation dialog
                Alert.alert(
                    'Create New Account?',
                    'No Elementle account is currently linked to this Google account. Continue to create a new account?',
                    [
                        {
                            text: 'Cancel',
                            style: 'cancel',
                            onPress: () => {
                                setSocialAuthHelperText(
                                    'To link your Google account with an existing Elementle account, sign in with your existing method and then Link your account in Settings → Account Info.'
                                );
                            }
                        },
                        {
                            text: 'Continue',
                            onPress: async () => {
                                setLoading(true);
                                try {
                                    markSigningIn();
                                    const result = await signInWithGoogle();

                                    if (!result.success) {
                                        if (result.error !== 'Sign in cancelled') {
                                            Alert.alert('Error', result.error || 'Failed to sign in with Google');
                                        }
                                        return;
                                    }

                                    console.log('[Login] Google sign-in successful, isNewUser:', result.isNewUser);

                                    if (result.isNewUser) {
                                        router.replace({
                                            pathname: '/(auth)/personalise',
                                            params: {
                                                firstName: userName.firstName,
                                                lastName: userName.lastName,
                                                ...(subscribeFirst ? { subscribeFirst: '1' } : {}),
                                            }
                                        });
                                    } else if (subscribeFirst) {
                                        router.replace('/(auth)/subscription-flow');
                                    } else {
                                        router.replace('/');
                                    }
                                } finally {
                                    setLoading(false);
                                }
                            }
                        }
                    ]
                );
            }
        } catch (error: any) {
            console.error('[Login] Google sign-in error:', error);
            if (error.code !== 'SIGN_IN_CANCELLED' && error.message !== 'Sign in cancelled') {
                Alert.alert('Error', error.message || 'Failed to sign in with Google');
            }
        } finally {
            setLoading(false);
        }
    };

    const handleAppleSignIn = async () => {
        // Check if Apple Sign-In is available
        const available = await isAppleSignInAvailable();
        if (!available) {
            Alert.alert('Not Available', 'Apple Sign-In is only available on iOS devices');
            return;
        }

        setLoading(true);
        setSocialAuthHelperText(null);
        try {
            console.log('[Login] Starting native Apple sign-in');

            // First, get the Apple credential to check for linked identity
            const credential = await AppleAuthentication.signInAsync({
                requestedScopes: [
                    AppleAuthentication.AppleAuthenticationScope.EMAIL,
                    AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
                ],
            });

            if (!credential.identityToken) {
                Alert.alert('Error', 'No identity token returned from Apple');
                return;
            }

            const userName = {
                firstName: credential.fullName?.givenName || '',
                lastName: credential.fullName?.familyName || '',
            };

            // Check if this Apple account is already linked to an existing user
            console.log('[Login] Checking for linked Apple identity...');
            const linkCheck = await checkLinkedIdentity('apple', credential.identityToken);

            if (linkCheck.found) {
                // Account exists - use the Edge Function to sign in as the linked user
                console.log('[Login] Found linked Apple account, signing in via Edge Function...');
                markSigningIn();
                const signInResult = await signInWithLinkedIdentity('apple', credential.identityToken);

                if (!signInResult.success) {
                    Alert.alert('Error', signInResult.error || 'Failed to sign in with linked Apple account');
                    return;
                }

                console.log('[Login] Successfully signed in as linked user:', signInResult.userId);
                if (subscribeFirst) {
                    router.replace('/(auth)/subscription-flow');
                } else {
                    router.replace('/');
                }
            } else {
                // No linked account - show confirmation dialog
                Alert.alert(
                    'Create New Account?',
                    'No Elementle account is currently linked to this Apple account. Continue to create a new account?',
                    [
                        {
                            text: 'Cancel',
                            style: 'cancel',
                            onPress: () => {
                                setSocialAuthHelperText(
                                    'To link your Apple account with an existing Elementle account, sign in with your existing method and then Link your account in Settings → Account Info.'
                                );
                            }
                        },
                        {
                            text: 'Continue',
                            onPress: async () => {
                                setLoading(true);
                                try {
                                    markSigningIn();
                                    const result = await signInWithApple();

                                    if (!result.success) {
                                        if (result.error !== 'Sign in cancelled') {
                                            Alert.alert('Error', result.error || 'Failed to sign in with Apple');
                                        }
                                        return;
                                    }

                                    console.log('[Login] Apple sign-in successful, isNewUser:', result.isNewUser);

                                    if (result.isNewUser) {
                                        router.replace({
                                            pathname: '/(auth)/personalise',
                                            params: {
                                                firstName: userName.firstName,
                                                lastName: userName.lastName,
                                                ...(subscribeFirst ? { subscribeFirst: '1' } : {}),
                                            }
                                        });
                                    } else if (subscribeFirst) {
                                        router.replace('/(auth)/subscription-flow');
                                    } else {
                                        router.replace('/');
                                    }
                                } finally {
                                    setLoading(false);
                                }
                            }
                        }
                    ]
                );
            }
        } catch (error: any) {
            console.error('[Login] Apple sign-in error:', error);
            if (error.code !== 'ERR_CANCELED') {
                Alert.alert('Error', error.message || 'Failed to sign in with Apple');
            }
        } finally {
            setLoading(false);
        }
    };

    const handleBack = () => {
        if (step === 'email') {
            // Always use replace to go back to onboarding - this avoids
            // "GO_BACK not handled" errors when the stack is empty
            router.replace('/(auth)/onboarding');
        } else {
            setStep('email');
            setPassword('');
            setConfirmPassword('');
            setMagicLinkSent(false);
            setMagicLinkCountdown(0);
        }
    };

    return (
        <ThemedView style={styles.container}>
            <SafeAreaView edges={['top']} style={{ backgroundColor: 'transparent' }}>
                <View style={styles.header}>
                    <TouchableOpacity
                        onPress={handleBack}
                        style={styles.backButton}
                        onPressIn={() => Keyboard.dismiss()}
                        hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
                    >
                        <ChevronLeft size={28} color={textColor} />
                    </TouchableOpacity>
                    <ThemedText size="2xl" className="font-n-bold" style={{ textAlign: 'center', lineHeight: 28 }}>
                        {(fromGuest || fromLeague) ? 'Create a Free Account\nor Log in' : intent === 'signup' ? 'Create Account' : 'Log in'}
                    </ThemedText>
                    <View style={styles.headerSpacer} />
                </View>
            </SafeAreaView>

            <KeyboardAvoidingView
                style={{ flex: 1 }}
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
            >

                <ScrollView
                    style={styles.scrollView}
                    contentContainerStyle={[styles.scrollContent, { maxWidth: 768, alignSelf: 'center', width: '100%' }]}
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
                                    autoComplete="username"
                                    textContentType="username"
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
                                    style={[styles.socialButton, styles.googleButton]}
                                    onPress={handleGoogleSignIn}
                                    onPressIn={() => Keyboard.dismiss()}
                                    disabled={loading}
                                >
                                    <View style={styles.socialButtonContent}>
                                        <GoogleLogo size={20} />
                                        <Text style={styles.socialButtonText}>Continue with Google</Text>
                                    </View>
                                </TouchableOpacity>

                                <TouchableOpacity
                                    style={[styles.socialButton, styles.appleButton, !appleAvailable && styles.disabledButton]}
                                    onPress={handleAppleSignIn}
                                    onPressIn={() => Keyboard.dismiss()}
                                    disabled={!appleAvailable || loading}
                                >
                                    <View style={styles.socialButtonContent}>
                                        <Text style={styles.appleIcon}></Text>
                                        <Text style={[styles.socialButtonText, { color: '#fff' }, !appleAvailable && { color: '#999' }]}>
                                            {appleAvailable ? 'Continue with Apple' : 'Apple (iOS only)'}
                                        </Text>
                                    </View>
                                </TouchableOpacity>

                                {/* Helper text when user cancels social auth */}
                                {socialAuthHelperText && (
                                    <Text style={styles.socialAuthHelperText}>
                                        {socialAuthHelperText}
                                    </Text>
                                )}

                                <Text style={[styles.termsText, { color: textColor }]}>
                                    By continuing, you agree to our{' '}
                                    <Text style={styles.link} onPress={() => router.push('/terms')}>Terms</Text> and{' '}
                                    <Text style={styles.link} onPress={() => router.push('/privacy')}>Privacy Policy</Text>
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
                                    textContentType="password"
                                    autoComplete="password"
                                    returnKeyType="go"
                                    onSubmitEditing={handlePasswordLogin}
                                />

                                <TouchableOpacity
                                    style={styles.forgotPasswordButton}
                                    onPress={() => {
                                        Alert.alert(
                                            'Trouble signing in?',
                                            'We will send a secure login link to your email. Click it to sign in instantly. You can then set a new password in the Account section of the Settings menu.',
                                            [
                                                { text: 'Cancel', style: 'cancel' },
                                                {
                                                    text: 'Continue',
                                                    onPress: async () => {
                                                        try {
                                                            const { error } = await supabase.auth.signInWithOtp({
                                                                email,
                                                                options: {
                                                                    emailRedirectTo: 'elementle://auth/callback',
                                                                },
                                                            });
                                                            if (error) throw error;
                                                            Alert.alert('Email Sent', 'Check your inbox for a secure login link. It expires in 5 minutes.');
                                                        } catch (err: any) {
                                                            Alert.alert('Error', err.message || 'Failed to send login link.');
                                                        }
                                                    },
                                                },
                                            ]
                                        );
                                    }}
                                >
                                    <Text style={styles.secondaryButtonText}>Trouble signing in?</Text>
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
                                        style={[styles.socialButton, styles.magicLinkButton, (sendingMagicLink || magicLinkCountdown > 0) && styles.disabledButton]}
                                        onPress={handleSendMagicLink}
                                        disabled={sendingMagicLink || magicLinkCountdown > 0}
                                    >
                                        {sendingMagicLink ? (
                                            <ActivityIndicator color="#7DAAE8" />
                                        ) : (
                                            <View style={styles.socialButtonContent}>
                                                <Mail size={20} color="#555" />
                                                <Text style={[styles.socialButtonText, { color: '#333' }]}>
                                                    {magicLinkCountdown > 0
                                                        ? `Resend in ${magicLinkCountdown}s`
                                                        : magicLinkSent
                                                            ? 'Resend sign in link'
                                                            : 'Email me a one-time sign in link'}
                                                </Text>
                                            </View>
                                        )}
                                    </TouchableOpacity>
                                )}

                                {/* Google OAuth Option - only if linked */}
                                {userAuthInfo?.googleLinked && (
                                    <TouchableOpacity
                                        style={[styles.socialButton, styles.googleButton]}
                                        onPress={handleGoogleSignIn}
                                    >
                                        <View style={styles.socialButtonContent}>
                                            <GoogleLogo size={20} />
                                            <Text style={styles.socialButtonText}>Continue with Google</Text>
                                        </View>
                                    </TouchableOpacity>
                                )}

                                {/* Apple OAuth Option - only if linked */}
                                {userAuthInfo?.appleLinked && (
                                    <TouchableOpacity
                                        style={[styles.socialButton, styles.appleButton]}
                                        onPress={handleAppleSignIn}
                                    >
                                        <View style={styles.socialButtonContent}>
                                            <Text style={styles.appleIcon}></Text>
                                            <Text style={[styles.socialButtonText, { color: '#fff' }]}>Continue with Apple</Text>
                                        </View>
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
                                    textContentType="newPassword"
                                    autoComplete="new-password"
                                    returnKeyType="next"
                                    onSubmitEditing={() => confirmPasswordRef.current?.focus()}
                                />

                                <PasswordInput
                                    ref={confirmPasswordRef}
                                    value={confirmPassword}
                                    onChangeText={setConfirmPassword}
                                    placeholder="Confirm password"
                                    textContentType="newPassword"
                                    autoComplete="new-password"
                                    returnKeyType="done"
                                    onSubmitEditing={() => Keyboard.dismiss()}
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

                                {userAuthInfo?.hasPassword && (
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
            </KeyboardAvoidingView>

            {/* Guest Promo Banner — slides up from bottom */}
            {showPromoBanner && (
                <Animated.View style={{
                    position: 'absolute',
                    bottom: 0,
                    left: 0,
                    right: 0,
                    transform: [{ translateY: promoBannerAnim }],
                    backgroundColor: '#7DAAE8',
                    borderTopLeftRadius: 24,
                    borderTopRightRadius: 24,
                    paddingHorizontal: 24,
                    paddingTop: 20,
                    paddingBottom: Platform.OS === 'android' ? Math.max(36, insets.bottom + 16) : 36,
                    alignItems: 'center',
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: -4 },
                    shadowOpacity: 0.15,
                    shadowRadius: 12,
                    elevation: 10,
                }}>
                    <TouchableOpacity
                        onPress={() => {
                            Animated.timing(promoBannerAnim, {
                                toValue: 250,
                                duration: 300,
                                useNativeDriver: true,
                            }).start(() => setShowPromoBanner(false));
                        }}
                        style={{ position: 'absolute', top: 12, right: 16, padding: 4 }}
                    >
                        <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 18, fontWeight: 'bold' }}>✕</Text>
                    </TouchableOpacity>
                    <Image
                        source={require('../../assets/ui/webp_assets/Login-Hamster-White.webp')}
                        style={{ width: 80, height: 80, marginBottom: 12 }}
                        contentFit="contain"
                    />
                    <Text style={{
                        color: '#FFFFFF',
                        fontSize: 18,
                        fontFamily: 'Nunito',
                        fontWeight: '600',
                        textAlign: 'center',
                        lineHeight: 22,
                        maxWidth: 320,
                    }}>
                        Create a free account or log in to save game data, explore the archive and play personalised puzzles
                    </Text>
                </Animated.View>
            )}

            {/* League Invitation Banner — slides up from bottom */}
            {showLeagueBanner && (
                <Animated.View style={{
                    position: 'absolute',
                    bottom: 0,
                    left: 0,
                    right: 0,
                    transform: [{ translateY: leagueBannerAnim }],
                    backgroundColor: '#8E57DB',
                    borderTopLeftRadius: 24,
                    borderTopRightRadius: 24,
                    paddingHorizontal: 24,
                    paddingTop: 20,
                    paddingBottom: Platform.OS === 'android' ? Math.max(36, insets.bottom + 16) : 36,
                    alignItems: 'center',
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: -4 },
                    shadowOpacity: 0.15,
                    shadowRadius: 12,
                    elevation: 10,
                }}>
                    <TouchableOpacity
                        onPress={() => {
                            Animated.timing(leagueBannerAnim, {
                                toValue: 250,
                                duration: 300,
                                useNativeDriver: true,
                            }).start(() => setShowLeagueBanner(false));
                        }}
                        style={{ position: 'absolute', top: 12, right: 16, padding: 4 }}
                    >
                        <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 18, fontWeight: 'bold' }}>✕</Text>
                    </TouchableOpacity>
                    <Image
                        source={require('../../assets/ui/webp_assets/Login-Hamster-White.webp')}
                        style={{ width: 80, height: 80, marginBottom: 12 }}
                        contentFit="contain"
                    />
                    <Text style={{
                        color: '#FFFFFF',
                        fontSize: 20,
                        fontFamily: 'Nunito_700Bold',
                        fontWeight: '700',
                        textAlign: 'center',
                        marginBottom: 6,
                    }}>
                        League invitation!
                    </Text>
                    <Text style={{
                        color: '#FFFFFF',
                        fontSize: 16,
                        fontFamily: 'Nunito_500Medium',
                        fontWeight: '500',
                        textAlign: 'center',
                        lineHeight: 22,
                        maxWidth: 320,
                    }}>
                        Sign in or create an account to join the league
                    </Text>
                </Animated.View>
            )}
        </ThemedView>
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
    },
    backButton: {
        width: 40,
        height: 40,
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerSpacer: {
        width: 40,
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
    // Unified social auth button styles
    socialButton: {
        paddingVertical: 14,
        borderRadius: 8,
        alignItems: 'center',
        marginTop: 8,
    },
    socialButtonContent: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
    },
    socialButtonText: {
        fontSize: 16,
        fontFamily: 'Nunito-SemiBold',
        fontWeight: '600',
        marginLeft: 12,
    },
    magicLinkButton: {
        backgroundColor: '#f0f0f0',
        borderWidth: 1,
        borderColor: '#e0e0e0',
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
    agePickerSection: {
        width: '100%',
        marginTop: 16,
        marginBottom: 8,
    },
    agePickerLabel: {
        fontSize: 14,
        fontWeight: 'bold',
        fontFamily: 'Nunito-Bold',
        marginBottom: 8,
    },
    // OAuth button styles
    googleButton: {
        backgroundColor: '#fff',
        borderWidth: 1,
        borderColor: '#d1d5db',
    },
    appleButton: {
        backgroundColor: '#000',
    },
    oauthButtonContent: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
    },
    googleIcon: {
        width: 24,
        height: 24,
        borderRadius: 12,
        backgroundColor: '#fff',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    googleIconText: {
        color: '#ea4335',
        fontSize: 16,
        fontWeight: 'bold',
    },
    appleIcon: {
        fontSize: 20,
        color: '#fff',
    },
    appleNativeButton: {
        height: 52,
        marginTop: 8,
    },
    socialAuthHelperText: {
        color: '#dc2626',
        fontSize: 12,
        fontFamily: 'Nunito-Regular',
        textAlign: 'center',
        marginTop: 12,
        paddingHorizontal: 8,
    },
});
