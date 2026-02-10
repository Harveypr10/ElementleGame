import React from 'react';
import { View, Text, TouchableOpacity, Modal } from 'react-native';
import { styled } from 'nativewind';
import { Heart, Unlock } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import hapticsManager from '../../lib/hapticsManager';

const StyledView = styled(View);
const StyledText = styled(Text);
const StyledTouchableOpacity = styled(TouchableOpacity);

interface WinBackModalProps {
    visible: boolean;
    onDismiss: () => void;
    onResubscribed: () => void;
    /** Future: pass a special win-back offering ID for discounted re-subscription */
    offeringId?: string;
}

/**
 * Modal shown to users whose Pro subscription expired within the last 24 hours.
 * Encourages re-subscription by navigating to the subscription page.
 *
 * NOTE: We navigate to the subscription route instead of importing Paywall
 * directly to avoid a require cycle (WinBackModal → Paywall → lib/auth →
 * guestMigration → _layout → WinBackModal).
 */
export function WinBackModal({
    visible,
    onDismiss,
    onResubscribed,
    offeringId,
}: WinBackModalProps) {
    const router = useRouter();

    const handleGetPro = () => {
        hapticsManager.success();
        onDismiss();
        // Navigate to subscription page — avoids importing Paywall directly
        router.push('/subscription');
    };

    const handleDismiss = () => {
        hapticsManager.light();
        onDismiss();
    };

    return (
        <Modal
            visible={visible}
            transparent
            animationType="fade"
            onRequestClose={handleDismiss}
        >
            <StyledView className="flex-1 bg-black/70 items-center justify-center p-6">
                <StyledView className="bg-white dark:bg-slate-800 rounded-2xl p-6 w-full max-w-sm">
                    {/* Icon */}
                    <StyledView className="items-center mb-4">
                        <StyledView
                            className="p-4 rounded-full mb-3"
                            style={{ backgroundColor: '#ede9fe' }}
                        >
                            <Heart size={32} color="#8b5cf6" />
                        </StyledView>

                        <StyledText className="text-2xl font-n-bold text-center text-slate-900 dark:text-white">
                            We Miss You!
                        </StyledText>
                    </StyledView>

                    {/* Message */}
                    <StyledText className="text-center text-slate-600 dark:text-slate-400 font-n-medium mb-2">
                        Your Pro subscription has ended.
                    </StyledText>
                    <StyledText className="text-center text-slate-500 dark:text-slate-400 font-n-regular mb-6 text-sm">
                        Re-subscribe now to unlock your full puzzle history, streak savers, holiday mode, and ad-free experience.
                    </StyledText>

                    {/* Benefits lost */}
                    <StyledView className="bg-slate-50 dark:bg-slate-700/50 rounded-xl p-4 mb-6">
                        <StyledView className="flex-row items-center gap-3 mb-2">
                            <Unlock size={18} color="#8b5cf6" />
                            <StyledText className="flex-1 text-slate-700 dark:text-slate-300 font-n-medium text-sm">
                                Streak savers & holiday mode
                            </StyledText>
                        </StyledView>
                        <StyledView className="flex-row items-center gap-3 mb-2">
                            <Unlock size={18} color="#8b5cf6" />
                            <StyledText className="flex-1 text-slate-700 dark:text-slate-300 font-n-medium text-sm">
                                Ad-free puzzle experience
                            </StyledText>
                        </StyledView>
                        <StyledView className="flex-row items-center gap-3">
                            <Unlock size={18} color="#8b5cf6" />
                            <StyledText className="flex-1 text-slate-700 dark:text-slate-300 font-n-medium text-sm">
                                Full puzzle archive access
                            </StyledText>
                        </StyledView>
                    </StyledView>

                    {/* Actions */}
                    <StyledView className="gap-3">
                        <StyledTouchableOpacity
                            onPress={handleGetPro}
                            className="bg-purple-500 active:bg-purple-600 py-4 rounded-xl items-center"
                        >
                            <StyledText className="text-white font-n-bold text-lg">
                                Get Elementle Pro
                            </StyledText>
                        </StyledTouchableOpacity>

                        <StyledTouchableOpacity
                            onPress={handleDismiss}
                            className="py-3"
                        >
                            <StyledText className="text-slate-500 dark:text-slate-400 font-n-medium text-center">
                                No Thanks
                            </StyledText>
                        </StyledTouchableOpacity>
                    </StyledView>
                </StyledView>
            </StyledView>
        </Modal>
    );
}
