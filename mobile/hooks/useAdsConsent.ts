/**
 * useAdsConsent — Google UMP + Apple ATT consent hook
 *
 * Wraps AdsConsent from react-native-google-mobile-ads to provide:
 *   - triggerConsentFlow()  — call from onboarding (guest play) or Home Screen
 *   - privacyOptionsRequired — whether a "Manage Privacy" button should show
 *   - showPrivacyOptions()  — opens the UMP privacy form to change consent
 *
 * The flow strictly follows Google's UMP guidelines:
 *   1. AdsConsent.gatherConsent()  (requestInfoUpdate + loadFormIfRequired)
 *   2. Only AFTER consent resolves: mobileAds().initialize()
 *
 * The SDK handles de-duplication: if the user already consented, gatherConsent()
 * resolves immediately without showing any UI.
 */

import { useRef, useState, useCallback } from 'react';
import { Platform } from 'react-native';
import mobileAds, { AdsConsent, AdsConsentPrivacyOptionsRequirementStatus } from 'react-native-google-mobile-ads';
import { markAdsInitialized } from '../lib/AdManager';

let isMobileAdsInitialized = false;

async function startGoogleMobileAdsSDK(): Promise<void> {
    if (isMobileAdsInitialized) return;

    const { canRequestAds } = await AdsConsent.getConsentInfo();

    if (!canRequestAds) {
        console.log('[AdsConsent] canRequestAds is false — skipping SDK init');
        return;
    }

    isMobileAdsInitialized = true;
    console.log('[AdsConsent] Initializing Google Mobile Ads SDK...');
    await mobileAds().initialize();
    markAdsInitialized(); // Notify AdBanner/interstitial components
    console.log('[AdsConsent] Google Mobile Ads SDK initialized');
}

export function useAdsConsent() {
    const hasTriggeredRef = useRef(false);
    const [privacyOptionsRequired, setPrivacyOptionsRequired] = useState(false);

    /**
     * Trigger the full UMP consent flow, then initialize ads.
     * Safe to call multiple times — the SDK and our ref both deduplicate.
     */
    const triggerConsentFlow = useCallback(async (): Promise<void> => {
        // Skip on web — no native ads
        if (Platform.OS === 'web') return;

        // Only trigger the full flow once per app session
        // (subsequent calls still attempt SDK init in case consent was obtained)
        if (!hasTriggeredRef.current) {
            hasTriggeredRef.current = true;

            try {
                console.log('[AdsConsent] Starting consent flow...');
                const consentInfo = await AdsConsent.gatherConsent();
                console.log('[AdsConsent] Consent gathered:', consentInfo);

                // Check if "Privacy Options" button should be shown (GDPR requirement)
                setPrivacyOptionsRequired(
                    consentInfo.privacyOptionsRequirementStatus === AdsConsentPrivacyOptionsRequirementStatus.REQUIRED
                );
            } catch (error) {
                console.error('[AdsConsent] Consent flow error:', error);
            }
        }

        // Always attempt SDK init (idempotent — checks canRequestAds internally)
        try {
            await startGoogleMobileAdsSDK();
        } catch (error) {
            console.error('[AdsConsent] SDK init error:', error);
        }
    }, []);

    /**
     * Open the UMP privacy options form (for users to change consent).
     * Only call if privacyOptionsRequired is true.
     */
    const showPrivacyOptions = useCallback(async (): Promise<void> => {
        try {
            await AdsConsent.showPrivacyOptionsForm();
        } catch (error) {
            console.error('[AdsConsent] Privacy options form error:', error);
        }
    }, []);

    return {
        triggerConsentFlow,
        privacyOptionsRequired,
        showPrivacyOptions,
    };
}
