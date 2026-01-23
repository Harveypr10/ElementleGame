
import { View, Text, TouchableOpacity, Animated, LayoutChangeEvent, useColorScheme } from 'react-native';
import { styled } from 'nativewind';
import { useRef, useState, useEffect } from 'react';
import { ThemedText } from '../ThemedText';
import { useThemeColor } from '../../hooks/useThemeColor';

const StyledView = styled(View);
const StyledTouchableOpacity = styled(TouchableOpacity);
const StyledAnimatedView = styled(Animated.View);

interface ModeToggleProps {
    mode: 'REGION' | 'USER';
    onModeChange: (mode: 'REGION' | 'USER') => void;
    scrollX: Animated.Value; // The horizontal scroll value from the parent ScrollView
    screenWidth: number; // To calculate interpolation
    userLabel?: string;
    regionLabel?: string;
}

export function ModeToggle({ mode, onModeChange, scrollX, screenWidth, userLabel, regionLabel = 'UK Edition' }: ModeToggleProps) {
    const [containerWidth, setContainerWidth] = useState(0);
    const [activeMode, setActiveMode] = useState(mode);

    // Theme colors
    const containerBg = useThemeColor({ light: '#f1f5f9', dark: '#1e293b' }, 'background'); // Slate 100 / Slate 800
    const indicatorBg = useThemeColor({ light: '#ffffff', dark: '#334155' }, 'surface'); // White / Slate 700
    const activeText = useThemeColor({ light: '#0f172a', dark: '#ffffff' }, 'text'); // Slate 900 / White
    const inactiveText = useThemeColor({ light: '#64748b', dark: '#94a3b8' }, 'text'); // Slate 500 / Slate 400

    // Sync activeMode with prop mode (for clicks)
    useEffect(() => {
        setActiveMode(mode);
    }, [mode]);

    // Update activeMode instantly on scroll
    useEffect(() => {
        const listenerId = scrollX.addListener(({ value }) => {
            // Threshold is half the screen width
            const newMode = value >= screenWidth / 2 ? 'USER' : 'REGION';
            setActiveMode(newMode);
        });
        return () => {
            scrollX.removeListener(listenerId);
        };
    }, [scrollX, screenWidth]);

    // Calculate the width of one tab based on container width
    const tabWidth = containerWidth / 2;

    // Interpolate scrollX to translateX for the indicator
    const indicatorTranslateX = scrollX.interpolate({
        inputRange: [0, screenWidth],
        outputRange: [0, tabWidth],
        extrapolate: 'clamp',
    });

    const onLayout = (event: LayoutChangeEvent) => {
        setContainerWidth(event.nativeEvent.layout.width);
    };

    return (
        <StyledView
            className="flex-row p-1 rounded-full mb-6 relative w-64 mx-auto h-12"
            style={{ backgroundColor: containerBg }}
            onLayout={onLayout}
        >
            {/* Animated Indicator Background */}
            {containerWidth > 0 && (
                <StyledAnimatedView
                    style={{
                        width: tabWidth - 4,
                        transform: [{ translateX: indicatorTranslateX }],
                        height: '100%',
                        position: 'absolute',
                        top: 4,
                        left: 4,
                        borderRadius: 9999,
                        backgroundColor: indicatorBg,
                        shadowColor: '#000',
                        shadowOffset: { width: 0, height: 1 },
                        shadowOpacity: 0.1,
                        shadowRadius: 2,
                        elevation: 2,
                    }}
                />
            )}

            {/* Region Tab */}
            <StyledTouchableOpacity
                className="flex-1 items-center justify-center z-10"
                onPress={() => {
                    setActiveMode('REGION');
                    onModeChange('REGION');
                }}
            >
                <Text
                    style={{
                        color: activeMode === 'REGION' ? activeText : inactiveText,
                        fontFamily: activeMode === 'REGION' ? 'Nunito-Bold' : 'Nunito-Medium',
                        fontSize: 16
                    }}
                >
                    {regionLabel}
                </Text>
            </StyledTouchableOpacity>

            {/* User Tab */}
            <StyledTouchableOpacity
                className="flex-1 items-center justify-center z-10"
                onPress={() => {
                    setActiveMode('USER');
                    onModeChange('USER');
                }}
            >
                <Text
                    style={{
                        color: activeMode === 'USER' ? activeText : inactiveText,
                        fontFamily: activeMode === 'USER' ? 'Nunito-Bold' : 'Nunito-Medium',
                        fontSize: 16
                    }}
                >
                    {userLabel}
                </Text>
            </StyledTouchableOpacity>
        </StyledView>
    );
}
