-- ============================================================================
-- SNAPSHOT UI FIXES: SQL Migration
-- 
-- 0. Fix overloaded calculate_user_league_rating (3-param vs 4-param ambiguity)
-- 1. Fix create_league: display_name → league_nickname
-- 2. Fix join_league: display_name → league_nickname  
-- 3. Add live rank change (yesterdays_rank from latest daily snapshot)
-- 4. Add league_created_at to get_league_snapshot_range
-- ============================================================================


-- ─── 0. Drop old 3-param calculate_user_league_rating ────────────────────
-- The old version (uuid, text, text) conflicts with the new v2 (uuid, text, text, date DEFAULT NULL)
-- because PostgreSQL can't disambiguate when the 3rd arg is a string literal ('unknown' type).
-- The v2 (from 20260309_league_daily_snapshots.sql) is the correct one to keep.

DROP FUNCTION IF EXISTS public.calculate_user_league_rating(uuid, text, text);

-- Also drop the old 3-param user mode version if it exists
DROP FUNCTION IF EXISTS public.calculate_user_league_rating_user_mode(uuid, text, text);


-- ─── 1. Fix create_league v4 ─────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.create_league(
    p_name text DEFAULT 'Elementle League',
    p_has_region_board boolean DEFAULT true,
    p_has_user_board boolean DEFAULT true
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $fn_create_v4$
DECLARE
    v_user_id uuid := auth.uid();
    v_league_id uuid; v_join_code text;
    v_display_name text; v_tag text;
    v_trimmed_name text;
BEGIN
    IF v_user_id IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
    IF NOT p_has_region_board AND NOT p_has_user_board THEN
        RAISE EXCEPTION 'At least one board must be enabled';
    END IF;

    v_trimmed_name := TRIM(p_name);
    IF LENGTH(v_trimmed_name) < 1 THEN
        RAISE EXCEPTION 'League name cannot be empty';
    END IF;
    IF LENGTH(v_trimmed_name) > 25 THEN
        RAISE EXCEPTION 'League name must be 25 characters or fewer';
    END IF;

    v_join_code := public.generate_join_code();

    INSERT INTO public.leagues (name, admin_user_id, join_code, has_region_board, has_user_board)
    VALUES (v_trimmed_name, v_user_id, v_join_code, p_has_region_board, p_has_user_board)
    RETURNING id INTO v_league_id;

    SELECT COALESCE(global_display_name, NULLIF(TRIM(first_name), ''), 'Player')
    INTO v_display_name FROM public.user_profiles WHERE id = v_user_id;

    v_tag := COALESCE(
        (SELECT global_tag FROM public.user_profiles WHERE id = v_user_id),
        public.generate_display_tag(v_display_name)
    );

    -- Fixed: use league_nickname instead of display_name
    INSERT INTO public.league_members (league_id, user_id, league_nickname, can_share, is_active)
    VALUES (v_league_id, v_user_id, v_display_name, true, true);

    PERFORM public.hydrate_member_standings(v_user_id, v_league_id);

    -- Recalculate timezone
    PERFORM public.recalculate_league_timezone(v_league_id);

    RETURN jsonb_build_object(
        'league_id', v_league_id, 'join_code', v_join_code,
        'display_name', v_display_name, 'global_tag', v_tag
    );
END;
$fn_create_v4$;


-- ─── 2. Fix join_league v4 ───────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.join_league(p_join_code text, p_display_name text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $rpc_join_v4$
DECLARE
    v_user_id uuid := auth.uid();
    v_league record;
    v_tag text;
    v_rank integer;
    v_total integer;
BEGIN
    IF v_user_id IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;

    SELECT id, name, is_system_league INTO v_league
    FROM public.leagues WHERE join_code = UPPER(p_join_code);
    IF v_league IS NULL THEN RAISE EXCEPTION 'Invalid join code'; END IF;

    IF EXISTS(SELECT 1 FROM public.league_members
              WHERE league_id = v_league.id AND user_id = v_user_id) THEN
        RAISE EXCEPTION 'Already a member of this league';
    END IF;

    v_tag := public.generate_display_tag(p_display_name);

    -- Fixed: use league_nickname instead of display_name
    INSERT INTO public.league_members (league_id, user_id, league_nickname)
    VALUES (v_league.id, v_user_id, p_display_name);

    PERFORM public.hydrate_member_standings(v_user_id, v_league.id);

    -- Recalculate timezone for user-created leagues
    PERFORM public.recalculate_league_timezone(v_league.id);

    SELECT COUNT(*) + 1 INTO v_rank
    FROM public.league_standings_live s
    WHERE s.league_id = v_league.id AND s.timeframe = 'mtd'
      AND s.user_id != v_user_id AND s.game_mode = 'region'
      AND s.elementle_rating > (
          SELECT COALESCE(elementle_rating, 0) FROM public.league_standings_live
          WHERE league_id = v_league.id AND user_id = v_user_id
            AND timeframe = 'mtd' AND game_mode = 'region'
      );

    SELECT COUNT(*) INTO v_total FROM public.league_members WHERE league_id = v_league.id;

    RETURN jsonb_build_object(
        'league_id', v_league.id, 'league_name', v_league.name,
        'display_name', p_display_name, 'display_tag', v_tag,
        'rank', v_rank, 'total_members', v_total
    );
END;
$rpc_join_v4$;


-- ─── 3. Update get_league_snapshot_range — add league_created_at ─────────

CREATE OR REPLACE FUNCTION public.get_league_snapshot_range(
    p_league_id  uuid,
    p_timeframe  text DEFAULT 'mtd',
    p_game_mode  text DEFAULT 'region'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $fn_range_v2$
DECLARE
    v_user_id       uuid := auth.uid();
    v_oldest        date;
    v_newest        date;
    v_timezone      text;
    v_created_at    timestamptz;
    v_next_midnight timestamptz;
BEGIN
    IF v_user_id IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;

    SELECT MIN(snapshot_date), MAX(snapshot_date)
    INTO v_oldest, v_newest
    FROM public.daily_league_rank_snapshot
    WHERE league_id = p_league_id
      AND timeframe = p_timeframe
      AND game_mode = p_game_mode;

    SELECT timezone, created_at INTO v_timezone, v_created_at
    FROM public.leagues WHERE id = p_league_id;

    -- Calculate next league midnight in UTC
    v_next_midnight := (
        ((now() AT TIME ZONE COALESCE(v_timezone, 'Etc/GMT+12'))::date + 1)::timestamp
        AT TIME ZONE COALESCE(v_timezone, 'Etc/GMT+12')
    );

    RETURN jsonb_build_object(
        'oldest_date',       v_oldest,
        'newest_date',       v_newest,
        'league_created_at', v_created_at::date,
        'timezone',          COALESCE(v_timezone, 'Etc/GMT+12'),
        'next_snapshot_utc', v_next_midnight
    );
END;
$fn_range_v2$;


-- ─── 4. Update get_league_standings v7 — add yesterdays_rank from latest snapshot ──

-- First, drop old overloaded functions to avoid ambiguity
DROP FUNCTION IF EXISTS public.get_league_standings(uuid, text);
DROP FUNCTION IF EXISTS public.get_league_standings(uuid, text, text);
DROP FUNCTION IF EXISTS public.get_league_standings(uuid, text, text, date);

CREATE OR REPLACE FUNCTION public.get_league_standings(
    p_league_id       uuid,
    p_timeframe       text DEFAULT 'mtd',
    p_game_mode       text DEFAULT 'region',
    p_snapshot_date   date DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $fn_gs_v7$
DECLARE
    v_user_id               uuid := auth.uid();
    v_standings             jsonb;
    v_my_rank               integer;
    v_total                 integer;
    v_min_games             integer;
    v_latest_snap_date      date;
BEGIN
    IF v_user_id IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;

    IF NOT EXISTS(
        SELECT 1 FROM public.league_members
        WHERE league_id = p_league_id AND user_id = v_user_id
          AND CASE WHEN p_game_mode = 'user' THEN is_active_user ELSE is_active_region END = true
    ) THEN
        RAISE EXCEPTION 'Not a member of this league';
    END IF;

    SELECT COALESCE(
        (SELECT (value::integer) FROM public.admin_settings WHERE key = 'min_games_for_cumulative_percentile'),
        5
    ) INTO v_min_games;

    -- ── SNAPSHOT MODE ──
    IF p_snapshot_date IS NOT NULL THEN
        -- Check blind phase: if no snapshot exists for this specific date,
        -- try the last completed period via get_historical_standings
        IF NOT EXISTS (
            SELECT 1 FROM public.daily_league_rank_snapshot
            WHERE league_id = p_league_id AND snapshot_date = p_snapshot_date
              AND timeframe = p_timeframe AND game_mode = p_game_mode
        ) THEN
            -- Return empty standings for this date  
            RETURN jsonb_build_object(
                'standings', '[]'::jsonb,
                'my_rank', NULL,
                'total_members', 0,
                'is_snapshot', true,
                'snapshot_date', p_snapshot_date,
                'min_games_threshold', v_min_games
            );
        END IF;

        -- Get latest snapshot date for yesterdays_rank comparison
        SELECT MAX(snapshot_date) INTO v_latest_snap_date
        FROM public.daily_league_rank_snapshot
        WHERE league_id = p_league_id AND timeframe = p_timeframe
          AND game_mode = p_game_mode AND snapshot_date < p_snapshot_date;

        WITH snapshot_members AS (
            SELECT
                dr.user_id,
                dr.rank,
                ds.games_played,
                ds.games_won,
                ds.win_rate,
                ds.avg_guesses,
                ds.current_streak,
                ds.max_streak,
                ds.elementle_rating,
                prev.rank AS yesterdays_rank,
                CASE WHEN ds.games_played < v_min_games THEN true ELSE false END AS is_unranked,
                CASE WHEN ds.games_played < v_min_games THEN 1 ELSE 0 END AS section
            FROM public.daily_league_rank_snapshot dr
            JOIN public.daily_user_stats_snapshot ds
                ON ds.user_id = dr.user_id
                AND ds.snapshot_date = dr.snapshot_date
                AND ds.timeframe = dr.timeframe
                AND ds.game_mode = dr.game_mode
            LEFT JOIN public.daily_league_rank_snapshot prev
                ON prev.league_id = dr.league_id AND prev.user_id = dr.user_id
                AND prev.snapshot_date = v_latest_snap_date
                AND prev.timeframe = dr.timeframe AND prev.game_mode = dr.game_mode
            WHERE dr.league_id = p_league_id
              AND dr.snapshot_date = p_snapshot_date
              AND dr.timeframe = p_timeframe
              AND dr.game_mode = p_game_mode
        )
        SELECT jsonb_agg(
            jsonb_build_object(
                'rank', sm.rank,
                'user_id', sm.user_id,
                'league_nickname', COALESCE(m.league_nickname, up.global_display_name, 'Player'),
                'global_display_name', COALESCE(up.global_display_name, up.first_name, 'Player'),
                'global_tag', COALESCE(up.global_tag, '#0000'),
                'elementle_rating', ROUND(COALESCE(sm.elementle_rating, 0), 1),
                'current_streak', COALESCE(sm.current_streak, 0),
                'games_played', COALESCE(sm.games_played, 0),
                'games_won', COALESCE(sm.games_won, 0),
                'win_rate', ROUND(COALESCE(sm.win_rate, 0), 1),
                'avg_guesses', ROUND(COALESCE(sm.avg_guesses, 0), 1),
                'max_streak', COALESCE(sm.max_streak, 0),
                'is_me', (sm.user_id = v_user_id),
                'yesterdays_rank', sm.yesterdays_rank,
                'is_unranked', sm.is_unranked
            ) ORDER BY sm.section, sm.rank
        ) INTO v_standings
        FROM snapshot_members sm
        JOIN public.league_members m ON m.league_id = p_league_id AND m.user_id = sm.user_id
        JOIN public.user_profiles up ON up.id = sm.user_id;

        SELECT (row_data->>'rank')::integer INTO v_my_rank
        FROM (SELECT jsonb_array_elements(v_standings) AS row_data) t
        WHERE row_data->>'user_id' = v_user_id::text;

        SELECT COUNT(*) INTO v_total
        FROM public.league_members
        WHERE league_id = p_league_id
          AND CASE WHEN p_game_mode = 'user' THEN is_active_user ELSE is_active_region END = true;

        RETURN jsonb_build_object(
            'standings', COALESCE(v_standings, '[]'::jsonb),
            'my_rank', v_my_rank,
            'total_members', v_total,
            'is_snapshot', true,
            'snapshot_date', p_snapshot_date,
            'min_games_threshold', v_min_games
        );
    END IF;

    -- ── LIVE MODE ──
    -- Get latest snapshot for yesterdays_rank
    SELECT MAX(snapshot_date) INTO v_latest_snap_date
    FROM public.daily_league_rank_snapshot
    WHERE league_id = p_league_id AND timeframe = p_timeframe AND game_mode = p_game_mode;

    WITH all_members AS (
        SELECT
            m.user_id,
            COALESCE(s.elementle_rating, 0) AS elementle_rating,
            COALESCE(s.current_streak, 0) AS current_streak,
            COALESCE(s.games_played, 0) AS games_played,
            COALESCE(s.games_won, 0) AS games_won,
            COALESCE(s.win_rate, 0) AS win_rate,
            COALESCE(s.avg_guesses, 0) AS avg_guesses,
            COALESCE(s.max_streak_mtd, s.current_streak, 0) AS max_streak,
            snap.rank AS yesterdays_rank,
            CASE WHEN COALESCE(s.games_played, 0) < v_min_games THEN true ELSE false END AS is_unranked,
            CASE WHEN COALESCE(s.games_played, 0) < v_min_games THEN 1 ELSE 0 END AS section
        FROM public.league_members m
        LEFT JOIN public.league_standings_live s
            ON s.league_id = m.league_id AND s.user_id = m.user_id
            AND s.timeframe = p_timeframe AND s.game_mode = p_game_mode
        LEFT JOIN public.daily_league_rank_snapshot snap
            ON snap.league_id = p_league_id AND snap.user_id = m.user_id
            AND snap.snapshot_date = v_latest_snap_date
            AND snap.timeframe = p_timeframe AND snap.game_mode = p_game_mode
        WHERE m.league_id = p_league_id
          AND CASE WHEN p_game_mode = 'user' THEN m.is_active_user ELSE m.is_active_region END = true
    ),
    ranked_members AS (
        -- Ranked: users with enough games
        SELECT
            user_id,
            RANK() OVER (
                ORDER BY elementle_rating DESC,
                         games_played DESC, avg_guesses ASC
            ) AS rank,
            elementle_rating, current_streak, games_played, games_won,
            win_rate, avg_guesses, max_streak, yesterdays_rank,
            is_unranked, section
        FROM all_members
        WHERE NOT is_unranked
        
        UNION ALL
        
        -- Unranked: users with insufficient games
        SELECT
            user_id,
            ROW_NUMBER() OVER (
                ORDER BY games_played DESC, elementle_rating DESC
            ) AS rank,
            elementle_rating, current_streak, games_played, games_won,
            win_rate, avg_guesses, max_streak, yesterdays_rank,
            is_unranked, section
        FROM all_members
        WHERE is_unranked
    )
    SELECT jsonb_agg(
        jsonb_build_object(
            'rank', rm.rank,
            'user_id', rm.user_id,
            'league_nickname', COALESCE(m.league_nickname, up.global_display_name, 'Player'),
            'global_display_name', COALESCE(up.global_display_name, up.first_name, 'Player'),
            'global_tag', COALESCE(up.global_tag, '#0000'),
            'elementle_rating', ROUND(rm.elementle_rating, 1),
            'current_streak', rm.current_streak,
            'games_played', rm.games_played,
            'games_won', rm.games_won,
            'win_rate', ROUND(rm.win_rate, 1),
            'avg_guesses', ROUND(rm.avg_guesses, 1),
            'max_streak', rm.max_streak,
            'is_me', (rm.user_id = v_user_id),
            'yesterdays_rank', rm.yesterdays_rank,
            'is_unranked', rm.is_unranked
        ) ORDER BY rm.section, rm.rank
    ) INTO v_standings
    FROM ranked_members rm
    JOIN public.league_members m ON m.league_id = p_league_id AND m.user_id = rm.user_id
    JOIN public.user_profiles up ON up.id = rm.user_id;

    SELECT (row_data->>'rank')::integer INTO v_my_rank
    FROM (SELECT jsonb_array_elements(v_standings) AS row_data) t
    WHERE row_data->>'user_id' = v_user_id::text;

    SELECT COUNT(*) INTO v_total
    FROM public.league_members
    WHERE league_id = p_league_id
      AND CASE WHEN p_game_mode = 'user' THEN is_active_user ELSE is_active_region END = true;

    RETURN jsonb_build_object(
        'standings', COALESCE(v_standings, '[]'::jsonb),
        'my_rank', v_my_rank,
        'total_members', v_total,
        'is_live', true,
        'min_games_threshold', v_min_games
    );
END;
$fn_gs_v7$;


-- ─── 5. get_my_awards v4 — source stats from daily_user_stats_snapshot ──────
-- The old version JOINed league_standings_snapshot which lacks games_played,
-- win_rate, avg_guesses etc. This version JOINs daily_user_stats_snapshot
-- using the last day of the period as the snapshot_date.

CREATE OR REPLACE FUNCTION public.get_my_awards()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $fn_my_awards_v4$
DECLARE
    v_user_id uuid := auth.uid();
    v_medals jsonb;
    v_badges jsonb;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required';
    END IF;

    -- Medals with stats from daily_user_stats_snapshot (last day of period)
    SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
            'id', la.id,
            'league_id', la.league_id,
            'league_name', lg.name,
            'timeframe', la.timeframe,
            'period_label', la.period_label,
            'medal', la.medal,
            'elementle_rating', ROUND(COALESCE(la.elementle_rating, 0), 1),
            'is_awarded', la.is_awarded,
            'game_mode', la.game_mode,
            'games_played', COALESCE(ds.games_played, 0),
            'games_won', COALESCE(ds.games_won, 0),
            'win_rate', ROUND(COALESCE(ds.win_rate, 0), 1),
            'avg_guesses', ROUND(COALESCE(ds.avg_guesses, 0), 1),
            'awarded_at', la.awarded_at
        ) ORDER BY la.awarded_at DESC
    ), '[]'::jsonb)
    INTO v_medals
    FROM public.league_awards la
    JOIN public.leagues lg ON lg.id = la.league_id
    LEFT JOIN public.daily_user_stats_snapshot ds
        ON ds.user_id = la.user_id
       AND ds.snapshot_date = CASE
           WHEN LENGTH(la.period_label) = 4 THEN
               -- Year like '2025' → Dec 31 of that year
               (la.period_label || '-12-31')::date
           ELSE
               -- Month like '2026-02' → last day of that month
               ((la.period_label || '-01')::date + INTERVAL '1 month' - INTERVAL '1 day')::date
           END
       AND ds.timeframe = la.timeframe
       AND ds.game_mode = COALESCE(la.game_mode, 'region')
    WHERE la.user_id = v_user_id;

    -- Global Percentile Badges (unchanged)
    SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
            'timeframe', gpa.timeframe,
            'period_label', gpa.period_label,
            'percentile_rank', gpa.percentile_rank,
            'percentile_tier', gpa.percentile_tier,
            'elementle_rating', ROUND(COALESCE(gpa.elementle_rating, 0), 1),
            'total_ranked', gpa.total_ranked,
            'awarded_at', gpa.awarded_at
        ) ORDER BY gpa.awarded_at DESC
    ), '[]'::jsonb)
    INTO v_badges
    FROM public.global_percentile_awards gpa
    WHERE gpa.user_id = v_user_id;

    RETURN jsonb_build_object(
        'medals', v_medals,
        'percentile_badges', v_badges
    );
END;
$fn_my_awards_v4$;
