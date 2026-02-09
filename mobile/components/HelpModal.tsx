import React from 'react';
import { View, Text, Modal, ScrollView, TouchableOpacity, Image } from 'react-native';
import { styled } from 'nativewind';
import { X } from 'lucide-react-native';
import { ThemedText } from './ThemedText';
import { useThemeColor } from '../hooks/useThemeColor';

const StyledView = styled(View);
const StyledText = styled(Text);
const StyledTouchableOpacity = styled(TouchableOpacity);

interface HelpModalProps {
    visible: boolean;
    onClose: () => void;
}

export function HelpModal({ visible, onClose }: HelpModalProps) {
    const backgroundColor = useThemeColor({}, 'background');
    const surfaceColor = useThemeColor({}, 'surface');
    const borderColor = useThemeColor({}, 'border');
    const textColor = useThemeColor({}, 'text');
    const iconColor = useThemeColor({}, 'icon');
    const secondaryTextColor = useThemeColor({ light: '#475569', dark: '#94a3b8' }, 'text');

    // Tile colors - keeping these consistent as they are game indicators, but ensuring they look good on both
    const tileBaseBg = surfaceColor;
    const tileBaseBorder = borderColor;

    const ExampleRow = ({ digits, feedback, description }: { digits: string[], feedback: ('correct' | 'inSequence' | 'ruledOut' | 'unfilled')[], description: string }) => (
        <StyledView className="mb-6">
            <StyledView className="flex-row justify-center mb-2 space-x-1">
                {digits.map((digit, index) => {
                    let tileStyle = {
                        backgroundColor: tileBaseBg,
                        borderColor: tileBaseBorder,
                    };
                    let textStyle = {
                        color: textColor
                    };

                    // Match InputGrid styles
                    if (feedback[index] === 'correct') {
                        tileStyle = { backgroundColor: '#22c55e', borderColor: '#22c55e' };
                        textStyle = { color: '#ffffff' };
                    } else if (feedback[index] === 'inSequence') {
                        tileStyle = { backgroundColor: '#fbbf24', borderColor: '#fbbf24' };
                        textStyle = { color: '#ffffff' };
                    } else if (feedback[index] === 'ruledOut') {
                        tileStyle = { backgroundColor: '#555555', borderColor: '#555555' }; // Neutral grey as requested
                        textStyle = { color: '#ffffff' };
                    } else {
                        // 'unfilled' - white background with black border like input tiles
                        tileStyle = { backgroundColor: '#ffffff', borderColor: '#000000' };
                        textStyle = { color: '#000000' };
                    }

                    return (
                        <StyledView
                            key={index}
                            className="w-10 h-12 border-2 rounded-md items-center justify-center m-0.5"
                            style={tileStyle}
                        >
                            <Text style={[{ fontSize: 20, fontWeight: 'bold' }, textStyle]}>
                                {digit}
                            </Text>
                        </StyledView>
                    );
                })}
            </StyledView>
            <Text style={{ textAlign: 'center', fontSize: 14, color: secondaryTextColor, paddingHorizontal: 16 }}>
                {description}
            </Text>
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
                <StyledView
                    className="rounded-t-3xl w-full flex-col"
                    style={{ backgroundColor: surfaceColor, height: '89.5%' }}
                >
                    {/* Header */}
                    <StyledView
                        style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24, paddingVertical: 20, borderBottomWidth: 1, borderColor: borderColor, position: 'relative' }}
                    >
                        <ThemedText className="font-bold" style={{ fontSize: 24, textAlign: 'center' }}>
                            How to Play
                        </ThemedText>

                        {/* Close button - absolute positioned */}
                        <StyledView style={{ position: 'absolute', right: 16, top: 0, bottom: 0, justifyContent: 'center' }}>
                            <StyledTouchableOpacity onPress={onClose} style={{ padding: 8 }}>
                                <X size={24} color={iconColor} />
                            </StyledTouchableOpacity>
                        </StyledView>
                    </StyledView>

                    <ScrollView className="flex-1 px-6 pt-6" contentContainerStyle={{ paddingBottom: 40 }}>
                        <Text style={{ fontSize: 16, color: secondaryTextColor, marginBottom: 24, lineHeight: 24 }}>
                            Guess the date of the historical event in 5 tries.
                        </Text>

                        <Text style={{ fontSize: 16, color: secondaryTextColor, marginBottom: 32, lineHeight: 24 }}>
                            Each guess must be a valid date. The color of the tiles will change to show how close your guess was.
                        </Text>

                        {/* Examples */}
                        <ThemedText className="text-lg font-bold mb-4">
                            Examples
                        </ThemedText>

                        {/* Correct Example */}
                        <ExampleRow
                            digits={['3', '1', '1', '0', '8', '4']}
                            feedback={['correct', 'unfilled', 'unfilled', 'unfilled', 'unfilled', 'unfilled']}
                            description="The digit 3 is in the correct spot."
                        />

                        {/* Amber Example */}
                        <ExampleRow
                            digits={['2', '1', '0', '5', '9', '0']}
                            feedback={['unfilled', 'inSequence', 'unfilled', 'unfilled', 'unfilled', 'unfilled']}
                            description="The digit 1 is in the date but in the wrong spot."
                        />

                        {/* Grey Example */}
                        <ExampleRow
                            digits={['3', '0', '0', '7', '2', '5']}
                            feedback={['unfilled', 'unfilled', 'unfilled', 'unfilled', 'ruledOut', 'unfilled']}
                            description="The digit 2 is not in the date in any spot."
                        />

                        <StyledView className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-xl mb-6">
                            <Text className="text-blue-800 dark:text-blue-200 font-semibold mb-1">
                                Hint
                            </Text>
                            <Text className="text-blue-600 dark:text-blue-300 text-sm">
                                Look out for arrows! The arrows tell you if the correct digit for that specific slot is higher or lower.
                            </Text>
                        </StyledView>
                    </ScrollView>

                    {/* Footer */}
                    <StyledView
                        className="p-6 border-t"
                        style={{ borderColor: borderColor }}
                    >
                        <StyledTouchableOpacity
                            onPress={onClose}
                            className="w-full py-4 rounded-full items-center"
                            style={{ backgroundColor: textColor }}
                        >
                            <Text style={{ color: backgroundColor, fontWeight: 'bold', fontSize: 18 }}>
                                Got it!
                            </Text>
                        </StyledTouchableOpacity>
                    </StyledView>
                </StyledView>
            </StyledView>
        </Modal>
    );
}
