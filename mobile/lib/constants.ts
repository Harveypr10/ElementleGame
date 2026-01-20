/**
 * Constants
 * 
 * Centralized application constants
 */

// Game Rules
export const GAME_RULES = {
    MAX_GUESSES: 5,
    DATE_LENGTH_6: 6,
    DATE_LENGTH_8: 8,
    MIN_DATE: new Date(2022, 0, 1), // January 1, 2022
    MAX_DATE: new Date(), // Today
} as const;

// API Configuration  
export const API = {
    SUPABASE_URL: process.env.EXPO_PUBLIC_SUPABASE_URL || '',
    SUPABASE_ANON_KEY: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '',
} as const;

// Cache Keys
export const CACHE_KEYS = {
    ARCHIVE_PREFIX: 'archive',
    STATS_PREFIX: 'stats',
    GUESS_PREFIX: 'guess',
    USER_PROFILE: 'user_profile',
} as const;

// Animation Configs
export const ANIMATIONS = {
    SPRING_CONFIG: {
        damping: 15,
        stiffness: 150,
    },
    TIMING_FAST: 150,
    TIMING_MEDIUM: 300,
    TIMING_SLOW: 500,
    STAGGER_DELAY: 100,
} as const;

// Color Palette
export const COLORS = {
    // Game feedback
    CORRECT: '#10b981', // green-500
    IN_SEQUENCE: '#fbbf24', // amber-400
    RULED_OUT: '#6b7280', // gray-500
    DEFAULT: '#e2e8f0', // slate-200

    // Modes
    REGION_PRIMARY: '#7DAAE8', // Blue
    REGION_SECONDARY: '#A4DB57', // Green
    REGION_TERTIARY: '#FFD429', // Yellow

    USER_PRIMARY: '#66becb', // Lighter blue
    USER_SECONDARY: '#93cd78', // Lighter green
    USER_TERTIARY: '#fdab58', // Orange

    // Brand
    BRAND_BLUE: '#3b82f6',
    BRAND_GREEN: '#10b981',
    BRAND_YELLOW: '#fbbf24',

    // UI
    BACKGROUND_LIGHT: '#ffffff',
    BACKGROUND_DARK: '#0f172a', // slate-900
    CARD_LIGHT: '#ffffff',
    CARD_DARK: '#1e293b', // slate-800
    TEXT_LIGHT: '#0f172a',
    TEXT_DARK: '#f1f5f9',
} as const;

// Typography Scale
export const TYPOGRAPHY = {
    SCALE_SMALL: 0.875,
    SCALE_MEDIUM: 1.0,
    SCALE_LARGE: 1.125,
    SCALE_XLARGE: 1.25,

    SIZES: {
        XS: 12,
        SM: 14,
        BASE: 16,
        LG: 18,
        XL: 20,
        '2XL': 24,
        '3XL': 30,
        '4XL': 36,
    },
} as const;

// Feature Flags
export const FEATURES = {
    ENABLE_HAPTICS: true,
    ENABLE_SOUNDS: true,
    ENABLE_ANIMATIONS: true,
    ENABLE_GUEST_MODE: true,
    ENABLE_HOLIDAY_MODE: true,
    ENABLE_STREAK_SAVER: true,
} as const;

// Timing Constants
export const TIMING = {
    MIN_LOADING_TIME: 1500, // 1.5s minimum to prevent flicker
    TOAST_DURATION: 3000, // 3s
    BADGE_DISPLAY_DURATION: 3000, // 3s
    MODAL_ANIMATION_DURATION: 300, // 300ms
} as const;

// Storage Keys
export const STORAGE_KEYS = {
    IS_GUEST: 'is_guest',
    GUEST_GAMES: 'guest_games_data',
    GUEST_INTERACTIONS: 'guest_interactions_count',
    GUEST_PROMPT_DISMISSED: 'guest_prompt_dismissed',
    MIGRATION_COMPLETE: 'guest_migration_complete',
    FIRST_LAUNCH: 'first_launch',
    LAST_REVIEW_PROMPT: 'last_review_prompt',
} as const;

// App URLs
export const URLS = {
    WEBSITE: 'https://elementle.com',
    PRIVACY_POLICY: 'https://elementle.com/privacy',
    TERMS_OF_SERVICE: 'https://elementle.com/terms',
    SUPPORT: 'https://elementle.com/support',
} as const;
