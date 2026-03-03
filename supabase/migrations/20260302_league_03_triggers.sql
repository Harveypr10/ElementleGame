-- ============================================================================
-- LEAGUE SYSTEM — Part 3: Triggers
-- Run this AFTER Part 2c (refresh/hydrate functions)
-- ============================================================================

-- 3a. Auto-refresh league standings when user_stats_region is updated
CREATE OR REPLACE FUNCTION public.trigger_refresh_league_standings()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
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
$$;

CREATE TRIGGER trg_league_standings_refresh
    AFTER UPDATE ON public.user_stats_region
    FOR EACH ROW
    EXECUTE FUNCTION public.trigger_refresh_league_standings();


-- 3b. Auto-join system leagues when a new user profile is created
CREATE OR REPLACE FUNCTION public.trigger_auto_join_system_leagues()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
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
$$;

CREATE TRIGGER trg_auto_join_system_leagues
    AFTER INSERT ON public.user_profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.trigger_auto_join_system_leagues();
