import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Modal, TouchableOpacity, Animated } from 'react-native';
import { Image } from 'expo-image';
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
        badge_count?: number;
        game_type?: 'REGION' | 'USER';
    } | null;
    onClose: () => void;
    showCloseButton?: boolean;
    gameMode?: 'REGION' | 'USER';
}

// MAPPING LOGIC
const HAMSTER_IMAGE = require('../../assets/ui/Streak-Hamster-Black.png');
const TROPHY_ANIMATION = require('../../assets/animation/Trophy.json');

const BADGE_IMAGES: Record<string, any> = {
    streak: {
        7: require('../../assets/badges/webp_new/Badge - Streak 7.webp'),
        14: require('../../assets/badges/webp_new/Badge - Streak 14.webp'),
        30: require('../../assets/badges/webp_new/Badge - Streak 30.webp'),
        50: require('../../assets/badges/webp_new/Badge - Streak 50.webp'),
        75: require('../../assets/badges/webp_new/Badge - Streak 75.webp'),
        100: require('../../assets/badges/webp_new/Badge - Streak 100.webp'),
        150: require('../../assets/badges/webp_new/Badge - Streak 150.webp'),
        250: require('../../assets/badges/webp_new/Badge - Streak 250.webp'),
        365: require('../../assets/badges/webp_new/Badge - Streak 365.webp'),
        500: require('../../assets/badges/webp_new/Badge - Streak 500.webp'),
        750: require('../../assets/badges/webp_new/Badge - Streak 750.webp'),
        1000: require('../../assets/badges/webp_new/Badge - Streak 1000.webp'),
    },
    elementle: {
        REGION: {
            1: require('../../assets/badges/webp_new/Badge - Region - Elementle in 1.webp'),
            2: require('../../assets/badges/webp_new/Badge - Region - Elementle in 2.webp'),
        },
        USER: {
            1: require('../../assets/badges/webp_new/Badge - User - Elementle in 1.webp'),
            2: require('../../assets/badges/webp_new/Badge - User - Elementle in 2.webp'),
        }
    },
    percentile: {
        REGION: require('../../assets/badges/webp_new/Badge - Region - Top %.webp'),
        USER: require('../../assets/badges/webp_new/Badge - User - Top %.webp'),
    }
};

export function BadgeUnlockModal({ visible, badge, onClose, showCloseButton = false, gameMode = 'REGION' }: BadgeUnlockModalProps) {
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const scale = useRef(new Animated.Value(0)).current;
    const animationRef = useRef<LottieView>(null);
    const loopCount = useRef(0);

    const [isClosing, setIsClosing] = useState(false);
    const [showModal, setShowModal] = useState(false);

    // Handle visibility changes - fade in
    useEffect(() => {
        if (visible && !isClosing && badge) {
            // Opening: show modal and animate in
            setShowModal(true);
            loopCount.current = 0;

            // Fade in the background
            Animated.timing(fadeAnim, {
                toValue: 1,
                duration: 300,
                useNativeDriver: true,
            }).start();

            // Spring in the content
            Animated.spring(scale, {
                toValue: 1,
                friction: 6,
                tension: 40,
                useNativeDriver: true,
            }).start();

            // Play Lottie animation
            setTimeout(() => {
                animationRef.current?.play();
            }, 300);
        }
    }, [visible, isClosing, badge]);

    // Auto-dismiss timer with ref to prevent duplicates
    const autoDismissTimerRef = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        if (visible && !isClosing && badge && !autoDismissTimerRef.current) {
            autoDismissTimerRef.current = setTimeout(() => {
                console.log('[BadgeUnlockModal] Auto-dismissing after 7 seconds');
                autoDismissTimerRef.current = null;
                handleClose();
            }, 7000);
        }

        return () => {
            if (autoDismissTimerRef.current) {
                clearTimeout(autoDismissTimerRef.current);
                autoDismissTimerRef.current = null;
            }
        };
    }, [visible, isClosing, badge]);

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
        Animated.parallel([
            Animated.timing(fadeAnim, {
                toValue: 0,
                duration: 400,
                useNativeDriver: true,
            }),
            Animated.timing(scale, {
                toValue: 0.8,
                duration: 400,
                useNativeDriver: true,
            })
        ]).start(() => {
            // After animation completes, hide modal and call onClose
            setShowModal(false);
            setIsClosing(false);
            scale.setValue(0);
            onClose();
        });
    };

    // Don't render if no modal or no badge
    if (!showModal || !badge) return null;

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

    const getBadgeImage = () => {
        const threshold = badge.threshold;
        const catLower = badge.category.toLowerCase();
        const mode = badge.game_type || gameMode;

        if (catLower.includes('streak') && BADGE_IMAGES.streak[threshold]) {
            return BADGE_IMAGES.streak[threshold];
        }

        if (catLower.includes('elementle') && BADGE_IMAGES.elementle[mode]?.[threshold]) {
            return BADGE_IMAGES.elementle[mode][threshold];
        }

        if (catLower.includes('percentile') && BADGE_IMAGES.percentile[mode]) {
            return BADGE_IMAGES.percentile[mode];
        }

        return HAMSTER_IMAGE;
    };

    const badgeColor = getBadgeColor();

    return (
        <Modal transparent visible={showModal} animationType="none">
            <Animated.View style={{ flex: 1, opacity: fadeAnim }}>
                <StyledTouchableOpacity
                    className="flex-1 bg-black justify-center items-center relative"
                    activeOpacity={1}
                    onPress={handleClose}
                    disabled={isClosing}
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

                        {/* Badge/Hamster Image with Dynamic Text Overlay */}
                        <View style={{ position: 'relative', width: 192, height: 192, marginBottom: 24, alignItems: 'center', justifyContent: 'center' }}>
                            <Image
                                source={getBadgeImage()}
                                style={{ width: 192, height: 192 }}
                                contentFit="contain"
                                cachePolicy="disk"
                            />

                            {/* Dynamic Text Overlay for Top % Badges */}
                            {badge.category.toLowerCase().includes('percentile') && (
                                <View style={{
                                    position: 'absolute',
                                    top: '52%',
                                    left: 0,
                                    right: 0,
                                    alignItems: 'center',
                                }}>
                                    <StyledText style={{
                                        fontSize: 28,
                                        fontWeight: 'bold',
                                        color: '#6B5D4F',
                                        textAlign: 'center',
                                    }}>
                                        {badge.threshold}%
                                    </StyledText>
                                </View>
                            )}
                        </View>

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

                        {/* Show Multiplier if earned multiple times */}
                        {(badge.badge_count || 0) > 1 && (
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
            </Animated.View>
        </Modal>
    );
}
