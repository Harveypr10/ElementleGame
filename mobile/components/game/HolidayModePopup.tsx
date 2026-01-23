import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Modal, ScrollView } from 'react-native';
import { useSubscription } from '../../hooks/useSubscription';
import { activateHolidayMode } from '../../lib/supabase-rpc';
import { useAuth } from '../../lib/auth';

import { X } from 'lucide-react-native';

interface HolidayModePopupProps {
    visible: boolean;
    onClose: () => void;
    currentStreak: number;
    gameType: 'REGION' | 'USER';
    showCloseButton?: boolean;
}

export function HolidayModePopup({ visible, onClose, currentStreak, gameType, showCloseButton = false }: HolidayModePopupProps) {
    const { user } = useAuth();
    const { isPro, holidaySavers, holidayDurationDays } = useSubscription();
    const [selectedDays, setSelectedDays] = useState(7);
    const [isActivating, setIsActivating] = useState(false);

    const handleActivate = async () => {
        if (!user || !isPro) return;

        setIsActivating(true);
        try {
            await activateHolidayMode(user.id, selectedDays);
            onClose();
            // TODO: Show success message and refetch streak status
        } catch (error) {
            console.error('[HolidayMode] Failed to activate:', error);
            // TODO: Show error message
        } finally {
            setIsActivating(false);
        }
    };

    if (!visible || !isPro) return null;

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
                    <View className="relative mb-2">
                        <Text className="text-2xl font-bold text-center text-gray-900 dark:text-gray-100">
                            Going on Holiday?
                        </Text>
                        {showCloseButton && (
                            <TouchableOpacity
                                onPress={onClose}
                                className="absolute -right-2 -top-2 p-2"
                            >
                                <X size={24} className="text-gray-900 dark:text-gray-100" />
                            </TouchableOpacity>
                        )}
                    </View>

                    {/* Streak info */}
                    <Text className="text-center text-gray-600 dark:text-gray-400 mb-4">
                        Protect your {currentStreak}-day streak
                    </Text>

                    {/* Saver count */}
                    <View className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 mb-4">
                        <Text className="text-center text-blue-900 dark:text-blue-100 font-semibold">
                            {holidaySavers} holiday mode{holidaySavers !== 1 ? 's' : ''} remaining this year
                        </Text>
                        <Text className="text-center text-xs text-blue-700 dark:text-blue-300 mt-1">
                            Pro feature
                        </Text>
                    </View>

                    {/* Explanation */}
                    <Text className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                        Holiday Mode protects your streak while you're away. You won't need to play during this time.
                    </Text>

                    {/* Duration Selector */}
                    <View className="mb-6">
                        <Text className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                            How many days?
                        </Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row">
                            {[3, 7, 10, 14].map((days) => (
                                <TouchableOpacity
                                    key={days}
                                    onPress={() => setSelectedDays(days)}
                                    className={`mr-3 px-6 py-3 rounded-lg ${selectedDays === days
                                        ? 'bg-blue-600'
                                        : 'bg-gray-200 dark:bg-gray-700'
                                        }`}
                                >
                                    <Text
                                        className={`font-semibold ${selectedDays === days
                                            ? 'text-white'
                                            : 'text-gray-700 dark:text-gray-300'
                                            }`}
                                    >
                                        {days} days
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    </View>

                    {/* Actions */}
                    <View className="space-y-3">
                        {holidaySavers > 0 ? (
                            <TouchableOpacity
                                onPress={handleActivate}
                                disabled={isActivating}
                                className={`rounded-lg py-4 px-6 ${isActivating ? 'bg-blue-400' : 'bg-blue-600'
                                    }`}
                            >
                                <Text className="text-white text-center font-semibold text-lg">
                                    {isActivating ? 'Activating...' : `Activate for ${selectedDays} Days`}
                                </Text>
                            </TouchableOpacity>
                        ) : (
                            <View className="bg-gray-200 dark:bg-gray-700 rounded-lg py-4 px-6">
                                <Text className="text-gray-500 dark:text-gray-400 text-center font-semibold text-lg">
                                    No Holiday Modes Left This Year
                                </Text>
                            </View>
                        )}

                        <TouchableOpacity
                            onPress={onClose}
                            className="bg-gray-200 dark:bg-gray-700 rounded-lg py-4 px-6"
                        >
                            <Text className="text-gray-700 dark:text-gray-300 text-center font-semibold">
                                Cancel
                            </Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );
}
