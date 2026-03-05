-- ============================================================================
-- Trophy Celebration: Add is_awarded flag to league_awards
--
-- Enables the same "pending award" popup pattern used by user_badges:
--   1. Awards are inserted with is_awarded = false (by grant_period_awards)
--   2. Home screen app detects is_awarded = false → shows celebration popup
--   3. After display, app sets is_awarded = true
--
-- Also updates get_my_awards() to return id + is_awarded for the frontend.
-- ============================================================================


-- ─── 1. Add is_awarded column ───────────────────────────────────────────────

ALTER TABLE public.league_awards
    ADD COLUMN IF NOT EXISTS is_awarded boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.league_awards.is_awarded
    IS 'false = pending celebration popup; true = user has seen the award';


-- ─── 2. Update get_my_awards to include id + is_awarded ─────────────────────

CREATE OR REPLACE FUNCTION public.get_my_awards()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $fn_my_awards_v2$
DECLARE
    v_user_id uuid := auth.uid();
    v_medals jsonb;
    v_badges jsonb;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required';
    END IF;

    -- Medals (now includes id + is_awarded)
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
            'awarded_at', la.awarded_at
        ) ORDER BY la.awarded_at DESC
    ), '[]'::jsonb)
    INTO v_medals
    FROM public.league_awards la
    JOIN public.leagues lg ON lg.id = la.league_id
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
$fn_my_awards_v2$;


-- ─── 3. Mark existing test awards as is_awarded = false for testing ──────────
-- (Only affects rows that currently exist — new rows will default to false)

UPDATE public.league_awards SET is_awarded = false WHERE is_awarded IS NULL;
