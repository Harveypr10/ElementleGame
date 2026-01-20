/**
 * Interstitial Ad Modal - PLACEHOLDER
 * 
 * Visual placeholder for full-screen interstitial ad
 * TODO: Replace with react-native-google-mobile-ads when ready
 */

import React from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { styled } from 'nativewind';

const StyledView = styled(View);
const StyledText = styled(Text);
const StyledTouchableOpacity = styled(TouchableOpacity);

interface InterstitialAdModalProps {
    visible: boolean;
    onDismiss: () => void;
}

export function InterstitialAdModal({ visible, onDismiss }: InterstitialAdModalProps) {
    if (!visible) return null;

    return (
        <Modal
            visible={visible}
            transparent={true}
            animationType="fade"
            onRequestClose={onDismiss}
        >
            <StyledView className="flex-1 bg-black/90 items-center justify-center p-8">
                {/* Ad Placeholder */}
                <StyledView className="bg-slate-800 rounded-2xl p-8 items-center max-w-md">
                    <StyledText className="text-white text-2xl font-bold mb-4">
                        📺 Advertisement
                    </StyledText>

                    <StyledText className="text-slate-300 text-center mb-6">
                        This is a placeholder for an interstitial ad.
                    </StyledText>

                    <StyledText className="text-slate-400 text-sm text-center mb-8">
                        In production, a full-screen ad would display here using react-native-google-mobile-ads
                    </StyledText>

                    {/* Dismiss Button */}
                    <StyledTouchableOpacity
                        onPress={onDismiss}
                        className="bg-blue-500 px-8 py-3 rounded-lg"
                    >
                        <StyledText className="text-white font-bold">
                            Continue →
                        </StyledText>
                    </StyledTouchableOpacity>

                    <StyledText className="text-slate-500 text-xs mt-4">
                        Go Pro to remove ads
                    </StyledText>
                </StyledView>
            </StyledView>
        </Modal>
    );
}
