/**
 * Ad Manager - Hybrid AdMob/AppLovin MAX SDK
 * 
 * Initializes the correct ad SDK based on user's age:
 * - Under 16: AdMob with COPPA compliance
 * - 16-17: AppLovin MAX with age-restricted settings
 * - 18+: AppLovin MAX with full personalization
 */

import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import mobileAds, { MaxAdContentRating } from 'react-native-google-mobile-ads';
import { getAgeVerification, is16Plus, is18Plus } from './ageVerification';

// Ad provider types
export type AdProvider = 'admob' | 'applovin' | 'none';
export type AgeCategory = 'child' | 'teen' | 'adult';

// Singleton state
let activeProvider: AdProvider = 'none';
let ageCategory: AgeCategory = 'child';
let isInitialized = false;

// Storage key for caching provider choice
const AD_PROVIDER_KEY = 'ad_manager_provider';
const AGE_CATEGORY_KEY = 'ad_manager_age_category';

/**
 * AppLovin MAX Configuration
 * TODO: Replace with actual SDK key and ad unit IDs from AppLovin dashboard
 */
export const APPLOVIN_CONFIG = {
    sdkKey: 'YOUR_APPLOVIN_SDK_KEY', // TODO: Replace
    banner: Platform.select({
        ios: 'YOUR_IOS_BANNER_AD_UNIT_ID',
        android: 'YOUR_ANDROID_BANNER_AD_UNIT_ID',
    }) ?? '',
    interstitial: Platform.select({
        ios: 'YOUR_IOS_INTERSTITIAL_AD_UNIT_ID',
        android: 'YOUR_ANDROID_INTERSTITIAL_AD_UNIT_ID',
    }) ?? '',
};

/**
 * AdMob Configuration (existing)
 */
export const ADMOB_CONFIG = {
    banner: Platform.select({
        ios: 'ca-app-pub-XXXXXXXXXXXXXXXX/YYYYYYYYYY',
        android: 'ca-app-pub-XXXXXXXXXXXXXXXX/YYYYYYYYYY',
    }) ?? '',
    interstitial: Platform.select({
        ios: 'ca-app-pub-XXXXXXXXXXXXXXXX/YYYYYYYYYY',
        android: 'ca-app-pub-XXXXXXXXXXXXXXXX/YYYYYYYYYY',
    }) ?? '',
};

/**
 * Determine which ad provider and settings to use based on age
 * 
 * Strategy:
 * - Under 16: NO ADS (compliance requirement)
 * - 16-17: AdMob with age-restricted settings (limited personalization)
 * - 18+: AdMob with full personalization
 * 
 * AppLovin MAX will be enabled when SDK key is available (post-launch)
 */
async function determineAdStrategy(): Promise<{ provider: AdProvider; category: AgeCategory }> {
    const ageData = await getAgeVerification();

    if (!ageData) {
        // No age verification = no ads (shouldn't happen after onboarding)
        console.log('[AdManager] No age data found - ads disabled');
        return { provider: 'none', category: 'child' };
    }

    const { ageDate } = ageData;
    const is16 = is16Plus(ageDate);
    const is18 = is18Plus(ageDate);

    if (!is16) {
        // Scenario A: Under 16 → NO ADS (COPPA compliance - no ads shown to children)
        console.log('[AdManager] User is under 16 - NO ADS');
        return { provider: 'none', category: 'child' };
    } else if (!is18) {
        // Scenario B: 16-17 → AdMob with age-restricted settings
        console.log('[AdManager] User is 16-17 - using AdMob (age-restricted)');
        return { provider: 'admob', category: 'teen' };
    } else {
        // Scenario C: 18+ → AdMob with full personalization
        console.log('[AdManager] User is 18+ - using AdMob (full personalization)');
        return { provider: 'admob', category: 'adult' };
    }
}

/**
 * Initialize AdMob with appropriate settings based on age category
 * - Age-restricted (teens 16-17): Limited personalization, PG content rating
 * - Full (adults 18+): Full personalization, MA content rating
 */
async function initializeAdMob(ageRestricted: boolean): Promise<void> {
    try {
        // Configure based on age category
        await mobileAds().setRequestConfiguration({
            // Only set for children (under 13 per COPPA), not teens
            tagForChildDirectedTreatment: false,
            // Set for under 18 (teens should have limited data collection)
            tagForUnderAgeOfConsent: ageRestricted,
            // PG for teens, MA for adults
            maxAdContentRating: ageRestricted ? MaxAdContentRating.PG : MaxAdContentRating.MA,
        });

        // Initialize
        await mobileAds().initialize();
        console.log('[AdManager] AdMob initialized (age-restricted:', ageRestricted, ')');
    } catch (error) {
        console.error('[AdManager] AdMob initialization failed:', error);
        throw error;
    }
}

/**
 * Initialize AppLovin MAX SDK
 * NOTE: This requires react-native-applovin-max to be installed
 */
async function initializeAppLovin(isAgeRestricted: boolean): Promise<void> {
    try {
        // NOTE: AppLovin MAX package must be installed separately:
        // npm install react-native-applovin-max
        // npx expo prebuild --clean

        // For now, fall back to AdMob since AppLovin may not be installed yet
        console.log('[AdManager] AppLovin MAX not yet configured - using AdMob as fallback');
        await initializeAdMob(isAgeRestricted);
        activeProvider = 'admob';

        // TODO: Uncomment when react-native-applovin-max is installed:
        // const AppLovinMAX = require('react-native-applovin-max').default;
        // if (isAgeRestricted) {
        //     await AppLovinMAX.setIsAgeRestrictedUser(true);
        // }
        // await AppLovinMAX.initialize(APPLOVIN_CONFIG.sdkKey);
        // console.log('[AdManager] AppLovin MAX initialized');
    } catch (error) {
        console.error('[AdManager] Ad initialization failed:', error);
        activeProvider = 'none';
    }
}

/**
 * Main initialization function - call this from _layout.tsx
 * @param force - If true, re-initialize even if already initialized (use after age changes)
 */
export async function initializeAds(force: boolean = false): Promise<void> {
    if (isInitialized && !force) {
        console.log('[AdManager] Already initialized, skipping');
        return;
    }

    if (force) {
        console.log('[AdManager] Force re-initialization requested');
    }

    try {
        const { provider, category } = await determineAdStrategy();

        if (provider === 'none') {
            activeProvider = 'none';
            ageCategory = 'child';
            isInitialized = true;
            return;
        }

        if (provider === 'admob') {
            // For teens (16-17): limited personalization (age-restricted)
            // For adults (18+): full personalization
            const useAgeRestricted = category === 'teen';
            await initializeAdMob(useAgeRestricted);
        } else if (provider === 'applovin') {
            // AppLovin path - will be enabled post-launch when SDK key is available
            await initializeAppLovin(category === 'teen');
        }

        // Store for quick access
        activeProvider = provider;
        ageCategory = category;
        isInitialized = true;

        // Cache to AsyncStorage
        await AsyncStorage.multiSet([
            [AD_PROVIDER_KEY, provider],
            [AGE_CATEGORY_KEY, category],
        ]);

        console.log('[AdManager] Initialization complete:', { provider, category });
    } catch (error) {
        console.error('[AdManager] Initialization error:', error);
        // Fail gracefully - no ads
        activeProvider = 'none';
        isInitialized = true;
    }
}

/**
 * Get the currently active ad provider
 */
export function getActiveProvider(): AdProvider {
    return activeProvider;
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
 * Reset ad manager (for testing)
 */
export async function resetAdManager(): Promise<void> {
    activeProvider = 'none';
    ageCategory = 'child';
    isInitialized = false;
    await AsyncStorage.multiRemove([AD_PROVIDER_KEY, AGE_CATEGORY_KEY]);
    console.log('[AdManager] Reset complete');
}

/**
 * Get banner ad unit ID for current provider
 */
export function getBannerAdUnitId(): string {
    if (activeProvider === 'applovin') {
        return APPLOVIN_CONFIG.banner;
    }
    return ADMOB_CONFIG.banner;
}

/**
 * Get interstitial ad unit ID for current provider
 */
export function getInterstitialAdUnitId(): string {
    if (activeProvider === 'applovin') {
        return APPLOVIN_CONFIG.interstitial;
    }
    return ADMOB_CONFIG.interstitial;
}
