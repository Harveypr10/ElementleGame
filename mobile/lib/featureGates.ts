/**
 * Feature Gating Utilities
 * 
 * Manages access control for premium features based on user authentication status.
 * Provides hooks and helpers to gate features for guest users.
 */

export type GatedFeature =
    | 'archive'
    | 'stats'
    | 'streak_saver'
    | 'badges'
    | 'pro_subscription'
    | 'holiday_mode';

interface FeatureConfig {
    name: string;
    description: string;
    requiresAuth: boolean;
    requiresPro?: boolean;
}

export const FEATURE_GATES: Record<GatedFeature, FeatureConfig> = {
    archive: {
        name: 'Archive',
        description: 'Access past puzzles and track your history',
        requiresAuth: true,
    },
    stats: {
        name: 'Stats',
        description: 'View detailed statistics and achievements',
        requiresAuth: true,
    },
    streak_saver: {
        name: 'Streak Savers',
        description: 'Save your streaks when you miss a day',
        requiresAuth: true,
    },
    badges: {
        name: 'Badges',
        description: 'Earn and collect achievement badges',
        requiresAuth: true,
    },
    pro_subscription: {
        name: 'Pro Features',
        description: 'Unlock premium features and benefits',
        requiresAuth: true,
        requiresPro: false, // Can subscribe without Pro
    },
    holiday_mode: {
        name: 'Holiday Mode',
        description: 'Protect your streak while on vacation',
        requiresAuth: true,
        requiresPro: true,
    },
};

/**
 * Check if a user has access to a feature
 */
export function hasFeatureAccess(
    feature: GatedFeature,
    isAuthenticated: boolean,
    isPro: boolean = false
): boolean {
    const config = FEATURE_GATES[feature];

    if (config.requiresAuth && !isAuthenticated) {
        return false;
    }

    if (config.requiresPro && !isPro) {
        return false;
    }

    return true;
}

/**
 * Get feature configuration
 */
export function getFeatureConfig(feature: GatedFeature): FeatureConfig {
    return FEATURE_GATES[feature];
}
