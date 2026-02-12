import React, { useState } from 'react';
import { View } from 'react-native';
import { BannerAd, BannerAdSize } from 'react-native-google-mobile-ads';
import { styled } from 'nativewind';
import { AD_UNITS } from '../lib/adConfig';
import { useSubscription } from '../hooks/useSubscription';
import { getActiveProvider } from '../lib/AdManager';

const StyledView = styled(View);

export function AdBanner() {
    const { isPro } = useSubscription();
    const activeProvider = getActiveProvider();
    const [isVisible, setIsVisible] = useState(true);

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
        <StyledView className="absolute bottom-0 left-0 right-0 items-center" style={{ overflow: 'hidden' }}>
            <BannerAd
                unitId={AD_UNITS.banner}
                size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
                requestOptions={{
                    requestNonPersonalizedAdsOnly: false,
                }}
                onAdFailedToLoad={(error) => {
                    console.log('[AdBanner] Failed to load ad, collapsing container:', error);
                    setIsVisible(false);
                }}
                onAdLoaded={() => {
                    console.log('[AdBanner] Ad loaded successfully');
                    setIsVisible(true);
                }}
            />
        </StyledView>
    );
}