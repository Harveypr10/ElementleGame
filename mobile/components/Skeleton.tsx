import React from 'react';
import { View, Animated } from 'react-native';
import { styled } from 'nativewind';
import { useEffect, useRef } from 'react';

const StyledView = styled(View);
const StyledAnimatedView = styled(Animated.View);

interface SkeletonProps {
    width?: number | string;
    height?: number | string;
    borderRadius?: number;
    className?: string;
}

export function Skeleton({ width = '100%', height = 20, borderRadius = 8, className = '' }: SkeletonProps) {
    const pulseAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        const animation = Animated.loop(
            Animated.sequence([
                Animated.timing(pulseAnim, {
                    toValue: 1,
                    duration: 1000,
                    useNativeDriver: true,
                }),
                Animated.timing(pulseAnim, {
                    toValue: 0,
                    duration: 1000,
                    useNativeDriver: true,
                }),
            ])
        );
        animation.start();

        return () => animation.stop();
    }, []);

    const opacity = pulseAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [0.3, 0.7],
    });

    return (
        <StyledAnimatedView
            style={{
                width,
                height,
                borderRadius,
                opacity,
                backgroundColor: '#cbd5e1', // slate-300
            }}
            className={`bg-slate-300 dark:bg-slate-700 ${className}`}
        />
    );
}

// Preset skeleton components for common use cases
export function SkeletonCard() {
    return (
        <StyledView className="bg-white dark:bg-slate-800 rounded-xl p-4 space-y-3">
            <Skeleton width="60%" height={24} />
            <Skeleton width="100%" height={16} />
            <Skeleton width="80%" height={16} />
        </StyledView>
    );
}

export function SkeletonCalendarDay() {
    return (
        <StyledView className="items-center justify-center p-2">
            <Skeleton width={32} height={32} borderRadius={16} />
        </StyledView>
    );
}

export function SkeletonStatRow() {
    return (
        <StyledView className="flex-row justify-between items-center py-2">
            <Skeleton width="40%" height={16} />
            <Skeleton width="20%" height={20} />
        </StyledView>
    );
}

export function SkeletonBarChart() {
    return (
        <StyledView className="flex-row items-end justify-between gap-2 h-40">
            {[60, 80, 100, 70, 90].map((height, index) => (
                <StyledView key={index} className="flex-1">
                    <Skeleton width="100%" height={height} borderRadius={4} />
                </StyledView>
            ))}
        </StyledView>
    );
}

export function SkeletonBadge() {
    return (
        <StyledView className="items-center space-y-2 p-4">
            <Skeleton width={64} height={64} borderRadius={32} />
            <Skeleton width="80%" height={16} />
        </StyledView>
    );
}
