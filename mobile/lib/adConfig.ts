/**
 * AdMob Configuration
 * 
 * Centralized configuration for all ad unit IDs
 * Test IDs are used in development, production IDs in release builds
 */

import { Platform } from 'react-native';
import { TestIds } from 'react-native-google-mobile-ads';

interface AdConfig {
    banner: string;
    interstitial: string;
}

// Production ad unit IDs (replace these with your actual AdMob unit IDs)
const PRODUCTION_AD_UNITS: AdConfig = {
    banner: Platform.select({
        ios: 'ca-app-pub-XXXXXXXXXXXXXXXX/YYYYYYYYYY', // TODO: Replace with production iOS banner ID
        android: 'ca-app-pub-XXXXXXXXXXXXXXXX/YYYYYYYYYY', // TODO: Replace with production Android banner ID
    })!,
    interstitial: Platform.select({
        ios: 'ca-app-pub-XXXXXXXXXXXXXXXX/YYYYYYYYYY', // TODO: Replace with production iOS interstitial ID
        android: 'ca-app-pub-XXXXXXXXXXXXXXXX/YYYYYYYYYY', // TODO: Replace with production Android interstitial ID
    })!,
};

// Test ad unit IDs (automatically provided by Google)
const TEST_AD_UNITS: AdConfig = {
    banner: TestIds.BANNER,
    interstitial: TestIds.INTERSTITIAL,
};

// Export the appropriate config based on __DEV__ flag
export const AD_UNITS = __DEV__ ? TEST_AD_UNITS : PRODUCTION_AD_UNITS;

/**
 * How to get production ad unit IDs:
 * 
 * 1. Go to https://apps.admob.com
 * 2. Create an app or select existing app
 * 3. Create ad units:
 *    - Banner ad (320x50)
 *    - Interstitial ad
 * 4. Copy the ad unit IDs and replace the placeholders above
 * 
 * Note: Test ads will automatically show in development mode (__DEV__ = true)
 */
