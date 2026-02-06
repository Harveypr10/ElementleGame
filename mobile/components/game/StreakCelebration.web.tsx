import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Image } from 'expo-image';

const StreakHamster = require('../../assets/ui/webp_assets/Streak-Hamster-Black.webp');

interface StreakCelebrationWebProps {
    visible: boolean;
    streak: number;
    onClose: () => void;
}

export function StreakCelebrationWeb({ visible, streak, onClose }: StreakCelebrationWebProps) {
    const [opacity, setOpacity] = useState(0);
    const [isVisible, setIsVisible] = useState(false);
    const autoDismissRef = useRef<NodeJS.Timeout | null>(null);

    // Handle visibility changes with fade
    useEffect(() => {
        if (visible) {
            setIsVisible(true);
            // Small delay then fade in
            setTimeout(() => setOpacity(1), 50);

            // Auto-dismiss after 5 seconds
            autoDismissRef.current = setTimeout(() => {
                handleClose();
            }, 5000);
        }

        return () => {
            if (autoDismissRef.current) {
                clearTimeout(autoDismissRef.current);
            }
        };
    }, [visible]);

    const handleClose = () => {
        if (autoDismissRef.current) {
            clearTimeout(autoDismissRef.current);
            autoDismissRef.current = null;
        }
        // Fade out
        setOpacity(0);
        setTimeout(() => {
            setIsVisible(false);
            onClose();
        }, 400);
    };

    if (!isVisible) return null;

    // Dynamic font size based on streak digits
    const streakFontSize = streak.toString().length === 1 ? 72
        : streak.toString().length === 2 ? 60
            : 48;

    return (
        <Pressable
            style={[styles.overlay, { opacity }]}
            onPress={handleClose}
        >
            <View style={styles.content}>
                {/* Fire Hamster with Streak Number */}
                <View style={styles.hamsterContainer}>
                    <Image
                        source={StreakHamster}
                        style={styles.hamsterImage}
                        contentFit="contain"
                    />
                    {/* Streak Number Overlay */}
                    <View style={styles.streakNumberOverlay}>
                        <Text style={[styles.streakNumber, { fontSize: streakFontSize }]}>
                            {streak}
                        </Text>
                    </View>
                </View>

                {/* Text Content */}
                <View style={styles.textContainer}>
                    <Text style={styles.titleText}>
                        {streak === 1 ? "Streak Started!" : "Streak Continues!"}
                    </Text>
                    <Text style={styles.subtitleText}>
                        {streak === 1
                            ? "Keep playing to build your streak!"
                            : `${streak} days in a row! Keep it up!`}
                    </Text>
                </View>

                {/* Dismiss Hint */}
                <Text style={styles.dismissHint}>Click anywhere to dismiss</Text>
            </View>
        </Pressable>
    );
}

const styles = StyleSheet.create({
    overlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: '#000000',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 1000,
        transition: 'opacity 0.4s ease' as any,
    },
    content: {
        alignItems: 'center',
        paddingHorizontal: 24,
    },
    hamsterContainer: {
        width: 288,
        height: 288,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 32,
        position: 'relative',
    },
    hamsterImage: {
        width: '100%',
        height: '100%',
    },
    streakNumberOverlay: {
        position: 'absolute',
        bottom: 48,
        left: 0,
        right: 0,
        alignItems: 'center',
    },
    streakNumber: {
        color: '#DC2626',
        fontWeight: '900',
        fontFamily: 'Nunito',
        textShadowColor: 'rgba(255, 255, 255, 0.8)',
        textShadowOffset: { width: 0, height: 0 },
        textShadowRadius: 10,
    },
    textContainer: {
        alignItems: 'center',
        marginBottom: 48,
        paddingHorizontal: 16,
    },
    titleText: {
        color: '#FFFFFF',
        fontSize: 36,
        fontWeight: '900',
        fontFamily: 'Nunito',
        textAlign: 'center',
        marginBottom: 12,
        letterSpacing: 0.5,
    },
    subtitleText: {
        color: 'rgba(255, 255, 255, 0.8)',
        fontSize: 20,
        fontWeight: '700',
        fontFamily: 'Nunito',
        textAlign: 'center',
    },
    dismissHint: {
        position: 'absolute',
        bottom: -120,
        color: 'rgba(255, 255, 255, 0.4)',
        fontSize: 14,
        fontFamily: 'Nunito',
    },
});
