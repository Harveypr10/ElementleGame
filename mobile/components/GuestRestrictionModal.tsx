import React from 'react';
import { View, Text, TouchableOpacity, Modal } from 'react-native';
import { styled } from 'nativewind';
import { Lock, Sparkles } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import hapticsManager from '../lib/hapticsManager';

const StyledView = styled(View);
const StyledText = styled(Text);
const StyledTouchableOpacity = styled(TouchableOpacity);

interface GuestRestrictionModalProps {
    visible: boolean;
    onClose: () => void;
    feature: string; // e.g., "Archive", "Stats", "Streak Savers"
    description?: string;
}

export function GuestRestrictionModal({
    visible,
    onClose,
    feature,
    description = 'Sign up to unlock this feature and save your progress!'
}: GuestRestrictionModalProps) {
    const router = useRouter();

    const handleSignUp = () => {
        hapticsManager.medium();
        router.push('/(auth)/onboarding');
        onClose();
    };

    const handleDismiss = () => {
        hapticsManager.light();
        onClose();
    };

    return (
        <Modal
            visible={visible}
            transparent
            animationType="fade"
            onRequestClose={onClose}
        >
            <StyledView className="flex-1 bg-black/70 items-center justify-center p-6">
                <StyledView className="bg-white dark:bg-slate-800 rounded-2xl p-6 w-full max-w-sm">
                    {/* Icon */}
                    <StyledView className="items-center mb-4">
                        <StyledView className="bg-blue-100 dark:bg-blue-900/30 p-4 rounded-full mb-3">
                            <Lock size={32} color="#3b82f6" />
                        </StyledView>
                    </StyledView>
                    <StyledText className="text-2xl font-n-bold text-center text-slate-900 dark:text-white">
                        {feature} Locked
                    </StyledText>

                {/* Description */}
                <StyledText className="text-center text-slate-600 dark:text-slate-400 font-n-medium mb-2">
                    {description}
                </StyledText>

                {/* Benefits */}
                <StyledView className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 mb-6">
                    <StyledView className="flex-row items-start gap-2 mb-2">
                        <Sparkles size={16} color="#3b82f6" className="mt-1" />
                        <StyledText className="flex-1 text-slate-700 dark:text-slate-300 font-n-medium text-sm">
                            Sync your progress across devices
                        </StyledText>
                    </StyledView>
                    <StyledView className="flex-row items-start gap-2 mb-2">
                        <Sparkles size={16} color="#3b82f6" className="mt-1" />
                        <StyledText className="flex-1 text-slate-700 dark:text-slate-300 font-n-medium text-sm">
                            Track your stats and streaks
                        </StyledText>
                    </StyledView>
                    <StyledView className="flex-row items-start gap-2">
                        <Sparkles size={16} color="#3b82f6" className="mt-1" />
                        <StyledText className="flex-1 text-slate-700 dark:text-slate-300 font-n-medium text-sm">
                            Unlock all features including archive
                        </StyledText>
                    </StyledView>
                </StyledView>

                {/* Actions */}
                <StyledView className="gap-3">
                    <StyledTouchableOpacity
                        onPress={handleSignUp}
                        className="bg-blue-500 active:bg-blue-600 py-4 rounded-xl"
                    >
                        <StyledText className="text-white font-n-bold text-center text-lg">
                            Create Free Account
                        </StyledText>
                    </StyledTouchableOpacity>

                    <StyledTouchableOpacity
                        onPress={handleDismiss}
                        className="bg-slate-200 dark:bg-slate-700 active:bg-slate-300 dark:active:bg-slate-600 py-4 rounded-xl"
                    >
                        <StyledText className="text-slate-700 dark:text-slate-300 font-n-bold text-center text-lg">
                            Maybe Later
                        </StyledText>
                    </StyledTouchableOpacity>
                </StyledView>
            </StyledView>
            </StyledView>
        </Modal>
    );
}
