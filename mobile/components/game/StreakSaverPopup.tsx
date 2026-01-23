import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Modal, Image } from 'react-native';
import { styled } from 'nativewind';
import { Flame } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useStreakSaverStatus } from '../../hooks/useStreakSaverStatus';
import { useStreakSaver } from '../../contexts/StreakSaverContext';
import { useToast } from '../../contexts/ToastContext';
import hapticsManager from '../../lib/hapticsManager';
import soundManager from '../../lib/soundManager';

const StyledView = styled(View);
const StyledText = styled(Text);
const StyledTouchableOpacity = styled(TouchableOpacity);
import { X } from 'lucide-react-native';

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
    const {
        isPro,
        regionStreakSaversRemaining,
        userStreakSaversRemaining,
        regionCanUseStreakSaver,
        userCanUseStreakSaver,
        holidaysRemaining,
        holidayDurationDays,
        hasAnyValidStreakForHoliday,
        declineStreakSaver,
        isDeclining,
        startHoliday,
        isStartingHoliday,
    } = useStreakSaverStatus();

    const [showProPlaceholder, setShowProPlaceholder] = useState(false);

    const streakSaversRemaining = gameType === 'REGION' ? regionStreakSaversRemaining : userStreakSaversRemaining;
    const hasStreakSaversLeft = streakSaversRemaining > 0;
    const canUseStreakSaverForMode = gameType === 'REGION' ? regionCanUseStreakSaver : userCanUseStreakSaver;
    const showStreakSaverButton = canUseStreakSaverForMode;

    const gameModeLabel = gameType === 'REGION' ? 'Region Edition' : 'Personal';

    const handleUseStreakSaver = () => {
        if (!hasStreakSaversLeft) {
            // Show Pro upgrade placeholder
            setShowProPlaceholder(true);
            hapticsManager.warning();
            return;
        }

        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toISOString().split('T')[0];

        // Start streak saver session
        startStreakSaverSession(gameType, yesterdayStr, currentStreak);

        hapticsManager.success();
        soundManager.play('tap');

        // Navigate to archive with yesterday's date
        router.push(`/archive?mode=${gameType}&date=${yesterdayStr}`);
        onClose('use_streak_saver');
    };

    const handleDecline = async () => {
        try {
            hapticsManager.warning();
            await declineStreakSaver(gameType);

            toast({
                title: 'Streak Reset',
                description: 'Your streak has been reset to 0. Start fresh today!',
                variant: 'default',
            });

            onClose('decline');
        } catch (error: any) {
            hapticsManager.error();
            toast({
                title: 'Error',
                description: error?.message || 'Failed to reset streak',
                variant: 'error',
            });
        }
    };

    const handleStartHoliday = async () => {
        try {
            hapticsManager.success();
            await startHoliday();

            toast({
                title: 'Holiday Started! 🏖️',
                description: `You're on holiday for ${holidayDurationDays} days. Your streak is protected.`,
                variant: 'success',
            });

            onClose('holiday');
        } catch (error: any) {
            hapticsManager.error();
            toast({
                title: 'Error',
                description: error?.message || 'Failed to start holiday',
                variant: 'error',
            });
        }
    };

    const handleGetMoreSavers = () => {
        // PLACEHOLDER: Will be wired to IAP later
        setShowProPlaceholder(true);
        hapticsManager.medium();
    };

    if (!visible) return null;

    // Background color based on game type
    const bgColor = gameType === 'REGION' ? '#FFD429' : '#fdab58';

    // Pro placeholder modal
    if (showProPlaceholder) {
        return (
            <Modal
                visible={true}
                transparent
                animationType="fade"
                onRequestClose={() => setShowProPlaceholder(false)}
            >
                <StyledView className="flex-1 bg-black/70 items-center justify-center p-6">
                    <StyledView className="bg-white dark:bg-slate-800 rounded-2xl p-6 w-full max-w-sm">
                        <StyledText className="text-2xl font-n-bold text-center mb-4 text-slate-900 dark:text-white">
                            🚀 Upgrade to Pro
                        </StyledText>
                        <StyledText className="text-center text-slate-600 dark:text-slate-400 mb-6">
                            Get more streak savers and unlock holiday mode with Pro subscription!
                        </StyledText>
                        <StyledText className="text-sm text-center text-slate-500 dark:text-slate-500 mb-6">
                            💡 In-App Purchase integration coming soon
                        </StyledText>
                        <StyledTouchableOpacity
                            onPress={() => {
                                setShowProPlaceholder(false);
                                hapticsManager.light();
                            }}
                            className="bg-blue-500 active:bg-blue-600 py-4 rounded-xl"
                        >
                            <StyledText className="text-white font-n-bold text-center text-lg">
                                Got It
                            </StyledText>
                        </StyledTouchableOpacity>
                    </StyledView>
                </StyledView>
            </Modal>
        );
    }

    return (
        <Modal
            visible={visible}
            transparent
            animationType="fade"
            onRequestClose={() => onClose('dismiss')}
        >
            <StyledView className="flex-1 bg-black/70 items-center justify-center p-6">
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

                    {/* Hamster Circle */}
                    <StyledView className="items-center mb-6">
                        <StyledView className="w-36 h-36 bg-black rounded-full items-center justify-center mb-4">
                            <StyledText className="text-6xl">🐹</StyledText>
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
                                    className="bg-black active:bg-slate-800 py-4 rounded-xl"
                                >
                                    <StyledText className="text-white font-n-bold text-center text-lg">
                                        Use Streak Saver
                                    </StyledText>
                                </StyledTouchableOpacity>
                            ) : (
                                <StyledTouchableOpacity
                                    onPress={handleGetMoreSavers}
                                    className="bg-gradient-to-r from-orange-400 to-amber-500 py-4 rounded-xl"
                                    style={{ backgroundColor: '#fb923c' }}
                                >
                                    <StyledText className="text-white font-n-bold text-center text-lg">
                                        Get More Streak Savers
                                    </StyledText>
                                </StyledTouchableOpacity>
                            )
                        )}

                        {/* Holiday Mode Button (Pro only) */}
                        {isPro && (
                            <StyledTouchableOpacity
                                onPress={handleStartHoliday}
                                disabled={isStartingHoliday || holidaysRemaining <= 0 || !hasAnyValidStreakForHoliday}
                                className={`py-4 rounded-xl ${holidaysRemaining > 0 && hasAnyValidStreakForHoliday
                                    ? 'bg-blue-400 active:bg-blue-500'
                                    : 'bg-slate-400 opacity-60'
                                    }`}
                            >
                                <StyledText className="text-white font-n-bold text-center text-lg">
                                    {isStartingHoliday
                                        ? 'Starting...'
                                        : !hasAnyValidStreakForHoliday
                                            ? 'No streak to protect'
                                            : holidaysRemaining <= 0
                                                ? 'No Holidays Remaining'
                                                : `Go on Holiday (up to ${holidayDurationDays} days)`
                                    }
                                </StyledText>
                            </StyledTouchableOpacity>
                        )}

                        {/* Decline / Let Streak Reset */}
                        <StyledTouchableOpacity
                            onPress={handleDecline}
                            disabled={isDeclining}
                            className="bg-white active:bg-slate-100 py-4 rounded-xl"
                        >
                            <StyledText className="text-slate-700 font-n-bold text-center text-lg">
                                {isDeclining ? 'Resetting...' : 'Let Streak Reset'}
                            </StyledText>
                        </StyledTouchableOpacity>
                    </StyledView>
                </StyledView>
            </StyledView>
        </Modal>
    );
}
