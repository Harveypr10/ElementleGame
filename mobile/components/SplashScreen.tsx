import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Dimensions, Animated } from 'react-native';
import { Image } from 'expo-image';
import { StatusBar } from 'expo-status-bar';

/**
 * In-app splash screen — renders the transparent hamster image on a solid
 * blue (#7DAAE8) background, exactly matching the native OS splash configured
 * in app.config.ts. This "Composition Pattern" ensures a seamless handoff:
 *
 *   Native splash (transparent hamster on blue bg, resizeMode: contain)
 *     → This component (same image, same sizing, same blue bg)
 *
 * No text elements are used, so there is zero font-loading flicker.
 * The image uses `contain` fitting to match the native splash's resizeMode.
 *
 * Uses React Native's built-in Animated API with useNativeDriver: true
 * for the smoothest possible fade-in (runs entirely on the native UI thread).
 */

const SplashImage = require('../assets/ui/Welcome-Hamster-Transparent.png');
const { width, height } = Dimensions.get('window');

// On iPads / large screens (width >= 768), render the image 50% larger
const isLargeScreen = width >= 768;
const scaleFactor = isLargeScreen ? 1.5 : 1.0;

interface SplashScreenProps {
    onComplete: () => void;
}

export function SplashScreen({ onComplete }: SplashScreenProps) {
    const opacity = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        // Fade in the hamster image over 800ms using native driver
        Animated.timing(opacity, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
        }).start();

        // Hold for a moment after fade-in, then trigger completion.
        const timer = setTimeout(() => {
            onComplete();
        }, 2500);

        return () => clearTimeout(timer);
    }, []);

    return (
        <View style={styles.container}>
            <StatusBar style="light" />
            <Animated.View style={[styles.content, { opacity }]}>
                <Image
                    source={SplashImage}
                    style={styles.image}
                    contentFit="contain"
                    cachePolicy="memory-disk"
                    transition={0}
                    priority="high"
                />
            </Animated.View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#7DAAE8',
        justifyContent: 'center',
        alignItems: 'center',
    },
    content: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
    },
    image: {
        // Match native splash sizing: contain within the full screen area.
        // Scale factor increases size by 50% on iPads / large screens.
        width: width * 0.68 * scaleFactor,
        height: height * 0.56 * scaleFactor,
        maxWidth: 400 * scaleFactor,
        maxHeight: 720 * scaleFactor,
    },
});
