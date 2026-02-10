import React, { useEffect, useRef, useState } from 'react';
import { useThemeColor } from '../../hooks/useThemeColor';
import { View, Text, Modal, TouchableOpacity, Animated, Alert } from 'react-native';
import { Image } from 'expo-image';
import { styled } from 'nativewind';
import { format } from 'date-fns';
import { useRouter } from 'expo-router';
import { useOptions } from '../../lib/options';
import { ChevronLeft } from 'lucide-react-native';
import { ThemedText } from '../ThemedText';

import StreakHamster from '../../assets/ui/webp_assets/Streak-Hamster-Black.webp';
import { StreakBadge } from '../StreakBadge';

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
    onAnimationComplete?: () => void;
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
    isGuest = false,
    onAnimationComplete
}: IntroScreenProps) {
    const router = useRouter();
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const { cluesEnabled, streakSaverActive } = useOptions();
    const [isVisible, setIsVisible] = useState(visible);

    // Theme Colors
    const backgroundColor = useThemeColor({}, 'background');
    const iconColor = useThemeColor({}, 'icon');
    // For text usage if ThemedText isn't sufficient or for specific overrides
    const textColor = useThemeColor({}, 'text');

    useEffect(() => {
        if (visible) {
            setIsVisible(true);
            Animated.timing(fadeAnim, {
                toValue: 1,
                duration: 500,
                useNativeDriver: true,
            }).start();
        } else {
            Animated.timing(fadeAnim, {
                toValue: 0,
                duration: 500,
                useNativeDriver: true,
            }).start(() => {
                setIsVisible(false);
                if (onAnimationComplete) onAnimationComplete();
            });
        }
    }, [visible]);

    if (!isVisible) return null;

    // Prompt text changes based on clues enabled
    const promptText = cluesEnabled
        ? (gameMode === 'REGION'
            ? "On what date did this historical event occur?"
            : "On what date did this personal event occur?")
        : "Take on the challenge of guessing a date in history!";

    const formattedDate = puzzleDate ? format(new Date(puzzleDate), 'MMM d, yyyy') : '';

    return (
        /* Replaced Modal with Absolute View to prevent navigation flash and allow smoother transitions */
        <StyledView
            className="absolute top-0 bottom-0 left-0 right-0 z-50"
            style={{ backgroundColor: isStreakGame ? '#000000' : backgroundColor }}
        >
            <Animated.View style={{ opacity: fadeAnim, flex: 1 }}>

                {/* Center Content Area — mascot + text centered in the upper portion */}
                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 16 }}>
                    <View style={{ maxWidth: 400, width: '100%', alignItems: 'center' }}>
                        {/* Mascot */}
                        <StyledView className="mb-8 items-center justify-center h-48 w-48 relative">
                            {isStreakGame ? (
                                <View style={{ width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center' }}>
                                    <StreakBadge streak={currentStreak || 0} size={180} />
                                </View>
                            ) : (
                                <Image
                                    source={require('../../assets/ui/webp_assets/Sherlock-Hamster.webp')}
                                    style={{ width: 160, height: 160 }}
                                    contentFit="contain"
                                    cachePolicy="disk"
                                />
                            )}
                        </StyledView>

                        {/* Text Content */}
                        <StyledView className="items-center space-y-4 px-4 w-full">
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
                    </View>
                </View>

                {/* Bottom Section — Play button + optional buttons anchored to bottom */}
                <View style={{ paddingHorizontal: 16, paddingBottom: 48, alignItems: 'center' }}>
                    <View style={{ maxWidth: 400, width: '100%', alignItems: 'center' }}>
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
                            <ThemedText className="text-slate-500 dark:text-slate-400 mt-6 font-body opacity-80" size="sm">
                                Puzzle date: {formattedDate}
                            </ThemedText>
                        )}
                    </View>
                </View>

            </Animated.View>
        </StyledView>
    );
}
