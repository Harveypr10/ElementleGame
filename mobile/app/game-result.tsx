import React, { useState, useMemo } from 'react';
import { View, Text, TouchableOpacity, Share, Image, useWindowDimensions, Platform } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { styled } from 'nativewind';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';
import { useQueryClient } from '@tanstack/react-query';
import { Share2 } from 'lucide-react-native';
import { useOptions } from '../lib/options';
import { generateShareText } from '../lib/generateShareText';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';

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
import { useStreakCelebration } from '../contexts/StreakCelebrationContext';

import { useStreakSaver } from '../contexts/StreakSaverContext';
import { ReminderPromptModal } from '../components/game/ReminderPromptModal';
import { ReminderSuccessToast } from '../components/game/ReminderSuccessToast';
import * as NotificationService from '../lib/NotificationService';
import { fetchNotificationData } from '../hooks/useNotificationData';

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
    const {
        textScale, setGameMode, dateFormatOrder,
        reminderEnabled, setReminderEnabled, reminderTime,
        hasPromptedStreak2, setHasPromptedStreak2,
        hasPromptedStreak7, setHasPromptedStreak7,
        neverAskReminder, setNeverAskReminder,
        streakReminderEnabled, streakReminderTime,
    } = useOptions();
    const params = useLocalSearchParams();

    // Parse params
    const isWin = params.isWin === 'true';
    const guessesCount = parseInt(params.guessesCount as string, 10);
    const maxGuesses = parseInt(params.maxGuesses as string, 10);
    const answerDateCanonical = params.answerDateCanonical as string;
    const eventTitle = params.eventTitle as string;
    const eventDescription = params.eventDescription as string;
    const gameMode = params.gameMode as string;
    const puzzleDate = params.puzzleDate as string; // Calendar date for share URL (not the historical answer)
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

    console.log('[GameResult] Params:', { currentStreak, isStreakSaverGame, isWin, isToday: isTodayParam });

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

    const todayDate = new Date().toISOString().split('T')[0];

    // Parse guess feedback for emoji grid
    const parsedFeedback = useMemo(() => {
        try {
            const raw = params.guessFeedback as string;
            if (!raw) return [];
            return JSON.parse(raw) as { state: string; digit: string }[][];
        } catch {
            return [];
        }
    }, [params.guessFeedback]);

    // Reconstruct canonical guess dates from digit rows
    const isMMFirst = dateFormatOrder && dateFormatOrder.startsWith('mm');
    const guessDateCanonicals = useMemo(() => {
        return parsedFeedback.map(row => {
            const digits = row.map(c => c.digit).join('');
            if (digits.length === 8) {
                const p1 = digits.substring(0, 2);
                const p2 = digits.substring(2, 4);
                const yyyy = digits.substring(4, 8);
                const mm = isMMFirst ? p1 : p2;
                const dd = isMMFirst ? p2 : p1;
                return `${yyyy}-${mm}-${dd}`;
            } else if (digits.length === 6) {
                const p1 = digits.substring(0, 2);
                const p2 = digits.substring(2, 4);
                const yy = digits.substring(4, 6);
                const mm = isMMFirst ? p1 : p2;
                const dd = isMMFirst ? p2 : p1;
                const answerCentury = answerDateCanonical.substring(0, 2);
                return `${answerCentury}${yy}-${mm}-${dd}`;
            }
            return '';
        });
    }, [parsedFeedback, answerDateCanonical, isMMFirst]);

    // Edition label
    const edition = gameMode === 'USER' ? 'Personalised' : 'Global';

    // Format short date for share header using PUZZLE date (not historical answer date)
    const puzzleDateObj = new Date(puzzleDate + 'T00:00:00');
    const puzzleDay = puzzleDateObj.getDate();
    const puzzleShortMonth = puzzleDateObj.toLocaleString('default', { month: 'short' });
    const puzzleYear = puzzleDateObj.getFullYear();
    const shareFormattedDate = `${getOrdinal(puzzleDay)} ${puzzleShortMonth} ${puzzleYear}`;

    // Deep link URL
    const deepLinkUrl = gameMode === 'USER'
        ? `https://elementle.tech/play/${todayDate}?mode=USER`
        : `https://elementle.tech/play/${puzzleDate}?mode=REGION`;

    // ---- Share-only streak (does NOT affect celebration logic) ----
    // Async query: fetch current_streak from stats + check if this puzzle is the newest won.
    const { user } = useAuth();
    const [shareStreak, setShareStreak] = useState(0);

    React.useEffect(() => {
        if (!isWin || isGuest || !user) return;

        const fetchShareStreak = async () => {
            try {
                const statsTable = gameMode === 'USER' ? 'user_stats_user' : 'user_stats_region';
                const attemptsTable = gameMode === 'USER' ? 'game_attempts_user' : 'game_attempts_region';
                const allocFK = gameMode === 'USER' ? 'allocated_user_id' : 'allocated_region_id';
                const allocTable = gameMode === 'USER' ? 'questions_allocated_user' : 'questions_allocated_region';

                // 1. Fetch current streak from stats
                const { data: statsData } = await supabase
                    .from(statsTable)
                    .select('current_streak')
                    .eq('user_id', user.id)
                    .maybeSingle();

                const dbStreak = statsData?.current_streak ?? 0;
                if (dbStreak <= 0) {
                    console.log('[GameResult][ShareStreak] No active streak:', dbStreak);
                    return;
                }

                // 2. Find the newest won puzzle date via allocation FK join
                const { data: newestAttempt } = await supabase
                    .from(attemptsTable)
                    .select(`result, ${allocFK}(puzzle_date)`)
                    .eq('user_id', user.id)
                    .eq('result', 'won')
                    .order('completed_at', { ascending: false })
                    .limit(1)
                    .maybeSingle();

                const newestPuzzleDate = (newestAttempt as any)?.[allocFK]?.puzzle_date;
                console.log('[GameResult][ShareStreak] DB check:', { dbStreak, newestPuzzleDate, currentPuzzleDate: puzzleDate });

                if (newestPuzzleDate === puzzleDate) {
                    setShareStreak(dbStreak);
                } else {
                    console.log('[GameResult][ShareStreak] Not newest puzzle, skipping streak');
                }
            } catch (e) {
                console.error('[GameResult][ShareStreak] Error:', e);
            }
        };

        fetchShareStreak();
    }, [isWin, isGuest, gameMode, puzzleDate, user]);

    const showStreak = shareStreak > 0;

    const shareText = useMemo(() => {
        if (parsedFeedback.length > 0) {
            return generateShareText({
                edition,
                formattedDate: shareFormattedDate,
                eventTitle,
                guessFeedback: parsedFeedback,
                guessDateCanonicals,
                answerDateCanonical,
                currentStreak: shareStreak,
                showStreak,
                guessesCount,
                deepLinkUrl,
                isWin,
            });
        }
        // Fallback if no feedback data
        return isWin
            ? `I solved today's Elementle in ${guessesCount} guesses! Can you beat me?\n${deepLinkUrl}`
            : `I tried today's Elementle puzzle but couldn't crack it! Can you?\n${deepLinkUrl}`;
    }, [parsedFeedback, guessDateCanonicals, shareStreak, showStreak, guessesCount, isWin, eventTitle]);

    const surfaceColor = useThemeColor({}, 'surface');
    const borderColor = useThemeColor({}, 'border');
    const backgroundColor = useThemeColor({}, 'background');
    const textColor = useThemeColor({}, 'text');

    // Hooks
    const { completeStreakSaverSession } = useStreakSaver();
    const { scheduleCelebration, onCelebrationClosed } = useStreakCelebration();

    const celebrationHandledRef = React.useRef(false); // Prevent celebration effect from running multiple times

    // Reminder prompt states
    const [reminderPromptVisible, setReminderPromptVisible] = useState(false);
    const [reminderSuccessVisible, setReminderSuccessVisible] = useState(false);
    const reminderPromptHandledRef = React.useRef(false);

    // Initial Effect: Schedule Streak Celebration via root-level context (6 second delay)
    React.useEffect(() => {
        // [FIX] Prevent multiple runs - use ref guard
        if (celebrationHandledRef.current) return;

        // Only show streak celebration if ALL conditions are met:
        // 1. Win
        // 2. Has streak (> 0)
        // 3. (Is Today's Puzzle OR Is yesterday's puzzle with Streak Saver)
        // 4. Just Finished (not viewing historical game)

        if (isWin && currentStreak > 0 && (isTodayParam || isStreakSaverGame) && justFinished) {
            console.log('[GameResult] Scheduling Streak Celebration via context (6s delay)', {
                isWin,
                currentStreak,
                isTodayParam,
                isStreakSaverGame: params.isStreakSaverGame
            });

            celebrationHandledRef.current = true; // Mark as handled FIRST to prevent re-entry

            // Schedule celebration via root-level context — persists across navigation
            scheduleCelebration(currentStreak, 6000);
        } else {
            // No celebration needed, mark as handled
            celebrationHandledRef.current = true;
            console.log('[GameResult] Skipping Streak Celebration', {
                isWin,
                currentStreak,
                isStreakSaverGame: params.isStreakSaverGame,
                justFinished,
                reason: !isWin ? 'Not Win' : currentStreak <= 0 ? 'No Streak' : !justFinished ? 'Not Just Finished' : 'Not Today/Saver'
            });
        }
    }, [isWin, currentStreak, isTodayParam, isStreakSaverGame, justFinished]);

    // Register onCelebrationClosed callback for streak-2 reminder prompt
    React.useEffect(() => {
        if (!justFinished || !isWin) return;

        onCelebrationClosed(() => {
            // Check if we should show reminder prompt after streak-2 celebration
            // Use currentStreak from params (same value passed to scheduleCelebration)
            if (
                currentStreak === 2 &&
                !hasPromptedStreak2 &&
                !neverAskReminder &&
                !reminderEnabled &&
                !reminderPromptHandledRef.current
            ) {
                console.log('[GameResult] Streak 2 celebration closed — showing reminder prompt');
                reminderPromptHandledRef.current = true;
                setReminderPromptVisible(true);
            }
        });
    }, [justFinished, isWin, currentStreak, hasPromptedStreak2, neverAskReminder, reminderEnabled]);

    // Schedule notification on game complete
    React.useEffect(() => {
        if (!justFinished || !isWin) return;
        if (!reminderEnabled && !streakReminderEnabled) return;
        if (!user) return;

        (async () => {
            try {
                const freshData = await fetchNotificationData(user.id);
                await NotificationService.scheduleAll({
                    reminderEnabled,
                    reminderTime: reminderTime || '09:00',
                    streakReminderEnabled,
                    streakReminderTime: streakReminderTime || '20:00',
                }, freshData);
            } catch (err) {
                console.error('[GameResult] Failed to schedule notifications:', err);
            }
        })();
    }, [justFinished, isWin, reminderEnabled, streakReminderEnabled, reminderTime, streakReminderTime, gameMode]);



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

            {/* StreakCelebration is now rendered at root level via StreakCelebrationProvider */}
            {/* Badges are now shown on Home/Stats screen only — no badge logic here */}

            {/* Reminder Prompt Modal (after streak celebration/badge) */}
            <ReminderPromptModal
                visible={reminderPromptVisible}
                onClose={async (action) => {
                    setReminderPromptVisible(false);

                    if (action === 'yes') {
                        const granted = await NotificationService.requestPermissions();
                        if (granted && user) {
                            await setReminderEnabled(true);
                            const freshData = await fetchNotificationData(user.id);
                            await NotificationService.scheduleAll({
                                reminderEnabled: true,
                                reminderTime: reminderTime || '09:00',
                                streakReminderEnabled: true,
                                streakReminderTime: streakReminderTime || '20:00',
                            }, freshData);
                            // Show success toast
                            setTimeout(() => setReminderSuccessVisible(true), 300);
                        }
                    } else if (action === 'not_now') {
                        // Set the appropriate prompted flag
                        if (currentStreak === 2) {
                            await setHasPromptedStreak2(true);
                        } else {
                            await setHasPromptedStreak7(true);
                        }
                    } else if (action === 'never') {
                        await setNeverAskReminder(true);
                    }
                }}
            />

            {/* Reminder Success Toast */}
            <ReminderSuccessToast
                visible={reminderSuccessVisible}
                reminderTime={reminderTime || '11:00'}
                onDismiss={() => setReminderSuccessVisible(false)}
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
                                <ThemedText style={{ fontSize: (isLargeScreen ? 40 : 31) * textScale, lineHeight: (isLargeScreen ? 46 : 35) * textScale }} className="font-n-bold text-center">
                                    {isWin ? "Congratulations!" : "Unlucky!"}
                                </ThemedText>
                            </StyledView>

                            {/* Hamster Image - Reduced height with web-safe sizing */}
                            <StyledView className="items-center mb-6 h-40 justify-center">
                                <StyledImage
                                    source={isWin ? WinHamsterImg : LoseHamsterImg}
                                    className={isLargeScreen ? "w-48 h-48" : "w-32 h-32"}
                                    style={{ width: isLargeScreen ? 211 : 128, height: isLargeScreen ? 211 : 128, maxWidth: '100%', maxHeight: isLargeScreen ? 211 : 160 }}
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
                                <ThemedText style={{ fontSize: (isLargeScreen ? 21 : 14) * textScale, color: '#334155', fontFamily: 'Nunito' }} className="text-center opacity-80">
                                    {eventDescription || "A historic day to remember!"}
                                </ThemedText>
                            </StyledView>

                            {/* Guesses text - Reduced margin */}
                            {isWin && (
                                <ThemedText style={{ fontSize: (isLargeScreen ? 20 : 20) * textScale, marginTop: isLargeScreen ? 12 : 0, marginBottom: isLargeScreen ? 12 : 0 }} className="text-center font-n-medium mb-2 opacity-60">
                                    You solved it in {guessesCount} {guessesCount === 1 ? 'guess' : 'guesses'}!
                                </ThemedText>
                            )}
                        </View>

                        {/* Buttons Stack (Bottom Fixed) - Reduced button heights */}
                        <StyledView className="w-full mb-4">
                            {isGuest ? (
                                <StyledView className="w-full" style={{ alignItems: 'center' }}>
                                    <StyledTouchableOpacity
                                        className="flex-row items-center justify-center px-4 rounded-3xl shadow-sm active:opacity-90"
                                        style={{ backgroundColor: homeColor, height: 60, width: '70%' }}
                                        onPress={() => {
                                            router.replace({
                                                pathname: '/(auth)/login',
                                                params: { fromGuest: '1' },
                                            });
                                        }}
                                    >
                                        <StyledText className="text-xl font-n-bold" style={{ color: '#FFFFFF' }}>Continue</StyledText>
                                    </StyledTouchableOpacity>

                                    <StyledTouchableOpacity
                                        className="flex-row items-center justify-center px-4 rounded-3xl shadow-sm active:opacity-90"
                                        style={{ backgroundColor: shareColor, height: 60, width: '70%', marginTop: 12 }}
                                        onPress={handleShare}
                                    >
                                        <StyledText className="text-xl font-n-bold" style={{ color: '#FFFFFF', marginRight: 8 }}>Share</StyledText>
                                        <Share2 size={22} color="#FFFFFF" />
                                    </StyledTouchableOpacity>
                                </StyledView>
                            ) : (
                                <>
                                    {/* Top Row: Stats and Share */}
                                    <StyledView style={{ flexDirection: 'row', gap: 12, marginBottom: 12 }}>
                                        {/* Stats Button */}
                                        <StyledTouchableOpacity
                                            className="flex-1 rounded-3xl shadow-sm active:opacity-90"
                                            style={{ backgroundColor: statsColor, height: isLargeScreen ? 85 : 64, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: isLargeScreen ? 32 : 16 }}
                                            onPress={() => router.push(`/stats?mode=${gameMode}`)}
                                        >
                                            <StyledText className="font-n-bold text-slate-800 dark:text-slate-900" style={{ fontSize: isLargeScreen ? 24 : 18 }}>Stats</StyledText>
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
                                            style={{ backgroundColor: shareColor, height: isLargeScreen ? 85 : 64, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: isLargeScreen ? 32 : 16 }}
                                            onPress={handleShare}
                                        >
                                            <StyledText className="font-n-bold text-slate-800 dark:text-slate-900" style={{ fontSize: isLargeScreen ? 24 : 18 }}>Share</StyledText>
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
                                            style={{ backgroundColor: homeColor, height: isLargeScreen ? 85 : 64, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: isLargeScreen ? 32 : 16 }}
                                            onPress={async () => {
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

                                                // Pre-write updated game status to cache so Home screen shows
                                                // correct state instantly when it refocuses (no flash of stale data)
                                                if (user?.id) {
                                                    const todayStr = new Date().toISOString().split('T')[0];
                                                    const modeKey = gameMode === 'USER' ? 'user' : 'region';
                                                    await AsyncStorage.setItem(
                                                        `cached_game_status_${modeKey}_${user.id}`,
                                                        JSON.stringify({
                                                            date: todayStr,
                                                            status: isWin ? 'solved' : 'failed',
                                                            guesses: isWin ? guessesCount : 0
                                                        })
                                                    );
                                                }

                                                // Pop back to the existing Home screen (no remount/re-animation)
                                                router.dismissAll();
                                            }}
                                        >
                                            <StyledText className="font-n-bold text-slate-800 dark:text-slate-900" style={{ fontSize: isLargeScreen ? 24 : 18 }}>Home</StyledText>
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
                                            style={{ backgroundColor: archiveColor, height: isLargeScreen ? 85 : 64, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: isLargeScreen ? 32 : 16 }}
                                            onPress={() => router.push({ pathname: '/archive', params: { mode: gameMode, scrollToDate: puzzleDate } })}
                                        >
                                            <StyledText className="font-n-bold text-slate-800 dark:text-slate-900" style={{ fontSize: isLargeScreen ? 24 : 18 }}>Archive</StyledText>
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
