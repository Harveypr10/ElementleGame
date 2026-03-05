-- ============================================================================
-- TROPHY UI ENHANCEMENTS
--
-- 1. Update get_my_awards() to include stats from league_standings_snapshot
-- 2. Add 25-character max name validation to create_league()
-- ============================================================================


-- ─── 1. get_my_awards v3 — include stats from snapshot ──────────────────────

CREATE OR REPLACE FUNCTION public.get_my_awards()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $fn_my_awards_v3$
DECLARE
    v_user_id uuid := auth.uid();
    v_medals jsonb;
    v_badges jsonb;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required';
    END IF;

    -- Medals with stats from snapshot
    SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
            'id', la.id,
            'league_id', la.league_id,
            'league_name', lg.name,
            'timeframe', la.timeframe,
            'period_label', la.period_label,
            'medal', la.medal,
            'elementle_rating', ROUND(COALESCE(la.elementle_rating, 0), 1),
            'is_awarded', la.is_awarded,
            'game_mode', la.game_mode,
            'games_played', COALESCE(ss.games_played, 0),
            'games_won', COALESCE(ss.games_won, 0),
            'win_rate', ROUND(COALESCE(ss.win_rate, 0), 1),
            'avg_guesses', ROUND(COALESCE(ss.avg_guesses, 0), 1),
            'awarded_at', la.awarded_at
        ) ORDER BY la.awarded_at DESC
    ), '[]'::jsonb)
    INTO v_medals
    FROM public.league_awards la
    JOIN public.leagues lg ON lg.id = la.league_id
    LEFT JOIN public.league_standings_snapshot ss
        ON ss.league_id = la.league_id
        AND ss.user_id = la.user_id
        AND ss.timeframe = la.timeframe
        AND ss.period_label = la.period_label
        AND ss.game_mode = COALESCE(la.game_mode, 'region')
    WHERE la.user_id = v_user_id;

    -- Global Percentile Badges (unchanged)
    SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
            'timeframe', gpa.timeframe,
            'period_label', gpa.period_label,
            'percentile_rank', gpa.percentile_rank,
            'percentile_tier', gpa.percentile_tier,
            'elementle_rating', ROUND(COALESCE(gpa.elementle_rating, 0), 1),
            'total_ranked', gpa.total_ranked,
            'awarded_at', gpa.awarded_at
        ) ORDER BY gpa.awarded_at DESC
    ), '[]'::jsonb)
    INTO v_badges
    FROM public.global_percentile_awards gpa
    WHERE gpa.user_id = v_user_id;

    RETURN jsonb_build_object(
        'medals', v_medals,
        'percentile_badges', v_badges
    );
END;
$fn_my_awards_v3$;


-- ─── 2. Add 25-char name validation to create_league ────────────────────────

CREATE OR REPLACE FUNCTION public.create_league(
    p_name text DEFAULT 'Elementle League',
    p_has_region_board boolean DEFAULT true,
    p_has_user_board boolean DEFAULT true
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $fn_create_v3$
DECLARE
    v_user_id uuid := auth.uid();
    v_league_id uuid; v_join_code text;
    v_display_name text; v_tag text;
    v_trimmed_name text;
BEGIN
    IF v_user_id IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
    IF NOT p_has_region_board AND NOT p_has_user_board THEN
        RAISE EXCEPTION 'At least one board must be enabled';
    END IF;

    v_trimmed_name := TRIM(p_name);
    IF LENGTH(v_trimmed_name) < 1 THEN
        RAISE EXCEPTION 'League name cannot be empty';
    END IF;
    IF LENGTH(v_trimmed_name) > 25 THEN
        RAISE EXCEPTION 'League name must be 25 characters or fewer';
    END IF;

    v_join_code := public.generate_join_code();

    INSERT INTO public.leagues (name, admin_user_id, join_code, has_region_board, has_user_board)
    VALUES (v_trimmed_name, v_user_id, v_join_code, p_has_region_board, p_has_user_board)
    RETURNING id INTO v_league_id;

    SELECT COALESCE(global_display_name, NULLIF(TRIM(first_name), ''), 'Player')
    INTO v_display_name FROM public.user_profiles WHERE id = v_user_id;

    v_tag := COALESCE(
        (SELECT global_tag FROM public.user_profiles WHERE id = v_user_id),
        public.generate_display_tag(v_display_name)
    );

    INSERT INTO public.league_members (league_id, user_id, display_name, display_tag, can_share,
                                       is_active_region, is_active_user)
    VALUES (v_league_id, v_user_id, v_display_name, v_tag, true,
            p_has_region_board, p_has_user_board);

    PERFORM public.hydrate_member_standings(v_user_id, v_league_id);

    RETURN jsonb_build_object(
        'league_id', v_league_id, 'join_code', v_join_code,
        'display_name', v_display_name, 'global_tag', v_tag
    );
END;
$fn_create_v3$;
