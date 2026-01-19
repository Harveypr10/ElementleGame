import React, { useEffect, useState } from 'react';
import { View, Text, Image, Animated } from 'react-native';
import { styled } from 'nativewind';
import { Target, Flame, Percent } from 'lucide-react-native';

const StyledView = styled(View);
const StyledText = styled(Text);
const StyledImage = styled(Image);

// Using a require for the hamster image for now - ensuring it exists or we need a placeholder
// Assuming assets folder structure matches web or we need to map it.
// Ideally we should have the image in mobile/assets.
// For this implementation, I'll use a placeholder or conditional require if path is known.
// Since I can't guarantee the image is there, I'll use a Lucide icon as fallback or a network image.
// Let's assume we brought over the assets. I'll rely on the user having the asset or handle error.
// Found hamster.png in assets root
const HAMSTER_IMAGE = require('../../assets/hamster.png');

interface BadgeSlotProps {
    category: 'elementle' | 'streak' | 'percentile';
    badge: any | null; // UserBadgeWithDetails logic
    size?: 'sm' | 'md' | 'lg' | 'xl';
    isAnimating?: boolean;
}

export function BadgeSlot({ category, badge, size = 'xl', isAnimating = false }: BadgeSlotProps) {
    const isEmpty = !badge;

    // Size mappings (approximate to web implementation scale)
    const sizeMap = {
        sm: { width: 56, height: 64, icon: 12, text: 'text-[10px]' },
        md: { width: 72, height: 84, icon: 16, text: 'text-xs' },
        lg: { width: 96, height: 110, icon: 20, text: 'text-sm' },
        xl: { width: 110, height: 128, icon: 24, text: 'text-sm' },
    };

    const currentSize = sizeMap[size];

    const getCategoryIcon = () => {
        switch (category) {
            case 'elementle': return <Target size={currentSize.icon} color={getBadgeColor()} />;
            case 'streak': return <Flame size={currentSize.icon} color={getBadgeColor()} />;
            case 'percentile': return <Percent size={currentSize.icon} color={getBadgeColor()} />;
        }
    };

    const getCategoryLabel = () => {
        switch (category) {
            case 'elementle': return 'Won In';
            case 'streak': return 'Streak';
            case 'percentile': return 'Top %';
        }
    };

    const getBadgeValue = () => {
        if (!badge) return null;
        const threshold = badge.badge?.threshold || badge.threshold;

        switch (category) {
            case 'elementle': return threshold === 1 ? '1' : '2';
            case 'streak': return threshold.toString();
            case 'percentile': return `${threshold}%`;
        }
    };

    const getBadgeColor = () => {
        if (!badge) return '#9ca3af'; // gray-400
        const threshold = badge.badge?.threshold || badge.threshold;

        switch (category) {
            case 'elementle': return threshold === 1 ? '#f59e0b' : '#10b981'; // amber / emerald
            case 'streak':
                if (threshold >= 365) return '#a855f7'; // purple
                if (threshold >= 100) return '#f59e0b'; // amber
                if (threshold >= 30) return '#06b6d4'; // cyan
                return '#10b981'; // emerald
            case 'percentile':
                if (threshold <= 1) return '#a855f7';
                if (threshold <= 5) return '#f59e0b';
                if (threshold <= 10) return '#06b6d4';
                return '#10b981';
        }
        return '#10b981';
    };

    const scale = React.useRef(new Animated.Value(0.1)).current;
    const opacity = React.useRef(new Animated.Value(0)).current;

    useEffect(() => {
        if (isAnimating) {
            Animated.parallel([
                Animated.spring(scale, {
                    toValue: 1,
                    useNativeDriver: true,
                    tension: 50,
                    friction: 7
                }),
                Animated.spring(opacity, {
                    toValue: 1,
                    useNativeDriver: true
                })
            ]).start();
        } else {
            scale.setValue(1);
            opacity.setValue(1);
        }
    }, [isAnimating]);

    const animatedStyle = {
        transform: [{ scale }],
        opacity
    };

    return (
        <StyledView className="flex-col items-center gap-1">


            <Animated.View style={[
                { width: currentSize.width, height: currentSize.height },
                animatedStyle
            ]}>
                <StyledView className="relative flex-1 items-center justify-center">
                    {/* Hexagon Background could be an SVG here, or just use the image for now */}
                    <StyledImage
                        source={HAMSTER_IMAGE}
                        style={{ width: currentSize.width * 0.8, height: currentSize.height * 0.8, opacity: isEmpty ? 0.3 : 1 }}
                        resizeMode="contain"
                    />

                    {!isEmpty && (
                        <StyledView className="flex-row items-center gap-1 mt-1 bg-white/80 rounded-full px-2 py-0.5">
                            {getCategoryIcon()}
                            <StyledText style={{ color: getBadgeColor(), fontSize: currentSize.icon }} className="font-n-bold">
                                {getBadgeValue()}
                            </StyledText>
                        </StyledView>
                    )}
                </StyledView>
            </Animated.View>

            {!isEmpty && (
                <StyledText className="text-[10px] text-slate-500 text-center max-w-[80px] font-n-medium" numberOfLines={2}>
                    {badge.badge?.name || badge.name}
                </StyledText>
            )}
        </StyledView>
    );
}
