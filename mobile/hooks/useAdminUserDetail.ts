import { useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';

// ─── Types ──────────────────────────────────────────────────

export interface UserStats {
    games_played: number | null;
    games_won: number | null;
    current_streak: number | null;
    max_streak: number | null;
    streak_savers_used_month: number;
    holidays_used_year: number;
    holiday_active: boolean;
    holiday_days_taken_current_period: number;
    guess_distribution: any;
}

export interface UserSub {
    id: number;
    status: string;
    tier: string | null;
    billing_period: string;
    source: string | null;
    expires_at: string | null;
    amount_paid: number | null;
    currency: string;
    auto_renew: boolean;
    created_at: string;
}

export interface UserBadge {
    id: number;
    badge_id: number | null;
    badge_name: string | null;
    badge_category: string | null;
    is_awarded: boolean;
    awarded_at: string | null;
    badge_count: number;
    game_type: string;
    region: string;
}

export interface GameAttempt {
    id: number;
    result: string | null;
    num_guesses: number | null;
    completed_at: string | null;
    digits: string | null;
    streak_day_status: number | null;
    puzzle_date: string | null;
    event_title: string | null;
    answer_date: string | null;
    category_name: string | null;
}

export interface Guess {
    id: number;
    guess_value: string;
    guessed_at: string | null;
}

export interface LocationItem {
    id: number;
    location_id: string;
    allocation_active: boolean | null;
    score: number;
    questions_allocated: number | null;
    place_name: string | null;
    place_active: boolean | null;
}

export interface UserSetting {
    streak_saver_active: boolean;
    holiday_saver_active: boolean;
    dark_mode: boolean | null;
    sounds_enabled: boolean | null;
    clues_enabled: boolean | null;
    quick_menu_enabled: boolean | null;
    text_size: string | null;
    digit_preference: string | null;
}

export interface CategoryPref {
    id: number;
    category_id: number;
    category_name?: string | null;
}

// ─── Helper: compute average guesses from guess_distribution ─

function computeAvgGuesses(stats: UserStats | null): string {
    if (!stats || !stats.guess_distribution || !stats.games_won || stats.games_won === 0) return '—';
    const dist = stats.guess_distribution as Record<string, number>;
    let totalGuesses = 0;
    let totalWins = 0;
    for (const [guessNum, count] of Object.entries(dist)) {
        const numGuesses = parseInt(guessNum, 10);
        const numGames = typeof count === 'number' ? count : 0;
        if (!isNaN(numGuesses) && numGames > 0) {
            totalGuesses += numGuesses * numGames;
            totalWins += numGames;
        }
    }
    if (totalWins === 0) return '—';
    return (totalGuesses / totalWins).toFixed(1);
}

// ─── Hook ────────────────────────────────────────────────────

export function useAdminUserDetail(userId: string | null) {
    const [statsUser, setStatsUser] = useState<UserStats | null>(null);
    const [statsRegion, setStatsRegion] = useState<UserStats | null>(null);
    const [subs, setSubs] = useState<UserSub[]>([]);
    const [badges, setBadges] = useState<UserBadge[]>([]);
    const [gameAttemptsUser, setGameAttemptsUser] = useState<GameAttempt[]>([]);
    const [gameAttemptsRegion, setGameAttemptsRegion] = useState<GameAttempt[]>([]);
    const [locations, setLocations] = useState<LocationItem[]>([]);
    const [settings, setSettings] = useState<UserSetting | null>(null);
    const [categories, setCategories] = useState<CategoryPref[]>([]);
    const [guesses, setGuesses] = useState<Record<string, Guess[]>>({});
    const [loading, setLoading] = useState(false);
    const [tierConfigUser, setTierConfigUser] = useState<{ streak_savers: number; holiday_savers: number } | null>(null);

    const [allBadges, setAllBadges] = useState<{ id: number; name: string; category: string }[]>([]);
    const [allTiers, setAllTiers] = useState<{ id: string; tier: string; tier_type: string; billing_period: string; streak_savers: number; holiday_savers: number; holiday_duration_days: number }[]>([]);

    const fetchDetail = useCallback(async () => {
        if (!userId) return;
        setLoading(true);

        try {
            const [
                statsUserRes,
                statsRegionRes,
                subsRes,
                badgesRes,
                gamesUserRes,
                gamesRegionRes,
                locationsRes,
                settingsRes,
                categoriesRes,
                allBadgesRes,
            ] = await Promise.all([
                supabase.from('user_stats_user').select('*').eq('user_id', userId).single(),
                supabase.from('user_stats_region').select('*').eq('user_id', userId).limit(1).maybeSingle(),
                supabase.from('user_subscriptions').select('id, status, tier, billing_period, source, expires_at, amount_paid, currency, auto_renew, created_at').eq('user_id', userId).order('created_at', { ascending: false }),
                supabase.from('user_badges').select('id, badge_id, is_awarded, awarded_at, badge_count, game_type, region, badges ( name, category )').eq('user_id', userId).order('awarded_at', { ascending: false, nullsFirst: false }),
                // Game attempts - User mode: join allocated → master for puzzle_date + event_title + answer_date + category
                supabase.from('game_attempts_user').select(`
                    id, result, num_guesses, completed_at, digits, streak_day_status,
                    questions_allocated_user (
                        puzzle_date,
                        categories ( name ),
                        questions_master_user ( event_title, answer_date_canonical )
                    )
                `).eq('user_id', userId).order('completed_at', { ascending: false }).limit(50),
                // Game attempts - Region mode
                supabase.from('game_attempts_region').select(`
                    id, result, num_guesses, completed_at, digits, streak_day_status,
                    questions_allocated_region (
                        puzzle_date,
                        categories ( name ),
                        questions_master_region ( event_title, answer_date_canonical )
                    )
                `).eq('user_id', userId).order('completed_at', { ascending: false }).limit(50),
                // Locations
                supabase.from('location_allocation').select('id, location_id, allocation_active, score, questions_allocated, populated_places ( name1, active )').eq('user_id', userId).order('score', { ascending: false }),
                supabase.from('user_settings').select('streak_saver_active, holiday_saver_active, dark_mode, sounds_enabled, clues_enabled, quick_menu_enabled, text_size, digit_preference').eq('user_id', userId).single(),
                supabase.from('user_category_preferences').select('id, category_id, categories ( name )').eq('user_id', userId),
                supabase.from('badges').select('id, name, category').order('category').order('name'),
            ]);

            // Fetch user region first, then filter tiers by region
            const profileRes = await supabase.from('user_profiles').select('user_tier_id, region').eq('id', userId).single();
            const userRegion = profileRes.data?.region || 'uk';

            const allTiersRes = await supabase
                .from('user_tier')
                .select('id, tier, tier_type, billing_period, streak_savers, holiday_savers, holiday_duration_days')
                .eq('region', userRegion)
                .order('sort_order');

            if (statsUserRes.data) {
                setStatsUser(statsUserRes.data as unknown as UserStats);
                if (profileRes.data?.user_tier_id) {
                    const tierRes = await supabase.from('user_tier').select('streak_savers, holiday_savers').eq('id', profileRes.data.user_tier_id).single();
                    if (tierRes.data) setTierConfigUser(tierRes.data);
                }
            }

            if (statsRegionRes.data) setStatsRegion(statsRegionRes.data as unknown as UserStats);
            if (subsRes.data) setSubs(subsRes.data as UserSub[]);

            if (badgesRes.data) {
                setBadges((badgesRes.data as any[]).map(b => ({
                    ...b,
                    badge_name: b.badges?.name || null,
                    badge_category: b.badges?.category || null,
                })));
            }

            // Map game attempts user — extract nested join data
            if (gamesUserRes.data) {
                setGameAttemptsUser((gamesUserRes.data as any[]).map(g => {
                    const alloc = g.questions_allocated_user;
                    return {
                        id: g.id, result: g.result, num_guesses: g.num_guesses,
                        completed_at: g.completed_at, digits: g.digits,
                        streak_day_status: g.streak_day_status,
                        puzzle_date: alloc?.puzzle_date || null,
                        event_title: alloc?.questions_master_user?.event_title || null,
                        answer_date: alloc?.questions_master_user?.answer_date_canonical || null,
                        category_name: alloc?.categories?.name || null,
                    };
                }));
            }

            // Map game attempts region
            if (gamesRegionRes.data) {
                setGameAttemptsRegion((gamesRegionRes.data as any[]).map(g => {
                    const alloc = g.questions_allocated_region;
                    return {
                        id: g.id, result: g.result, num_guesses: g.num_guesses,
                        completed_at: g.completed_at, digits: g.digits,
                        streak_day_status: g.streak_day_status,
                        puzzle_date: alloc?.puzzle_date || null,
                        event_title: alloc?.questions_master_region?.event_title || null,
                        answer_date: alloc?.questions_master_region?.answer_date_canonical || null,
                        category_name: alloc?.categories?.name || null,
                    };
                }));
            }

            if (locationsRes.data) {
                setLocations((locationsRes.data as any[]).map(l => ({
                    id: l.id,
                    location_id: l.location_id,
                    allocation_active: l.allocation_active,
                    score: l.score,
                    questions_allocated: l.questions_allocated,
                    place_name: l.populated_places?.name1 || null,
                    place_active: l.populated_places?.active ?? null,
                })));
            }

            if (settingsRes.data) setSettings(settingsRes.data as unknown as UserSetting);

            if (categoriesRes.data) {
                setCategories((categoriesRes.data as any[]).map(c => ({
                    id: c.id,
                    category_id: c.category_id,
                    category_name: c.categories?.name || null,
                })));
            }

            if (allBadgesRes.data) setAllBadges(allBadgesRes.data as any[]);
            if (allTiersRes.data) setAllTiers(allTiersRes.data as any[]);

        } catch (err) {
            console.error('[AdminUserDetail] Error:', err);
        } finally {
            setLoading(false);
        }
    }, [userId]);

    const fetchGuesses = useCallback(async (attemptId: number, mode: 'user' | 'region') => {
        const key = `${mode}_${attemptId}`;
        if (guesses[key]) return;
        const table = mode === 'user' ? 'guesses_user' : 'guesses_region';
        const { data } = await supabase
            .from(table)
            .select('id, guess_value, guessed_at')
            .eq('game_attempt_id', attemptId)
            .order('guessed_at', { ascending: true });
        if (data) setGuesses(prev => ({ ...prev, [key]: data as Guess[] }));
    }, [guesses]);

    return {
        statsUser,
        statsRegion,
        subs,
        badges,
        gameAttemptsUser,
        gameAttemptsRegion,
        locations,
        settings,
        categories,
        guesses,
        loading,
        tierConfig: tierConfigUser,
        allBadges,
        allTiers,
        computeAvgGuesses,
        fetchDetail,
        fetchGuesses,
        refreshStats: async () => {
            if (!userId) return;
            const [userRes, regionRes] = await Promise.all([
                supabase.from('user_stats_user').select('*').eq('user_id', userId).single(),
                supabase.from('user_stats_region').select('*').eq('user_id', userId).limit(1).maybeSingle(),
            ]);
            if (userRes.data) setStatsUser(userRes.data as unknown as UserStats);
            if (regionRes.data) setStatsRegion(regionRes.data as unknown as UserStats);
        },
        refreshSettings: async () => {
            if (!userId) return;
            const res = await supabase.from('user_settings').select('streak_saver_active, holiday_saver_active, dark_mode, sounds_enabled, clues_enabled, quick_menu_enabled, text_size, digit_preference').eq('user_id', userId).single();
            if (res.data) setSettings(res.data as unknown as UserSetting);
        },
        refreshBadges: async () => {
            if (!userId) return;
            const res = await supabase.from('user_badges').select('id, badge_id, is_awarded, awarded_at, badge_count, game_type, region, badges ( name, category )').eq('user_id', userId).order('awarded_at', { ascending: false, nullsFirst: false });
            if (res.data) {
                setBadges((res.data as any[]).map(b => ({
                    ...b,
                    badge_name: b.badges?.name || null,
                    badge_category: b.badges?.category || null,
                })));
            }
        },
        refreshSubs: async () => {
            if (!userId) return;
            const res = await supabase.from('user_subscriptions').select('id, status, tier, billing_period, source, expires_at, amount_paid, currency, auto_renew, created_at').eq('user_id', userId).order('created_at', { ascending: false });
            if (res.data) setSubs(res.data as UserSub[]);
        },
        refreshGames: async (mode: 'user' | 'region') => {
            if (!userId) return;
            if (mode === 'user') {
                const res = await supabase.from('game_attempts_user').select(`
                    id, result, num_guesses, completed_at, digits, streak_day_status,
                    questions_allocated_user (
                        puzzle_date,
                        categories ( name ),
                        questions_master_user ( event_title, answer_date_canonical )
                    )
                `).eq('user_id', userId).order('completed_at', { ascending: false }).limit(50);
                if (res.data) {
                    setGameAttemptsUser((res.data as any[]).map(g => {
                        const alloc = g.questions_allocated_user;
                        return {
                            id: g.id, result: g.result, num_guesses: g.num_guesses,
                            completed_at: g.completed_at, digits: g.digits,
                            streak_day_status: g.streak_day_status,
                            puzzle_date: alloc?.puzzle_date || null,
                            event_title: alloc?.questions_master_user?.event_title || null,
                            answer_date: alloc?.questions_master_user?.answer_date_canonical || null,
                            category_name: alloc?.categories?.name || null,
                        };
                    }));
                }
            } else {
                const res = await supabase.from('game_attempts_region').select(`
                    id, result, num_guesses, completed_at, digits, streak_day_status,
                    questions_allocated_region (
                        puzzle_date,
                        categories ( name ),
                        questions_master_region ( event_title, answer_date_canonical )
                    )
                `).eq('user_id', userId).order('completed_at', { ascending: false }).limit(50);
                if (res.data) {
                    setGameAttemptsRegion((res.data as any[]).map(g => {
                        const alloc = g.questions_allocated_region;
                        return {
                            id: g.id, result: g.result, num_guesses: g.num_guesses,
                            completed_at: g.completed_at, digits: g.digits,
                            streak_day_status: g.streak_day_status,
                            puzzle_date: alloc?.puzzle_date || null,
                            event_title: alloc?.questions_master_region?.event_title || null,
                            answer_date: alloc?.questions_master_region?.answer_date_canonical || null,
                            category_name: alloc?.categories?.name || null,
                        };
                    }));
                }
            }
        },
    };
}
