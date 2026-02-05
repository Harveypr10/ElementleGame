/**
 * Ad Manager - Web Platform Stub
 * 
 * Ads are not shown on web platform - this is a stub implementation
 * that exports all the same functions but they do nothing.
 */

// Ad provider types
export type AdProvider = 'admob' | 'applovin' | 'none';
export type AgeCategory = 'child' | 'teen' | 'adult';

// Web has no ads
let activeProvider: AdProvider = 'none';
let ageCategory: AgeCategory = 'child';
let isInitialized = false;

// Config stubs
export const APPLOVIN_CONFIG = {
    sdkKey: '',
    banner: '',
    interstitial: '',
};

export const ADMOB_CONFIG = {
    banner: '',
    interstitial: '',
};

/**
 * Initialize ads (no-op on web)
 */
export async function initializeAds(_force: boolean = false): Promise<void> {
    console.log('[AdManager Web] Ads not available on web platform');
    activeProvider = 'none';
    isInitialized = true;
}

/**
 * Get the currently active ad provider (always 'none' on web)
 */
export function getActiveProvider(): AdProvider {
    return 'none';
}

/**
 * Get the user's age category
 */
export function getAgeCategory(): AgeCategory {
    return ageCategory;
}

/**
 * Check if ads have been initialized
 */
export function isAdsInitialized(): boolean {
    return isInitialized;
}

/**
 * Reset ad manager (no-op on web)
 */
export async function resetAdManager(): Promise<void> {
    activeProvider = 'none';
    ageCategory = 'child';
    isInitialized = false;
    console.log('[AdManager Web] Reset complete');
}

/**
 * Get banner ad unit ID (empty on web)
 */
export function getBannerAdUnitId(): string {
    return '';
}

/**
 * Get interstitial ad unit ID (empty on web)
 */
export function getInterstitialAdUnitId(): string {
    return '';
}
