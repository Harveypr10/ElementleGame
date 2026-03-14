-- ============================================================================
-- FIX: Restore ranked/unranked separation in get_league_standings
--
-- v7 lost the min_games filter when adding yesterday's rank JOIN.
-- This v8 merges both features:
--   1. yesterday's rank from daily_league_rank_snapshot (v7 addition)
--   2. ranked/unranked UNION ALL with is_unranked flag (v5 feature)
--   3. min_games_threshold in the response (v5 feature)
-- ============================================================================

-- Drop all overloaded signatures to avoid ambiguity
DROP FUNCTION IF EXISTS public.get_league_standings(uuid, text);
DROP FUNCTION IF EXISTS public.get_league_standings(uuid, text, text);
DROP FUNCTION IF EXISTS public.get_league_standings(uuid, text, text, date);

CREATE OR REPLACE FUNCTION public.get_league_standings(
    p_league_id     uuid,
    p_timeframe     text DEFAULT 'mtd',
    p_game_mode     text DEFAULT 'region',
    p_snapshot_date date DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $fn_standings_v8$
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

    -- ── Admin settings ───────────────────────────────────────────────────
    SELECT COALESCE(
        (SELECT value::int FROM public.admin_settings WHERE key = 'min_games_for_cumulative_percentile'), 5
    ) INTO v_min_games;

    -- ── SNAPSHOT MODE ────────────────────────────────────────────────────
    IF p_snapshot_date IS NOT NULL THEN
        SELECT jsonb_agg(row_data ORDER BY (row_data->>'rank')::int NULLS LAST) INTO v_standings
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
                'yesterdays_rank',  prev.rank,
                'is_unranked',      false
            ) AS row_data
            FROM public.daily_league_rank_snapshot r
            JOIN public.daily_user_stats_snapshot s
                ON s.user_id = r.user_id
               AND s.snapshot_date = r.snapshot_date
               AND s.timeframe = r.timeframe
               AND s.game_mode = r.game_mode
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
            'standings',           COALESCE(v_standings, '[]'::jsonb),
            'my_rank',             v_my_rank,
            'total_members',       v_total,
            'is_snapshot',         true,
            'is_live',             false,
            'snapshot_date',       p_snapshot_date,
            'min_games_threshold', v_min_games
        );
    END IF;

    -- ── LIVE MODE ────────────────────────────────────────────────────────
    -- Blind Phase Check
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

    -- ── Ranked + Unranked via UNION ALL (with yesterday's rank) ──────────
    WITH all_members AS (
        SELECT
            m.user_id,
            m.league_nickname,
            COALESCE(up.global_display_name, up.first_name, 'Player') AS global_display_name,
            COALESCE(up.global_tag, '#0000')                          AS global_tag,
            COALESCE(s.elementle_rating, 0)                           AS elementle_rating,
            COALESCE(s.current_streak, 0)                             AS current_streak,
            COALESCE(s.games_played, 0)                               AS games_played,
            COALESCE(s.games_won, 0)                                  AS games_won,
            COALESCE(s.win_rate, 0)                                   AS win_rate,
            COALESCE(s.avg_guesses, 0)                                AS avg_guesses,
            GREATEST(COALESCE(s.max_streak_mtd, 0), COALESCE(s.max_streak_ytd, 0)) AS max_streak,
            (m.user_id = v_user_id)                                   AS is_me,
            prev_rank.rank                                            AS yesterdays_rank
        FROM public.league_members m
        LEFT JOIN public.league_standings_live s
            ON s.league_id = m.league_id AND s.user_id = m.user_id
           AND s.timeframe = p_timeframe AND s.game_mode = p_game_mode
        LEFT JOIN public.user_profiles up ON up.id = m.user_id
        LEFT JOIN public.daily_league_rank_snapshot prev_rank
            ON prev_rank.league_id = m.league_id
           AND prev_rank.user_id = m.user_id
           AND prev_rank.snapshot_date = CURRENT_DATE - 1
           AND prev_rank.timeframe = p_timeframe
           AND prev_rank.game_mode = p_game_mode
        WHERE m.league_id = p_league_id
          AND CASE WHEN p_game_mode = 'user' THEN m.is_active_user ELSE m.is_active_region END = true
    ),
    ranked AS (
        SELECT
            jsonb_build_object(
                'rank',                ROW_NUMBER() OVER (
                                           ORDER BY elementle_rating DESC,
                                                    current_streak   DESC,
                                                    games_played     DESC,
                                                    avg_guesses      ASC
                                       ),
                'user_id',             user_id,
                'league_nickname',     league_nickname,
                'global_display_name', global_display_name,
                'global_tag',          global_tag,
                'elementle_rating',    ROUND(elementle_rating, 1),
                'current_streak',      current_streak,
                'games_played',        games_played,
                'games_won',           games_won,
                'win_rate',            ROUND(win_rate, 1),
                'avg_guesses',         ROUND(avg_guesses, 1),
                'max_streak',          max_streak,
                'is_me',               is_me,
                'yesterdays_rank',     yesterdays_rank,
                'is_unranked',         false
            ) AS row_data,
            ROW_NUMBER() OVER (
                ORDER BY elementle_rating DESC, current_streak DESC,
                         games_played DESC, avg_guesses ASC
            ) AS sort_key,
            0 AS section
        FROM all_members
        WHERE games_played >= v_min_games
    ),
    unranked AS (
        SELECT
            jsonb_build_object(
                'rank',                NULL,
                'user_id',             user_id,
                'league_nickname',     league_nickname,
                'global_display_name', global_display_name,
                'global_tag',          global_tag,
                'elementle_rating',    NULL,
                'current_streak',      NULL,
                'games_played',        games_played,
                'games_won',           NULL,
                'win_rate',            NULL,
                'avg_guesses',         NULL,
                'max_streak',          NULL,
                'is_me',               is_me,
                'yesterdays_rank',     NULL,
                'is_unranked',         true
            ) AS row_data,
            ROW_NUMBER() OVER (
                ORDER BY games_played DESC, global_display_name ASC
            ) AS sort_key,
            1 AS section
        FROM all_members
        WHERE games_played < v_min_games
    ),
    combined AS (
        SELECT row_data FROM ranked   ORDER BY sort_key
        UNION ALL
        SELECT row_data FROM unranked ORDER BY sort_key
    )
    SELECT jsonb_agg(row_data) INTO v_standings FROM combined;

    -- My rank (NULL if unranked)
    SELECT (row_data->>'rank')::integer INTO v_my_rank
    FROM (SELECT jsonb_array_elements(v_standings) AS row_data) t
    WHERE row_data->>'user_id' = v_user_id::text
      AND row_data->>'rank' IS NOT NULL;

    SELECT COUNT(*) INTO v_total FROM public.league_members
    WHERE league_id = p_league_id
      AND CASE WHEN p_game_mode = 'user' THEN is_active_user ELSE is_active_region END = true;

    RETURN jsonb_build_object(
        'standings',           COALESCE(v_standings, '[]'::jsonb),
        'my_rank',             v_my_rank,
        'total_members',       v_total,
        'is_snapshot',         false,
        'is_live',             true,
        'min_games_threshold', v_min_games
    );
END;
$fn_standings_v8$;
