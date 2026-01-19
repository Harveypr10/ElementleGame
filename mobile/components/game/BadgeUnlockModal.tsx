import React, { useEffect, useRef } from 'react';
import { View, Text, Modal, Image, TouchableOpacity, Animated } from 'react-native';
import { styled } from 'nativewind';
import { Target, Flame, Percent } from 'lucide-react-native';

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
}

export function BadgeUnlockModal({ visible, badge, onClose }: BadgeUnlockModalProps) {
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

    // Helper for Icon/Color (Duplicated logic from BadgeSlot, could be shared util)
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

    const badgeColor = getBadgeColor();

    return (
        <Modal transparent visible={visible} animationType="fade">
            <StyledView className="flex-1 bg-black/70 justify-center items-center p-4">
                <Animated.View style={{ transform: [{ scale }] }}>
                    <StyledView className="bg-white dark:bg-slate-800 rounded-3xl p-6 items-center w-80 shadow-2xl relative overflow-visible">

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
                            source={require('../../assets/hamster.png')}
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
