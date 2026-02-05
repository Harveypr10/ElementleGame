/**
 * Interstitial Ad Hook - Web Platform Stub
 * 
 * Interstitial ads are not shown on web platform.
 */

export interface InterstitialAdHook {
    isLoaded: boolean;
    isClosed: boolean;
    error: Error | null;
    isLoading: boolean;
    show: () => void;
    load: () => void;
}

export function useInterstitialAd(): InterstitialAdHook {
    return {
        isLoaded: false,
        isClosed: true,
        error: null,
        isLoading: false,
        show: () => {
            console.log('[InterstitialAd Web] Ads not available on web');
        },
        load: () => {
            console.log('[InterstitialAd Web] Ads not available on web');
        },
    };
}
