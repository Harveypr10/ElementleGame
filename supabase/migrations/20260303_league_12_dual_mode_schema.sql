-- ============================================================================
-- PHASE 3.5 PART 1: Schema Alterations + Rating/Trigger Functions
-- Run BEFORE Part 2 (RPCs).
-- ============================================================================


-- ─── 1. ALTER leagues ───────────────────────────────────────────────────────
ALTER TABLE public.leagues
    ADD COLUMN IF NOT EXISTS has_region_board boolean NOT NULL DEFAULT true,
    ADD COLUMN IF NOT EXISTS has_user_board boolean NOT NULL DEFAULT true;


-- ─── 2. ALTER league_members ────────────────────────────────────────────────
ALTER TABLE public.league_members
    ADD COLUMN IF NOT EXISTS is_active_region boolean NOT NULL DEFAULT true,
    ADD COLUMN IF NOT EXISTS is_active_user boolean NOT NULL DEFAULT true;

-- Migrate: copy existing is_active into both new columns
UPDATE public.league_members
SET is_active_region = COALESCE(is_active, true),
    is_active_user   = COALESCE(is_active, true);


-- ─── 3. ALTER league_standings_live ─────────────────────────────────────────
ALTER TABLE public.league_standings_live
    ADD COLUMN IF NOT EXISTS game_mode text NOT NULL DEFAULT 'region';

ALTER TABLE public.league_standings_live
    DROP CONSTRAINT IF EXISTS league_standings_live_game_mode_check;
ALTER TABLE public.league_standings_live
    ADD CONSTRAINT league_standings_live_game_mode_check CHECK (game_mode IN ('region', 'user'));

ALTER TABLE public.league_standings_live
    DROP CONSTRAINT IF EXISTS uq_standings_live;
ALTER TABLE public.league_standings_live
    ADD CONSTRAINT uq_standings_live UNIQUE (league_id, user_id, timeframe, game_mode);


-- ─── 4. ALTER league_standings_snapshot ──────────────────────────────────────
ALTER TABLE public.league_standings_snapshot
    ADD COLUMN IF NOT EXISTS game_mode text NOT NULL DEFAULT 'region';

ALTER TABLE public.league_standings_snapshot
    DROP CONSTRAINT IF EXISTS league_standings_snapshot_game_mode_check;
ALTER TABLE public.league_standings_snapshot
    ADD CONSTRAINT league_standings_snapshot_game_mode_check CHECK (game_mode IN ('region', 'user'));

ALTER TABLE public.league_standings_snapshot
    DROP CONSTRAINT IF EXISTS uq_snapshot;
ALTER TABLE public.league_standings_snapshot
    ADD CONSTRAINT uq_snapshot UNIQUE (league_id, user_id, timeframe, period_label, game_mode);


-- ─── 5. ALTER league_awards ─────────────────────────────────────────────────
ALTER TABLE public.league_awards
    ADD COLUMN IF NOT EXISTS game_mode text NOT NULL DEFAULT 'region';

ALTER TABLE public.league_awards
    DROP CONSTRAINT IF EXISTS uq_league_award;
ALTER TABLE public.league_awards
    ADD CONSTRAINT uq_league_award UNIQUE (league_id, user_id, timeframe, period_label, game_mode);


-- ─── 6. ALTER global_percentile_awards ──────────────────────────────────────
ALTER TABLE public.global_percentile_awards
    ADD COLUMN IF NOT EXISTS game_mode text NOT NULL DEFAULT 'region';

ALTER TABLE public.global_percentile_awards
    DROP CONSTRAINT IF EXISTS uq_global_percentile;
ALTER TABLE public.global_percentile_awards
    ADD CONSTRAINT uq_global_percentile UNIQUE (user_id, timeframe, period_label, game_mode);


-- ─── 7. User Mode Rating Function ──────────────────────────────────────────
-- Identical to calculate_user_league_rating but reads from
-- game_attempts_user / questions_allocated_user / user_stats_user.

CREATE OR REPLACE FUNCTION public.calculate_user_league_rating_user_mode(
    p_user_id uuid,
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
AS $fn_rating_user$
DECLARE
    v_min_games int; v_max_guess1 int; v_max_guess2 int;
    v_max_guess1_cum int; v_max_guess2_cum int;
    v_period_start date; v_days_in_period int; v_month_scale int := 1;
    v_games_played int := 0; v_games_won_count int := 0;
    v_total_guess_value numeric := 0; v_guess1_count int := 0; v_guess2_count int := 0;
    v_excluded_guess1 int := 0; v_excluded_guess2 int := 0;
    v_qualifying_games int := 0; v_avg_guesses numeric := 0;
    v_term1 numeric := 0; v_term2 numeric := 0;
    v_rating numeric := 0; v_win_rate numeric := 0; v_current_streak int := 0;
    v_eff_max_guess1 int; v_eff_max_guess2 int;
BEGIN
    SELECT COALESCE((SELECT value::int FROM admin_settings WHERE key = 'min_games_for_percentile'), 10) INTO v_min_games;
    SELECT COALESCE((SELECT value::int FROM admin_settings WHERE key = 'max_guess1_per_month'), 3) INTO v_max_guess1;
    SELECT COALESCE((SELECT value::int FROM admin_settings WHERE key = 'max_guess2_per_month'), 5) INTO v_max_guess2;
    SELECT COALESCE((SELECT value::int FROM admin_settings WHERE key = 'max_guess1_per_month_cumulative'), 2) INTO v_max_guess1_cum;
    SELECT COALESCE((SELECT value::int FROM admin_settings WHERE key = 'max_guess2_per_month_cumulative'), 3) INTO v_max_guess2_cum;

    IF p_period = 'mtd' THEN
        v_period_start := date_trunc('month', CURRENT_DATE)::date;
        v_days_in_period := EXTRACT(day FROM CURRENT_DATE)::int - 1;
        v_month_scale := 1;
    ELSIF p_period = 'ytd' THEN
        v_period_start := date_trunc('year', CURRENT_DATE)::date;
        v_days_in_period := EXTRACT(doy FROM CURRENT_DATE)::int - 1;
        v_month_scale := GREATEST(EXTRACT(month FROM CURRENT_DATE)::int, 1);
    END IF;
    IF v_days_in_period < 1 THEN v_days_in_period := 1; END IF;

    v_eff_max_guess1 := v_max_guess1 * v_month_scale;
    v_eff_max_guess2 := v_max_guess2 * v_month_scale;

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
      AND qau.puzzle_date < CASE
          WHEN p_period = 'mtd' THEN (v_period_start + INTERVAL '1 month')::date
          ELSE (v_period_start + INTERVAL '1 year')::date
      END;

    IF v_games_played = 0 THEN
        RETURN QUERY SELECT 0::numeric, 0, 0, 0::numeric, 0::numeric, 0;
        RETURN;
    END IF;

    -- Exclusion logic (identical)
    IF v_games_played < (v_min_games * v_month_scale) THEN
        IF v_guess1_count > (v_max_guess1_cum * v_month_scale) THEN v_excluded_guess1 := v_guess1_count; END IF;
        IF v_guess2_count > (v_max_guess2_cum * v_month_scale) THEN v_excluded_guess2 := v_guess2_count; END IF;
    ELSE
        IF v_guess1_count > v_eff_max_guess1 THEN v_excluded_guess1 := v_guess1_count; END IF;
        IF v_guess2_count > v_eff_max_guess2 THEN v_excluded_guess2 := v_guess2_count; END IF;
    END IF;

    v_qualifying_games := v_games_played - v_excluded_guess1 - v_excluded_guess2;
    IF v_qualifying_games > 0 THEN
        v_avg_guesses := v_total_guess_value / v_qualifying_games;
        v_term1 := 6 - v_avg_guesses;
        v_term2 := 3 * (v_qualifying_games::numeric / v_days_in_period);
        v_rating := v_term1 * v_term2;
    END IF;
    v_win_rate := ROUND(v_games_won_count::numeric / v_games_played * 100, 1);

    -- KEY DIFFERENCE: streak from user_stats_user
    SELECT COALESCE(us.current_streak, 0) INTO v_current_streak
    FROM public.user_stats_user us WHERE us.user_id = p_user_id LIMIT 1;

    RETURN QUERY SELECT ROUND(v_rating, 2), v_games_played, v_games_won_count,
                        v_win_rate, ROUND(v_avg_guesses, 2), v_current_streak;
END;
$fn_rating_user$;


-- ─── 8. Updated refresh_user_league_standings ───────────────────────────────
-- Now accepts p_game_mode and calls the appropriate rating function.

CREATE OR REPLACE FUNCTION public.refresh_user_league_standings(
    p_user_id uuid,
    p_region text DEFAULT 'UK',
    p_game_mode text DEFAULT 'region'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $fn_refresh_v2$
DECLARE
    v_league_id uuid;
    v_mtd record;
    v_ytd record;
    v_active_col text;
BEGIN
    -- Calculate ratings using the appropriate function
    IF p_game_mode = 'user' THEN
        SELECT * INTO v_mtd FROM public.calculate_user_league_rating_user_mode(p_user_id, 'mtd');
        SELECT * INTO v_ytd FROM public.calculate_user_league_rating_user_mode(p_user_id, 'ytd');
        v_active_col := 'is_active_user';
    ELSE
        SELECT * INTO v_mtd FROM public.calculate_user_league_rating(p_user_id, p_region, 'mtd');
        SELECT * INTO v_ytd FROM public.calculate_user_league_rating(p_user_id, p_region, 'ytd');
        v_active_col := 'is_active_region';
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
        INSERT INTO public.league_standings_live
            (user_id, league_id, timeframe, game_mode, elementle_rating, current_streak,
             games_played, games_won, win_rate, avg_guesses, updated_at)
        VALUES
            (p_user_id, v_league_id, 'mtd', p_game_mode,
             v_mtd.elementle_rating, v_mtd.current_streak,
             v_mtd.games_played, v_mtd.games_won,
             v_mtd.win_rate, v_mtd.avg_guesses, now())
        ON CONFLICT (league_id, user_id, timeframe, game_mode)
        DO UPDATE SET
            elementle_rating = EXCLUDED.elementle_rating,
            current_streak   = EXCLUDED.current_streak,
            games_played     = EXCLUDED.games_played,
            games_won        = EXCLUDED.games_won,
            win_rate         = EXCLUDED.win_rate,
            avg_guesses      = EXCLUDED.avg_guesses,
            updated_at       = now();

        INSERT INTO public.league_standings_live
            (user_id, league_id, timeframe, game_mode, elementle_rating, current_streak,
             games_played, games_won, win_rate, avg_guesses, updated_at)
        VALUES
            (p_user_id, v_league_id, 'ytd', p_game_mode,
             v_ytd.elementle_rating, v_ytd.current_streak,
             v_ytd.games_played, v_ytd.games_won,
             v_ytd.win_rate, v_ytd.avg_guesses, now())
        ON CONFLICT (league_id, user_id, timeframe, game_mode)
        DO UPDATE SET
            elementle_rating = EXCLUDED.elementle_rating,
            current_streak   = EXCLUDED.current_streak,
            games_played     = EXCLUDED.games_played,
            games_won        = EXCLUDED.games_won,
            win_rate         = EXCLUDED.win_rate,
            avg_guesses      = EXCLUDED.avg_guesses,
            updated_at       = now();
    END LOOP;

    -- Save YTD rating back to stats table
    IF p_game_mode = 'region' THEN
        UPDATE public.user_stats_region
        SET score_final_ytd = v_ytd.elementle_rating
        WHERE user_id = p_user_id AND region = p_region;
    END IF;
END;
$fn_refresh_v2$;


-- ─── 9. Updated trigger for user_stats_region ───────────────────────────────
-- Now explicitly passes game_mode = 'region'

CREATE OR REPLACE FUNCTION public.trigger_refresh_league_standings()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $trg_refresh_region$
BEGIN
    IF NEW.score_final_all_users IS DISTINCT FROM OLD.score_final_all_users
       OR NEW.current_streak IS DISTINCT FROM OLD.current_streak
       OR NEW.games_played IS DISTINCT FROM OLD.games_played
       OR NEW.games_won IS DISTINCT FROM OLD.games_won
       OR NEW.avg_guesses_after_exclusions IS DISTINCT FROM OLD.avg_guesses_after_exclusions
       OR NEW.games_played_month IS DISTINCT FROM OLD.games_played_month
    THEN
        PERFORM public.refresh_user_league_standings(NEW.user_id, NEW.region, 'region');
    END IF;
    RETURN NEW;
END;
$trg_refresh_region$;


-- ─── 10. NEW trigger for user_stats_user ────────────────────────────────────

CREATE OR REPLACE FUNCTION public.trigger_refresh_league_standings_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $trg_refresh_user$
BEGIN
    IF NEW.score_final_all_users IS DISTINCT FROM OLD.score_final_all_users
       OR NEW.current_streak IS DISTINCT FROM OLD.current_streak
       OR NEW.games_played IS DISTINCT FROM OLD.games_played
       OR NEW.games_won IS DISTINCT FROM OLD.games_won
       OR NEW.avg_guesses_after_exclusions IS DISTINCT FROM OLD.avg_guesses_after_exclusions
       OR NEW.games_played_month IS DISTINCT FROM OLD.games_played_month
    THEN
        PERFORM public.refresh_user_league_standings(NEW.user_id, 'GLOBAL', 'user');
    END IF;
    RETURN NEW;
END;
$trg_refresh_user$;

-- Create trigger (safe: DROP IF EXISTS first)
DROP TRIGGER IF EXISTS trg_league_standings_refresh_user ON public.user_stats_user;
CREATE TRIGGER trg_league_standings_refresh_user
    AFTER UPDATE ON public.user_stats_user
    FOR EACH ROW
    EXECUTE FUNCTION public.trigger_refresh_league_standings_user();


-- ─── 11. Updated hydrate_member_standings ───────────────────────────────────
-- Now hydrates BOTH region and user boards if enabled.

CREATE OR REPLACE FUNCTION public.hydrate_member_standings(
    p_user_id uuid,
    p_league_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $fn_hydrate_v2$
DECLARE
    v_region text;
    v_mtd_r record; v_ytd_r record;
    v_mtd_u record; v_ytd_u record;
    v_has_region boolean; v_has_user boolean;
BEGIN
    SELECT COALESCE(region, 'UK') INTO v_region FROM public.user_profiles WHERE id = p_user_id;
    SELECT has_region_board, has_user_board INTO v_has_region, v_has_user
    FROM public.leagues WHERE id = p_league_id;

    -- Region board
    IF COALESCE(v_has_region, true) THEN
        SELECT * INTO v_mtd_r FROM public.calculate_user_league_rating(p_user_id, v_region, 'mtd');
        SELECT * INTO v_ytd_r FROM public.calculate_user_league_rating(p_user_id, v_region, 'ytd');
        INSERT INTO public.league_standings_live
            (user_id, league_id, timeframe, game_mode, elementle_rating, current_streak,
             games_played, games_won, win_rate, avg_guesses)
        VALUES
            (p_user_id, p_league_id, 'mtd', 'region',
             v_mtd_r.elementle_rating, v_mtd_r.current_streak,
             v_mtd_r.games_played, v_mtd_r.games_won,
             v_mtd_r.win_rate, v_mtd_r.avg_guesses),
            (p_user_id, p_league_id, 'ytd', 'region',
             v_ytd_r.elementle_rating, v_ytd_r.current_streak,
             v_ytd_r.games_played, v_ytd_r.games_won,
             v_ytd_r.win_rate, v_ytd_r.avg_guesses)
        ON CONFLICT (league_id, user_id, timeframe, game_mode) DO NOTHING;
    END IF;

    -- User board
    IF COALESCE(v_has_user, true) THEN
        SELECT * INTO v_mtd_u FROM public.calculate_user_league_rating_user_mode(p_user_id, 'mtd');
        SELECT * INTO v_ytd_u FROM public.calculate_user_league_rating_user_mode(p_user_id, 'ytd');
        INSERT INTO public.league_standings_live
            (user_id, league_id, timeframe, game_mode, elementle_rating, current_streak,
             games_played, games_won, win_rate, avg_guesses)
        VALUES
            (p_user_id, p_league_id, 'mtd', 'user',
             v_mtd_u.elementle_rating, v_mtd_u.current_streak,
             v_mtd_u.games_played, v_mtd_u.games_won,
             v_mtd_u.win_rate, v_mtd_u.avg_guesses),
            (p_user_id, p_league_id, 'ytd', 'user',
             v_ytd_u.elementle_rating, v_ytd_u.current_streak,
             v_ytd_u.games_played, v_ytd_u.games_won,
             v_ytd_u.win_rate, v_ytd_u.avg_guesses)
        ON CONFLICT (league_id, user_id, timeframe, game_mode) DO NOTHING;
    END IF;
END;
$fn_hydrate_v2$;
