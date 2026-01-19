
import React from 'react';
import { View, Text, Modal, ScrollView, TouchableOpacity, Image } from 'react-native';
import { styled } from 'nativewind';
import { X } from 'lucide-react-native';

const StyledView = styled(View);
const StyledText = styled(Text);
const StyledTouchableOpacity = styled(TouchableOpacity);
const StyledImage = styled(Image);

interface HelpModalProps {
    visible: boolean;
    onClose: () => void;
}

export function HelpModal({ visible, onClose }: HelpModalProps) {
    const ExampleRow = ({ digits, feedback, description }: { digits: string[], feedback: ('correct' | 'inSequence' | 'ruledOut')[], description: string }) => (
        <StyledView className="mb-6">
            <StyledView className="flex-row justify-center mb-2 space-x-1">
                {digits.map((digit, index) => {
                    let bgColor = "bg-white dark:bg-slate-800";
                    let borderColor = "border-slate-200 dark:border-slate-700";
                    let textColor = "text-slate-900 dark:text-white";

                    // Match InputGrid styles
                    if (feedback[index] === 'correct') {
                        bgColor = "bg-green-500 border-green-500";
                        textColor = "text-white";
                    } else if (feedback[index] === 'inSequence') {
                        bgColor = "bg-amber-400 border-amber-400";
                        textColor = "text-white";
                    } else if (feedback[index] === 'ruledOut') {
                        bgColor = "bg-slate-400 border-slate-400 dark:bg-slate-600 dark:border-slate-600";
                        textColor = "text-white";
                    }

                    return (
                        <StyledView key={index} className={`w-10 h-12 border-2 rounded-md items-center justify-center ${bgColor} ${borderColor}`}>
                            <StyledText className={`text-xl font-bold ${textColor}`}>
                                {digit}
                            </StyledText>
                        </StyledView>
                    );
                })}
            </StyledView>
            <StyledText className="text-slate-600 dark:text-slate-300 text-center text-sm px-4">
                {description}
            </StyledText>
        </StyledView>
    );

    return (
        <Modal
            animationType="slide"
            transparent={true}
            visible={visible}
            onRequestClose={onClose}
        >
            <StyledView className="flex-1 justify-end bg-black/50">
                <StyledView className="bg-white dark:bg-slate-900 rounded-t-3xl h-[85%] w-full flex-col">
                    {/* Header */}
                    <StyledView className="flex-row items-center justify-between px-6 py-5 border-b border-slate-100 dark:border-slate-800">
                        <StyledText className="text-2xl font-bold text-slate-900 dark:text-white">
                            How to Play
                        </StyledText>
                        <StyledTouchableOpacity onPress={onClose} className="p-2 -mr-2">
                            <X size={24} color="#64748b" />
                        </StyledTouchableOpacity>
                    </StyledView>

                    <ScrollView className="flex-1 px-6 pt-6" contentContainerStyle={{ paddingBottom: 40 }}>
                        <StyledText className="text-base text-slate-600 dark:text-slate-300 mb-6 leading-6">
                            Guess the date of the event in 5 tries.
                        </StyledText>

                        <StyledText className="text-base text-slate-600 dark:text-slate-300 mb-8 leading-6">
                            Each guess must be a valid date. The color of the tiles will change to show how close your guess was.
                        </StyledText>

                        {/* Examples */}
                        <StyledText className="text-lg font-bold text-slate-900 dark:text-white mb-4">
                            Examples
                        </StyledText>

                        {/* Correct Example */}
                        <ExampleRow
                            digits={['3', '1', '1', '0', '8', '4']}
                            feedback={['correct', 'ruledOut', 'ruledOut', 'ruledOut', 'ruledOut', 'ruledOut']}
                            description="The digit 3 is in the correct spot."
                        />

                        {/* Amber Example */}
                        <ExampleRow
                            digits={['1', '1', '0', '5', '9', '0']}
                            feedback={['ruledOut', 'inSequence', 'ruledOut', 'ruledOut', 'ruledOut', 'ruledOut']}
                            description="The digit 1 is in the date but in the wrong spot."
                        />

                        {/* Grey Example */}
                        <ExampleRow
                            digits={['2', '0', '0', '1', '2', '5']}
                            feedback={['ruledOut', 'ruledOut', 'ruledOut', 'ruledOut', 'ruledOut', 'ruledOut']}
                            description="The digit 2 is not in the date in any spot."
                        />

                        <StyledView className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-xl mb-6">
                            <StyledText className="text-blue-800 dark:text-blue-200 font-semibold mb-1">
                                Hint
                            </StyledText>
                            <StyledText className="text-blue-600 dark:text-blue-300 text-sm">
                                Look out for arrows! If you see an arrow on an amber or grey tile, it tells you if the correct digit for that specific slot is higher or lower.
                            </StyledText>
                        </StyledView>
                    </ScrollView>

                    {/* Footer */}
                    <StyledView className="p-6 border-t border-slate-100 dark:border-slate-800">
                        <StyledTouchableOpacity
                            onPress={onClose}
                            className="w-full bg-slate-900 dark:bg-white py-4 rounded-full items-center"
                        >
                            <StyledText className="text-white dark:text-slate-900 font-bold text-lg">
                                Got it!
                            </StyledText>
                        </StyledTouchableOpacity>
                    </StyledView>
                </StyledView>
            </StyledView>
        </Modal>
    );
}
