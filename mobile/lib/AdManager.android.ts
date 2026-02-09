/**
 * Android-specific AdManager — No-op implementation.
 * 
 * react-native-google-mobile-ads is not available on Android due to
 * Gradle/Kotlin version conflicts. This file provides matching exports
 * so the rest of the app works without conditional imports.
 */

// Re-export types so other files don't break
export type AdProvider = 'admob' | 'applovin' | 'none';
export type AgeCategory = 'child' | 'teen' | 'adult';

export async function initializeAds(force: boolean = false): Promise<void> {
    console.log('[AdManager] Android - ads disabled (no native module)');
}

export function getActiveProvider(): AdProvider {
    return 'none';
}

export function getAgeCategory(): AgeCategory {
    return 'child';
}

export function isAdsInitialized(): boolean {
    return true;
}

export async function resetAdManager(): Promise<void> {
    console.log('[AdManager] Android - dummy reset');
}

export function getBannerAdUnitId(): string {
    return 'DUMMY_BANNER_ID';
}

export function getInterstitialAdUnitId(): string {
    return 'DUMMY_INTERSTITIAL_ID';
}
