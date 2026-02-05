/**
 * WebContainer - Web-only wrapper that centers content like a tablet/iPad app
 * 
 * On web, this constrains the app to a max width (like a tablet)
 * and centers it on the screen for a clean tablet-in-browser experience.
 * 
 * The max-width is set to match iPad dimensions to ensure layouts
 * designed for tablet views work correctly.
 */

import React from 'react';
import { View, Platform, StyleSheet, useColorScheme, useWindowDimensions } from 'react-native';

interface WebContainerProps {
    children: React.ReactNode;
}

export function WebContainer({ children }: WebContainerProps): React.ReactElement {
    const colorScheme = useColorScheme();
    const { width: windowWidth } = useWindowDimensions();

    // On mobile, just pass through children without any wrapper
    if (Platform.OS !== 'web') {
        return <>{children}</>;
    }

    // On web, wrap in a centered container
    const isDark = colorScheme === 'dark';

    // On narrow screens (like mobile browser), fill the width
    // On wider screens, cap at iPad width (1024px) for the intended layout
    const isNarrow = windowWidth < 600;
    const maxWidth = isNarrow ? '100%' : 1024;

    return (
        <View style={[
            styles.outerContainer,
            { backgroundColor: isDark ? '#101010' : '#e0e7ff' }
        ]}>
            <View style={[
                styles.innerContainer,
                {
                    backgroundColor: isDark ? '#1a1a2e' : '#ffffff',
                    maxWidth: maxWidth,
                }
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
        justifyContent: 'flex-start', // Align to top, not center
        width: '100%',
        height: '100%',
    },
    innerContainer: {
        flex: 1,
        width: '100%',
        height: '100%',
        maxHeight: '100%',
        overflow: 'hidden',
        // Add subtle shadow for depth on web
        ...(Platform.OS === 'web' && {
            boxShadow: '0 0 40px rgba(0, 0, 0, 0.2)',
        }),
    },
});
