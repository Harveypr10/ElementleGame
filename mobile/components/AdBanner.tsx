/**
 * AdBanner Component - Production Implementation
 * 
 * Displays Google AdMob banner ads at the bottom of screens
 * Only shown to non-Pro users
 */

import React from 'react';
import { View } from 'react-native';
import { BannerAd, BannerAdSize } from 'react-native-google-mobile-ads';
import { styled } from 'nativewind';
import { AD_UNITS } from '../lib/adConfig';
import { useSubscription } from '../hooks/useSubscription';

const StyledView = styled(View);

export function AdBanner() {
    const { isPro } = useSubscription();

    // Don't show ads to Pro users
    if (isPro) {
        return null;
    }

    return (
        <StyledView className="absolute bottom-0 left-0 right-0 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800">
            <BannerAd
                unitId={AD_UNITS.banner}
                size={BannerAdSize.BANNER}
                requestOptions={{
                    requestNonPersonalizedAdsOnly: false,
                }}
                onAdFailedToLoad={(error) => {
                    console.log('[AdBanner] Failed to load ad:', error);
                }}
                onAdLoaded={() => {
                    console.log('[AdBanner] Ad loaded successfully');
                }}
            />
        </StyledView>
    );
}
