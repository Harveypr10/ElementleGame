-- ============================================================================
-- LEAGUE SYSTEM — Part 2c: refresh_user_league_standings + hydrate_member_standings
-- Run this AFTER Part 2b (rating function)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.refresh_user_league_standings(
    p_user_id uuid,
    p_region text DEFAULT 'UK'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_league_id uuid;
    v_mtd record;
    v_ytd record;
BEGIN
    SELECT * INTO v_mtd FROM public.calculate_user_league_rating(p_user_id, p_region, 'mtd');
    SELECT * INTO v_ytd FROM public.calculate_user_league_rating(p_user_id, p_region, 'ytd');

    FOR v_league_id IN
        SELECT league_id FROM public.league_members WHERE user_id = p_user_id
    LOOP
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

    UPDATE public.user_stats_region
    SET score_final_ytd = v_ytd.elementle_rating
    WHERE user_id = p_user_id AND region = p_region;
END;
$$;


CREATE OR REPLACE FUNCTION public.hydrate_member_standings(
    p_user_id uuid,
    p_league_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_region text;
    v_mtd record;
    v_ytd record;
BEGIN
    SELECT COALESCE(region, 'UK') INTO v_region
    FROM public.user_profiles
    WHERE id = p_user_id;

    SELECT * INTO v_mtd FROM public.calculate_user_league_rating(p_user_id, v_region, 'mtd');
    SELECT * INTO v_ytd FROM public.calculate_user_league_rating(p_user_id, v_region, 'ytd');

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
$$;
