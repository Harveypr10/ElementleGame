import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Share, Image } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { styled } from 'nativewind';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';
import { useOptions } from '../lib/options';

// Hamster images
// Hamster images
const WinHamsterImg = require('../assets/ui/Celebration-Hamster-Grey.png');
const LoseHamsterImg = require('../assets/ui/Commiseration-Hamster-Grey.png');
const StatsHamsterImg = require('../assets/Maths-Hamster-Green_1760977182003.png');
const HomeHamsterImg = require('../assets/Historian-Hamster-Blue_1760977182002.png');
const ArchiveHamsterImg = require('../assets/Librarian-Hamster-Yellow_1760977182002.png');
const ShareHamsterImg = require('../assets/ui/Login-Hamster-White.png');

import { ThemedView } from '../components/ThemedView';
import { ThemedText } from '../components/ThemedText';
import { useThemeColor } from '../hooks/useThemeColor';
import { ConfettiOverlay } from '../components/game/ConfettiOverlay';
import { RainOverlay } from '../components/game/RainOverlay';

const StyledView = styled(View);
const StyledText = styled(Text);
const StyledTouchableOpacity = styled(TouchableOpacity);
const StyledImage = styled(Image);

export default function GameResultScreen() {
    const router = useRouter();
    const { textScale } = useOptions();
    const params = useLocalSearchParams();

    // Parse params
    const isWin = params.isWin === 'true';
    const guessesCount = parseInt(params.guessesCount as string, 10);
    const maxGuesses = parseInt(params.maxGuesses as string, 10);
    const answerDateCanonical = params.answerDateCanonical as string;
    const eventTitle = params.eventTitle as string;
    const eventDescription = params.eventDescription as string;
    const gameMode = params.gameMode as string;
    const isGuest = params.isGuest === 'true';
    const isLocalMode = gameMode === 'USER';

    // Colors based on mode (matching original EndGameModal)
    const statsColor = isLocalMode ? "#93cd78" : "#A4DB57"; // Green
    const homeColor = isLocalMode ? "#66becb" : "#7DAAE8"; // Blue
    const archiveColor = isLocalMode ? "#fdab58" : "#FFD429"; // Yellow/Orange
    const shareColor = "#e87daa"; // Pink for both modes

    // Format date
    const dateObj = new Date(answerDateCanonical);
    const day = dateObj.getDate();
    const month = dateObj.toLocaleString('default', { month: 'long' });
    const year = dateObj.getFullYear();
    const getOrdinal = (n: number) => {
        const s = ["th", "st", "nd", "rd"];
        const v = n % 100;
        return n + (s[(v - 20) % 10] || s[v] || s[0]);
    };
    const formattedDate = `${getOrdinal(day)} ${month} ${year}`;

    const shareText = `I ${isWin ? 'solved' : 'tried'} today's Elementle puzzle!\n${eventTitle}\n${formattedDate}\n${isWin ? `Guessed in ${guessesCount}/${maxGuesses}` : `Used all ${maxGuesses} guesses`}`;

    const surfaceColor = useThemeColor({}, 'surface');
    const borderColor = useThemeColor({}, 'border');
    const backgroundColor = useThemeColor({}, 'background');
    const textColor = useThemeColor({}, 'text');

    const handleShare = async () => {
        try {
            await Share.share({ message: shareText });
        } catch (error) {
            console.error('Error sharing:', error);
        }
    };

    return (
        <ThemedView className="flex-1">
            {/* Animations */}
            {isWin && <ConfettiOverlay />}
            {!isWin && <RainOverlay />}

            <SafeAreaView edges={['top', 'bottom']} className="flex-1">
                <StyledView className="flex-1 px-6 pt-8 pb-6 justify-between">
                    {/* Scrollable Content */}
                    {/* Scrollable Content - Centered in available space */}
                    {/* Scrollable Content - Centered in available space */}
                    <View className="flex-1 items-center justify-center w-full">
                        {/* Header */}
                        <StyledView className="items-center mb-6">
                            <ThemedText style={{ fontSize: 36 * textScale, lineHeight: 40 * textScale }} className="font-n-bold text-center">
                                {isWin ? "Congratulations!" : "Unlucky!"}
                            </ThemedText>
                        </StyledView>

                        {/* Hamster Image - Reduced height */}
                        <StyledView className="items-center mb-6 h-40 justify-center">
                            <StyledImage
                                source={isWin ? WinHamsterImg : LoseHamsterImg}
                                className="w-48 h-48"
                                resizeMode="contain"
                            />
                        </StyledView>

                        {/* Date */}
                        <StyledView className="items-center mb-4">
                            <ThemedText style={{ fontSize: 30 * textScale }} className="font-n-bold text-center opacity-90">
                                {formattedDate}
                            </ThemedText>
                        </StyledView>

                        {/* Description Box - Light Grey No Border */}
                        <StyledView
                            className="p-4 rounded-2xl w-full mb-4 shadow-sm"
                            style={{ backgroundColor: '#f8fafc' }}
                        >
                            <ThemedText style={{ fontSize: 18 * textScale, color: '#0f172a' }} className="font-n-semibold text-center mb-2">
                                {eventTitle}
                            </ThemedText>
                            <ThemedText style={{ fontSize: 14 * textScale, color: '#334155' }} className="text-center opacity-80">
                                {eventDescription || "A historic day to remember!"}
                            </ThemedText>
                        </StyledView>

                        {/* Guesses text - Reduced margin */}
                        {isWin && (
                            <ThemedText className="text-base text-center font-n-medium mb-2 opacity-60">
                                You solved it in {guessesCount} {guessesCount === 1 ? 'guess' : 'guesses'}!
                            </ThemedText>
                        )}
                    </View>

                    {/* Buttons Stack (Bottom Fixed) - Reduced button heights */}
                    <StyledView className="w-full mb-4">
                        {isGuest ? (
                            <StyledView className="w-full">
                                <StyledTouchableOpacity
                                    className="w-full flex-row items-center justify-center px-4 rounded-3xl shadow-sm active:opacity-90"
                                    style={{ backgroundColor: homeColor, height: 72 }}
                                    onPress={() => {
                                        // Use replace so going back from Login goes to root/onboarding, not here
                                        router.replace('/(auth)/login');
                                    }}
                                >
                                    <StyledText className="text-xl font-n-bold text-slate-800 dark:text-slate-900">Continue</StyledText>
                                </StyledTouchableOpacity>
                            </StyledView>
                        ) : (
                            <>
                                {/* Top Row: Stats and Share */}
                                <StyledView className="flex-row gap-3 mb-3">
                                    {/* Stats Button */}
                                    <StyledTouchableOpacity
                                        className="flex-1 flex-row items-center justify-between px-4 rounded-3xl shadow-sm active:opacity-90"
                                        style={{ backgroundColor: statsColor, height: 72 }}
                                        onPress={() => router.push(`/stats?mode=${gameMode}`)}
                                    >
                                        <StyledText className="text-lg font-n-bold text-slate-800 dark:text-slate-900">Stats</StyledText>
                                        <View className="w-[46px] h-[46px] justify-center items-center">
                                            <StyledImage
                                                source={StatsHamsterImg}
                                                className="w-full h-full"
                                                resizeMode="contain"
                                            />
                                        </View>
                                    </StyledTouchableOpacity>

                                    {/* Share Button */}
                                    <StyledTouchableOpacity
                                        className="flex-1 flex-row items-center justify-between px-4 rounded-3xl shadow-sm active:opacity-90"
                                        style={{ backgroundColor: shareColor, height: 72 }}
                                        onPress={handleShare}
                                    >
                                        <StyledText className="text-lg font-n-bold text-slate-800 dark:text-slate-900">Share</StyledText>
                                        <View className="w-[46px] h-[46px] justify-center items-center">
                                            <StyledImage
                                                source={ShareHamsterImg}
                                                className="w-full h-full"
                                                resizeMode="contain"
                                            />
                                        </View>
                                    </StyledTouchableOpacity>
                                </StyledView>

                                {/* Bottom Row: Home and Archive */}
                                <StyledView className="flex-row gap-3">
                                    {/* Home Button */}
                                    <StyledTouchableOpacity
                                        className="flex-1 flex-row items-center justify-between px-4 rounded-3xl shadow-sm active:opacity-90"
                                        style={{ backgroundColor: homeColor, height: 72 }}
                                        onPress={() => router.push('/(tabs)')}
                                    >
                                        <StyledText className="text-lg font-n-bold text-slate-800 dark:text-slate-900">Home</StyledText>
                                        <View className="w-[46px] h-[46px] justify-center items-center">
                                            <StyledImage
                                                source={HomeHamsterImg}
                                                className="w-full h-full"
                                                resizeMode="contain"
                                            />
                                        </View>
                                    </StyledTouchableOpacity>

                                    {/* Archive Button */}
                                    <StyledTouchableOpacity
                                        className="flex-1 flex-row items-center justify-between px-4 rounded-3xl shadow-sm active:opacity-90"
                                        style={{ backgroundColor: archiveColor, height: 72 }}
                                        onPress={() => router.push('/archive')}
                                    >
                                        <StyledText className="text-lg font-n-bold text-slate-800 dark:text-slate-900">Archive</StyledText>
                                        <View className="w-[46px] h-[46px] justify-center items-center">
                                            <StyledImage
                                                source={ArchiveHamsterImg}
                                                className="w-full h-full"
                                                resizeMode="contain"
                                            />
                                        </View>
                                    </StyledTouchableOpacity>
                                </StyledView>
                            </>
                        )}
                    </StyledView>
                </StyledView>
            </SafeAreaView>
        </ThemedView>
    );
}
