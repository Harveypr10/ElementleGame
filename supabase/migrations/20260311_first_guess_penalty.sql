-- ============================================================================
-- FIRST-GUESS PENALTY TIE-BREAKER
-- Migration: 20260311_first_guess_penalty.sql
--
-- Adds a fractional penalty based on the accuracy of the user's first guess.
-- Formula: MIN(ABS(actual_year - first_guess_year), 1000) / 100000.0
--   Perfect first guess (0 years off) → 0.00000
--   500 years off → 0.00500
--   1,000+ years off → 0.01000 (capped)
--
-- Sections:
--   1. Schema: Add first_guess_penalty column to both attempt tables
--   2. Backfill: Region mode
--   3. Backfill: User mode
--   4. Rating function v4: Region mode (subtract penalty from rating)
--   5. Rating function v4: User mode  (subtract penalty from rating)
-- ============================================================================


-- ═══════════════════════════════════════════════════════════════════════════
-- 1. SCHEMA: Add first_guess_penalty column
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE public.game_attempts_region
    ADD COLUMN IF NOT EXISTS first_guess_penalty numeric(6,5) NOT NULL DEFAULT 0;

ALTER TABLE public.game_attempts_user
    ADD COLUMN IF NOT EXISTS first_guess_penalty numeric(6,5) NOT NULL DEFAULT 0;


-- ═══════════════════════════════════════════════════════════════════════════
-- 2. BACKFILL: Region mode
--    Joins: game_attempts_region → questions_allocated_region → questions_master_region
--    First guess: lowest id in guesses_region per game_attempt_id
-- ═══════════════════════════════════════════════════════════════════════════

WITH first_guess AS (
    SELECT DISTINCT ON (gr.game_attempt_id)
        gr.game_attempt_id,
        gr.guess_value
    FROM public.guesses_region gr
    ORDER BY gr.game_attempt_id, gr.id ASC
)
UPDATE public.game_attempts_region gar
SET first_guess_penalty = LEAST(
    ABS(
        EXTRACT(YEAR FROM qmr.answer_date_canonical::date)
        - EXTRACT(YEAR FROM fg.guess_value::date)
    ),
    1000
) / 100000.0
FROM first_guess fg,
     public.questions_allocated_region qar,
     public.questions_master_region qmr
WHERE fg.game_attempt_id = gar.id
  AND qar.id = gar.allocated_region_id
  AND qmr.id = qar.question_id
  AND gar.result IN ('won', 'lost');


-- ═══════════════════════════════════════════════════════════════════════════
-- 3. BACKFILL: User mode
--    Same logic against user-mode tables
-- ═══════════════════════════════════════════════════════════════════════════

WITH first_guess AS (
    SELECT DISTINCT ON (gu.game_attempt_id)
        gu.game_attempt_id,
        gu.guess_value
    FROM public.guesses_user gu
    ORDER BY gu.game_attempt_id, gu.id ASC
)
UPDATE public.game_attempts_user gau
SET first_guess_penalty = LEAST(
    ABS(
        EXTRACT(YEAR FROM qmu.answer_date_canonical::date)
        - EXTRACT(YEAR FROM fg.guess_value::date)
    ),
    1000
) / 100000.0
FROM first_guess fg,
     public.questions_allocated_user qau,
     public.questions_master_user qmu
WHERE fg.game_attempt_id = gau.id
  AND qau.id = gau.allocated_user_id
  AND qmu.id = qau.question_id
  AND gau.result IN ('won', 'lost');


-- ═══════════════════════════════════════════════════════════════════════════
-- 4. RATING FUNCTION v4: Region mode
--    Adds SUM(first_guess_penalty) to aggregation and subtracts from rating
-- ═══════════════════════════════════════════════════════════════════════════

-- Drop old overloads first to avoid ambiguity
DROP FUNCTION IF EXISTS public.calculate_user_league_rating(uuid, text, text);
DROP FUNCTION IF EXISTS public.calculate_user_league_rating(uuid, text, text, date);

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
AS $fn_rating_v4$
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
    v_total_first_guess_penalty numeric := 0;

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
    v_streak_status      int;
BEGIN
    -- Load rating params from admin_settings
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

    -- Period boundaries (+1 for inclusive day count)
    IF p_period = 'mtd' THEN
        v_period_start := date_trunc('month', v_effective_date)::date;
        v_days_in_period := (v_effective_date - v_period_start)::int + 1;
        v_month_scale := 1;
    ELSIF p_period = 'ytd' THEN
        v_period_start := date_trunc('year', v_effective_date)::date;
        v_days_in_period := (v_effective_date - v_period_start)::int + 1;
        v_month_scale := GREATEST(EXTRACT(month FROM v_effective_date)::int, 1);
    END IF;
    IF v_days_in_period < 1 THEN v_days_in_period := 1; END IF;

    -- Scale thresholds for YTD
    v_max_guess1 := v_max_guess1 * v_month_scale;
    v_max_guess2 := v_max_guess2 * v_month_scale;

    -- Aggregate game data from game_attempts_region
    -- NEW: also aggregate first_guess_penalty
    SELECT
        COUNT(DISTINCT g.allocated_region_id),
        COUNT(DISTINCT g.allocated_region_id) FILTER (WHERE g.result = 'won'),
        COALESCE(SUM(CASE WHEN g.result = 'lost' THEN 6 ELSE g.num_guesses END), 0),
        COALESCE(SUM(CASE WHEN g.result = 'won' AND g.num_guesses = 1 THEN 1 ELSE 0 END), 0),
        COALESCE(SUM(CASE WHEN g.result = 'won' AND g.num_guesses = 2 THEN 1 ELSE 0 END), 0),
        COALESCE(SUM(g.first_guess_penalty), 0)
    INTO v_games_played, v_games_won_count, v_total_guess_value,
         v_guess1_count, v_guess2_count, v_total_first_guess_penalty
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

    -- Max streak using streak_day_status
    FOR v_game_date IN
        SELECT d::date
        FROM generate_series(v_period_start, v_effective_date, '1 day'::interval) d
    LOOP
        SELECT g.streak_day_status INTO v_streak_status
        FROM public.game_attempts_region g
        JOIN public.questions_allocated_region qar ON qar.id = g.allocated_region_id
        WHERE g.user_id = p_user_id
          AND qar.puzzle_date = v_game_date
          AND g.result IN ('won', 'lost')
        LIMIT 1;

        IF v_streak_status IS NOT NULL THEN
            v_running_streak := v_running_streak + 1;
        ELSE
            v_running_streak := 0;
        END IF;

        IF v_running_streak > v_max_streak THEN
            v_max_streak := v_running_streak;
        END IF;
    END LOOP;

    -- Average guesses
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

    -- THE FORMULA (v4: now subtracts first_guess_penalty):
    -- ((base - GREATEST(avg, floor)) * multiplier * (played / days))
    -- + (streak_mult * (max_streak / days))
    -- - (excess_1 * penalty_1) - (excess_2 * penalty_2)
    -- - SUM(first_guess_penalty)
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
    ) - (
        v_total_first_guess_penalty
    );

    -- Floor at zero
    IF v_rating < 0 THEN v_rating := 0; END IF;

    RETURN QUERY SELECT
        ROUND(v_rating, 5),
        v_games_played,
        v_games_won_count,
        v_win_rate,
        ROUND(v_avg_guesses, 2),
        v_current_streak,
        v_max_streak;
END;
$fn_rating_v4$;


-- ═══════════════════════════════════════════════════════════════════════════
-- 5. RATING FUNCTION v4: User mode
--    Identical formula, reads from game_attempts_user tables
-- ═══════════════════════════════════════════════════════════════════════════

-- Drop old overloads
DROP FUNCTION IF EXISTS public.calculate_user_league_rating_user_mode(uuid, text);
DROP FUNCTION IF EXISTS public.calculate_user_league_rating_user_mode(uuid, text, date);

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
AS $fn_rating_user_v4$
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
    v_total_first_guess_penalty numeric := 0;

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
    v_streak_status      int;
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

    -- Period boundaries (+1 for inclusive day count)
    IF p_period = 'mtd' THEN
        v_period_start := date_trunc('month', v_effective_date)::date;
        v_days_in_period := (v_effective_date - v_period_start)::int + 1;
        v_month_scale := 1;
    ELSIF p_period = 'ytd' THEN
        v_period_start := date_trunc('year', v_effective_date)::date;
        v_days_in_period := (v_effective_date - v_period_start)::int + 1;
        v_month_scale := GREATEST(EXTRACT(month FROM v_effective_date)::int, 1);
    END IF;
    IF v_days_in_period < 1 THEN v_days_in_period := 1; END IF;

    v_max_guess1 := v_max_guess1 * v_month_scale;
    v_max_guess2 := v_max_guess2 * v_month_scale;

    -- Aggregate game data from game_attempts_user
    -- NEW: also aggregate first_guess_penalty
    SELECT
        COUNT(DISTINCT g.allocated_user_id),
        COUNT(DISTINCT g.allocated_user_id) FILTER (WHERE g.result = 'won'),
        COALESCE(SUM(CASE WHEN g.result = 'lost' THEN 6 ELSE g.num_guesses END), 0),
        COALESCE(SUM(CASE WHEN g.result = 'won' AND g.num_guesses = 1 THEN 1 ELSE 0 END), 0),
        COALESCE(SUM(CASE WHEN g.result = 'won' AND g.num_guesses = 2 THEN 1 ELSE 0 END), 0),
        COALESCE(SUM(g.first_guess_penalty), 0)
    INTO v_games_played, v_games_won_count, v_total_guess_value,
         v_guess1_count, v_guess2_count, v_total_first_guess_penalty
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

    -- Max streak using streak_day_status
    FOR v_game_date IN
        SELECT d::date
        FROM generate_series(v_period_start, v_effective_date, '1 day'::interval) d
    LOOP
        SELECT g.streak_day_status INTO v_streak_status
        FROM public.game_attempts_user g
        JOIN public.questions_allocated_user qau ON qau.id = g.allocated_user_id
        WHERE g.user_id = p_user_id
          AND qau.puzzle_date = v_game_date
          AND g.result IN ('won', 'lost')
        LIMIT 1;

        IF v_streak_status IS NOT NULL THEN
            v_running_streak := v_running_streak + 1;
        ELSE
            v_running_streak := 0;
        END IF;

        IF v_running_streak > v_max_streak THEN
            v_max_streak := v_running_streak;
        END IF;
    END LOOP;

    v_avg_guesses := v_total_guess_value::numeric / v_games_played;
    v_excess_1 := GREATEST(v_guess1_count - v_max_guess1, 0);
    v_excess_2 := GREATEST(v_guess2_count - v_max_guess2, 0);
    v_win_rate := ROUND(v_games_won_count::numeric / v_games_played * 100, 1);

    -- Current streak from user_stats_user
    SELECT COALESCE(us.current_streak, 0) INTO v_current_streak
    FROM public.user_stats_user us WHERE us.user_id = p_user_id LIMIT 1;

    -- THE FORMULA (v4: now subtracts first_guess_penalty):
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
    ) - (
        v_total_first_guess_penalty
    );

    IF v_rating < 0 THEN v_rating := 0; END IF;

    RETURN QUERY SELECT
        ROUND(v_rating, 5),
        v_games_played,
        v_games_won_count,
        v_win_rate,
        ROUND(v_avg_guesses, 2),
        v_current_streak,
        v_max_streak;
END;
$fn_rating_user_v4$;
