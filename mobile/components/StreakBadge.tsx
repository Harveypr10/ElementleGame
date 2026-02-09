import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Image } from 'expo-image';

const StreakHamsterImg = require('../assets/ui/webp_assets/Streak-Hamster-Black.webp');

interface StreakBadgeProps {
    streak: number;
    size?: number; // Image/container size in px (default 180)
    imageSource?: any; // Override default hamster image
}

/**
 * Reusable component that renders the Streak Hamster mascot
 * with the streak number overlaid on its belly.
 * 
 * Uses 100% inline styles to avoid NativeWind class purging in Release builds.
 */
export function StreakBadge({ streak, size = 180, imageSource }: StreakBadgeProps) {
    const digits = streak.toString().length;

    // Dynamic font sizing based on digit count
    let fontSize: number;
    if (digits === 1) fontSize = size * 0.22;       // ~36px at 180
    else if (digits === 2) fontSize = size * 0.18;   // ~30px at 180
    else if (digits === 3) fontSize = size * 0.15;   // ~24px at 180
    else fontSize = size * 0.11;                      // ~18px at 180 (4+ digits)

    return (
        <View style={{ width: size, height: size, position: 'relative', justifyContent: 'center', alignItems: 'center' }}>
            <Image
                source={imageSource || StreakHamsterImg}
                style={{ width: size * 0.95, height: size * 0.95 }}
                contentFit="contain"
                cachePolicy="disk"
            />
            {/* Number overlay — absolutely positioned on hamster's belly */}
            <View style={{
                position: 'absolute',
                bottom: size * 0.12,
                left: 0,
                right: 0,
                alignItems: 'center',
            }}>
                <Text style={{
                    color: '#dc2626',
                    fontSize,
                    fontWeight: '900',
                    textShadowColor: 'rgba(255, 255, 255, 0.8)',
                    textShadowOffset: { width: 0, height: 0 },
                    textShadowRadius: 10,
                }}>
                    {streak}
                </Text>
            </View>
        </View>
    );
}
