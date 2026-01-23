import React, { useEffect, useRef } from 'react';
import { View, Text, Modal, Animated, TouchableOpacity, Image } from 'react-native';
import { styled } from 'nativewind';
import { X } from 'lucide-react-native';
const StreakHamsterImg = require('../../assets/hamster.png');

const StyledView = styled(View);
const StyledText = styled(Text);
const StyledTouchableOpacity = styled(TouchableOpacity);
const StyledImage = styled(Image);

interface StreakCelebrationProps {
    visible: boolean;
    streak: number;
    onClose: () => void;
    showCloseButton?: boolean;
}

export function StreakCelebration({ visible, streak, onClose, showCloseButton = false }: StreakCelebrationProps) {
    const fadeAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        if (visible) {
            Animated.timing(fadeAnim, {
                toValue: 1,
                duration: 500,
                useNativeDriver: true,
            }).start();

            // Auto-dismiss after 5 seconds
            const timer = setTimeout(() => {
                onClose();
            }, 5000);
            return () => clearTimeout(timer);
        } else {
            fadeAnim.setValue(0);
        }
    }, [visible, onClose]);

    if (!visible) return null;

    return (
        <Modal transparent visible={visible} animationType="fade">
            <StyledTouchableOpacity
                className="flex-1 bg-black/90 justify-center items-center relative"
                activeOpacity={1}
                onPress={onClose}
            >
                {showCloseButton && (
                    <StyledTouchableOpacity
                        onPress={onClose}
                        className="absolute right-6 top-12 z-50 p-2 bg-white/20 rounded-full"
                    >
                        <X size={24} color="white" />
                    </StyledTouchableOpacity>
                )}
                <Animated.View style={{ opacity: fadeAnim, width: '100%', alignItems: 'center' }}>

                    {/* Hamster with Number Overlay */}
                    <View className="relative w-72 h-72 justify-center items-center mb-8">
                        <StyledImage
                            source={StreakHamsterImg}
                            className="w-full h-full"
                            resizeMode="contain"
                        />
                        <View className="absolute inset-0 justify-center items-center pt-16">
                            <StyledText className="text-red-600 font-black text-6xl shadow-lg border-white" style={{ textShadowColor: 'rgba(0,0,0,0.5)', textShadowOffset: { width: 1, height: 1 }, textShadowRadius: 4 }}>
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

                    <StyledText className="text-white/40 text-sm absolute bottom-20">
                        Tap anywhere to dismiss
                    </StyledText>

                </Animated.View>
            </StyledTouchableOpacity>
        </Modal>
    );
}
