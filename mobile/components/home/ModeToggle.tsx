
import { View, Text, TouchableOpacity, Animated, LayoutChangeEvent } from 'react-native';
import { styled } from 'nativewind';
import { useRef, useState, useEffect } from 'react';

const StyledView = styled(View);
const StyledText = styled(Text);
const StyledTouchableOpacity = styled(TouchableOpacity);
const StyledAnimatedView = styled(Animated.View);

import { ThemedText } from '../ThemedText';

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
            className="flex-row bg-slate-100 dark:bg-slate-800 p-1 rounded-full mb-6 relative w-64 mx-auto h-12"
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
                        backgroundColor: 'white',
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
                <ThemedText className={`${activeMode === 'REGION' ? 'font-n-bold text-slate-900' : 'font-n-medium text-slate-500'}`} size="base">
                    {regionLabel}
                </ThemedText>
            </StyledTouchableOpacity>

            {/* User Tab */}
            <StyledTouchableOpacity
                className="flex-1 items-center justify-center z-10"
                onPress={() => {
                    setActiveMode('USER');
                    onModeChange('USER');
                }}
            >
                <ThemedText className={`${activeMode === 'USER' ? 'font-n-bold text-slate-900' : 'font-n-medium text-slate-500'}`} size="base">
                    {userLabel}
                </ThemedText>
            </StyledTouchableOpacity>
        </StyledView>
    );
}
