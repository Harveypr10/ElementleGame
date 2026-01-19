/**
 * Text Scaling Utilities
 * 
 * Provides consistent text size scaling across the app based on user preference.
 * Size multipliers applied to all text sizes.
 */

export type TextSizePreference = 'small' | 'medium' | 'large';

/**
 * Scale multipliers for each size preference
 * Medium (1.0) is baseline, small is 0.9, large is 1.1
 */
const SCALE_MULTIPLIERS: Record<TextSizePreference, number> = {
    small: 0.9,
    medium: 1.0,
    large: 1.1,
};

/**
 * Get the scale multiplier for a given text size preference
 */
export function getTextScale(preference: TextSizePreference): number {
    return SCALE_MULTIPLIERS[preference];
}

/**
 * Scale a font size value based on user preference
 * @param baseSize - Base font size in pixels
 * @param preference - User's text size preference
 * @returns Scaled font size
 */
export function scaleText(baseSize: number, preference: TextSizePreference): number {
    return Math.round(baseSize * getTextScale(preference));
}

/**
 * Common text sizes used throughout the app
 * These are base sizes that should be scaled
 */
export const TEXT_SIZES = {
    xs: 12,
    sm: 14,
    base: 16,
    lg: 18,
    xl: 20,
    '2xl': 24,
    '3xl': 30,
    '4xl': 36,
} as const;

/**
 * Get scaled version of common text sizes
 * @param sizeName - Name of the text size
 * @param preference - User's text size preference
 * @returns Scaled font size
 */
export function getScaledSize(sizeName: keyof typeof TEXT_SIZES, preference: TextSizePreference): number {
    return scaleText(TEXT_SIZES[sizeName], preference);
}
