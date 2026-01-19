import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, TouchableOpacity, Image, StyleSheet, useColorScheme } from 'react-native';
import { formatCanonicalDateWithOrdinal } from '../lib/dateFormat';

interface OnboardingScreenProps {
    eventTitle: string;
    puzzleDateCanonical: string;
    onPlay: () => void;
    onLogin: () => void;
    onSubscribe: () => void;
}

export function OnboardingScreen({
    eventTitle,
    puzzleDateCanonical,
    onPlay,
    onLogin,
    onSubscribe,
}: OnboardingScreenProps) {
    const colorScheme = useColorScheme();
    const isDarkMode = colorScheme === 'dark';

    // Format date as "15th January 2026"
    const displayDate = useMemo(
        () => formatCanonicalDateWithOrdinal(puzzleDateCanonical),
        [puzzleDateCanonical]
    );

    const backgroundColor = isDarkMode ? 'hsl(222, 47%, 11%)' : '#FAFAFA';
    const textColor = isDarkMode ? '#FAFAFA' : '#54524F';
    const secondaryTextColor = isDarkMode ? 'rgba(255, 255, 255, 0.6)' : '#999';

    return (
        <View
            style={[styles.container, { backgroundColor }]}
            testID="onboarding-screen"
        >
            <View style={styles.content}>
                <Text
                    style={[styles.title, { color: textColor }]}
                    testID="text-onboarding-title"
                >
                    Elementle
                </Text>

                <View style={styles.hamsterContainer}>
                    <Image
                        source={require('../assets/Welcome-Hamster-Cutout.png')}
                        style={styles.hamsterImage}
                        resizeMode="contain"
                        testID="img-onboarding-hamster"
                    />
                </View>

                <View style={styles.textContainer}>
                    <Text
                        style={[styles.prompt, { color: textColor }]}
                        testID="text-onboarding-prompt"
                    >
                        On what date did this historical event occur?
                    </Text>

                    <Text
                        style={[styles.eventTitle, { color: textColor }]}
                        testID="text-onboarding-event"
                    >
                        {eventTitle}
                    </Text>
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
                        style={[styles.button, styles.greyButton, styles.disabledButton]}
                        testID="button-onboarding-subscribe"
                        disabled
                        activeOpacity={0.5}
                    >
                        <Text style={styles.buttonText}>Subscribe</Text>
                    </TouchableOpacity>
                </View>

                <Text
                    style={[styles.dateText, { color: secondaryTextColor }]}
                    testID="text-onboarding-date"
                >
                    Puzzle date: {displayDate}
                </Text>
            </View>
        </View>
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
        fontSize: 36,
        fontWeight: 'bold',
        fontFamily: 'Nunito-Bold',
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
        fontSize: 18,
        fontFamily: 'Nunito-Bold',
        textAlign: 'center',
        maxWidth: 280,
    },
    eventTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        fontFamily: 'Nunito-Bold',
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
        fontFamily: 'Nunito-Bold',
    },
    dateText: {
        fontSize: 14,
        fontFamily: 'Nunito',
        paddingTop: 16,
        textAlign: 'center',
    },
});
