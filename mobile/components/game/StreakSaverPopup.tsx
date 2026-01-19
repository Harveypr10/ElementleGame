import React from 'react';
import { View, Text, TouchableOpacity, Modal } from 'react-native';
import { useRouter } from 'expo-router';
import { useStreakSaverStatus } from '../hooks/useStreakSaverStatus';
import { useStreakSaver } from '../contexts/StreakSaverContext';
import { useSubscription } from '../hooks/useSubscription';

interface StreakSaverPopupProps {
    visible: boolean;
    onClose: () => void;
    gameType: 'REGION' | 'USER';
}

export function StreakSaverPopup({ visible, onClose, gameType }: StreakSaverPopupProps) {
    const router = useRouter();
    const { status } = useStreakSaverStatus();
    const { startStreakSaverSession } = useStreakSaver();
    const { streakSavers, isPro } = useSubscription();

    const currentStatus = gameType === 'REGION' ? status?.region : status?.user;
    const streakSaversUsed = currentStatus?.streakSaversUsedMonth ?? 0;
    const streakSaversRemaining = streakSavers - streakSaversUsed;
    const currentStreak = currentStatus?.currentStreak ?? 0;

    const handleUseStreakSaver = async () => {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toISOString().split('T')[0];

        // Start streak saver session
        startStreakSaverSession(gameType, yesterdayStr, currentStreak);

        // Navigate to yesterday's puzzle in archive
        router.push(`/archive?mode=${gameType}&date=${yesterdayStr}`);
        onClose();
    };

    const handleDecline = () => {
        // User chooses to let streak reset
        onClose();
    };

    if (!visible || !currentStatus?.missedYesterdayFlag) return null;

    return (
        <Modal
            visible={visible}
            transparent
            animationType="fade"
            onRequestClose={onClose}
        >
            <View className="flex-1 bg-black/50 items-center justify-center p-4">
                <View className="bg-white dark:bg-gray-800 rounded-2xl p-6 w-full max-w-sm">
                    {/* Header */}
                    <Text className="text-2xl font-bold text-center mb-2 text-gray-900 dark:text-gray-100">
                        Missed Yesterday's Puzzle!
                    </Text>

                    {/* Streak info */}
                    <Text className="text-center text-gray-600 dark:text-gray-400 mb-4">
                        You had a {currentStreak}-day streak going
                    </Text>

                    {/* Saver count */}
                    <View className="bg-amber-50 dark:bg-amber-900/20 rounded-lg p-4 mb-4">
                        <Text className="text-center text-amber-900 dark:text-amber-100 font-semibold">
                            {streakSaversRemaining} streak saver{streakSaversRemaining !== 1 ? 's' : ''} remaining this month
                        </Text>
                        <Text className="text-center text-xs text-amber-700 dark:text-amber-300 mt-1">
                            {isPro ? 'Pro: 3/month' : 'Standard: 1/month'}
                        </Text>
                    </View>

                    {/* Explanation */}
                    <Text className="text-sm text-gray-600 dark:text-gray-400 text-center mb-6">
                        Play yesterday's puzzle now to save your streak!
                    </Text>

                    {/* Actions */}
                    <View className="space-y-3">
                        {streakSaversRemaining > 0 ? (
                            <TouchableOpacity
                                onPress={handleUseStreakSaver}
                                className="bg-green-600 rounded-lg py-4 px-6"
                            >
                                <Text className="text-white text-center font-semibold text-lg">
                                    Use Streak Saver
                                </Text>
                            </TouchableOpacity>
                        ) : (
                            <View className="bg-gray-200 dark:bg-gray-700 rounded-lg py-4 px-6">
                                <Text className="text-gray-500 dark:text-gray-400 text-center font-semibold text-lg">
                                    No Streak Savers Left
                                </Text>
                                {!isPro && (
                                    <Text className="text-xs text-center text-gray-500 dark:text-gray-400 mt-1">
                                        Upgrade to Pro for 3/month
                                    </Text>
                                )}
                            </View>
                        )}

                        <TouchableOpacity
                            onPress={handleDecline}
                            className="bg-gray-200 dark:bg-gray-700 rounded-lg py-4 px-6"
                        >
                            <Text className="text-gray-700 dark:text-gray-300 text-center font-semibold">
                                Let Streak Reset
                            </Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );
}
