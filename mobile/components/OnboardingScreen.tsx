import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, Platform, Linking } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { formatCanonicalDateWithOrdinal } from '../lib/dateFormat';
import { ThemedView } from './ThemedView';
import { ThemedText } from './ThemedText';
import { useOptions } from '../lib/options';

// ── Web Platform Detection ──────────────────────────────────────────
// Platform.OS returns 'web' for all browsers — we use userAgent to
// distinguish iOS, Android, and Desktop web visitors.
type WebPlatform = 'ios' | 'android' | 'desktop';

function getWebPlatform(): WebPlatform {
    if (Platform.OS !== 'web') return 'desktop'; // shouldn't reach here on native, but safe default
    const ua = (typeof navigator !== 'undefined' ? navigator.userAgent : '').toLowerCase();
    if (/iphone|ipad|ipod/.test(ua)) return 'ios';
    if (/android/.test(ua)) return 'android';
    return 'desktop';
}

const APP_STORE_URL = 'https://apps.apple.com/app/id6758105410';
const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=com.dobl.elementle';
const APPLE_BADGE_URL = 'https://developer.apple.com/assets/elements/badges/download-on-the-app-store.svg';
const GOOGLE_BADGE_URL = 'https://play.google.com/intl/en_us/badges/static/images/badges/en_badge_web_generic.png';

// ── Component ───────────────────────────────────────────────────────

interface OnboardingScreenProps {
    eventTitle: string;
    puzzleDateCanonical: string;
    onPlay: () => void;
    onCreateAccount: () => void;
    onLoginLink: () => void;
    onSubscribe: () => void;
    onDevReset?: () => void;
}

export function OnboardingScreen({
    eventTitle,
    puzzleDateCanonical,
    onPlay,
    onCreateAccount,
    onLoginLink,
    onSubscribe,
    onDevReset,
}: OnboardingScreenProps) {
    const { darkMode: isDarkMode } = useOptions();
    const router = useRouter();
    const isWeb = Platform.OS === 'web';
    const insets = useSafeAreaInsets();

    // Format date as "15th January 2026"
    const displayDate = useMemo(
        () => formatCanonicalDateWithOrdinal(puzzleDateCanonical),
        [puzzleDateCanonical]
    );

    const backgroundColor = isDarkMode ? 'hsl(222, 47%, 11%)' : '#FAFAFA';
    const textColor = isDarkMode ? '#FAFAFA' : '#54524F';
    const secondaryTextColor = isDarkMode ? 'rgba(255, 255, 255, 0.6)' : '#999';

    const handleClearAsyncStorage = async () => {
        try {
            await AsyncStorage.clear();
            Alert.alert('Cleared', 'AsyncStorage cleared. Reload app to test fresh.');
        } catch (e) {
            Alert.alert('Error', 'Failed to clear storage');
        }
    };

    // ── Store Badge Rendering (Web Only) ────────────────────────────
    const renderStoreBadges = () => {
        const webPlatform = getWebPlatform();

        const ctaText = webPlatform === 'desktop'
            ? 'For the full experience, play on your mobile device:'
            : 'To get the full experience:';

        const openLink = (url: string) => {
            if (typeof window !== 'undefined') {
                window.open(url, '_blank', 'noopener');
            } else {
                Linking.openURL(url);
            }
        };

        return (
            <View style={styles.storeCTAContainer}>
                <ThemedText
                    baseSize={14}
                    style={styles.storeCTAText}
                    testID="text-store-cta"
                >
                    {ctaText}
                </ThemedText>

                <View style={styles.badgesRow}>
                    {/* Apple Badge: show on iOS web or Desktop */}
                    {(webPlatform === 'ios' || webPlatform === 'desktop') && (
                        <TouchableOpacity
                            onPress={() => openLink(APP_STORE_URL)}
                            activeOpacity={0.8}
                            testID="badge-app-store"
                            style={styles.badgeTouchable}
                        >
                            <Image
                                source={{ uri: APPLE_BADGE_URL }}
                                style={styles.appleBadge}
                                contentFit="contain"
                            />
                        </TouchableOpacity>
                    )}

                    {/* Google Badge: show on Android web or Desktop */}
                    {(webPlatform === 'android' || webPlatform === 'desktop') && (
                        <TouchableOpacity
                            onPress={() => openLink(PLAY_STORE_URL)}
                            activeOpacity={0.8}
                            testID="badge-play-store"
                            style={styles.badgeTouchable}
                        >
                            <Image
                                source={{ uri: GOOGLE_BADGE_URL }}
                                style={styles.googleBadge}
                                contentFit="contain"
                            />
                        </TouchableOpacity>
                    )}
                </View>
            </View>
        );
    };

    return (
        <ThemedView
            style={[styles.container, Platform.OS === 'android' ? { paddingBottom: Math.max(24, insets.bottom + 12) } : undefined]}
            testID="onboarding-screen"
        >
            <View style={styles.content}>
                {/* Flex spacer 0: top of screen → title */}
                <View style={{ flex: 1, maxHeight: 64 }} />

                {/* Top section: Title + Hamster (fixed spacing) */}
                <ThemedText
                    baseSize={44}
                    style={styles.title}
                    testID="text-onboarding-title"
                >
                    Elementle
                </ThemedText>

                <View style={styles.hamsterContainer}>
                    <Image
                        source={require('../assets/Welcome-Hamster-Cutout.png')}
                        style={styles.hamsterImage}
                        contentFit="contain"
                        cachePolicy="disk"
                        testID="img-onboarding-hamster"
                    />
                </View>

                {/* Flex spacer 1: hamster → prompt text */}
                <View style={{ flex: 1, maxHeight: 64 }} />

                {/* Middle section: Question + Event Title */}
                <View style={styles.textContainer}>
                    <ThemedText
                        baseSize={18}
                        style={styles.prompt}
                        testID="text-onboarding-prompt"
                    >
                        On what date did this historical event occur?
                    </ThemedText>

                    <ThemedText
                        baseSize={20}
                        style={styles.eventTitle}
                        testID="text-onboarding-event"
                    >
                        {eventTitle}
                    </ThemedText>
                </View>

                {/* Flex spacer 2: event title → buttons */}
                <View style={{ flex: 1, maxHeight: 45 }} />

                {/* Buttons + login link */}
                <View style={styles.buttonsContainer}>
                    <TouchableOpacity
                        onPress={onPlay}
                        style={[styles.button, styles.playButton]}
                        testID="button-onboarding-play"
                        activeOpacity={0.9}
                    >
                        <Text style={styles.buttonText}>Play</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        onPress={onCreateAccount}
                        style={[styles.button, styles.greyButton]}
                        testID="button-onboarding-create-account"
                        activeOpacity={0.9}
                    >
                        <Text style={styles.buttonText}>Create Account</Text>
                    </TouchableOpacity>

                    {/* "Already playing? Log in" text link */}
                    <TouchableOpacity
                        onPress={onLoginLink}
                        activeOpacity={0.8}
                        testID="link-onboarding-login"
                        style={{ paddingVertical: 4 }}
                        hitSlop={{ top: 10, bottom: 10 }}
                    >
                        <Text style={[styles.loginLinkText, { color: secondaryTextColor }]}>
                            Already playing?{' '}
                            <Text style={{ fontWeight: 'bold', textDecorationLine: 'underline', color: '#333' }}>Log in</Text>
                        </Text>
                    </TouchableOpacity>

                    {/* Web: Show app store badges */}
                    {isWeb && renderStoreBadges()}
                </View>

                {/* Flex spacer 3: login link → date */}
                <View style={{ flex: 1, maxHeight: 64 }} />

                {/* Footer: Date + Links */}
                <ThemedText
                    baseSize={14}
                    className="opacity-60"
                    style={styles.dateText}
                    testID="text-onboarding-date"
                >
                    Puzzle date: {displayDate}
                </ThemedText>

                {/* Privacy, Support & Subscribe (mobile) Links */}
                <View style={styles.linksContainer}>
                    <TouchableOpacity onPress={() => router.push('/privacy')} activeOpacity={0.7} hitSlop={{ top: 10, bottom: 10 }}>
                        <ThemedText baseSize={13} style={styles.linkText}>Privacy Policy</ThemedText>
                    </TouchableOpacity>
                    <ThemedText baseSize={13} style={styles.linkSeparator}>·</ThemedText>
                    <TouchableOpacity onPress={() => router.push('/support')} activeOpacity={0.7} hitSlop={{ top: 10, bottom: 10 }}>
                        <ThemedText baseSize={13} style={styles.linkText}>Support</ThemedText>
                    </TouchableOpacity>
                    {!isWeb && (
                        <>
                            <ThemedText baseSize={13} style={styles.linkSeparator}>·</ThemedText>
                            <TouchableOpacity onPress={onSubscribe} activeOpacity={0.7} hitSlop={{ top: 10, bottom: 10 }}>
                                <ThemedText baseSize={13} style={styles.linkText}>Subscribe</ThemedText>
                            </TouchableOpacity>
                        </>
                    )}
                </View>
            </View>

            {/* DEV: Clear AsyncStorage overlay button - commented out, kept for future use
            {__DEV__ && (
                <TouchableOpacity
                    onPress={handleClearAsyncStorage}
                    style={styles.devClearButton}
                    activeOpacity={0.7}
                >
                    <Text style={styles.devClearButtonText}>🗑️ Clear Storage</Text>
                </TouchableOpacity>
            )}
            */}
        </ThemedView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingTop: 48,
        paddingBottom: 24,
    },
    content: {
        flex: 1,
        maxWidth: 448,
        width: '100%',
        alignItems: 'center',
    },
    title: {
        fontWeight: 'bold',
        fontFamily: 'Nunito_700Bold',
        textAlign: 'center',
    },
    hamsterContainer: {
        height: 128,
        width: 128,
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 16,
    },
    hamsterImage: {
        height: 128,
        width: 128,
    },
    textContainer: {
        alignItems: 'center',
        gap: 16,
    },
    prompt: {
        fontWeight: 'bold',
        fontFamily: 'Nunito_700Bold',
        textAlign: 'center',
        maxWidth: 280,
    },
    eventTitle: {
        fontWeight: 'bold',
        fontFamily: 'Nunito_700Bold',
        textAlign: 'center',
    },
    buttonsContainer: {
        width: '100%',
        alignItems: 'center',
        gap: 12,
        paddingTop: 8,
    },
    button: {
        width: '60%',
        paddingVertical: 16,
        borderRadius: 9999,
        alignItems: 'center',
        justifyContent: 'center',
    },
    playButton: {
        backgroundColor: '#7DAAE8',
    },
    greyButton: {
        backgroundColor: '#8A8A8A',
    },
    disabledButton: {
        opacity: 0.5,
    },
    buttonText: {
        color: '#fff',
        fontSize: 20,
        fontWeight: 'bold',
        fontFamily: 'Nunito_700Bold',
    },
    // ── Store CTA Styles (Web Only) ─────────────────────────────────
    storeCTAContainer: {
        alignItems: 'center',
        gap: 8,
        paddingTop: 4,
    },
    storeCTAText: {
        fontFamily: 'Nunito_400Regular',
        opacity: 0.6,
        textAlign: 'center',
    },
    badgesRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
    },
    badgeTouchable: {
        // Wrapper for touch feedback
    },
    appleBadge: {
        width: 150,
        height: 50,
    },
    googleBadge: {
        width: 168,
        height: 50, // Match Apple badge height
    },
    loginLinkText: {
        fontSize: 15,
        fontFamily: 'Nunito_400Regular',
        textAlign: 'center',
    },
    // ─────────────────────────────────────────────────────────────────
    dateText: {
        fontFamily: 'Nunito_400Regular',
        paddingTop: 0,
        textAlign: 'center',
    },
    linksContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingTop: 8,
    },
    linkText: {
        fontFamily: 'Nunito_400Regular',
        opacity: 0.45,
        textDecorationLine: 'underline',
    },
    linkSeparator: {
        fontFamily: 'Nunito_400Regular',
        opacity: 0.3,
    },
    devClearButton: {
        position: 'absolute',
        bottom: 40,
        alignSelf: 'center',
        backgroundColor: 'rgba(139, 92, 246, 0.9)',
        paddingVertical: 8,
        paddingHorizontal: 16,
        borderRadius: 20,
    },
    devClearButtonText: {
        color: '#fff',
        fontSize: 12,
        fontFamily: 'Nunito_400Regular',
    },
});
