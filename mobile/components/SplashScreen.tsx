import React, { useEffect } from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import { Image } from 'expo-image';
import Animated, { useSharedValue, useAnimatedStyle, withTiming } from 'react-native-reanimated';
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
    const opacity = useSharedValue(1);

    useEffect(() => {
        // Image is immediately visible (opacity 1) to match native splash.
        // Hold for a moment, then trigger completion.
        const timer = setTimeout(() => {
            onComplete();
        }, 2500);

        return () => clearTimeout(timer);
    }, []);

    const animatedStyle = useAnimatedStyle(() => ({
        opacity: opacity.value,
    }));

    return (
        <View style={styles.container}>
            <StatusBar style="light" />
            <Animated.View style={[styles.content, animatedStyle]}>
                <Image
                    source={SplashImage}
                    style={styles.image}
                    contentFit="contain"
                    cachePolicy="disk"
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
