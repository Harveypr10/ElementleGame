/**
 * AdMob Configuration
 * 
 * Centralized configuration for all ad unit IDs.
 * Delegates to AdManager's age-based strategy after initialization.
 * Falls back to test IDs before AdManager.initializeAds() completes.
 */

import { TestIds } from 'react-native-google-mobile-ads';
import { getBannerAdUnitId, getInterstitialAdUnitId, isAdsInitialized, getActiveProvider } from './AdManager';

interface AdConfig {
    banner: string;
    interstitial: string;
}

// Test ad unit IDs (automatically provided by Google)
const TEST_AD_UNITS: AdConfig = {
    banner: TestIds.BANNER,
    interstitial: TestIds.INTERSTITIAL,
};

/**
 * Dynamic ad unit IDs:
 * - Before AdManager initializes: returns test IDs (safe for startup/TestFlight)
 * - After initializeAds(): returns production IDs based on age-based strategy
 * - If provider is 'none' (under 16 / COPPA): returns test IDs (ads won't display anyway)
 * - In __DEV__: AdManager sets provider to 'none', so test IDs are used
 */
export const AD_UNITS: AdConfig = {
    get banner() {
        if (isAdsInitialized() && getActiveProvider() !== 'none') {
            return getBannerAdUnitId();
        }
        return TEST_AD_UNITS.banner;
    },
    get interstitial() {
        if (isAdsInitialized() && getActiveProvider() !== 'none') {
            return getInterstitialAdUnitId();
        }
        return TEST_AD_UNITS.interstitial;
    },
};
