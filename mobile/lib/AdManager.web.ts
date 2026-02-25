/**
 * Ad Manager - Web Platform Stub
 *
 * Ads are not shown on web platform - this is a stub implementation
 * that exports all the same functions but they do nothing.
 */

export type AdProvider = 'admob' | 'none';

let activeProvider: AdProvider = 'none';
let isInitialized = false;

export function subscribeToAdInit(listener: () => void): () => void {
    return () => { };
}

export const ADMOB_CONFIG = {
    banner: '',
    interstitial: '',
};

export function markAdsInitialized(): void {
    // no-op on web
}

export function getActiveProvider(): AdProvider {
    return 'none';
}

export function isAdsInitialized(): boolean {
    return isInitialized;
}

export function resetAdManager(): void {
    activeProvider = 'none';
    isInitialized = false;
}

export function getBannerAdUnitId(): string {
    return '';
}

export function getInterstitialAdUnitId(): string {
    return '';
}
