/**
 * WebContainer - Web-only wrapper that centers content like a mobile app
 * 
 * On web, this constrains the app to a max width (like a phone)
 * and centers it on the screen for a clean mobile-in-browser experience.
 */

import React from 'react';
import { View, Platform, StyleSheet, useColorScheme } from 'react-native';

interface WebContainerProps {
    children: React.ReactNode;
}

export function WebContainer({ children }: WebContainerProps): React.ReactElement {
    const colorScheme = useColorScheme();

    // On mobile, just pass through children without any wrapper
    if (Platform.OS !== 'web') {
        return <>{children}</>;
    }

    // On web, wrap in a centered container
    const isDark = colorScheme === 'dark';

    return (
        <View style={[
            styles.outerContainer,
            { backgroundColor: isDark ? '#101010' : '#e0e7ff' }
        ]}>
            <View style={[
                styles.innerContainer,
                { backgroundColor: isDark ? '#1a1a2e' : '#ffffff' }
            ]}>
                {children}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    outerContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
        height: '100%',
    },
    innerContainer: {
        flex: 1,
        width: '100%',
        maxWidth: 500, // Mobile phone width
        height: '100%',
        maxHeight: '100%',
        overflow: 'hidden',
        // Add subtle shadow for depth on web
        ...(Platform.OS === 'web' && {
            boxShadow: '0 0 40px rgba(0, 0, 0, 0.3)',
        }),
    },
});
