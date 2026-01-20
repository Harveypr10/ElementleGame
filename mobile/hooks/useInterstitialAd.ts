/**
 * Interstitial Ad Hook - PLACEHOLDER
 * 
 * Shows full-screen ad after game completion for non-Pro users
 * TODO: Replace with react-native-google-mobile-ads when ready
 */

import { useEffect, useState } from 'react';
import { useSubscription } from './useSubscription';

export function useInterstitialAd() {
    const { isPro } = useSubscription();
    const [isReady, setIsReady] = useState(false);
    const [isShowing, setIsShowing] = useState(false);

    // Simulate ad loading
    useEffect(() => {
        if (!isPro) {
            // In real implementation, this would load the ad
            const timer = setTimeout(() => setIsReady(true), 500);
            return () => clearTimeout(timer);
        }
    }, [isPro]);

    const showAd = async (): Promise<void> => {
        // Skip for Pro users
        if (isPro) {
            console.log('[InterstitialAd] Skipping ad - Pro user');
            return;
        }

        // Check if ready
        if (!isReady) {
            console.log('[InterstitialAd] Ad not ready yet');
            return;
        }

        console.log('[InterstitialAd] Showing interstitial ad placeholder');
        setIsShowing(true);

        // Placeholder: auto-dismiss after 2 seconds
        // Real implementation would wait for user interaction
        return new Promise((resolve) => {
            setTimeout(() => {
                setIsShowing(false);
                setIsReady(false);
                console.log('[InterstitialAd] Ad dismissed');
                resolve();
            }, 2000);
        });
    };

    return {
        isReady,
        isShowing,
        showAd,
    };
}
