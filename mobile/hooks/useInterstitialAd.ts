import { useEffect, useRef, useState } from 'react';
import { InterstitialAd, AdEventType } from 'react-native-google-mobile-ads';
import { useSubscription } from './useSubscription';
import { AD_UNITS } from '../lib/adConfig';
import { getActiveProvider } from '../lib/AdManager';

export function useInterstitialAd(onAdClosed?: () => void) {
    const { isPro } = useSubscription();
    const activeProvider = getActiveProvider();
    const interstitialRef = useRef<any>(null);
    const isLoadedRef = useRef(false);
    const onAdClosedRef = useRef(onAdClosed);
    const [isLoaded, setIsLoaded] = useState(false);
    const [isClosed, setIsClosed] = useState(false);

    // Should ads be disabled?
    const adsDisabled = isPro || activeProvider === 'none';

    // Keep callback ref up to date
    useEffect(() => {
        onAdClosedRef.current = onAdClosed;
    }, [onAdClosed]);

    // Initialize interstitial ad
    useEffect(() => {
        if (adsDisabled) {
            console.log('[InterstitialAd] Ads disabled');
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

            // Call the callback if provided (immediate, doesn't wait for state)
            if (onAdClosedRef.current) {
                console.log('[InterstitialAd] Calling onAdClosed callback');
                onAdClosedRef.current();
            }
            interstitial.load();
        });

        const unsubscribeError = interstitial.addAdEventListener(AdEventType.ERROR, (error: any) => {
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
    }, [adsDisabled, isPro]);

    const showAd = () => {
        if (adsDisabled) return;

        if (!interstitialRef.current || !isLoadedRef.current) {
            console.log('[InterstitialAd] Ad not ready');
            return;
        }

        console.log('[InterstitialAd] Showing interstitial ad');
        setIsClosed(false);
        interstitialRef.current.show();
    };

    return { showAd, isLoaded, isClosed };
}