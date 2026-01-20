import React from 'react';
import { View, Text, TouchableOpacity, Modal } from 'react-native';
import { styled } from 'nativewind';
import { Sparkles, TrendingUp, Award } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import hapticsManager from '../lib/hapticsManager';
import { useConversionPrompt } from '../contexts/ConversionPromptContext';

const StyledView = styled(View);
const StyledText = styled(Text);
const StyledTouchableOpacity = styled(TouchableOpacity);

export function ConversionPromptModal() {
    const router = useRouter();
    const { shouldShowPrompt, dismissPrompt } = useConversionPrompt();

    const handleSignUp = () => {
        hapticsManager.success();
        dismissPrompt();
        router.push('/(auth)/onboarding');
    };

    const handleDismiss = () => {
        hapticsManager.light();
        dismissPrompt();
    };

    return (
        <Modal
            visible={shouldShowPrompt}
            transparent
            animationType="fade"
            onRequestClose={handleDismiss}
        >
            <StyledView className="flex-1 bg-black/70 items-center justify-center p-6">
                <StyledView className="bg-white dark:bg-slate-800 rounded-2xl p-6 w-full max-w-sm">
                    {/* Header */}
                    <StyledView className="items-center mb-4">
                        <StyledView className="bg-gradient-to-br from-blue-500 to-purple-600 p-4 rounded-full mb-3" style={{ backgroundColor: '#3b82f6' }}>
                            <Sparkles size={32} color="#ffffff" />
                        </StyledView>
                        <StyledText className="text-2xl font-n-bold text-center text-slate-900 dark:text-white">
                            Enjoying Elementle?
                        </StyledText>
                    </StyledView>

                    {/* Message */}
                    <StyledText className="text-center text-slate-600 dark:text-slate-400 font-n-medium mb-6">
                        Create a free account to unlock the full experience!
                    </StyledText>

                    {/* Benefits */}
                    <StyledView className="mb-6 space-y-3">
                        <StyledView className="flex-row items-center gap-3">
                            <TrendingUp size={20} color="#3b82f6" />
                            <StyledText className="flex-1 text-slate-700 dark:text-slate-300 font-n-medium">
                                Track your streaks and progress
                            </StyledText>
                        </StyledView>
                        <StyledView className="flex-row items-center gap-3">
                            <Award size={20} color="#3b82f6" />
                            <StyledText className="flex-1 text-slate-700 dark:text-slate-300 font-n-medium">
                                Earn badges and achievements
                            </StyledText>
                        </StyledView>
                        <StyledView className="flex-row items-center gap-3">
                            <Sparkles size={20} color="#3b82f6" />
                            <StyledText className="flex-1 text-slate-700 dark:text-slate-300 font-n-medium">
                                Access the full puzzle archive
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
                            className="py-3"
                        >
                            <StyledText className="text-slate-500 dark:text-slate-400 font-n-medium text-center">
                                Maybe Later
                            </StyledText>
                        </StyledTouchableOpacity>
                    </StyledView>
                </StyledView>
            </StyledView>
        </Modal>
    );
}
