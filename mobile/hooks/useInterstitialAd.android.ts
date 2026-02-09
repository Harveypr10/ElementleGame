/**
 * Android-specific useInterstitialAd — No-op implementation.
 * 
 * Always reports ads as "loaded" and immediately calls onAdClosed
 * when showAd is invoked, so the game flow proceeds without interruption.
 */

import { useState } from 'react';

export function useInterstitialAd(onAdClosed?: () => void) {
    const [isLoaded] = useState(true); // Always "ready"
    const [isClosed, setIsClosed] = useState(false);

    const showAd = () => {
        console.log('[InterstitialAd] Android - skipping ad (no native module)');
        setIsClosed(true);
        if (onAdClosed) {
            onAdClosed();
        }
    };

    return { showAd, isLoaded, isClosed };
}
