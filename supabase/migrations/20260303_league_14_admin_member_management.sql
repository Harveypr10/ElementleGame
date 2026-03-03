-- ============================================================================
-- LEAGUE SYSTEM — Admin Member Management RPCs
--
-- 1. admin_remove_member   — soft-remove (deactivate, no ban, keep standings)
-- 2. admin_rejoin_member   — reactivate a removed member
-- 3. admin_unblock_member  — delete ban record from league_bans
-- 4. Updated get_league_members — returns ALL members with is_banned flag
--
-- Run in Supabase SQL Editor.
-- ============================================================================


-- ─── 1. admin_remove_member ─────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.admin_remove_member(
    p_league_id uuid,
    p_target_user_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $fn_admin_rm$
DECLARE
    v_user_id uuid := auth.uid();
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required';
    END IF;

    -- Verify caller is admin
    IF NOT EXISTS (
        SELECT 1 FROM public.leagues
        WHERE id = p_league_id AND admin_user_id = v_user_id
    ) THEN
        RAISE EXCEPTION 'Only the league admin can remove members';
    END IF;

    -- Cannot remove yourself
    IF p_target_user_id = v_user_id THEN
        RAISE EXCEPTION 'Cannot remove yourself from the league';
    END IF;

    -- Soft-remove: deactivate all board flags (same as leave_league but for target)
    UPDATE public.league_members
    SET is_active = false,
        is_active_region = false,
        is_active_user = false
    WHERE league_id = p_league_id AND user_id = p_target_user_id;

    RETURN jsonb_build_object('success', true);
END;
$fn_admin_rm$;


-- ─── 2. admin_rejoin_member ─────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.admin_rejoin_member(
    p_league_id uuid,
    p_target_user_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $fn_admin_rj$
DECLARE
    v_user_id uuid := auth.uid();
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required';
    END IF;

    -- Verify caller is admin
    IF NOT EXISTS (
        SELECT 1 FROM public.leagues
        WHERE id = p_league_id AND admin_user_id = v_user_id
    ) THEN
        RAISE EXCEPTION 'Only the league admin can rejoin members';
    END IF;

    -- Check member is not banned
    IF EXISTS (
        SELECT 1 FROM public.league_bans
        WHERE league_id = p_league_id AND user_id = p_target_user_id
    ) THEN
        RAISE EXCEPTION 'Cannot rejoin a banned member. Unblock them first.';
    END IF;

    -- Reactivate membership
    UPDATE public.league_members
    SET is_active = true,
        is_active_region = true,
        is_active_user = true
    WHERE league_id = p_league_id AND user_id = p_target_user_id;

    -- Re-hydrate standings
    PERFORM public.hydrate_member_standings(p_target_user_id, p_league_id);

    RETURN jsonb_build_object('success', true);
END;
$fn_admin_rj$;


-- ─── 3. admin_unblock_member ────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.admin_unblock_member(
    p_league_id uuid,
    p_target_user_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $fn_admin_ub$
DECLARE
    v_user_id uuid := auth.uid();
    v_deleted integer;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required';
    END IF;

    -- Verify caller is admin
    IF NOT EXISTS (
        SELECT 1 FROM public.leagues
        WHERE id = p_league_id AND admin_user_id = v_user_id
    ) THEN
        RAISE EXCEPTION 'Only the league admin can unblock members';
    END IF;

    -- Delete the ban record
    DELETE FROM public.league_bans
    WHERE league_id = p_league_id AND user_id = p_target_user_id;

    GET DIAGNOSTICS v_deleted = ROW_COUNT;

    IF v_deleted = 0 THEN
        RAISE EXCEPTION 'Member is not currently blocked';
    END IF;

    RETURN jsonb_build_object('success', true);
END;
$fn_admin_ub$;


-- ─── 4. Updated get_league_members — returns ALL members with is_banned ─────

CREATE OR REPLACE FUNCTION public.get_league_members(p_league_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $fn_get_members_v2$
DECLARE
    v_user_id uuid := auth.uid();
    v_is_admin boolean;
    v_result jsonb;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required';
    END IF;

    -- Check if user is admin of this league
    SELECT (l.admin_user_id = v_user_id)
    INTO v_is_admin
    FROM public.leagues l
    WHERE l.id = p_league_id;

    IF NOT v_is_admin THEN
        RAISE EXCEPTION 'Only the league admin can view members';
    END IF;

    SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
            'user_id', lm.user_id,
            'league_nickname', lm.league_nickname,
            'global_display_name', COALESCE(up.global_display_name, up.first_name, 'Player'),
            'global_tag', COALESCE(up.global_tag, '#0000'),
            'can_share', lm.can_share,
            'is_active', lm.is_active,
            'is_admin', (lm.user_id = (SELECT admin_user_id FROM public.leagues WHERE id = p_league_id)),
            'is_banned', EXISTS (
                SELECT 1 FROM public.league_bans lb
                WHERE lb.league_id = p_league_id AND lb.user_id = lm.user_id
            ),
            'joined_at', lm.joined_at
        ) ORDER BY lm.is_active DESC, lm.joined_at
    ), '[]'::jsonb)
    INTO v_result
    FROM public.league_members lm
    JOIN public.user_profiles up ON up.id = lm.user_id
    WHERE lm.league_id = p_league_id;

    RETURN v_result;
END;
$fn_get_members_v2$;
