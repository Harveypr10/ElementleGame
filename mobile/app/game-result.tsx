import React from 'react';
import { View, Text, TouchableOpacity, Share, Image } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { styled } from 'nativewind';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';
import { useOptions } from '../lib/options';

// Hamster images
const WinHamsterImg = require('../assets/hamster.png');
const StatsHamsterImg = require('../assets/Maths-Hamster-Green_1760977182003.png');
const HomeHamsterImg = require('../assets/Historian-Hamster-Blue_1760977182002.png');
const ArchiveHamsterImg = require('../assets/Librarian-Hamster-Yellow_1760977182002.png');

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
    const isLocalMode = gameMode === 'USER';

    // Colors based on mode (matching original EndGameModal)
    const statsColor = isLocalMode ? "#93cd78" : "#A4DB57"; // Green
    const homeColor = isLocalMode ? "#66becb" : "#7DAAE8"; // Blue
    const archiveColor = isLocalMode ? "#fdab58" : "#FFD429"; // Yellow/Orange
    const shareColor = isLocalMode ? "#e879f9" : "#c084fc"; // Purple

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

    const handleShare = async () => {
        try {
            await Share.share({ message: shareText });
        } catch (error) {
            console.error('Error sharing:', error);
        }
    };

    return (
        <StyledView className="flex-1 bg-white dark:bg-slate-900">
            <SafeAreaView edges={['top', 'bottom']} className="flex-1">
                <StyledView className="flex-1 px-6 pt-8 pb-6 justify-between">
                    {/* Scrollable Content */}
                    <View className="flex-1 items-center w-full">
                        {/* Header */}
                        <StyledView className="items-center mb-4">
                            <StyledText style={{ fontSize: 28 * textScale }} className="font-n-bold text-slate-800 dark:text-white text-center">
                                {isWin ? "Congratulations!" : "Unlucky!"}
                            </StyledText>
                        </StyledView>

                        {/* Hamster Image - Reduced height */}
                        <StyledView className="items-center mb-3 h-40 justify-center">
                            <StyledImage
                                source={WinHamsterImg}
                                className="w-48 h-48"
                                resizeMode="contain"
                            />
                        </StyledView>

                        {/* Date */}
                        <StyledView className="items-center mb-2">
                            <StyledText style={{ fontSize: 22 * textScale }} className="font-n-bold text-slate-700 dark:text-slate-200 text-center">
                                {formattedDate}
                            </StyledText>
                        </StyledView>

                        {/* Description Box - Reduced padding */}
                        <StyledView className="bg-slate-100 dark:bg-slate-800 p-3 rounded-2xl w-full mb-2 border border-slate-200 dark:border-slate-700">
                            <StyledText style={{ fontSize: 16 * textScale }} className="font-n-semibold text-slate-900 dark:text-white text-center mb-1">
                                {eventTitle}
                            </StyledText>
                            <StyledText style={{ fontSize: 13 * textScale }} className="text-slate-500 dark:text-slate-400 text-center">
                                {eventDescription || "A historic day to remember!"}
                            </StyledText>
                        </StyledView>

                        {/* Guesses text - Reduced margin */}
                        {isWin && (
                            <StyledText className="text-sm text-slate-500 dark:text-slate-400 text-center font-n-medium mb-2">
                                You solved it in {guessesCount} {guessesCount === 1 ? 'guess' : 'guesses'}!
                            </StyledText>
                        )}
                    </View>

                    {/* Buttons Stack (Bottom Fixed) - Reduced button heights */}
                    <StyledView className="w-full mb-4">
                        {/* Top Row: Stats and Share */}
                        <StyledView className="flex-row gap-3 mb-3">
                            {/* Stats Button - h-16 instead of h-20 */}
                            <StyledTouchableOpacity
                                className="flex-1 h-16 flex-row items-center justify-between px-4 rounded-3xl shadow-sm active:opacity-90"
                                style={{ backgroundColor: statsColor }}
                                onPress={() => router.push(`/stats?mode=${gameMode}`)}
                            >
                                <StyledText className="text-lg font-n-bold text-slate-800 dark:text-slate-900">Stats</StyledText>
                                <View className="w-10 h-10 justify-center items-center">
                                    <StyledImage
                                        source={StatsHamsterImg}
                                        className="w-10 h-10"
                                        resizeMode="contain"
                                    />
                                </View>
                            </StyledTouchableOpacity>

                            {/* Share Button - h-16 instead of h-20 */}
                            <StyledTouchableOpacity
                                className="flex-1 h-16 flex-row items-center justify-between px-4 rounded-3xl shadow-sm active:opacity-90"
                                style={{ backgroundColor: shareColor }}
                                onPress={handleShare}
                            >
                                <StyledText className="text-lg font-n-bold text-slate-800 dark:text-slate-900">Share</StyledText>
                                <View className="w-10 h-10 justify-center items-center">
                                    <StyledImage
                                        source={WinHamsterImg}
                                        className="w-10 h-10"
                                        resizeMode="contain"
                                    />
                                </View>
                            </StyledTouchableOpacity>
                        </StyledView>

                        {/* Bottom Row: Home and Archive */}
                        <StyledView className="flex-row gap-3">
                            {/* Home Button - h-16 instead of h-20 */}
                            <StyledTouchableOpacity
                                className="flex-1 h-16 flex-row items-center justify-between px-4 rounded-3xl shadow-sm active:opacity-90"
                                style={{ backgroundColor: homeColor }}
                                onPress={() => router.push('/(tabs)')}
                            >
                                <StyledText className="text-lg font-n-bold text-slate-800 dark:text-slate-900">Home</StyledText>
                                <View className="w-10 h-10 justify-center items-center">
                                    <StyledImage
                                        source={HomeHamsterImg}
                                        className="w-10 h-10"
                                        resizeMode="contain"
                                    />
                                </View>
                            </StyledTouchableOpacity>

                            {/* Archive Button - h-16 instead of h-20 */}
                            <StyledTouchableOpacity
                                className="flex-1 h-16 flex-row items-center justify-between px-4 rounded-3xl shadow-sm active:opacity-90"
                                style={{ backgroundColor: archiveColor }}
                                onPress={() => router.push('/archive')}
                            >
                                <StyledText className="text-lg font-n-bold text-slate-800 dark:text-slate-900">Archive</StyledText>
                                <View className="w-10 h-10 justify-center items-center">
                                    <StyledImage
                                        source={ArchiveHamsterImg}
                                        className="w-10 h-10"
                                        resizeMode="contain"
                                    />
                                </View>
                            </StyledTouchableOpacity>
                        </StyledView>
                    </StyledView>
                </StyledView>
            </SafeAreaView>
        </StyledView>
    );
}
