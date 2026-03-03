-- ============================================================================
-- LEAGUE SYSTEM — Part 2b: calculate_user_league_rating
-- Run this AFTER Part 2a (helpers)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.calculate_user_league_rating(
    p_user_id uuid,
    p_region text,
    p_period text
)
RETURNS TABLE (
    elementle_rating numeric,
    games_played     integer,
    games_won        integer,
    win_rate         numeric,
    avg_guesses      numeric,
    current_streak   integer
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_min_games          int;
    v_max_guess1         int;
    v_max_guess2         int;
    v_max_guess1_cum     int;
    v_max_guess2_cum     int;

    v_period_start       date;
    v_days_in_period     int;
    v_month_scale        int := 1;

    v_games_played       int := 0;
    v_games_won_count    int := 0;
    v_total_guess_value  numeric := 0;
    v_guess1_count       int := 0;
    v_guess2_count       int := 0;

    v_excluded_guess1    int := 0;
    v_excluded_guess2    int := 0;
    v_qualifying_games   int := 0;
    v_avg_guesses        numeric := 0;
    v_term1              numeric := 0;
    v_term2              numeric := 0;
    v_rating             numeric := 0;
    v_win_rate           numeric := 0;
    v_current_streak     int := 0;

    v_eff_max_guess1     int;
    v_eff_max_guess2     int;
BEGIN
    -- 1. Load thresholds from admin_settings
    SELECT COALESCE((SELECT value::int FROM admin_settings WHERE key = 'min_games_for_percentile'), 10)
        INTO v_min_games;
    SELECT COALESCE((SELECT value::int FROM admin_settings WHERE key = 'max_guess1_per_month'), 3)
        INTO v_max_guess1;
    SELECT COALESCE((SELECT value::int FROM admin_settings WHERE key = 'max_guess2_per_month'), 5)
        INTO v_max_guess2;
    SELECT COALESCE((SELECT value::int FROM admin_settings WHERE key = 'max_guess1_per_month_cumulative'), 2)
        INTO v_max_guess1_cum;
    SELECT COALESCE((SELECT value::int FROM admin_settings WHERE key = 'max_guess2_per_month_cumulative'), 3)
        INTO v_max_guess2_cum;

    -- 2. Determine period boundaries
    IF p_period = 'mtd' THEN
        v_period_start := date_trunc('month', CURRENT_DATE)::date;
        v_days_in_period := EXTRACT(day FROM CURRENT_DATE)::int - 1;
        v_month_scale := 1;
    ELSIF p_period = 'ytd' THEN
        v_period_start := date_trunc('year', CURRENT_DATE)::date;
        v_days_in_period := EXTRACT(doy FROM CURRENT_DATE)::int - 1;
        v_month_scale := GREATEST(EXTRACT(month FROM CURRENT_DATE)::int, 1);
    END IF;

    IF v_days_in_period < 1 THEN
        v_days_in_period := 1;
    END IF;

    v_eff_max_guess1 := v_max_guess1 * v_month_scale;
    v_eff_max_guess2 := v_max_guess2 * v_month_scale;

    -- 3. Aggregate game data from game_attempts_region
    SELECT
        COUNT(DISTINCT g.allocated_region_id),
        COUNT(DISTINCT g.allocated_region_id) FILTER (WHERE g.result = 'won'),
        COALESCE(SUM(CASE WHEN g.result = 'lost' THEN 6 ELSE g.num_guesses END), 0),
        COALESCE(SUM(CASE WHEN g.result = 'won' AND g.num_guesses = 1 THEN 1 ELSE 0 END), 0),
        COALESCE(SUM(CASE WHEN g.result = 'won' AND g.num_guesses = 2 THEN 1 ELSE 0 END), 0)
    INTO
        v_games_played,
        v_games_won_count,
        v_total_guess_value,
        v_guess1_count,
        v_guess2_count
    FROM public.game_attempts_region g
    JOIN public.questions_allocated_region qar ON qar.id = g.allocated_region_id
    WHERE g.user_id = p_user_id
      AND g.result IN ('won', 'lost')
      AND qar.puzzle_date >= v_period_start
      AND qar.puzzle_date < CASE
          WHEN p_period = 'mtd' THEN (v_period_start + INTERVAL '1 month')::date
          ELSE (v_period_start + INTERVAL '1 year')::date
      END;

    IF v_games_played = 0 THEN
        RETURN QUERY SELECT 0::numeric, 0, 0, 0::numeric, 0::numeric, 0;
        RETURN;
    END IF;

    -- 4. Calculate exclusions
    IF v_games_played < (v_min_games * v_month_scale) THEN
        IF v_guess1_count > (v_max_guess1_cum * v_month_scale) THEN
            v_excluded_guess1 := v_guess1_count;
        END IF;
        IF v_guess2_count > (v_max_guess2_cum * v_month_scale) THEN
            v_excluded_guess2 := v_guess2_count;
        END IF;
    ELSE
        IF v_guess1_count > v_eff_max_guess1 THEN
            v_excluded_guess1 := v_guess1_count;
        END IF;
        IF v_guess2_count > v_eff_max_guess2 THEN
            v_excluded_guess2 := v_guess2_count;
        END IF;
    END IF;

    -- 5. Calculate Elementle Rating
    v_qualifying_games := v_games_played - v_excluded_guess1 - v_excluded_guess2;

    IF v_qualifying_games > 0 THEN
        v_avg_guesses := v_total_guess_value / v_qualifying_games;
        v_term1 := 6 - v_avg_guesses;
        v_term2 := 3 * (v_qualifying_games::numeric / v_days_in_period);
        v_rating := v_term1 * v_term2;
    END IF;

    v_win_rate := ROUND(v_games_won_count::numeric / v_games_played * 100, 1);

    -- 6. Get current streak
    SELECT COALESCE(us.current_streak, 0)
    INTO v_current_streak
    FROM public.user_stats_region us
    WHERE us.user_id = p_user_id AND us.region = p_region
    LIMIT 1;

    -- 7. Return
    RETURN QUERY SELECT
        ROUND(v_rating, 2),
        v_games_played,
        v_games_won_count,
        v_win_rate,
        ROUND(v_avg_guesses, 2),
        v_current_streak;
END;
$$;
