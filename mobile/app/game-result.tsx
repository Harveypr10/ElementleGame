import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Share, Image, useWindowDimensions, Platform } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { styled } from 'nativewind';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';
import { useQueryClient } from '@tanstack/react-query';
import { useOptions } from '../lib/options';

// Platform-specific web component
import GameResultScreenWeb from './game-result.web';

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
import { useStreakSaver } from '../contexts/StreakSaverContext';

const StyledView = styled(View);
const StyledText = styled(Text);
const StyledTouchableOpacity = styled(TouchableOpacity);
const StyledImage = styled(Image);

export default function GameResultScreen() {
    // Platform-specific rendering: Web uses dedicated web component
    if (Platform.OS === 'web') {
        return <GameResultScreenWeb />;
    }

    const router = useRouter();
    const queryClient = useQueryClient();
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

    // [FIX] Parse isToday param to correctly identify today's games (since answerDateCanonical is historical)
    const isTodayParam = params.isToday === 'true';

    // [FIX] Parse justFinished param to distinguish between immediate win and viewing history
    const justFinished = params.justFinished === 'true';

    // [FIX] Parse celebrationShown param to prevent duplicate celebrations
    const celebrationShown = params.celebrationShown === 'true';

    // [FIX] Parse passed badges
    const passedBadges = params.earnedBadges ? JSON.parse(params.earnedBadges as string) : [];
    console.log('[GameResult] Params:', { currentStreak, isStreakSaverGame, isWin, passedBadgesCount: passedBadges.length, isToday: isTodayParam });

    // Responsive sizing - only increase on tablet/desktop
    const { width: screenWidth } = useWindowDimensions();
    const isLargeScreen = screenWidth >= 768;

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

    const shareText = isWin
        ? `I solved today's Elementle in ${guessesCount} guesses! Can you beat me? https://elementle.tech/play/${answerDateCanonical}?mode=${gameMode}`
        : `I tried today's Elementle puzzle but couldn't crack it! Can you? https://elementle.tech/play/${answerDateCanonical}?mode=${gameMode}`;

    const surfaceColor = useThemeColor({}, 'surface');
    const borderColor = useThemeColor({}, 'border');
    const backgroundColor = useThemeColor({}, 'background');
    const textColor = useThemeColor({}, 'text');

    // Hooks
    const { pendingBadges, markBadgeAsSeen } = useBadgeSystem();
    const { completeStreakSaverSession } = useStreakSaver();

    // States for sequencing
    const [streakModalVisible, setStreakModalVisible] = useState(false);
    const [badgeModalVisible, setBadgeModalVisible] = useState(false);
    const [currentBadge, setCurrentBadge] = useState<any>(null); // Using any or Badge type if imported
    const [queueProcessed, setQueueProcessed] = useState(false);
    const [visitedBadgeIds, setVisitedBadgeIds] = useState<Set<number>>(new Set());
    const [celebrationTimerComplete, setCelebrationTimerComplete] = useState(false);
    const [celebrationFullyClosed, setCelebrationFullyClosed] = useState(false); // True only after fade-out animation completes
    const celebrationHandledRef = React.useRef(false); // Prevent celebration effect from running multiple times
    const celebrationClosedRef = React.useRef(false); // PERMANENT guard - once true, StreakCelebration never renders again

    // Initial Effect: Trigger Streak Celebration after 2 second delay
    React.useEffect(() => {
        // [FIX] Prevent multiple runs - use ref guard
        if (celebrationHandledRef.current) return;

        // Only show streak celebration if ALL conditions are met:
        // 1. Win
        // 2. Has streak (> 0)
        // 3. (Is Today's Puzzle OR Is yesterday's puzzle with Streak Saver)
        // 4. Just Finished (not viewing historical game)

        if (isWin && currentStreak > 0 && (isTodayParam || isStreakSaverGame) && justFinished) {
            console.log('[GameResult] Setting up Streak Celebration timer (one-time)', {
                isWin,
                currentStreak,
                isTodayParam,
                isStreakSaverGame: params.isStreakSaverGame
            });

            celebrationHandledRef.current = true; // Mark as handled FIRST to prevent re-entry

            const timer = setTimeout(() => {
                console.log('[GameResult] Showing celebration after 2.5s');
                setStreakModalVisible(true);
                setCelebrationTimerComplete(true);
            }, 2500);
            return () => clearTimeout(timer);
        } else {
            // No celebration needed, mark as handled and complete
            celebrationHandledRef.current = true;
            setCelebrationTimerComplete(true);
            console.log('[GameResult] Skipping Streak Celebration', {
                isWin,
                currentStreak,
                isStreakSaverGame: params.isStreakSaverGame,
                justFinished,
                reason: !isWin ? 'Not Win' : currentStreak <= 0 ? 'No Streak' : !justFinished ? 'Not Just Finished' : 'Not Today/Saver'
            });
        }
    }, [isWin, currentStreak, isTodayParam, isStreakSaverGame, justFinished]);

    // Handle Streak Close -> Start Badge Queue
    const handleStreakClose = () => {
        // PERMANENT CLOSE - set ref immediately so component never renders again
        celebrationClosedRef.current = true;

        // Hide celebration via visible prop
        setStreakModalVisible(false);

        // Wait for Modal's fade-out animation to complete before allowing badge processing
        setTimeout(() => {
            console.log('[GameResult] Celebration fully closed, allowing badge processing');
            setCelebrationFullyClosed(true); // This triggers the effects to process badges
        }, 200); // 200ms - quick transition after fade-out
    };

    // Badge Queue Logic
    // We use pendingBadges from the hook which syncs with DB
    React.useEffect(() => {
        // Don't process badges until celebration timer completes (even if no celebration shown)
        if (!celebrationTimerComplete) return;

        // IMPORTANT: Wait for celebration to be fully closed (animation complete)
        // If celebration was shown, wait for celebrationFullyClosed
        // If celebration was skipped (streakModalVisible was never true), proceed immediately
        if (streakModalVisible) return; // Still showing celebration
        if (!celebrationFullyClosed && currentStreak > 0 && isWin && justFinished) {
            // Celebration was/is being shown, wait for it to fully close
            return;
        }

        // If we haven't started processing queue, start now
        if (!queueProcessed && isWin) {
            console.log('[GameResult] Badge queue processing triggered');
            processNextBadge();
        }
    }, [pendingBadges, streakModalVisible, queueProcessed, isWin, celebrationTimerComplete, celebrationFullyClosed, currentStreak, justFinished]);

    // [FIX] Initial load effect for passed badges (Instant Gratification)
    // If we have passed badges, merge them or use them to trigger immediately without waiting for query
    React.useEffect(() => {
        // Don't process badges until celebration timer completes
        if (!celebrationTimerComplete) return;

        // IMPORTANT: Wait for celebration to be fully closed
        if (streakModalVisible) return;
        if (!celebrationFullyClosed && currentStreak > 0 && isWin && justFinished) {
            return; // Wait for celebration to fully close
        }

        // Only trigger if we aren't showing a badge and not waiting for streak
        if (!queueProcessed && isWin && passedBadges.length > 0 && !badgeModalVisible && !currentBadge) {
            // Check if passed badge already visited
            const firstPassed = passedBadges[0];
            if (visitedBadgeIds.has(firstPassed.id)) return;

            // We can trigger the passed badges if pending is empty/loading
            if (!pendingBadges || pendingBadges.length === 0) {
                console.log(`[GameResult] Using passed badges immediately:`, firstPassed.name);
                setCurrentBadge(firstPassed);
                setBadgeModalVisible(true);
            }
        }
    }, [passedBadges, streakModalVisible, queueProcessed, isWin, badgeModalVisible, pendingBadges, currentBadge, visitedBadgeIds, celebrationTimerComplete, celebrationFullyClosed, currentStreak, justFinished]);

    const processNextBadge = () => {
        // [FIX] Don't lock queue permanently if empty. Just check current state.
        // We only show one badge at a time.
        // If we are already showing one, or pending is empty, do nothing.

        console.log(`[GameResult] Processing next badge. Visible: ${badgeModalVisible}, Pending: ${pendingBadges?.length}, Passed: ${passedBadges.length}`);

        if (badgeModalVisible) return; // Already showing one

        // Priority 1: Pending Badges (Server Source of Truth)
        if (pendingBadges && pendingBadges.length > 0) {
            console.log(`[GameResult] Showing badge from Pending: ${pendingBadges[0].badge?.name}`);
            setCurrentBadge(pendingBadges[0].badge);
            setBadgeModalVisible(true);
        }
        // Priority 2: Passed Badges (Instant Gratification Fallback)
        // If server hasn't updated yet, use the badge we calculated locally in ActiveGame
        else if (passedBadges && passedBadges.length > 0) {
            // Find first passed badge that hasn't been shown
            const nextPassed = passedBadges.find((b: any) => !visitedBadgeIds.has(b.id));

            if (nextPassed) {
                console.log(`[GameResult] Showing badge from Passed Params: ${nextPassed.name} (ID: ${nextPassed.id})`);
                setCurrentBadge(nextPassed);
                setBadgeModalVisible(true);
            } else {
                console.log('[GameResult] All passed badges visited.');
            }
        }
        else {
            // Queue is empty (for now). We don't need to "lock" it.
            // If new badges arrive via invalidation, the effect will run again.
            console.log('[GameResult] No (more) badges to show.');
        }
    };

    const handleBadgeClose = async () => {
        // [FIX] Mark as seen regardless of source (Pending or Passed)
        // Ensure currentBadge has an ID (it should be the user_badge id from RPC or Query)
        if (currentBadge && currentBadge.id) {
            console.log(`[GameResult] Closing badge and marking as seen: ${currentBadge.name} (ID: ${currentBadge.id})`);

            // Add to visited set to prevent looping
            setVisitedBadgeIds(prev => new Set(prev).add(currentBadge.id));

            await markBadgeAsSeen(currentBadge.id);
        }

        setBadgeModalVisible(false);
        setCurrentBadge(null); // Clear current so effect can pick up next if any

        // If we processed a passed badge, we might need to manually trigger next check or rely on query invalidation
        // But since we navigate away usually, or query updates, it should be fine.
        // If there are multiple passed badges, we should shift them? 
        // Current logic only takes passedBadges[0]. 
        // If passedBadges > 1, we might miss the second one until pending updates.
        // For now, this fixes the "double play" issue.
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

            {/* Streak Celebration - only rendered if not permanently closed */}
            {!celebrationClosedRef.current && (
                <StreakCelebration
                    visible={streakModalVisible}
                    streak={currentStreak}
                    onClose={handleStreakClose}
                />
            )}

            {/* Debug: Log when we're attempting to render celebration */}
            {celebrationShown && streakModalVisible && (
                <>
                    {console.log('[GameResult] WARNING: streakModalVisible=true but celebrationShown=true - this should not happen!')}
                </>
            )}

            <BadgeUnlockModal
                visible={badgeModalVisible}
                badge={currentBadge}
                onClose={handleBadgeClose}
                gameMode={gameMode === 'USER' ? 'USER' : 'REGION'}
            />

            <SafeAreaView edges={['top', 'bottom']} className="flex-1">
                <StyledView className="flex-1 pt-8 pb-6 justify-between" style={{ alignItems: 'center' }}>
                    {/* Width Constraining Wrapper - 20% wider (580 * 1.2 = 696) */}
                    <View style={{ width: '100%', maxWidth: 696, paddingHorizontal: 24, flex: 1, justifyContent: 'space-between' }}>
                        {/* Scrollable Content */}
                        {/* Scrollable Content - Centered in available space */}
                        {/* Scrollable Content - Centered in available space */}
                        <View className="flex-1 items-center justify-center w-full">
                            {/* Header */}
                            <StyledView className="items-center mb-6">
                                <ThemedText style={{ fontSize: (isLargeScreen ? 36 : 31) * textScale, lineHeight: (isLargeScreen ? 40 : 35) * textScale }} className="font-n-bold text-center">
                                    {isWin ? "Congratulations!" : "Unlucky!"}
                                </ThemedText>
                            </StyledView>

                            {/* Hamster Image - Reduced height with web-safe sizing */}
                            <StyledView className="items-center mb-6 h-40 justify-center">
                                <StyledImage
                                    source={isWin ? WinHamsterImg : LoseHamsterImg}
                                    className={isLargeScreen ? "w-48 h-48" : "w-32 h-32"}
                                    style={{ width: isLargeScreen ? 192 : 128, height: isLargeScreen ? 192 : 128, maxWidth: '100%', maxHeight: 160 }}
                                    resizeMode="contain"
                                />
                            </StyledView>

                            {/* Date */}
                            <StyledView className="items-center mb-4">
                                <ThemedText style={{ fontSize: (isLargeScreen ? 30 : 20) * textScale }} className="font-n-bold text-center opacity-90">
                                    {formattedDate}
                                </ThemedText>
                            </StyledView>

                            {/* Description Box - Light Grey No Border */}
                            <StyledView
                                className="p-4 rounded-2xl w-full mb-4 shadow-sm"
                                style={{ backgroundColor: '#f8fafc' }}
                            >
                                <ThemedText style={{ fontSize: (isLargeScreen ? 27 : 18) * textScale, color: '#0f172a' }} className="font-n-semibold text-center mb-2">
                                    {eventTitle}
                                </ThemedText>
                                <ThemedText style={{ fontSize: (isLargeScreen ? 21 : 14) * textScale, color: '#334155' }} className="text-center opacity-80">
                                    {eventDescription || "A historic day to remember!"}
                                </ThemedText>
                            </StyledView>

                            {/* Guesses text - Reduced margin */}
                            {isWin && (
                                <ThemedText style={{ fontSize: (isLargeScreen ? 24 : 20) * textScale }} className="text-center font-n-medium mb-2 opacity-60">
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
                                    <StyledView style={{ flexDirection: 'row', gap: 12, marginBottom: 12 }}>
                                        {/* Stats Button */}
                                        <StyledTouchableOpacity
                                            className="flex-1 rounded-3xl shadow-sm active:opacity-90"
                                            style={{ backgroundColor: statsColor, height: isLargeScreen ? 94 : 64, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16 }}
                                            onPress={() => router.push(`/stats?mode=${gameMode}`)}
                                        >
                                            <StyledText className="font-n-bold text-slate-800 dark:text-slate-900" style={{ fontSize: isLargeScreen ? 18 * 1.5 : 18 }}>Stats</StyledText>
                                            <View className="w-[60px] h-[60px] justify-center items-center" style={{ width: 60, height: 60, justifyContent: 'center', alignItems: 'center' }}>
                                                <StyledImage
                                                    source={StatsHamsterImg}
                                                    className={isLargeScreen ? "w-full h-full" : "w-12 h-12"}
                                                    style={{ width: isLargeScreen ? 60 : 48, height: isLargeScreen ? 60 : 48, maxWidth: 60, maxHeight: 60 }}
                                                    resizeMode="contain"
                                                />
                                            </View>
                                        </StyledTouchableOpacity>

                                        {/* Share Button */}
                                        <StyledTouchableOpacity
                                            className="flex-1 rounded-3xl shadow-sm active:opacity-90"
                                            style={{ backgroundColor: shareColor, height: isLargeScreen ? 94 : 64, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16 }}
                                            onPress={handleShare}
                                        >
                                            <StyledText className="font-n-bold text-slate-800 dark:text-slate-900" style={{ fontSize: isLargeScreen ? 18 * 1.5 : 18 }}>Share</StyledText>
                                            <View className="w-[60px] h-[60px] justify-center items-center" style={{ width: 60, height: 60, justifyContent: 'center', alignItems: 'center' }}>
                                                <StyledImage
                                                    source={ShareHamsterImg}
                                                    className={isLargeScreen ? "w-full h-full" : "w-12 h-12"}
                                                    style={{ width: isLargeScreen ? 60 : 48, height: isLargeScreen ? 60 : 48, maxWidth: 60, maxHeight: 60 }}
                                                    resizeMode="contain"
                                                />
                                            </View>
                                        </StyledTouchableOpacity>
                                    </StyledView>

                                    {/* Bottom Row: Home and Archive */}
                                    <StyledView style={{ flexDirection: 'row', gap: 12 }}>
                                        {/* Home Button */}
                                        <StyledTouchableOpacity
                                            className="flex-1 rounded-3xl shadow-sm active:opacity-90"
                                            style={{ backgroundColor: homeColor, height: isLargeScreen ? 94 : 64, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16 }}
                                            onPress={() => {
                                                if (gameMode === 'REGION' || gameMode === 'USER') {
                                                    setGameMode(gameMode);
                                                }
                                                // [FIX] Complete streak saver session to allow User popup to show
                                                if (isStreakSaverGame) {
                                                    console.log('[GameResult] Completing streak saver session before Home...');
                                                    completeStreakSaverSession(isWin);
                                                }
                                                // [FIX] Invalidate Streak Saver Status to prevent Phantom Popup on Home
                                                console.log('[GameResult] Invalidating streak saver status before Home...');
                                                queryClient.invalidateQueries({ queryKey: ['streak-saver-status'] });

                                                router.push('/(tabs)');
                                            }}
                                        >
                                            <StyledText className="font-n-bold text-slate-800 dark:text-slate-900" style={{ fontSize: isLargeScreen ? 18 * 1.5 : 18 }}>Home</StyledText>
                                            <View className="w-[60px] h-[60px] justify-center items-center" style={{ width: 60, height: 60, justifyContent: 'center', alignItems: 'center' }}>
                                                <StyledImage
                                                    source={HomeHamsterImg}
                                                    className={isLargeScreen ? "w-full h-full" : "w-12 h-12"}
                                                    style={{ width: isLargeScreen ? 60 : 48, height: isLargeScreen ? 60 : 48, maxWidth: 60, maxHeight: 60 }}
                                                    resizeMode="contain"
                                                />
                                            </View>
                                        </StyledTouchableOpacity>

                                        {/* Archive Button */}
                                        <StyledTouchableOpacity
                                            className="flex-1 rounded-3xl shadow-sm active:opacity-90"
                                            style={{ backgroundColor: archiveColor, height: isLargeScreen ? 94 : 64, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16 }}
                                            onPress={() => router.push({ pathname: '/archive', params: { mode: gameMode } })}
                                        >
                                            <StyledText className="font-n-bold text-slate-800 dark:text-slate-900" style={{ fontSize: isLargeScreen ? 18 * 1.5 : 18 }}>Archive</StyledText>
                                            <View className="w-[60px] h-[60px] justify-center items-center" style={{ width: 60, height: 60, justifyContent: 'center', alignItems: 'center' }}>
                                                <StyledImage
                                                    source={ArchiveHamsterImg}
                                                    className={isLargeScreen ? "w-full h-full" : "w-12 h-12"}
                                                    style={{ width: isLargeScreen ? 60 : 48, height: isLargeScreen ? 60 : 48, maxWidth: 60, maxHeight: 60 }}
                                                    resizeMode="contain"
                                                />
                                            </View>
                                        </StyledTouchableOpacity>
                                    </StyledView>
                                </>
                            )}
                        </StyledView>
                    </View>
                </StyledView>
            </SafeAreaView>
        </ThemedView >
    );
}
