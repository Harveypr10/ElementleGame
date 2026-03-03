-- ============================================================================
-- LEAGUE SYSTEM — Admin Member Management RPCs (Revised)
--
-- 1. league_bans table for persistent ban tracking
-- 2. get_league_members  — returns all members for admin view
-- 3. update_member_share — toggle share permission for a member
-- 4. toggle_all_sharing  — set can_share for all members
-- 5. remove_and_block_member — removes member + inserts ban record
-- 6. Updated join_league — checks league_bans before allowing join
-- 7. Updated get_my_leagues_all — includes can_share
--
-- Run in Supabase SQL Editor.
-- ============================================================================


-- ─── 1. league_bans table ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.league_bans (
    id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    league_id   uuid NOT NULL REFERENCES public.leagues(id) ON DELETE CASCADE,
    user_id     uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    banned_by   uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    banned_at   timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT uq_league_ban UNIQUE (league_id, user_id)
);

COMMENT ON TABLE public.league_bans IS 'Tracks users banned from leagues — prevents re-joining via invite link';

-- Disable RLS (accessed only by SECURITY DEFINER RPCs)
ALTER TABLE public.league_bans DISABLE ROW LEVEL SECURITY;


-- ─── 2. get_league_members ──────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_league_members(p_league_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $fn_get_members$
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
            'is_admin', (lm.user_id = v_user_id),
            'joined_at', lm.joined_at
        ) ORDER BY lm.joined_at
    ), '[]'::jsonb)
    INTO v_result
    FROM public.league_members lm
    JOIN public.user_profiles up ON up.id = lm.user_id
    WHERE lm.league_id = p_league_id
      AND lm.is_active = true;

    RETURN v_result;
END;
$fn_get_members$;


-- ─── 3. update_member_share ─────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.update_member_share(
    p_league_id uuid,
    p_target_user_id uuid,
    p_can_share boolean
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $fn_upd_share$
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
        RAISE EXCEPTION 'Only the league admin can manage share permissions';
    END IF;

    UPDATE public.league_members
    SET can_share = p_can_share
    WHERE league_id = p_league_id AND user_id = p_target_user_id;

    RETURN jsonb_build_object('success', true);
END;
$fn_upd_share$;


-- ─── 4. toggle_all_sharing ──────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.toggle_all_sharing(
    p_league_id uuid,
    p_can_share boolean
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $fn_tgl_share$
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
        RAISE EXCEPTION 'Only the league admin can manage share permissions';
    END IF;

    UPDATE public.league_members
    SET can_share = p_can_share
    WHERE league_id = p_league_id AND is_active = true;

    RETURN jsonb_build_object('success', true);
END;
$fn_tgl_share$;


-- ─── 5. remove_and_block_member ─────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.remove_and_block_member(
    p_league_id uuid,
    p_target_user_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $fn_rem_block$
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

    -- 1. Insert ban record (persists even after membership is deleted)
    INSERT INTO public.league_bans (league_id, user_id, banned_by)
    VALUES (p_league_id, p_target_user_id, v_user_id)
    ON CONFLICT (league_id, user_id) DO UPDATE SET
        banned_by = v_user_id,
        banned_at = now();

    -- 2. Delete standings
    DELETE FROM public.league_standings_live
    WHERE league_id = p_league_id AND user_id = p_target_user_id;

    DELETE FROM public.league_standings_snapshot
    WHERE league_id = p_league_id AND user_id = p_target_user_id;

    -- 3. Delete membership
    DELETE FROM public.league_members
    WHERE league_id = p_league_id AND user_id = p_target_user_id;

    RETURN jsonb_build_object('success', true);
END;
$fn_rem_block$;


-- ─── 6. Updated join_league — with ban check ───────────────────────────────

CREATE OR REPLACE FUNCTION public.join_league(p_join_code text, p_display_name text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $fn_join_v2$
DECLARE
    v_user_id uuid := auth.uid();
    v_league record;
    v_rank integer;
    v_total integer;
    v_existing_member record;
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

    -- *** BAN CHECK: friendly message, no mention of "banned" ***
    IF EXISTS (
        SELECT 1 FROM public.league_bans
        WHERE league_id = v_league.id AND user_id = v_user_id
    ) THEN
        RAISE EXCEPTION 'You do not have permission to join this league.';
    END IF;

    -- Check if already a member
    SELECT league_nickname, is_active
    INTO v_existing_member
    FROM public.league_members
    WHERE league_id = v_league.id AND user_id = v_user_id;

    IF v_existing_member IS NOT NULL THEN
        IF v_existing_member.is_active THEN
            RAISE EXCEPTION 'You are already a member of this league';
        ELSE
            -- Re-activate inactive membership
            UPDATE public.league_members
            SET is_active = true,
                league_nickname = COALESCE(NULLIF(TRIM(p_display_name), ''), v_existing_member.league_nickname)
            WHERE league_id = v_league.id AND user_id = v_user_id;

            SELECT COUNT(*) INTO v_total
            FROM public.league_members
            WHERE league_id = v_league.id AND is_active = true;

            RETURN jsonb_build_object(
                'league_id', v_league.id,
                'league_name', v_league.name,
                'league_nickname', COALESCE(NULLIF(TRIM(p_display_name), ''), v_existing_member.league_nickname),
                'rank', v_total,
                'total_members', v_total
            );
        END IF;
    END IF;

    -- New membership
    INSERT INTO public.league_members (league_id, user_id, league_nickname, can_share, is_active)
    VALUES (v_league.id, v_user_id, TRIM(p_display_name), false, true);

    PERFORM public.hydrate_member_standings(v_user_id, v_league.id);

    SELECT COUNT(*) INTO v_total
    FROM public.league_members
    WHERE league_id = v_league.id AND is_active = true;

    v_rank := v_total; -- New member starts at bottom

    RETURN jsonb_build_object(
        'league_id', v_league.id,
        'league_name', v_league.name,
        'league_nickname', TRIM(p_display_name),
        'rank', v_rank,
        'total_members', v_total
    );
END;
$fn_join_v2$;


-- ─── 7. Updated get_my_leagues_all — includes can_share ─────────────────────

CREATE OR REPLACE FUNCTION public.get_my_leagues_all()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $fn_mla_v2$
DECLARE
    v_user_id uuid := auth.uid();
    v_result jsonb;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required';
    END IF;

    SELECT COALESCE(jsonb_agg(row_to_json(l)::jsonb ORDER BY l.is_system_league DESC, l.name), '[]'::jsonb)
    INTO v_result
    FROM (
        SELECT
            lg.id,
            lg.name,
            lg.admin_user_id,
            lg.is_system_league,
            lg.system_region,
            lg.share_link_public,
            lg.join_code,
            lg.created_at,
            lm.league_nickname,
            lm.is_active,
            lm.can_share,
            (SELECT COUNT(*) FROM public.league_members lm2
             WHERE lm2.league_id = lg.id AND lm2.is_active = true) AS member_count
        FROM public.leagues lg
        INNER JOIN public.league_members lm ON lm.league_id = lg.id
        WHERE lm.user_id = v_user_id
    ) l;

    RETURN v_result;
END;
$fn_mla_v2$;
