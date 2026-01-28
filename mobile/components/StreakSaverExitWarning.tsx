import React from 'react';
import { View, Text, Modal, TouchableOpacity } from 'react-native';
import { styled } from 'nativewind';
import { AlertTriangle, X } from 'lucide-react-native';
import { useThemeColor } from '../hooks/useThemeColor';

const StyledView = styled(View);
const StyledText = styled(Text);
const StyledTouchableOpacity = styled(TouchableOpacity);

interface StreakSaverExitWarningProps {
    visible: boolean;
    onClose: () => void;
    onCancelAndLoseStreak: () => void;
    onContinuePlaying: () => void;
}

export function StreakSaverExitWarning({
    visible,
    onClose,
    onCancelAndLoseStreak,
    onContinuePlaying,
}: StreakSaverExitWarningProps) {
    const iconColor = useThemeColor({}, 'icon');

    return (
        <Modal
            visible={visible}
            transparent
            animationType="fade"
            onRequestClose={onClose}
        >
            <StyledView className="flex-1 bg-black/70 items-center justify-center p-6">
                <StyledView className="bg-white dark:bg-slate-800 rounded-2xl p-6 w-full max-w-sm shadow-xl">

                    {/* Header */}
                    <StyledView className="items-center mb-4">
                        <AlertTriangle size={48} color="#ef4444" className="mb-2" />
                        <StyledText className="text-2xl font-n-bold text-slate-900 dark:text-white text-center">
                            Are you sure?
                        </StyledText>
                    </StyledView>

                    {/* Description */}
                    <StyledText className="text-center text-slate-600 dark:text-slate-300 font-n-medium mb-8 text-base">
                        If you don't complete and win yesterday's game right now, you will lose your streak.
                    </StyledText>

                    {/* Actions */}
                    <StyledView className="gap-3 w-full">
                        <StyledTouchableOpacity
                            onPress={onContinuePlaying}
                            className="bg-orange-500 active:bg-orange-600 py-4 rounded-xl w-full"
                        >
                            <StyledText className="text-white font-n-bold text-center text-lg">
                                Continue Playing
                            </StyledText>
                        </StyledTouchableOpacity>

                        <StyledTouchableOpacity
                            onPress={onCancelAndLoseStreak}
                            className="bg-transparent py-4 rounded-xl w-full"
                        >
                            <StyledText className="text-slate-500 dark:text-slate-400 font-n-medium text-center text-base">
                                Cancel & Lose Streak
                            </StyledText>
                        </StyledTouchableOpacity>
                    </StyledView>
                </StyledView>
            </StyledView>
        </Modal>
    );
}
