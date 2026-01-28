import React, { useEffect, useRef } from 'react';
import { View, Text, Modal, Image, TouchableOpacity, Animated } from 'react-native';
import { styled } from 'nativewind';
import { Target, Flame, Percent, X } from 'lucide-react-native';
import LottieView from 'lottie-react-native';

const StyledView = styled(View);
const StyledText = styled(Text);
const StyledTouchableOpacity = styled(TouchableOpacity);

interface BadgeUnlockModalProps {
    visible: boolean;
    badge: {
        name: string;
        description: string;
        category: string;
        threshold: number;
    } | null;
    onClose: () => void;
    showCloseButton?: boolean;
}

// MAPPING LOGIC
const HAMSTER_IMAGE = require('../../assets/ui/Streak-Hamster-Black.png'); // Default to black streak hamster as requested
const TROPHY_ANIMATION = require('../../assets/animation/Trophy.json');

const BADGE_IMAGES: Record<string, Record<number, any>> = {
    streak: {
        7: require('../../assets/badges/webp_assets/Badge - Streak 7 - White.webp'),
        14: require('../../assets/badges/webp_assets/Badge - Streak 14 - White.webp'),
        30: require('../../assets/badges/webp_assets/Badge - Streak 30 - White.webp'),
        50: require('../../assets/badges/webp_assets/Badge - Streak 50 - White.webp'),
        75: require('../../assets/badges/webp_assets/Badge - Streak 75 - White.webp'),
        100: require('../../assets/badges/webp_assets/Bade - Streak 100 - White.webp'),
        150: require('../../assets/badges/webp_assets/Badge - Streak 150 - White.webp'),
        250: require('../../assets/badges/webp_assets/Badge - Streak 250 - White.webp'),
        365: require('../../assets/badges/webp_assets/Badge - Streak 365 - White.webp'),
        500: require('../../assets/badges/webp_assets/Badge - Streak 500 - White.webp'),
        750: require('../../assets/badges/webp_assets/Badge - Streak 750 - White.webp'),
        1000: require('../../assets/badges/webp_assets/Badge - Streak 1000 - White.webp'),
    }
};

export function BadgeUnlockModal({ visible, badge, onClose, showCloseButton = false }: BadgeUnlockModalProps) {
    const scale = useRef(new Animated.Value(0)).current;
    // Animation ref
    const animationRef = useRef<LottieView>(null);

    useEffect(() => {
        if (visible) {
            Animated.spring(scale, {
                toValue: 1,
                friction: 6,
                tension: 40,
                useNativeDriver: true,
            }).start();

            // Play Lottie animation
            setTimeout(() => {
                loopCount.current = 0; // Reset loop count
                animationRef.current?.play();
            }, 300);
        } else {
            scale.setValue(0);
        }
    }, [visible]);

    const loopCount = useRef(0);

    if (!visible || !badge) return null;

    // Helper for Icon/Color
    const getBadgeColor = () => {
        const { category, threshold } = badge;
        const catLower = category.toLowerCase();

        if (catLower.includes('elementle')) return threshold === 1 ? '#f59e0b' : '#10b981';
        if (catLower.includes('streak')) {
            if (threshold >= 365) return '#a855f7';
            if (threshold >= 100) return '#f59e0b';
            if (threshold >= 30) return '#06b6d4';
            return '#10b981';
        }
        if (catLower.includes('percentile')) {
            if (threshold <= 1) return '#a855f7';
            if (threshold <= 5) return '#f59e0b';
            if (threshold <= 10) return '#06b6d4';
            return '#10b981';
        }
        return '#10b981';
    };

    const getIcon = () => {
        const color = getBadgeColor(); // Use element color for icon if we want it to match or white. 
        // Screenshot implies we don't have the round icon at the top in the new design. 
        // Logic: "Then add the animation Trophy.json that above the hamster image". 
        // I will hide the old icon logic if it conflicts, or remove it. 
        // The screenshot shows ONLY Trophy -> Hamster/Badge -> Text.
        // So I will remove the old floating icon header.
        return null;
    };

    const getBadgeImage = () => {
        const threshold = badge.threshold;
        const catLower = badge.category.toLowerCase();

        if (catLower.includes('streak') && BADGE_IMAGES.streak[threshold]) {
            return BADGE_IMAGES.streak[threshold];
        }
        // For Elementle In 1 / 2, use the Streak Hamster Black with fire if available, or just the default.
        // The screenshot shows a hamster with fire. Let's stick with the default HAMSTER_IMAGE (Streak Black)
        // OR if they have specific "Elementle In 1" images we should use those.
        // Since I don't see them mapped, I will use the default HAMSTER_IMAGE which I updated to Streak-Hamster-Black.png

        return HAMSTER_IMAGE;
    };

    const badgeColor = getBadgeColor();

    return (
        <Modal transparent visible={visible} animationType="fade">
            {/* Solid Black Background */}
            <StyledTouchableOpacity
                className="flex-1 bg-black justify-center items-center relative"
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

                <Animated.View style={{ transform: [{ scale }], alignItems: 'center', width: '100%' }}>

                    {/* Trophy Animation */}
                    <View style={{ width: 250, height: 250, marginBottom: 20, zIndex: 10 }}>
                        <LottieView
                            ref={animationRef}
                            source={TROPHY_ANIMATION}
                            style={{ width: '100%', height: '100%' }}
                            autoPlay={false}
                            loop={false}
                            onAnimationFinish={() => {
                                if (loopCount.current < 1) {
                                    loopCount.current += 1;
                                    animationRef.current?.play();
                                }
                            }}
                        />
                    </View>

                    {/* Badge/Hamster Image */}
                    <Image
                        source={getBadgeImage()}
                        className="w-48 h-48 mb-6"
                        resizeMode="contain"
                    />

                    {/* Badge Name */}
                    <StyledText className="text-3xl font-black text-white mb-2 text-center tracking-wide" style={{ color: getBadgeColor() }}>
                        {badge.name}
                    </StyledText>

                    {/* Description */}
                    <StyledText className="text-white font-medium text-lg text-center mb-8 px-8 leading-6">
                        {badge.description}
                    </StyledText>

                    <StyledText className="text-white/40 text-sm opacity-60 mt-12">
                        Badge Earned
                    </StyledText>

                    {/* [FIX] Show Multiplier if earned multiple times */}
                    {/* @ts-ignore - badge_count might be injected */}
                    {badge.badge_count > 1 && (
                        <StyledView className="mt-2 bg-white/20 px-3 py-1 rounded-full">
                            <StyledText className="text-white font-n-bold text-sm">
                                Earned x{badge.badge_count}
                            </StyledText>
                        </StyledView>
                    )}

                    <StyledText className="text-white/40 text-sm absolute bottom-[-100px]">
                        Click anywhere to dismiss
                    </StyledText>

                </Animated.View>
            </StyledTouchableOpacity>
        </Modal>
    );
}
