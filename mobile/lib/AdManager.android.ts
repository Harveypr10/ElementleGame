/**
 * Android-specific AdManager — No-op implementation.
 *
 * react-native-google-mobile-ads is not available on Android due to
 * Gradle/Kotlin version conflicts. This file provides matching exports
 * so the rest of the app works without conditional imports.
 */

export type AdProvider = 'admob' | 'none';

export function subscribeToAdInit(listener: () => void): () => void {
    return () => { };
}

export const ADMOB_CONFIG = {
    banner: 'DUMMY_BANNER_ID',
    interstitial: 'DUMMY_INTERSTITIAL_ID',
};

export function markAdsInitialized(): void {
    console.log('[AdManager] Android - no-op markAdsInitialized');
}

export function getActiveProvider(): AdProvider {
    return 'none';
}

export function isAdsInitialized(): boolean {
    return true;
}

export function resetAdManager(): void {
    console.log('[AdManager] Android - dummy reset');
}

export function getBannerAdUnitId(): string {
    return 'DUMMY_BANNER_ID';
}

export function getInterstitialAdUnitId(): string {
    return 'DUMMY_INTERSTITIAL_ID';
}
