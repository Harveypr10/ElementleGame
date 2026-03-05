/**
 * useLeagueData.ts — League data fetching + caching hook
 *
 * Provides:
 *  - List of user's leagues (with tabs for the league table view)
 *  - Standings for a selected league + timeframe
 *  - Rank view recording (Yesterday's Baseline)
 *  - League creation and joining RPCs
 *  - Global identity + per-league nickname management
 *  - Leave/rejoin/delete league membership
 *
 * Uses React Query for caching + auto-refetch on focus.
 */

import { useQuery, useMutation, useQueryClient, QueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth';

// ─── Types ──────────────────────────────────────────────────────────────

export type GameMode = 'region' | 'user';

export type League = {
    id: string;
    name: string;
    admin_user_id: string | null;
    is_system_league: boolean;
    system_region: string | null;
    share_link_public: boolean;
    join_code: string | null;
    created_at: string;
    member_count?: number;
    has_region_board?: boolean;
    has_user_board?: boolean;
};

/** Extended league type for the manage screen (includes membership info) */
export type LeagueWithMembership = League & {
    league_nickname: string;
    is_active: boolean;
    can_share: boolean;
    is_active_region: boolean;
    is_active_user: boolean;
    has_region_board: boolean;
    has_user_board: boolean;
    admin_display_name?: string;
    admin_tag?: string;
};

export type LeagueMember = {
    league_id: string;
    user_id: string;
    league_nickname: string;
    can_share: boolean;
    is_active: boolean;
    yesterdays_rank: number | null;
    last_seen_rank: number | null;
    global_display_name: string;
    global_tag: string;
};

export type StandingRow = {
    rank: number | null;
    user_id: string;
    league_nickname: string;
    global_display_name: string;
    global_tag: string;
    elementle_rating: number | null;
    current_streak: number | null;
    games_played: number;
    games_won: number | null;
    win_rate: number | null;
    avg_guesses: number | null;
    is_me: boolean;
    yesterdays_rank: number | null;
    is_unranked?: boolean;
};

export type StandingsResponse = {
    standings: StandingRow[];
    my_rank: number | null;
    total_members: number;
    is_historical?: boolean;
    period_label?: string;
    min_games_threshold?: number;
};

export type Medal = {
    league_id: string;
    league_name: string;
    timeframe: string;
    period_label: string;
    medal: 'gold' | 'silver' | 'bronze';
    elementle_rating: number;
    awarded_at: string;
};

export type PercentileBadge = {
    timeframe: string;
    period_label: string;
    percentile_rank: number;
    percentile_tier: string;
    elementle_rating: number;
    total_ranked: number;
    awarded_at: string;
};

export type MyAwards = {
    medals: Medal[];
    percentile_badges: PercentileBadge[];
};

export type Timeframe = 'mtd' | 'ytd';

export type GlobalIdentity = {
    global_display_name: string;
    global_tag: string;
};

// ─── Query Keys ─────────────────────────────────────────────────────────

const leagueKeys = {
    all: ['leagues'] as const,
    myLeagues: (userId: string, gameMode: GameMode) => ['leagues', 'my', userId, gameMode] as const,
    myLeaguesAll: (userId: string) => ['leagues', 'my-all', userId] as const,
    standings: (leagueId: string, timeframe: Timeframe, gameMode: GameMode) =>
        ['leagues', 'standings', leagueId, timeframe, gameMode] as const,
    historicalStandings: (leagueId: string, timeframe: Timeframe, periodLabel: string, gameMode: GameMode) =>
        ['leagues', 'historical', leagueId, timeframe, periodLabel, gameMode] as const,
    member: (leagueId: string, userId: string) =>
        ['leagues', 'member', leagueId, userId] as const,
    globalIdentity: (userId: string) => ['leagues', 'global-identity', userId] as const,
    myAwards: (userId: string) => ['leagues', 'my-awards', userId] as const,
};

// ─── Fetch Functions ────────────────────────────────────────────────────

async function fetchMyLeagues(userId: string, gameMode: GameMode): Promise<League[]> {
    const { data, error } = await supabase.rpc('get_my_leagues' as any, {
        p_game_mode: gameMode,
    });
    if (error) {
        console.error('[useLeagueData] Error fetching leagues:', error);
        throw error;
    }
    return (data ?? []) as League[];
}

async function fetchMyLeaguesAll(userId: string): Promise<LeagueWithMembership[]> {
    const { data, error } = await supabase.rpc('get_my_leagues_all' as any);
    if (error) {
        console.error('[useLeagueData] Error fetching all leagues:', error);
        throw error;
    }
    return (data ?? []) as LeagueWithMembership[];
}

async function fetchStandings(
    leagueId: string,
    timeframe: Timeframe,
    gameMode: GameMode = 'region'
): Promise<StandingsResponse> {
    const { data, error } = await supabase.rpc('get_league_standings' as any, {
        p_league_id: leagueId,
        p_timeframe: timeframe,
        p_game_mode: gameMode,
    });
    if (error) {
        console.error('[useLeagueData] Error fetching standings:', error);
        throw error;
    }
    return data as StandingsResponse;
}

async function fetchMyMembership(
    leagueId: string,
    userId: string
): Promise<LeagueMember | null> {
    const { data, error } = await supabase.rpc('get_my_membership' as any, {
        p_league_id: leagueId,
    });
    if (error) {
        console.error('[useLeagueData] Error fetching membership:', error);
        throw error;
    }
    return data as LeagueMember | null;
}

async function fetchGlobalIdentity(): Promise<GlobalIdentity | null> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data, error } = await supabase
        .from('user_profiles')
        .select('global_display_name, global_tag')
        .eq('id', user.id)
        .maybeSingle();

    if (error) {
        console.error('[useLeagueData] Error fetching global identity:', error);
        throw error;
    }
    return data as GlobalIdentity | null;
}

// ─── Hooks ──────────────────────────────────────────────────────────────

/**
 * Fetches the list of ACTIVE leagues the current user is a member of.
 * Used for the league table tab selector.
 */
export function useMyLeagues(gameMode: GameMode = 'region') {
    const { user } = useAuth();
    return useQuery({
        queryKey: leagueKeys.myLeagues(user?.id ?? '', gameMode),
        queryFn: () => fetchMyLeagues(user!.id, gameMode),
        enabled: !!user?.id,
        staleTime: 1000 * 60 * 2,
        refetchOnWindowFocus: true,
    });
}

/**
 * Fetches ALL leagues (including inactive) for the manage screen.
 */
export function useMyLeaguesAll() {
    const { user } = useAuth();
    return useQuery({
        queryKey: leagueKeys.myLeaguesAll(user?.id ?? ''),
        queryFn: () => fetchMyLeaguesAll(user!.id),
        enabled: !!user?.id,
        staleTime: 1000 * 60 * 2,
        refetchOnWindowFocus: true,
    });
}

/**
 * Fetches standings for a specific league and timeframe.
 */
export function useLeagueStandings(leagueId: string | null, timeframe: Timeframe, gameMode: GameMode = 'region') {
    return useQuery({
        queryKey: leagueKeys.standings(leagueId ?? '', timeframe, gameMode),
        queryFn: () => fetchStandings(leagueId!, timeframe, gameMode),
        enabled: !!leagueId,
        staleTime: 1000 * 30,
        refetchOnWindowFocus: true,
    });
}

/**
 * Fetches the current user's membership for a specific league.
 */
export function useMyMembership(leagueId: string | null) {
    const { user } = useAuth();
    return useQuery({
        queryKey: leagueKeys.member(leagueId ?? '', user?.id ?? ''),
        queryFn: () => fetchMyMembership(leagueId!, user!.id),
        enabled: !!leagueId && !!user?.id,
        staleTime: 1000 * 60 * 5,
    });
}

/**
 * Fetches the current user's global identity (display name + tag).
 */
export function useGlobalIdentity() {
    const { user } = useAuth();
    return useQuery({
        queryKey: leagueKeys.globalIdentity(user?.id ?? ''),
        queryFn: fetchGlobalIdentity,
        enabled: !!user?.id,
        staleTime: 1000 * 60 * 10,
    });
}

/**
 * Mutation: Set or update global identity (display name + auto-tag).
 */
export function useSetGlobalIdentity() {
    const queryClient = useQueryClient();
    const { user } = useAuth();

    return useMutation({
        mutationFn: async (displayName: string) => {
            const { data, error } = await supabase.rpc('set_global_identity' as any, {
                p_display_name: displayName,
            });
            if (error) throw error;
            return data as GlobalIdentity;
        },
        onSuccess: () => {
            if (user?.id) {
                queryClient.invalidateQueries({ queryKey: leagueKeys.globalIdentity(user.id) });
                // Also refresh standings since they show global identity
                queryClient.invalidateQueries({ queryKey: leagueKeys.all });
            }
        },
    });
}

/**
 * Mutation: Create a new private league.
 */
export function useCreateLeague() {
    const queryClient = useQueryClient();
    const { user } = useAuth();

    return useMutation({
        mutationFn: async ({ name, hasRegionBoard, hasUserBoard }: { name: string; hasRegionBoard?: boolean; hasUserBoard?: boolean }) => {
            const { data, error } = await supabase.rpc('create_league' as any, {
                p_name: name,
                p_has_region_board: hasRegionBoard ?? true,
                p_has_user_board: hasUserBoard ?? true,
            });
            if (error) throw error;
            return data;
        },
        onSuccess: () => {
            if (user?.id) {
                queryClient.invalidateQueries({ queryKey: leagueKeys.myLeagues(user.id, 'region') });
                queryClient.invalidateQueries({ queryKey: leagueKeys.myLeagues(user.id, 'user') });
                queryClient.invalidateQueries({ queryKey: leagueKeys.myLeaguesAll(user.id) });
            }
        },
    });
}

/**
 * Mutation: Join a league via join code.
 */
export function useJoinLeague() {
    const queryClient = useQueryClient();
    const { user } = useAuth();

    return useMutation({
        mutationFn: async ({ joinCode, displayName }: { joinCode: string; displayName: string }) => {
            const { data, error } = await supabase.rpc('join_league' as any, {
                p_join_code: joinCode,
                p_display_name: displayName,
            });
            if (error) throw error;
            return data;
        },
        onSuccess: () => {
            if (user?.id) {
                queryClient.invalidateQueries({ queryKey: leagueKeys.myLeagues(user.id, 'region') });
                queryClient.invalidateQueries({ queryKey: leagueKeys.myLeagues(user.id, 'user') });
                queryClient.invalidateQueries({ queryKey: leagueKeys.myLeaguesAll(user.id) });
            }
        },
    });
}

/**
 * Mutation: Update league nickname (per-league display name).
 */
export function useUpdateLeagueNickname() {
    const queryClient = useQueryClient();
    const { user } = useAuth();

    return useMutation({
        mutationFn: async ({ leagueId, nickname }: { leagueId: string; nickname: string }) => {
            const { data, error } = await supabase.rpc('update_league_nickname' as any, {
                p_league_id: leagueId,
                p_nickname: nickname,
            });
            if (error) throw error;
            return data;
        },
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({
                queryKey: leagueKeys.standings(variables.leagueId, 'mtd', 'region'),
            });
            queryClient.invalidateQueries({
                queryKey: leagueKeys.standings(variables.leagueId, 'mtd', 'user'),
            });
            queryClient.invalidateQueries({
                queryKey: leagueKeys.standings(variables.leagueId, 'ytd', 'region'),
            });
            queryClient.invalidateQueries({
                queryKey: leagueKeys.standings(variables.leagueId, 'ytd', 'user'),
            });
            if (user?.id) {
                queryClient.invalidateQueries({
                    queryKey: leagueKeys.member(variables.leagueId, user.id),
                });
                queryClient.invalidateQueries({ queryKey: leagueKeys.myLeaguesAll(user.id) });
            }
        },
    });
}

/**
 * Mutation: Leave a league (sets is_active = false).
 */
export function useLeaveLeague() {
    const queryClient = useQueryClient();
    const { user } = useAuth();

    return useMutation({
        mutationFn: async (leagueId: string) => {
            const { data, error } = await supabase.rpc('leave_league' as any, {
                p_league_id: leagueId,
            });
            if (error) throw error;
            return data;
        },
        onSuccess: () => {
            if (user?.id) {
                queryClient.invalidateQueries({ queryKey: leagueKeys.myLeagues(user.id, 'region') });
                queryClient.invalidateQueries({ queryKey: leagueKeys.myLeagues(user.id, 'user') });
                queryClient.invalidateQueries({ queryKey: leagueKeys.myLeaguesAll(user.id) });
            }
        },
    });
}

/**
 * Mutation: Rejoin a league (sets is_active = true for both modes).
 */
export function useRejoinLeague() {
    const queryClient = useQueryClient();
    const { user } = useAuth();

    return useMutation({
        mutationFn: async (leagueId: string) => {
            const { data, error } = await supabase.rpc('rejoin_league' as any, {
                p_league_id: leagueId,
            });
            if (error) throw error;
            return data;
        },
        onSuccess: () => {
            if (user?.id) {
                queryClient.invalidateQueries({ queryKey: leagueKeys.myLeagues(user.id, 'region') });
                queryClient.invalidateQueries({ queryKey: leagueKeys.myLeagues(user.id, 'user') });
                queryClient.invalidateQueries({ queryKey: leagueKeys.myLeaguesAll(user.id) });
            }
        },
    });
}

/**
 * Mutation: Leave a single game mode board (sets is_active_region or is_active_user = false).
 */
export function useLeaveLeagueMode() {
    const queryClient = useQueryClient();
    const { user } = useAuth();

    return useMutation({
        mutationFn: async ({ leagueId, gameMode }: { leagueId: string; gameMode: GameMode }) => {
            const { data, error } = await supabase.rpc('leave_league_mode' as any, {
                p_league_id: leagueId,
                p_game_mode: gameMode,
            });
            if (error) throw error;
            return data;
        },
        onSuccess: () => {
            if (user?.id) {
                queryClient.invalidateQueries({ queryKey: leagueKeys.myLeagues(user.id, 'region') });
                queryClient.invalidateQueries({ queryKey: leagueKeys.myLeagues(user.id, 'user') });
                queryClient.invalidateQueries({ queryKey: leagueKeys.myLeaguesAll(user.id) });
            }
        },
    });
}

/**
 * Mutation: Rejoin a single game mode board (sets is_active_region or is_active_user = true).
 */
export function useRejoinLeagueMode() {
    const queryClient = useQueryClient();
    const { user } = useAuth();

    return useMutation({
        mutationFn: async ({ leagueId, gameMode }: { leagueId: string; gameMode: GameMode }) => {
            const { data, error } = await supabase.rpc('rejoin_league_mode' as any, {
                p_league_id: leagueId,
                p_game_mode: gameMode,
            });
            if (error) throw error;
            return data;
        },
        onSuccess: () => {
            if (user?.id) {
                queryClient.invalidateQueries({ queryKey: leagueKeys.myLeagues(user.id, 'region') });
                queryClient.invalidateQueries({ queryKey: leagueKeys.myLeagues(user.id, 'user') });
                queryClient.invalidateQueries({ queryKey: leagueKeys.myLeaguesAll(user.id) });
            }
        },
    });
}

/**
 * Mutation: Delete league membership (hard delete, only if inactive + not system).
 */
export function useDeleteLeagueMembership() {
    const queryClient = useQueryClient();
    const { user } = useAuth();

    return useMutation({
        mutationFn: async (leagueId: string) => {
            const { data, error } = await supabase.rpc('delete_league_membership' as any, {
                p_league_id: leagueId,
            });
            if (error) throw error;
            return data;
        },
        onSuccess: () => {
            if (user?.id) {
                queryClient.invalidateQueries({ queryKey: leagueKeys.myLeagues(user.id, 'region') });
                queryClient.invalidateQueries({ queryKey: leagueKeys.myLeagues(user.id, 'user') });
                queryClient.invalidateQueries({ queryKey: leagueKeys.myLeaguesAll(user.id) });
            }
        },
    });
}

/**
 * Mutation: Record a league view (Yesterday's Baseline logic).
 */
export function useRecordLeagueView() {
    return useMutation({
        mutationFn: async ({ leagueId, currentRank }: { leagueId: string; currentRank: number }) => {
            const { data, error } = await supabase.rpc('record_league_view' as any, {
                p_league_id: leagueId,
                p_current_rank: currentRank,
            });
            if (error) throw error;
            return data as { yesterdays_rank: number | null; current_rank: number; rank_change: number | null };
        },
    });
}

/**
 * Helper: Invalidate all league queries (e.g. after joining a new league).
 */
export function invalidateAllLeagueQueries(queryClient: QueryClient) {
    queryClient.invalidateQueries({ queryKey: leagueKeys.all });
}

// ─── Admin Member Management ────────────────────────────────────────────

export type AdminMember = {
    user_id: string;
    league_nickname: string;
    global_display_name: string;
    global_tag: string;
    can_share: boolean;
    is_active: boolean;
    is_admin: boolean;
    is_banned: boolean;
    joined_at: string;
};

/**
 * Fetch all members of a league (admin-only).
 */
export function useLeagueMembers(leagueId: string | null) {
    const { user } = useAuth();
    return useQuery({
        queryKey: ['leagues', 'members', leagueId, user?.id] as const,
        queryFn: async () => {
            if (!leagueId) return [];
            const { data, error } = await supabase.rpc('get_league_members' as any, {
                p_league_id: leagueId,
            });
            if (error) throw error;
            return (data ?? []) as AdminMember[];
        },
        enabled: !!user && !!leagueId,
        staleTime: 30_000,
    });
}

/**
 * Toggle share permission for a specific member (admin-only).
 */
export function useUpdateMemberShare() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async ({ leagueId, targetUserId, canShare }: { leagueId: string; targetUserId: string; canShare: boolean }) => {
            const { error } = await supabase.rpc('update_member_share' as any, {
                p_league_id: leagueId,
                p_target_user_id: targetUserId,
                p_can_share: canShare,
            });
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: leagueKeys.all });
        },
    });
}

/**
 * Toggle share permission for ALL members (admin-only).
 */
export function useToggleAllSharing() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async ({ leagueId, canShare }: { leagueId: string; canShare: boolean }) => {
            const { error } = await supabase.rpc('toggle_all_sharing' as any, {
                p_league_id: leagueId,
                p_can_share: canShare,
            });
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: leagueKeys.all });
        },
    });
}

/**
 * Remove and block a member from a league (admin-only).
 */
export function useRemoveAndBlockMember() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async ({ leagueId, targetUserId }: { leagueId: string; targetUserId: string }) => {
            const { error } = await supabase.rpc('remove_and_block_member' as any, {
                p_league_id: leagueId,
                p_target_user_id: targetUserId,
            });
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: leagueKeys.all });
        },
    });
}

/**
 * Soft-remove a member (deactivate without ban, preserves standings).
 */
export function useAdminRemoveMember() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async ({ leagueId, targetUserId }: { leagueId: string; targetUserId: string }) => {
            const { error } = await supabase.rpc('admin_remove_member' as any, {
                p_league_id: leagueId,
                p_target_user_id: targetUserId,
            });
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: leagueKeys.all });
        },
    });
}

/**
 * Rejoin a removed (but not banned) member back into a league.
 */
export function useAdminRejoinMember() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async ({ leagueId, targetUserId }: { leagueId: string; targetUserId: string }) => {
            const { error } = await supabase.rpc('admin_rejoin_member' as any, {
                p_league_id: leagueId,
                p_target_user_id: targetUserId,
            });
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: leagueKeys.all });
        },
    });
}

/**
 * Unblock a banned member (removes ban record, does not reactivate).
 */
export function useAdminUnblockMember() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async ({ leagueId, targetUserId }: { leagueId: string; targetUserId: string }) => {
            const { error } = await supabase.rpc('admin_unblock_member' as any, {
                p_league_id: leagueId,
                p_target_user_id: targetUserId,
            });
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: leagueKeys.all });
        },
    });
}

// ─── Historical Standings & Awards ──────────────────────────────────────

/**
 * Fetch historical standings from snapshot for a past period.
 */
export function useHistoricalStandings(
    leagueId: string | null,
    timeframe: Timeframe,
    periodLabel: string | null,
    gameMode: GameMode = 'region'
) {
    const { user } = useAuth();
    return useQuery({
        queryKey: leagueKeys.historicalStandings(
            leagueId || '', timeframe, periodLabel || '', gameMode
        ),
        queryFn: async () => {
            if (!leagueId || !periodLabel) return null;
            const { data, error } = await supabase.rpc('get_historical_standings' as any, {
                p_league_id: leagueId,
                p_timeframe: timeframe,
                p_period_label: periodLabel,
                p_game_mode: gameMode,
            });
            if (error) throw error;
            return data as StandingsResponse;
        },
        enabled: !!user && !!leagueId && !!periodLabel,
        staleTime: Infinity, // Snapshots never change
    });
}

/**
 * Fetch the current user's medals and percentile badges.
 */
export function useMyAwards() {
    const { user } = useAuth();
    return useQuery({
        queryKey: leagueKeys.myAwards(user?.id || ''),
        queryFn: async () => {
            const { data, error } = await supabase.rpc('get_my_awards' as any);
            if (error) throw error;
            return data as MyAwards;
        },
        enabled: !!user,
        staleTime: 60_000,
    });
}

/**
 * Generate the list of available periods for the date picker.
 * MTD: last 12 months (e.g. '2026-03', '2026-02', ...)
 * YTD: last 5 years (e.g. '2026', '2025', ...)
 * Returns from newest to oldest.
 */
export function getAvailablePeriods(timeframe: Timeframe): string[] {
    const now = new Date();
    const periods: string[] = [];

    if (timeframe === 'mtd') {
        for (let i = 0; i < 12; i++) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
            periods.push(
                `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
            );
        }
    } else {
        for (let i = 0; i < 5; i++) {
            periods.push(String(now.getFullYear() - i));
        }
    }

    return periods;
}

/**
 * Get the current period label.
 */
export function getCurrentPeriodLabel(timeframe: Timeframe): string {
    const now = new Date();
    if (timeframe === 'mtd') {
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    }
    return String(now.getFullYear());
}

/**
 * Format a period label for display.
 * '2026-03' → 'March 2026'
 * '2026' → '2026'
 */
export function formatPeriodLabel(label: string, timeframe: Timeframe): string {
    if (timeframe === 'ytd') return label;
    const [year, month] = label.split('-');
    const months = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December',
    ];
    return `${months[parseInt(month, 10) - 1]} ${year}`;
}
