-- ============================================================================
-- NORMALIZED DAILY SNAPSHOTS, RATING REVAMP & PER-LEAGUE TIMEZONES
-- Migration: 20260309_league_daily_snapshots.sql
--
-- Sections:
--   1. daily_user_stats_snapshot table
--   2. daily_league_rank_snapshot table
--   3. leagues alterations + system league seeds
--   4. league_standings_live max streak columns
--   5. New admin_settings rows
--   6. region_to_timezone() helper
--   7. recalculate_league_timezone()
--   8. calculate_user_league_rating() v2 (region mode)
--   9. calculate_user_league_rating_user_mode() v2
--  10. refresh_user_league_standings() v3
--  11. process_pending_snapshots() (Phase 1 + 2 + prune)
--  12. get_league_standings() v6
--  13. get_league_snapshot_range()
--  14. Wire recalculate_league_timezone into join/leave/rejoin RPCs
--  15. Cron: unschedule old, schedule new 30-min job
-- ============================================================================


-- ═══════════════════════════════════════════════════════════════════════════
-- 1. SCHEMA: daily_user_stats_snapshot
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.daily_user_stats_snapshot (
    id               bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id          uuid    NOT NULL,
    snapshot_date    date    NOT NULL,
    timeframe        text    NOT NULL CHECK (timeframe IN ('mtd','ytd')),
    game_mode        text    NOT NULL CHECK (game_mode IN ('region','user')),
    elementle_rating numeric DEFAULT 0,
    games_played     integer DEFAULT 0,
    games_won        integer DEFAULT 0,
    win_rate         numeric DEFAULT 0,
    avg_guesses      numeric DEFAULT 0,
    max_streak       integer DEFAULT 0,
    current_streak   integer DEFAULT 0,
    frozen_at        timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT uq_daily_user_stats UNIQUE (user_id, snapshot_date, timeframe, game_mode)
);

CREATE INDEX IF NOT EXISTS idx_daily_user_stats_date
    ON public.daily_user_stats_snapshot (snapshot_date, user_id);

COMMENT ON TABLE public.daily_user_stats_snapshot
    IS 'Phase 1 snapshot: user stats frozen at the user''s local midnight. Not league-specific.';


-- ═══════════════════════════════════════════════════════════════════════════
-- 2. SCHEMA: daily_league_rank_snapshot
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.daily_league_rank_snapshot (
    id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    league_id       uuid    NOT NULL REFERENCES public.leagues(id) ON DELETE CASCADE,
    user_id         uuid    NOT NULL,
    snapshot_date   date    NOT NULL,
    timeframe       text    NOT NULL CHECK (timeframe IN ('mtd','ytd')),
    game_mode       text    NOT NULL CHECK (game_mode IN ('region','user')),
    rank            integer NOT NULL,
    CONSTRAINT uq_daily_league_rank UNIQUE (league_id, user_id, snapshot_date, timeframe, game_mode)
);

CREATE INDEX IF NOT EXISTS idx_daily_league_rank_lookup
    ON public.daily_league_rank_snapshot (league_id, timeframe, game_mode, snapshot_date);

COMMENT ON TABLE public.daily_league_rank_snapshot
    IS 'Phase 2 snapshot: league-specific rank only. Stats joined from daily_user_stats_snapshot at read time.';


-- ═══════════════════════════════════════════════════════════════════════════
-- 3. SCHEMA: leagues alterations + system league timezone seeds
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE public.leagues
    ADD COLUMN IF NOT EXISTS timezone          text NOT NULL DEFAULT 'Etc/GMT+12',
    ADD COLUMN IF NOT EXISTS last_snapshot_date date;

-- Seed system league timezones
UPDATE public.leagues SET timezone = 'Etc/GMT+12'     WHERE system_region = 'GLOBAL';
UPDATE public.leagues SET timezone = 'Europe/London'  WHERE system_region = 'UK';


-- ═══════════════════════════════════════════════════════════════════════════
-- 4. SCHEMA: league_standings_live max streak columns
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE public.league_standings_live
    ADD COLUMN IF NOT EXISTS max_streak_mtd integer DEFAULT 0,
    ADD COLUMN IF NOT EXISTS max_streak_ytd integer DEFAULT 0;


-- ═══════════════════════════════════════════════════════════════════════════
-- 5. DATA: New admin_settings rows for rating formula
-- ═══════════════════════════════════════════════════════════════════════════

INSERT INTO public.admin_settings (key, value) VALUES
    ('rating_base_guesses',       '6'),
    ('rating_ratio_multiplier',   '3'),
    ('rating_streak_multiplier',  '1.5'),
    ('rating_min_average_floor',  '1.0'),
    ('rating_penalty_1_guess',    '0.5'),
    ('rating_penalty_2_guess',    '0.25')
ON CONFLICT (key) DO NOTHING;


-- ═══════════════════════════════════════════════════════════════════════════
-- 6. FUNCTION: region_to_timezone() helper
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.region_to_timezone(p_region text)
RETURNS text
LANGUAGE plpgsql IMMUTABLE
AS $fn_r2tz$
BEGIN
    RETURN CASE UPPER(COALESCE(p_region, ''))
        WHEN 'UK'     THEN 'Europe/London'
        WHEN 'US'     THEN 'America/New_York'
        WHEN 'AU'     THEN 'Australia/Sydney'
        WHEN 'GLOBAL' THEN 'Etc/GMT+12'
        ELSE 'Etc/GMT+12'
    END;
END;
$fn_r2tz$;


-- ═══════════════════════════════════════════════════════════════════════════
-- 7. FUNCTION: recalculate_league_timezone()
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.recalculate_league_timezone(p_league_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $fn_recalc_tz$
DECLARE
    v_is_system boolean;
    v_latest_tz text;
BEGIN
    -- Skip system leagues (hardcoded timezones)
    SELECT is_system_league INTO v_is_system
    FROM public.leagues WHERE id = p_league_id;

    IF v_is_system IS TRUE THEN RETURN; END IF;

    -- Find the timezone with the most negative UTC offset (furthest behind)
    SELECT tz INTO v_latest_tz
    FROM (
        SELECT DISTINCT
            public.region_to_timezone(COALESCE(up.region, 'GLOBAL')) AS tz,
            EXTRACT(EPOCH FROM (now() AT TIME ZONE public.region_to_timezone(COALESCE(up.region, 'GLOBAL')))
                             - now()) AS utc_offset_secs
        FROM public.league_members lm
        JOIN public.user_profiles up ON up.id = lm.user_id
        WHERE lm.league_id = p_league_id
          AND (lm.is_active_region = true OR lm.is_active_user = true)
    ) member_tzs
    ORDER BY utc_offset_secs ASC
    LIMIT 1;

    IF v_latest_tz IS NOT NULL THEN
        UPDATE public.leagues SET timezone = v_latest_tz WHERE id = p_league_id;
    END IF;
END;
$fn_recalc_tz$;


-- ═══════════════════════════════════════════════════════════════════════════
-- 8. FUNCTION: calculate_user_league_rating() v2 (region mode)
--    Data-driven formula, streak bonus, soft penalty, optional cutoff date
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.calculate_user_league_rating(
    p_user_id    uuid,
    p_region     text,
    p_period     text,
    p_cutoff_date date DEFAULT NULL
)
RETURNS TABLE (
    elementle_rating numeric,
    games_played     integer,
    games_won        integer,
    win_rate         numeric,
    avg_guesses      numeric,
    current_streak   integer,
    max_streak       integer
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $fn_rating_v2$
DECLARE
    -- Admin settings (all from admin_settings, no hardcoded defaults)
    v_base_guesses       numeric;
    v_ratio_multiplier   numeric;
    v_streak_multiplier  numeric;
    v_min_avg_floor      numeric;
    v_penalty_1          numeric;
    v_penalty_2          numeric;
    v_max_guess1         int;
    v_max_guess2         int;
    v_min_games          int;

    -- Period boundaries
    v_effective_date     date;
    v_period_start       date;
    v_days_in_period     int;
    v_month_scale        int := 1;

    -- Aggregated game data
    v_games_played       int := 0;
    v_games_won_count    int := 0;
    v_total_guess_value  numeric := 0;
    v_guess1_count       int := 0;
    v_guess2_count       int := 0;

    -- Calculated values
    v_excess_1           int := 0;
    v_excess_2           int := 0;
    v_avg_guesses        numeric := 0;
    v_rating             numeric := 0;
    v_win_rate           numeric := 0;
    v_current_streak     int := 0;

    -- Streak tracking
    v_max_streak         int := 0;
    v_running_streak     int := 0;
    v_prev_date          date := NULL;
    v_game_date          date;
BEGIN
    -- Load ALL rating params from admin_settings
    SELECT value::numeric INTO v_base_guesses      FROM public.admin_settings WHERE key = 'rating_base_guesses';
    SELECT value::numeric INTO v_ratio_multiplier  FROM public.admin_settings WHERE key = 'rating_ratio_multiplier';
    SELECT value::numeric INTO v_streak_multiplier FROM public.admin_settings WHERE key = 'rating_streak_multiplier';
    SELECT value::numeric INTO v_min_avg_floor     FROM public.admin_settings WHERE key = 'rating_min_average_floor';
    SELECT value::numeric INTO v_penalty_1         FROM public.admin_settings WHERE key = 'rating_penalty_1_guess';
    SELECT value::numeric INTO v_penalty_2         FROM public.admin_settings WHERE key = 'rating_penalty_2_guess';
    SELECT value::int     INTO v_max_guess1        FROM public.admin_settings WHERE key = 'max_guess1_per_month';
    SELECT value::int     INTO v_max_guess2        FROM public.admin_settings WHERE key = 'max_guess2_per_month';
    SELECT value::int     INTO v_min_games         FROM public.admin_settings WHERE key = 'min_games_for_cumulative_percentile';

    -- Effective date: cutoff or today
    v_effective_date := COALESCE(p_cutoff_date, CURRENT_DATE);

    -- Period boundaries
    IF p_period = 'mtd' THEN
        v_period_start := date_trunc('month', v_effective_date)::date;
        v_days_in_period := (v_effective_date - v_period_start)::int;
        v_month_scale := 1;
    ELSIF p_period = 'ytd' THEN
        v_period_start := date_trunc('year', v_effective_date)::date;
        v_days_in_period := (v_effective_date - v_period_start)::int;
        v_month_scale := GREATEST(EXTRACT(month FROM v_effective_date)::int, 1);
    END IF;
    IF v_days_in_period < 1 THEN v_days_in_period := 1; END IF;

    -- Scale thresholds for YTD
    v_max_guess1 := v_max_guess1 * v_month_scale;
    v_max_guess2 := v_max_guess2 * v_month_scale;

    -- Aggregate game data from game_attempts_region
    SELECT
        COUNT(DISTINCT g.allocated_region_id),
        COUNT(DISTINCT g.allocated_region_id) FILTER (WHERE g.result = 'won'),
        COALESCE(SUM(CASE WHEN g.result = 'lost' THEN 6 ELSE g.num_guesses END), 0),
        COALESCE(SUM(CASE WHEN g.result = 'won' AND g.num_guesses = 1 THEN 1 ELSE 0 END), 0),
        COALESCE(SUM(CASE WHEN g.result = 'won' AND g.num_guesses = 2 THEN 1 ELSE 0 END), 0)
    INTO v_games_played, v_games_won_count, v_total_guess_value, v_guess1_count, v_guess2_count
    FROM public.game_attempts_region g
    JOIN public.questions_allocated_region qar ON qar.id = g.allocated_region_id
    WHERE g.user_id = p_user_id
      AND g.result IN ('won', 'lost')
      AND qar.puzzle_date >= v_period_start
      AND qar.puzzle_date <= v_effective_date;

    -- If no games, return zeros
    IF v_games_played = 0 THEN
        RETURN QUERY SELECT 0::numeric, 0, 0, 0::numeric, 0::numeric, 0, 0;
        RETURN;
    END IF;

    -- Calculate max streak for the period
    FOR v_game_date IN
        SELECT DISTINCT qar.puzzle_date
        FROM public.game_attempts_region g
        JOIN public.questions_allocated_region qar ON qar.id = g.allocated_region_id
        WHERE g.user_id = p_user_id AND g.result = 'won'
          AND qar.puzzle_date >= v_period_start
          AND qar.puzzle_date <= v_effective_date
        ORDER BY qar.puzzle_date
    LOOP
        IF v_prev_date IS NULL OR v_game_date = v_prev_date + 1 THEN
            v_running_streak := v_running_streak + 1;
        ELSE
            v_running_streak := 1;
        END IF;
        IF v_running_streak > v_max_streak THEN
            v_max_streak := v_running_streak;
        END IF;
        v_prev_date := v_game_date;
    END LOOP;

    -- Average guesses (all games, not excluding)
    v_avg_guesses := v_total_guess_value::numeric / v_games_played;

    -- Soft penalty: excess above threshold
    v_excess_1 := GREATEST(v_guess1_count - v_max_guess1, 0);
    v_excess_2 := GREATEST(v_guess2_count - v_max_guess2, 0);

    -- Win rate
    v_win_rate := ROUND(v_games_won_count::numeric / v_games_played * 100, 1);

    -- Current streak from user_stats_region
    SELECT COALESCE(us.current_streak, 0) INTO v_current_streak
    FROM public.user_stats_region us
    WHERE us.user_id = p_user_id AND us.region = p_region
    LIMIT 1;

    -- THE FORMULA:
    -- ((base - GREATEST(avg, floor)) * multiplier * (played / days))
    -- + (streak_mult * (max_streak / days))
    -- - (excess_1 * penalty_1) - (excess_2 * penalty_2)
    v_rating := (
        (v_base_guesses - GREATEST(v_avg_guesses, v_min_avg_floor))
        * v_ratio_multiplier
        * (v_games_played::numeric / v_days_in_period)
    ) + (
        v_streak_multiplier * (v_max_streak::numeric / v_days_in_period)
    ) - (
        v_excess_1 * v_penalty_1
    ) - (
        v_excess_2 * v_penalty_2
    );

    -- Floor at zero
    IF v_rating < 0 THEN v_rating := 0; END IF;

    RETURN QUERY SELECT
        ROUND(v_rating, 2),
        v_games_played,
        v_games_won_count,
        v_win_rate,
        ROUND(v_avg_guesses, 2),
        v_current_streak,
        v_max_streak;
END;
$fn_rating_v2$;


-- ═══════════════════════════════════════════════════════════════════════════
-- 9. FUNCTION: calculate_user_league_rating_user_mode() v2
--    Identical formula, reads from game_attempts_user tables
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.calculate_user_league_rating_user_mode(
    p_user_id    uuid,
    p_period     text,
    p_cutoff_date date DEFAULT NULL
)
RETURNS TABLE (
    elementle_rating numeric,
    games_played     integer,
    games_won        integer,
    win_rate         numeric,
    avg_guesses      numeric,
    current_streak   integer,
    max_streak       integer
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $fn_rating_user_v2$
DECLARE
    v_base_guesses       numeric;
    v_ratio_multiplier   numeric;
    v_streak_multiplier  numeric;
    v_min_avg_floor      numeric;
    v_penalty_1          numeric;
    v_penalty_2          numeric;
    v_max_guess1         int;
    v_max_guess2         int;
    v_min_games          int;

    v_effective_date     date;
    v_period_start       date;
    v_days_in_period     int;
    v_month_scale        int := 1;

    v_games_played       int := 0;
    v_games_won_count    int := 0;
    v_total_guess_value  numeric := 0;
    v_guess1_count       int := 0;
    v_guess2_count       int := 0;

    v_excess_1           int := 0;
    v_excess_2           int := 0;
    v_avg_guesses        numeric := 0;
    v_rating             numeric := 0;
    v_win_rate           numeric := 0;
    v_current_streak     int := 0;

    v_max_streak         int := 0;
    v_running_streak     int := 0;
    v_prev_date          date := NULL;
    v_game_date          date;
BEGIN
    SELECT value::numeric INTO v_base_guesses      FROM public.admin_settings WHERE key = 'rating_base_guesses';
    SELECT value::numeric INTO v_ratio_multiplier  FROM public.admin_settings WHERE key = 'rating_ratio_multiplier';
    SELECT value::numeric INTO v_streak_multiplier FROM public.admin_settings WHERE key = 'rating_streak_multiplier';
    SELECT value::numeric INTO v_min_avg_floor     FROM public.admin_settings WHERE key = 'rating_min_average_floor';
    SELECT value::numeric INTO v_penalty_1         FROM public.admin_settings WHERE key = 'rating_penalty_1_guess';
    SELECT value::numeric INTO v_penalty_2         FROM public.admin_settings WHERE key = 'rating_penalty_2_guess';
    SELECT value::int     INTO v_max_guess1        FROM public.admin_settings WHERE key = 'max_guess1_per_month';
    SELECT value::int     INTO v_max_guess2        FROM public.admin_settings WHERE key = 'max_guess2_per_month';
    SELECT value::int     INTO v_min_games         FROM public.admin_settings WHERE key = 'min_games_for_cumulative_percentile';

    v_effective_date := COALESCE(p_cutoff_date, CURRENT_DATE);

    IF p_period = 'mtd' THEN
        v_period_start := date_trunc('month', v_effective_date)::date;
        v_days_in_period := (v_effective_date - v_period_start)::int;
        v_month_scale := 1;
    ELSIF p_period = 'ytd' THEN
        v_period_start := date_trunc('year', v_effective_date)::date;
        v_days_in_period := (v_effective_date - v_period_start)::int;
        v_month_scale := GREATEST(EXTRACT(month FROM v_effective_date)::int, 1);
    END IF;
    IF v_days_in_period < 1 THEN v_days_in_period := 1; END IF;

    v_max_guess1 := v_max_guess1 * v_month_scale;
    v_max_guess2 := v_max_guess2 * v_month_scale;

    -- KEY DIFFERENCE: reads from game_attempts_user + questions_allocated_user
    SELECT
        COUNT(DISTINCT g.allocated_user_id),
        COUNT(DISTINCT g.allocated_user_id) FILTER (WHERE g.result = 'won'),
        COALESCE(SUM(CASE WHEN g.result = 'lost' THEN 6 ELSE g.num_guesses END), 0),
        COALESCE(SUM(CASE WHEN g.result = 'won' AND g.num_guesses = 1 THEN 1 ELSE 0 END), 0),
        COALESCE(SUM(CASE WHEN g.result = 'won' AND g.num_guesses = 2 THEN 1 ELSE 0 END), 0)
    INTO v_games_played, v_games_won_count, v_total_guess_value, v_guess1_count, v_guess2_count
    FROM public.game_attempts_user g
    JOIN public.questions_allocated_user qau ON qau.id = g.allocated_user_id
    WHERE g.user_id = p_user_id
      AND g.result IN ('won', 'lost')
      AND qau.puzzle_date >= v_period_start
      AND qau.puzzle_date <= v_effective_date;

    IF v_games_played = 0 THEN
        RETURN QUERY SELECT 0::numeric, 0, 0, 0::numeric, 0::numeric, 0, 0;
        RETURN;
    END IF;

    -- Max streak for period (user mode tables)
    FOR v_game_date IN
        SELECT DISTINCT qau.puzzle_date
        FROM public.game_attempts_user g
        JOIN public.questions_allocated_user qau ON qau.id = g.allocated_user_id
        WHERE g.user_id = p_user_id AND g.result = 'won'
          AND qau.puzzle_date >= v_period_start
          AND qau.puzzle_date <= v_effective_date
        ORDER BY qau.puzzle_date
    LOOP
        IF v_prev_date IS NULL OR v_game_date = v_prev_date + 1 THEN
            v_running_streak := v_running_streak + 1;
        ELSE
            v_running_streak := 1;
        END IF;
        IF v_running_streak > v_max_streak THEN
            v_max_streak := v_running_streak;
        END IF;
        v_prev_date := v_game_date;
    END LOOP;

    v_avg_guesses := v_total_guess_value::numeric / v_games_played;
    v_excess_1 := GREATEST(v_guess1_count - v_max_guess1, 0);
    v_excess_2 := GREATEST(v_guess2_count - v_max_guess2, 0);
    v_win_rate := ROUND(v_games_won_count::numeric / v_games_played * 100, 1);

    -- KEY DIFFERENCE: streak from user_stats_user
    SELECT COALESCE(us.current_streak, 0) INTO v_current_streak
    FROM public.user_stats_user us WHERE us.user_id = p_user_id LIMIT 1;

    v_rating := (
        (v_base_guesses - GREATEST(v_avg_guesses, v_min_avg_floor))
        * v_ratio_multiplier
        * (v_games_played::numeric / v_days_in_period)
    ) + (
        v_streak_multiplier * (v_max_streak::numeric / v_days_in_period)
    ) - (
        v_excess_1 * v_penalty_1
    ) - (
        v_excess_2 * v_penalty_2
    );

    IF v_rating < 0 THEN v_rating := 0; END IF;

    RETURN QUERY SELECT
        ROUND(v_rating, 2),
        v_games_played,
        v_games_won_count,
        v_win_rate,
        ROUND(v_avg_guesses, 2),
        v_current_streak,
        v_max_streak;
END;
$fn_rating_user_v2$;


-- ═══════════════════════════════════════════════════════════════════════════
-- 10. FUNCTION: refresh_user_league_standings() v3
--     Now writes max_streak_mtd / max_streak_ytd (never decreasing)
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.refresh_user_league_standings(
    p_user_id   uuid,
    p_region    text DEFAULT 'UK',
    p_game_mode text DEFAULT 'region'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $fn_refresh_v3$
DECLARE
    v_league_id uuid;
    v_mtd record;
    v_ytd record;
BEGIN
    -- Calculate ratings using the appropriate function
    IF p_game_mode = 'user' THEN
        SELECT * INTO v_mtd FROM public.calculate_user_league_rating_user_mode(p_user_id, 'mtd');
        SELECT * INTO v_ytd FROM public.calculate_user_league_rating_user_mode(p_user_id, 'ytd');
    ELSE
        SELECT * INTO v_mtd FROM public.calculate_user_league_rating(p_user_id, p_region, 'mtd');
        SELECT * INTO v_ytd FROM public.calculate_user_league_rating(p_user_id, p_region, 'ytd');
    END IF;

    -- Update standings for every league where user is active for this mode
    FOR v_league_id IN
        SELECT lm.league_id
        FROM public.league_members lm
        JOIN public.leagues lg ON lg.id = lm.league_id
        WHERE lm.user_id = p_user_id
          AND CASE WHEN p_game_mode = 'user' THEN lm.is_active_user ELSE lm.is_active_region END = true
          AND CASE WHEN p_game_mode = 'user' THEN lg.has_user_board ELSE lg.has_region_board END = true
    LOOP
        -- MTD standings
        INSERT INTO public.league_standings_live
            (user_id, league_id, timeframe, game_mode, elementle_rating, current_streak,
             games_played, games_won, win_rate, avg_guesses, max_streak_mtd, updated_at)
        VALUES
            (p_user_id, v_league_id, 'mtd', p_game_mode,
             v_mtd.elementle_rating, v_mtd.current_streak,
             v_mtd.games_played, v_mtd.games_won,
             v_mtd.win_rate, v_mtd.avg_guesses,
             v_mtd.max_streak, now())
        ON CONFLICT (league_id, user_id, timeframe, game_mode)
        DO UPDATE SET
            elementle_rating = EXCLUDED.elementle_rating,
            current_streak   = EXCLUDED.current_streak,
            games_played     = EXCLUDED.games_played,
            games_won        = EXCLUDED.games_won,
            win_rate         = EXCLUDED.win_rate,
            avg_guesses      = EXCLUDED.avg_guesses,
            max_streak_mtd   = GREATEST(EXCLUDED.max_streak_mtd, league_standings_live.max_streak_mtd),
            updated_at       = now();

        -- YTD standings
        INSERT INTO public.league_standings_live
            (user_id, league_id, timeframe, game_mode, elementle_rating, current_streak,
             games_played, games_won, win_rate, avg_guesses, max_streak_ytd, updated_at)
        VALUES
            (p_user_id, v_league_id, 'ytd', p_game_mode,
             v_ytd.elementle_rating, v_ytd.current_streak,
             v_ytd.games_played, v_ytd.games_won,
             v_ytd.win_rate, v_ytd.avg_guesses,
             v_ytd.max_streak, now())
        ON CONFLICT (league_id, user_id, timeframe, game_mode)
        DO UPDATE SET
            elementle_rating = EXCLUDED.elementle_rating,
            current_streak   = EXCLUDED.current_streak,
            games_played     = EXCLUDED.games_played,
            games_won        = EXCLUDED.games_won,
            win_rate         = EXCLUDED.win_rate,
            avg_guesses      = EXCLUDED.avg_guesses,
            max_streak_ytd   = GREATEST(EXCLUDED.max_streak_ytd, league_standings_live.max_streak_ytd),
            updated_at       = now();
    END LOOP;

    -- Save YTD rating back to stats table
    IF p_game_mode = 'region' THEN
        UPDATE public.user_stats_region
        SET score_final_ytd = v_ytd.elementle_rating
        WHERE user_id = p_user_id AND region = p_region;
    END IF;
END;
$fn_refresh_v3$;


-- ═══════════════════════════════════════════════════════════════════════════
-- 11. FUNCTION: process_pending_snapshots()
--     The 30-minute cron: Phase 1 (user stat freeze) + Phase 2 (league rank)
--     + Phase 3 (prune old data)
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.process_pending_snapshots()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $fn_snapshots$
DECLARE
    v_rec           record;
    v_user_tz       text;
    v_local_now     timestamp;
    v_yesterday     date;
    v_result_r_mtd  record;
    v_result_r_ytd  record;
    v_result_u_mtd  record;
    v_result_u_ytd  record;
    v_league        record;
    v_league_tz     text;
    v_league_yesterday date;
    v_users_frozen  int := 0;
    v_leagues_ranked int := 0;
    v_pruned_stats  int := 0;
    v_pruned_ranks  int := 0;
    v_start         timestamptz := clock_timestamp();
BEGIN
    -- ─────────────────────────────────────────────────────────────────────
    -- PHASE 1: Freeze user stats at each user's local midnight
    -- ─────────────────────────────────────────────────────────────────────
    FOR v_rec IN
        SELECT DISTINCT
            lm.user_id,
            COALESCE(up.region, 'UK') AS region
        FROM public.league_members lm
        JOIN public.user_profiles up ON up.id = lm.user_id
        WHERE lm.is_active_region = true OR lm.is_active_user = true
    LOOP
        v_user_tz   := public.region_to_timezone(v_rec.region);
        v_local_now := (now() AT TIME ZONE v_user_tz);
        v_yesterday := v_local_now::date - 1;

        -- Skip if already frozen for yesterday
        IF EXISTS (
            SELECT 1 FROM public.daily_user_stats_snapshot
            WHERE user_id = v_rec.user_id AND snapshot_date = v_yesterday
            LIMIT 1
        ) THEN
            CONTINUE;
        END IF;

        -- Region mode: MTD + YTD with cutoff = yesterday
        SELECT * INTO v_result_r_mtd
        FROM public.calculate_user_league_rating(v_rec.user_id, v_rec.region, 'mtd', v_yesterday);
        SELECT * INTO v_result_r_ytd
        FROM public.calculate_user_league_rating(v_rec.user_id, v_rec.region, 'ytd', v_yesterday);

        INSERT INTO public.daily_user_stats_snapshot
            (user_id, snapshot_date, timeframe, game_mode,
             elementle_rating, games_played, games_won, win_rate,
             avg_guesses, max_streak, current_streak)
        VALUES
            (v_rec.user_id, v_yesterday, 'mtd', 'region',
             v_result_r_mtd.elementle_rating, v_result_r_mtd.games_played,
             v_result_r_mtd.games_won, v_result_r_mtd.win_rate,
             v_result_r_mtd.avg_guesses, v_result_r_mtd.max_streak,
             v_result_r_mtd.current_streak),
            (v_rec.user_id, v_yesterday, 'ytd', 'region',
             v_result_r_ytd.elementle_rating, v_result_r_ytd.games_played,
             v_result_r_ytd.games_won, v_result_r_ytd.win_rate,
             v_result_r_ytd.avg_guesses, v_result_r_ytd.max_streak,
             v_result_r_ytd.current_streak)
        ON CONFLICT (user_id, snapshot_date, timeframe, game_mode) DO NOTHING;

        -- User mode: MTD + YTD with cutoff = yesterday
        SELECT * INTO v_result_u_mtd
        FROM public.calculate_user_league_rating_user_mode(v_rec.user_id, 'mtd', v_yesterday);
        SELECT * INTO v_result_u_ytd
        FROM public.calculate_user_league_rating_user_mode(v_rec.user_id, 'ytd', v_yesterday);

        INSERT INTO public.daily_user_stats_snapshot
            (user_id, snapshot_date, timeframe, game_mode,
             elementle_rating, games_played, games_won, win_rate,
             avg_guesses, max_streak, current_streak)
        VALUES
            (v_rec.user_id, v_yesterday, 'mtd', 'user',
             v_result_u_mtd.elementle_rating, v_result_u_mtd.games_played,
             v_result_u_mtd.games_won, v_result_u_mtd.win_rate,
             v_result_u_mtd.avg_guesses, v_result_u_mtd.max_streak,
             v_result_u_mtd.current_streak),
            (v_rec.user_id, v_yesterday, 'ytd', 'user',
             v_result_u_ytd.elementle_rating, v_result_u_ytd.games_played,
             v_result_u_ytd.games_won, v_result_u_ytd.win_rate,
             v_result_u_ytd.avg_guesses, v_result_u_ytd.max_streak,
             v_result_u_ytd.current_streak)
        ON CONFLICT (user_id, snapshot_date, timeframe, game_mode) DO NOTHING;

        -- Also refresh live standings (for decay in Live view)
        PERFORM public.refresh_user_league_standings(v_rec.user_id, v_rec.region, 'region');
        PERFORM public.refresh_user_league_standings(v_rec.user_id, 'GLOBAL', 'user');

        v_users_frozen := v_users_frozen + 1;
    END LOOP;

    -- ─────────────────────────────────────────────────────────────────────
    -- PHASE 2: Rank leagues at each league's local midnight
    -- ─────────────────────────────────────────────────────────────────────
    FOR v_league IN
        SELECT id, timezone, last_snapshot_date FROM public.leagues
    LOOP
        v_league_tz        := v_league.timezone;
        v_local_now        := (now() AT TIME ZONE v_league_tz);
        v_league_yesterday := v_local_now::date - 1;

        -- Skip if already snapshotted for this league's yesterday
        IF v_league.last_snapshot_date IS NOT NULL
           AND v_league.last_snapshot_date >= v_league_yesterday THEN
            CONTINUE;
        END IF;

        -- Rank active region-mode members for MTD
        INSERT INTO public.daily_league_rank_snapshot
            (league_id, user_id, snapshot_date, timeframe, game_mode, rank)
        SELECT
            v_league.id,
            member_stats.user_id,
            v_league_yesterday,
            member_stats.timeframe,
            member_stats.game_mode,
            ROW_NUMBER() OVER (
                PARTITION BY member_stats.timeframe, member_stats.game_mode
                ORDER BY member_stats.elementle_rating DESC,
                         member_stats.current_streak DESC,
                         member_stats.games_played DESC,
                         member_stats.avg_guesses ASC
            )
        FROM (
            -- Try frozen stats first, fall back to live
            SELECT
                lm.user_id,
                tf.timeframe,
                gm.game_mode,
                COALESCE(ds.elementle_rating, ls.elementle_rating, 0) AS elementle_rating,
                COALESCE(ds.current_streak, ls.current_streak, 0) AS current_streak,
                COALESCE(ds.games_played, ls.games_played, 0) AS games_played,
                COALESCE(ds.avg_guesses, ls.avg_guesses, 0) AS avg_guesses
            FROM public.league_members lm
            CROSS JOIN (VALUES ('mtd'), ('ytd')) AS tf(timeframe)
            CROSS JOIN (VALUES ('region'), ('user')) AS gm(game_mode)
            LEFT JOIN public.daily_user_stats_snapshot ds
                ON ds.user_id = lm.user_id
               AND ds.snapshot_date = v_league_yesterday
               AND ds.timeframe = tf.timeframe
               AND ds.game_mode = gm.game_mode
            LEFT JOIN public.league_standings_live ls
                ON ls.league_id = v_league.id
               AND ls.user_id = lm.user_id
               AND ls.timeframe = tf.timeframe
               AND ls.game_mode = gm.game_mode
            WHERE lm.league_id = v_league.id
              AND CASE WHEN gm.game_mode = 'user'
                       THEN lm.is_active_user
                       ELSE lm.is_active_region END = true
        ) member_stats
        ON CONFLICT (league_id, user_id, snapshot_date, timeframe, game_mode)
        DO UPDATE SET rank = EXCLUDED.rank;

        -- Mark league as snapshotted
        UPDATE public.leagues
        SET last_snapshot_date = v_league_yesterday
        WHERE id = v_league.id;

        v_leagues_ranked := v_leagues_ranked + 1;
    END LOOP;

    -- ─────────────────────────────────────────────────────────────────────
    -- PHASE 3: Prune data older than 7 days
    -- ─────────────────────────────────────────────────────────────────────
    DELETE FROM public.daily_user_stats_snapshot
    WHERE snapshot_date < CURRENT_DATE - 7;
    GET DIAGNOSTICS v_pruned_stats = ROW_COUNT;

    DELETE FROM public.daily_league_rank_snapshot
    WHERE snapshot_date < CURRENT_DATE - 7;
    GET DIAGNOSTICS v_pruned_ranks = ROW_COUNT;

    RETURN jsonb_build_object(
        'users_frozen',    v_users_frozen,
        'leagues_ranked',  v_leagues_ranked,
        'pruned_stats',    v_pruned_stats,
        'pruned_ranks',    v_pruned_ranks,
        'started_at',      v_start,
        'finished_at',     clock_timestamp()
    );
END;
$fn_snapshots$;


-- ═══════════════════════════════════════════════════════════════════════════
-- 12. FUNCTION: get_league_standings() v6
--     Snapshot mode (with prev-day rank join) + Live mode
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
AS $fn_standings_v6$
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

    -- Live standings (same as v5)
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
            'yesterdays_rank', NULL
        ) AS row_data,
        RANK() OVER (
            ORDER BY s.elementle_rating DESC, s.current_streak DESC,
                     s.games_played DESC, s.avg_guesses ASC) AS rn
        FROM public.league_members m
        LEFT JOIN public.league_standings_live s
            ON s.league_id = m.league_id AND s.user_id = m.user_id
           AND s.timeframe = p_timeframe AND s.game_mode = p_game_mode
        LEFT JOIN public.user_profiles up ON up.id = m.user_id
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
$fn_standings_v6$;


-- ═══════════════════════════════════════════════════════════════════════════
-- 13. FUNCTION: get_league_snapshot_range()
--     Returns date range + timezone info for frontend date navigation
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.get_league_snapshot_range(
    p_league_id  uuid,
    p_timeframe  text DEFAULT 'mtd',
    p_game_mode  text DEFAULT 'region'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $fn_range$
DECLARE
    v_user_id       uuid := auth.uid();
    v_oldest        date;
    v_newest        date;
    v_timezone      text;
    v_next_midnight timestamptz;
BEGIN
    IF v_user_id IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;

    SELECT MIN(snapshot_date), MAX(snapshot_date)
    INTO v_oldest, v_newest
    FROM public.daily_league_rank_snapshot
    WHERE league_id = p_league_id
      AND timeframe = p_timeframe
      AND game_mode = p_game_mode;

    SELECT timezone INTO v_timezone FROM public.leagues WHERE id = p_league_id;

    -- Calculate next league midnight in UTC
    -- "Tomorrow midnight" in the league's timezone, converted to UTC
    v_next_midnight := (
        ((now() AT TIME ZONE COALESCE(v_timezone, 'Etc/GMT+12'))::date + 1)::timestamp
        AT TIME ZONE COALESCE(v_timezone, 'Etc/GMT+12')
    );

    RETURN jsonb_build_object(
        'oldest_date',       v_oldest,
        'newest_date',       v_newest,
        'timezone',          COALESCE(v_timezone, 'Etc/GMT+12'),
        'next_snapshot_utc', v_next_midnight
    );
END;
$fn_range$;


-- ═══════════════════════════════════════════════════════════════════════════
-- 14. WIRING: Add recalculate_league_timezone() calls to join/leave RPCs
--     We re-create the functions with the timezone call appended.
-- ═══════════════════════════════════════════════════════════════════════════

-- 14a. join_league — add TZ recalc after member insert
CREATE OR REPLACE FUNCTION public.join_league(p_join_code text, p_display_name text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $rpc_join_v3$
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

    INSERT INTO public.league_members (league_id, user_id, display_name, display_tag)
    VALUES (v_league.id, v_user_id, p_display_name, v_tag);

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
$rpc_join_v3$;

-- 14b. leave_league — add TZ recalc after deactivation
CREATE OR REPLACE FUNCTION public.leave_league(p_league_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $fn_ll_v3$
DECLARE v_user_id uuid := auth.uid();
BEGIN
    IF v_user_id IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
    UPDATE public.league_members
    SET is_active = false, is_active_region = false, is_active_user = false
    WHERE league_id = p_league_id AND user_id = v_user_id;
    PERFORM public.recalculate_league_timezone(p_league_id);
    RETURN jsonb_build_object('success', true);
END;
$fn_ll_v3$;

-- 14c. rejoin_league — add TZ recalc after reactivation
CREATE OR REPLACE FUNCTION public.rejoin_league(p_league_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $fn_rj_v3$
DECLARE v_user_id uuid := auth.uid();
BEGIN
    IF v_user_id IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
    UPDATE public.league_members
    SET is_active = true, is_active_region = true, is_active_user = true
    WHERE league_id = p_league_id AND user_id = v_user_id;
    PERFORM public.hydrate_member_standings(v_user_id, p_league_id);
    PERFORM public.recalculate_league_timezone(p_league_id);
    RETURN jsonb_build_object('success', true);
END;
$fn_rj_v3$;

-- 14d. leave_league_mode — add TZ recalc
CREATE OR REPLACE FUNCTION public.leave_league_mode(p_league_id uuid, p_game_mode text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $fn_llm_v2$
DECLARE v_user_id uuid := auth.uid();
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
    PERFORM public.recalculate_league_timezone(p_league_id);
    RETURN jsonb_build_object('success', true, 'mode', p_game_mode);
END;
$fn_llm_v2$;

-- 14e. rejoin_league_mode — add TZ recalc
CREATE OR REPLACE FUNCTION public.rejoin_league_mode(p_league_id uuid, p_game_mode text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $fn_rlm_v2$
DECLARE v_user_id uuid := auth.uid();
BEGIN
    IF v_user_id IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
    IF p_game_mode = 'user' THEN
        UPDATE public.league_members SET is_active_user = true
        WHERE league_id = p_league_id AND user_id = v_user_id;
    ELSIF p_game_mode = 'region' THEN
        UPDATE public.league_members SET is_active_region = true
        WHERE league_id = p_league_id AND user_id = v_user_id;
    ELSE RAISE EXCEPTION 'Invalid game_mode: must be region or user';
    END IF;
    PERFORM public.hydrate_member_standings(v_user_id, p_league_id);
    PERFORM public.recalculate_league_timezone(p_league_id);
    RETURN jsonb_build_object('success', true, 'mode', p_game_mode);
END;
$fn_rlm_v2$;


-- ═══════════════════════════════════════════════════════════════════════════
-- 15. CRON: Unschedule old decay job, schedule new 30-minute snapshot job
-- ═══════════════════════════════════════════════════════════════════════════

-- Remove old daily job (safe: no error if it doesn't exist)
SELECT cron.unschedule('daily-league-standings-decay');

-- New 30-minute snapshot cron
SELECT cron.schedule(
    'league-snapshot-every-30m',
    '*/30 * * * *',
    $$SELECT public.process_pending_snapshots()$$
);


-- ═══════════════════════════════════════════════════════════════════════════
-- 16. RLS POLICIES for new snapshot tables
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE public.daily_user_stats_snapshot ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_league_rank_snapshot ENABLE ROW LEVEL SECURITY;

-- Service role (cron/RPCs) can do anything
CREATE POLICY "service_role_full_access_user_stats"
    ON public.daily_user_stats_snapshot
    FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "service_role_full_access_league_rank"
    ON public.daily_league_rank_snapshot
    FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Authenticated users can read their own stats
CREATE POLICY "users_read_own_stats"
    ON public.daily_user_stats_snapshot
    FOR SELECT TO authenticated
    USING (user_id = auth.uid());

-- Authenticated users can read league rank snapshots for leagues they belong to
CREATE POLICY "members_read_league_ranks"
    ON public.daily_league_rank_snapshot
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.league_members lm
            WHERE lm.league_id = daily_league_rank_snapshot.league_id
              AND lm.user_id = auth.uid()
        )
    );
