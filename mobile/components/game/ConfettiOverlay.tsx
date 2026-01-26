import React, { useEffect } from 'react';
import { View, Dimensions, StyleSheet } from 'react-native';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withDelay,
    withRepeat,
    withTiming,
    Easing,
    cancelAnimation,
    withSequence
} from 'react-native-reanimated';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const CONFETTI_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ec4899'];
const NUM_PARTICLES = 40;

const ConfettiParticle = ({ index }: { index: number }) => {
    // Randomize initial parameters
    const startX = Math.random() * SCREEN_WIDTH;
    const startY = -20; // Start just above screen
    const color = CONFETTI_COLORS[index % CONFETTI_COLORS.length];

    // Animation Values
    const translateY = useSharedValue(startY);
    const rotate = useSharedValue(0);
    const opacity = useSharedValue(1);

    // Randomize duration and delay
    const duration = 2000 + Math.random() * 1500;
    const delay = Math.random() * 2000;
    const xOffset = (Math.random() - 0.5) * 100; // Drift left/right

    useEffect(() => {
        // Falling Animation
        translateY.value = withDelay(
            delay,
            withRepeat(
                withTiming(SCREEN_HEIGHT + 100, {
                    duration: duration,
                    easing: Easing.linear,
                }),
                -1, // Infinite repeat
                false // No reverse
            )
        );

        // Rotation Animation
        rotate.value = withDelay(
            delay,
            withRepeat(
                withTiming(360, {
                    duration: duration * 0.8,
                    easing: Easing.linear,
                }),
                -1
            )
        );

        return () => {
            cancelAnimation(translateY);
            cancelAnimation(rotate);
        };
    }, []);

    const animatedStyle = useAnimatedStyle(() => {
        return {
            transform: [
                { translateX: startX + (translateY.value / SCREEN_HEIGHT) * xOffset }, // Slight drift
                { translateY: translateY.value },
                { rotate: `${rotate.value}deg` },
                { rotateX: `${rotate.value}deg` }, // 3D spin effect
                { rotateY: `${rotate.value}deg` }  // 3D spin effect
            ],
            opacity: opacity.value,
            backgroundColor: color,
        };
    });

    return <Animated.View style={[styles.particle, animatedStyle]} />;
};

export const ConfettiOverlay = () => {
    return (
        <View style={styles.container} pointerEvents="none">
            {Array.from({ length: NUM_PARTICLES }).map((_, i) => (
                <ConfettiParticle key={i} index={i} />
            ))}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        ...StyleSheet.absoluteFillObject,
        zIndex: 0, // Behind modal content but visible
        overflow: 'hidden',
    },
    particle: {
        position: 'absolute',
        top: 0,
        left: 0,
        width: 8,
        height: 8,
        borderRadius: 2,
    },
});
