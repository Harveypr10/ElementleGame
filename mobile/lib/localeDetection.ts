/**
 * localeDetection.ts
 * Detects user's region and timezone from device locale settings.
 * Handles critical GB → UK mapping for backend compatibility.
 *
 * Cross-platform support:
 *  - iOS: NativeModules.SettingsManager (AppleLocale / AppleLanguages)
 *  - Android: NativeModules.I18nManager.localeIdentifier
 *  - Web: navigator.language / navigator.languages
 *  - Timezone: Intl.DateTimeFormat (universally supported)
 */

import { Platform, NativeModules } from 'react-native';

interface DetectedLocale {
    /** ISO country code, mapped for backend (e.g. 'UK' not 'GB') */
    regionCode: string;
    /** IANA timezone string (e.g. 'America/New_York') */
    timezone: string | null;
}

/**
 * Region code mappings — iOS/Android return ISO 3166-1 alpha-2 codes,
 * but our backend uses custom codes in some cases.
 */
const REGION_CODE_MAP: Record<string, string> = {
    'GB': 'UK',  // CRITICAL: iOS/Android return 'GB' for United Kingdom
};

/**
 * Extract a 2-letter region/country code from a locale string.
 * Handles formats like "en_GB", "en-GB", "en-US", "pt-BR", "en".
 * Returns empty string if no region can be extracted.
 */
function extractRegionFromLocale(locale: string): string {
    if (!locale) return '';

    // Split on underscore or hyphen
    const parts = locale.split(/[_-]/);

    // Walk from the end to find a 2-letter uppercase segment (the region)
    for (let i = parts.length - 1; i >= 0; i--) {
        const candidate = parts[i].toUpperCase();
        if (/^[A-Z]{2}$/.test(candidate) && candidate !== parts[0]?.toUpperCase()) {
            // Ensure we don't return the language code (e.g. "en") as a region
            return candidate;
        }
    }

    return '';
}

/**
 * Get the device's region/country code using platform-specific APIs.
 */
function getDeviceRegionCode(): string {
    try {
        if (Platform.OS === 'ios') {
            // iOS: NativeModules.SettingsManager is always available on iOS
            const settings = NativeModules.SettingsManager?.settings;
            if (!settings) {
                console.warn('[LocaleDetection] iOS SettingsManager not available');
                return '';
            }

            // AppleLocale: "en_GB" (older iOS) — most reliable
            // AppleLanguages: ["en-GB", "fr-FR"] (always present)
            const locale: string =
                settings.AppleLocale ||
                settings.AppleLanguages?.[0] ||
                '';

            return extractRegionFromLocale(locale);

        } else if (Platform.OS === 'android') {
            // Android: I18nManager.localeIdentifier returns e.g. "en_US", "pt_BR"
            const i18n = NativeModules.I18nManager;
            if (!i18n) {
                console.warn('[LocaleDetection] Android I18nManager not available');
                return '';
            }

            const locale: string = i18n.localeIdentifier || '';
            return extractRegionFromLocale(locale);

        } else if (Platform.OS === 'web') {
            // Web: use navigator.languages (preferred) or navigator.language
            if (typeof navigator === 'undefined') {
                console.warn('[LocaleDetection] navigator not available (SSR?)');
                return '';
            }

            const locale: string =
                navigator.languages?.[0] ||
                navigator.language ||
                '';

            return extractRegionFromLocale(locale);
        }
    } catch (e) {
        console.warn('[LocaleDetection] Error reading device region:', e);
    }

    return '';
}

/**
 * Get the device's timezone using the Intl API.
 * Intl.DateTimeFormat is universally supported (Hermes, V8, browsers).
 */
function getDeviceTimezone(): string | null {
    try {
        const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
        return tz || null;
    } catch (e) {
        console.warn('[LocaleDetection] Error reading timezone:', e);
        return null;
    }
}

/**
 * Detect the user's locale from the device.
 * Returns the region code (with GB→UK mapping applied) and timezone.
 * Safe to call on iOS, Android, and Web.
 */
export function detectUserLocale(): DetectedLocale {
    try {
        let regionCode = getDeviceRegionCode();
        const timezone = getDeviceTimezone();

        // Apply mappings (GB → UK, etc.)
        if (regionCode && REGION_CODE_MAP[regionCode]) {
            console.log(`[LocaleDetection] Mapping region code: ${regionCode} → ${REGION_CODE_MAP[regionCode]}`);
            regionCode = REGION_CODE_MAP[regionCode];
        }

        console.log(`[LocaleDetection] Platform: ${Platform.OS}, region: ${regionCode}, timezone: ${timezone}`);

        return { regionCode, timezone };
    } catch (e) {
        console.warn('[LocaleDetection] Failed to detect locale:', e);
        return { regionCode: '', timezone: null };
    }
}
