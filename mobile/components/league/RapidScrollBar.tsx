/**
 * RapidScrollBar - Custom scroll indicator for league FlatList
 *
 * A thin, animated scroll bar that appears on the right side of the
 * league standings FlatList. Fades in/out on scroll activity.
 */

import React, { useRef, useEffect } from 'react';
import { View, Animated, StyleSheet, LayoutChangeEvent } from 'react-native';

type Props = {
    contentHeight: number;
    scrollY: Animated.Value;
    containerHeight: number;
    isDark?: boolean;
};

export function RapidScrollBar({ contentHeight, scrollY, containerHeight, isDark = false }: Props) {
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const fadeTimer = useRef<NodeJS.Timeout | null>(null);

    // Track scroll activity to show/hide the bar
    useEffect(() => {
        const listenerId = scrollY.addListener(({ value }) => {
            // Show the bar
            Animated.timing(fadeAnim, {
                toValue: 1,
                duration: 150,
                useNativeDriver: true,
            }).start();

            // Reset fade-out timer
            if (fadeTimer.current) clearTimeout(fadeTimer.current);
            fadeTimer.current = setTimeout(() => {
                Animated.timing(fadeAnim, {
                    toValue: 0,
                    duration: 800,
                    useNativeDriver: true,
                }).start();
            }, 1200);
        });

        return () => {
            scrollY.removeListener(listenerId);
            if (fadeTimer.current) clearTimeout(fadeTimer.current);
        };
    }, [scrollY, fadeAnim]);

    if (contentHeight <= containerHeight) return null;

    const scrollBarHeight = Math.max(
        30,
        (containerHeight / contentHeight) * containerHeight
    );

    const translateY = scrollY.interpolate({
        inputRange: [0, Math.max(1, contentHeight - containerHeight)],
        outputRange: [0, containerHeight - scrollBarHeight],
        extrapolate: 'clamp',
    });

    return (
        <Animated.View
            pointerEvents="none"
            style={[
                styles.track,
                {
                    height: containerHeight,
                    opacity: fadeAnim,
                },
            ]}
        >
            <Animated.View
                style={[
                    styles.thumb,
                    {
                        height: scrollBarHeight,
                        backgroundColor: isDark ? 'rgba(148, 163, 184, 0.4)' : 'rgba(100, 116, 139, 0.3)',
                        transform: [{ translateY }],
                    },
                ]}
            />
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    track: {
        position: 'absolute',
        right: 2,
        top: 0,
        width: 4,
        zIndex: 10,
    },
    thumb: {
        width: 4,
        borderRadius: 2,
    },
});
