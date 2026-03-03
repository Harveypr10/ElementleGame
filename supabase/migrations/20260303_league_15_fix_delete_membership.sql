-- ============================================================================
-- Fix delete_league_membership + leave_league_mode for dual-mode boards
--
-- 1. Updated delete_league_membership — checks is_active_region/is_active_user
--    instead of just is_active (which may not be updated by leave_league_mode)
-- 2. Updated leave_league_mode — also sets is_active = false when BOTH boards
--    are now inactive
-- ============================================================================


-- ─── 1. Updated delete_league_membership ────────────────────────────────────

CREATE OR REPLACE FUNCTION public.delete_league_membership(p_league_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $fn_dl_v2$
DECLARE
    v_user_id uuid := auth.uid();
    v_is_system boolean;
    v_is_active boolean;
    v_is_active_region boolean;
    v_is_active_user boolean;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required';
    END IF;

    SELECT lg.is_system_league, lm.is_active, lm.is_active_region, lm.is_active_user
    INTO v_is_system, v_is_active, v_is_active_region, v_is_active_user
    FROM public.league_members lm
    JOIN public.leagues lg ON lg.id = lm.league_id
    WHERE lm.league_id = p_league_id AND lm.user_id = v_user_id;

    IF v_is_system THEN
        RAISE EXCEPTION 'Cannot delete membership in system leagues';
    END IF;

    -- Check all active flags — if ANY mode is still active, block deletion
    IF v_is_active AND v_is_active_region THEN
        RAISE EXCEPTION 'Must leave the region board before deleting membership';
    END IF;
    IF v_is_active AND v_is_active_user THEN
        RAISE EXCEPTION 'Must leave the user board before deleting membership';
    END IF;
    -- Also handle legacy: if is_active is true but both mode flags are false,
    -- allow deletion (user left both modes via leave_league_mode)
    IF v_is_active AND NOT v_is_active_region AND NOT v_is_active_user THEN
        -- This is fine — both mode flags are off, allow deletion
        NULL;
    ELSIF v_is_active THEN
        RAISE EXCEPTION 'Must leave league before deleting membership';
    END IF;

    -- Delete standings
    DELETE FROM public.league_standings_live
    WHERE league_id = p_league_id AND user_id = v_user_id;

    DELETE FROM public.league_standings_snapshot
    WHERE league_id = p_league_id AND user_id = v_user_id;

    -- Delete membership (but do NOT create a ban record — user can rejoin)
    DELETE FROM public.league_members
    WHERE league_id = p_league_id AND user_id = v_user_id;

    RETURN jsonb_build_object('success', true);
END;
$fn_dl_v2$;


-- ─── 2. Updated leave_league_mode — syncs is_active when both off ───────────

CREATE OR REPLACE FUNCTION public.leave_league_mode(
    p_league_id uuid,
    p_game_mode text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $fn_llm_v2$
DECLARE
    v_user_id uuid := auth.uid();
    v_active_region boolean;
    v_active_user boolean;
BEGIN
    IF v_user_id IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
    IF p_game_mode = 'user' THEN
        UPDATE public.league_members SET is_active_user = false
        WHERE league_id = p_league_id AND user_id = v_user_id;
    ELSIF p_game_mode = 'region' THEN
        UPDATE public.league_members SET is_active_region = false
        WHERE league_id = p_league_id AND user_id = v_user_id;
    ELSE
        RAISE EXCEPTION 'Invalid game_mode: must be region or user';
    END IF;

    -- Check if both modes are now inactive → also set is_active = false
    SELECT is_active_region, is_active_user INTO v_active_region, v_active_user
    FROM public.league_members
    WHERE league_id = p_league_id AND user_id = v_user_id;

    IF NOT v_active_region AND NOT v_active_user THEN
        UPDATE public.league_members SET is_active = false
        WHERE league_id = p_league_id AND user_id = v_user_id;
    END IF;

    RETURN jsonb_build_object('success', true, 'mode', p_game_mode);
END;
$fn_llm_v2$;
