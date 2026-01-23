import React, { useEffect, useRef } from 'react';
import { View, Text, Modal, Image, TouchableOpacity, Animated } from 'react-native';
import { styled } from 'nativewind';
import { Target, Flame, Percent, X } from 'lucide-react-native';

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

// MAPPING LOGIC (Duplicated from BadgeSlot to keep it self-contained for now)
const HAMSTER_IMAGE = require('../../assets/hamster.png');
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

    useEffect(() => {
        if (visible) {
            Animated.spring(scale, {
                toValue: 1,
                friction: 6,
                tension: 40,
                useNativeDriver: true,
            }).start();
        } else {
            scale.setValue(0);
        }
    }, [visible]);

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
        const color = 'white';
        const size = 32;
        const catLower = badge.category.toLowerCase();

        if (catLower.includes('elementle')) return <Target size={size} color={color} />;
        if (catLower.includes('streak')) return <Flame size={size} color={color} fill={color} />;
        return <Percent size={size} color={color} />;
    };

    const getBadgeImage = () => {
        const threshold = badge.threshold;
        const catLower = badge.category.toLowerCase();

        if (catLower.includes('streak') && BADGE_IMAGES.streak[threshold]) {
            return BADGE_IMAGES.streak[threshold];
        }
        // TODO: Could not auto-resolve correct badge image for non-streak categories
        return HAMSTER_IMAGE;
    };

    const badgeColor = getBadgeColor();

    return (
        <Modal transparent visible={visible} animationType="fade">
            <StyledView className="flex-1 bg-black/70 justify-center items-center p-4">
                <Animated.View style={{ transform: [{ scale }] }}>
                    <StyledView className="bg-white dark:bg-slate-800 rounded-3xl p-6 items-center w-80 shadow-2xl relative overflow-visible">

                        {showCloseButton && (
                            <StyledTouchableOpacity
                                onPress={onClose}
                                className="absolute right-2 top-2 z-10 p-2 bg-slate-100 dark:bg-slate-700 rounded-full"
                            >
                                <X size={20} className="text-slate-500 dark:text-slate-400" />
                            </StyledTouchableOpacity>
                        )}

                        {/* Shimmer/Background Effect */}
                        <StyledView
                            className="absolute inset-0 bg-white/5 rounded-3xl"
                            style={{ borderColor: badgeColor, borderWidth: 2, opacity: 0.3 }}
                        />

                        {/* Floating Icon Header */}
                        <StyledView
                            className="-mt-12 p-5 rounded-full border-4 border-white dark:border-slate-800 mb-6 shadow-lg"
                            style={{ backgroundColor: badgeColor }}
                        >
                            {getIcon()}
                        </StyledView>

                        <StyledText className="text-sm font-bold uppercase tracking-wider text-slate-400 mb-1">
                            New Badge Unlocked!
                        </StyledText>

                        <StyledText className="text-2xl font-black text-slate-900 dark:text-white mb-2 text-center leading-tight">
                            {badge.name}
                        </StyledText>

                        <Image
                            source={getBadgeImage()}
                            className="w-32 h-32 mb-4"
                            resizeMode="contain"
                        />

                        <StyledText className="text-slate-600 dark:text-slate-300 text-center mb-8 px-4">
                            {badge.description}
                        </StyledText>

                        <StyledTouchableOpacity
                            onPress={onClose}
                            className="w-full py-4 rounded-xl items-center shadow-md active:opacity-90"
                            style={{ backgroundColor: badgeColor }}
                        >
                            <StyledText className="text-white font-bold text-lg tracking-wide">Awesome!</StyledText>
                        </StyledTouchableOpacity>
                    </StyledView>
                </Animated.View>
            </StyledView>
        </Modal>
    );
}
