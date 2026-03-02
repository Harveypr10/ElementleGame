import React, { useEffect, useRef } from 'react';
import { View, Text, Animated, Dimensions, Modal } from 'react-native';
import { Image } from 'expo-image';
import { styled } from 'nativewind';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const StyledView = styled(View);
const StyledText = styled(Text);
const SCREEN_WIDTH = Dimensions.get('window').width;

const WelcomeHamster = require('../../assets/ui/webp_assets/Login-Hamster-White.webp');

interface ReminderSuccessToastProps {
    visible: boolean;
    reminderTime: string; // 'HH:mm' format
    onDismiss: () => void;
}

/**
 * Format 24h time string to localized display format
 * e.g. "11:00" → "11:00 AM", "14:30" → "2:30 PM"
 */
function formatTimeForDisplay(time24: string): string {
    const [hours, minutes] = time24.split(':').map(Number);
    const period = hours >= 12 ? 'PM' : 'AM';
    const displayHour = hours % 12 || 12;
    return `${displayHour}:${minutes.toString().padStart(2, '0')} ${period}`;
}

export function ReminderSuccessToast({ visible, reminderTime, onDismiss }: ReminderSuccessToastProps) {
    const slideAnim = useRef(new Animated.Value(300)).current;
    const insets = useSafeAreaInsets();

    useEffect(() => {
        if (visible) {
            // Slide up
            slideAnim.setValue(300);
            Animated.spring(slideAnim, {
                toValue: 0,
                useNativeDriver: true,
                damping: 20,
                stiffness: 90,
            }).start();

            // Auto-dismiss after 5 seconds
            const timer = setTimeout(() => {
                Animated.timing(slideAnim, {
                    toValue: 400,
                    duration: 300,
                    useNativeDriver: true,
                }).start(() => {
                    onDismiss();
                });
            }, 5000);

            return () => clearTimeout(timer);
        }
    }, [visible]);

    if (!visible) return null;

    const displayTime = formatTimeForDisplay(reminderTime);

    return (
        <Modal
            visible={visible}
            transparent
            animationType="none"
            onRequestClose={onDismiss}
        >
            <View
                style={{
                    flex: 1,
                    justifyContent: 'flex-end',
                }}
                pointerEvents="box-none"
            >
                <Animated.View
                    style={{
                        backgroundColor: '#7DAAE8',
                        transform: [{ translateY: slideAnim }],
                        paddingBottom: insets.bottom + 16,
                    }}
                    className="w-full p-6 pt-5 rounded-t-3xl shadow-2xl items-center"
                >
                    {/* Drag Handle */}
                    <StyledView className="w-12 h-1 mb-4 bg-white/30 rounded-full" />

                    {/* Hamster */}
                    <Image
                        source={WelcomeHamster}
                        style={{ width: 70, height: 70, marginBottom: 12 }}
                        contentFit="contain"
                    />

                    {/* Message */}
                    <StyledText
                        className="text-white font-n-bold text-base text-center leading-6"
                        style={{ maxWidth: 300 }}
                    >
                        Great — Hammie will remind you at {displayTime} each day if you haven't already played.
                    </StyledText>
                    <StyledText
                        className="text-white/80 font-n-medium text-sm text-center mt-2"
                    >
                        You can change this anytime in Options.
                    </StyledText>
                </Animated.View>
            </View>
        </Modal>
    );
}
