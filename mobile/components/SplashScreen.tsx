import React, { useEffect } from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import { Image } from 'expo-image';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, withDelay, runOnJS } from 'react-native-reanimated';
import { ThemedText } from './ThemedText';
import { StatusBar } from 'expo-status-bar';

const WelcomeHamster = require('../assets/Welcome-Hamster-Cutout.png');
const { width } = Dimensions.get('window');

interface SplashScreenProps {
    onComplete: () => void;
}

export function SplashScreen({ onComplete }: SplashScreenProps) {
    const opacity = useSharedValue(0);

    useEffect(() => {
        // Fade in animation
        opacity.value = withTiming(1, { duration: 1000 });

        // Timer to trigger completion
        const timer = setTimeout(() => {
            onComplete();
        }, 3000);

        return () => clearTimeout(timer);
    }, []);

    const animatedStyle = useAnimatedStyle(() => {
        return {
            opacity: opacity.value,
        };
    });

    return (
        <View style={styles.container}>
            <StatusBar style="light" />
            <Animated.View style={[styles.content, animatedStyle]}>
                <ThemedText
                    className="font-n-bold text-white mb-8"
                    baseSize={40}
                    adjustsFontSizeToFit
                    numberOfLines={1}
                >
                    Elementle
                </ThemedText>

                <Image
                    source={WelcomeHamster}
                    style={styles.image}
                    contentFit="contain"
                    cachePolicy="disk"
                />

                <ThemedText
                    className="font-n-medium text-white mt-8"
                    size="3xl"
                    adjustsFontSizeToFit
                    numberOfLines={1}
                >
                    Welcome back
                </ThemedText>
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
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
        padding: 20,
    },
    image: {
        width: width * 0.56,
        height: width * 0.56,
        maxWidth: 224,
        maxHeight: 224,
    },
});
