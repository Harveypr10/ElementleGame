/**
 * Advanced Animations using Reanimated
 * 
 * Provides smooth, native animations for game interactions
 */

import { useEffect } from 'react';
import { useSharedValue, useAnimatedStyle, withSpring, withTiming, withSequence } from 'react-native-reanimated';

/**
 * Spring animation for cell reveal
 */
export function useCellRevealAnimation(shouldAnimate: boolean) {
    const scale = useSharedValue(0);
    const opacity = useSharedValue(0);

    useEffect(() => {
        if (shouldAnimate) {
            scale.value = withSpring(1, {
                damping: 15,
                stiffness: 150,
            });
            opacity.value = withTiming(1, { duration: 200 });
        }
    }, [shouldAnimate]);

    const animatedStyle = useAnimatedStyle(() => ({
        transform: [{ scale: scale.value }],
        opacity: opacity.value,
    }));

    return animatedStyle;
}

/**
 * Flip animation for feedback
 */
export function useFlipAnimation(shouldFlip: boolean) {
    const rotateY = useSharedValue(0);

    useEffect(() => {
        if (shouldFlip) {
            rotateY.value = withSequence(
                withTiming(90, { duration: 150 }),
                withTiming(0, { duration: 150 })
            );
        }
    }, [shouldFlip]);

    const animatedStyle = useAnimatedStyle(() => ({
        transform: [{ rotateY: `${rotateY.value}deg` }],
    }));

    return animatedStyle;
}

/**
 * Shake animation for invalid guess
 */
export function useShakeAnimation(shouldShake: boolean) {
    const translateX = useSharedValue(0);

    useEffect(() => {
        if (shouldShake) {
            translateX.value = withSequence(
                withTiming(-10, { duration: 50 }),
                withTiming(10, { duration: 50 }),
                withTiming(-10, { duration: 50 }),
                withTiming(10, { duration: 50 }),
                withTiming(0, { duration: 50 })
            );
        }
    }, [shouldShake]);

    const animatedStyle = useAnimatedStyle(() => ({
        transform: [{ translateX: translateX.value }],
    }));

    return animatedStyle;
}

/**
 * Stagger animation for row reveal
 */
export function useStaggerAnimation(index: number, shouldAnimate: boolean) {
    const opacity = useSharedValue(0);
    const translateY = useSharedValue(20);

    useEffect(() => {
        if (shouldAnimate) {
            const delay = index * 100; // 100ms stagger between items

            opacity.value = withTiming(1, {
                duration: 300,
                // @ts-ignore - delay is valid
                delay,
            });

            translateY.value = withSpring(0, {
                damping: 15,
                stiffness: 150,
                // @ts-ignore - delay is valid  
                delay,
            });
        }
    }, [shouldAnimate, index]);

    const animatedStyle = useAnimatedStyle(() => ({
        opacity: opacity.value,
        transform: [{ translateY: translateY.value }],
    }));

    return animatedStyle;
}

/**
 * Modal slide-in animation
 */
export function useModalSlideAnimation(isVisible: boolean) {
    const translateY = useSharedValue(500);
    const opacity = useSharedValue(0);

    useEffect(() => {
        if (isVisible) {
            translateY.value = withSpring(0, {
                damping: 20,
                stiffness: 150,
            });
            opacity.value = withTiming(1, { duration: 200 });
        } else {
            translateY.value = withTiming(500, { duration: 200 });
            opacity.value = withTiming(0, { duration: 150 });
        }
    }, [isVisible]);

    const animatedStyle = useAnimatedStyle(() => ({
        transform: [{ translateY: translateY.value }],
        opacity: opacity.value,
    }));

    return animatedStyle;
}

/**
 * Counter animation for stats
 */
export function useCounterAnimation(targetValue: number) {
    const value = useSharedValue(0);

    useEffect(() => {
        value.value = withTiming(targetValue, {
            duration: 1000,
        });
    }, [targetValue]);

    return value;
}
