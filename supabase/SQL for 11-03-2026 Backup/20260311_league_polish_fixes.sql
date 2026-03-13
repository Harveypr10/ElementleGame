-- ============================================================================
-- LEAGUE POLISH FIXES — 3 Backend Issues
--
-- 1. League auto-delete: when the last member leaves (all mode flags off),
--    automatically delete the league and all related data.
--    → Updated: leave_league, leave_league_mode
--
-- 2. Blocked user visibility: change remove_and_block_member to soft-deactivate
--    instead of deleting the league_members row. Update get_league_members to
--    include banned members. Update member_count queries to exclude banned users.
--    → Updated: remove_and_block_member, get_league_members, get_my_leagues_all
--
-- 3. Live mode yesterdays_rank: join daily_league_rank_snapshot in the live
--    standings query so rank movement arrows appear.
--    → Updated: get_league_standings (live section)
--
-- Run in Supabase SQL Editor.
-- ============================================================================


-- ═══════════════════════════════════════════════════════════════════════════
-- HELPER: auto_delete_empty_league()
-- Called after a member is deactivated. If no active members remain for a
-- non-system league, permanently deletes it.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.auto_delete_empty_league(p_league_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $fn_auto_del$
DECLARE
    v_is_system boolean;
    v_active_count integer;
BEGIN
    SELECT is_system_league INTO v_is_system
    FROM public.leagues WHERE id = p_league_id;

    -- Never auto-delete system leagues
    IF v_is_system THEN RETURN; END IF;

    -- Count members who are still active in at least one mode
    SELECT COUNT(*) INTO v_active_count
    FROM public.league_members
    WHERE league_id = p_league_id
      AND (is_active_region = true OR is_active_user = true);

    IF v_active_count > 0 THEN RETURN; END IF;

    -- No active members — delete everything
    DELETE FROM public.league_standings_live WHERE league_id = p_league_id;
    DELETE FROM public.league_standings_snapshot WHERE league_id = p_league_id;
    DELETE FROM public.daily_league_rank_snapshot WHERE league_id = p_league_id;
    DELETE FROM public.league_bans WHERE league_id = p_league_id;
    DELETE FROM public.league_members WHERE league_id = p_league_id;
    DELETE FROM public.leagues WHERE id = p_league_id;
END;
$fn_auto_del$;


-- ═══════════════════════════════════════════════════════════════════════════
-- 1a. leave_league v4 — adds auto-delete check
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.leave_league(p_league_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $fn_ll_v4$
DECLARE v_user_id uuid := auth.uid();
BEGIN
    IF v_user_id IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
    UPDATE public.league_members
    SET is_active = false, is_active_region = false, is_active_user = false
    WHERE league_id = p_league_id AND user_id = v_user_id;
    PERFORM public.recalculate_league_timezone(p_league_id);
    -- Auto-delete if no active members remain
    PERFORM public.auto_delete_empty_league(p_league_id);
    RETURN jsonb_build_object('success', true);
END;
$fn_ll_v4$;


-- ═══════════════════════════════════════════════════════════════════════════
-- 1b. leave_league_mode v3 — adds auto-delete check
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.leave_league_mode(p_league_id uuid, p_game_mode text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $fn_llm_v3$
DECLARE
    v_user_id uuid := auth.uid();
    v_active_region boolean;
    v_active_user boolean;
BEGIN
    IF v_user_id IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
    IF p_game_mode = 'user' THEN
        UPDATE public.league_members SET is_active_user = false
        WHERE league_id = p_league_id AND user_id = v_user_id;
    ELSIF p_game_mode = 'region' THEN
        UPDATE public.league_members SET is_active_region = false
        WHERE league_id = p_league_id AND user_id = v_user_id;
    ELSE RAISE EXCEPTION 'Invalid game_mode: must be region or user';
    END IF;

    -- Sync is_active when both modes off
    SELECT is_active_region, is_active_user INTO v_active_region, v_active_user
    FROM public.league_members
    WHERE league_id = p_league_id AND user_id = v_user_id;

    IF NOT v_active_region AND NOT v_active_user THEN
        UPDATE public.league_members SET is_active = false
        WHERE league_id = p_league_id AND user_id = v_user_id;
    END IF;

    PERFORM public.recalculate_league_timezone(p_league_id);
    -- Auto-delete if no active members remain
    PERFORM public.auto_delete_empty_league(p_league_id);
    RETURN jsonb_build_object('success', true, 'mode', p_game_mode);
END;
$fn_llm_v3$;


-- ═══════════════════════════════════════════════════════════════════════════
-- 2a. remove_and_block_member v2 — soft-deactivate instead of hard delete
--     Sets is_active + both mode flags to false, inserts ban record.
--     Membership row is KEPT so admin can see the blocked user.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.remove_and_block_member(
    p_league_id uuid,
    p_target_user_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $fn_rem_block_v2$
DECLARE
    v_user_id uuid := auth.uid();
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required';
    END IF;

    -- Verify caller is admin
    IF NOT EXISTS (
        SELECT 1 FROM public.leagues
        WHERE id = p_league_id AND admin_user_id = v_user_id
    ) THEN
        RAISE EXCEPTION 'Only the league admin can remove members';
    END IF;

    -- Cannot remove yourself
    IF p_target_user_id = v_user_id THEN
        RAISE EXCEPTION 'Cannot remove yourself from the league';
    END IF;

    -- 1. Insert ban record
    INSERT INTO public.league_bans (league_id, user_id, banned_by)
    VALUES (p_league_id, p_target_user_id, v_user_id)
    ON CONFLICT (league_id, user_id) DO UPDATE SET
        banned_by = v_user_id,
        banned_at = now();

    -- 2. Soft-deactivate: set all active flags to false (keep membership row)
    UPDATE public.league_members
    SET is_active = false,
        is_active_region = false,
        is_active_user = false
    WHERE league_id = p_league_id AND user_id = p_target_user_id;

    -- 3. Delete standings (blocked user should not appear in rankings)
    DELETE FROM public.league_standings_live
    WHERE league_id = p_league_id AND user_id = p_target_user_id;

    DELETE FROM public.league_standings_snapshot
    WHERE league_id = p_league_id AND user_id = p_target_user_id;

    RETURN jsonb_build_object('success', true);
END;
$fn_rem_block_v2$;


-- ═══════════════════════════════════════════════════════════════════════════
-- 2b. get_league_members v3 — returns ALL members including banned
--     with is_banned flag and no is_active filter
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.get_league_members(p_league_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $fn_get_members_v3$
DECLARE
    v_user_id uuid := auth.uid();
    v_is_admin boolean;
    v_result jsonb;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required';
    END IF;

    -- Check if user is admin of this league
    SELECT (l.admin_user_id = v_user_id)
    INTO v_is_admin
    FROM public.leagues l
    WHERE l.id = p_league_id;

    IF NOT v_is_admin THEN
        RAISE EXCEPTION 'Only the league admin can view members';
    END IF;

    SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
            'user_id', lm.user_id,
            'league_nickname', lm.league_nickname,
            'global_display_name', COALESCE(up.global_display_name, up.first_name, 'Player'),
            'global_tag', COALESCE(up.global_tag, '#0000'),
            'can_share', lm.can_share,
            'is_active', lm.is_active,
            'is_admin', (lm.user_id = (SELECT admin_user_id FROM public.leagues WHERE id = p_league_id)),
            'is_banned', EXISTS (
                SELECT 1 FROM public.league_bans lb
                WHERE lb.league_id = p_league_id AND lb.user_id = lm.user_id
            ),
            'joined_at', lm.joined_at
        ) ORDER BY
            -- Admin first, then active members, then inactive, then banned last
            (lm.user_id = (SELECT admin_user_id FROM public.leagues WHERE id = p_league_id)) DESC,
            lm.is_active DESC,
            lm.joined_at
    ), '[]'::jsonb)
    INTO v_result
    FROM public.league_members lm
    JOIN public.user_profiles up ON up.id = lm.user_id
    WHERE lm.league_id = p_league_id;

    RETURN v_result;
END;
$fn_get_members_v3$;


-- ═══════════════════════════════════════════════════════════════════════════
-- 2c. get_my_leagues_all v4 — member_count excludes banned members
--     Uses (is_active_region = true OR is_active_user = true) instead of
--     just is_active = true, so blocked members (all flags false) are excluded.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.get_my_leagues_all()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $fn_mla_v4$
DECLARE
    v_user_id uuid := auth.uid();
    v_result jsonb;
BEGIN
    IF v_user_id IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;

    SELECT COALESCE(jsonb_agg(row_to_json(l)::jsonb ORDER BY l.is_system_league DESC, l.name), '[]'::jsonb)
    INTO v_result
    FROM (
        SELECT lg.id, lg.name, lg.admin_user_id, lg.is_system_league, lg.system_region,
               lg.share_link_public, lg.join_code, lg.created_at,
               lg.has_region_board, lg.has_user_board,
               lm.league_nickname, lm.is_active, lm.can_share,
               lm.is_active_region, lm.is_active_user,
               -- Admin display info for non-admin members
               (SELECT COALESCE(up2.global_display_name, up2.first_name, 'Admin')
                FROM public.user_profiles up2 WHERE up2.id = lg.admin_user_id) AS admin_display_name,
               (SELECT up2.global_tag
                FROM public.user_profiles up2 WHERE up2.id = lg.admin_user_id) AS admin_tag,
               -- member_count: only users active in at least one mode
               (SELECT COUNT(*) FROM public.league_members lm2
                WHERE lm2.league_id = lg.id
                  AND (lm2.is_active_region = true OR lm2.is_active_user = true)) AS member_count
        FROM public.leagues lg
        INNER JOIN public.league_members lm ON lm.league_id = lg.id
        WHERE lm.user_id = v_user_id
    ) l;

    RETURN v_result;
END;
$fn_mla_v4$;


-- ═══════════════════════════════════════════════════════════════════════════
-- 3. get_league_standings v7 — live mode joins yesterday's rank snapshot
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.get_league_standings(
    p_league_id     uuid,
    p_timeframe     text DEFAULT 'mtd',
    p_game_mode     text DEFAULT 'region',
    p_snapshot_date date DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $fn_standings_v7$
DECLARE
    v_user_id       uuid := auth.uid();
    v_standings     jsonb;
    v_my_rank       integer;
    v_total         integer;
    v_min_games     int;
    v_day_of_period int;
    v_prev_label    text;
BEGIN
    IF v_user_id IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
    IF NOT EXISTS(
        SELECT 1 FROM public.league_members
        WHERE league_id = p_league_id AND user_id = v_user_id
          AND CASE WHEN p_game_mode = 'user' THEN is_active_user ELSE is_active_region END = true
    ) THEN RAISE EXCEPTION 'Not an active member of this league for this mode'; END IF;

    -- ── SNAPSHOT MODE ────────────────────────────────────────────────────
    IF p_snapshot_date IS NOT NULL THEN
        SELECT jsonb_agg(row_data ORDER BY (row_data->>'rank')::int) INTO v_standings
        FROM (
            SELECT jsonb_build_object(
                'rank',             r.rank,
                'user_id',          r.user_id,
                'league_nickname',  COALESCE(m.league_nickname, up.global_display_name, 'Player'),
                'global_display_name', COALESCE(up.global_display_name, up.first_name, 'Player'),
                'global_tag',       COALESCE(up.global_tag, '#0000'),
                'elementle_rating', ROUND(COALESCE(s.elementle_rating, 0), 1),
                'current_streak',   COALESCE(s.current_streak, 0),
                'games_played',     COALESCE(s.games_played, 0),
                'games_won',        COALESCE(s.games_won, 0),
                'win_rate',         ROUND(COALESCE(s.win_rate, 0), 1),
                'avg_guesses',      ROUND(COALESCE(s.avg_guesses, 0), 1),
                'max_streak',       COALESCE(s.max_streak, 0),
                'is_me',            (r.user_id = v_user_id),
                'yesterdays_rank',  prev.rank
            ) AS row_data
            FROM public.daily_league_rank_snapshot r
            -- Join user stats for that snapshot date
            JOIN public.daily_user_stats_snapshot s
                ON s.user_id = r.user_id
               AND s.snapshot_date = r.snapshot_date
               AND s.timeframe = r.timeframe
               AND s.game_mode = r.game_mode
            -- Join previous day's rank for movement arrows
            LEFT JOIN public.daily_league_rank_snapshot prev
                ON prev.league_id = r.league_id
               AND prev.user_id = r.user_id
               AND prev.snapshot_date = r.snapshot_date - 1
               AND prev.timeframe = r.timeframe
               AND prev.game_mode = r.game_mode
            LEFT JOIN public.league_members m
                ON m.league_id = r.league_id AND m.user_id = r.user_id
            LEFT JOIN public.user_profiles up
                ON up.id = r.user_id
            WHERE r.league_id = p_league_id
              AND r.snapshot_date = p_snapshot_date
              AND r.timeframe = p_timeframe
              AND r.game_mode = p_game_mode
        ) ranked;

        SELECT (row_data->>'rank')::integer INTO v_my_rank
        FROM (SELECT jsonb_array_elements(v_standings) AS row_data) t
        WHERE row_data->>'user_id' = v_user_id::text;

        v_total := COALESCE(jsonb_array_length(v_standings), 0);

        RETURN jsonb_build_object(
            'standings',     COALESCE(v_standings, '[]'::jsonb),
            'my_rank',       v_my_rank,
            'total_members', v_total,
            'is_snapshot',   true,
            'is_live',       false,
            'snapshot_date',  p_snapshot_date
        );
    END IF;

    -- ── LIVE MODE ────────────────────────────────────────────────────────
    -- Blind Phase Check (early in period → show previous period snapshot)
    SELECT COALESCE(
        (SELECT value::int FROM public.admin_settings WHERE key = 'min_games_for_cumulative_percentile'), 5
    ) INTO v_min_games;

    IF p_timeframe = 'mtd' THEN
        v_day_of_period := EXTRACT(day FROM CURRENT_DATE)::int;
        v_prev_label := TO_CHAR(CURRENT_DATE - INTERVAL '1 month', 'YYYY-MM');
    ELSE
        v_day_of_period := EXTRACT(doy FROM CURRENT_DATE)::int;
        v_prev_label := TO_CHAR(CURRENT_DATE - INTERVAL '1 year', 'YYYY');
    END IF;

    IF v_day_of_period < v_min_games THEN
        IF EXISTS (
            SELECT 1 FROM public.league_standings_snapshot
            WHERE league_id = p_league_id AND timeframe = p_timeframe
              AND period_label = v_prev_label AND game_mode = p_game_mode
        ) THEN
            RETURN public.get_historical_standings(p_league_id, p_timeframe, v_prev_label, p_game_mode);
        END IF;
    END IF;

    -- Live standings with yesterday's rank from daily snapshot
    SELECT jsonb_agg(row_data ORDER BY rn) INTO v_standings
    FROM (
        SELECT jsonb_build_object(
            'rank', RANK() OVER (
                ORDER BY s.elementle_rating DESC, s.current_streak DESC,
                         s.games_played DESC, s.avg_guesses ASC),
            'user_id', m.user_id,
            'league_nickname', m.league_nickname,
            'global_display_name', COALESCE(up.global_display_name, up.first_name, 'Player'),
            'global_tag', COALESCE(up.global_tag, '#0000'),
            'elementle_rating', ROUND(COALESCE(s.elementle_rating, 0), 1),
            'current_streak', COALESCE(s.current_streak, 0),
            'games_played', COALESCE(s.games_played, 0),
            'games_won', COALESCE(s.games_won, 0),
            'win_rate', ROUND(COALESCE(s.win_rate, 0), 1),
            'avg_guesses', ROUND(COALESCE(s.avg_guesses, 0), 1),
            'max_streak', GREATEST(COALESCE(s.max_streak_mtd, 0), COALESCE(s.max_streak_ytd, 0)),
            'is_me', (m.user_id = v_user_id),
            'yesterdays_rank', prev_rank.rank
        ) AS row_data,
        RANK() OVER (
            ORDER BY s.elementle_rating DESC, s.current_streak DESC,
                     s.games_played DESC, s.avg_guesses ASC) AS rn
        FROM public.league_members m
        LEFT JOIN public.league_standings_live s
            ON s.league_id = m.league_id AND s.user_id = m.user_id
           AND s.timeframe = p_timeframe AND s.game_mode = p_game_mode
        LEFT JOIN public.user_profiles up ON up.id = m.user_id
        -- Join yesterday's rank from daily league rank snapshot
        LEFT JOIN public.daily_league_rank_snapshot prev_rank
            ON prev_rank.league_id = m.league_id
           AND prev_rank.user_id = m.user_id
           AND prev_rank.snapshot_date = CURRENT_DATE - 1
           AND prev_rank.timeframe = p_timeframe
           AND prev_rank.game_mode = p_game_mode
        WHERE m.league_id = p_league_id
          AND CASE WHEN p_game_mode = 'user' THEN m.is_active_user ELSE m.is_active_region END = true
    ) ranked;

    SELECT (row_data->>'rank')::integer INTO v_my_rank
    FROM (SELECT jsonb_array_elements(v_standings) AS row_data) t
    WHERE row_data->>'user_id' = v_user_id::text;

    SELECT COUNT(*) INTO v_total FROM public.league_members
    WHERE league_id = p_league_id
      AND CASE WHEN p_game_mode = 'user' THEN is_active_user ELSE is_active_region END = true;

    RETURN jsonb_build_object(
        'standings',     COALESCE(v_standings, '[]'::jsonb),
        'my_rank',       v_my_rank,
        'total_members', v_total,
        'is_snapshot',   false,
        'is_live',       true
    );
END;
$fn_standings_v7$;


-- ═══════════════════════════════════════════════════════════════════════════
-- 4. admin_delete_league — permanently deletes a custom league and all data
--    Only the league admin can call this. System leagues cannot be deleted.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.admin_delete_league(p_league_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $fn_admin_del_league$
DECLARE
    v_user_id uuid := auth.uid();
    v_league record;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required';
    END IF;

    SELECT id, name, is_system_league, admin_user_id
    INTO v_league
    FROM public.leagues
    WHERE id = p_league_id;

    IF v_league IS NULL THEN
        RAISE EXCEPTION 'League not found';
    END IF;

    IF v_league.is_system_league THEN
        RAISE EXCEPTION 'Cannot delete system leagues';
    END IF;

    IF v_league.admin_user_id <> v_user_id THEN
        RAISE EXCEPTION 'Only the league admin can delete this league';
    END IF;

    -- Delete all related data (order matters for foreign keys without CASCADE)
    DELETE FROM public.league_standings_live WHERE league_id = p_league_id;
    DELETE FROM public.league_standings_snapshot WHERE league_id = p_league_id;
    DELETE FROM public.daily_league_rank_snapshot WHERE league_id = p_league_id;
    DELETE FROM public.league_bans WHERE league_id = p_league_id;
    DELETE FROM public.league_members WHERE league_id = p_league_id;
    -- league_awards has ON DELETE CASCADE from leagues, so it auto-cleans
    DELETE FROM public.leagues WHERE id = p_league_id;

    RETURN jsonb_build_object('success', true, 'deleted_league', v_league.name);
END;
$fn_admin_del_league$;

