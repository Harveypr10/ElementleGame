import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, Modal, ScrollView, Animated, Easing } from 'react-native';
import { useSubscription } from '../../hooks/useSubscription';
import { activateHolidayMode } from '../../lib/supabase-rpc';
import { useAuth } from '../../lib/auth';
import { styled } from 'nativewind';
import { Palmtree, X, Sparkles, Calendar } from 'lucide-react-native';
import { useThemeColor } from '../../hooks/useThemeColor';

const StyledView = styled(View);
const StyledText = styled(Text);
const StyledTouchableOpacity = styled(TouchableOpacity);

interface HolidayModePopupProps {
    visible: boolean;
    onClose: () => void;
    currentStreak: number;
    gameType: 'REGION' | 'USER';
    showCloseButton?: boolean;
    isRescue?: boolean; // New prop for Rescue context
}

export function HolidayModePopup({ visible, onClose, currentStreak, gameType, showCloseButton = false, isRescue = false }: HolidayModePopupProps) {
    const { user } = useAuth();
    const { isPro, holidaySavers, holidayDurationDays } = useSubscription();
    const [selectedDays, setSelectedDays] = useState(7);
    const [isActivating, setIsActivating] = useState(false);

    // Animation Refs
    const glowAnim = useRef(new Animated.Value(0)).current;

    const backgroundColor = useThemeColor({}, 'background');
    const surfaceColor = useThemeColor({}, 'surface');
    const textColor = useThemeColor({}, 'text');

    useEffect(() => {
        if (visible) {
            Animated.loop(
                Animated.sequence([
                    Animated.timing(glowAnim, {
                        toValue: 1,
                        duration: 1500,
                        easing: Easing.inOut(Easing.ease),
                        useNativeDriver: true,
                    }),
                    Animated.timing(glowAnim, {
                        toValue: 0,
                        duration: 1500,
                        easing: Easing.inOut(Easing.ease),
                        useNativeDriver: true,
                    }),
                ])
            ).start();
        } else {
            glowAnim.setValue(0);
        }
    }, [visible]);

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

    const glowOpacity = glowAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [0.3, 0.8],
    });

    return (
        <Modal
            visible={visible}
            transparent
            animationType="fade"
            onRequestClose={onClose}
        >
            <StyledView className="flex-1 bg-black/70 items-center justify-center p-6">
                <StyledView className="bg-white dark:bg-slate-800 rounded-3xl p-6 w-full max-w-sm shadow-2xl relative overflow-hidden">

                    {/* Decorative Background Icon */}
                    <StyledView className="absolute -right-4 -top-4 opacity-10">
                        <Palmtree size={120} color="#f59e0b" />
                    </StyledView>

                    {/* Header */}
                    <StyledView className="items-center mb-6">
                        <StyledView className="bg-orange-100 dark:bg-orange-900/30 p-4 rounded-full mb-3">
                            <Palmtree size={32} color="#f97316" />
                        </StyledView>
                        <StyledText className="text-2xl font-n-bold text-center text-slate-900 dark:text-white">
                            {isRescue ? "Rescue Your Streak" : "Going on Holiday?"}
                        </StyledText>

                        {showCloseButton && (
                            <StyledTouchableOpacity
                                onPress={onClose}
                                className="absolute -right-2 -top-2 p-2"
                            >
                                <X size={24} className="text-slate-400" />
                            </StyledTouchableOpacity>
                        )}
                    </StyledView>

                    {/* Stats Card */}
                    <StyledView className="bg-slate-50 dark:bg-slate-700/50 rounded-xl p-4 mb-6 border border-slate-100 dark:border-slate-700">
                        <StyledView className="flex-row justify-between items-center mb-2">
                            <StyledText className="text-slate-500 dark:text-slate-400 font-n-medium">Current Streak</StyledText>
                            <StyledText className="text-slate-900 dark:text-white font-n-bold">{currentStreak} Days</StyledText>
                        </StyledView>
                        <StyledView className="flex-row justify-between items-center">
                            <StyledText className="text-slate-500 dark:text-slate-400 font-n-medium">Remaining Modes</StyledText>
                            <StyledText className="text-blue-500 font-n-bold">{holidaySavers}</StyledText>
                        </StyledView>
                    </StyledView>

                    {/* Explanation */}
                    <StyledText className="text-base text-slate-600 dark:text-slate-300 font-n-medium text-center mb-6 leading-6">
                        {isRescue
                            ? "You missed more than 1 day! Activate Holiday Mode now to backfill missed days and save your streak."
                            : "Freeze your streak while you're away! Relax and keep your progress safe."
                        }
                    </StyledText>

                    {/* Duration Selector */}
                    <StyledView className="mb-8">
                        <StyledText className="text-sm font-n-bold text-slate-900 dark:text-white mb-3 ml-1">
                            SELECT DURATION
                        </StyledText>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row -mx-1">
                            {[3, 7, 10, 14].map((days) => (
                                <StyledTouchableOpacity
                                    key={days}
                                    onPress={() => setSelectedDays(days)}
                                    className={`mr-3 px-5 py-3 rounded-xl border-2 ${selectedDays === days
                                        ? 'bg-blue-600 border-blue-600'
                                        : 'bg-transparent border-slate-200 dark:border-slate-600'
                                        }`}
                                >
                                    <StyledText
                                        className={`font-n-bold ${selectedDays === days
                                            ? 'text-white'
                                            : 'text-slate-600 dark:text-slate-400'
                                            }`}
                                    >
                                        {days} Days
                                    </StyledText>
                                </StyledTouchableOpacity>
                            ))}
                        </ScrollView>
                    </StyledView>

                    {/* Actions */}
                    <StyledView className="space-y-3 w-full">
                        {holidaySavers > 0 ? (
                            <StyledView className="relative w-full">
                                {/* Glow Effect */}
                                <Animated.View
                                    style={{
                                        position: 'absolute',
                                        top: -4, left: -4, right: -4, bottom: -4,
                                        backgroundColor: '#3b82f6',
                                        borderRadius: 16,
                                        opacity: glowOpacity,
                                        transform: [{ scale: 1.02 }]
                                    }}
                                />
                                <StyledTouchableOpacity
                                    onPress={handleActivate}
                                    disabled={isActivating}
                                    className={`relative z-10 w-full rounded-xl py-4 flex-row items-center justify-center ${isActivating ? 'bg-blue-500' : 'bg-blue-600'}`}
                                >
                                    <Sparkles size={20} color="white" className="mr-2" />
                                    <StyledText className="text-white text-center font-n-bold text-lg">
                                        {isActivating ? 'Activating...' : `Activate Holiday Mode`}
                                    </StyledText>
                                </StyledTouchableOpacity>
                            </StyledView>
                        ) : (
                            <StyledView className="bg-slate-100 dark:bg-slate-700 rounded-xl py-4 px-6 mb-2">
                                <StyledText className="text-slate-500 dark:text-slate-400 text-center font-n-bold">
                                    No Holiday Modes Left This Year
                                </StyledText>
                            </StyledView>
                        )}

                        <StyledTouchableOpacity
                            onPress={onClose}
                            className="bg-transparent py-4 rounded-xl w-full"
                        >
                            <StyledText className="text-slate-500 dark:text-slate-400 text-center font-n-bold text-base">
                                No thanks
                            </StyledText>
                        </StyledTouchableOpacity>
                    </StyledView>
                </StyledView>
            </StyledView>
        </Modal>
    );
}
