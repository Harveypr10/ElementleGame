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


async function determineAdStrategy(): Promise<{ provider: AdProvider; category: AgeCategory }> {
    const ageData = await getAgeVerification();

    if (!ageData) {
        console.log('[AdManager] No age data found - ads disabled');
        return { provider: 'none', category: 'child' };
    }

    const { ageDate } = ageData;
    const is16 = is16Plus(ageDate);
    const is18 = is18Plus(ageDate);

    if (!is16) {
        console.log('[AdManager] User is under 16 - NO ADS');
        return { provider: 'none', category: 'child' };
    } else if (!is18) {
        console.log('[AdManager] User is 16-17 - using AdMob (age-restricted)');
        return { provider: 'admob', category: 'teen' };
    } else {
        console.log('[AdManager] User is 18+ - using AdMob (full personalization)');
        return { provider: 'admob', category: 'adult' };
    }
}


async function initializeAdMob(ageRestricted: boolean): Promise<void> {
    try {
        await mobileAds().setRequestConfiguration({
            tagForChildDirectedTreatment: false,
            tagForUnderAgeOfConsent: ageRestricted,
            maxAdContentRating: ageRestricted ? MaxAdContentRating.PG : MaxAdContentRating.MA,
        });

        await mobileAds().initialize();
        console.log('[AdManager] AdMob initialized (age-restricted:', ageRestricted, ')');
    } catch (error) {
        console.error('[AdManager] AdMob initialization failed:', error);
        throw error;
    }
}


async function initializeAppLovin(isAgeRestricted: boolean): Promise<void> {
    try {
        console.log('[AdManager] AppLovin MAX not yet configured - using AdMob as fallback');
        await initializeAdMob(isAgeRestricted);
        activeProvider = 'admob';
    } catch (error) {
        console.error('[AdManager] Ad initialization failed:', error);
        activeProvider = 'none';
    }
}


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
            const useAgeRestricted = category === 'teen';
            await initializeAdMob(useAgeRestricted);
        } else if (provider === 'applovin') {
            await initializeAppLovin(category === 'teen');
        }

        activeProvider = provider;
        ageCategory = category;
        isInitialized = true;

        await AsyncStorage.multiSet([
            [AD_PROVIDER_KEY, provider],
            [AGE_CATEGORY_KEY, category],
        ]);

        console.log('[AdManager] Initialization complete:', { provider, category });
    } catch (error) {
        console.error('[AdManager] Initialization error:', error);
        activeProvider = 'none';
        isInitialized = true;
    }
}

export function getActiveProvider(): AdProvider {
    return activeProvider;
}

export function getAgeCategory(): AgeCategory {
    return ageCategory;
}

export function isAdsInitialized(): boolean {
    return isInitialized;
}

export async function resetAdManager(): Promise<void> {
    activeProvider = 'none';
    ageCategory = 'child';
    isInitialized = false;
    await AsyncStorage.multiRemove([AD_PROVIDER_KEY, AGE_CATEGORY_KEY]);
    console.log('[AdManager] Reset complete');
}

export function getBannerAdUnitId(): string {
    if (activeProvider === 'applovin') {
        return APPLOVIN_CONFIG.banner;
    }
    return ADMOB_CONFIG.banner;
}

export function getInterstitialAdUnitId(): string {
    if (activeProvider === 'applovin') {
        return APPLOVIN_CONFIG.interstitial;
    }
    return ADMOB_CONFIG.interstitial;
}