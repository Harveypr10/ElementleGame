/**
 * WebContainer - Web-only wrapper that centers content like a mobile app
 * 
 * On web, this constrains the app to a max width (like a tablet)
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
            { backgroundColor: isDark ? '#0f172a' : '#e0e7ff' } // slate-900 : indigo-100
        ]}>
            <View style={[
                styles.innerContainer,
                { backgroundColor: isDark ? '#1e293b' : '#ffffff' } // slate-800 : white
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
    },
    innerContainer: {
        flex: 1,
        width: '100%',
        maxWidth: 500, // Mobile phone width
        // Add subtle shadow for depth
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 8,
        // Web-only shadow fallback
        ...(Platform.OS === 'web' && {
            boxShadow: '0 4px 24px rgba(0, 0, 0, 0.15)',
        }),
    },
});
