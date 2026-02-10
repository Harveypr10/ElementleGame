import React, { useEffect } from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import { Image } from 'expo-image';
import Animated, { useSharedValue, useAnimatedStyle, withTiming } from 'react-native-reanimated';
import { StatusBar } from 'expo-status-bar';

/**
 * In-app splash screen — renders the same baked image used by the native
 * OS splash (configured in app.config.ts). This ensures a seamless handoff:
 *   Native splash (Welcome-Hamster-Blue.png)  →  This component (same image)
 * No text elements are used, so there is zero font-loading flicker.
 */

const SplashImage = require('../assets/ui/Welcome-Hamster-Blue.png');
const { width, height } = Dimensions.get('window');

interface SplashScreenProps {
    onComplete: () => void;
}

export function SplashScreen({ onComplete }: SplashScreenProps) {
    const opacity = useSharedValue(1);

    useEffect(() => {
        // Image is already visible (matches native splash) — hold for a moment
        // then trigger completion so the app can take over.
        const timer = setTimeout(() => {
            onComplete();
        }, 2000);

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
        width: width * 0.68,
        height: height * 0.56,
        maxWidth: 400,
        maxHeight: 720,
        marginTop: height * 0.56 * 0.1, // Push down by ~20% of image height
    },
});
