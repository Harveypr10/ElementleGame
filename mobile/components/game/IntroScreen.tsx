import React, { useEffect, useRef } from 'react';
import { useThemeColor } from '../../hooks/useThemeColor';
import { View, Text, Modal, TouchableOpacity, Image, Animated, Alert } from 'react-native';
import { styled } from 'nativewind';
import { format } from 'date-fns';
import { useRouter } from 'expo-router';
import { useOptions } from '../../lib/options';
import { ChevronLeft } from 'lucide-react-native';
import { ThemedText } from '../ThemedText';

import StreakHamster from '../../assets/ui/webp_assets/Streak-Hamster-Black.webp';

const StyledView = styled(View);
const StyledText = styled(Text);
const StyledTouchableOpacity = styled(TouchableOpacity);

interface IntroScreenProps {
    visible: boolean;
    onStart: () => void;
    gameMode: 'REGION' | 'USER';
    puzzleDate?: string;
    isStreakGame?: boolean;
    isStreakSaverGame?: boolean;
    currentStreak?: number;
    eventTitle?: string;
}

export function IntroScreen({
    visible,
    onStart,
    gameMode,
    puzzleDate,
    isStreakGame,
    isStreakSaverGame,
    currentStreak,
    eventTitle
}: IntroScreenProps) {
    const router = useRouter();
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const { cluesEnabled, streakSaverActive } = useOptions();

    // Theme Colors
    const backgroundColor = useThemeColor({}, 'background');
    const iconColor = useThemeColor({}, 'icon');
    // For text usage if ThemedText isn't sufficient or for specific overrides
    const textColor = useThemeColor({}, 'text');

    useEffect(() => {
        if (visible) {
            Animated.timing(fadeAnim, {
                toValue: 1,
                duration: 500,
                useNativeDriver: true, // Native driver supports opacity
            }).start();
        } else {
            fadeAnim.setValue(0);
        }
    }, [visible]);

    if (!visible) return null;

    // Handle back button press - warn if streak saver game
    const handleBack = () => {
        if (isStreakSaverGame && streakSaverActive) {
            Alert.alert(
                'Streak Saver',
                'To keep your streak going you must win this puzzle from yesterday. Exiting will reset your streak, without using your streak saver.',
                [
                    { text: 'Continue Playing', style: 'cancel' },
                    { text: 'Exit and Lose Streak', style: 'destructive', onPress: () => router.back() }
                ]
            );
        } else {
            router.back();
        }
    };

    // Prompt text changes based on clues enabled
    const promptText = cluesEnabled
        ? (gameMode === 'REGION'
            ? "On what date did this historical event occur?"
            : "On what date did this personal event occur?")
        : "Take on the challenge of guessing a date in history!";

    const formattedDate = puzzleDate ? format(new Date(puzzleDate), 'MMM d, yyyy') : '';

    return (
        <Modal transparent visible={visible} animationType="fade">
            {/* Use ThemedView style for background, override for Streak Game (Force Black) */}
            <StyledView
                className="flex-1 justify-center items-center p-4"
                style={{ backgroundColor: isStreakGame ? '#000000' : backgroundColor }}
            >
                {/* Back Arrow - Always Visible */}
                <StyledView className="absolute top-12 left-4 z-10">
                    <StyledTouchableOpacity
                        onPress={handleBack}
                        className="p-2 rounded-full active:opacity-70"
                        style={{
                            backgroundColor: isStreakGame ? 'rgba(255, 255, 255, 0.1)' : 'transparent'
                        }}
                    >
                        <ChevronLeft
                            size={28}
                            color={isStreakGame ? '#ffffff' : iconColor}
                        />
                    </StyledTouchableOpacity>
                </StyledView>

                <Animated.View style={{ opacity: fadeAnim, width: '100%', maxWidth: 400, alignItems: 'center' }}>

                    {/* Mascot */}
                    <StyledView className="mb-8 items-center justify-center h-48 w-48">
                        {isStreakGame ? (
                            <View className="relative w-full h-full justify-center items-center">
                                <Image
                                    source={require('../../assets/ui/webp_assets/Streak-Hamster-Black.webp')}
                                    style={{ width: 180, height: 180 }}
                                    resizeMode="contain"
                                />
                                <ThemedText className="absolute text-red-600 font-display font-bold shadow-lg" size="4xl" style={{ paddingTop: 40 }}>
                                    {currentStreak}
                                </ThemedText>
                            </View>
                        ) : (
                            <Image
                                source={require('../../assets/ui/webp_assets/Question-Hamster-v2.webp')}
                                style={{ width: 160, height: 160 }}
                                resizeMode="contain"
                            />
                        )}
                    </StyledView>

                    {/* Text Content */}
                    <StyledView className="items-center mb-8 space-y-4 px-4">
                        <ThemedText
                            className="text-center font-body"
                            style={{ color: isStreakGame ? '#ffffff' : textColor }}
                            size="lg"
                        >
                            {isStreakGame ? "Continue your streak!" : promptText}
                        </ThemedText>

                        {/* Title (e.g. "Hagia Sophia...") - only show if clues enabled */}
                        {cluesEnabled && eventTitle && !isStreakGame && (
                            <ThemedText className="text-center font-display font-bold text-brand-blue dark:text-blue-400 mt-2" size="xl">
                                {eventTitle}
                            </ThemedText>
                        )}
                    </StyledView>

                    {/* Play Button */}
                    <StyledTouchableOpacity
                        onPress={onStart}
                        className={`w-4/5 py-4 rounded-full shadow-lg active:scale-95 transform transition-transform items-center ${gameMode === 'USER' ? 'bg-[#66becb]' : 'bg-[#7DAAE8]'
                            }`}
                    >
                        <ThemedText className="text-white font-display font-bold uppercase tracking-wider" size="xl">
                            Play
                        </ThemedText>
                    </StyledTouchableOpacity>

                    {/* Date Footer */}
                    {formattedDate && (
                        <ThemedText className="text-slate-500 dark:text-slate-400 mt-8 font-body opacity-80" size="sm">
                            Puzzle date: {formattedDate}
                        </ThemedText>
                    )}

                </Animated.View>
            </StyledView>
        </Modal>
    );
}
