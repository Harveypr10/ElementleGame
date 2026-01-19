import { supabase } from './supabase';

/**
 * Activates holiday mode for a user, protecting their streak for the specified duration
 * @param userId User ID
 * @param durationDays Number of days to protect (up to 14)
 * @returns Success status and message
 */
export async function activateHolidayMode(userId: string, durationDays: number) {
    const { data, error } = await supabase.rpc('activate_holiday_mode_mobile', {
        p_user_id: userId,
        p_duration_days: durationDays
    });

    if (error) throw error;
    return data?.[0] || data;
}

/**
 * Ends holiday mode for a user
 * @param userId User ID
 * @param acknowledge Whether user acknowledged the end (if false, shows popup on next login)
 * @returns Success status and message
 */
export async function endHolidayMode(userId: string, acknowledge: boolean = false) {
    const { data, error } = await supabase.rpc('end_holiday_mode_mobile', {
        p_user_id: userId,
        p_acknowledge: acknowledge
    });

    if (error) throw error;
    return data?.[0] || data;
}

/**
 * Checks and awards a streak badge if user qualifies
 * @param userId User ID
 * @param streak Current streak count
 * @param gameType 'REGION' or 'USER'
 * @param region Region code or 'GLOBAL'
 * @returns Badge data if awarded, null otherwise
 */
export async function checkAndAwardStreakBadge(
    userId: string,
    streak: number,
    gameType: 'REGION' | 'USER',
    region: string
) {
    const { data, error } = await supabase.rpc('check_and_award_streak_badge_mobile', {
        p_user_id: userId,
        p_streak: streak,
        p_game_type: gameType,
        p_region: region
    });

    if (error) throw error;
    return data?.[0] || null;
}

/**
 * Checks and awards an "Elementle In" badge for winning in 1 or 2 guesses
 * @param userId User ID
 * @param guessCount Number of guesses (1 or 2)
 * @param gameType 'REGION' or 'USER'
 * @param region Region code or 'GLOBAL'
 * @returns Badge data if awarded, null otherwise
 */
export async function checkAndAwardElementleBadge(
    userId: string,
    guessCount: number,
    gameType: 'REGION' | 'USER',
    region: string
) {
    const { data, error } = await supabase.rpc('check_and_award_elementle_badge_mobile', {
        p_user_id: userId,
        p_guess_count: guessCount,
        p_game_type: gameType,
        p_region: region
    });

    if (error) throw error;
    return data?.[0] || null;
}

/**
 * Checks and awards a percentile badge based on user's rank
 * @param userId User ID
 * @param gameType 'REGION' or 'USER'
 * @param region Region code or 'GLOBAL'
 * @returns Badge data if awarded, null otherwise
 */
export async function checkAndAwardPercentileBadge(
    userId: string,
    gameType: 'REGION' | 'USER',
    region: string
) {
    const { data, error } = await supabase.rpc('check_and_award_percentile_badge_mobile', {
        p_user_id: userId,
        p_game_type: gameType,
        p_region: region
    });

    if (error) throw error;
    return data?.[0] || null;
}
