/**
 * ModeToggle - Web Version
 * 
 * Web-specific implementation with proper CSS font styling.
 */

import { View, Text, TouchableOpacity, Animated, LayoutChangeEvent, useColorScheme, StyleSheet } from 'react-native';
import { useRef, useState, useEffect } from 'react';

interface ModeToggleProps {
    mode: 'REGION' | 'USER';
    onModeChange: (mode: 'REGION' | 'USER') => void;
    scrollX: Animated.Value;
    screenWidth: number;
    userLabel?: string;
    regionLabel?: string;
}

export function ModeToggle({ mode, onModeChange, scrollX, screenWidth, userLabel, regionLabel = 'UK Edition' }: ModeToggleProps) {
    const [containerWidth, setContainerWidth] = useState(0);
    const [activeMode, setActiveMode] = useState(mode);
    const colorScheme = useColorScheme();
    const isDark = colorScheme === 'dark';

    // Theme colors
    const containerBg = isDark ? '#1e293b' : '#f1f5f9';
    const indicatorBg = isDark ? '#334155' : '#ffffff';
    const activeText = isDark ? '#ffffff' : '#0f172a';
    const inactiveText = isDark ? '#94a3b8' : '#64748b';

    // Sync activeMode with prop mode
    useEffect(() => {
        setActiveMode(mode);
    }, [mode]);

    // Update activeMode based on scroll
    useEffect(() => {
        const listenerId = scrollX.addListener(({ value }) => {
            const newMode = value >= screenWidth / 2 ? 'USER' : 'REGION';
            setActiveMode(newMode);
        });
        return () => {
            scrollX.removeListener(listenerId);
        };
    }, [scrollX, screenWidth]);

    const tabWidth = containerWidth / 2;

    const indicatorTranslateX = scrollX.interpolate({
        inputRange: [0, screenWidth],
        outputRange: [0, tabWidth],
        extrapolate: 'clamp',
    });

    const onLayout = (event: LayoutChangeEvent) => {
        setContainerWidth(event.nativeEvent.layout.width);
    };

    return (
        <View
            style={[styles.container, { backgroundColor: containerBg }]}
            onLayout={onLayout}
        >
            {/* Animated Indicator */}
            {containerWidth > 0 && (
                <Animated.View
                    style={[
                        styles.indicator,
                        {
                            width: tabWidth - 4,
                            transform: [{ translateX: indicatorTranslateX }],
                            backgroundColor: indicatorBg,
                        }
                    ]}
                />
            )}

            {/* Region Tab */}
            <TouchableOpacity
                style={styles.tab}
                onPress={() => {
                    setActiveMode('REGION');
                    onModeChange('REGION');
                }}
            >
                <Text
                    style={[
                        styles.tabText,
                        {
                            color: activeMode === 'REGION' ? activeText : inactiveText,
                            fontWeight: activeMode === 'REGION' ? '700' : '500',
                        }
                    ]}
                >
                    {regionLabel}
                </Text>
            </TouchableOpacity>

            {/* User Tab */}
            <TouchableOpacity
                style={styles.tab}
                onPress={() => {
                    setActiveMode('USER');
                    onModeChange('USER');
                }}
            >
                <Text
                    style={[
                        styles.tabText,
                        {
                            color: activeMode === 'USER' ? activeText : inactiveText,
                            fontWeight: activeMode === 'USER' ? '700' : '500',
                        }
                    ]}
                >
                    {userLabel}
                </Text>
            </TouchableOpacity>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        padding: 4,
        borderRadius: 9999,
        marginBottom: 24,
        width: 256, // w-64
        alignSelf: 'center',
        height: 48,
        position: 'relative',
    },
    indicator: {
        height: '100%',
        position: 'absolute',
        top: 4,
        left: 4,
        borderRadius: 9999,
        // Web shadow
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
    },
    tab: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10,
    },
    tabText: {
        fontFamily: 'Nunito, sans-serif',
        fontSize: 16,
    },
});
