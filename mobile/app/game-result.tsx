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
const StatsHamsterImg = require('../assets/ui/webp_assets/Maths-Hamster.webp');
const HomeHamsterImg = require('../assets/ui/webp_assets/Historian-Hamster.webp');
const ArchiveHamsterImg = require('../assets/ui/webp_assets/Librarian-Hamster-Yellow.webp');
const ShareHamsterImg = require('../assets/ui/webp_assets/Login-Hamster-White.webp');

import { ThemedView } from '../components/ThemedView';
import { ThemedText } from '../components/ThemedText';
import { useThemeColor } from '../hooks/useThemeColor';
import { ConfettiOverlay } from '../components/game/ConfettiOverlay';
import { RainOverlay } from '../components/game/RainOverlay';
import { StreakCelebration } from '../components/game/StreakCelebration';
import { BadgeUnlockModal } from '../components/game/BadgeUnlockModal';
import { useBadgeSystem } from '../hooks/useBadgeSystem';

const StyledView = styled(View);
const StyledText = styled(Text);
const StyledTouchableOpacity = styled(TouchableOpacity);
const StyledImage = styled(Image);

export default function GameResultScreen() {
    const router = useRouter();
    const { textScale, setGameMode } = useOptions();
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
    const isStreakSaverGame = params.isStreakSaverGame === 'true';
    const currentStreak = params.currentStreak ? parseInt(params.currentStreak as string, 10) : 0;

    // console.log('[GameResult] Params:', { currentStreak, isStreakSaverGame, isWin });

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

    // Hooks
    const { pendingBadges, markBadgeAsSeen } = useBadgeSystem();
    // Use streak status to get current streak if not passed, but params is better
    // const { status } = useStreakSaverStatus(); 

    // States for sequencing
    const [streakModalVisible, setStreakModalVisible] = useState(false);
    const [badgeModalVisible, setBadgeModalVisible] = useState(false);
    const [currentBadge, setCurrentBadge] = useState<any>(null); // Using any or Badge type if imported
    const [queueProcessed, setQueueProcessed] = useState(false);

    // Initial Effect: Trigger Streak Celebration if Win AND Streak > 0
    React.useEffect(() => {
        // [FIX] Celebrate if:
        // 1. We have a > 0 streak
        // 2. AND (It is Today's Puzzle OR It is a Streak Saver Game)

        const todayStr = new Date().toISOString().split('T')[0];
        const isToday = answerDateCanonical === todayStr;

        if (isWin && currentStreak > 0 && (isToday || isStreakSaverGame)) {
            console.log('[GameResult] Triggering Streak Celebration (IsToday:', isToday, 'IsSaver:', isStreakSaverGame, ')');
            const timer = setTimeout(() => {
                setStreakModalVisible(true);
            }, 500); // Small delay after enter
            return () => clearTimeout(timer);
        } else {
            console.log('[GameResult] Skipping Streak Celebration (IsToday:', isToday, 'IsSaver:', isStreakSaverGame, ')');
        }
    }, [isWin, currentStreak, answerDateCanonical, isStreakSaverGame]);

    // Handle Streak Close -> Start Badge Queue
    const handleStreakClose = () => {
        setStreakModalVisible(false);
        // Start badge processing
        processNextBadge();
    };

    // Badge Queue Logic
    // We use pendingBadges from the hook which syncs with DB
    React.useEffect(() => {
        // If we haven't started processing queue (waiting for streak close), don't auto-show
        // But we need to react when pendingBadges updates.
        // Also if pendingBadges is initially empty but we just won, we might need to wait for invalidation.
        if (!streakModalVisible && !queueProcessed && isWin) {
            processNextBadge();
        }
    }, [pendingBadges, streakModalVisible, queueProcessed, isWin]);

    const processNextBadge = () => {
        // [FIX] Don't lock queue permanently if empty. Just check current state.
        // We only show one badge at a time.
        // If we are already showing one, or pending is empty, do nothing.

        console.log(`[GameResult] Processing next badge. Visible: ${badgeModalVisible}, Pending: ${pendingBadges?.length}`);

        if (badgeModalVisible) return; // Already showing one

        if (pendingBadges && pendingBadges.length > 0) {
            console.log(`[GameResult] Showing badge: ${pendingBadges[0].badge?.name}`);
            setCurrentBadge(pendingBadges[0].badge);
            setBadgeModalVisible(true);
        } else {
            // Queue is empty (for now). We don't need to "lock" it.
            // If new badges arrive via invalidation, the effect will run again.
            console.log('[GameResult] No (more) badges to show.');
        }
    };

    const handleBadgeClose = async () => {
        if (currentBadge && pendingBadges && pendingBadges.length > 0) {
            // Mark as seen
            // The structure of pendingBadges is UserBadge[] which has badge_id
            // We need to find the correct UserBadge id or just pass badge ID if markBadgeAsSeen takes badgeID
            // Looking at hook: markBadgeAsSeen(badgeId: number)
            // pendingBadges[0] is UserBadge.
            await markBadgeAsSeen(pendingBadges[0].id);
        }
        setBadgeModalVisible(false);
        // Effect will trigger next one if pendingBadges updates? 
        // Actually refetchPending will update pendingBadges
        // But we might need to manually trigger next check or rely on hook update
        // The hook calling markBadgeAsSeen invalidates query, so pendingBadges will update.
    };

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

            <StreakCelebration
                visible={streakModalVisible}
                streak={currentStreak}
                onClose={handleStreakClose}
            />

            <BadgeUnlockModal
                visible={badgeModalVisible}
                badge={currentBadge}
                onClose={handleBadgeClose}
            />

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
                                        onPress={() => {
                                            if (gameMode === 'REGION' || gameMode === 'USER') {
                                                setGameMode(gameMode);
                                            }
                                            router.push('/(tabs)');
                                        }}
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
