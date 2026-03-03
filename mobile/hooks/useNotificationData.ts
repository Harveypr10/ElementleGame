import { useCallback, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface NotificationHydratedData {
    // Streaks
    regionStreak: number;
    userStreak: number;

    // Played today
    regionPlayedToday: boolean;
    userPlayedToday: boolean;

    // Event titles for today + tomorrow + drip days
    regionEventTitles: Record<string, string | null>;  // { '2026-03-02': 'Some Event', '2026-03-03': null, ... }
    userEventTitles: Record<string, string | null>;    // today & tomorrow only

    // User region
    userRegion: string;         // 'UK', 'US', etc.
    regionDisplayName: string;  // 'UK Edition', etc.

    // Holiday mode
    holidayActive: boolean;
    holidayEndDate: string | null;  // YYYY-MM-DD

    // Inventory (for drip campaign messaging)
    streakSaversRemaining: number;
    holidaySaversRemaining: number;

    // Timestamp of last hydration
    hydratedAt: number;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function getRegionDisplayName(region: string): string {
    const names: Record<string, string> = {
        'UK': 'UK Edition',
        'US': 'US Edition',
        'AU': 'Australian Edition',
    };
    return names[region] || `${region} Edition`;
}

function addDaysToDate(dateStr: string, days: number): string {
    const d = new Date(dateStr + 'T12:00:00');  // Noon to avoid DST issues
    d.setDate(d.getDate() + days);
    return d.toISOString().split('T')[0];
}

// ─── Standalone Fetch (no React state — safe for use in game-result) ────────

export async function fetchNotificationData(userId: string): Promise<NotificationHydratedData | null> {
    try {
        const todayStr = new Date().toISOString().split('T')[0];
        const tomorrowStr = addDaysToDate(todayStr, 1);

        const dripDayOffsets = [2, 3, 7, 14, 28];
        const dripDates = dripDayOffsets.map(d => addDaysToDate(todayStr, d));
        const allRegionDates = [todayStr, tomorrowStr, ...dripDates];
        const allUserDates = [todayStr, tomorrowStr];

        // ── 1. Stats for both modes ──
        const [regionStatsRes, userStatsRes] = await Promise.all([
            supabase.from('user_stats_region').select('*').eq('user_id', userId).maybeSingle(),
            supabase.from('user_stats_user').select('*').eq('user_id', userId).maybeSingle(),
        ]);

        const regionStats = regionStatsRes.data as any;
        const userStats = userStatsRes.data as any;

        const regionStreak = regionStats?.current_streak ?? 0;
        const userStreak = userStats?.current_streak ?? 0;
        const userRegion = regionStats?.region ?? 'UK';
        const holidayActive = userStats?.holiday_active ?? false;
        const holidayEndDate = userStats?.holiday_end_date ?? null;

        // ── 2. User tier/inventory ──
        let streakSaversRemaining = 0;
        let holidaySaversRemaining = 0;

        const { data: profile } = await supabase
            .from('user_profiles')
            .select('user_tier_id')
            .eq('id', userId)
            .maybeSingle();

        if (profile?.user_tier_id) {
            const { data: tier } = await supabase
                .from('user_tier')
                .select('streak_savers, holiday_savers')
                .eq('id', profile.user_tier_id)
                .maybeSingle();

            const tierData = tier as any;
            if (tierData) {
                streakSaversRemaining = Math.max(0,
                    (tierData.streak_savers ?? 0) - (regionStats?.streak_savers_used_month ?? 0)
                );
                holidaySaversRemaining = Math.max(0,
                    (tierData.holiday_savers ?? 0) - (userStats?.holidays_used_year ?? 0)
                );
            }
        }

        // ── 3. Played today? ──
        const [regionAttemptRes, userAttemptRes] = await Promise.all([
            supabase
                .from('game_attempts_region')
                .select('id, result, questions_allocated_region!inner(puzzle_date)')
                .eq('user_id', userId)
                .eq('questions_allocated_region.puzzle_date' as any, todayStr)
                .not('result', 'is', null)
                .maybeSingle(),
            supabase
                .from('game_attempts_user')
                .select('id, result, questions_allocated_user!inner(puzzle_date)')
                .eq('user_id', userId)
                .eq('questions_allocated_user.puzzle_date' as any, todayStr)
                .not('result', 'is', null)
                .maybeSingle(),
        ]);

        const regionPlayedToday = !!regionAttemptRes.data;
        const userPlayedToday = !!userAttemptRes.data;

        // ── 4. Region Event Titles (today, tomorrow, drip days) ──
        const regionEventTitles: Record<string, string | null> = {};
        const { data: regionAllocs } = await supabase
            .from('questions_allocated_region')
            .select('puzzle_date, question_id')
            .eq('region', userRegion)
            .in('puzzle_date', allRegionDates);

        if (regionAllocs && regionAllocs.length > 0) {
            const questionIds = regionAllocs.map((a: any) => a.question_id).filter(Boolean);
            const { data: masters } = await supabase
                .from('questions_master_region')
                .select('id, event_title')
                .in('id', questionIds);

            const masterMap = new Map((masters || []).map((m: any) => [m.id, m.event_title]));
            for (const alloc of regionAllocs) {
                regionEventTitles[(alloc as any).puzzle_date] =
                    masterMap.get((alloc as any).question_id) ?? null;
            }
        }
        for (const d of allRegionDates) {
            if (!(d in regionEventTitles)) regionEventTitles[d] = null;
        }

        // ── 5. User Event Titles (today & tomorrow only) ──
        const userEventTitles: Record<string, string | null> = {};
        const { data: userAllocs } = await supabase
            .from('questions_allocated_user')
            .select('puzzle_date, question_id')
            .eq('user_id', userId)
            .in('puzzle_date', allUserDates);

        if (userAllocs && userAllocs.length > 0) {
            const questionIds = userAllocs.map((a: any) => a.question_id).filter(Boolean);
            const { data: masters } = await supabase
                .from('questions_master_user')
                .select('id, event_title')
                .in('id', questionIds);

            const masterMap = new Map((masters || []).map((m: any) => [m.id, m.event_title]));
            for (const alloc of userAllocs) {
                userEventTitles[(alloc as any).puzzle_date] =
                    masterMap.get((alloc as any).question_id) ?? null;
            }
        }
        for (const d of allUserDates) {
            if (!(d in userEventTitles)) userEventTitles[d] = null;
        }

        const hydrated: NotificationHydratedData = {
            regionStreak,
            userStreak,
            regionPlayedToday,
            userPlayedToday,
            regionEventTitles,
            userEventTitles,
            userRegion,
            regionDisplayName: getRegionDisplayName(userRegion),
            holidayActive,
            holidayEndDate,
            streakSaversRemaining,
            holidaySaversRemaining,
            hydratedAt: Date.now(),
        };

        console.log('[NotificationData] Hydrated:', {
            regionStreak, userStreak,
            regionPlayedToday, userPlayedToday,
            holidayActive, holidayEndDate,
            streakSaversRemaining, holidaySaversRemaining,
            userRegion,
            regionTitlesCount: Object.keys(regionEventTitles).length,
            userTitlesCount: Object.keys(userEventTitles).length,
        });

        return hydrated;

    } catch (error) {
        console.error('[NotificationData] Hydration failed:', error);
        return null;
    }
}

// ─── Hook (with React state — for OptionsScreen and _layout.tsx) ────────────

export function useNotificationData() {
    const { user } = useAuth();
    const [data, setData] = useState<NotificationHydratedData | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const fetchingRef = useRef(false);

    const hydrate = useCallback(async (): Promise<NotificationHydratedData | null> => {
        if (!user || fetchingRef.current) return data;
        fetchingRef.current = true;
        setIsLoading(true);

        try {
            const hydrated = await fetchNotificationData(user.id);
            if (hydrated) setData(hydrated);
            return hydrated;
        } finally {
            fetchingRef.current = false;
            setIsLoading(false);
        }
    }, [user, data]);

    return { data, hydrate, isLoading };
}
