-- ============================================================================
-- FIX: Rating Formula + Max Streak Calculation
--
-- Bug 1: v_days_in_period off-by-one
--   (effective_date - period_start) gives 7 for Mar 8 - Mar 1, should be 8.
--   Fix: add +1 to include both endpoints.
--
-- Bug 2: max_streak uses puzzle_date consecutive-day logic
--   Should use streak_day_status from game_attempts_region/user:
--   - streak_day_status = 1 or 0 → counts toward streak
--   - streak_day_status IS NULL or no row → breaks the streak
--   Streak = longest consecutive run of dates WITH streak_day_status IN (0,1)
--
-- Bug 3: Old function overloads with fewer params still exist in PostgreSQL
--   and get called by triggers instead of the new version.
--   Must DROP old signatures first.
-- ============================================================================


-- ─── 0. Drop old function overloads ────────────────────────────────────────
-- Old region rating: (uuid, text, text) — 3 params, no cutoff_date, different formula
DROP FUNCTION IF EXISTS public.calculate_user_league_rating(uuid, text, text);
-- Old v2 region rating: (uuid, text, text, date) — 4 params but old streak logic
DROP FUNCTION IF EXISTS public.calculate_user_league_rating(uuid, text, text, date);

-- Old user rating: (uuid, text) — 2 params, no cutoff_date, different formula  
DROP FUNCTION IF EXISTS public.calculate_user_league_rating_user_mode(uuid, text);
-- Old v2 user rating: (uuid, text, date) — 3 params but old streak logic
DROP FUNCTION IF EXISTS public.calculate_user_league_rating_user_mode(uuid, text, date);


-- ─── 1. calculate_user_league_rating v3 (region mode) ──────────────────────

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
AS $fn_rating_v3$
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

    -- Period boundaries (FIX: +1 for inclusive day count)
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

    -- ── Max streak using streak_day_status ──────────────────────────────
    -- A streak continues on a date if there's a game_attempts_region row
    -- with streak_day_status IN (0, 1). It breaks if the date has no row
    -- or streak_day_status IS NULL.
    -- We iterate over ALL dates in the period and check each one.
    FOR v_game_date IN
        SELECT d::date
        FROM generate_series(v_period_start, v_effective_date, '1 day'::interval) d
    LOOP
        -- Check if this date has a valid streak entry
        SELECT g.streak_day_status INTO v_streak_status
        FROM public.game_attempts_region g
        JOIN public.questions_allocated_region qar ON qar.id = g.allocated_region_id
        WHERE g.user_id = p_user_id
          AND qar.puzzle_date = v_game_date
          AND g.result IN ('won', 'lost')
        LIMIT 1;

        IF v_streak_status IS NOT NULL THEN
            -- streak_day_status is 0 or 1 → streak continues
            v_running_streak := v_running_streak + 1;
        ELSE
            -- No row or streak_day_status IS NULL → streak breaks
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
$fn_rating_v3$;


-- ─── 2. calculate_user_league_rating_user_mode v3 ──────────────────────────

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
AS $fn_rating_user_v3$
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

    -- Period boundaries (FIX: +1 for inclusive day count)
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

    -- ── Max streak using streak_day_status ──────────────────────────────
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
$fn_rating_user_v3$;
