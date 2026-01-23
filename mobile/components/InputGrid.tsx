import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Animated, Easing } from 'react-native';
import { styled } from 'nativewind';
import { ArrowUp, ArrowDown } from 'lucide-react-native';
import { ThemedText } from './ThemedText';
import { useThemeColor } from '../hooks/useThemeColor';
import { useOptions } from '../lib/options';

const StyledView = styled(View);
const StyledText = styled(Text);
const StyledAnimatedView = styled(Animated.View);

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
    invalidShake?: number; // Counter to trigger shake
    isRestored?: boolean;
    animatingRowIndex?: number | null; // Row index for sequential animation on submission
}

interface AnimatedCellProps {
    cell: { digit: string; state: CellState; arrow?: "up" | "down" };
    isPlaceholder: boolean;
    placeholder: string;
    isActiveRow: boolean;
    animateEntry?: boolean; // For restoration animation
    delay?: number; // Delay for restoration animation
    animateSubmission?: boolean; // For sequential digit animation on submission
    cellIndex?: number; // Index for sequential delay calculation
    themeColors: {
        active: { bg: string, border: string },
        default: { bg: string, border: string },
        text: { active: string, default: string }
    };
}

function AnimatedCell({ cell, isPlaceholder, placeholder, isActiveRow, animateEntry, delay = 0, animateSubmission, cellIndex = 0, themeColors }: AnimatedCellProps) {
    // Opacity for restoration fade-in
    // Start at 0 if we expect animation, 1 otherwise to prevent flash
    const opacityAnim = useRef(new Animated.Value(animateEntry ? 0 : 1)).current;
    const scaleAnim = useRef(new Animated.Value(1)).current;
    const rotateX = useRef(new Animated.Value(0)).current; // For submission animation (3D flip)

    // Track previous digit to detect changes (for typing)
    const prevDigit = useRef(cell.digit);
    const prevState = useRef(cell.state);
    const hasAnimated = useRef(false);
    const hasFlipped = useRef(false);

    // Track if this is the first render
    const isFirstRender = useRef(true);

    useEffect(() => {
        // CASE 1: Restoration Animation (when animateEntry becomes true)
        if (animateEntry && !hasAnimated.current) {
            // Reset to start values
            opacityAnim.setValue(0);
            scaleAnim.setValue(1);
            hasAnimated.current = true;

            Animated.sequence([
                Animated.delay(delay), // Stagger delay
                Animated.parallel([
                    // Fade in
                    Animated.timing(opacityAnim, {
                        toValue: 1,
                        duration: 400,
                        useNativeDriver: true,
                    }),
                    // Pop animation: grow then return to normal
                    Animated.sequence([
                        Animated.timing(scaleAnim, {
                            toValue: 1.15,
                            duration: 400,
                            useNativeDriver: true,
                        }),
                        Animated.timing(scaleAnim, {
                            toValue: 1,
                            duration: 400,
                            useNativeDriver: true,
                        }),
                    ])
                ])
            ]).start();
        }
        // CASE 2: Typing Animation (active row, digit change)
        else if (isActiveRow && cell.digit && !prevDigit.current) {
            // Standard type pop
            scaleAnim.setValue(1); // Ensure starting at 1
            Animated.sequence([
                Animated.timing(scaleAnim, {
                    toValue: 1.15,
                    duration: 100,
                    useNativeDriver: true,
                }),
                Animated.timing(scaleAnim, {
                    toValue: 1,
                    duration: 100,
                    useNativeDriver: true,
                }),
            ]).start();
        }

        prevDigit.current = cell.digit;
    }, [cell.digit, isActiveRow, animateEntry, delay]);

    const hasDigit = !!cell.digit;

    const getCellStyles = (state: CellState, hasDigit: boolean) => {
        switch (state) {
            case "correct":
                return { className: "bg-game-correct border-game-correct border-0" };
            case "inSequence":
                return { className: "bg-game-inSequence border-game-inSequence border-0" };
            case "notInSequence":
                return { className: "bg-game-notInSequence border-game-notInSequence border-0" };
            default:
                if (hasDigit) {
                    return {
                        className: "border-2",
                        style: { backgroundColor: themeColors.active.bg, borderColor: themeColors.active.border }
                    };
                }
                return {
                    className: "border-2",
                    style: { backgroundColor: themeColors.default.bg, borderColor: themeColors.default.border }
                };
        }
    };

    const getCellTextColors = (state: CellState, hasDigit: boolean) => {
        if (state !== 'empty') return 'text-white';
        // Bold black text for input (or white in dark mode manually)
        return { color: hasDigit ? themeColors.text.active : themeColors.text.default };
    };

    let content = "";
    if (cell.digit) content = cell.digit;
    else if (isPlaceholder) content = placeholder;



    const cellStyleInfo = getCellStyles(cell.state, hasDigit);
    const textStyleInfo = getCellTextColors(cell.state, hasDigit);

    return (
        <StyledAnimatedView
            style={[
                {
                    transform: [
                        { scale: scaleAnim }
                    ],
                    opacity: opacityAnim,
                    flexBasis: 0,
                    flexShrink: 1,
                    flexGrow: 1
                },
                cellStyleInfo.style
            ]}
            className={`min-h-[60px] max-w-[54px] mx-0.5 my-1 rounded-md justify-center pt-1 items-center ${cellStyleInfo.className}`}
        >
            <ThemedText
                className={`font-nunito ${hasDigit ? '' : 'opacity-30'} ${typeof textStyleInfo === 'string' ? textStyleInfo : ''}`}
                style={typeof textStyleInfo !== 'string' ? textStyleInfo : undefined}
                size={hasDigit ? '3xl' : '2xl'}
            >
                {content}
            </ThemedText>

            {/* Arrow Indicator */}
            {cell.arrow && (
                <View className="absolute top-1 right-1">
                    {cell.arrow === 'up' ? (
                        <ArrowUp size={14} color="white" strokeWidth={2.5} />
                    ) : (
                        <ArrowDown size={14} color="white" strokeWidth={2.5} />
                    )}
                </View>
            )}
        </StyledAnimatedView>
    );
}

// Wrapper to animate the ROW
function AnimatedRow({ children, shouldShake }: { children: React.ReactNode, shouldShake: number }) {
    const shakeAnim = useRef(new Animated.Value(0)).current;
    const prevShake = useRef(0);

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
        <StyledAnimatedView
            className="flex-row justify-center w-full max-w-md mx-auto px-2"
            style={{ transform: [{ translateX: shakeAnim }] }}
        >
            {children}
        </StyledAnimatedView>
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
    // Manual Theme Def because cells use dynamic conditions
    const themeColors = {
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
    };

    const numCells = placeholders.length;
    const prevGuessesLengthRef = useRef(guesses.length);
    const [newlySubmittedRowIndex, setNewlySubmittedRowIndex] = useState<number | null>(null);
    const [fadingOutRow, setFadingOutRow] = useState(false);
    const [displayedGuesses, setDisplayedGuesses] = useState<CellFeedback[][]>(guesses);

    // Sync displayed guesses with actual guesses, but with animation delay
    useEffect(() => {
        if (!isRestored && guesses.length > prevGuessesLengthRef.current) {
            // New guess submitted - start fade-out
            setFadingOutRow(true);

            // After fade-out completes (50ms), update displayed guesses and trigger fade-in
            setTimeout(() => {
                setDisplayedGuesses(guesses); // Show the new colored row
                setFadingOutRow(false);
                const newRowIndex = guesses.length - 1;
                setNewlySubmittedRowIndex(newRowIndex);

                // Clear animation state
                setTimeout(() => {
                    setNewlySubmittedRowIndex(null);
                }, 2500);
            }, 50);
        } else {
            // Direct update for restored games or initial load
            setDisplayedGuesses(guesses);
        }
        prevGuessesLengthRef.current = guesses.length;
    }, [guesses, guesses.length, isRestored]);

    const rows = Array.from({ length: maxGuesses }, (_, i) => {
        if (i < displayedGuesses.length) return displayedGuesses[i]; // Completed guess
        if (i === displayedGuesses.length) {
            // Current active row
            return Array.from({ length: numCells }, (_, j) => ({
                digit: currentInput[j] || "",
                state: "empty" as CellState,
            }));
        }
        // Future empty rows
        return Array(numCells).fill({ digit: "", state: "empty" });
    });

    return (
        <View className="flex-1 w-full justify-start pt-2 items-center">
            {rows.map((row, rowIdx) => {
                const isActiveRow = rowIdx === displayedGuesses.length;

                // Wrap in Animated Row if active
                if (isActiveRow) {
                    return (
                        <AnimatedRow key={rowIdx} shouldShake={invalidShake}>
                            <View style={{ opacity: fadingOutRow ? 0 : 1, flex: 1, flexDirection: 'row' }}>
                                {row.map((cell, cellIdx) => {
                                    const hasDigit = !!cell.digit;
                                    const isPlaceholder = isActiveRow && !hasDigit;
                                    return (
                                        <AnimatedCell
                                            key={`${rowIdx}-${cellIdx}`}
                                            cell={cell}
                                            isPlaceholder={isPlaceholder}
                                            placeholder={placeholders[cellIdx]}
                                            isActiveRow={isActiveRow}
                                            themeColors={themeColors}
                                        />
                                    );
                                })}
                            </View>
                        </AnimatedRow>
                    );
                }

                // Regular Row (filled or completed)
                return (
                    <View key={rowIdx} className="flex-row justify-center w-full max-w-md mx-auto px-2">
                        {row.map((cell, cellIdx) => {
                            // Calculate delay for staggered restoration animation
                            // Row delay: 300ms between rows
                            // Cell delay within row: 200ms per cell (8 cells = 1600ms per row)
                            const rowDelay = rowIdx * 300; // 0ms, 300ms, 600ms, 900ms, 1200ms for rows 0-4
                            const cellDelay = cellIdx * 200; // 0ms, 200ms, 400ms, ... for cells within row
                            const totalDelay = (isRestored || rowIdx === newlySubmittedRowIndex) ? rowDelay + cellDelay : 0;
                            // Animate if we're in restore mode OR this row was just submitted
                            const isCompletedRow = rowIdx < guesses.length;
                            const shouldAnimate = (isRestored && isCompletedRow) || (rowIdx === newlySubmittedRowIndex);

                            // Hide this row if it's currently being submitted (during fade-out period)
                            if (rowIdx === guesses.length - 1 && fadingOutRow) {
                                return <View key={`${rowIdx}-${cellIdx}`} className="flex-1 min-h-[60px] max-w-[54px] mx-0.5 my-1" />;
                            }

                            return (
                                <AnimatedCell
                                    key={`${rowIdx}-${cellIdx}`}
                                    cell={cell}
                                    isPlaceholder={false}
                                    placeholder={placeholders[cellIdx]}
                                    isActiveRow={false}
                                    animateEntry={shouldAnimate}
                                    delay={totalDelay}
                                    themeColors={themeColors}
                                />
                            );
                        })}
                    </View>
                );
            })}
        </View>
    );
}
