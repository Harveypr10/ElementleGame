import { supabase } from './supabase';

/**
 * Activates holiday mode for a user, protecting their streak for the specified duration
 * @param userId User ID
 * @param durationDays Number of days to protect (up to 14)
 * @returns Success status and message
 */
export async function activateHolidayMode(userId: string, durationDays: number, startDate?: string) {
    const { data, error } = await supabase.rpc('activate_holiday_mode_mobile', {
        p_user_id: userId,
        p_duration_days: durationDays,
        p_start_date: startDate
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

// --- CLIENT-SIDE BADGE LOGIC REPLACEMENTS (RPCs are broken) ---

async function getBadgeByCriteria(category: string, threshold: number) {
    const { data, error } = await supabase
        .from('badges')
        .select('*')
        .eq('category', category)
        .eq('threshold', threshold)
        .maybeSingle();

    if (error) {
        console.error('[BadgeLogic] Error fetching badge definition:', error);
        return null;
    }
    return data;
}

async function getUserBadge(userId: string, badgeId: number, region: string, gameType: string) {
    // Note: user_badges likely has a unique index or logic on (user_id, badge_id, region, game_type)
    const { data, error } = await supabase
        .from('user_badges')
        .select('*')
        .match({
            user_id: userId,
            badge_id: badgeId,
            region: region,
            game_type: gameType
        })
        .maybeSingle();

    if (error) {
        // Ignore "multiple rows" error if distinct constraint missing, just take first
        if (error.code === 'PGRST116') return null; // Wait, maybeSingle handles 0 or 1. PGRST116 is JSON result mismatch sometimes.
        console.error('[BadgeLogic] Error checking user badge:', error);
    }
    return data;
}

export interface BadgeResult {
    id: number;
    badge_name: string;
    is_awarded: boolean;
    description?: string;
    category?: string;
    threshold?: number;
    badge_count?: number; // Added
    [key: string]: any;
}

/**
 * Checks and awards a streak badge if user qualifies
 */
export async function checkAndAwardStreakBadge(
    userId: string,
    streak: number,
    gameType: 'REGION' | 'USER',
    region: string
): Promise<BadgeResult | null> {
    try {
        // 1. Find Badge Definition
        // [FIX] Category is 'Streak' (Capitalized) in DB
        const badge = await getBadgeByCriteria('Streak', streak);
        if (!badge) return null; // No badge for this streak count

        // 2. Check if user already has it
        const existing = await getUserBadge(userId, badge.id, region, gameType);
        if (existing) {
            // Already has it, maybe update count? keeping it simple for now.
            return null;
        }

        // 3. Award Badge
        const { data: newBadge, error: insertError } = await supabase
            .from('user_badges')
            .insert({
                user_id: userId,
                badge_id: badge.id,
                region: region,
                game_type: gameType,
                is_awarded: false, // UI triggers popup
                badge_count: 1
            })
            .select()
            .single();

        if (insertError) {
            console.error('[BadgeLogic] Failed to award streak badge:', {
                error: insertError,
                code: insertError.code,
                message: insertError.message,
                userId,
                badgeId: badge.id,
                region,
                gameType,
                hint: insertError.code?.startsWith('PGRST') || insertError.message?.includes('policy')
                    ? 'LIKELY RLS ISSUE — check user_badges INSERT policy'
                    : insertError.code === '23505' ? 'Duplicate key — badge already exists'
                        : 'Unknown error'
            });
            return null;
        }

        // Return combined object as expected by UI
        return {
            ...newBadge,
            badge_name: badge.name, // RPC returns flattened structure or joined? 
            // The UI expects: badge: { name, description, category, threshold } nested OR flat?
            // checking BadgeUnlockModal usage: "badge" prop has { name, description... }
            // The return value of this function likely needs to match what useGameEngine expects.
            // useGameEngine calls it and logs "New streak badge awarded: streakBadge.badge_name"
            // So it expects property `badge_name` (snake_case) or `badge` object?
            // RPC usually returns flat columns if returns SETOF record. 
            // Let's assume flattened for safety based on "streakBadge.badge_name" log.
            description: 'You played ' + streak + ' days in a row!', // description might not be in badges table? (schema didn't show description column in badges table??)
            // Wait, schema for `badges`: id, name, category, threshold, iconUrl. NO DESCRIPTION.
            // Where does description come from?
            // Maybe it's generated? Or RPC joined it?
            // I'll provide a generated description.
            category: badge.category,
            threshold: badge.threshold
        };

    } catch (e) {
        console.error('[BadgeLogic] Exception in streak badge check:', e);
        return null;
    }
}

/**
 * Checks and awards an "Elementle In" badge for winning in 1 or 2 guesses
 */
export async function checkAndAwardElementleBadge(
    userId: string,
    guessCount: number,
    gameType: 'REGION' | 'USER',
    region: string
): Promise<BadgeResult | null> {
    try {
        // [FIX] Category is 'Elementle In' in DB
        const badge = await getBadgeByCriteria('Elementle In', guessCount);
        if (!badge) return null;

        const { data: existing } = await supabase
            .from('user_badges')
            .select('*')
            .eq('user_id', userId)
            .eq('badge_id', badge.id)
            .eq('region', region) // Strict region match
            .eq('game_type', gameType)
            .maybeSingle(); // Use maybeSingle to get object or null

        if (existing) {
            // [FIX] Re-Award Logic
            // Increment count, Reset is_awarded -> true (wait, we want to show it popup? So false?)
            // Previous logic inserted with false. 
            // We want the popup to trigger. Popup triggers if it finds pending badges (is_awarded=false).
            // So we set is_awarded = false.

            const newCount = (existing.badge_count || 1) + 1;
            console.log(`[BadgeLogic] Re-awarding elementle badge (Count: ${newCount})`);

            const { data: updatedBadge, error: updateError } = await supabase
                .from('user_badges')
                .update({
                    badge_count: newCount,
                    is_awarded: false,
                    awarded_at: new Date().toISOString()
                })
                .eq('id', existing.id)
                .select()
                .single();

            if (updateError) {
                console.error('[BadgeLogic] Failed to update existing badge:', updateError);
                return null;
            }

            return {
                ...updatedBadge,
                badge_name: badge.name,
                description: `You solved today's Elementle in ${guessCount} guess${guessCount > 1 ? 'es' : ''}!`,
                category: badge.category,
                threshold: badge.threshold
            };
        }

        // New Badge Insert
        const { data: newBadge, error: insertError } = await supabase
            .from('user_badges')
            .insert({
                user_id: userId,
                badge_id: badge.id,
                region: region,
                game_type: gameType,
                is_awarded: false,
                badge_count: 1
            })
            .select()
            .single();

        if (insertError) {
            // Handle duplicate key error (race condition)
            if (insertError.code === '23505') {
                console.log('[BadgeLogic] Duplicate key detected, fetching and updating existing badge');
                // Badge was inserted by another process, fetch and update it
                const { data: existingBadge } = await supabase
                    .from('user_badges')
                    .select('*')
                    .eq('user_id', userId)
                    .eq('badge_id', badge.id)
                    .eq('region', region)
                    .eq('game_type', gameType)
                    .maybeSingle();

                if (existingBadge) {
                    const newCount = (existingBadge.badge_count || 1) + 1;
                    const { data: updatedBadge } = await supabase
                        .from('user_badges')
                        .update({
                            badge_count: newCount,
                            is_awarded: false,
                            awarded_at: new Date().toISOString()
                        })
                        .eq('id', existingBadge.id)
                        .select()
                        .single();

                    if (updatedBadge) {
                        return {
                            ...updatedBadge,
                            badge_name: badge.name,
                            description: `You solved today's Elementle in ${guessCount} guess${guessCount > 1 ? 'es' : ''}!`,
                            category: badge.category,
                            threshold: badge.threshold
                        };
                    }
                }
            }

            console.error('[BadgeLogic] Failed to award elementle badge:', {
                error: insertError,
                code: insertError.code,
                message: insertError.message,
                userId,
                badgeId: badge.id,
                region,
                gameType,
                hint: insertError.code?.startsWith('PGRST') || insertError.message?.includes('policy')
                    ? 'LIKELY RLS ISSUE — check user_badges INSERT policy'
                    : 'Unknown error'
            });
            return null;
        }

        return {
            ...newBadge,
            badge_name: badge.name,
            description: `You solved today's Elementle in ${guessCount} guess${guessCount > 1 ? 'es' : ''}!`,
            category: badge.category,
            threshold: badge.threshold
        };

    } catch (e) {
        console.error('[BadgeLogic] Exception in elementle badge check:', e);
        return null;
    }
}

/**
 * Checks and awards a percentile badge based on user's rank
 */
export async function checkAndAwardPercentileBadge(
    userId: string,
    gameType: 'REGION' | 'USER',
    region: string
) {
    // Complex server-side calculation required. 
    // Skipping to prevent crashes until server RPC is fixed.
    console.log('[BadgeLogic] Percentile badge check skipped (requires server RPC)');
    return null;
}
