import React from 'react';
import { View, Text, Modal, TouchableOpacity } from 'react-native';
import { Image } from 'expo-image';
import { styled } from 'nativewind';
import { useThemeColor } from '../../hooks/useThemeColor';
import { Palmtree, X } from 'lucide-react-native';
import { useStreakSaverStatus } from '../../hooks/useStreakSaverStatus';

const StyledView = styled(View);
const StyledText = styled(Text);
const StyledTouchableOpacity = styled(TouchableOpacity);

// Use one of the hamsters (e.g., Historian)
const HistorianHamster = require('../../assets/ui/webp_assets/Historian-Hamster.webp');

interface HolidayEndedPopupProps {
    visible: boolean;
    onClose: () => void;
}

export function HolidayEndedPopup({ visible, onClose }: HolidayEndedPopupProps) {
    const { acknowledgeHolidayEnd } = useStreakSaverStatus();

    // Theme colors
    const backgroundColor = useThemeColor({}, 'background');
    const textColor = useThemeColor({}, 'text');

    const handleAcknowledge = async () => {
        try {
            await acknowledgeHolidayEnd();
            onClose();
        } catch (e) {
            console.error('[HolidayEndedPopup] Error acknowledging:', e);
            onClose(); // Close anyway
        }
    };

    return (
        <Modal
            visible={visible}
            transparent
            animationType="fade"
            onRequestClose={onClose}
        >
            <StyledView className="flex-1 bg-black/70 items-center justify-center p-6">
                <StyledView className="bg-white dark:bg-slate-800 rounded-3xl p-0 w-full max-w-sm shadow-xl overflow-hidden">

                    {/* Header Image / Background */}
                    <StyledView className="bg-blue-100 dark:bg-slate-700 h-32 items-center justify-center relative w-full">
                        <StyledView className="absolute inset-0 bg-yellow-400 opacity-20" />
                        <Palmtree size={64} color="#f59e0b" className="opacity-80" />
                        <Image
                            source={HistorianHamster}
                            style={{ width: 80, height: 80, position: 'absolute', bottom: -10 }}
                            contentFit="contain"
                            cachePolicy="disk"
                        />
                    </StyledView>

                    <StyledView className="p-6 pt-8 items-center">
                        <StyledText className="text-2xl font-n-bold text-center text-slate-900 dark:text-white mb-2">
                            Welcome Back!
                        </StyledText>

                        <StyledText className="text-center text-slate-600 dark:text-slate-300 font-n-medium mb-6 leading-6">
                            Your holiday has ended. We kept your streak safe while you were away!
                        </StyledText>

                        <StyledView className="w-full gap-3">
                            <StyledTouchableOpacity
                                onPress={handleAcknowledge}
                                className="bg-blue-500 active:bg-blue-600 py-4 rounded-xl w-full items-center"
                            >
                                <StyledText className="text-white font-n-bold text-lg">
                                    Thanks, Hammie!
                                </StyledText>
                            </StyledTouchableOpacity>
                        </StyledView>
                    </StyledView>
                </StyledView>
            </StyledView>
        </Modal>
    );
}
