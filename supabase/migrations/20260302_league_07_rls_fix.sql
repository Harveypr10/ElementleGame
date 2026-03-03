-- ============================================================================
-- LEAGUE SYSTEM — RLS Fix v2: Bypass with SECURITY DEFINER RPC
-- 
-- The cross-table RLS between leagues ↔ league_members causes infinite
-- recursion regardless of policy design. Solution: disable RLS on these
-- tables and use SECURITY DEFINER RPCs for all access.
-- 
-- Run in Supabase SQL Editor.
-- ============================================================================

-- Step 1: Drop ALL existing RLS policies on league tables
DO $$
DECLARE
    pol record;
BEGIN
    -- league_members policies
    FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'league_members' AND schemaname = 'public'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.league_members', pol.policyname);
    END LOOP;

    -- leagues policies
    FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'leagues' AND schemaname = 'public'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.leagues', pol.policyname);
    END LOOP;

    -- league_standings_live policies
    FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'league_standings_live' AND schemaname = 'public'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.league_standings_live', pol.policyname);
    END LOOP;

    -- league_standings_snapshot policies
    FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'league_standings_snapshot' AND schemaname = 'public'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.league_standings_snapshot', pol.policyname);
    END LOOP;
END;
$$;

-- Step 2: Disable RLS on all league tables (RPCs are all SECURITY DEFINER)
ALTER TABLE public.leagues DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.league_members DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.league_standings_live DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.league_standings_snapshot DISABLE ROW LEVEL SECURITY;

-- Step 3: Create SECURITY DEFINER RPC to fetch user's leagues
CREATE OR REPLACE FUNCTION public.get_my_leagues()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $fn$
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
            (SELECT COUNT(*) FROM public.league_members lm2 WHERE lm2.league_id = lg.id) AS member_count
        FROM public.leagues lg
        INNER JOIN public.league_members lm ON lm.league_id = lg.id
        WHERE lm.user_id = v_user_id
    ) l;

    RETURN v_result;
END;
$fn$;

-- Step 4: Create SECURITY DEFINER RPC to fetch user's membership for a league
CREATE OR REPLACE FUNCTION public.get_my_membership(p_league_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $fn$
DECLARE
    v_user_id uuid := auth.uid();
    v_result jsonb;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required';
    END IF;

    SELECT row_to_json(lm)::jsonb
    INTO v_result
    FROM public.league_members lm
    WHERE lm.league_id = p_league_id AND lm.user_id = v_user_id;

    RETURN v_result;
END;
$fn$;
