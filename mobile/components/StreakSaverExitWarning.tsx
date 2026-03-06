import React from 'react';
import { View, Text, Modal, TouchableOpacity } from 'react-native';
import { styled } from 'nativewind';
import { ShieldCheck } from 'lucide-react-native';

const StyledView = styled(View);
const StyledText = styled(Text);
const StyledTouchableOpacity = styled(TouchableOpacity);

interface StreakSaverExitWarningProps {
    visible: boolean;
    onClose: () => void;
    onExit: () => void;
    onContinuePlaying: () => void;
    gameType?: 'REGION' | 'USER';
}

export function StreakSaverExitWarning({
    visible,
    onClose,
    onExit,
    onContinuePlaying,
    gameType = 'REGION',
}: StreakSaverExitWarningProps) {
    // Match StreakSaverPopup colors per game type
    const bgColor = gameType === 'REGION' ? '#FFD429' : '#fdab58';

    return (
        <Modal
            visible={visible}
            transparent
            animationType="fade"
            onRequestClose={onClose}
        >
            <StyledView className="flex-1 bg-black/70 items-center justify-center p-6">
                <StyledView
                    className="rounded-2xl p-6 w-full max-w-sm shadow-2xl"
                    style={{ backgroundColor: bgColor }}
                >

                    {/* Header */}
                    <StyledView className="items-center mb-4">
                        <ShieldCheck size={48} color="#22c55e" className="mb-2" />
                        <StyledText className="text-2xl font-n-bold text-slate-900 text-center">
                            Your streak is safe!
                        </StyledText>
                    </StyledView>

                    {/* Description */}
                    <StyledText className="text-center text-slate-700 font-n-medium mb-8 text-base leading-6">
                        No worries if you don't want to play yesterday's question now, you will still keep your existing streak.{'\n\n'}However, if you later play and win yesterday's puzzle from the Archive, it won't add to your streak...
                    </StyledText>

                    {/* Actions — styled to match StreakSaverPopup buttons */}
                    <StyledView className="gap-3 w-full">
                        {/* Continue Playing — matches "Go on holiday" blue button style */}
                        <StyledTouchableOpacity
                            onPress={onContinuePlaying}
                            className="bg-blue-400 active:bg-blue-500 py-3 rounded-2xl w-full"
                        >
                            <StyledText className="text-white font-n-bold text-center text-lg">
                                Continue Playing
                            </StyledText>
                        </StyledTouchableOpacity>

                        {/* Exit — matches "Let streak reset" white button style */}
                        <StyledTouchableOpacity
                            onPress={onExit}
                            className="bg-white active:bg-slate-100 py-3 rounded-2xl w-full"
                        >
                            <StyledText className="text-slate-700 font-n-bold text-center text-lg">
                                Exit
                            </StyledText>
                        </StyledTouchableOpacity>
                    </StyledView>
                </StyledView>
            </StyledView>
        </Modal>
    );
}
