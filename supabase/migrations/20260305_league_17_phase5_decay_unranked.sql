-- ============================================================================
-- PHASE 5 — Daily Scoring Decay + Unranked Tier
--
-- 1. refresh_all_active_league_standings()  — batch recalc for all users
-- 2. pg_cron schedule                       — daily at 00:05 UTC
-- 3. get_league_standings v5                — ranked / unranked UNION ALL
-- ============================================================================


-- ═══════════════════════════════════════════════════════════════════════════
-- 1. BATCH REFRESH — recalculates every active member's rating
--    so that inactive players' scores decay as days_in_period grows.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.refresh_all_active_league_standings()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $fn_refresh_all$
DECLARE
    v_rec    record;
    v_count  int := 0;
    v_start  timestamptz := clock_timestamp();
BEGIN
    -- Collect distinct (user_id, region) for every user who is active in
    -- at least one league, for at least one game mode.
    FOR v_rec IN
        SELECT DISTINCT
            lm.user_id,
            COALESCE(up.region, 'UK') AS region
        FROM public.league_members lm
        JOIN public.user_profiles up ON up.id = lm.user_id
        WHERE lm.is_active_region = true
           OR lm.is_active_user   = true
    LOOP
        -- Region mode refresh
        PERFORM public.refresh_user_league_standings(
            v_rec.user_id, v_rec.region, 'region'
        );

        -- User mode refresh
        PERFORM public.refresh_user_league_standings(
            v_rec.user_id, 'GLOBAL', 'user'
        );

        v_count := v_count + 1;
    END LOOP;

    RETURN jsonb_build_object(
        'users_refreshed', v_count,
        'started_at',      v_start,
        'finished_at',     clock_timestamp()
    );
END;
$fn_refresh_all$;


-- ═══════════════════════════════════════════════════════════════════════════
-- 2. pg_cron — run daily at 00:05 UTC
--    (pg_cron extension must be enabled on the project)
-- ═══════════════════════════════════════════════════════════════════════════

-- Drop if it already exists (idempotent)
SELECT cron.unschedule('daily-league-standings-decay')
WHERE EXISTS (
    SELECT 1 FROM cron.job WHERE jobname = 'daily-league-standings-decay'
);

SELECT cron.schedule(
    'daily-league-standings-decay',
    '5 0 * * *',
    $$SELECT public.refresh_all_active_league_standings()$$
);


-- ═══════════════════════════════════════════════════════════════════════════
-- 3. get_league_standings v5 — ranked / unranked UNION ALL
--
--    Ranked players  (games_played >= min_games) → numbered 1…N at the top
--    Unranked players (games_played < min_games)  → appended at bottom,
--      rank = NULL, is_unranked = true, win_rate / avg_guesses / streak = NULL
--
--    Top-level response includes min_games_threshold so the frontend can
--    render the divider text: "Players must play a minimum of X games…"
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.get_league_standings(
    p_league_id uuid,
    p_timeframe text DEFAULT 'mtd',
    p_game_mode text DEFAULT 'region'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $fn_standings_v5$
DECLARE
    v_user_id         uuid := auth.uid();
    v_blind_threshold int;
    v_min_games       int;
    v_day_of_period   int;
    v_prev_label      text;
    v_standings       jsonb;
    v_my_rank         integer;
    v_total           integer;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required';
    END IF;

    -- Membership check
    IF NOT EXISTS(
        SELECT 1 FROM public.league_members
        WHERE league_id = p_league_id AND user_id = v_user_id
          AND CASE WHEN p_game_mode = 'user'
                   THEN is_active_user
                   ELSE is_active_region
              END = true
    ) THEN
        RAISE EXCEPTION 'Not an active member of this league for this mode';
    END IF;

    -- ── Admin Settings ──────────────────────────────────────────────────
    SELECT COALESCE(
        (SELECT value::int FROM public.admin_settings
         WHERE key = 'min_games_for_cumulative_percentile'), 5
    ) INTO v_blind_threshold;

    SELECT COALESCE(
        (SELECT value::int FROM public.admin_settings
         WHERE key = 'min_games_for_cumulative_percentile'), 5
    ) INTO v_min_games;

    -- ── Blind Phase Check ───────────────────────────────────────────────
    IF p_timeframe = 'mtd' THEN
        v_day_of_period := EXTRACT(day FROM CURRENT_DATE)::int;
        v_prev_label    := TO_CHAR(CURRENT_DATE - INTERVAL '1 month', 'YYYY-MM');
    ELSE
        v_day_of_period := EXTRACT(doy FROM CURRENT_DATE)::int;
        v_prev_label    := TO_CHAR(CURRENT_DATE - INTERVAL '1 year', 'YYYY');
    END IF;

    IF v_day_of_period < v_blind_threshold THEN
        IF EXISTS (
            SELECT 1 FROM public.league_standings_snapshot
            WHERE league_id = p_league_id AND timeframe = p_timeframe
              AND period_label = v_prev_label AND game_mode = p_game_mode
        ) THEN
            RETURN public.get_historical_standings(
                p_league_id, p_timeframe, v_prev_label, p_game_mode
            );
        END IF;
    END IF;

    -- ── Live Standings: Ranked + Unranked via UNION ALL ──────────────────

    WITH all_members AS (
        SELECT
            m.user_id,
            m.league_nickname,
            m.yesterdays_rank,
            COALESCE(up.global_display_name, up.first_name, 'Player') AS global_display_name,
            COALESCE(up.global_tag, '#0000')                          AS global_tag,
            COALESCE(s.elementle_rating, 0)                           AS elementle_rating,
            COALESCE(s.current_streak, 0)                             AS current_streak,
            COALESCE(s.games_played, 0)                               AS games_played,
            COALESCE(s.games_won, 0)                                  AS games_won,
            COALESCE(s.win_rate, 0)                                   AS win_rate,
            COALESCE(s.avg_guesses, 0)                                AS avg_guesses,
            (m.user_id = v_user_id)                                   AS is_me
        FROM public.league_members m
        LEFT JOIN public.league_standings_live s
            ON s.league_id = m.league_id AND s.user_id = m.user_id
           AND s.timeframe = p_timeframe AND s.game_mode = p_game_mode
        LEFT JOIN public.user_profiles up ON up.id = m.user_id
        WHERE m.league_id = p_league_id
          AND CASE WHEN p_game_mode = 'user'
                   THEN m.is_active_user
                   ELSE m.is_active_region
              END = true
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
                'is_me',               is_me,
                'yesterdays_rank',     yesterdays_rank,
                'is_unranked',         false
            ) AS row_data,
            ROW_NUMBER() OVER (
                ORDER BY elementle_rating DESC, current_streak DESC,
                         games_played DESC, avg_guesses ASC
            ) AS sort_key,
            0 AS section   -- 0 = ranked, goes first
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
                'is_me',               is_me,
                'yesterdays_rank',     NULL,
                'is_unranked',         true
            ) AS row_data,
            ROW_NUMBER() OVER (
                ORDER BY games_played DESC, global_display_name ASC
            ) AS sort_key,
            1 AS section   -- 1 = unranked, goes after ranked
        FROM all_members
        WHERE games_played < v_min_games
    ),
    combined AS (
        SELECT row_data FROM ranked   ORDER BY sort_key
        UNION ALL
        SELECT row_data FROM unranked ORDER BY sort_key
    )
    SELECT jsonb_agg(row_data) INTO v_standings FROM combined;

    -- ── My Rank (NULL if unranked) ──────────────────────────────────────
    SELECT (row_data->>'rank')::integer INTO v_my_rank
    FROM (SELECT jsonb_array_elements(v_standings) AS row_data) t
    WHERE row_data->>'user_id' = v_user_id::text
      AND row_data->>'rank' IS NOT NULL;

    -- ── Total active members ────────────────────────────────────────────
    SELECT COUNT(*) INTO v_total FROM public.league_members
    WHERE league_id = p_league_id
      AND CASE WHEN p_game_mode = 'user'
               THEN is_active_user
               ELSE is_active_region
          END = true;

    RETURN jsonb_build_object(
        'standings',           COALESCE(v_standings, '[]'::jsonb),
        'my_rank',             v_my_rank,
        'total_members',       v_total,
        'is_historical',       false,
        'min_games_threshold', v_min_games
    );
END;
$fn_standings_v5$;
