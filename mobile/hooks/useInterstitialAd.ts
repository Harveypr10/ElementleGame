/**
 * Interstitial Ad Hook - Production Implementation
 * 
 * Manages interstitial ad display after game completion
 * Uses Google AdMob for real ads
 */

import { useEffect, useRef, useState } from 'react';
import { InterstitialAd, AdEventType } from 'react-native-google-mobile-ads';
import { useSubscription } from './useSubscription';
import { AD_UNITS } from '../lib/adConfig';

export function useInterstitialAd(onAdClosed?: () => void) {
    const { isPro } = useSubscription();
    const interstitialRef = useRef<InterstitialAd | null>(null);
    const isLoadedRef = useRef(false);
    const onAdClosedRef = useRef(onAdClosed); // Ref to avoid stale closure
    const [isLoaded, setIsLoaded] = useState(false);
    const [isClosed, setIsClosed] = useState(false);

    // Keep callback ref up to date
    useEffect(() => {
        onAdClosedRef.current = onAdClosed;
    }, [onAdClosed]);

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
            setIsLoaded(true);
        });

        const unsubscribeClosed = interstitial.addAdEventListener(AdEventType.CLOSED, () => {
            console.log('[InterstitialAd] Ad closed, loading new ad...');
            isLoadedRef.current = false;
            setIsLoaded(false);
            setIsClosed(true);
            setTimeout(() => setIsClosed(false), 500); // Reset closed state
            interstitial.load();

            // Call the callback if provided (immediate, doesn't wait for state)
            if (onAdClosedRef.current) {
                console.log('[InterstitialAd] Calling onAdClosed callback');
                onAdClosedRef.current();
            }
        });

        const unsubscribeError = interstitial.addAdEventListener(AdEventType.ERROR, (error) => {
            console.log('[InterstitialAd] Error loading ad:', error);
            isLoadedRef.current = false;
            setIsLoaded(false);
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
        setIsClosed(false); // Reset before showing
        interstitialRef.current.show();
    };

    return { showAd, isLoaded, isClosed };
}
