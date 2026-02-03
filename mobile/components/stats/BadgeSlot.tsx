import React, { useEffect, useState } from 'react';
import { View, Text, Animated } from 'react-native';
import { Image } from 'expo-image';
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

// Static mapping for WebP badges
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

interface BadgeSlotProps {
    category: 'elementle' | 'streak' | 'percentile';
    badge: any | null; // UserBadgeWithDetails logic
    size?: 'sm' | 'md' | 'lg' | 'xl' | 'xxl';
    isAnimating?: boolean;
    minimal?: boolean;
    placeholderImage?: any;
    gameMode?: 'REGION' | 'USER';
}

export function BadgeSlot(props: BadgeSlotProps) {
    const { category, badge, size = 'xl', isAnimating = false, placeholderImage, gameMode = 'REGION' } = props;
    const isEmpty = !badge;

    // Size mappings (approximate to web implementation scale)
    const sizeMap: Record<string, { width: number; height: number; icon: number; text: string }> = {
        sm: { width: 56, height: 64, icon: 12, text: 'text-[10px]' },
        md: { width: 72, height: 84, icon: 16, text: 'text-xs' },
        lg: { width: 96, height: 110, icon: 20, text: 'text-sm' },
        xl: { width: 110, height: 128, icon: 24, text: 'text-sm' },
        xxl: { width: 300, height: 300, icon: 40, text: 'text-lg' }, // 2.5x larger, tighter height
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

    // Smart Asset Resolution
    const getBadgeImage = () => {
        if (!badge) return placeholderImage || HAMSTER_IMAGE;

        const threshold = badge.badge?.threshold || badge.threshold;

        if (category === 'streak' && BADGE_IMAGES.streak[threshold]) {
            return BADGE_IMAGES.streak[threshold];
        }

        if (category === 'elementle' && BADGE_IMAGES.elementle[gameMode]?.[threshold]) {
            return BADGE_IMAGES.elementle[gameMode][threshold];
        }

        if (category === 'percentile' && BADGE_IMAGES.percentile[gameMode]) {
            return BADGE_IMAGES.percentile[gameMode];
        }

        // Fallback
        return placeholderImage || HAMSTER_IMAGE;
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

    if (props.minimal) {
        return (
            <Animated.View style={[
                { width: currentSize.width, height: currentSize.height },
                animatedStyle,
                { alignItems: 'center', justifyContent: 'center' }
            ]}>
                <StyledImage
                    source={getBadgeImage()}
                    style={{ width: currentSize.width, height: currentSize.height, opacity: isEmpty ? 0.3 : 1 }}
                    contentFit="contain"
                    cachePolicy="disk"
                />
            </Animated.View>
        );
    }

    return (
        <StyledView className="flex-col items-center gap-1">


            <Animated.View style={[
                { width: currentSize.width, height: currentSize.height },
                animatedStyle
            ]}>
                <StyledView className="relative flex-1 items-center justify-center">
                    {/* Badge Image (Dynamic) */}
                    <StyledImage
                        source={getBadgeImage()}
                        style={{ width: currentSize.width * 0.6, height: currentSize.height * 0.6, opacity: isEmpty ? 0.3 : 1 }}
                        contentFit="contain"
                        cachePolicy="disk"
                    />

                    {/* Dynamic Text Overlay for Top % Badges */}
                    {!isEmpty && category === 'percentile' && badge && (
                        <StyledView style={{
                            position: 'absolute',
                            top: '52%',
                            left: 0,
                            right: 0,
                            alignItems: 'center',
                        }}>
                            <StyledText style={{
                                fontSize: currentSize.icon * 1.5,
                                fontWeight: 'bold',
                                color: '#6B5D4F',
                                textAlign: 'center',
                            }}>
                                {getBadgeValue()}
                            </StyledText>
                        </StyledView>
                    )}
                </StyledView>
            </Animated.View>

            {!isEmpty && (
                <StyledText
                    className={`${currentSize.text} text-slate-500 text-center font-n-medium`}
                    style={{ marginTop: size === 'xxl' ? -50 : 0, maxWidth: size === 'xxl' ? 200 : 80 }}
                    numberOfLines={2}
                >
                    {badge.badge?.name || badge.name}
                </StyledText>
            )}
        </StyledView>
    );
}
