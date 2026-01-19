import React, { useEffect, useRef } from 'react';
import { View, Text, Modal, TouchableOpacity, Image, Animated } from 'react-native';
import { styled } from 'nativewind';
import { format } from 'date-fns';
// Fallback to png as SVG not found in migration
const WelcomeHamster = require('../../assets/hamster.png');
import StreakHamster from '../../assets/Streak-Hamster-Black.svg';


const StyledView = styled(View);
const StyledText = styled(Text);
const StyledTouchableOpacity = styled(TouchableOpacity);

interface IntroScreenProps {
    visible: boolean;
    onStart: () => void;
    gameMode: 'REGION' | 'USER';
    puzzleDate?: string;
    isStreakGame?: boolean;
    currentStreak?: number;
    eventTitle?: string;
}

export function IntroScreen({
    visible,
    onStart,
    gameMode,
    puzzleDate,
    isStreakGame,
    currentStreak,
    eventTitle
}: IntroScreenProps) {
    const fadeAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        if (visible) {
            Animated.timing(fadeAnim, {
                toValue: 1,
                duration: 500,
                useNativeDriver: true,
            }).start();
        } else {
            fadeAnim.setValue(0);
        }
    }, [visible]);

    if (!visible) return null;

    // TODO: Determine prompt text based on mode
    const promptText = gameMode === 'REGION'
        ? "On what date did this historical event occur?"
        : "On what date did this personal event occur?";

    const formattedDate = puzzleDate ? format(new Date(puzzleDate), 'MMM d, yyyy') : '';

    return (
        <Modal transparent visible={visible} animationType="fade">
            <StyledView className={`flex-1 justify-center items-center p-4 ${isStreakGame ? 'bg-black' : 'bg-white dark:bg-slate-900'}`}>
                <Animated.View style={{ opacity: fadeAnim, width: '100%', maxWidth: 400, alignItems: 'center' }}>

                    {/* Mascot */}
                    <StyledView className="mb-8 items-center justify-center h-48 w-48">
                        {isStreakGame ? (
                            <View className="relative w-full h-full justify-center items-center">
                                <StreakHamster width={180} height={180} />
                                <StyledText className="absolute text-red-600 font-display font-bold text-4xl pt-10 shadow-lg">
                                    {currentStreak}
                                </StyledText>
                            </View>
                        ) : (
                            <Image
                                source={WelcomeHamster}
                                style={{ width: 160, height: 160 }}
                                resizeMode="contain"
                            />
                        )}
                    </StyledView>

                    {/* Text Content */}
                    <StyledView className="items-center mb-8 space-y-4 px-4">
                        <StyledText className={`text-center font-body text-lg ${isStreakGame ? 'text-white' : 'text-slate-700 dark:text-slate-200'}`}>
                            {isStreakGame ? "Continue your streak!" : promptText}
                        </StyledText>

                        {/* Title (e.g. "Hagia Sophia...") */}
                        {eventTitle && !isStreakGame && (
                            <StyledText className="text-center font-display font-bold text-xl text-brand-blue dark:text-blue-400 mt-2">
                                {eventTitle}
                            </StyledText>
                        )}
                    </StyledView>

                    {/* Play Button */}
                    <StyledTouchableOpacity
                        onPress={onStart}
                        className={`w-4/5 py-4 rounded-full shadow-lg active:scale-95 transform transition-transform items-center ${gameMode === 'USER' ? 'bg-[#66becb]' : 'bg-[#7DAAE8]'
                            }`}
                    >
                        <StyledText className="text-white font-display font-bold text-xl uppercase tracking-wider">
                            Play
                        </StyledText>
                    </StyledTouchableOpacity>

                    {/* Date Footer */}
                    {formattedDate && (
                        <StyledText className="text-slate-400 text-sm mt-8 font-body">
                            Puzzle date: {formattedDate}
                        </StyledText>
                    )}

                </Animated.View>
            </StyledView>
        </Modal>
    );
}
