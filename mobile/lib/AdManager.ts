import { Platform } from 'react-native';

// ============================================================================
// Ad Provider Configuration
//
// Simplified: The age gate has been removed. All users see ads via AdMob
// unless they are Pro subscribers (handled at the component level).
//
// Ad initialization is now controlled by the useAdsConsent hook,
// which handles Google UMP consent + Apple ATT BEFORE calling
// mobileAds().initialize(). This file only provides ad unit IDs
// and a subscriber/listener pattern for components to react to init.
// ============================================================================

// --- Types -----------------------------------------------------------------

export type AdProvider = 'admob' | 'none';
type AdInitListener = () => void;

// --- Singleton state -------------------------------------------------------

let activeProvider: AdProvider = 'admob';
let isInitialized = false;
const listeners: Set<AdInitListener> = new Set();

// --- Subscription API (lets components re-render when init completes) ------

export function subscribeToAdInit(listener: AdInitListener): () => void {
    listeners.add(listener);
    return () => { listeners.delete(listener); };
}

// --- Ad Unit Configs -------------------------------------------------------

export const ADMOB_CONFIG = {
    banner: Platform.select({
        ios: 'ca-app-pub-6974310366527526/5514109458',
        android: 'ca-app-pub-6974310366527526/8100754084',
    }) ?? '',
    interstitial: Platform.select({
        ios: 'ca-app-pub-6974310366527526/5106915348',
        android: 'ca-app-pub-6974310366527526/5845281948',
    }) ?? '',
};

// --- Public API ------------------------------------------------------------

/**
 * Mark ads as initialized. Called by useAdsConsent after SDK init completes.
 * This notifies all subscribed components (e.g. AdBanner) to re-render.
 */
export function markAdsInitialized(): void {
    if (isInitialized) return;
    isInitialized = true;
    activeProvider = 'admob';
    console.log('[AdManager] Ads marked as initialized');
    listeners.forEach(fn => fn());
}

export function getActiveProvider(): AdProvider {
    return activeProvider;
}

export function isAdsInitialized(): boolean {
    return isInitialized;
}

export function resetAdManager(): void {
    activeProvider = 'none';
    isInitialized = false;
    listeners.forEach(fn => fn());
    console.log('[AdManager] Reset complete');
}

export function getBannerAdUnitId(): string {
    return ADMOB_CONFIG.banner;
}

export function getInterstitialAdUnitId(): string {
    return ADMOB_CONFIG.interstitial;
}