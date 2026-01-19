import React, { useEffect, useState } from 'react';
import { View, Text, Modal, TouchableOpacity, Share, Image, Animated } from 'react-native';
import { styled } from 'nativewind';
import { X } from 'lucide-react-native';
import * as Clipboard from 'expo-clipboard';

// Import SVGs
import StatsHamster from '../../assets/Maths-Hamster-Green.svg';
import WinBlueHamster from '../../assets/Win-Hamster-Blue.svg';
import ArchiveHamster from '../../assets/Librarian-Hamster-Yellow.svg';

// Fallback to PNG due to SVG transformer issues
const WinHamsterImg = require('../../assets/hamster.png');

const StyledView = styled(View);
const StyledText = styled(Text);
const StyledTouchableOpacity = styled(TouchableOpacity);
const StyledImage = styled(Image);

interface GameResultModalProps {
    isOpen: boolean;
    isWin: boolean;
    guessesCount: number;
    maxGuesses: number;
    answerDateCanonical: string;
    onClose: () => void;
    onHome: () => void;
    eventTitle: string;
    eventDescription: string;
    onViewStats?: () => void;
    onViewArchive?: () => void;
    onPlayAgain?: () => void;
    isLocalMode?: boolean;
    awardedBadges?: any[];
}

export function EndGameModal({
    isOpen,
    isWin,
    guessesCount,
    maxGuesses,
    answerDateCanonical,
    onClose,
    onHome,
    eventTitle,
    eventDescription,
    onViewStats,
    onViewArchive,
    onPlayAgain,
    isLocalMode = false,
    awardedBadges = []
}: GameResultModalProps) {
    // Colors and hamster images based on mode (matching web client)
    const statsColor = isLocalMode ? "#93cd78" : "#A4DB57"; // Green (lighter for USER)
    const homeColor = isLocalMode ? "#66becb" : "#7DAAE8"; // Blue (lighter for USER)
    const archiveColor = isLocalMode ? "#fdab58" : "#FFD429"; // Yellow/Orange (darker for USER)

    const [fadeAnim] = useState(new Animated.Value(0));
    const [isClosing, setIsClosing] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setIsClosing(false);
            Animated.timing(fadeAnim, {
                toValue: 1,
                duration: 600,
                useNativeDriver: true,
            }).start();
        } else {
            fadeAnim.setValue(0);
        }
    }, [isOpen]);

    const handleHomePress = () => {
        setIsClosing(true);
        Animated.timing(fadeAnim, {
            toValue: 0,
            duration: 300,
            useNativeDriver: true,
        }).start(() => {
            setIsClosing(false);
            onHome();
        });
    };

    // Construct Date String (Simple format for now, e.g. "12th July 1889")
    // If native Intl is available, use it, else manual.
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


    return (
        <Modal
            visible={isOpen}
            transparent={true}
            animationType="none"
            onRequestClose={onClose}
        >
            <Animated.View style={{ flex: 1, opacity: fadeAnim, backgroundColor: '#ffffff' }} className="dark:bg-slate-900">
                <StyledView className="flex-1 bg-white dark:bg-slate-900 px-6 pt-12 pb-6 justify-between">

                    {/* Scrollable Content Container */}
                    <View className="flex-1 items-center w-full">

                        {/* Header: Congratulations */}
                        <StyledView className="items-center mb-6 relative w-full">
                            <StyledText className="text-3xl font-bold text-slate-800 dark:text-white text-center">
                                {isWin ? "Congratulations!" : "Unlucky!"}
                            </StyledText>
                        </StyledView>

                        {/* Hamster Image (Centred) */}
                        <StyledView className="items-center mb-6 z-10 h-48 justify-center">
                            <Animated.View style={{ opacity: fadeAnim, transform: [{ scale: fadeAnim }] }}>
                                <StyledImage
                                    source={WinHamsterImg}
                                    className="w-56 h-56"
                                    resizeMode="contain"
                                />
                            </Animated.View>
                        </StyledView>

                        {/* Date */}
                        <StyledView className="items-center mb-4">
                            <StyledText className="text-2xl font-bold text-slate-700 dark:text-slate-200 text-center">
                                {formattedDate}
                            </StyledText>
                        </StyledView>

                        {/* Description Box */}
                        <StyledView className="bg-slate-100 dark:bg-slate-800 p-4 rounded-2xl w-full mb-4 border border-slate-200 dark:border-slate-700">
                            <StyledText className="font-semibold text-lg text-slate-900 dark:text-white text-center mb-2">
                                {eventTitle}
                            </StyledText>
                            <StyledText className="text-sm text-slate-500 dark:text-slate-400 text-center">
                                {eventDescription || "A historic day to remember!"}
                            </StyledText>
                        </StyledView>

                        {isWin && (
                            <StyledText className="text-sm text-slate-500 dark:text-slate-400 text-center font-medium mb-4">
                                You solved it in {guessesCount} {guessesCount === 1 ? 'guess' : 'guesses'}!
                            </StyledText>
                        )}
                    </View>

                    {/* Buttons Stack (Bottom Fixed) */}
                    <StyledView className="w-full space-y-3 mb-4">
                        {/* Stats Button (Green) */}
                        <StyledTouchableOpacity
                            className="w-full h-20 flex-row items-center justify-between px-6 rounded-3xl shadow-sm active:opacity-90"
                            style={{ backgroundColor: statsColor }}
                            onPress={onViewStats}
                        >
                            <StyledText className="text-xl font-n-bold text-slate-800 dark:text-slate-900">Stats</StyledText>
                            <View className="w-16 h-16 justify-center items-center">
                                {/* Placeholder for specific hamster if needed, or re-use existing with tint/style? 
                                For now using simple fallback or if we have specific PNGs use them. 
                                The user wants images on the right. 
                            */}
                                {/* <StatsHamster width={50} height={50} /> Using Image for safety */}
                                {/* Use PNG hamster images only to avoid React Native freeze errors */}
                                <StyledImage
                                    source={require('../../assets/Maths-Hamster-Green_1760977182003.png')}
                                    className="w-14 h-14"
                                    resizeMode="contain"
                                />
                            </View>
                        </StyledTouchableOpacity>

                        <StyledView className="flex-row gap-3">
                            {/* Home Button (Blue) */}
                            <StyledTouchableOpacity
                                className="flex-1 h-20 flex-row items-center justify-between px-5 rounded-3xl shadow-sm active:opacity-90"
                                style={{ backgroundColor: homeColor }}
                                onPress={handleHomePress}
                                disabled={isClosing}
                            >
                                <StyledText className="text-xl font-n-bold text-slate-800 dark:text-slate-900">Home</StyledText>
                                <View className="w-12 h-12 justify-center items-center">
                                    <StyledImage
                                        source={require('../../assets/Historian-Hamster-Blue_1760977182002.png')}
                                        className="w-12 h-12"
                                        resizeMode="contain"
                                    />
                                </View>
                            </StyledTouchableOpacity>

                            {/* Archive Button (Yellow) */}
                            <StyledTouchableOpacity
                                className="flex-1 h-20 flex-row items-center justify-between px-5 rounded-3xl shadow-sm active:opacity-90"
                                style={{ backgroundColor: archiveColor }}
                                onPress={onViewArchive}
                            >
                                <StyledText className="text-xl font-n-bold text-slate-800 dark:text-slate-900">Archive</StyledText>
                                <View className="w-12 h-12 justify-center items-center">
                                    <StyledImage
                                        source={require('../../assets/Librarian-Hamster-Yellow_1760977182002.png')}
                                        className="w-12 h-12"
                                        resizeMode="contain"
                                    />
                                </View>
                            </StyledTouchableOpacity>
                        </StyledView>
                    </StyledView>

                </StyledView>
            </Animated.View>
        </Modal>
    );
}

