-- ============================================================================
-- LEAGUE SYSTEM — Part 6: System League Seed Data + Backfill
-- Run this AFTER Part 5 (RLS)
-- ============================================================================

-- Seed system leagues
INSERT INTO public.leagues (name, is_system_league, system_region, admin_user_id, join_code)
VALUES ('Global League', true, 'GLOBAL', NULL, NULL)
ON CONFLICT DO NOTHING;

INSERT INTO public.leagues (name, is_system_league, system_region, admin_user_id, join_code)
VALUES ('UK League', true, 'UK', NULL, NULL)
ON CONFLICT DO NOTHING;


-- Backfill: Enrol existing users into system leagues
DO $$
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
$$;
