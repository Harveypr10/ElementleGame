/**
 * League Join Flow
 *
 * Handles both:
 *  1. Deep link join: pre-filled join code from pending state
 *  2. Manual join: user enters code manually
 *
 * Sets global_display_name if not already set, then joins the league.
 */

import React, { useState, useEffect, useRef } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform,
    Alert,
    Animated,
} from 'react-native';
import { styled } from 'nativewind';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ChevronLeft, UserCircle, KeyRound } from 'lucide-react-native';
import { Image } from 'expo-image';
import { useLeague } from '../../contexts/LeagueContext';
import { useJoinLeague, useGlobalIdentity, useSetGlobalIdentity } from '../../hooks/useLeagueData';
import { useAuth } from '../../lib/auth';
import { useProfile } from '../../hooks/useProfile';
import { useThemeColor } from '../../hooks/useThemeColor';
import { ThemedView } from '../../components/ThemedView';
import { ThemedText } from '../../components/ThemedText';

const StyledView = styled(View);
const StyledTouchableOpacity = styled(TouchableOpacity);

const WelcomeHamster = require('../../assets/ui/webp_assets/Win-Hamster-Blue.webp');

// ─── Profanity Filter ───────────────────────────────────────────────────
const BLOCKED_WORDS = [
    'ass', 'arse', 'bastard', 'bitch', 'bollocks', 'cock', 'crap', 'cunt',
    'damn', 'dick', 'dildo', 'dyke', 'fag', 'fuck', 'hell', 'homo',
    'jerk', 'kike', 'nigger', 'nigga', 'penis', 'piss', 'prick', 'pussy',
    'queer', 'rape', 'retard', 'shit', 'slut', 'spic', 'tit', 'twat',
    'vagina', 'wank', 'whore',
];

function containsProfanity(text: string): boolean {
    const lower = text.toLowerCase().replace(/[^a-z]/g, ' ');
    const words = lower.split(/\s+/);
    return words.some(word => BLOCKED_WORDS.includes(word));
}

function isAlphanumericWithSpaces(text: string): boolean {
    return /^[a-zA-Z0-9 ]*$/.test(text);
}

export default function JoinLeagueScreen() {
    const router = useRouter();
    const { user } = useAuth();
    const { profile } = useProfile();

    // Theme colors
    const backgroundColor = useThemeColor({}, 'background');
    const surfaceColor = useThemeColor({}, 'surface');
    const borderColor = useThemeColor({}, 'border');
    const textColor = useThemeColor({}, 'text');
    const iconColor = useThemeColor({}, 'icon');
    const highlightSurface = useThemeColor({ light: '#dbeafe', dark: '#1e3a5f' }, 'surface');

    const { consumePendingJoinCode } = useLeague();
    const joinLeague = useJoinLeague();
    const setGlobalIdentity = useSetGlobalIdentity();
    const { data: globalIdentity } = useGlobalIdentity();

    const [joinCode, setJoinCode] = useState('');
    const [displayName, setDisplayName] = useState('');
    const [step, setStep] = useState<'code' | 'name' | 'success'>('code');
    const [error, setError] = useState<string | null>(null);

    // Entry animation refs
    const slideAnim = useRef(new Animated.Value(-80)).current;
    const scaleAnim = useRef(new Animated.Value(0.3)).current;
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const confettiScale = useRef(new Animated.Value(0)).current;

    // Auto-fill from deep link
    useEffect(() => {
        const code = consumePendingJoinCode();
        if (code) {
            console.log('[JoinLeague] Auto-filling join code from deep link:', code);
            setJoinCode(code);
            setStep('name'); // Skip code entry
        }
    }, []);

    // Default display name from global identity or profile
    useEffect(() => {
        if (!displayName) {
            if (globalIdentity?.global_display_name) {
                setDisplayName(globalIdentity.global_display_name);
            } else if (profile?.first_name) {
                setDisplayName(profile.first_name);
            }
        }
    }, [globalIdentity, profile]);

    const handleCodeSubmit = () => {
        if (joinCode.trim().length < 4) {
            setError('Please enter a valid join code');
            return;
        }
        setError(null);
        setStep('name');
    };

    const validateDisplayName = (name: string): string | null => {
        const trimmed = name.trim();
        if (!trimmed) return 'Please enter a display name';
        if (trimmed.length > 15) return 'Display name must be 15 characters or less';
        if (!isAlphanumericWithSpaces(trimmed)) return 'Only letters, numbers and spaces allowed';
        if (containsProfanity(trimmed)) return 'Please choose a different display name';
        return null;
    };

    const handleJoin = async () => {
        const validationError = validateDisplayName(displayName);
        if (validationError) {
            setError(validationError);
            return;
        }

        setError(null);
        try {
            // Set global identity if not yet set
            if (!globalIdentity?.global_display_name || !globalIdentity?.global_tag) {
                await setGlobalIdentity.mutateAsync(displayName.trim());
            }

            const result = await joinLeague.mutateAsync({
                joinCode: joinCode.trim().toUpperCase(),
                displayName: displayName.trim(),
            });

            // Success — show entry animation
            setStep('success');

            Animated.sequence([
                Animated.spring(scaleAnim, { toValue: 1, tension: 60, friction: 6, useNativeDriver: true }),
                Animated.parallel([
                    Animated.spring(slideAnim, { toValue: 0, tension: 50, friction: 8, useNativeDriver: true }),
                    Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
                ]),
                Animated.spring(confettiScale, { toValue: 1, tension: 40, friction: 5, useNativeDriver: true }),
            ]).start();

            setTimeout(() => {
                router.replace('/(tabs)/league');
            }, 2500);
        } catch (e: any) {
            console.error('[JoinLeague] Error:', e);
            if (e?.message?.includes('already a member')) {
                setError('You are already a member of this league');
            } else if (e?.message?.includes('Invalid join code')) {
                setError('Invalid join code. Please check and try again.');
                setStep('code');
            } else {
                setError(e?.message || 'Failed to join league');
            }
        }
    };

    const isJoining = joinLeague.isPending || setGlobalIdentity.isPending;

    return (
        <ThemedView className="flex-1">
            <SafeAreaView edges={['top']} style={{ backgroundColor }}>
                {/* Header — matches Settings pattern */}
                <StyledView className="flex-row items-center justify-center relative px-4 py-3" style={{ flexDirection: 'row' }}>
                    <StyledTouchableOpacity
                        onPress={() => router.back()}
                        style={{ position: 'absolute', left: 16, zIndex: 10, padding: 8 }}
                        hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
                    >
                        <ChevronLeft size={28} color={iconColor} />
                    </StyledTouchableOpacity>
                    <ThemedText size="2xl" className="font-n-bold text-center">Join League</ThemedText>
                </StyledView>
            </SafeAreaView>

            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={{ flex: 1 }}
            >
                <StyledView className="flex-1 px-6 pt-10 items-center" style={{ maxWidth: 768, alignSelf: 'center', width: '100%' }}>
                    {/* Hamster icon */}
                    <View style={{ marginBottom: 24 }}>
                        <Image source={WelcomeHamster} style={{ width: 80, height: 80 }} contentFit="contain" />
                    </View>

                    {step === 'success' ? (
                        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                            <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
                                <Image source={WelcomeHamster} style={{ width: 100, height: 100 }} contentFit="contain" />
                            </Animated.View>

                            <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }], alignItems: 'center', marginTop: 24 }}>
                                <ThemedText size="xl" className="font-n-extrabold text-center">You're in! 🎉</ThemedText>
                                <ThemedText className="font-n-regular text-center" style={{ color: iconColor, marginBottom: 16 }}>
                                    Welcome to the leaderboard
                                </ThemedText>

                                {/* Mock rank card */}
                                <View style={{
                                    flexDirection: 'row', alignItems: 'center',
                                    paddingHorizontal: 20, paddingVertical: 14,
                                    borderRadius: 12, width: '100%', gap: 12,
                                    backgroundColor: highlightSurface,
                                }}>
                                    <Text style={{ fontSize: 18, fontWeight: '700', fontFamily: 'Nunito_700Bold', width: 30, textAlign: 'center', color: '#1d4ed8' }}>—</Text>
                                    <Text style={{ flex: 1, fontSize: 16, fontWeight: '700', fontFamily: 'Nunito_700Bold', color: textColor }}>
                                        {displayName} ★
                                    </Text>
                                    <Text style={{ fontSize: 16, fontWeight: '700', fontFamily: 'Nunito_700Bold', color: '#b45309' }}>—</Text>
                                </View>
                            </Animated.View>

                            <Animated.View style={{ transform: [{ scale: confettiScale }], marginTop: 20 }}>
                                <Text style={{ fontSize: 32 }}>🏆</Text>
                            </Animated.View>
                        </View>
                    ) : step === 'code' ? (
                        <>
                            <ThemedText size="xl" className="font-n-extrabold text-center" style={{ marginBottom: 8 }}>
                                Enter join code
                            </ThemedText>
                            <ThemedText className="font-n-regular text-center" style={{ color: iconColor, marginBottom: 32, lineHeight: 20 }}>
                                Ask the league admin for the 8-character join code
                            </ThemedText>

                            <StyledView
                                className="flex-row items-center border rounded-xl w-full"
                                style={{ backgroundColor: surfaceColor, borderColor, paddingHorizontal: 16, paddingVertical: 14, gap: 12, flexDirection: 'row' }}
                            >
                                <KeyRound size={20} color={iconColor} />
                                <TextInput
                                    style={{ flex: 1, fontSize: 16, fontFamily: 'Nunito_600SemiBold', color: textColor }}
                                    value={joinCode}
                                    onChangeText={(text) => { setJoinCode(text.toUpperCase()); setError(null); }}
                                    placeholder="e.g. ABCD1234"
                                    placeholderTextColor="#94a3b8"
                                    autoCapitalize="characters"
                                    autoCorrect={false}
                                    maxLength={8}
                                />
                            </StyledView>

                            {error && (
                                <Text style={{ color: '#ef4444', fontSize: 13, fontFamily: 'Nunito_500Medium', textAlign: 'center', marginTop: 12 }}>{error}</Text>
                            )}

                            <TouchableOpacity
                                style={{
                                    width: '100%', paddingVertical: 14, borderRadius: 12, alignItems: 'center', marginTop: 16,
                                    backgroundColor: joinCode.trim().length >= 4 ? '#1d4ed8' : borderColor,
                                }}
                                onPress={handleCodeSubmit}
                                disabled={joinCode.trim().length < 4}
                            >
                                <Text style={{ color: '#ffffff', fontSize: 16, fontWeight: '700', fontFamily: 'Nunito_700Bold' }}>Continue</Text>
                            </TouchableOpacity>
                        </>
                    ) : (
                        <>
                            <ThemedText size="xl" className="font-n-extrabold text-center" style={{ marginBottom: 8 }}>
                                Choose display name
                            </ThemedText>
                            <ThemedText className="font-n-regular text-center" style={{ color: iconColor, marginBottom: 32, lineHeight: 20 }}>
                                This is how other players will see you on the leaderboard
                            </ThemedText>

                            <StyledView
                                className="flex-row items-center border rounded-xl w-full"
                                style={{ backgroundColor: surfaceColor, borderColor, paddingHorizontal: 16, paddingVertical: 14, gap: 12, flexDirection: 'row' }}
                            >
                                <UserCircle size={20} color={iconColor} />
                                <TextInput
                                    style={{ flex: 1, fontSize: 16, fontFamily: 'Nunito_600SemiBold', color: textColor }}
                                    value={displayName}
                                    onChangeText={(text) => {
                                        // Only allow alphanumeric + spaces, max 15 chars
                                        const filtered = text.replace(/[^a-zA-Z0-9 ]/g, '').slice(0, 15);
                                        setDisplayName(filtered);
                                        setError(null);
                                    }}
                                    placeholder="Your display name"
                                    placeholderTextColor="#94a3b8"
                                    autoCorrect={false}
                                    maxLength={15}
                                />
                            </StyledView>

                            <Text style={{ fontSize: 12, fontFamily: 'Nunito_400Regular', color: '#94a3b8', textAlign: 'center', marginTop: 8 }}>
                                You can amend your display name within the Manage Leagues menu at any time.
                            </Text>

                            {error && (
                                <Text style={{ color: '#ef4444', fontSize: 13, fontFamily: 'Nunito_500Medium', textAlign: 'center', marginTop: 12 }}>{error}</Text>
                            )}

                            <TouchableOpacity
                                style={{
                                    width: '100%', paddingVertical: 14, borderRadius: 12, alignItems: 'center', marginTop: 16,
                                    backgroundColor: displayName.trim().length > 0 ? '#1d4ed8' : borderColor,
                                }}
                                onPress={handleJoin}
                                disabled={isJoining || !displayName.trim()}
                            >
                                {isJoining ? (
                                    <ActivityIndicator color="#ffffff" />
                                ) : (
                                    <Text style={{ color: '#ffffff', fontSize: 16, fontWeight: '700', fontFamily: 'Nunito_700Bold' }}>Join League</Text>
                                )}
                            </TouchableOpacity>

                            <TouchableOpacity style={{ marginTop: 16, paddingVertical: 8 }} onPress={() => setStep('code')}>
                                <Text style={{ fontSize: 14, fontFamily: 'Nunito_500Medium', color: iconColor }}>← Back to code entry</Text>
                            </TouchableOpacity>
                        </>
                    )}
                </StyledView>
            </KeyboardAvoidingView>
        </ThemedView>
    );
}
