import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, useColorScheme, Alert, Platform, Linking } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { formatCanonicalDateWithOrdinal } from '../lib/dateFormat';
import { ThemedView } from './ThemedView';
import { ThemedText } from './ThemedText';

interface OnboardingScreenProps {
    eventTitle: string;
    puzzleDateCanonical: string;
    onPlay: () => void;
    onLogin: () => void;
    onSubscribe: () => void;
    onDevReset?: () => void;
}

export function OnboardingScreen({
    eventTitle,
    puzzleDateCanonical,
    onPlay,
    onLogin,
    onSubscribe,
    onDevReset,
}: OnboardingScreenProps) {
    const colorScheme = useColorScheme();
    const isDarkMode = colorScheme === 'dark';
    const router = useRouter();

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

    return (
        <ThemedView
            style={styles.container}
            testID="onboarding-screen"
        >
            <View style={styles.content}>
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
                        onPress={onLogin}
                        style={[styles.button, styles.greyButton]}
                        testID="button-onboarding-login"
                        activeOpacity={0.9}
                    >
                        <Text style={styles.buttonText}>Log in</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        onPress={onSubscribe}
                        style={[styles.button, styles.greyButton]}
                        testID="button-onboarding-subscribe"
                        activeOpacity={0.9}
                    >
                        <Text style={styles.buttonText}>Subscribe</Text>
                    </TouchableOpacity>
                </View>

                <ThemedText
                    baseSize={14}
                    className="opacity-60"
                    style={styles.dateText}
                    testID="text-onboarding-date"
                >
                    Puzzle date: {displayDate}
                </ThemedText>

                {/* Privacy & Support Links */}
                <View style={styles.linksContainer}>
                    <TouchableOpacity onPress={() => {
                        if (Platform.OS === 'web') {
                            Linking.openURL('/privacy');
                        } else {
                            router.push('/privacy');
                        }
                    }} activeOpacity={0.7}>
                        <ThemedText baseSize={13} style={styles.linkText}>Privacy Policy</ThemedText>
                    </TouchableOpacity>
                    <ThemedText baseSize={13} style={styles.linkSeparator}>·</ThemedText>
                    <TouchableOpacity onPress={() => {
                        if (Platform.OS === 'web') {
                            Linking.openURL('/support');
                        } else {
                            router.push('/support');
                        }
                    }} activeOpacity={0.7}>
                        <ThemedText baseSize={13} style={styles.linkText}>Support</ThemedText>
                    </TouchableOpacity>
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
        justifyContent: 'center',
        alignItems: 'center',
        padding: 16,
    },
    content: {
        maxWidth: 448,
        width: '100%',
        alignItems: 'center',
        gap: 24,
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
    dateText: {
        fontFamily: 'Nunito_400Regular',
        paddingTop: 16,
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
