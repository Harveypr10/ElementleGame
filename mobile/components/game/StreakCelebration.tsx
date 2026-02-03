import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Modal, Animated, TouchableOpacity, Image } from 'react-native';
import { styled } from 'nativewind';
import { X } from 'lucide-react-native';
const StreakHamsterImg = require('../../assets/ui/Streak-Hamster-Black.png');

const StyledView = styled(View);
const StyledText = styled(Text);
const StyledTouchableOpacity = styled(TouchableOpacity);
const StyledImage = styled(Image);

interface StreakCelebrationProps {
    visible: boolean;
    streak: number;
    onClose: () => void;
    showCloseButton?: boolean;
    dismissible?: boolean; // If false, prevents manual dismissal by clicking
}

export function StreakCelebration({ visible, streak, onClose, showCloseButton = false, dismissible = true }: StreakCelebrationProps) {
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const [isClosing, setIsClosing] = useState(false);
    const [showModal, setShowModal] = useState(false);

    // Handle visibility changes
    useEffect(() => {
        if (visible && !isClosing) {
            // Opening: show modal and fade in
            setShowModal(true);
            Animated.timing(fadeAnim, {
                toValue: 1,
                duration: 400,
                useNativeDriver: true,
            }).start();
        }
    }, [visible, isClosing]);

    // Auto-dismiss timer with ref to prevent duplicates
    const autoDismissTimerRef = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        if (visible && !isClosing && !autoDismissTimerRef.current) {
            autoDismissTimerRef.current = setTimeout(() => {
                autoDismissTimerRef.current = null;
                handleClose();
            }, 5000);
        }

        return () => {
            if (autoDismissTimerRef.current) {
                clearTimeout(autoDismissTimerRef.current);
                autoDismissTimerRef.current = null;
            }
        };
    }, [visible, isClosing]);

    // Cleanup on unmount - ensure modal is hidden to prevent ghost overlays
    useEffect(() => {
        return () => {
            // Force hide modal when component unmounts
            setShowModal(false);
            setIsClosing(false);
            if (autoDismissTimerRef.current) {
                clearTimeout(autoDismissTimerRef.current);
                autoDismissTimerRef.current = null;
            }
        };
    }, []);

    // Handle close with animation
    const handleClose = () => {
        if (isClosing) return; // Prevent multiple close calls
        setIsClosing(true);

        // Fade out animation
        Animated.timing(fadeAnim, {
            toValue: 0,
            duration: 400,
            useNativeDriver: true,
        }).start(() => {
            // After animation completes, hide modal and call onClose
            setShowModal(false);
            setIsClosing(false);
            onClose();
        });
    };

    // Don't render anything if modal shouldn't be shown
    if (!showModal) return null;

    return (
        <Modal transparent visible={showModal} animationType="none">
            <Animated.View style={{ flex: 1, opacity: fadeAnim }}>
                <StyledTouchableOpacity
                    className="flex-1 bg-black justify-center items-center relative"
                    activeOpacity={1}
                    onPress={dismissible ? handleClose : undefined}
                    disabled={!dismissible || isClosing}
                >
                    {showCloseButton && (
                        <StyledTouchableOpacity
                            onPress={handleClose}
                            className="absolute right-6 top-12 z-50 p-2 bg-white/20 rounded-full"
                            disabled={isClosing}
                        >
                            <X size={24} color="white" />
                        </StyledTouchableOpacity>
                    )}

                    {/* Hamster with Number Overlay */}
                    <View className="relative w-72 h-72 justify-center items-center mb-8">
                        <StyledImage
                            source={StreakHamsterImg}
                            className="w-full h-full"
                            resizeMode="contain"
                        />
                        <View className="absolute inset-x-0 bottom-12 items-center">
                            {/* Dynamic Sizing based on digits */}
                            <StyledText
                                className={`text-red-600 font-black ${streak.toString().length === 1 ? 'text-6xl' : streak.toString().length === 2 ? 'text-5xl' : 'text-4xl'}`}
                                style={{
                                    textShadowColor: 'rgba(255, 255, 255, 0.8)',
                                    textShadowOffset: { width: 0, height: 0 },
                                    textShadowRadius: 10
                                }}>
                                {streak}
                            </StyledText>
                        </View>
                    </View>

                    {/* Text Content */}
                    <StyledView className="items-center mb-12 px-4">
                        <StyledText className="text-white font-black text-3xl mb-3 text-center tracking-wide">
                            {streak === 1 ? "Streak Started!" : "Streak Continues!"}
                        </StyledText>
                        <StyledText className="text-white/80 font-bold text-xl text-center">
                            {streak === 1
                                ? "Keep playing to build your streak!"
                                : `${streak} days in a row! Keep it up!`}
                        </StyledText>
                    </StyledView>

                    {/* Dismiss Text */}
                    <StyledText className="text-white/40 text-sm absolute bottom-12">
                        Click anywhere to dismiss
                    </StyledText>
                </StyledTouchableOpacity>
            </Animated.View>
        </Modal>
    );
}
