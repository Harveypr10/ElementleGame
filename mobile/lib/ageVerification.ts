/**
 * Age Verification Utilities
 * 
 * Handles age calculation, storage, and compliance checks for
 * ad targeting (COPPA for under-16, age-restricted for 16-17, full for 18+).
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

// Storage keys
const AGE_DATE_KEY = 'user_age_date';
const IS_ADULT_KEY = 'user_is_adult';
const AGE_VERIFIED_KEY = 'user_age_verified';

export interface AgeVerificationData {
    ageDate: string;   // YYYY-MM-DD format
    isAdult: boolean;  // true if definitively 18+
}

/**
 * Calculate the age_date based on user's birth year and optional month.
 * 
 * Rules:
 * - If user is DEFINITELY 18+ (year alone confirms): age_date = YYYY-12-31
 * - If user is potentially under 18 (needs month): age_date = 1st of following month
 */
export function calculateAgeDate(year: number, month?: number): AgeVerificationData {
    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth() + 1; // 1-indexed
    const currentDay = new Date().getDate();

    // If year alone confirms 18+
    if (currentYear - year > 18) {
        return {
            ageDate: `${year}-12-31`,
            isAdult: true,
        };
    }

    // If year alone confirms under 18
    if (currentYear - year < 18) {
        // User provided month
        if (month !== undefined) {
            // Store as 1st of following month
            let targetMonth = month + 1;
            let targetYear = year;
            if (targetMonth > 12) {
                targetMonth = 1;
                targetYear = year + 1;
            }
            const monthStr = String(targetMonth).padStart(2, '0');
            return {
                ageDate: `${targetYear}-${monthStr}-01`,
                isAdult: false,
            };
        }
        // No month provided but year shows under 18
        return {
            ageDate: `${year}-12-31`,
            isAdult: false,
        };
    }

    // Exactly 18 years ago - need month to determine
    if (month !== undefined) {
        // Calculate exact age using conservative logic
        // Since we don't know the exact day, if we're in the birth month or before,
        // assume they haven't had their birthday yet (conservative for compliance)
        const birthMonth = month;
        const isBeforeBirthday = currentMonth <= birthMonth;

        const exactAge = isBeforeBirthday ? 17 : 18;

        // Store as 1st of following month
        let targetMonth = month + 1;
        let targetYear = year;
        if (targetMonth > 12) {
            targetMonth = 1;
            targetYear = year + 1;
        }
        const monthStr = String(targetMonth).padStart(2, '0');

        return {
            ageDate: `${targetYear}-${monthStr}-01`,
            isAdult: exactAge >= 18,
        };
    }

    // 18 years ago but no month - assume not adult (conservative for compliance)
    return {
        ageDate: `${year}-12-31`,
        isAdult: false,
    };
}

/**
 * Save age verification data to AsyncStorage
 */
export async function saveAgeVerification(year: number, month?: number): Promise<void> {
    const data = calculateAgeDate(year, month);

    await AsyncStorage.multiSet([
        [AGE_DATE_KEY, data.ageDate],
        [IS_ADULT_KEY, String(data.isAdult)],
        [AGE_VERIFIED_KEY, 'true'],
    ]);

    console.log('[AgeVerification] Saved:', data);
}

/**
 * Set age verification data directly from DB values
 * Used when syncing age data from user_profiles after login
 */
export async function setAgeVerificationDirect(ageDate: string, isAdult: boolean): Promise<void> {
    await AsyncStorage.multiSet([
        [AGE_DATE_KEY, ageDate],
        [IS_ADULT_KEY, String(isAdult)],
        [AGE_VERIFIED_KEY, 'true'],
    ]);

    console.log('[AgeVerification] Set from DB:', { ageDate, isAdult });
}

/**
 * Get age verification data from AsyncStorage
 */
export async function getAgeVerification(): Promise<AgeVerificationData | null> {
    try {
        const values = await AsyncStorage.multiGet([AGE_DATE_KEY, IS_ADULT_KEY]);
        const ageDate = values[0][1];
        const isAdult = values[1][1];

        if (!ageDate) {
            return null;
        }

        return {
            ageDate,
            isAdult: isAdult === 'true',
        };
    } catch (error) {
        console.error('[AgeVerification] Error reading:', error);
        return null;
    }
}

/**
 * Check if user has completed age verification
 */
export async function hasCompletedAgeVerification(): Promise<boolean> {
    try {
        const verified = await AsyncStorage.getItem(AGE_VERIFIED_KEY);
        return verified === 'true';
    } catch (error) {
        console.error('[AgeVerification] Error checking:', error);
        return false;
    }
}

/**
 * Calculate current age from stored age_date
 */
export function calculateCurrentAge(ageDate: string): number {
    const birthDate = new Date(ageDate);
    const today = new Date();

    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();

    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        age--;
    }

    return age;
}

/**
 * Check if user is 16 or older based on stored age_date
 * Used for determining AppLovin vs AdMob
 */
export function is16Plus(ageDate: string): boolean {
    return calculateCurrentAge(ageDate) >= 16;
}

/**
 * Check if user is 18 or older based on stored age_date
 * Used for determining full vs age-restricted ads
 */
export function is18Plus(ageDate: string): boolean {
    return calculateCurrentAge(ageDate) >= 18;
}

/**
 * Clear age verification (for testing/reset)
 */
export async function clearAgeVerification(): Promise<void> {
    await AsyncStorage.multiRemove([AGE_DATE_KEY, IS_ADULT_KEY, AGE_VERIFIED_KEY]);
    console.log('[AgeVerification] Cleared');
}
