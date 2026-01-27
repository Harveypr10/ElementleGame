import React, { useEffect, useState } from 'react';
import { View, Text, Modal, TouchableOpacity, Share, Image, Animated } from 'react-native';
import { styled } from 'nativewind';
import { X } from 'lucide-react-native';
import * as Clipboard from 'expo-clipboard';
import hapticsManager from '../../lib/hapticsManager';
import soundManager from '../../lib/soundManager';
import { shareGameResult } from '../../lib/share';
import { useToast } from '../../contexts/ToastContext';

// Imports updated to WebP
// import StatsHamster from '../../assets/Maths-Hamster-Green.svg'; 
// import WinBlueHamster from '../../assets/Win-Hamster-Blue.svg';
// import ArchiveHamster from '../../assets/Librarian-Hamster-Yellow.svg';

import { ThemedText } from '../../components/ThemedText';

import { ConfettiOverlay } from './ConfettiOverlay';
import { RainOverlay } from './RainOverlay';

// Updated Image Assets (Transparent UI versions)
const WinHamsterImg = require('../../assets/ui/Celebration-Hamster-Grey.png');
const LoseHamsterImg = require('../../assets/ui/Commiseration-Hamster-Grey.png');
const ShareHamsterImg = require('../../assets/ui/Login-Hamster-White.png');
const StatsHamsterImg = require('../../assets/ui/webp_assets/Maths-Hamster.webp');
const HomeHamsterImg = require('../../assets/ui/webp_assets/Historian-Hamster.webp');
const ArchiveHamsterImg = require('../../assets/ui/webp_assets/Librarian-Hamster-Yellow.webp');

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
    gameMode?: 'REGION' | 'USER';
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
    awardedBadges = [],
    gameMode = 'REGION'
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

            // Trigger haptics and sound for win/loss
            if (isWin) {
                hapticsManager.success();
                soundManager.play('game_win');
            } else {
                hapticsManager.warning();
                soundManager.play('game_lose');
            }

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
                    <View className="flex-1 items-center w-full z-10">

                        {/* Overlays - Positioned Absolutely within the modal content area if possible, or relative to this container */}
                        {isWin && <ConfettiOverlay />}
                        {!isWin && <RainOverlay />}

                        {/* Header: Congratulations */}
                        <StyledView className="items-center mb-6 relative w-full z-20">
                            <ThemedText size="3xl" className="font-bold text-center">
                                {isWin ? "Congratulations!" : "Unlucky!"}
                            </ThemedText>
                        </StyledView>

                        {/* Hamster Image (Centred) */}
                        <StyledView className="items-center mb-6 z-20 h-48 justify-center">
                            <Animated.View style={{ opacity: fadeAnim, transform: [{ scale: fadeAnim }] }}>
                                <StyledImage
                                    source={isWin ? WinHamsterImg : LoseHamsterImg}
                                    className="w-56 h-56"
                                    resizeMode="contain"
                                />
                            </Animated.View>
                        </StyledView>

                        {/* Date */}
                        <StyledView className="items-center mb-4 z-20">
                            <ThemedText size="2xl" className="font-bold text-center opacity-80">
                                {formattedDate}
                            </ThemedText>
                        </StyledView>

                        {/* Description Box */}
                        <StyledView className="bg-slate-100 dark:bg-slate-800 p-4 rounded-2xl w-full mb-4 border border-slate-200 dark:border-slate-700 z-20">
                            <ThemedText size="lg" className="font-semibold text-center mb-2">
                                {eventTitle}
                            </ThemedText>
                            <ThemedText size="sm" className="text-center opacity-60">
                                {eventDescription || "A historic day to remember!"}
                            </ThemedText>
                        </StyledView>

                        {isWin && (
                            <ThemedText size="sm" className="text-center font-medium mb-4 opacity-60 z-20">
                                You solved it in {guessesCount} {guessesCount === 1 ? 'guess' : 'guesses'}!
                            </ThemedText>
                        )}
                    </View>

                    {/* Buttons Stack (Bottom Fixed) */}
                    <StyledView className="w-full space-y-3 mb-4 z-20">
                        {/* Stats Button (Green) */}
                        <StyledTouchableOpacity
                            className="w-full h-20 flex-row items-center justify-between px-6 rounded-3xl shadow-sm active:opacity-90"
                            style={{ backgroundColor: statsColor }}
                            onPress={onViewStats}
                        >
                            <ThemedText size="xl" className="font-n-bold text-slate-800" style={{ color: '#1e293b' }}>Stats</ThemedText>
                            <View className="w-16 h-16 justify-center items-center">
                                <StyledImage
                                    source={StatsHamsterImg}
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
                                <ThemedText size="xl" className="font-n-bold text-slate-800" style={{ color: '#1e293b' }}>Home</ThemedText>
                                <View className="w-12 h-12 justify-center items-center">
                                    <StyledImage
                                        source={HomeHamsterImg}
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
                                <ThemedText size="xl" className="font-n-bold text-slate-800" style={{ color: '#1e293b' }}>Archive</ThemedText>
                                <View className="w-12 h-12 justify-center items-center">
                                    <StyledImage
                                        source={ArchiveHamsterImg}
                                        className="w-12 h-12"
                                        resizeMode="contain"
                                    />
                                </View>
                            </StyledTouchableOpacity>
                        </StyledView>

                        {/* Share Button (Purple) - Added Per Request */}
                        <StyledTouchableOpacity
                            className="w-full h-20 flex-row items-center justify-between px-6 rounded-3xl shadow-sm active:opacity-90 mt-2"
                            style={{ backgroundColor: '#e879f9' }}
                            onPress={() => shareGameResult({
                                result: isWin ? 'won' : 'lost',
                                guesses: guessesCount,
                                date: answerDateCanonical,
                                eventTitle,
                                mode: isLocalMode ? 'USER' : 'REGION'
                            })}
                        >
                            <ThemedText size="xl" className="font-n-bold text-slate-800" style={{ color: '#1e293b' }}>Share</ThemedText>
                            <View className="w-16 h-16 justify-center items-center">
                                <StyledImage
                                    source={ShareHamsterImg}
                                    className="w-14 h-14"
                                    resizeMode="contain"
                                />
                            </View>
                        </StyledTouchableOpacity>

                    </StyledView>

                </StyledView>
            </Animated.View>
        </Modal>
    );
}

