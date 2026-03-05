-- ============================================================================
-- FIX: Store game stats in league_standings_snapshot
--
-- The snapshot table only stored elementle_rating + rank. Historical views
-- showed 0 for Played/Win%/Avg because the data wasn't captured.
--
-- This migration:
--   1. Adds games_played, games_won, win_rate, avg_guesses, current_streak
--      columns to league_standings_snapshot
--   2. Updates snapshot_period_standings() to capture them
--   3. Updates get_historical_standings() to return them
-- ============================================================================


-- ─── 1. Add stat columns to snapshot table ──────────────────────────────────

ALTER TABLE public.league_standings_snapshot
    ADD COLUMN IF NOT EXISTS games_played   integer DEFAULT 0,
    ADD COLUMN IF NOT EXISTS games_won      integer DEFAULT 0,
    ADD COLUMN IF NOT EXISTS win_rate       numeric DEFAULT 0,
    ADD COLUMN IF NOT EXISTS avg_guesses    numeric DEFAULT 0,
    ADD COLUMN IF NOT EXISTS current_streak integer DEFAULT 0;


-- ─── 2. Update snapshot_period_standings to capture stats ───────────────────

CREATE OR REPLACE FUNCTION public.snapshot_period_standings(
    p_timeframe text,
    p_period_label text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $fn_snapshot_v3$
BEGIN
    INSERT INTO public.league_standings_snapshot
        (league_id, user_id, timeframe, period_label, game_mode,
         elementle_rating, rank,
         games_played, games_won, win_rate, avg_guesses, current_streak,
         frozen_at)
    SELECT
        s.league_id, s.user_id, p_timeframe, p_period_label, s.game_mode,
        s.elementle_rating,
        ROW_NUMBER() OVER (
            PARTITION BY s.league_id, s.game_mode
            ORDER BY s.elementle_rating DESC, s.current_streak DESC,
                     s.games_played DESC, s.avg_guesses ASC
        ),
        s.games_played, s.games_won, s.win_rate, s.avg_guesses, s.current_streak,
        now()
    FROM public.league_standings_live s
    WHERE s.timeframe = p_timeframe
    ON CONFLICT (league_id, user_id, timeframe, period_label, game_mode)
    DO UPDATE SET
        elementle_rating = EXCLUDED.elementle_rating,
        rank = EXCLUDED.rank,
        games_played = EXCLUDED.games_played,
        games_won = EXCLUDED.games_won,
        win_rate = EXCLUDED.win_rate,
        avg_guesses = EXCLUDED.avg_guesses,
        current_streak = EXCLUDED.current_streak,
        frozen_at = EXCLUDED.frozen_at;
END;
$fn_snapshot_v3$;


-- ─── 3. Update get_historical_standings to return stored stats ──────────────

CREATE OR REPLACE FUNCTION public.get_historical_standings(
    p_league_id uuid, p_timeframe text, p_period_label text,
    p_game_mode text DEFAULT 'region'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $fn_hist_v3$
DECLARE
    v_user_id uuid := auth.uid();
    v_standings jsonb; v_my_rank integer; v_total integer;
BEGIN
    IF v_user_id IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
    IF NOT EXISTS(SELECT 1 FROM public.league_members WHERE league_id = p_league_id AND user_id = v_user_id) THEN
        RAISE EXCEPTION 'Not a member of this league';
    END IF;

    SELECT jsonb_agg(row_data ORDER BY (row_data->>'rank')::int) INTO v_standings
    FROM (
        SELECT jsonb_build_object(
            'rank', s.rank, 'user_id', s.user_id,
            'league_nickname', COALESCE(lm.league_nickname, up.global_display_name, 'Player'),
            'global_display_name', COALESCE(up.global_display_name, up.first_name, 'Player'),
            'global_tag', COALESCE(up.global_tag, '#0000'),
            'elementle_rating', ROUND(COALESCE(s.elementle_rating, 0), 1),
            'current_streak', COALESCE(s.current_streak, 0),
            'games_played', COALESCE(s.games_played, 0),
            'games_won', COALESCE(s.games_won, 0),
            'win_rate', ROUND(COALESCE(s.win_rate, 0), 1),
            'avg_guesses', ROUND(COALESCE(s.avg_guesses, 0), 1),
            'is_me', (s.user_id = v_user_id), 'yesterdays_rank', NULL
        ) AS row_data
        FROM public.league_standings_snapshot s
        LEFT JOIN public.league_members lm ON lm.league_id = s.league_id AND lm.user_id = s.user_id
        LEFT JOIN public.user_profiles up ON up.id = s.user_id
        WHERE s.league_id = p_league_id AND s.timeframe = p_timeframe
          AND s.period_label = p_period_label AND s.game_mode = p_game_mode
    ) ranked;

    SELECT (row_data->>'rank')::integer INTO v_my_rank
    FROM (SELECT jsonb_array_elements(v_standings) AS row_data) t
    WHERE row_data->>'user_id' = v_user_id::text;

    v_total := COALESCE(jsonb_array_length(v_standings), 0);
    RETURN jsonb_build_object('standings', COALESCE(v_standings, '[]'::jsonb),
        'my_rank', v_my_rank, 'total_members', v_total,
        'is_historical', true, 'period_label', p_period_label);
END;
$fn_hist_v3$;
