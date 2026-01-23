import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, Dimensions } from 'react-native';
import { styled } from 'nativewind';
import { Delete, RotateCcw } from 'lucide-react-native';
import hapticsManager from '../lib/hapticsManager';
import soundManager from '../lib/soundManager';
import { ThemedText } from './ThemedText';
import { useOptions } from '../lib/options';

const StyledView = styled(View);
const StyledText = styled(Text);
const StyledTouchableOpacity = styled(TouchableOpacity);

export type KeyState = "default" | "correct" | "inSequence" | "ruledOut";

interface NumericKeyboardProps {
    onDigitPress: (digit: string) => void;
    onDelete: () => void;
    onClear: () => void;
    onEnter: () => void;
    keyStates: Record<string, KeyState>;
    canSubmit: boolean;
}

export function NumericKeyboard({
    onDigitPress,
    onDelete,
    onClear,
    onEnter,
    keyStates,
    canSubmit,
}: NumericKeyboardProps) {
    const { darkMode } = useOptions();

    // Responsive button height - smaller on small screens
    const buttonHeight = useMemo(() => {
        const screenHeight = Dimensions.get('window').height;
        if (screenHeight < 700) return 48; // Small screens
        if (screenHeight < 800) return 52; // Medium screens  
        return 56; // Large screens (h-14)
    }, []);

    const getKeyStyles = (digit: string) => {
        const state = keyStates[digit] || "default";
        switch (state) {
            case "correct":
                return { className: "bg-game-correct border-game-correct" };
            case "inSequence":
                return { className: "bg-game-inSequence border-game-inSequence" };
            case "ruledOut":
                return { className: "bg-gray-500 border-gray-500" };
            default:
                // Manual theme logic
                return {
                    className: "",
                    style: { backgroundColor: darkMode ? '#334155' : '#e2e8f0', borderColor: darkMode ? '#475569' : '#cbd5e1', borderWidth: 1 }
                };
        }
    };

    const getKeyTextColors = (digit: string) => {
        const state = keyStates[digit] || "default";
        switch (state) {
            case "correct":
            case "inSequence":
            case "ruledOut":
                return { color: 'white' };
            default:
                return { color: darkMode ? 'white' : '#1e293b' };
        }
    };



    const renderKey = (digit: string) => {
        const styleInfo = getKeyStyles(digit);
        const textInfo = getKeyTextColors(digit);

        return (
            <StyledTouchableOpacity
                key={digit}
                testID={`keyboard-digit-${digit}`}
                onPress={() => {
                    hapticsManager.light();
                    soundManager.play('tap');
                    onDigitPress(digit);
                }}
                className={`flex-1 m-1 rounded-md justify-center items-center active:bg-slate-300 ${styleInfo.className}`}
                style={[{ height: buttonHeight }, styleInfo.style]}
            >
                <ThemedText style={textInfo} className="font-nunito" size="xl">{digit}</ThemedText>
            </StyledTouchableOpacity>
        );
    };

    return (
        <View className="w-full px-2 pb-6">
            <View className="flex-row">
                {["1", "2", "3", "4", "5"].map(renderKey)}
            </View>
            <View className="flex-row">
                {["6", "7", "8", "9", "0"].map(renderKey)}
            </View>
            <View className="flex-row mt-1">
                <StyledTouchableOpacity
                    testID="keyboard-enter"
                    onPress={() => {
                        hapticsManager.medium();
                        onEnter();
                    }}
                    disabled={!canSubmit}
                    className={`flex-1 m-1 rounded-md justify-center items-center ${canSubmit ? "bg-brand-blue" : "bg-brand-blue/30"}`}
                    style={{ height: buttonHeight }}>
                    <ThemedText className="text-white font-nunito" size="lg">Enter</ThemedText>
                </StyledTouchableOpacity>

                <StyledTouchableOpacity
                    testID="keyboard-clear"
                    onPress={() => {
                        hapticsManager.medium();
                        onClear();
                    }}
                    className="w-20 m-1 rounded-md justify-center items-center"
                    style={{
                        height: buttonHeight,
                        backgroundColor: darkMode ? '#334155' : '#e2e8f0'
                    }}
                >
                    <RotateCcw size={24} color={darkMode ? '#94a3b8' : '#64748b'} />
                </StyledTouchableOpacity>

                <StyledTouchableOpacity
                    testID="keyboard-delete"
                    onPress={() => {
                        hapticsManager.medium();
                        onDelete();
                    }}
                    className="w-20 m-1 rounded-md justify-center items-center"
                    style={{
                        height: buttonHeight,
                        backgroundColor: darkMode ? '#334155' : '#e2e8f0'
                    }}
                >
                    <Delete size={24} color={darkMode ? '#94a3b8' : '#64748b'} />
                </StyledTouchableOpacity>
            </View>
        </View>
    );
}
