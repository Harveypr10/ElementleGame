/**
 * Design System - Card Shadows
 * 
 * Provides consistent shadow and elevation styles for iOS and Android
 */

import { ViewStyle } from 'react-native';
import { Platform } from 'react-native';

type ShadowLevel = 'sm' | 'md' | 'lg' | 'xl';

interface ShadowStyle {
    // iOS shadows
    shadowColor?: string;
    shadowOffset?: { width: number; height: number };
    shadowOpacity?: number;
    shadowRadius?: number;
    // Android elevation
    elevation?: number;
}

const shadowStyles: Record<ShadowLevel, ShadowStyle> = {
    sm: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 1,
    },
    md: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    lg: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 8,
        elevation: 6,
    },
    xl: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.2,
        shadowRadius: 16,
        elevation: 10,
    },
};

/**
 * Get shadow style for a specific elevation level
 */
export function getCardShadow(level: ShadowLevel = 'md'): ViewStyle {
    return shadowStyles[level];
}

/**
 * Card shadow with dark mode support
 */
export function getCardShadowWithDark(level: ShadowLevel = 'md', isDark: boolean = false): ViewStyle {
    const baseShadow = shadowStyles[level];

    if (isDark) {
        // Lighter shadows for dark mode
        return {
            ...baseShadow,
            shadowOpacity: (baseShadow.shadowOpacity || 0.1) * 0.5,
            shadowColor: '#fff',
        };
    }

    return baseShadow;
}

/**
 * Pressable card style with active state
 */
export function getPressableCardStyle(isPressed: boolean, level: ShadowLevel = 'md'): ViewStyle {
    const baseShadow = shadowStyles[level];

    if (isPressed) {
        // Reduce shadow when pressed
        return {
            ...baseShadow,
            shadowOpacity: (baseShadow.shadowOpacity || 0.1) * 0.5,
            shadowRadius: (baseShadow.shadowRadius || 4) * 0.7,
            elevation: Math.max((baseShadow.elevation || 3) - 2, 0),
        };
    }

    return baseShadow;
}
