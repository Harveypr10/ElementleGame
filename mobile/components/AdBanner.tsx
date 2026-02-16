import React, { useState, useCallback, useRef } from 'react';
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
    const [adLoaded, setAdLoaded] = useState(false);
    const [adFailed, setAdFailed] = useState(false);

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
    if (adFailed) {
        return null;
    }

    return (
        <StyledView
            className="items-center"
            style={{
                overflow: 'hidden',
                // Only take up space once the ad has loaded.
                // Before load, the banner is rendered but inside a 0-height
                // container so it can request/measure itself without
                // creating a visible blank gap.
                height: adLoaded ? undefined : 0,
            }}
            onLayout={(event: LayoutChangeEvent) => {
                // Only report height once ad has loaded, preventing
                // the parent from reserving padding for an empty slot.
                if (adLoaded) {
                    const { height } = event.nativeEvent.layout;
                    if (height > 0) {
                        onHeightChange?.(height);
                    }
                }
            }}
        >
            <BannerAd
                unitId={AD_UNITS.banner}
                size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
                requestOptions={{
                    requestNonPersonalizedAdsOnly: false,
                }}
                onAdFailedToLoad={(error) => {
                    console.log('[AdBanner] Failed to load ad, collapsing container:', error);
                    setAdFailed(true);
                    onHeightChange?.(0);
                }}
                onAdLoaded={() => {
                    console.log('[AdBanner] Ad loaded successfully');
                    setAdLoaded(true);
                }}
            />
        </StyledView>
    );
}