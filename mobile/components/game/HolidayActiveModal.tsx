import React from 'react';
import { View, Text, TouchableOpacity, Modal } from 'react-native';
import { BlurView } from 'expo-blur';
import Animated, { FadeIn, ZoomIn } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';

interface HolidayActiveModalProps {
    visible: boolean;
    holidayEndDate: string; // "Wednesday 11 February" format
    onExitHoliday: () => void;
    onContinueHoliday: () => void;
}

export const HolidayActiveModal = ({
    visible,
    holidayEndDate,
    onExitHoliday,
    onContinueHoliday
}: HolidayActiveModalProps) => {

    if (!visible) return null;

    return (
        <Modal transparent animationType="fade" visible={visible}>
            <View className="flex-1 justify-center items-center bg-black/60 px-6">
                <Animated.View
                    entering={ZoomIn.duration(300)}
                    className="w-full bg-white rounded-3xl p-6 items-center shadow-xl"
                    style={{ maxWidth: 360 }}
                >
                    {/* Icon */}
                    <View className="mb-4">
                        <View className="flex-row items-center gap-2">
                            <Ionicons name="umbrella-outline" size={24} color="#EAB308" />
                            <Text className="text-xl font-bold text-gray-800">
                                Holiday Mode Active
                            </Text>
                        </View>
                    </View>

                    {/* Body Text */}
                    <Text className="text-base text-slate-600 text-center mb-4 leading-6">
                        Playing today won't extend your streak unless you exit holiday mode.
                    </Text>

                    <Text className="text-base text-slate-800 text-center font-medium mb-4">
                        Holiday runs until {holidayEndDate}
                    </Text>

                    <Text className="text-sm text-slate-500 text-center mb-8">
                        Choose how you'd like to continue:
                    </Text>

                    {/* Buttons */}
                    <View className="w-full gap-3">
                        <TouchableOpacity
                            onPress={onExitHoliday}
                            className="w-full py-3.5 border border-slate-300 rounded-full active:bg-slate-50"
                        >
                            <Text className="text-blue-500 text-center font-semibold text-base">
                                Exit Holiday Mode
                            </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            onPress={onContinueHoliday}
                            className="w-full py-3.5 bg-blue-400 rounded-full shadow-sm active:bg-blue-500"
                        >
                            <Text className="text-white text-center font-bold text-base">
                                Continue in Holiday Mode
                            </Text>
                        </TouchableOpacity>
                    </View>

                </Animated.View>
            </View>
        </Modal>
    );
};
