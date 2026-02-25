import React from 'react';
import { View, Text, Modal, ScrollView, TouchableOpacity } from 'react-native';
import { styled } from 'nativewind';
import { X, ArrowUp, ArrowDown } from 'lucide-react-native';
import { ThemedText } from './ThemedText';
import { useThemeColor } from '../hooks/useThemeColor';

const StyledView = styled(View);
const StyledText = styled(Text);
const StyledTouchableOpacity = styled(TouchableOpacity);

interface HelpModalProps {
    visible: boolean;
    onClose: () => void;
    isGuest?: boolean;
    onLoginPress?: () => void;
}

export function HelpModal({ visible, onClose, isGuest = false, onLoginPress }: HelpModalProps) {
    const backgroundColor = useThemeColor({}, 'background');
    const surfaceColor = useThemeColor({}, 'surface');
    const borderColor = useThemeColor({}, 'border');
    const textColor = useThemeColor({}, 'text');
    const iconColor = useThemeColor({}, 'icon');
    const secondaryTextColor = useThemeColor({ light: '#475569', dark: '#94a3b8' }, 'text');

    // Tile colors - keeping these consistent as they are game indicators
    const tileBaseBg = surfaceColor;
    const tileBaseBorder = borderColor;

    const ExampleRow = ({ digits, feedback, description, arrows }: {
        digits: string[],
        feedback: ('correct' | 'inSequence' | 'ruledOut' | 'unfilled')[],
        description: string,
        arrows?: (('up' | 'down' | null)[])
    }) => (
        <StyledView className="mb-3">
            <StyledView className="flex-row justify-center mb-1.5 space-x-1">
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
                        tileStyle = { backgroundColor: '#555555', borderColor: '#555555' };
                        textStyle = { color: '#ffffff' };
                    } else {
                        // 'unfilled' - white background with black border like input tiles
                        tileStyle = { backgroundColor: '#ffffff', borderColor: '#000000' };
                        textStyle = { color: '#000000' };
                    }

                    const arrow = arrows?.[index] ?? null;

                    return (
                        <StyledView
                            key={index}
                            className="w-10 h-12 border-2 rounded-md items-center justify-center m-0.5"
                            style={[tileStyle, { position: 'relative' as const }]}
                        >
                            <Text style={[{ fontSize: 20, fontWeight: 'bold' }, textStyle]}>
                                {digit}
                            </Text>
                            {/* Arrow indicator */}
                            {arrow && (
                                <View style={{ position: 'absolute', top: 1, right: 1 }}>
                                    {arrow === 'up' ? (
                                        <ArrowUp size={11} color="white" strokeWidth={3} />
                                    ) : (
                                        <ArrowDown size={11} color="white" strokeWidth={3} />
                                    )}
                                </View>
                            )}
                        </StyledView>
                    );
                })}
            </StyledView>
            <Text style={{ textAlign: 'center', fontSize: 14, color: secondaryTextColor, paddingHorizontal: 4 }}>
                {description}
            </Text>
        </StyledView>
    );

    const handleButtonPress = () => {
        if (isGuest && onLoginPress) {
            onLoginPress();
        } else {
            onClose();
        }
    };

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
                    style={{ backgroundColor: surfaceColor, height: '89.5%', maxWidth: 768, alignSelf: 'center' }}
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
                            <StyledTouchableOpacity onPress={onClose} style={{ padding: 8 }} hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}>
                                <X size={24} color={iconColor} />
                            </StyledTouchableOpacity>
                        </StyledView>
                    </StyledView>

                    <ScrollView className="flex-1 px-6 pt-4" contentContainerStyle={{ paddingBottom: 40 }}>
                        <Text style={{ fontSize: 16, color: secondaryTextColor, marginBottom: 10, lineHeight: 24 }}>
                            Crack the historical date in 5 attempts.
                        </Text>

                        <Text style={{ fontSize: 16, color: secondaryTextColor, marginBottom: 16, lineHeight: 24 }}>
                            Enter a valid date for each guess. The tiles will change color to help you solve the puzzle.
                        </Text>

                        {/* Examples */}
                        <ThemedText className="text-lg font-bold mb-3">
                            Examples
                        </ThemedText>

                        {/* Correct Example */}
                        <ExampleRow
                            digits={['0', '5', '1', '0', '8', '3']}
                            feedback={['unfilled', 'unfilled', 'unfilled', 'unfilled', 'correct', 'unfilled']}
                            description="8 is the correct number in the exact right spot"
                        />

                        {/* Amber Example */}
                        <ExampleRow
                            digits={['1', '2', '0', '5', '9', '0']}
                            feedback={['inSequence', 'unfilled', 'unfilled', 'unfilled', 'unfilled', 'unfilled']}
                            description="1 is part of the date, but belongs in a different spot"
                        />

                        {/* Grey Example */}
                        <ExampleRow
                            digits={['0', '3', '0', '7', '2', '5']}
                            feedback={['unfilled', 'unfilled', 'unfilled', 'unfilled', 'ruledOut', 'unfilled']}
                            description="2 is not in the date at all"
                        />

                        {/* Arrows Example — in branded blue container */}
                        <View style={{
                            backgroundColor: 'rgba(125, 170, 232, 0.15)',
                            borderRadius: 16,
                            paddingTop: 14,
                            paddingBottom: 14,
                            paddingHorizontal: 8,
                            marginBottom: 4,
                        }}>
                            <StyledView className="mb-0">
                                <StyledView className="flex-row justify-center mb-1.5 space-x-1">
                                    {['0', '4', '1', '0', '7', '3'].map((digit, index) => {
                                        const feedback = ['correct', 'inSequence', 'ruledOut', 'inSequence', 'ruledOut', 'correct'] as const;
                                        const arrowMap: (('up' | 'down' | null)[]) = [null, 'up', 'down', 'up', 'down', null];
                                        let tileStyle = { backgroundColor: '#ffffff', borderColor: '#000000' };
                                        let textStyle = { color: '#000000' };
                                        if (feedback[index] === 'correct') {
                                            tileStyle = { backgroundColor: '#22c55e', borderColor: '#22c55e' };
                                            textStyle = { color: '#ffffff' };
                                        } else if (feedback[index] === 'inSequence') {
                                            tileStyle = { backgroundColor: '#fbbf24', borderColor: '#fbbf24' };
                                            textStyle = { color: '#ffffff' };
                                        } else if (feedback[index] === 'ruledOut') {
                                            tileStyle = { backgroundColor: '#555555', borderColor: '#555555' };
                                            textStyle = { color: '#ffffff' };
                                        }
                                        const arrow = arrowMap[index];
                                        return (
                                            <StyledView
                                                key={index}
                                                className="w-10 h-12 border-2 rounded-md items-center justify-center m-0.5"
                                                style={[tileStyle, { position: 'relative' as const }]}
                                            >
                                                <Text style={[{ fontSize: 20, fontWeight: 'bold' }, textStyle]}>
                                                    {digit}
                                                </Text>
                                                {arrow && (
                                                    <View style={{ position: 'absolute', top: 1, right: 1 }}>
                                                        {arrow === 'up' ? (
                                                            <ArrowUp size={11} color="white" strokeWidth={3} />
                                                        ) : (
                                                            <ArrowDown size={11} color="white" strokeWidth={3} />
                                                        )}
                                                    </View>
                                                )}
                                            </StyledView>
                                        );
                                    })}
                                </StyledView>
                                <Text style={{ textAlign: 'center', fontSize: 14, color: secondaryTextColor, paddingHorizontal: 4 }}>
                                    Arrows tell you the correct digit is higher or lower
                                </Text>
                            </StyledView>
                        </View>

                    </ScrollView>

                    {/* Footer */}
                    <StyledView
                        className="p-6 border-t"
                        style={{ borderColor: borderColor }}
                    >
                        <StyledTouchableOpacity
                            onPress={handleButtonPress}
                            className="w-full py-4 rounded-full items-center"
                            style={{ backgroundColor: textColor }}
                        >
                            <Text style={{ color: backgroundColor, fontWeight: 'bold', fontSize: 18 }}>
                                {isGuest ? 'Log in or Sign up' : 'Got it!'}
                            </Text>
                        </StyledTouchableOpacity>
                        {isGuest && (
                            <Text style={{
                                textAlign: 'center',
                                fontSize: 13,
                                color: secondaryTextColor,
                                marginTop: 10,
                            }}>
                                Create a free account to save your progress
                            </Text>
                        )}
                    </StyledView>
                </StyledView>
            </StyledView>
        </Modal>
    );
}
