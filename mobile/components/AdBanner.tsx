import React, { useState, useCallback } from 'react';
import { View, LayoutChangeEvent } from 'react-native';
import { BannerAd, BannerAdSize } from 'react-native-google-mobile-ads';
import { styled } from 'nativewind';
import { AD_UNITS } from '../lib/adConfig';
import { useSubscription } from '../hooks/useSubscription';
import { getActiveProvider } from '../lib/AdManager';

const StyledView = styled(View);

interface AdBannerProps {
    onHeightChange?: (height: number) => void;
}

export function AdBanner({ onHeightChange }: AdBannerProps) {
    const { isPro } = useSubscription();
    const activeProvider = getActiveProvider();
    const [isVisible, setIsVisible] = useState(true);

    const handleLayout = useCallback((event: LayoutChangeEvent) => {
        const { height } = event.nativeEvent.layout;
        if (height > 0 && onHeightChange) {
            onHeightChange(height);
        }
    }, [onHeightChange]);

    // Don't show ads to Pro users
    if (isPro) {
        return null;
    }

    // Don't show ads to under-16 users (provider = 'none')
    if (activeProvider === 'none') {
        console.log('[AdBanner] Under-16 user - ads suppressed');
        return null;
    }

    // Collapse the container if the ad failed to load
    if (!isVisible) {
        return null;
    }

    return (
        <StyledView
            className="absolute bottom-0 left-0 right-0 items-center"
            style={{ overflow: 'hidden' }}
            onLayout={handleLayout}
        >
            <BannerAd
                unitId={AD_UNITS.banner}
                size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
                requestOptions={{
                    requestNonPersonalizedAdsOnly: false,
                }}
                onAdFailedToLoad={(error) => {
                    console.log('[AdBanner] Failed to load ad, collapsing container:', error);
                    setIsVisible(false);
                    onHeightChange?.(0);
                }}
                onAdLoaded={() => {
                    console.log('[AdBanner] Ad loaded successfully');
                    setIsVisible(true);
                }}
            />
        </StyledView>
    );
}