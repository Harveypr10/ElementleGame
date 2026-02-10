import React from 'react';
import { View, Text, TouchableOpacity, Modal, Linking } from 'react-native';
import { styled } from 'nativewind';
import { ShieldAlert, Clock } from 'lucide-react-native';
import hapticsManager from '../../lib/hapticsManager';

const StyledView = styled(View);
const StyledText = styled(Text);
const StyledTouchableOpacity = styled(TouchableOpacity);

interface RenewalReminderModalProps {
    visible: boolean;
    daysRemaining: number;
    managementURL: string | null;
    onDismiss: () => void;
}

/**
 * Modal shown to active Pro users who have turned off auto-renew.
 * Triggered at 10, 3, and 1 days before expiration.
 * "Keep My Streak" opens the App Store / Play Store subscription settings
 * via RevenueCat's managementURL.
 */
export function RenewalReminderModal({
    visible,
    daysRemaining,
    managementURL,
    onDismiss,
}: RenewalReminderModalProps) {

    const handleKeepStreak = async () => {
        hapticsManager.success();
        if (managementURL) {
            await Linking.openURL(managementURL);
        }
        onDismiss();
    };

    const handleDismiss = () => {
        hapticsManager.light();
        onDismiss();
    };

    const urgencyColor = daysRemaining <= 1
        ? '#ef4444'   // red
        : daysRemaining <= 3
            ? '#f97316' // orange
            : '#f59e0b'; // amber

    const urgencyBg = daysRemaining <= 1
        ? '#fef2f2'
        : daysRemaining <= 3
            ? '#fff7ed'
            : '#fffbeb';

    const urgencyDarkBg = daysRemaining <= 1
        ? 'rgba(239,68,68,0.15)'
        : daysRemaining <= 3
            ? 'rgba(249,115,22,0.15)'
            : 'rgba(245,158,11,0.15)';

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
                            style={{ backgroundColor: urgencyBg }}
                        >
                            <ShieldAlert size={32} color={urgencyColor} />
                        </StyledView>

                        <StyledText className="text-2xl font-n-bold text-center text-slate-900 dark:text-white">
                            Don't Lose Your Streak!
                        </StyledText>
                    </StyledView>

                    {/* Countdown */}
                    <StyledView
                        className="rounded-xl p-4 mb-4 items-center"
                        style={{ backgroundColor: urgencyDarkBg }}
                    >
                        <StyledView className="flex-row items-center gap-2 mb-1">
                            <Clock size={18} color={urgencyColor} />
                            <StyledText
                                className="text-lg font-n-bold"
                                style={{ color: urgencyColor }}
                            >
                                {daysRemaining === 1
                                    ? 'Expires Tomorrow'
                                    : `${daysRemaining} Days Remaining`}
                            </StyledText>
                        </StyledView>
                        <StyledText className="text-sm font-n-medium text-center text-slate-600 dark:text-slate-400">
                            Your Pro access is ending soon. Re-enable auto-renew to keep your streak savers, holiday mode, and ad-free experience.
                        </StyledText>
                    </StyledView>

                    {/* Actions */}
                    <StyledView className="gap-3">
                        <StyledTouchableOpacity
                            onPress={handleKeepStreak}
                            className="py-4 rounded-xl items-center"
                            style={{ backgroundColor: urgencyColor }}
                        >
                            <StyledText className="text-white font-n-bold text-lg">
                                Keep My Streak
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
