-- ============================================================================
-- LEAGUE SYSTEM — Identity Refactor
-- 
-- 1. Add global_display_name + global_tag to user_profiles
-- 2. Rename display_name → league_nickname in league_members, drop display_tag
-- 3. Add is_active to league_members
-- 4. Rewrite generate_display_tag() for random 4-digit (0102–9999)
-- 5. Update all RPCs for new schema
-- 6. Backfill existing users
--
-- Run in Supabase SQL Editor (one shot).
-- ============================================================================


-- ──────────────────────────────────────────────────────────────────────────────
-- SECTION 1: Schema Changes
-- ──────────────────────────────────────────────────────────────────────────────

-- 1a. Add global identity columns to user_profiles
ALTER TABLE public.user_profiles
    ADD COLUMN IF NOT EXISTS global_display_name text,
    ADD COLUMN IF NOT EXISTS global_tag text;

-- 1b. Rename display_name → league_nickname in league_members
DO $rename$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'league_members'
          AND column_name = 'display_name'
    ) THEN
        ALTER TABLE public.league_members RENAME COLUMN display_name TO league_nickname;
    END IF;
END;
$rename$;

-- 1c. Add is_active to league_members
ALTER TABLE public.league_members
    ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;


-- ──────────────────────────────────────────────────────────────────────────────
-- SECTION 2: Rewrite generate_display_tag()
-- Now generates a RANDOM 4-digit tag (0102–9999) unique against user_profiles
-- ──────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.generate_display_tag(p_display_name text)
RETURNS text
LANGUAGE plpgsql
AS $fn_tag$
DECLARE
    v_num integer;
    v_tag text;
    v_attempts integer := 0;
BEGIN
    LOOP
        -- Random number between 102 and 9999 (reserve 0001–0101)
        v_num := 102 + floor(random() * (9999 - 102 + 1))::integer;
        v_tag := '#' || LPAD(v_num::text, 4, '0');

        -- Check uniqueness against user_profiles (global identity)
        IF NOT EXISTS (
            SELECT 1 FROM public.user_profiles
            WHERE LOWER(global_display_name) = LOWER(p_display_name)
              AND global_tag = v_tag
        ) THEN
            RETURN v_tag;
        END IF;

        v_attempts := v_attempts + 1;
        IF v_attempts > 100 THEN
            -- Fallback: use timestamp-based suffix
            RETURN '#' || LPAD(
                (102 + (EXTRACT(EPOCH FROM clock_timestamp()) * 1000)::bigint % 9898)::text,
                4, '0'
            );
        END IF;
    END LOOP;
END;
$fn_tag$;


-- ──────────────────────────────────────────────────────────────────────────────
-- SECTION 3: New RPC — set_global_identity
-- Sets or updates the user's global display name and auto-generates a tag
-- ──────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.set_global_identity(p_display_name text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $fn_id$
DECLARE
    v_user_id uuid := auth.uid();
    v_tag text;
    v_existing_tag text;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required';
    END IF;

    IF TRIM(p_display_name) = '' OR LENGTH(TRIM(p_display_name)) > 15 THEN
        RAISE EXCEPTION 'Display name must be 1-15 characters';
    END IF;

    -- Check if user already has a tag
    SELECT global_tag INTO v_existing_tag
    FROM public.user_profiles
    WHERE id = v_user_id;

    -- Only generate a new tag if name changed or no tag exists
    IF v_existing_tag IS NULL OR v_existing_tag = '' THEN
        v_tag := public.generate_display_tag(TRIM(p_display_name));
    ELSE
        -- Keep existing tag if name hasn't changed
        v_tag := v_existing_tag;
    END IF;

    -- If name changed but tag exists, check if new name+tag combo conflicts
    IF v_existing_tag IS NOT NULL AND v_existing_tag != '' THEN
        IF EXISTS (
            SELECT 1 FROM public.user_profiles
            WHERE LOWER(global_display_name) = LOWER(TRIM(p_display_name))
              AND global_tag = v_existing_tag
              AND id != v_user_id
        ) THEN
            -- Conflict: generate new tag for new name
            v_tag := public.generate_display_tag(TRIM(p_display_name));
        END IF;
    END IF;

    UPDATE public.user_profiles
    SET global_display_name = TRIM(p_display_name),
        global_tag = v_tag
    WHERE id = v_user_id;

    RETURN jsonb_build_object(
        'global_display_name', TRIM(p_display_name),
        'global_tag', v_tag
    );
END;
$fn_id$;


-- ──────────────────────────────────────────────────────────────────────────────
-- SECTION 4: Updated RPCs
-- ──────────────────────────────────────────────────────────────────────────────

-- 4a. create_league — uses global_display_name as default league_nickname
CREATE OR REPLACE FUNCTION public.create_league(p_name text DEFAULT 'Elementle League')
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $fn_cl$
DECLARE
    v_user_id uuid := auth.uid();
    v_league_id uuid;
    v_join_code text;
    v_nickname text;
    v_global_name text;
    v_global_tag text;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required';
    END IF;

    v_join_code := public.generate_join_code();

    INSERT INTO public.leagues (name, admin_user_id, join_code)
    VALUES (p_name, v_user_id, v_join_code)
    RETURNING id INTO v_league_id;

    -- Get global identity
    SELECT COALESCE(NULLIF(TRIM(global_display_name), ''), NULLIF(TRIM(first_name), ''), 'Player'),
           global_tag
    INTO v_nickname, v_global_tag
    FROM public.user_profiles
    WHERE id = v_user_id;

    -- Ensure global identity exists
    IF v_global_tag IS NULL OR v_global_tag = '' THEN
        v_global_tag := public.generate_display_tag(v_nickname);
        UPDATE public.user_profiles
        SET global_display_name = v_nickname,
            global_tag = v_global_tag
        WHERE id = v_user_id;
    END IF;

    INSERT INTO public.league_members (league_id, user_id, league_nickname, can_share, is_active)
    VALUES (v_league_id, v_user_id, v_nickname, true, true);

    PERFORM public.hydrate_member_standings(v_user_id, v_league_id);

    RETURN jsonb_build_object(
        'league_id', v_league_id,
        'join_code', v_join_code,
        'display_name', v_nickname,
        'global_tag', v_global_tag
    );
END;
$fn_cl$;


-- 4b. join_league — uses p_display_name as league_nickname, checks duplicates
CREATE OR REPLACE FUNCTION public.join_league(p_join_code text, p_display_name text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $fn_jl$
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
$fn_jl$;


-- 4c. get_league_standings — returns league_nickname + global identity
CREATE OR REPLACE FUNCTION public.get_league_standings(
    p_league_id uuid,
    p_timeframe text DEFAULT 'mtd'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $fn_gs$
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
                'league_nickname', m.league_nickname,
                'global_display_name', COALESCE(up.global_display_name, up.first_name, 'Player'),
                'global_tag', COALESCE(up.global_tag, '#0000'),
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
            ) AS rn
        FROM public.league_members m
        LEFT JOIN public.league_standings_live s
            ON s.league_id = m.league_id
           AND s.user_id = m.user_id
           AND s.timeframe = p_timeframe
        LEFT JOIN public.user_profiles up
            ON up.id = m.user_id
        WHERE m.league_id = p_league_id
          AND m.is_active = true
    ) ranked;

    SELECT (row_data->>'rank')::integer INTO v_my_rank
    FROM (
        SELECT jsonb_array_elements(v_standings) AS row_data
    ) t
    WHERE row_data->>'user_id' = v_user_id::text;

    SELECT COUNT(*) INTO v_total
    FROM public.league_members
    WHERE league_id = p_league_id AND is_active = true;

    RETURN jsonb_build_object(
        'standings', COALESCE(v_standings, '[]'::jsonb),
        'my_rank', v_my_rank,
        'total_members', v_total
    );
END;
$fn_gs$;


-- 4d. get_my_leagues — only active memberships (for league table tabs)
CREATE OR REPLACE FUNCTION public.get_my_leagues()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $fn_ml$
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
            (SELECT COUNT(*) FROM public.league_members lm2
             WHERE lm2.league_id = lg.id AND lm2.is_active = true) AS member_count
        FROM public.leagues lg
        INNER JOIN public.league_members lm ON lm.league_id = lg.id
        WHERE lm.user_id = v_user_id
          AND lm.is_active = true
    ) l;

    RETURN v_result;
END;
$fn_ml$;


-- 4e. get_my_leagues_all — ALL memberships including inactive (for manage screen)
CREATE OR REPLACE FUNCTION public.get_my_leagues_all()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $fn_mla$
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
            (SELECT COUNT(*) FROM public.league_members lm2
             WHERE lm2.league_id = lg.id AND lm2.is_active = true) AS member_count
        FROM public.leagues lg
        INNER JOIN public.league_members lm ON lm.league_id = lg.id
        WHERE lm.user_id = v_user_id
    ) l;

    RETURN v_result;
END;
$fn_mla$;


-- 4f. update_league_nickname (replaces update_display_name)
CREATE OR REPLACE FUNCTION public.update_league_nickname(
    p_league_id uuid,
    p_nickname text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $fn_un$
DECLARE
    v_user_id uuid := auth.uid();
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required';
    END IF;

    IF TRIM(p_nickname) = '' OR LENGTH(TRIM(p_nickname)) > 15 THEN
        RAISE EXCEPTION 'Nickname must be 1-15 characters';
    END IF;

    UPDATE public.league_members
    SET league_nickname = TRIM(p_nickname)
    WHERE league_id = p_league_id AND user_id = v_user_id;

    RETURN jsonb_build_object('success', true, 'league_nickname', TRIM(p_nickname));
END;
$fn_un$;


-- 4g. leave_league — sets is_active = false
CREATE OR REPLACE FUNCTION public.leave_league(p_league_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $fn_ll$
DECLARE
    v_user_id uuid := auth.uid();
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required';
    END IF;

    UPDATE public.league_members
    SET is_active = false
    WHERE league_id = p_league_id AND user_id = v_user_id;

    RETURN jsonb_build_object('success', true);
END;
$fn_ll$;


-- 4h. rejoin_league — sets is_active = true
CREATE OR REPLACE FUNCTION public.rejoin_league(p_league_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $fn_rj$
DECLARE
    v_user_id uuid := auth.uid();
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required';
    END IF;

    UPDATE public.league_members
    SET is_active = true
    WHERE league_id = p_league_id AND user_id = v_user_id;

    -- Re-hydrate standings
    PERFORM public.hydrate_member_standings(v_user_id, p_league_id);

    RETURN jsonb_build_object('success', true);
END;
$fn_rj$;


-- 4i. delete_league_membership — hard delete (only if inactive + not system)
CREATE OR REPLACE FUNCTION public.delete_league_membership(p_league_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $fn_dl$
DECLARE
    v_user_id uuid := auth.uid();
    v_is_system boolean;
    v_is_active boolean;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required';
    END IF;

    SELECT lg.is_system_league, lm.is_active
    INTO v_is_system, v_is_active
    FROM public.league_members lm
    JOIN public.leagues lg ON lg.id = lm.league_id
    WHERE lm.league_id = p_league_id AND lm.user_id = v_user_id;

    IF v_is_system THEN
        RAISE EXCEPTION 'Cannot delete membership in system leagues';
    END IF;

    IF v_is_active THEN
        RAISE EXCEPTION 'Must leave league before deleting membership';
    END IF;

    -- Delete standings
    DELETE FROM public.league_standings_live
    WHERE league_id = p_league_id AND user_id = v_user_id;

    DELETE FROM public.league_standings_snapshot
    WHERE league_id = p_league_id AND user_id = v_user_id;

    -- Delete membership
    DELETE FROM public.league_members
    WHERE league_id = p_league_id AND user_id = v_user_id;

    RETURN jsonb_build_object('success', true);
END;
$fn_dl$;


-- 4j. get_my_membership — updated for new schema
CREATE OR REPLACE FUNCTION public.get_my_membership(p_league_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $fn_mm$
DECLARE
    v_user_id uuid := auth.uid();
    v_result jsonb;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required';
    END IF;

    SELECT jsonb_build_object(
        'league_id', lm.league_id,
        'user_id', lm.user_id,
        'league_nickname', lm.league_nickname,
        'can_share', lm.can_share,
        'is_active', lm.is_active,
        'yesterdays_rank', lm.yesterdays_rank,
        'last_seen_rank', lm.last_seen_rank,
        'global_display_name', COALESCE(up.global_display_name, up.first_name, 'Player'),
        'global_tag', COALESCE(up.global_tag, '#0000')
    )
    INTO v_result
    FROM public.league_members lm
    JOIN public.user_profiles up ON up.id = lm.user_id
    WHERE lm.league_id = p_league_id AND lm.user_id = v_user_id;

    RETURN v_result;
END;
$fn_mm$;


-- 4k. Update the auto-join trigger to use new column names
CREATE OR REPLACE FUNCTION public.auto_join_system_leagues()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $fn_aj$
DECLARE
    v_league record;
    v_nickname text;
    v_tag text;
BEGIN
    -- Get display name from the profile
    v_nickname := COALESCE(NULLIF(TRIM(NEW.first_name), ''), 'Player');

    -- Ensure global identity exists
    IF NEW.global_display_name IS NULL OR NEW.global_display_name = '' THEN
        NEW.global_display_name := v_nickname;
    END IF;
    IF NEW.global_tag IS NULL OR NEW.global_tag = '' THEN
        NEW.global_tag := public.generate_display_tag(v_nickname);
    END IF;

    -- Auto-join all system leagues
    FOR v_league IN
        SELECT id FROM public.leagues WHERE is_system_league = true
    LOOP
        INSERT INTO public.league_members (league_id, user_id, league_nickname, can_share, is_active)
        VALUES (v_league.id, NEW.id, v_nickname, false, true)
        ON CONFLICT (league_id, user_id) DO NOTHING;
    END LOOP;

    RETURN NEW;
END;
$fn_aj$;


-- ──────────────────────────────────────────────────────────────────────────────
-- SECTION 5: Backfill existing users
-- ──────────────────────────────────────────────────────────────────────────────

-- 5a. Populate global_display_name from first_name for users who don't have it
UPDATE public.user_profiles
SET global_display_name = COALESCE(NULLIF(TRIM(first_name), ''), 'Player')
WHERE global_display_name IS NULL OR global_display_name = '';

-- 5b. Generate global_tag for all users who don't have one
DO $backfill$
DECLARE
    r record;
    v_tag text;
BEGIN
    FOR r IN
        SELECT id, COALESCE(global_display_name, first_name, 'Player') AS name
        FROM public.user_profiles
        WHERE global_tag IS NULL OR global_tag = ''
    LOOP
        v_tag := public.generate_display_tag(r.name);
        UPDATE public.user_profiles
        SET global_tag = v_tag
        WHERE id = r.id;
    END LOOP;
END;
$backfill$;

-- 5c. Backfill league_nickname from old display_name data where it's still null
-- (The column was renamed, so data should already be there. This is a safety net.)
UPDATE public.league_members lm
SET league_nickname = COALESCE(
    NULLIF(TRIM(lm.league_nickname), ''),
    (SELECT COALESCE(up.global_display_name, up.first_name, 'Player')
     FROM public.user_profiles up WHERE up.id = lm.user_id)
)
WHERE lm.league_nickname IS NULL OR TRIM(lm.league_nickname) = '';
