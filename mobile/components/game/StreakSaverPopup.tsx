import React, { useState, useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, Image, Animated, Alert } from 'react-native';
import { styled } from 'nativewind';
import { Flame, X } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useStreakSaverStatus } from '../../hooks/useStreakSaverStatus';
import { useStreakSaver } from '../../contexts/StreakSaverContext';
import { useToast } from '../../contexts/ToastContext';
import { useSubscription } from '../../hooks/useSubscription';
import hapticsManager from '../../lib/hapticsManager';
import soundManager from '../../lib/soundManager';
import { HolidayActivationModal } from './HolidayActivationModal';

const StyledView = styled(View);
const StyledText = styled(Text);
const StyledTouchableOpacity = styled(TouchableOpacity);

export type StreakSaverCloseAction = 'use_streak_saver' | 'decline' | 'holiday' | 'dismiss';

interface StreakSaverPopupProps {
    visible: boolean;
    onClose: (action?: StreakSaverCloseAction) => void;
    gameType: 'REGION' | 'USER';
    currentStreak: number;
    showCloseButton?: boolean;
}

export function StreakSaverPopup({
    visible,
    onClose,
    gameType,
    currentStreak,
    showCloseButton = false
}: StreakSaverPopupProps) {
    const router = useRouter();
    const { toast } = useToast();
    const { startStreakSaverSession } = useStreakSaver();
    const { isPro } = useSubscription(); // Direct sub check
    const {
        regionStreakSaversRemaining,
        userStreakSaversRemaining,
        regionOfferStreakSaver,
        userOfferStreakSaver,
        holidaysRemaining,
        holidayDurationDays,
        hasAnyValidStreakForHoliday,
        declineStreakSaver,
        startHoliday,
        regionCanUseStreakSaver,
        userCanUseStreakSaver,
    } = useStreakSaverStatus();

    const streakSaversRemaining = gameType === 'REGION' ? regionStreakSaversRemaining : userStreakSaversRemaining;
    const hasStreakSaversLeft = streakSaversRemaining > 0;

    // Eligibility acts as the gate for the "Streak Saver" view mode
    const isEligibleForStreakSaver = gameType === 'REGION' ? regionOfferStreakSaver : userOfferStreakSaver;
    const showStreakSaverButton = isEligibleForStreakSaver;

    const gameModeLabel = gameType === 'REGION' ? 'Region Edition' : 'Personal';

    // Helper to get formatted next month date (e.g. "1st February")
    const getNextMonthFirst = () => {
        const now = new Date();
        const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
        return nextMonth.toLocaleDateString('en-GB', { day: 'numeric', month: 'long' });
    };

    const nextResetDate = getNextMonthFirst();

    const [pendingNav, setPendingNav] = useState<string | null>(null);
    const fadeAnim = useRef(new Animated.Value(0)).current;

    // Action states
    const [isDeclining, setIsDeclining] = useState(false);
    const [isStartingHoliday, setIsStartingHoliday] = useState(false);
    const [isAnimatingOut, setIsAnimatingOut] = useState(false);
    const [animationVisible, setAnimationVisible] = useState(false);
    const [filledDates, setFilledDates] = useState<string[]>([]);

    // Helper to handle post-interaction navigation and upgrade check
    const completeInteraction = async (action?: StreakSaverCloseAction) => {
        try {
            const pendingUpgrade = await AsyncStorage.getItem('streak_saver_upgrade_pending');
            if (pendingUpgrade === 'true') {
                // Only redirect to category selection if NOT entering a game interaction
                // (Use Saver leads to game flow which shouldn't be interrupted)
                if (action !== 'use_streak_saver') {
                    // Do not remove yet - let CategorySelection consume it
                    // await AsyncStorage.removeItem('streak_saver_upgrade_pending');
                    onClose(action); // Close popup first
                    // Navigate to category selection as this is a fresh pro user
                    setTimeout(() => {
                        router.push('/category-selection');
                    }, 300); // Slight delay to allow modal to close smoothly
                    return;
                }
            }
            onClose(action);
        } catch (e) {
            console.error('Error checking upgrade status:', e);
            onClose(action); // Ensure popup closes even if AsyncStorage fails
        }
    };

    // Effect to handle animation and visibility
    useEffect(() => {
        if (visible) {
            setIsAnimatingOut(false);
            Animated.timing(fadeAnim, {
                toValue: 1,
                duration: 300,
                useNativeDriver: true,
            }).start();
        } else {
            setIsAnimatingOut(true);
            Animated.timing(fadeAnim, {
                toValue: 0,
                duration: 300,
                useNativeDriver: true,
            }).start(() => {
                setIsAnimatingOut(false);
            });
        }
    }, [visible]);

    // Effect to handle navigation after modal closes
    useEffect(() => {
        if (!visible && pendingNav) {
            const timer = setTimeout(() => {
                router.push(pendingNav);
                setPendingNav(null);
            }, 450);
            return () => clearTimeout(timer);
        }
    }, [visible, pendingNav]);

    const handleUseStreakSaver = async () => {
        if (!hasStreakSaversLeft) {
            hapticsManager.warning();
            return;
        }

        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toISOString().split('T')[0];

        // Start session context update
        await startStreakSaverSession(gameType, yesterdayStr, currentStreak);

        hapticsManager.success();
        soundManager.play('tap');

        // We want to navigate to the game, but also check if we need to redirect for setup
        // Actually, if they use a saver, they are playing the game.
        // If they use a saver, they proceed to play. The category selection might disturb that?
        // User said: "After whichever route they choose has concluded... then the user should be taken to the category-selection page"
        // If they choose "Use Streak Saver", the route concludes when they play the game?
        // Or "StreakSaverPopup interaction has concluded"?
        // If they play the game, they are in `ActiveGame`.
        // If they just upgraded, maybe we should let them play the streak saver game, THEN go to category selection?
        // Navigating to `pendingNav` (game) effectively closes the popup.

        // Let's assume for "Use Streak Saver", the immediate action is entering the game.
        // If we redirect to category selection, they can't play the game yet.
        // Maybe we just let them play?
        // Or is "category selection" required for the game? Assuming "streak saver" game relies on old settings or is fixed?

        // However, the `startStreakSaverSession` sets context.
        // `pendingNav` is `/game/...`.
        // If we have a pending upgrade, maybe we should NOT interrupt the game flow?
        // But the user was explicit: "After whichever route they choose has concluded".
        // "Using a streak saver" -> leads to Game.
        // "Resetting streak" -> leads to Home (popup closes).
        // "Holiday" -> leads to Home (popup closes).

        // If "Use Streak Saver", let's prioritize the Game. The category selection can happen later?
        // Or if they just bought Pro, maybe they need categories?
        // Let's stick to: If they enter the game, we don't redirect yet.
        // Check `completeInteraction` usage:

        setPendingNav(`/game/${gameType}/${yesterdayStr}`);
        completeInteraction('use_streak_saver');
    };

    const handleDecline = async () => {
        setIsDeclining(true);
        try {
            hapticsManager.warning();
            await declineStreakSaver(gameType);
            toast({
                title: 'Streak Reset',
                description: 'Your streak has been reset to 0. Start fresh today!',
                variant: 'default',
            });
            completeInteraction('decline');
        } catch (error: any) {
            hapticsManager.error();
            toast({
                title: 'Error',
                description: error?.message || 'Failed to reset streak',
                variant: 'error',
            });
        } finally {
            setIsDeclining(false);
        }
    };

    const handleStartHoliday = async () => {
        setIsStartingHoliday(true);
        try {
            hapticsManager.success();
            const dates = await startHoliday();
            toast({
                title: 'Holiday Started! 🏖️',
                description: `You're on holiday for ${holidayDurationDays} days. Your streak is protected.`,
                variant: 'success',
            });
            // Show animation - do NOT close popup yet
            setFilledDates(dates || []);
            setAnimationVisible(true);
        } catch (error: any) {
            hapticsManager.error();
            toast({
                title: 'Error',
                description: error?.message || 'Failed to start holiday',
                variant: 'error',
            });
            // If error, we don't close, user can retry or cancel
        } finally {
            setIsStartingHoliday(false);
        }
    };

    const handleGetMoreSavers = () => {
        hapticsManager.medium();
        router.push({ pathname: '/subscription', params: { from: 'streakSaver' } });
    };

    // New logic for Standard users asking for Holiday validation/redirect
    const handleGetHolidayAllowance = () => {
        hapticsManager.medium();
        router.push({ pathname: '/subscription', params: { from: 'streakSaver' } });
    }

    if (!visible && !pendingNav && !isAnimatingOut) return null;

    const bgColor = gameType === 'REGION' ? '#FFD429' : '#fdab58';

    return (
        <Animated.View
            style={[
                {
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    zIndex: 9999,
                    backgroundColor: 'rgba(0,0,0,0.7)',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: 24,
                    opacity: fadeAnim
                }
            ]}
            pointerEvents="auto"
        >
            <StyledView
                className="rounded-2xl p-6 w-full max-w-sm shadow-2xl"
                style={{ backgroundColor: bgColor }}
            >
                {/* Header */}
                <StyledView className="flex-row items-center justify-center gap-2 mb-2 relative">
                    <Flame size={24} color="#ef4444" />
                    <StyledText className="text-2xl font-n-bold text-slate-900">
                        {showStreakSaverButton ? 'Save Your Streak?' : 'Protect Your Streak?'}
                    </StyledText>

                    {showCloseButton && (
                        <StyledTouchableOpacity
                            onPress={() => onClose('dismiss')}
                            className="absolute -right-2 -top-2 p-2 bg-white/20 rounded-full"
                        >
                            <X size={20} color="#1e293b" />
                        </StyledTouchableOpacity>
                    )}
                </StyledView>

                {/* Description */}
                <StyledText className="text-center text-slate-700 font-n-medium mb-6">
                    {showStreakSaverButton
                        ? `You missed yesterday's ${gameModeLabel} puzzle!`
                        : `You've been away for multiple days. Use holiday mode to protect your streak, or let it reset.`
                    }
                </StyledText>

                {/* Hamster Image */}
                <StyledView className="items-center mb-6">
                    <StyledView className="w-40 h-40 items-center justify-center mb-2">
                        <Image
                            source={require('../../assets/ui/webp_assets/Streak-Hamster-Black.webp')}
                            style={{ width: 150, height: 150 }}
                            resizeMode="contain"
                        />
                    </StyledView>

                    <StyledText className="text-3xl font-n-bold text-slate-900">
                        {currentStreak} Day Streak
                    </StyledText>
                    <StyledText className="text-sm text-slate-700 font-n-medium mt-2">
                        {showStreakSaverButton
                            ? (hasStreakSaversLeft
                                ? `You have ${streakSaversRemaining} streak saver${streakSaversRemaining > 1 ? 's' : ''} remaining this month`
                                : "You've used all your streak savers this month")
                            : (isPro
                                ? `You have ${holidaysRemaining} holiday${holidaysRemaining !== 1 ? 's' : ''} remaining this year`
                                : "Upgrade to Pro to access holiday protection")
                        }
                    </StyledText>
                </StyledView>

                {/* Action Buttons */}
                <StyledView className="gap-3">
                    {/* Use Streak Saver Button */}
                    {showStreakSaverButton && (
                        hasStreakSaversLeft ? (
                            <StyledTouchableOpacity
                                onPress={handleUseStreakSaver}
                                className="bg-black active:bg-slate-800 py-3 rounded-2xl"
                            >
                                <StyledText className="text-white font-n-bold text-center text-lg">
                                    Use streak saver
                                </StyledText>
                            </StyledTouchableOpacity>
                        ) : (
                            isPro ? (
                                // PRO User: Show Reset Date (Inactive)
                                <StyledView className="bg-black py-3 rounded-2xl opacity-40">
                                    <StyledText className="text-white font-n-bold text-center text-lg">
                                        Streak saver allowance resets on {nextResetDate}
                                    </StyledText>
                                </StyledView>
                            ) : (
                                // STANDARD User: Show Get More (Active)
                                <StyledTouchableOpacity
                                    onPress={handleGetMoreSavers}
                                    className="bg-gradient-to-r from-orange-400 to-amber-500 py-3 rounded-2xl"
                                    style={{ backgroundColor: '#fb923c' }}
                                >
                                    <StyledText className="text-white font-n-bold text-center text-lg">
                                        Get more streak savers
                                    </StyledText>
                                </StyledTouchableOpacity>
                            )
                        )
                    )}

                    {/* Holiday Mode Button (Pro: Action / Standard: Upsell) */}
                    <StyledTouchableOpacity
                        onPress={isPro ? handleStartHoliday : handleGetHolidayAllowance}
                        disabled={isPro && (isStartingHoliday || holidaysRemaining <= 0 || !hasAnyValidStreakForHoliday)}
                        className={`py-3 rounded-2xl ${!isPro
                            ? 'bg-indigo-500 active:bg-indigo-600'
                            : (holidaysRemaining > 0 && hasAnyValidStreakForHoliday)
                                ? 'bg-blue-400 active:bg-blue-500'
                                : 'bg-slate-400 opacity-60'
                            }`}
                    >
                        <StyledText className="text-white font-n-bold text-center text-lg">
                            {isPro
                                ? (isStartingHoliday
                                    ? 'Starting...'
                                    : !hasAnyValidStreakForHoliday
                                        ? 'No streak to protect'
                                        : holidaysRemaining <= 0
                                            ? 'No holidays remaining'
                                            : `Go on holiday (up to ${holidayDurationDays} days)`)
                                : 'Get a holiday allowance'
                            }
                        </StyledText>
                    </StyledTouchableOpacity>

                    {/* Decline / Let Streak Reset */}
                    <StyledTouchableOpacity
                        onPress={handleDecline}
                        disabled={isDeclining}
                        className="bg-white active:bg-slate-100 py-3 rounded-2xl"
                    >
                        <StyledText className="text-slate-700 font-n-bold text-center text-lg">
                            {isDeclining ? 'Resetting...' : 'Let streak reset'}
                        </StyledText>
                    </StyledTouchableOpacity>
                </StyledView>
            </StyledView>

            <HolidayActivationModal
                visible={animationVisible}
                filledDates={filledDates}
                gameType={gameType}
                onClose={() => {
                    setAnimationVisible(false);
                    completeInteraction('holiday');
                }}
            />
        </Animated.View>
    );
}

