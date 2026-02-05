/**
 * HomeCard - Web Version
 * 
 * This is the web-specific implementation of HomeCard with proper CSS styling.
 * Metro automatically uses this file for web builds due to the .web.tsx extension.
 */

import React from 'react';
import { View, Text, TouchableOpacity, ImageSourcePropType, StyleSheet, Platform } from 'react-native';
import { Image } from 'expo-image';

interface HomeCardProps {
    title: string;
    subtitle?: string;
    icon?: ImageSourcePropType;
    backgroundColor: string;
    onPress: () => void;
    height?: number;
    className?: string;
    children?: React.ReactNode;
    testID?: string;
    iconStyle?: { width?: number; height?: number };
    scale?: number;
}

const HomeCardComponent = ({
    title,
    subtitle,
    icon,
    backgroundColor,
    onPress,
    height = 160,
    className = "",
    children,
    testID,
    iconStyle,
    scale = 1
}: HomeCardProps) => {
    const scaledHeight = height * scale;
    const iconWidth = (iconStyle?.width || 96) * scale;
    const iconHeight = (iconStyle?.height || 96) * scale;

    // For web, we need to extract the source from the require() result
    // expo-image/RN Image wraps require() in an object with { uri: string }
    const getImageSource = (src: ImageSourcePropType | undefined) => {
        if (!src) return undefined;
        // If it's a number (raw require result on native), return as-is
        if (typeof src === 'number') return src;
        // If it's already an object with uri, return it
        if (typeof src === 'object' && 'uri' in src) return src;
        return src;
    };

    return (
        <TouchableOpacity
            testID={testID}
            onPress={onPress}
            activeOpacity={0.9}
            style={[
                styles.card,
                {
                    backgroundColor,
                    height: scaledHeight,
                    minHeight: scaledHeight,
                }
            ]}
        >
            {/* Content Section */}
            <View style={styles.content}>
                <Text style={[styles.title, { fontSize: 20 * scale }]}>
                    {title}
                </Text>
                {subtitle && (
                    <Text style={[styles.subtitle, { fontSize: 16 * scale }]}>
                        {subtitle}
                    </Text>
                )}
                {children && (
                    <View style={styles.childrenContainer}>
                        {children}
                    </View>
                )}
            </View>

            {/* Icon Section - using expo-image which should work on web */}
            {icon && (
                <View style={styles.iconContainer}>
                    <Image
                        source={getImageSource(icon)}
                        style={{
                            width: iconWidth,
                            height: iconHeight,
                        }}
                        contentFit="contain"
                    />
                </View>
            )}
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    card: {
        width: '100%',
        borderRadius: 24,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingVertical: 16,
        marginBottom: 16,
        overflow: 'hidden',
        // Web shadow
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
        cursor: 'pointer',
    },
    content: {
        flex: 1,
        paddingRight: 8,
    },
    title: {
        fontFamily: 'Nunito, sans-serif',
        fontWeight: '700',
        color: '#1e293b', // slate-800
        lineHeight: 26,
    },
    subtitle: {
        fontFamily: 'Nunito, sans-serif',
        fontWeight: '500',
        color: '#475569', // slate-600
        marginTop: 4,
    },
    childrenContainer: {
        marginTop: 8,
    },
    iconContainer: {
        marginLeft: 8,
    },
});

export const HomeCard = React.memo(HomeCardComponent);
