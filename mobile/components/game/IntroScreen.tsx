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
    onExit?: () => void;
    currentStreak?: number;
    eventTitle?: string;
    isGuest?: boolean;
    category?: string; // Added category prop
}

export function IntroScreen({
    visible,
    onStart,
    gameMode,
    puzzleDate,
    isStreakGame,
    isStreakSaverGame,
    onExit,
    currentStreak,
    eventTitle,
    category, // Destructure category
    isGuest = false
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
        if (isStreakSaverGame) {
            // Note: Removed 'streakSaverActive' check as we rely on the prop passed from parent context
            Alert.alert(
                'Streak Saver',
                'To keep your streak going you must win this puzzle from yesterday. Exiting will reset your streak, without using your streak saver.',
                [
                    { text: 'Continue Playing', style: 'cancel' },
                    {
                        text: 'Exit and Lose Streak',
                        style: 'destructive',
                        onPress: () => {
                            if (onExit) {
                                onExit();
                            } else {
                                router.back();
                            }
                        }
                    }
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
                    <StyledView className="mb-8 items-center justify-center h-48 w-48 relative">
                        {isStreakGame ? (
                            <View className="relative w-full h-full justify-center items-center">
                                <Image
                                    source={require('../../assets/ui/webp_assets/Streak-Hamster-Black.webp')}
                                    style={{ width: 180, height: 180 }}
                                    resizeMode="contain"
                                />
                                {/* Overlay Number - Centered on Mascot - Matched to StreakCelebration */}
                                <View className="absolute inset-x-0 bottom-8 items-center">
                                    <ThemedText
                                        className={`text-red-600 font-extrabold shadow-lg ${(currentStreak || 0).toString().length === 1 ? 'text-4xl' : (currentStreak || 0).toString().length === 2 ? 'text-3xl' : 'text-2xl'}`}
                                        style={{
                                            textShadowColor: 'rgba(255, 255, 255, 0.8)',
                                            textShadowOffset: { width: 0, height: 0 },
                                            textShadowRadius: 10
                                        }}
                                    >
                                        {currentStreak || 0}
                                    </ThemedText>
                                </View>
                            </View>
                        ) : (
                            <Image
                                source={require('../../assets/ui/webp_assets/Sherlock-Hamster.webp')}
                                style={{ width: 160, height: 160 }}
                                resizeMode="contain"
                            />
                        )}
                    </StyledView>

                    {/* Text Content */}
                    <StyledView className="items-center mb-8 space-y-4 px-4 w-full">
                        <StyledView className="max-w-[270px]">
                            {isStreakGame ? (
                                <Text className="text-center font-body text-red-500 text-lg font-bold">
                                    Continue your streak!
                                </Text>
                            ) : (
                                <ThemedText
                                    className="text-center font-body text-slate-500"
                                    size="lg"
                                >
                                    {promptText}
                                </ThemedText>
                            )}
                        </StyledView>

                        {/* Event Category & Title - Show even if streak game (if clues enabled) */}
                        {cluesEnabled && (
                            <>
                                {category && (
                                    <Text className={`text-center font-display font-bold text-xl mt-2 ${isStreakGame ? 'text-yellow-400' : 'text-blue-900'}`}>
                                        {category}
                                    </Text>
                                )}
                                {eventTitle && (
                                    <ThemedText
                                        className="text-center font-display font-bold mt-2 text-slate-500"
                                        size="xl"
                                        style={isStreakGame ? { color: '#ffffff' } : undefined}
                                    >
                                        {eventTitle}
                                    </ThemedText>
                                )}
                            </>
                        )}
                    </StyledView>

                    {/* Buttons */}
                    <View className="w-full items-center space-y-3">
                        <StyledTouchableOpacity
                            onPress={onStart}
                            className={`w-3/5 py-4 rounded-full shadow-lg active:scale-95 transform transition-transform items-center ${gameMode === 'USER' ? 'bg-[#66becb]' : 'bg-[#7DAAE8]'
                                }`}
                        >
                            <ThemedText className="text-white font-display font-bold uppercase tracking-wider" size="xl">
                                Play
                            </ThemedText>
                        </StyledTouchableOpacity>

                        {isGuest && (
                            <>
                                <StyledTouchableOpacity
                                    onPress={() => router.push('/(auth)/login')}
                                    className="w-4/5 py-4 rounded-full shadow-lg active:scale-95 transform transition-transform items-center bg-slate-600"
                                >
                                    <ThemedText className="text-white font-display font-bold uppercase tracking-wider" size="xl">
                                        Log in
                                    </ThemedText>
                                </StyledTouchableOpacity>

                                <StyledTouchableOpacity
                                    onPress={() => router.push('/(auth)/subscription-flow')}
                                    className="w-4/5 py-4 rounded-full shadow-lg active:scale-95 transform transition-transform items-center bg-slate-400"
                                >
                                    <ThemedText className="text-white font-display font-bold uppercase tracking-wider" size="xl">
                                        Subscribe
                                    </ThemedText>
                                </StyledTouchableOpacity>
                            </>
                        )}
                    </View>

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
