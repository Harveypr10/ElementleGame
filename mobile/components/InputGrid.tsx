
import React, { useEffect, useRef, useState } from 'react';
import { View, Animated } from 'react-native';
import { styled } from 'nativewind';
import { ArrowUp, ArrowDown } from 'lucide-react-native';
import { ThemedText } from './ThemedText';
import { useThemeColor } from '../hooks/useThemeColor';
import { useOptions } from '../lib/options';

const StyledView = styled(View);
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
    shouldAnimate: boolean; // Trigger the reveal animation
    delay?: number;
    isRestored?: boolean;
    themeColors: any;
}

const RESULT_COLORS = {
    correct: '#22c55e',       // Green-500 (Matches approx HSL(142, 71%, 45%))
    inSequence: '#F59E0B',    // Amber-500 (Matches approx HSL(38, 92%, 55%))
    notInSequence: '#94A3B8', // Slate-400 (Darker Grey as requested)
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
    // Animation Values
    const scaleY = useRef(new Animated.Value(1)).current;

    // Internal State: Controls whether we show the "Input" style or "Result" style
    const [isRevealed, setIsRevealed] = useState(() => {
        if (isRestored) return false;
        if (shouldAnimate) return false;
        if (targetState !== 'empty') return true;
        return false;
    });

    // Prevent double animation
    const hasAnimated = useRef(false);

    // Sync State
    useEffect(() => {
        if (!isRevealed && targetState !== 'empty' && !shouldAnimate && !hasAnimated.current && !isRestored) {
            setIsRevealed(true);
        }
    }, [targetState, shouldAnimate, isRevealed, isRestored]);

    // 1. Reveal Animation (Squash/Flip)
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
                // Mid-point callback: Swap the visual state
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

    // 2. Typing Pop Animation
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


    // --- RENDER HELPERS ---

    const textColor = isRevealed
        ? '#FFFFFF'
        : (digit ? themeColors.text.active : themeColors.text.default);

    // Border Logic Fix:
    // User want border to remain BLACK until the flip happens.
    // If we are animating (shouldAnimate=true) but NOT yet revealed (isRevealed=false),
    // we are in the "Pre-Flip" phase.
    // In this phase, we must show the ACTIVE style (Black Border).

    let borderColor = 'transparent';
    let borderWidth = 2; // Keep standard thickness

    // Condition: Not revealed OR (Animating and in Pre-Flip phase)
    // Actually, !isRevealed handles the pre-flip phase naturally.
    if (!isRevealed) {
        if (isActiveRow) {
            if (digit) {
                borderColor = themeColors.active.border; // Dark/Black for active input
            } else {
                borderColor = themeColors.default.border; // Light grey
            }
        }
        // If it WAS the active row but is now submitted (e.g. animating), it's no longer 'isActiveRow'.
        // But for the purpose of the animation "starting point", it should look like it did a moment ago.
        else if (shouldAnimate) {
            // It's the row being animated. It should look like a filled active row before it flips.
            borderColor = themeColors.active.border;
        }
        else {
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
        <View className="flex-1 min-h-[60px] max-w-[54px] mx-0.5 my-1" style={{ height: 60 }}>
            <StyledAnimatedView
                style={[
                    {
                        transform,
                        borderColor: borderColor,
                        borderWidth: borderWidth,
                        backgroundColor: backgroundColor,
                    }
                ]}
                className={`flex-1 rounded-md justify-center items-center`}
            >
                {/* Digit: Reduced font weight (font-nunito instead of bold), Pushed slightly down/right */}
                <ThemedText
                    className={`font-nunito ${digit || isRevealed ? '' : 'opacity-30'}`}
                    style={{ color: textColor, paddingTop: 4, paddingLeft: 2 }}
                    size={digit || isRevealed ? '3xl' : '2xl'}
                >
                    {digit || (showPlaceholder ? placeholder : "")}
                </ThemedText>

                {/* Arrows: Pushed closer to corner (right-0.5 top-0.5), Smaller */}
                {isRevealed && arrow && (
                    <View className="absolute top-0.5 right-0.5">
                        {arrow === 'up' ? (
                            <ArrowUp size={14} color="white" strokeWidth={2.5} />
                        ) : (
                            <ArrowDown size={14} color="white" strokeWidth={2.5} />
                        )}
                    </View>
                )}
            </StyledAnimatedView>
        </View>
    );
}

// Wrapper to animate the ROW (Shake on Invalid)
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

    // Memoize colors
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

    // Track submitted rows to trigger animation logic for "Just Submitted" case
    // NOTE: This logic is cleaner than state. We derive "Just Submitted" from props if needed,
    // but detecting the "latest" row is tricky without state if component re-renders.
    // Actually, simply checking if `rowIdx == guesses.length - 1` is enough, 
    // IF we trust that `guesses` only grows.
    // But `isRestored` handles the "initial load" case correctly.

    // We removed lastSubmittedIdx state as per plan to ensure instant animation trigger.

    const numCells = placeholders.length;

    // Grid Construction
    const rows = Array.from({ length: maxGuesses }, (_, i) => {
        if (i < guesses.length) return guesses[i]; // Completed
        if (i === guesses.length) { // Active
            return Array.from({ length: numCells }, (_, j) => ({
                digit: currentInput[j] || "",
                state: "empty" as CellState,
            }));
        }
        // Future
        return Array(numCells).fill({ digit: "", state: "empty" });
    });

    return (
        <View className="flex-1 w-full justify-start pt-2 items-center">
            {rows.map((row, rowIdx) => {
                const isActiveRow = rowIdx === guesses.length;
                const isSubmittedRow = rowIdx < guesses.length;

                // Animation Logic
                // If Restored: Animate ALL submitted rows in sequence (as requested)
                // If Playing: Animate ONLY the row that was just submitted (guesses.length - 1)

                let shouldAnimateRow = false;

                if (isRestored) {
                    if (isSubmittedRow) shouldAnimateRow = true;
                } else {
                    // Logic: If this row is the LATEST submitted row, animate it.
                    // When user submits, guesses.length increments.
                    // The component re-renders.
                    // The row at index `guesses.length - 1` is the new submitted row.
                    // It should animate.
                    // Previous rows (index < length - 1) will have `shouldAnimateRow = false`.
                    // They will render revealed immediately (via cell sync logic).
                    if (isSubmittedRow && rowIdx === guesses.length - 1) {
                        shouldAnimateRow = true;
                    }
                }

                // Shake logic (only active row)
                const shakeTrigger = isActiveRow ? invalidShake : 0;

                return (
                    <AnimatedRow key={`row-${rowIdx}`} shouldShake={shakeTrigger}>
                        {row.map((cell: any, cellIdx: number) => {
                            // Stagger delay: 
                            // If restored: (Row * 600) + (Cell * 250) -> Sequential cascade
                            // If playing: (Cell * 250) -> Standard flip

                            const baseDelay = isRestored ? rowIdx * 600 : 0;
                            const delay = baseDelay + (cellIdx * 250);

                            // Check if this is a placeholder cell
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
