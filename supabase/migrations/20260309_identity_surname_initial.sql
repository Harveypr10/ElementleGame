-- ============================================================================
-- DEFAULT IDENTITY: First Name + Surname Initial
--
-- Updates auto_join_system_leagues() and create_league() to default
-- league_nickname to "FirstName L" format when last_name is available.
-- ============================================================================


-- ─── 1. Update auto_join_system_leagues trigger ──────────────────────────
-- Changes nickname from just first_name to "FirstName L" (surname initial)

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
    -- Build nickname: "FirstName L" (with surname initial) or just FirstName
    v_nickname := COALESCE(NULLIF(TRIM(NEW.first_name), ''), 'Player');
    IF TRIM(COALESCE(NEW.last_name, '')) != '' THEN
        v_nickname := v_nickname || ' ' || LEFT(TRIM(NEW.last_name), 1);
    END IF;

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


-- ─── 2. Update create_league to use surname initial in default nickname ──

CREATE OR REPLACE FUNCTION public.create_league(
    p_name text DEFAULT 'Elementle League',
    p_has_region_board boolean DEFAULT true,
    p_has_user_board boolean DEFAULT true
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $fn_create_v5$
DECLARE
    v_user_id uuid := auth.uid();
    v_league_id uuid; v_join_code text;
    v_display_name text; v_tag text;
    v_trimmed_name text;
    v_last_name text;
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

    -- Build nickname with surname initial: "FirstName L"
    SELECT COALESCE(global_display_name, NULLIF(TRIM(first_name), ''), 'Player'),
           COALESCE(NULLIF(TRIM(last_name), ''), '')
    INTO v_display_name, v_last_name
    FROM public.user_profiles WHERE id = v_user_id;

    -- Append surname initial if available and not already in global_display_name
    IF v_last_name != '' AND v_display_name NOT LIKE '% ' || LEFT(v_last_name, 1) THEN
        v_display_name := v_display_name || ' ' || LEFT(v_last_name, 1);
    END IF;

    v_tag := COALESCE(
        (SELECT global_tag FROM public.user_profiles WHERE id = v_user_id),
        public.generate_display_tag(v_display_name)
    );

    INSERT INTO public.league_members (league_id, user_id, league_nickname, can_share, is_active)
    VALUES (v_league_id, v_user_id, v_display_name, true, true);

    PERFORM public.hydrate_member_standings(v_user_id, v_league_id);

    -- Recalculate timezone
    PERFORM public.recalculate_league_timezone(v_league_id);

    RETURN jsonb_build_object(
        'league_id', v_league_id, 'join_code', v_join_code,
        'display_name', v_display_name, 'global_tag', v_tag
    );
END;
$fn_create_v5$;
