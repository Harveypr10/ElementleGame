-- ============================================================================
-- LEAGUE SYSTEM — Part 4c: RPCs (update_display_name, update_league_settings,
--                                 toggle_member_share, snapshot_period_standings)
-- Run this AFTER Part 4b
-- ============================================================================

CREATE OR REPLACE FUNCTION public.update_display_name(
    p_league_id uuid,
    p_display_name text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
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
$$;


CREATE OR REPLACE FUNCTION public.update_league_settings(
    p_league_id uuid,
    p_share_link_public boolean
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
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
$$;


CREATE OR REPLACE FUNCTION public.toggle_member_share(
    p_league_id uuid,
    p_target_user_id uuid,
    p_can_share boolean
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
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
$$;


CREATE OR REPLACE FUNCTION public.snapshot_period_standings(
    p_timeframe text,
    p_period_label text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
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
$$;
