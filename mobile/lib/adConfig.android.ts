/**
 * Android-specific AdConfig — No-op implementation.
 * 
 * Provides dummy ad unit IDs since react-native-google-mobile-ads
 * is not available on Android.
 */

interface AdConfig {
    banner: string;
    interstitial: string;
}

const DUMMY_AD_UNITS: AdConfig = {
    banner: 'DUMMY_BANNER_ID',
    interstitial: 'DUMMY_INTERSTITIAL_ID',
};

export const AD_UNITS = DUMMY_AD_UNITS;
