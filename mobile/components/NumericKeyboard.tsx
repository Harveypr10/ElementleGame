import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, Dimensions } from 'react-native';
import { styled } from 'nativewind';
import { Delete, RotateCcw } from 'lucide-react-native';
import hapticsManager from '../lib/hapticsManager';
import soundManager from '../lib/soundManager';

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
    // Responsive button height - smaller on small screens
    const buttonHeight = useMemo(() => {
        const screenHeight = Dimensions.get('window').height;
        if (screenHeight < 700) return 48; // Small screens
        if (screenHeight < 800) return 52; // Medium screens  
        return 56; // Large screens (h-14)
    }, []);

    const getKeyClasses = (digit: string) => {
        const state = keyStates[digit] || "default";
        switch (state) {
            case "correct":
                return "bg-game-correct border-game-correct";
            case "inSequence":
                return "bg-game-inSequence border-game-inSequence";
            case "ruledOut":
                return "bg-gray-500 border-gray-500";
            default:
                return "bg-slate-200 border-slate-300 dark:bg-slate-700 dark:border-slate-600";
        }
    };

    const getKeyTextClasses = (digit: string) => {
        const state = keyStates[digit] || "default";
        switch (state) {
            case "correct":
            case "inSequence":
            case "ruledOut":
                return "text-white";
            default:
                return "text-slate-800 dark:text-white";
        }
    };

    const renderKey = (digit: string) => (
        <StyledTouchableOpacity
            key={digit}
            onPress={() => {
                hapticsManager.light();
                soundManager.play('tap');
                onDigitPress(digit);
            }}
            className={`flex-1 m-1 rounded-md justify-center items-center active:bg-slate-300 ${getKeyClasses(digit)}`}
            style={{ height: buttonHeight }}
        >
            <StyledText className={`text-xl font-nunito ${getKeyTextClasses(digit)}`}>{digit}</StyledText>
        </StyledTouchableOpacity>
    );

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
                    onPress={() => {
                        hapticsManager.medium();
                        onEnter();
                    }}
                    disabled={!canSubmit}
                    className={`flex-1 m-1 rounded-md justify-center items-center ${canSubmit ? "bg-brand-blue" : "bg-brand-blue/30"}`}
                    style={{ height: buttonHeight }}>
                    <StyledText className="text-white text-lg font-nunito">Enter</StyledText>
                </StyledTouchableOpacity>

                <StyledTouchableOpacity
                    onPress={() => {
                        hapticsManager.medium();
                        onClear();
                    }}
                    className="w-20 m-1 rounded-md justify-center items-center bg-slate-200 dark:bg-slate-700"
                    style={{ height: buttonHeight }}
                >
                    <RotateCcw size={24} color="#64748b" />
                </StyledTouchableOpacity>

                <StyledTouchableOpacity
                    onPress={() => {
                        hapticsManager.medium();
                        onDelete();
                    }}
                    className="w-20 m-1 rounded-md justify-center items-center bg-slate-200 dark:bg-slate-700"
                    style={{ height: buttonHeight }}
                >
                    <Delete size={24} color="#64748b" />
                </StyledTouchableOpacity>
            </View>
        </View>
    );
}
