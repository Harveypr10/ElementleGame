import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import mobileAds, { MaxAdContentRating } from 'react-native-google-mobile-ads';
import { getAgeVerification, is16Plus, is18Plus } from './ageVerification';

// ============================================================================
// Ad Provider Strategy
//
// The age-based provider routing is:
//   Under 16  → 'none'   (COPPA — no ads)
//   16-17     → 'admob'  (age-restricted content rating)
//   18+       → 'admob'  (full personalization; AppLovin when IDs available)
//
// AppLovin MAX is the *intended* provider for 18+ users once production IDs
// are obtained (requires a live app). Until then, the 18+ path falls through
// to AdMob. AppLovin setup code is kept dormant behind USE_APPLOVIN_FOR_ADULTS.
// ============================================================================

/** Toggle to `true` once production AppLovin IDs are configured. */
const USE_APPLOVIN_FOR_ADULTS = false;

// --- Types -----------------------------------------------------------------

export type AdProvider = 'admob' | 'applovin' | 'none';
export type AgeCategory = 'child' | 'teen' | 'adult';

// --- Singleton state -------------------------------------------------------

let activeProvider: AdProvider = 'none';
let ageCategory: AgeCategory = 'child';
let isInitialized = false;

const AD_PROVIDER_KEY = 'ad_manager_provider';
const AGE_CATEGORY_KEY = 'ad_manager_age_category';

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

/**
 * AppLovin MAX config — dormant until USE_APPLOVIN_FOR_ADULTS is enabled.
 * Replace placeholder IDs with production values from the AppLovin dashboard
 * once the app is live and an account is approved.
 */
export const APPLOVIN_CONFIG = {
    sdkKey: 'YOUR_APPLOVIN_SDK_KEY',
    banner: Platform.select({
        ios: 'YOUR_IOS_BANNER_AD_UNIT_ID',
        android: 'YOUR_ANDROID_BANNER_AD_UNIT_ID',
    }) ?? '',
    interstitial: Platform.select({
        ios: 'YOUR_IOS_INTERSTITIAL_AD_UNIT_ID',
        android: 'YOUR_ANDROID_INTERSTITIAL_AD_UNIT_ID',
    }) ?? '',
};

// --- Age-Based Strategy ----------------------------------------------------

async function determineAdStrategy(): Promise<{ provider: AdProvider; category: AgeCategory }> {
    const ageData = await getAgeVerification();

    if (!ageData) {
        console.log('[AdManager] No age data found — ads disabled');
        return { provider: 'none', category: 'child' };
    }

    const { ageDate } = ageData;

    if (!is16Plus(ageDate)) {
        // COPPA — no advertising at all
        console.log('[AdManager] Under 16 — NO ADS');
        return { provider: 'none', category: 'child' };
    }

    if (!is18Plus(ageDate)) {
        // 16-17: Always AdMob with age-restricted content rating
        console.log('[AdManager] 16-17 — AdMob (age-restricted)');
        return { provider: 'admob', category: 'teen' };
    }

    // 18+: AppLovin when enabled, otherwise AdMob with full personalization
    if (USE_APPLOVIN_FOR_ADULTS) {
        console.log('[AdManager] 18+ — AppLovin MAX');
        return { provider: 'applovin', category: 'adult' };
    }

    console.log('[AdManager] 18+ — AdMob (full personalization, AppLovin deferred)');
    return { provider: 'admob', category: 'adult' };
}

// --- SDK Initializers ------------------------------------------------------

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

/**
 * Dormant — will be activated when USE_APPLOVIN_FOR_ADULTS = true and
 * production IDs are configured above.  Currently falls back to AdMob.
 */
async function initializeAppLovin(_isAgeRestricted: boolean): Promise<void> {
    // TODO: Replace this fallback with real AppLovin MAX SDK initialization
    // once production IDs are available:
    //   import AppLovinMAX from 'react-native-applovin-max';
    //   AppLovinMAX.initialize(APPLOVIN_CONFIG.sdkKey);
    console.log('[AdManager] AppLovin MAX not yet configured — falling back to AdMob');
    await initializeAdMob(_isAgeRestricted);
    activeProvider = 'admob';
}

// --- Public API ------------------------------------------------------------

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

        if (provider === 'applovin') {
            await initializeAppLovin(category === 'teen');
        } else {
            await initializeAdMob(category === 'teen');
        }

        activeProvider = provider === 'applovin' ? activeProvider : provider;
        ageCategory = category;
        isInitialized = true;

        await AsyncStorage.multiSet([
            [AD_PROVIDER_KEY, activeProvider],
            [AGE_CATEGORY_KEY, category],
        ]);

        console.log('[AdManager] Initialization complete:', { provider: activeProvider, category });
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