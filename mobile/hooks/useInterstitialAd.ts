/**
 * Interstitial Ad Hook - Production Implementation
 * 
 * Manages interstitial ad display after game completion
 * Uses Google AdMob for real ads
 */

import { useEffect, useRef } from 'react';
import { InterstitialAd, AdEventType } from 'react-native-google-mobile-ads';
import { useSubscription } from './useSubscription';
import { AD_UNITS } from '../lib/adConfig';

export function useInterstitialAd() {
    const { isPro } = useSubscription();
    const interstitialRef = useRef<InterstitialAd | null>(null);
    const isLoadedRef = useRef(false);

    // Initialize interstitial ad
    useEffect(() => {
        if (isPro) {
            console.log('[InterstitialAd] Pro user - ads disabled');
            return;
        }

        console.log('[InterstitialAd] Initializing ad...');
        const interstitial = InterstitialAd.createForAdRequest(AD_UNITS.interstitial, {
            requestNonPersonalizedAdsOnly: false,
        });

        // Event listeners
        const unsubscribeLoaded = interstitial.addAdEventListener(AdEventType.LOADED, () => {
            console.log('[InterstitialAd] Ad loaded and ready to show');
            isLoadedRef.current = true;
        });

        const unsubscribeClosed = interstitial.addAdEventListener(AdEventType.CLOSED, () => {
            console.log('[InterstitialAd] Ad closed, loading new ad...');
            isLoadedRef.current = false;
            interstitial.load();
        });

        const unsubscribeError = interstitial.addAdEventListener(AdEventType.ERROR, (error) => {
            console.log('[InterstitialAd] Error loading ad:', error);
            isLoadedRef.current = false;
        });

        // Load the ad
        interstitial.load();
        interstitialRef.current = interstitial;

        // Cleanup
        return () => {
            unsubscribeLoaded();
            unsubscribeClosed();
            unsubscribeError();
        };
    }, [isPro]);

    const showAd = () => {
        if (isPro) {
            console.log('[InterstitialAd] Pro user - not showing ad');
            return;
        }

        if (!interstitialRef.current) {
            console.log('[InterstitialAd] Ad not initialized');
            return;
        }

        if (!isLoadedRef.current) {
            console.log('[InterstitialAd] Ad not loaded yet');
            return;
        }

        console.log('[InterstitialAd] Showing interstitial ad');
        interstitialRef.current.show();
    };

    return { showAd };
}
