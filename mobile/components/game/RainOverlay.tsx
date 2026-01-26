import React, { useEffect } from 'react';
import { View, Dimensions, StyleSheet } from 'react-native';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withDelay,
    withRepeat,
    withTiming,
    Easing,
    cancelAnimation
} from 'react-native-reanimated';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const NUM_DROPS = 50;

const RainDrop = () => {
    const startX = Math.random() * SCREEN_WIDTH;
    const startY = -40;

    const translateY = useSharedValue(startY);
    const opacity = useSharedValue(0.7);

    // Randomize speed
    const duration = 1000 + Math.random() * 1000;
    const delay = Math.random() * 2000;

    useEffect(() => {
        translateY.value = withDelay(
            delay,
            withRepeat(
                withTiming(SCREEN_HEIGHT + 100, {
                    duration: duration,
                    easing: Easing.linear,
                }),
                -1,
                false
            )
        );

        return () => {
            cancelAnimation(translateY);
        };
    }, []);

    const animatedStyle = useAnimatedStyle(() => {
        return {
            transform: [
                { translateX: startX },
                { translateY: translateY.value },
            ],
            opacity: opacity.value,
        };
    });

    return <Animated.View style={[styles.drop, animatedStyle]} />;
};

export const RainOverlay = () => {
    return (
        <View style={styles.container} pointerEvents="none">
            {Array.from({ length: NUM_DROPS }).map((_, i) => (
                <RainDrop key={i} />
            ))}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        ...StyleSheet.absoluteFillObject,
        zIndex: 0,
        overflow: 'hidden',
    },
    drop: {
        position: 'absolute',
        top: 0,
        left: 0,
        width: 2,
        height: 15,
        backgroundColor: '#60a5fa', // Light blue
        borderRadius: 1,
    },
});
