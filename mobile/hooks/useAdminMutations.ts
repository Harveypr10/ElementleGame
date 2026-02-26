import { useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth';

// ─── Audit Log Helper ─────────────────────────────────────────
async function logAction(
    adminId: string,
    targetUserId: string,
    actionType: string,
    description: string,
    previousState?: any,
    newState?: any,
) {
    const { error } = await supabase.from('admin_action_logs').insert({
        admin_id: adminId,
        target_user_id: targetUserId,
        action_type: actionType,
        description,
        previous_state: previousState || null,
        new_state: newState || null,
    });
    if (error) console.error('[AuditLog] Failed to log action:', error);
}

// ─── Validation Helpers ──────────────────────────────────────
export function validateNonNegative(value: number, fieldName: string): string | null {
    if (value < 0) return `${fieldName} cannot be negative.`;
    if (!Number.isInteger(value)) return `${fieldName} must be a whole number.`;
    return null;
}

export function validateFutureDate(date: string | null): string | null {
    if (!date) return null; // Lifetime = no expiry
    const d = new Date(date);
    if (isNaN(d.getTime())) return 'Invalid date.';
    if (d <= new Date()) return 'Expiry date must be in the future.';
    return null;
}

// ─── Hook ──────────────────────────────────────────────────────
export function useAdminMutations() {
    const { user } = useAuth();
    const adminId = user?.id || '';

    // ── Toggle Settings ──────────────────────────────────────
    const toggleSetting = useCallback(async (
        targetUserId: string,
        field: 'streak_saver_active' | 'holiday_saver_active',
        currentValue: boolean,
    ) => {
        const newValue = !currentValue;
        const { error } = await supabase
            .from('user_settings')
            .update({ [field]: newValue })
            .eq('user_id', targetUserId);

        if (error) {
            console.error('[Mutations] Toggle setting error:', error);
            return { success: false, error: error.message };
        }

        await logAction(
            adminId, targetUserId, 'toggle_setting',
            `Set ${field} to ${newValue}`,
            { [field]: currentValue },
            { [field]: newValue },
        );

        return { success: true };
    }, [adminId]);

    // ── Edit Stat Value ──────────────────────────────────────
    const editStat = useCallback(async (
        targetUserId: string,
        field: string,
        currentValue: number,
        newValue: number,
        label: string,
        mode: 'user' | 'region' = 'user',
    ) => {
        const validationError = validateNonNegative(newValue, label);
        if (validationError) return { success: false, error: validationError };

        const table = mode === 'region' ? 'user_stats_region' : 'user_stats_user';
        const { error } = await supabase
            .from(table)
            .update({ [field]: newValue })
            .eq('user_id', targetUserId);

        if (error) {
            console.error('[Mutations] Edit stat error:', error);
            return { success: false, error: error.message };
        }

        await logAction(
            adminId, targetUserId, 'edit_stat',
            `Changed ${label} from ${currentValue} to ${newValue}`,
            { [field]: currentValue },
            { [field]: newValue },
        );

        return { success: true };
    }, [adminId]);

    // ── Award Badge ──────────────────────────────────────────
    const awardBadge = useCallback(async (
        targetUserId: string,
        badgeId: number,
        badgeName: string,
    ) => {
        // Check if user has a row for this badge already
        const { data: existing } = await supabase
            .from('user_badges')
            .select('id, is_awarded')
            .eq('user_id', targetUserId)
            .eq('badge_id', badgeId)
            .maybeSingle();

        if (existing && existing.is_awarded) {
            return { success: false, error: 'Badge already awarded.' };
        }

        let error;
        if (existing) {
            // Update existing row
            const res = await supabase
                .from('user_badges')
                .update({ is_awarded: true, awarded_at: new Date().toISOString() })
                .eq('id', existing.id);
            error = res.error;
        } else {
            // Insert new row
            const res = await supabase
                .from('user_badges')
                .insert({
                    user_id: targetUserId,
                    badge_id: badgeId,
                    is_awarded: true,
                    awarded_at: new Date().toISOString(),
                    badge_count: 1,
                });
            error = res.error;
        }

        if (error) {
            console.error('[Mutations] Award badge error:', error);
            return { success: false, error: error.message };
        }

        await logAction(
            adminId, targetUserId, 'award_badge',
            `Awarded badge: ${badgeName}`,
            null,
            { badge_id: badgeId, badge_name: badgeName },
        );

        return { success: true };
    }, [adminId]);

    // ── Assign Subscription (via RPC) ────────────────────────
    const assignSubscription = useCallback(async (
        targetUserId: string,
        tierId: string,
        tierName: string,
        billingPeriod: string,
        expiresAt: string | null,
        autoRenew: boolean,
    ) => {
        // Validate expiry for non-lifetime
        if (expiresAt) {
            const dateError = validateFutureDate(expiresAt);
            if (dateError) return { success: false, error: dateError };
        }

        const { error } = await supabase.rpc('admin_assign_subscription', {
            p_user_id: targetUserId,
            p_user_tier_id: tierId,
            p_tier: tierName,
            p_billing_period: billingPeriod,
            p_expires_at: expiresAt,
            p_auto_renew: autoRenew,
        });

        if (error) {
            console.error('[Mutations] Assign subscription error:', error);
            return { success: false, error: error.message };
        }

        // Audit log is handled inside the RPC function
        return { success: true };
    }, []);

    // ── Edit Streak Day Status on game attempt ───────────────
    const editStreakDayStatus = useCallback(async (
        targetUserId: string,
        attemptId: number,
        currentValue: number | null,
        newValue: number | null,
        mode: 'user' | 'region',
    ) => {
        // Validate: must be null, 0, or 1
        if (newValue !== null && newValue !== 0 && newValue !== 1) {
            return { success: false, error: 'streak_day_status must be NULL, 0, or 1.' };
        }

        const table = mode === 'user' ? 'game_attempts_user' : 'game_attempts_region';
        const { error } = await supabase
            .from(table)
            .update({ streak_day_status: newValue })
            .eq('id', attemptId);

        if (error) {
            console.error('[Mutations] Edit streak_day_status error:', error);
            return { success: false, error: error.message };
        }

        await logAction(
            adminId, targetUserId, 'edit_streak_day_status',
            `Changed streak_day_status from ${currentValue ?? 'NULL'} to ${newValue ?? 'NULL'} on ${mode} attempt #${attemptId}`,
            { streak_day_status: currentValue },
            { streak_day_status: newValue },
        );

        return { success: true };
    }, [adminId]);

    return {
        toggleSetting,
        editStat,
        awardBadge,
        assignSubscription,
        editStreakDayStatus,
    };
}
