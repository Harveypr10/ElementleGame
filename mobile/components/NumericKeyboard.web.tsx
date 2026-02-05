/**
 * NumericKeyboard - Web Version
 * 
 * Web-specific implementation with inline flexbox styles to ensure
 * horizontal row layout works correctly on web browsers.
 */

import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, Dimensions, StyleSheet } from 'react-native';
import { Delete, RotateCcw } from 'lucide-react-native';
import hapticsManager from '../lib/hapticsManager';
import soundManager from '../lib/soundManager';
import { useOptions } from '../lib/options';

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

    const buttonHeight = useMemo(() => {
        const screenHeight = Dimensions.get('window').height;
        if (screenHeight < 700) return 44;
        if (screenHeight < 800) return 47;
        return 50;
    }, []);

    const getKeyStyles = (digit: string) => {
        const state = keyStates[digit] || "default";
        switch (state) {
            case "correct":
                return { backgroundColor: '#22c55e', borderColor: '#22c55e' };
            case "inSequence":
                return { backgroundColor: '#F59E0B', borderColor: '#F59E0B' };
            case "ruledOut":
                return { backgroundColor: '#555555', borderColor: '#555555' };
            default:
                return { backgroundColor: darkMode ? '#334155' : '#e2e8f0' };
        }
    };

    const getKeyTextColor = (digit: string) => {
        const state = keyStates[digit] || "default";
        switch (state) {
            case "correct":
            case "inSequence":
            case "ruledOut":
                return 'white';
            default:
                return darkMode ? 'white' : '#1e293b';
        }
    };

    const renderKey = (digit: string) => (
        <TouchableOpacity
            key={digit}
            testID={`keyboard-digit-${digit}`}
            onPress={() => {
                hapticsManager.light();
                soundManager.play('tap');
                onDigitPress(digit);
            }}
            style={[
                styles.key,
                { height: buttonHeight },
                getKeyStyles(digit)
            ]}
        >
            <Text style={[styles.keyText, { color: getKeyTextColor(digit) }]}>
                {digit}
            </Text>
        </TouchableOpacity>
    );

    return (
        <View style={styles.container}>
            {/* Row 1: 1-5 */}
            <View style={styles.row}>
                {["1", "2", "3", "4", "5"].map(renderKey)}
            </View>

            {/* Row 2: 6-0 */}
            <View style={styles.row}>
                {["6", "7", "8", "9", "0"].map(renderKey)}
            </View>

            {/* Row 3: Enter, Clear, Delete */}
            <View style={styles.row}>
                <TouchableOpacity
                    testID="keyboard-enter"
                    onPress={() => {
                        hapticsManager.medium();
                        onEnter();
                    }}
                    disabled={!canSubmit}
                    style={[
                        styles.enterKey,
                        { height: buttonHeight },
                        { backgroundColor: canSubmit ? '#6998AB' : 'rgba(105, 152, 171, 0.3)' }
                    ]}
                >
                    <Text style={styles.enterText}>Enter</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    testID="keyboard-clear"
                    onPress={() => {
                        hapticsManager.medium();
                        onClear();
                    }}
                    style={[
                        styles.actionKey,
                        { height: buttonHeight },
                        { backgroundColor: darkMode ? '#334155' : '#e2e8f0' }
                    ]}
                >
                    <RotateCcw size={24} color={darkMode ? '#94a3b8' : '#64748b'} />
                </TouchableOpacity>

                <TouchableOpacity
                    testID="keyboard-delete"
                    onPress={() => {
                        hapticsManager.medium();
                        onDelete();
                    }}
                    style={[
                        styles.actionKey,
                        { height: buttonHeight },
                        { backgroundColor: darkMode ? '#334155' : '#e2e8f0' }
                    ]}
                >
                    <Delete size={24} color={darkMode ? '#94a3b8' : '#64748b'} />
                </TouchableOpacity>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        width: '100%',
        paddingHorizontal: 20,
        paddingBottom: 20,
    },
    row: {
        flexDirection: 'row', // CRITICAL: Force horizontal layout
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 4,
    },
    key: {
        flex: 1,
        margin: 4,
        borderRadius: 6,
        justifyContent: 'center',
        alignItems: 'center',
        cursor: 'pointer',
    },
    keyText: {
        fontFamily: 'Nunito, sans-serif',
        fontWeight: '700',
        fontSize: 20,
    },
    enterKey: {
        flex: 1,
        margin: 4,
        borderRadius: 6,
        justifyContent: 'center',
        alignItems: 'center',
        cursor: 'pointer',
    },
    enterText: {
        fontFamily: 'Nunito, sans-serif',
        fontWeight: '700',
        fontSize: 18,
        color: 'white',
    },
    actionKey: {
        width: 80,
        margin: 4,
        borderRadius: 6,
        justifyContent: 'center',
        alignItems: 'center',
        cursor: 'pointer',
    },
});
