/**
 * ThemedText - Web Version
 * 
 * Web-specific implementation that ensures Nunito font is applied properly.
 */

import React from 'react';
import { Text, TextProps, StyleSheet, useColorScheme } from 'react-native';

// Text size presets (matching mobile)
const TEXT_SIZES = {
    xs: 12,
    sm: 14,
    base: 16,
    lg: 18,
    xl: 20,
    '2xl': 24,
    '3xl': 30,
    '4xl': 36,
};

export interface ThemedTextProps extends TextProps {
    className?: string;
    lightColor?: string;
    darkColor?: string;
    size?: keyof typeof TEXT_SIZES;
    baseSize?: number;
}

export function ThemedText({
    className,
    style,
    lightColor,
    darkColor,
    size = 'base',
    baseSize,
    children,
    ...props
}: ThemedTextProps) {
    const colorScheme = useColorScheme();
    const isDark = colorScheme === 'dark';

    // Determine text color
    const defaultColor = isDark ? '#f1f5f9' : '#1e293b'; // slate-100 : slate-800
    const color = isDark ? (darkColor || defaultColor) : (lightColor || defaultColor);

    // Determine font size
    const fontSize = baseSize || TEXT_SIZES[size] || TEXT_SIZES.base;

    // Parse className for font weight (NativeWind classes)
    let fontWeight: '400' | '500' | '600' | '700' | '800' = '400';
    if (className?.includes('font-n-bold') || className?.includes('font-bold') || className?.includes('font-heading')) {
        fontWeight = '700';
    } else if (className?.includes('font-n-extrabold')) {
        fontWeight = '800';
    } else if (className?.includes('font-n-semibold') || className?.includes('font-semibold')) {
        fontWeight = '600';
    } else if (className?.includes('font-n-medium') || className?.includes('font-medium')) {
        fontWeight = '500';
    }

    // Parse className for text color overrides
    let textColor = color;
    if (className?.includes('text-slate-500')) {
        textColor = isDark ? '#64748b' : '#64748b';
    } else if (className?.includes('text-slate-600')) {
        textColor = isDark ? '#94a3b8' : '#475569';
    } else if (className?.includes('text-slate-700')) {
        textColor = '#334155';
    } else if (className?.includes('text-slate-900')) {
        textColor = '#0f172a';
    } else if (className?.includes('text-white')) {
        textColor = '#ffffff';
    }

    return (
        <Text
            style={[
                styles.text,
                {
                    color: textColor,
                    fontSize,
                    fontWeight,
                },
                style,
            ]}
            {...props}
        >
            {children}
        </Text>
    );
}

const styles = StyleSheet.create({
    text: {
        fontFamily: 'Nunito, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    },
});
