-- ============================================================================
-- ELEMENTLE LEAGUE SYSTEM — Full Database Migration
-- Created: 2026-03-02
-- 
-- Includes:
--   0. Schema changes (new column on user_stats_region)
--   1. Core tables (leagues, league_members, league_standings_live, snapshot)
--   2. Helper functions (tag generation, join code, dynamic rating calculation)
--   3. Triggers (auto-join system leagues, live standings on stats update)
--   4. RPCs (create, join, view, manage leagues)
--   5. RLS policies
--   6. System league seed data + backfill
-- ============================================================================

-- ─── 0. SCHEMA CHANGES TO EXISTING TABLES ───────────────────────────────────

ALTER TABLE public.user_stats_region
    ADD COLUMN IF NOT EXISTS score_final_ytd numeric;


-- ─── 1. TABLES ──────────────────────────────────────────────────────────────

-- 1a. leagues
CREATE TABLE IF NOT EXISTS public.leagues (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name            text NOT NULL DEFAULT 'Elementle League',
    admin_user_id   uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    share_link_public boolean NOT NULL DEFAULT true,
    join_code       text UNIQUE,
    is_system_league boolean NOT NULL DEFAULT false,
    system_region   text,
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.leagues IS 'Elementle league groups — private user-created and system (Global/Regional)';

-- 1b. league_members
CREATE TABLE IF NOT EXISTS public.league_members (
    id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    league_id       uuid NOT NULL REFERENCES public.leagues(id) ON DELETE CASCADE,
    user_id         uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    display_name    text NOT NULL,
    display_tag     text NOT NULL,
    can_share       boolean NOT NULL DEFAULT false,
    last_seen_rank  integer,
    yesterdays_rank  integer,
    last_viewed_date date,
    joined_at       timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT uq_league_member UNIQUE (league_id, user_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_display_name_tag
    ON public.league_members (display_name, display_tag);

COMMENT ON TABLE public.league_members IS 'Links users to leagues with Discord-style display names and rank tracking';

-- 1c. league_standings_live
CREATE TABLE IF NOT EXISTS public.league_standings_live (
    id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id         uuid NOT NULL,
    league_id       uuid NOT NULL REFERENCES public.leagues(id) ON DELETE CASCADE,
    timeframe       text NOT NULL CHECK (timeframe IN ('mtd', 'ytd')),
    elementle_rating numeric DEFAULT 0,
    current_streak  integer DEFAULT 0,
    games_played    integer DEFAULT 0,
    games_won       integer DEFAULT 0,
    win_rate        numeric DEFAULT 0,
    avg_guesses     numeric DEFAULT 0,
    updated_at      timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT uq_standings_live UNIQUE (league_id, user_id, timeframe)
);

CREATE INDEX IF NOT EXISTS idx_standings_live_league_tf
    ON public.league_standings_live (league_id, timeframe, elementle_rating DESC);

COMMENT ON TABLE public.league_standings_live IS 'Live league standings — updated by trigger on user_stats_region changes';

-- 1d. league_standings_snapshot
CREATE TABLE IF NOT EXISTS public.league_standings_snapshot (
    id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    league_id       uuid NOT NULL REFERENCES public.leagues(id) ON DELETE CASCADE,
    user_id         uuid NOT NULL,
    timeframe       text NOT NULL CHECK (timeframe IN ('mtd', 'ytd')),
    period_label    text NOT NULL,
    elementle_rating numeric DEFAULT 0,
    rank            integer,
    frozen_at       timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT uq_snapshot UNIQUE (league_id, user_id, timeframe, period_label)
);

COMMENT ON TABLE public.league_standings_snapshot IS 'Frozen period-end standings retained until noon UTC on the 1st for cross-timezone parity';


-- ─── 2. HELPER FUNCTIONS ────────────────────────────────────────────────────

-- 2a. Generate a globally unique display tag for a given display_name
CREATE OR REPLACE FUNCTION public.generate_display_tag(p_display_name text)
RETURNS text
LANGUAGE plpgsql
AS $fn_tag$
DECLARE
    v_max_num integer;
    v_new_tag text;
BEGIN
    SELECT COALESCE(
        MAX(CAST(SUBSTRING(display_tag FROM 2) AS integer)),
        0
    )
    INTO v_max_num
    FROM public.league_members
    WHERE LOWER(display_name) = LOWER(p_display_name);

    v_new_tag := '#' || LPAD((v_max_num + 1)::text, 4, '0');
    RETURN v_new_tag;
END;
$fn_tag$;

-- 2b. Generate a random 8-char alphanumeric join code
CREATE OR REPLACE FUNCTION public.generate_join_code()
RETURNS text
LANGUAGE plpgsql
AS $fn_code$
DECLARE
    v_code text;
    v_exists boolean;
    v_chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
BEGIN
    LOOP
        v_code := '';
        FOR i IN 1..8 LOOP
            v_code := v_code || SUBSTR(v_chars, FLOOR(RANDOM() * LENGTH(v_chars) + 1)::int, 1);
        END LOOP;

        SELECT EXISTS(SELECT 1 FROM public.leagues WHERE join_code = v_code)
        INTO v_exists;

        IF NOT v_exists THEN
            RETURN v_code;
        END IF;
    END LOOP;
END;
$fn_code$;


-- 2c. Calculate Elementle Rating for a single user for a given period
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
AS $fn_rating$
DECLARE
    -- Admin thresholds (monthly base values)
    v_min_games          int;
    v_max_guess1         int;
    v_max_guess2         int;
    v_max_guess1_cum     int;
    v_max_guess2_cum     int;

    -- Period boundaries
    v_period_start       date;
    v_days_in_period     int;

    -- Scaling factor for YTD (number of months elapsed)
    v_month_scale        int := 1;

    -- Aggregated game data
    v_games_played       int := 0;
    v_games_won_count    int := 0;
    v_total_guess_value  numeric := 0;
    v_guess1_count       int := 0;
    v_guess2_count       int := 0;

    -- Calculated values
    v_excluded_guess1    int := 0;
    v_excluded_guess2    int := 0;
    v_qualifying_games   int := 0;
    v_avg_guesses        numeric := 0;
    v_term1              numeric := 0;
    v_term2              numeric := 0;
    v_rating             numeric := 0;
    v_win_rate           numeric := 0;
    v_current_streak     int := 0;

    -- Effective thresholds after scaling
    v_eff_max_guess1     int;
    v_eff_max_guess2     int;
BEGIN
    -------------------------------------------------------------------
    -- 1. Load thresholds from admin_settings
    -------------------------------------------------------------------
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

    -------------------------------------------------------------------
    -- 2. Determine period boundaries
    -------------------------------------------------------------------
    IF p_period = 'mtd' THEN
        v_period_start := date_trunc('month', CURRENT_DATE)::date;
        v_days_in_period := EXTRACT(day FROM CURRENT_DATE)::int - 1;
        v_month_scale := 1;
    ELSIF p_period = 'ytd' THEN
        v_period_start := date_trunc('year', CURRENT_DATE)::date;
        v_days_in_period := EXTRACT(doy FROM CURRENT_DATE)::int - 1;
        v_month_scale := GREATEST(EXTRACT(month FROM CURRENT_DATE)::int, 1);
    END IF;

    -- Avoid division by zero on day 1 of period
    IF v_days_in_period < 1 THEN
        v_days_in_period := 1;
    END IF;

    -- Scale thresholds for YTD
    v_eff_max_guess1 := v_max_guess1 * v_month_scale;
    v_eff_max_guess2 := v_max_guess2 * v_month_scale;

    -------------------------------------------------------------------
    -- 3. Aggregate game data from game_attempts_region
    -------------------------------------------------------------------
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

    -- If no games played, return zeros
    IF v_games_played = 0 THEN
        RETURN QUERY SELECT 0::numeric, 0, 0, 0::numeric, 0::numeric, 0;
        RETURN;
    END IF;

    -------------------------------------------------------------------
    -- 4. Calculate exclusions (same logic as calculate_cumulative_percentiles)
    -------------------------------------------------------------------
    IF v_games_played < (v_min_games * v_month_scale) THEN
        -- Cumulative thresholds (scaled for YTD)
        IF v_guess1_count > (v_max_guess1_cum * v_month_scale) THEN
            v_excluded_guess1 := v_guess1_count;
        END IF;
        IF v_guess2_count > (v_max_guess2_cum * v_month_scale) THEN
            v_excluded_guess2 := v_guess2_count;
        END IF;
    ELSE
        -- Standard thresholds (scaled for YTD)
        IF v_guess1_count > v_eff_max_guess1 THEN
            v_excluded_guess1 := v_guess1_count;
        END IF;
        IF v_guess2_count > v_eff_max_guess2 THEN
            v_excluded_guess2 := v_guess2_count;
        END IF;
    END IF;

    -------------------------------------------------------------------
    -- 5. Calculate Elementle Rating
    -------------------------------------------------------------------
    v_qualifying_games := v_games_played - v_excluded_guess1 - v_excluded_guess2;

    IF v_qualifying_games > 0 THEN
        v_avg_guesses := v_total_guess_value / v_qualifying_games;
        v_term1 := 6 - v_avg_guesses;
        v_term2 := 3 * (v_qualifying_games::numeric / v_days_in_period);
        v_rating := v_term1 * v_term2;
    END IF;

    -- Win rate
    v_win_rate := ROUND(v_games_won_count::numeric / v_games_played * 100, 1);

    -------------------------------------------------------------------
    -- 6. Get current streak from user_stats_region
    -------------------------------------------------------------------
    SELECT COALESCE(us.current_streak, 0)
    INTO v_current_streak
    FROM public.user_stats_region us
    WHERE us.user_id = p_user_id AND us.region = p_region
    LIMIT 1;

    -------------------------------------------------------------------
    -- 7. Return the computed values
    -------------------------------------------------------------------
    RETURN QUERY SELECT
        ROUND(v_rating, 2),
        v_games_played,
        v_games_won_count,
        v_win_rate,
        ROUND(v_avg_guesses, 2),
        v_current_streak;
END;
$fn_rating$;


-- 2d. Refresh standings for a single user across all their leagues
CREATE OR REPLACE FUNCTION public.refresh_user_league_standings(
    p_user_id uuid,
    p_region text DEFAULT 'UK'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $fn_refresh$
DECLARE
    v_league_id uuid;
    v_mtd record;
    v_ytd record;
BEGIN
    -- Calculate MTD and YTD ratings dynamically
    SELECT * INTO v_mtd FROM public.calculate_user_league_rating(p_user_id, p_region, 'mtd');
    SELECT * INTO v_ytd FROM public.calculate_user_league_rating(p_user_id, p_region, 'ytd');

    -- Update standings for every league the user belongs to
    FOR v_league_id IN
        SELECT league_id FROM public.league_members WHERE user_id = p_user_id
    LOOP
        -- MTD standings
        INSERT INTO public.league_standings_live
            (user_id, league_id, timeframe, elementle_rating, current_streak,
             games_played, games_won, win_rate, avg_guesses, updated_at)
        VALUES
            (p_user_id, v_league_id, 'mtd',
             v_mtd.elementle_rating, v_mtd.current_streak,
             v_mtd.games_played, v_mtd.games_won,
             v_mtd.win_rate, v_mtd.avg_guesses, now())
        ON CONFLICT (league_id, user_id, timeframe)
        DO UPDATE SET
            elementle_rating = EXCLUDED.elementle_rating,
            current_streak   = EXCLUDED.current_streak,
            games_played     = EXCLUDED.games_played,
            games_won        = EXCLUDED.games_won,
            win_rate         = EXCLUDED.win_rate,
            avg_guesses      = EXCLUDED.avg_guesses,
            updated_at       = now();

        -- YTD standings
        INSERT INTO public.league_standings_live
            (user_id, league_id, timeframe, elementle_rating, current_streak,
             games_played, games_won, win_rate, avg_guesses, updated_at)
        VALUES
            (p_user_id, v_league_id, 'ytd',
             v_ytd.elementle_rating, v_ytd.current_streak,
             v_ytd.games_played, v_ytd.games_won,
             v_ytd.win_rate, v_ytd.avg_guesses, now())
        ON CONFLICT (league_id, user_id, timeframe)
        DO UPDATE SET
            elementle_rating = EXCLUDED.elementle_rating,
            current_streak   = EXCLUDED.current_streak,
            games_played     = EXCLUDED.games_played,
            games_won        = EXCLUDED.games_won,
            win_rate         = EXCLUDED.win_rate,
            avg_guesses      = EXCLUDED.avg_guesses,
            updated_at       = now();
    END LOOP;

    -- Save YTD rating back to user_stats_region for record-keeping
    UPDATE public.user_stats_region
    SET score_final_ytd = v_ytd.elementle_rating
    WHERE user_id = p_user_id AND region = p_region;
END;
$fn_refresh$;


-- 2e. Hydrate initial standings for a user when they first join a league
CREATE OR REPLACE FUNCTION public.hydrate_member_standings(
    p_user_id uuid,
    p_league_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $fn_hydrate$
DECLARE
    v_region text;
    v_mtd record;
    v_ytd record;
BEGIN
    -- Get user's region
    SELECT COALESCE(region, 'UK') INTO v_region
    FROM public.user_profiles
    WHERE id = p_user_id;

    -- Calculate live MTD and YTD ratings
    SELECT * INTO v_mtd FROM public.calculate_user_league_rating(p_user_id, v_region, 'mtd');
    SELECT * INTO v_ytd FROM public.calculate_user_league_rating(p_user_id, v_region, 'ytd');

    -- Insert MTD + YTD standings
    INSERT INTO public.league_standings_live
        (user_id, league_id, timeframe, elementle_rating, current_streak,
         games_played, games_won, win_rate, avg_guesses)
    VALUES
        (p_user_id, p_league_id, 'mtd',
         v_mtd.elementle_rating, v_mtd.current_streak,
         v_mtd.games_played, v_mtd.games_won,
         v_mtd.win_rate, v_mtd.avg_guesses),
        (p_user_id, p_league_id, 'ytd',
         v_ytd.elementle_rating, v_ytd.current_streak,
         v_ytd.games_played, v_ytd.games_won,
         v_ytd.win_rate, v_ytd.avg_guesses)
    ON CONFLICT (league_id, user_id, timeframe) DO NOTHING;
END;
$fn_hydrate$;


-- ─── 3. TRIGGERS ────────────────────────────────────────────────────────────

-- 3a. Auto-refresh league standings when user_stats_region is updated
CREATE OR REPLACE FUNCTION public.trigger_refresh_league_standings()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $trg_refresh$
BEGIN
    IF NEW.score_final_all_users IS DISTINCT FROM OLD.score_final_all_users
       OR NEW.current_streak IS DISTINCT FROM OLD.current_streak
       OR NEW.games_played IS DISTINCT FROM OLD.games_played
       OR NEW.games_won IS DISTINCT FROM OLD.games_won
       OR NEW.avg_guesses_after_exclusions IS DISTINCT FROM OLD.avg_guesses_after_exclusions
       OR NEW.games_played_month IS DISTINCT FROM OLD.games_played_month
    THEN
        PERFORM public.refresh_user_league_standings(NEW.user_id, NEW.region);
    END IF;
    RETURN NEW;
END;
$trg_refresh$;

CREATE TRIGGER trg_league_standings_refresh
    AFTER UPDATE ON public.user_stats_region
    FOR EACH ROW
    EXECUTE FUNCTION public.trigger_refresh_league_standings();

-- 3b. Auto-join system leagues when a new user profile is created
CREATE OR REPLACE FUNCTION public.trigger_auto_join_system_leagues()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $trg_autojoin$
DECLARE
    v_league record;
    v_display_name text;
    v_tag text;
BEGIN
    v_display_name := COALESCE(NULLIF(TRIM(NEW.first_name), ''), 'Player');

    FOR v_league IN
        SELECT id FROM public.leagues
        WHERE is_system_league = true
          AND (system_region = 'GLOBAL' OR system_region = COALESCE(NEW.region, 'UK'))
    LOOP
        v_tag := public.generate_display_tag(v_display_name);

        INSERT INTO public.league_members (league_id, user_id, display_name, display_tag)
        VALUES (v_league.id, NEW.id, v_display_name, v_tag)
        ON CONFLICT (league_id, user_id) DO NOTHING;

        PERFORM public.hydrate_member_standings(NEW.id, v_league.id);
    END LOOP;

    RETURN NEW;
END;
$trg_autojoin$;

CREATE TRIGGER trg_auto_join_system_leagues
    AFTER INSERT ON public.user_profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.trigger_auto_join_system_leagues();


-- ─── 4. RPCs ────────────────────────────────────────────────────────────────

-- 4a. Create a new private league
CREATE OR REPLACE FUNCTION public.create_league(p_name text DEFAULT 'Elementle League')
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $rpc_create$
DECLARE
    v_user_id uuid := auth.uid();
    v_league_id uuid;
    v_join_code text;
    v_display_name text;
    v_tag text;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required';
    END IF;

    v_join_code := public.generate_join_code();

    INSERT INTO public.leagues (name, admin_user_id, join_code)
    VALUES (p_name, v_user_id, v_join_code)
    RETURNING id INTO v_league_id;

    SELECT COALESCE(NULLIF(TRIM(first_name), ''), 'Player')
    INTO v_display_name
    FROM public.user_profiles
    WHERE id = v_user_id;

    v_tag := public.generate_display_tag(v_display_name);

    INSERT INTO public.league_members (league_id, user_id, display_name, display_tag, can_share)
    VALUES (v_league_id, v_user_id, v_display_name, v_tag, true);

    PERFORM public.hydrate_member_standings(v_user_id, v_league_id);

    RETURN jsonb_build_object(
        'league_id', v_league_id,
        'join_code', v_join_code,
        'display_name', v_display_name,
        'display_tag', v_tag
    );
END;
$rpc_create$;

-- 4b. Join a league via join code
CREATE OR REPLACE FUNCTION public.join_league(p_join_code text, p_display_name text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $rpc_join$
DECLARE
    v_user_id uuid := auth.uid();
    v_league record;
    v_tag text;
    v_rank integer;
    v_total integer;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required';
    END IF;

    SELECT id, name, is_system_league
    INTO v_league
    FROM public.leagues
    WHERE join_code = UPPER(p_join_code);

    IF v_league IS NULL THEN
        RAISE EXCEPTION 'Invalid join code';
    END IF;

    IF EXISTS(
        SELECT 1 FROM public.league_members
        WHERE league_id = v_league.id AND user_id = v_user_id
    ) THEN
        RAISE EXCEPTION 'Already a member of this league';
    END IF;

    v_tag := public.generate_display_tag(p_display_name);

    INSERT INTO public.league_members (league_id, user_id, display_name, display_tag)
    VALUES (v_league.id, v_user_id, p_display_name, v_tag);

    PERFORM public.hydrate_member_standings(v_user_id, v_league.id);

    SELECT COUNT(*) + 1 INTO v_rank
    FROM public.league_standings_live s
    WHERE s.league_id = v_league.id
      AND s.timeframe = 'mtd'
      AND s.user_id != v_user_id
      AND s.elementle_rating > (
          SELECT COALESCE(elementle_rating, 0)
          FROM public.league_standings_live
          WHERE league_id = v_league.id AND user_id = v_user_id AND timeframe = 'mtd'
      );

    SELECT COUNT(*) INTO v_total
    FROM public.league_members
    WHERE league_id = v_league.id;

    RETURN jsonb_build_object(
        'league_id', v_league.id,
        'league_name', v_league.name,
        'display_name', p_display_name,
        'display_tag', v_tag,
        'rank', v_rank,
        'total_members', v_total
    );
END;
$rpc_join$;

-- 4c. Get league standings with full ranking
CREATE OR REPLACE FUNCTION public.get_league_standings(
    p_league_id uuid,
    p_timeframe text DEFAULT 'mtd'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $rpc_standings$
DECLARE
    v_user_id uuid := auth.uid();
    v_standings jsonb;
    v_my_rank integer;
    v_total integer;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required';
    END IF;

    IF NOT EXISTS(
        SELECT 1 FROM public.league_members
        WHERE league_id = p_league_id AND user_id = v_user_id
    ) THEN
        RAISE EXCEPTION 'Not a member of this league';
    END IF;

    SELECT jsonb_agg(row_data ORDER BY rn) INTO v_standings
    FROM (
        SELECT
            jsonb_build_object(
                'rank', ROW_NUMBER() OVER (
                    ORDER BY s.elementle_rating DESC,
                             s.current_streak DESC,
                             s.games_played DESC,
                             s.avg_guesses ASC
                ),
                'user_id', m.user_id,
                'display_name', m.display_name,
                'display_tag', m.display_tag,
                'elementle_rating', ROUND(COALESCE(s.elementle_rating, 0), 1),
                'current_streak', COALESCE(s.current_streak, 0),
                'games_played', COALESCE(s.games_played, 0),
                'games_won', COALESCE(s.games_won, 0),
                'win_rate', ROUND(COALESCE(s.win_rate, 0), 1),
                'avg_guesses', ROUND(COALESCE(s.avg_guesses, 0), 1),
                'is_me', (m.user_id = v_user_id),
                'yesterdays_rank', m.yesterdays_rank
            ) AS row_data,
            ROW_NUMBER() OVER (
                ORDER BY s.elementle_rating DESC,
                         s.current_streak DESC,
                         s.games_played DESC,
                         s.avg_guesses ASC
            ) AS rn,
            m.user_id AS uid
        FROM public.league_members m
        LEFT JOIN public.league_standings_live s
            ON s.league_id = m.league_id
           AND s.user_id = m.user_id
           AND s.timeframe = p_timeframe
        WHERE m.league_id = p_league_id
    ) ranked;

    SELECT (row_data->>'rank')::integer INTO v_my_rank
    FROM (
        SELECT jsonb_array_elements(v_standings) AS row_data
    ) t
    WHERE row_data->>'user_id' = v_user_id::text;

    SELECT COUNT(*) INTO v_total
    FROM public.league_members
    WHERE league_id = p_league_id;

    RETURN jsonb_build_object(
        'standings', COALESCE(v_standings, '[]'::jsonb),
        'my_rank', v_my_rank,
        'total_members', v_total
    );
END;
$rpc_standings$;

-- 4d. Record a league view — implements "Yesterday's Baseline" logic
CREATE OR REPLACE FUNCTION public.record_league_view(
    p_league_id uuid,
    p_current_rank integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $rpc_view$
DECLARE
    v_user_id uuid := auth.uid();
    v_member record;
    v_rank_change integer;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required';
    END IF;

    SELECT last_seen_rank, yesterdays_rank, last_viewed_date
    INTO v_member
    FROM public.league_members
    WHERE league_id = p_league_id AND user_id = v_user_id;

    IF v_member IS NULL THEN
        RAISE EXCEPTION 'Not a member of this league';
    END IF;

    IF v_member.last_viewed_date IS NULL OR v_member.last_viewed_date < CURRENT_DATE THEN
        UPDATE public.league_members
        SET yesterdays_rank  = last_seen_rank,
            last_seen_rank   = p_current_rank,
            last_viewed_date = CURRENT_DATE
        WHERE league_id = p_league_id AND user_id = v_user_id;

        IF v_member.last_seen_rank IS NOT NULL THEN
            v_rank_change := v_member.last_seen_rank - p_current_rank;
        END IF;
    ELSE
        UPDATE public.league_members
        SET last_seen_rank = p_current_rank
        WHERE league_id = p_league_id AND user_id = v_user_id;

        IF v_member.yesterdays_rank IS NOT NULL THEN
            v_rank_change := v_member.yesterdays_rank - p_current_rank;
        END IF;
    END IF;

    RETURN jsonb_build_object(
        'yesterdays_rank', COALESCE(
            CASE WHEN v_member.last_viewed_date IS NULL OR v_member.last_viewed_date < CURRENT_DATE
                 THEN v_member.last_seen_rank
                 ELSE v_member.yesterdays_rank
            END,
            NULL
        ),
        'current_rank', p_current_rank,
        'rank_change', v_rank_change
    );
END;
$rpc_view$;

-- 4e. Update display name
CREATE OR REPLACE FUNCTION public.update_display_name(
    p_league_id uuid,
    p_display_name text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $rpc_name$
DECLARE
    v_user_id uuid := auth.uid();
    v_tag text;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required';
    END IF;

    IF NOT EXISTS(
        SELECT 1 FROM public.league_members
        WHERE league_id = p_league_id AND user_id = v_user_id
    ) THEN
        RAISE EXCEPTION 'Not a member of this league';
    END IF;

    v_tag := public.generate_display_tag(p_display_name);

    UPDATE public.league_members
    SET display_name = p_display_name, display_tag = v_tag
    WHERE league_id = p_league_id AND user_id = v_user_id;

    RETURN jsonb_build_object(
        'display_name', p_display_name,
        'display_tag', v_tag
    );
END;
$rpc_name$;

-- 4f. Update league settings (admin only)
CREATE OR REPLACE FUNCTION public.update_league_settings(
    p_league_id uuid,
    p_share_link_public boolean
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $rpc_settings$
DECLARE
    v_user_id uuid := auth.uid();
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required';
    END IF;

    IF NOT EXISTS(
        SELECT 1 FROM public.leagues
        WHERE id = p_league_id AND admin_user_id = v_user_id
    ) THEN
        RAISE EXCEPTION 'Only league admin can update settings';
    END IF;

    UPDATE public.leagues
    SET share_link_public = p_share_link_public, updated_at = now()
    WHERE id = p_league_id;
END;
$rpc_settings$;

-- 4g. Toggle member share permission (admin only)
CREATE OR REPLACE FUNCTION public.toggle_member_share(
    p_league_id uuid,
    p_target_user_id uuid,
    p_can_share boolean
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $rpc_share$
DECLARE
    v_user_id uuid := auth.uid();
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required';
    END IF;

    IF NOT EXISTS(
        SELECT 1 FROM public.leagues
        WHERE id = p_league_id AND admin_user_id = v_user_id
    ) THEN
        RAISE EXCEPTION 'Only league admin can change permissions';
    END IF;

    UPDATE public.league_members
    SET can_share = p_can_share
    WHERE league_id = p_league_id AND user_id = p_target_user_id;
END;
$rpc_share$;

-- 4h. Snapshot period standings (closing window)
CREATE OR REPLACE FUNCTION public.snapshot_period_standings(
    p_timeframe text,
    p_period_label text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $rpc_snapshot$
BEGIN
    INSERT INTO public.league_standings_snapshot
        (league_id, user_id, timeframe, period_label, elementle_rating, rank, frozen_at)
    SELECT
        s.league_id,
        s.user_id,
        p_timeframe,
        p_period_label,
        s.elementle_rating,
        ROW_NUMBER() OVER (
            PARTITION BY s.league_id
            ORDER BY s.elementle_rating DESC,
                     s.current_streak DESC,
                     s.games_played DESC,
                     s.avg_guesses ASC
        ),
        now()
    FROM public.league_standings_live s
    WHERE s.timeframe = p_timeframe
    ON CONFLICT (league_id, user_id, timeframe, period_label)
    DO UPDATE SET
        elementle_rating = EXCLUDED.elementle_rating,
        rank = EXCLUDED.rank,
        frozen_at = EXCLUDED.frozen_at;
END;
$rpc_snapshot$;


-- ─── 5. ROW LEVEL SECURITY ─────────────────────────────────────────────────

ALTER TABLE public.leagues ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.league_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.league_standings_live ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.league_standings_snapshot ENABLE ROW LEVEL SECURITY;

CREATE POLICY "League members can view their leagues"
    ON public.leagues FOR SELECT
    USING (
        id IN (SELECT league_id FROM public.league_members WHERE user_id = auth.uid())
    );

CREATE POLICY "Authenticated users can create leagues"
    ON public.leagues FOR INSERT
    WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Admin can update league"
    ON public.leagues FOR UPDATE
    USING (admin_user_id = auth.uid());

CREATE POLICY "Admin can delete league"
    ON public.leagues FOR DELETE
    USING (admin_user_id = auth.uid());

CREATE POLICY "League members can view other members"
    ON public.league_members FOR SELECT
    USING (
        league_id IN (SELECT league_id FROM public.league_members WHERE user_id = auth.uid())
    );

CREATE POLICY "Members join via RPC"
    ON public.league_members FOR INSERT
    WITH CHECK (false);

CREATE POLICY "Members can leave or admin can remove"
    ON public.league_members FOR DELETE
    USING (
        user_id = auth.uid()
        OR league_id IN (SELECT id FROM public.leagues WHERE admin_user_id = auth.uid())
    );

CREATE POLICY "Members can update own row"
    ON public.league_members FOR UPDATE
    USING (user_id = auth.uid());

CREATE POLICY "League members can view standings"
    ON public.league_standings_live FOR SELECT
    USING (
        league_id IN (SELECT league_id FROM public.league_members WHERE user_id = auth.uid())
    );

CREATE POLICY "Standings updated via trigger only"
    ON public.league_standings_live FOR INSERT
    WITH CHECK (false);

CREATE POLICY "Standings updated via trigger update"
    ON public.league_standings_live FOR UPDATE
    USING (false);

CREATE POLICY "League members can view snapshots"
    ON public.league_standings_snapshot FOR SELECT
    USING (
        league_id IN (SELECT league_id FROM public.league_members WHERE user_id = auth.uid())
    );


-- ─── 6. SYSTEM LEAGUE SEED DATA ────────────────────────────────────────────

INSERT INTO public.leagues (name, is_system_league, system_region, admin_user_id, join_code)
VALUES ('Global League', true, 'GLOBAL', NULL, NULL)
ON CONFLICT DO NOTHING;

INSERT INTO public.leagues (name, is_system_league, system_region, admin_user_id, join_code)
VALUES ('UK League', true, 'UK', NULL, NULL)
ON CONFLICT DO NOTHING;


-- ─── 7. BACKFILL: Enrol existing users into system leagues ──────────────────

DO $backfill$
DECLARE
    v_user record;
    v_league record;
    v_display_name text;
    v_tag text;
BEGIN
    FOR v_user IN
        SELECT id, first_name, region FROM public.user_profiles
    LOOP
        v_display_name := COALESCE(NULLIF(TRIM(v_user.first_name), ''), 'Player');

        FOR v_league IN
            SELECT id, system_region FROM public.leagues
            WHERE is_system_league = true
              AND (system_region = 'GLOBAL' OR system_region = COALESCE(v_user.region, 'UK'))
        LOOP
            v_tag := public.generate_display_tag(v_display_name);

            INSERT INTO public.league_members (league_id, user_id, display_name, display_tag)
            VALUES (v_league.id, v_user.id, v_display_name, v_tag)
            ON CONFLICT (league_id, user_id) DO NOTHING;

            PERFORM public.hydrate_member_standings(v_user.id, v_league.id);
        END LOOP;
    END LOOP;
END;
$backfill$;
