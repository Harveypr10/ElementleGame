/**
 * InputGrid - Web Version
 * 
 * Web-specific implementation with inline flexbox styles to ensure
 * horizontal row layout works correctly on web browsers.
 */

import React, { useEffect, useRef, useState } from 'react';
import { View, Animated, StyleSheet, Text } from 'react-native';
import { ArrowUp, ArrowDown } from 'lucide-react-native';
import { useOptions } from '../lib/options';

export type CellState = "empty" | "correct" | "inSequence" | "notInSequence";

export interface CellFeedback {
    digit: string;
    state: CellState;
    arrow?: "up" | "down";
}

interface InputGridProps {
    guesses: CellFeedback[][];
    currentInput: string;
    maxGuesses: number;
    placeholders?: string[];
    invalidShake?: number;
    isRestored?: boolean;
}

interface CellProps {
    digit: string;
    targetState: CellState;
    arrow?: "up" | "down";
    isPlaceholder: boolean;
    placeholder: string;
    isActiveRow: boolean;
    shouldAnimate: boolean;
    delay?: number;
    isRestored?: boolean;
    themeColors: any;
}

const RESULT_COLORS = {
    correct: '#22c55e',
    inSequence: '#F59E0B',
    notInSequence: '#555555',
};

function Cell({
    digit,
    targetState,
    arrow,
    isPlaceholder,
    placeholder,
    isActiveRow,
    shouldAnimate,
    delay = 0,
    isRestored,
    themeColors
}: CellProps) {
    const scaleY = useRef(new Animated.Value(1)).current;
    const [isRevealed, setIsRevealed] = useState(() => {
        if (isRestored) return false;
        if (shouldAnimate) return false;
        if (targetState !== 'empty') return true;
        return false;
    });
    const hasAnimated = useRef(false);

    useEffect(() => {
        if (!isRevealed && targetState !== 'empty' && !shouldAnimate && !hasAnimated.current && !isRestored) {
            setIsRevealed(true);
        }
    }, [targetState, shouldAnimate, isRevealed, isRestored]);

    useEffect(() => {
        if (shouldAnimate && !hasAnimated.current) {
            Animated.sequence([
                Animated.delay(delay),
                Animated.timing(scaleY, {
                    toValue: 0,
                    duration: 250,
                    useNativeDriver: true,
                })
            ]).start(() => {
                setIsRevealed(true);
                hasAnimated.current = true;
                Animated.timing(scaleY, {
                    toValue: 1,
                    duration: 250,
                    useNativeDriver: true,
                }).start();
            });
        }
    }, [shouldAnimate, delay]);

    const scalePop = useRef(new Animated.Value(1)).current;
    const prevDigit = useRef(digit);

    useEffect(() => {
        if (isActiveRow && digit && digit !== prevDigit.current) {
            scalePop.setValue(1);
            Animated.sequence([
                Animated.timing(scalePop, { toValue: 1.15, duration: 80, useNativeDriver: true }),
                Animated.timing(scalePop, { toValue: 1, duration: 80, useNativeDriver: true }),
            ]).start();
        }
        prevDigit.current = digit;
    }, [digit, isActiveRow]);

    const textColor = isRevealed
        ? '#FFFFFF'
        : (digit ? themeColors.text.active : themeColors.text.default);

    let borderColor = 'transparent';
    let borderWidth = 2;

    if (!isRevealed) {
        if (isActiveRow) {
            if (digit) {
                borderColor = themeColors.active.border;
            } else {
                borderColor = themeColors.default.border;
            }
        } else if (shouldAnimate) {
            borderColor = themeColors.active.border;
        } else {
            borderColor = themeColors.default.border;
        }
    }

    const backgroundColor = isRevealed
        ? (targetState === 'correct' ? RESULT_COLORS.correct :
            targetState === 'inSequence' ? RESULT_COLORS.inSequence :
                targetState === 'notInSequence' ? RESULT_COLORS.notInSequence : 'transparent')
        : (isActiveRow || shouldAnimate ? themeColors.active.bg : themeColors.default.bg);

    const transform = [
        { scaleY },
        { scale: scalePop }
    ];

    const showPlaceholder = isPlaceholder && isActiveRow;

    return (
        <View style={styles.cellContainer}>
            <Animated.View
                style={[
                    styles.cell,
                    {
                        transform,
                        borderColor,
                        borderWidth,
                        backgroundColor,
                    }
                ]}
            >
                <Text
                    style={[
                        styles.cellText,
                        {
                            color: textColor,
                            opacity: digit || isRevealed ? 1 : 0.3,
                            fontSize: digit || isRevealed ? 26 : 22,
                        }
                    ]}
                >
                    {digit || (showPlaceholder ? placeholder : "")}
                </Text>

                {isRevealed && arrow && (
                    <View style={styles.arrowContainer}>
                        {arrow === 'up' ? (
                            <ArrowUp size={14} color="white" strokeWidth={2.5} />
                        ) : (
                            <ArrowDown size={14} color="white" strokeWidth={2.5} />
                        )}
                    </View>
                )}
            </Animated.View>
        </View>
    );
}

function AnimatedRow({ children, shouldShake }: { children: React.ReactNode, shouldShake: number }) {
    const shakeAnim = useRef(new Animated.Value(0)).current;
    const prevShake = useRef(shouldShake);

    useEffect(() => {
        if (shouldShake > prevShake.current) {
            Animated.sequence([
                Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
                Animated.timing(shakeAnim, { toValue: -10, duration: 50, useNativeDriver: true }),
                Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
                Animated.timing(shakeAnim, { toValue: -10, duration: 50, useNativeDriver: true }),
                Animated.timing(shakeAnim, { toValue: 0, duration: 50, useNativeDriver: true })
            ]).start();
        }
        prevShake.current = shouldShake;
    }, [shouldShake]);

    return (
        <Animated.View
            style={[
                styles.row,
                { transform: [{ translateX: shakeAnim }] }
            ]}
        >
            {children}
        </Animated.View>
    );
}

export function InputGrid({
    guesses,
    currentInput,
    maxGuesses,
    placeholders = ["D", "D", "M", "M", "Y", "Y"],
    invalidShake = 0,
    isRestored = false
}: InputGridProps) {
    const { darkMode } = useOptions();

    const themeColors = React.useMemo(() => ({
        active: {
            bg: darkMode ? '#0f172a' : '#ffffff',
            border: darkMode ? '#ffffff' : '#000000'
        },
        default: {
            bg: darkMode ? '#0f172a' : '#ffffff',
            border: darkMode ? '#334155' : '#e2e8f0'
        },
        text: {
            active: darkMode ? '#ffffff' : '#0f172a',
            default: darkMode ? '#475569' : '#cbd5e1'
        }
    }), [darkMode]);

    const numCells = placeholders.length;

    const rows = Array.from({ length: maxGuesses }, (_, i) => {
        if (i < guesses.length) return guesses[i];
        if (i === guesses.length) {
            return Array.from({ length: numCells }, (_, j) => ({
                digit: currentInput[j] || "",
                state: "empty" as CellState,
            }));
        }
        return Array(numCells).fill({ digit: "", state: "empty" });
    });

    return (
        <View style={styles.container}>
            {rows.map((row, rowIdx) => {
                const isActiveRow = rowIdx === guesses.length;
                const isSubmittedRow = rowIdx < guesses.length;

                let shouldAnimateRow = false;
                if (isRestored) {
                    if (isSubmittedRow) shouldAnimateRow = true;
                } else {
                    if (isSubmittedRow && rowIdx === guesses.length - 1) {
                        shouldAnimateRow = true;
                    }
                }

                const shakeTrigger = isActiveRow ? invalidShake : 0;

                return (
                    <AnimatedRow key={`row-${rowIdx}`} shouldShake={shakeTrigger}>
                        {row.map((cell: any, cellIdx: number) => {
                            const baseDelay = isRestored ? rowIdx * 600 : 0;
                            const delay = baseDelay + (cellIdx * 250);
                            const isPlaceholder = !cell.digit && isActiveRow;

                            return (
                                <Cell
                                    key={`cell-${rowIdx}-${cellIdx}`}
                                    digit={cell.digit}
                                    targetState={cell.state}
                                    arrow={cell.arrow}
                                    isPlaceholder={isPlaceholder}
                                    placeholder={placeholders[cellIdx]}
                                    isActiveRow={isActiveRow}
                                    shouldAnimate={shouldAnimateRow}
                                    delay={delay}
                                    isRestored={isRestored}
                                    themeColors={themeColors}
                                />
                            );
                        })}
                    </AnimatedRow>
                );
            })}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        width: '100%',
        paddingTop: 8,
        alignItems: 'center',
        justifyContent: 'flex-start',
    },
    row: {
        flexDirection: 'row', // CRITICAL: Force horizontal row layout
        justifyContent: 'center',
        width: '100%',
        maxWidth: 448, // max-w-md
        paddingHorizontal: 8,
        marginBottom: 4,
    },
    cellContainer: {
        flex: 1,
        minHeight: 60,
        maxWidth: 54,
        marginHorizontal: 2,
        marginVertical: 4,
        height: 60,
    },
    cell: {
        flex: 1,
        borderRadius: 6,
        justifyContent: 'center',
        alignItems: 'center',
    },
    cellText: {
        fontFamily: 'Nunito, sans-serif',
        fontWeight: '400',
        paddingTop: 4,
        paddingLeft: 2,
    },
    arrowContainer: {
        position: 'absolute',
        top: 2,
        right: 2,
    },
});
