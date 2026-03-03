-- ============================================================================
-- LEAGUE SYSTEM — Part 4a: RPCs (create_league, join_league)
-- Run this AFTER Part 3 (triggers)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.create_league(p_name text DEFAULT 'Elementle League')
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
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
$$;


CREATE OR REPLACE FUNCTION public.join_league(p_join_code text, p_display_name text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
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
$$;
