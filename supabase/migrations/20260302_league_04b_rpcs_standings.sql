-- ============================================================================
-- LEAGUE SYSTEM — Part 4b: RPCs (get_league_standings, record_league_view)
-- Run this AFTER Part 4a
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_league_standings(
    p_league_id uuid,
    p_timeframe text DEFAULT 'mtd'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
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
$$;


CREATE OR REPLACE FUNCTION public.record_league_view(
    p_league_id uuid,
    p_current_rank integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
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
$$;
