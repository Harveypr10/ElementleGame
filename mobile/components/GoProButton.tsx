/**
 * Go Pro Button Component
 * 
 * Shows different states based on user subscription:
 * - Standard tier: "Go Pro" with "Ads on" indicator
 * - Pro tier: "Pro" button
 */

import React from 'react';
import { TouchableOpacity, Text, View } from 'react-native';
import { styled } from 'nativewind';
import { useSubscription } from '../hooks/useSubscription';

const StyledTouchableOpacity = styled(TouchableOpacity);
const StyledText = styled(Text);
const StyledView = styled(View);

interface GoProButtonProps {
    onPress: () => void;
}

export function GoProButton({ onPress }: GoProButtonProps) {
    const { isPro } = useSubscription();

    if (isPro) {
        return (
            <StyledTouchableOpacity
                onPress={onPress}
                testID="button-pro-status"
                className="px-3 py-1.5 rounded-lg shadow-sm active:opacity-80"
                style={{
                    backgroundColor: '#f97316', // orange-500
                }}
            >
                <StyledText className="text-sm font-bold text-white">
                    Pro
                </StyledText>
            </StyledTouchableOpacity>
        );
    }

    // Standard tier - show "Go Pro" with animated "Ads on" indicator
    return (
        <StyledTouchableOpacity
            onPress={onPress}
            testID="button-go-pro"
            className="px-2 py-1.5 rounded-lg shadow-sm active:opacity-80"
            style={{
                backgroundColor: '#f97316', // orange-500
            }}
        >
            {/* Top: "Ads on" indicator */}
            <StyledView className="flex-row items-center justify-center gap-1 mb-0.5">
                <StyledView
                    className="w-1.5 h-1.5 rounded-full bg-green-400"
                    style={{
                        shadowColor: '#4ade80',
                        shadowOffset: { width: 0, height: 0 },
                        shadowOpacity: 0.8,
                        shadowRadius: 2,
                    }}
                />
                <StyledText className="text-[10px] font-normal text-white">
                    Ads on
                </StyledText>
            </StyledView>

            {/* Bottom: "Go Pro" text */}
            <StyledText className="text-xs font-bold text-white">
                Go Pro
            </StyledText>
        </StyledTouchableOpacity>
    );
}
