import React from 'react';
import { View, Text, TouchableOpacity, Modal } from 'react-native';
import { Image } from 'expo-image';
import Animated, { FadeIn, ZoomIn } from 'react-native-reanimated';
import { styled } from 'nativewind';
import { Ionicons } from '@expo/vector-icons';

const StyledView = styled(View);
const StyledText = styled(Text);
const StyledTouchableOpacity = styled(TouchableOpacity);

const HolidayHamsterImg = require('../../assets/ui/webp_assets/Holiday-Hamster.webp');

interface HolidayActiveModalProps {
    visible: boolean;
    holidayEndDate: string; // "Wednesday 11 February" format
    onExitHoliday: () => void;
    onContinueHoliday: () => void;
    gameType?: 'REGION' | 'USER';
}

export const HolidayActiveModal = ({
    visible,
    holidayEndDate,
    onExitHoliday,
    onContinueHoliday,
    gameType = 'USER'
}: HolidayActiveModalProps) => {

    if (!visible) return null;

    // Match StreakSaverPopup colors per game type
    const bgColor = gameType === 'REGION' ? '#FFD429' : '#fdab58';

    return (
        <Modal transparent animationType="fade" visible={visible}>
            <View style={{
                flex: 1,
                backgroundColor: 'rgba(0,0,0,0.7)',
                justifyContent: 'center',
                alignItems: 'center',
                paddingHorizontal: 24,
            }}>
                <Animated.View
                    entering={ZoomIn.duration(300)}
                    style={{ width: '100%', maxWidth: 360 }}
                >
                    <StyledView
                        className="rounded-2xl p-6 w-full shadow-2xl items-center"
                        style={{ backgroundColor: bgColor }}
                    >
                        {/* Header */}
                        <StyledView className="flex-row items-center justify-center gap-2 mb-2">
                            <Ionicons name="umbrella-outline" size={24} color="#1e293b" />
                            <StyledText className="text-2xl font-n-bold text-slate-900">
                                Holiday Mode Active
                            </StyledText>
                        </StyledView>

                        {/* Description */}
                        <StyledText className="text-center text-slate-700 font-n-medium mb-4 leading-6">
                            Playing today won't extend your streak unless you exit holiday mode.
                        </StyledText>

                        {/* Holiday Hamster Image */}
                        <StyledView className="items-center mb-4">
                            <Image
                                source={HolidayHamsterImg}
                                style={{ width: 140, height: 140 }}
                                contentFit="contain"
                            />
                        </StyledView>

                        {/* Holiday End Date */}
                        <StyledText className="text-base text-slate-900 text-center font-n-bold mb-2">
                            Holiday runs until {holidayEndDate}
                        </StyledText>

                        <StyledText className="text-sm text-slate-700 text-center font-n-medium mb-6">
                            Choose how you'd like to continue:
                        </StyledText>

                        {/* Buttons - Continue on top (blue), Exit on bottom (white) */}
                        <StyledView className="w-full gap-3">
                            <StyledTouchableOpacity
                                onPress={onContinueHoliday}
                                className="w-full py-3 bg-blue-400 active:bg-blue-500 rounded-2xl"
                            >
                                <StyledText className="text-white font-n-bold text-center text-lg">
                                    Continue in Holiday Mode
                                </StyledText>
                            </StyledTouchableOpacity>

                            <StyledTouchableOpacity
                                onPress={onExitHoliday}
                                className="w-full py-3 bg-white active:bg-slate-100 rounded-2xl"
                            >
                                <StyledText className="text-slate-700 font-n-bold text-center text-lg">
                                    Exit Holiday Mode
                                </StyledText>
                            </StyledTouchableOpacity>
                        </StyledView>

                    </StyledView>
                </Animated.View>
            </View>
        </Modal>
    );
};
