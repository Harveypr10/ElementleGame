-- ============================================================================
-- PHASE 3.5 PART 2: Updated RPCs + Phase 4 Award Functions
-- Run AFTER Part 1 (20260303_league_12_dual_mode_schema.sql).
-- All functions use UNIQUE dollar-quote tags.
-- ============================================================================


-- ─── 1. get_my_leagues — filter by game_mode ────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_my_leagues(
    p_game_mode text DEFAULT 'region'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $fn_ml_v3$
DECLARE
    v_user_id uuid := auth.uid();
    v_result jsonb;
BEGIN
    IF v_user_id IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;

    SELECT COALESCE(jsonb_agg(row_to_json(l)::jsonb ORDER BY l.is_system_league DESC, l.name), '[]'::jsonb)
    INTO v_result
    FROM (
        SELECT lg.id, lg.name, lg.admin_user_id, lg.is_system_league, lg.system_region,
               lg.share_link_public, lg.join_code, lg.created_at,
               (SELECT COUNT(*) FROM public.league_members lm2
                WHERE lm2.league_id = lg.id
                  AND CASE WHEN p_game_mode = 'user' THEN lm2.is_active_user ELSE lm2.is_active_region END = true
               ) AS member_count
        FROM public.leagues lg
        INNER JOIN public.league_members lm ON lm.league_id = lg.id
        WHERE lm.user_id = v_user_id
          AND CASE WHEN p_game_mode = 'user' THEN lm.is_active_user ELSE lm.is_active_region END = true
          AND CASE WHEN p_game_mode = 'user' THEN lg.has_user_board ELSE lg.has_region_board END = true
    ) l;

    RETURN v_result;
END;
$fn_ml_v3$;


-- ─── 2. get_my_leagues_all — includes dual-mode flags ───────────────────────

CREATE OR REPLACE FUNCTION public.get_my_leagues_all()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $fn_mla_v3$
DECLARE
    v_user_id uuid := auth.uid();
    v_result jsonb;
BEGIN
    IF v_user_id IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;

    SELECT COALESCE(jsonb_agg(row_to_json(l)::jsonb ORDER BY l.is_system_league DESC, l.name), '[]'::jsonb)
    INTO v_result
    FROM (
        SELECT lg.id, lg.name, lg.admin_user_id, lg.is_system_league, lg.system_region,
               lg.share_link_public, lg.join_code, lg.created_at,
               lg.has_region_board, lg.has_user_board,
               lm.league_nickname, lm.is_active, lm.can_share,
               lm.is_active_region, lm.is_active_user,
               (SELECT COUNT(*) FROM public.league_members lm2
                WHERE lm2.league_id = lg.id AND lm2.is_active = true) AS member_count
        FROM public.leagues lg
        INNER JOIN public.league_members lm ON lm.league_id = lg.id
        WHERE lm.user_id = v_user_id
    ) l;

    RETURN v_result;
END;
$fn_mla_v3$;


-- ─── 3. create_league — with board toggles ──────────────────────────────────

CREATE OR REPLACE FUNCTION public.create_league(
    p_name text DEFAULT 'Elementle League',
    p_has_region_board boolean DEFAULT true,
    p_has_user_board boolean DEFAULT true
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $fn_create_v2$
DECLARE
    v_user_id uuid := auth.uid();
    v_league_id uuid; v_join_code text;
    v_display_name text; v_tag text;
BEGIN
    IF v_user_id IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
    IF NOT p_has_region_board AND NOT p_has_user_board THEN
        RAISE EXCEPTION 'At least one board must be enabled';
    END IF;

    v_join_code := public.generate_join_code();

    INSERT INTO public.leagues (name, admin_user_id, join_code, has_region_board, has_user_board)
    VALUES (p_name, v_user_id, v_join_code, p_has_region_board, p_has_user_board)
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
$fn_create_v2$;


-- ─── 4. get_league_standings v4 — with game_mode + blind phase ──────────────

CREATE OR REPLACE FUNCTION public.get_league_standings(
    p_league_id uuid,
    p_timeframe text DEFAULT 'mtd',
    p_game_mode text DEFAULT 'region'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $fn_standings_v4$
DECLARE
    v_user_id uuid := auth.uid();
    v_blind_threshold int; v_day_of_period int; v_prev_label text;
    v_standings jsonb; v_my_rank integer; v_total integer;
BEGIN
    IF v_user_id IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
    IF NOT EXISTS(
        SELECT 1 FROM public.league_members
        WHERE league_id = p_league_id AND user_id = v_user_id
          AND CASE WHEN p_game_mode = 'user' THEN is_active_user ELSE is_active_region END = true
    ) THEN RAISE EXCEPTION 'Not an active member of this league for this mode'; END IF;

    -- Blind Phase Check
    SELECT COALESCE(
        (SELECT value::int FROM public.admin_settings WHERE key = 'min_games_for_cumulative_percentile'), 5
    ) INTO v_blind_threshold;

    IF p_timeframe = 'mtd' THEN
        v_day_of_period := EXTRACT(day FROM CURRENT_DATE)::int;
        v_prev_label := TO_CHAR(CURRENT_DATE - INTERVAL '1 month', 'YYYY-MM');
    ELSE
        v_day_of_period := EXTRACT(doy FROM CURRENT_DATE)::int;
        v_prev_label := TO_CHAR(CURRENT_DATE - INTERVAL '1 year', 'YYYY');
    END IF;

    IF v_day_of_period < v_blind_threshold THEN
        IF EXISTS (
            SELECT 1 FROM public.league_standings_snapshot
            WHERE league_id = p_league_id AND timeframe = p_timeframe
              AND period_label = v_prev_label AND game_mode = p_game_mode
        ) THEN
            RETURN public.get_historical_standings(p_league_id, p_timeframe, v_prev_label, p_game_mode);
        END IF;
    END IF;

    -- Live Standings
    SELECT jsonb_agg(row_data ORDER BY rn) INTO v_standings
    FROM (
        SELECT jsonb_build_object(
            'rank', ROW_NUMBER() OVER (ORDER BY s.elementle_rating DESC, s.current_streak DESC, s.games_played DESC, s.avg_guesses ASC),
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
        ROW_NUMBER() OVER (ORDER BY s.elementle_rating DESC, s.current_streak DESC, s.games_played DESC, s.avg_guesses ASC) AS rn
        FROM public.league_members m
        LEFT JOIN public.league_standings_live s
            ON s.league_id = m.league_id AND s.user_id = m.user_id
           AND s.timeframe = p_timeframe AND s.game_mode = p_game_mode
        LEFT JOIN public.user_profiles up ON up.id = m.user_id
        WHERE m.league_id = p_league_id
          AND CASE WHEN p_game_mode = 'user' THEN m.is_active_user ELSE m.is_active_region END = true
    ) ranked;

    SELECT (row_data->>'rank')::integer INTO v_my_rank
    FROM (SELECT jsonb_array_elements(v_standings) AS row_data) t
    WHERE row_data->>'user_id' = v_user_id::text;

    SELECT COUNT(*) INTO v_total FROM public.league_members
    WHERE league_id = p_league_id
      AND CASE WHEN p_game_mode = 'user' THEN is_active_user ELSE is_active_region END = true;

    RETURN jsonb_build_object('standings', COALESCE(v_standings, '[]'::jsonb),
        'my_rank', v_my_rank, 'total_members', v_total, 'is_historical', false);
END;
$fn_standings_v4$;


-- ─── 5. get_historical_standings v2 — with game_mode ────────────────────────

CREATE OR REPLACE FUNCTION public.get_historical_standings(
    p_league_id uuid, p_timeframe text, p_period_label text,
    p_game_mode text DEFAULT 'region'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $fn_hist_v2$
DECLARE
    v_user_id uuid := auth.uid();
    v_standings jsonb; v_my_rank integer; v_total integer;
BEGIN
    IF v_user_id IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
    IF NOT EXISTS(SELECT 1 FROM public.league_members WHERE league_id = p_league_id AND user_id = v_user_id) THEN
        RAISE EXCEPTION 'Not a member of this league';
    END IF;

    SELECT jsonb_agg(row_data ORDER BY (row_data->>'rank')::int) INTO v_standings
    FROM (
        SELECT jsonb_build_object(
            'rank', s.rank, 'user_id', s.user_id,
            'league_nickname', COALESCE(lm.league_nickname, up.global_display_name, 'Player'),
            'global_display_name', COALESCE(up.global_display_name, up.first_name, 'Player'),
            'global_tag', COALESCE(up.global_tag, '#0000'),
            'elementle_rating', ROUND(COALESCE(s.elementle_rating, 0), 1),
            'current_streak', 0, 'games_played', 0, 'games_won', 0,
            'win_rate', 0, 'avg_guesses', 0,
            'is_me', (s.user_id = v_user_id), 'yesterdays_rank', NULL
        ) AS row_data
        FROM public.league_standings_snapshot s
        LEFT JOIN public.league_members lm ON lm.league_id = s.league_id AND lm.user_id = s.user_id
        LEFT JOIN public.user_profiles up ON up.id = s.user_id
        WHERE s.league_id = p_league_id AND s.timeframe = p_timeframe
          AND s.period_label = p_period_label AND s.game_mode = p_game_mode
    ) ranked;

    SELECT (row_data->>'rank')::integer INTO v_my_rank
    FROM (SELECT jsonb_array_elements(v_standings) AS row_data) t
    WHERE row_data->>'user_id' = v_user_id::text;

    v_total := COALESCE(jsonb_array_length(v_standings), 0);
    RETURN jsonb_build_object('standings', COALESCE(v_standings, '[]'::jsonb),
        'my_rank', v_my_rank, 'total_members', v_total,
        'is_historical', true, 'period_label', p_period_label);
END;
$fn_hist_v2$;


-- ─── 6. leave_league — now sets BOTH mode flags to false ────────────────────

CREATE OR REPLACE FUNCTION public.leave_league(p_league_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $fn_ll_v2$
DECLARE v_user_id uuid := auth.uid();
BEGIN
    IF v_user_id IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
    UPDATE public.league_members
    SET is_active = false, is_active_region = false, is_active_user = false
    WHERE league_id = p_league_id AND user_id = v_user_id;
    RETURN jsonb_build_object('success', true);
END;
$fn_ll_v2$;


-- ─── 7. rejoin_league — sets BOTH mode flags to true ────────────────────────

CREATE OR REPLACE FUNCTION public.rejoin_league(p_league_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $fn_rj_v2$
DECLARE v_user_id uuid := auth.uid();
BEGIN
    IF v_user_id IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
    UPDATE public.league_members
    SET is_active = true, is_active_region = true, is_active_user = true
    WHERE league_id = p_league_id AND user_id = v_user_id;
    PERFORM public.hydrate_member_standings(v_user_id, p_league_id);
    RETURN jsonb_build_object('success', true);
END;
$fn_rj_v2$;


-- ─── 8. NEW: leave_league_mode — leave a single mode ────────────────────────

CREATE OR REPLACE FUNCTION public.leave_league_mode(
    p_league_id uuid,
    p_game_mode text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $fn_llm$
DECLARE v_user_id uuid := auth.uid();
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
    RETURN jsonb_build_object('success', true, 'mode', p_game_mode);
END;
$fn_llm$;


-- ─── 9. NEW: rejoin_league_mode — rejoin a single mode ──────────────────────

CREATE OR REPLACE FUNCTION public.rejoin_league_mode(
    p_league_id uuid,
    p_game_mode text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $fn_rlm$
DECLARE v_user_id uuid := auth.uid();
BEGIN
    IF v_user_id IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
    IF p_game_mode = 'user' THEN
        UPDATE public.league_members SET is_active_user = true
        WHERE league_id = p_league_id AND user_id = v_user_id;
    ELSIF p_game_mode = 'region' THEN
        UPDATE public.league_members SET is_active_region = true
        WHERE league_id = p_league_id AND user_id = v_user_id;
    ELSE
        RAISE EXCEPTION 'Invalid game_mode: must be region or user';
    END IF;
    -- Re-hydrate standings for that mode
    PERFORM public.hydrate_member_standings(v_user_id, p_league_id);
    RETURN jsonb_build_object('success', true, 'mode', p_game_mode);
END;
$fn_rlm$;


-- ─── 10. snapshot_period_standings v2 — includes game_mode ──────────────────

CREATE OR REPLACE FUNCTION public.snapshot_period_standings(
    p_timeframe text,
    p_period_label text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $fn_snapshot_v2$
BEGIN
    INSERT INTO public.league_standings_snapshot
        (league_id, user_id, timeframe, period_label, game_mode, elementle_rating, rank, frozen_at)
    SELECT
        s.league_id, s.user_id, p_timeframe, p_period_label, s.game_mode,
        s.elementle_rating,
        ROW_NUMBER() OVER (
            PARTITION BY s.league_id, s.game_mode
            ORDER BY s.elementle_rating DESC, s.current_streak DESC,
                     s.games_played DESC, s.avg_guesses ASC
        ),
        now()
    FROM public.league_standings_live s
    WHERE s.timeframe = p_timeframe
    ON CONFLICT (league_id, user_id, timeframe, period_label, game_mode)
    DO UPDATE SET
        elementle_rating = EXCLUDED.elementle_rating,
        rank = EXCLUDED.rank,
        frozen_at = EXCLUDED.frozen_at;
END;
$fn_snapshot_v2$;


-- ─── 11. grant_period_awards v2 — processes both game modes ─────────────────

CREATE OR REPLACE FUNCTION public.grant_period_awards(
    p_timeframe text,
    p_period_label text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $fn_grant_awards_v2$
DECLARE
    v_global_league_id uuid; v_total_ranked integer;
    v_medals_inserted integer := 0; v_badges_inserted integer := 0;
    v_row_count integer; v_mode text;
BEGIN
    -- Process medals for BOTH modes
    FOR v_mode IN SELECT unnest(ARRAY['region', 'user'])
    LOOP
        INSERT INTO public.league_awards
            (league_id, user_id, timeframe, period_label, game_mode, medal, elementle_rating)
        SELECT s.league_id, s.user_id, p_timeframe, p_period_label, v_mode,
            CASE s.rank WHEN 1 THEN 'gold' WHEN 2 THEN 'silver' WHEN 3 THEN 'bronze' END,
            s.elementle_rating
        FROM public.league_standings_snapshot s
        WHERE s.timeframe = p_timeframe AND s.period_label = p_period_label
          AND s.game_mode = v_mode AND s.rank <= 3 AND s.elementle_rating > 0
        ON CONFLICT (league_id, user_id, timeframe, period_label, game_mode) DO NOTHING;

        GET DIAGNOSTICS v_row_count = ROW_COUNT;
        v_medals_inserted := v_medals_inserted + v_row_count;
    END LOOP;

    -- Global percentile badges for BOTH modes
    FOR v_mode IN SELECT unnest(ARRAY['region', 'user'])
    LOOP
        SELECT id INTO v_global_league_id FROM public.leagues
        WHERE is_system_league = true AND system_region = 'GLOBAL' LIMIT 1;

        IF v_global_league_id IS NOT NULL THEN
            SELECT COUNT(*) INTO v_total_ranked
            FROM public.league_standings_snapshot
            WHERE league_id = v_global_league_id AND timeframe = p_timeframe
              AND period_label = p_period_label AND game_mode = v_mode AND elementle_rating > 0;

            IF v_total_ranked > 0 THEN
                INSERT INTO public.global_percentile_awards
                    (user_id, timeframe, period_label, game_mode, percentile_rank, percentile_tier,
                     elementle_rating, total_ranked)
                SELECT s.user_id, p_timeframe, p_period_label, v_mode,
                    ROUND((s.rank::numeric / v_total_ranked) * 100, 2),
                    CASE
                        WHEN (s.rank::numeric / v_total_ranked) * 100 <= 1  THEN 'top_1'
                        WHEN (s.rank::numeric / v_total_ranked) * 100 <= 5  THEN 'top_5'
                        WHEN (s.rank::numeric / v_total_ranked) * 100 <= 10 THEN 'top_10'
                        WHEN (s.rank::numeric / v_total_ranked) * 100 <= 25 THEN 'top_25'
                        WHEN (s.rank::numeric / v_total_ranked) * 100 <= 50 THEN 'top_50'
                        ELSE 'below_50'
                    END,
                    s.elementle_rating, v_total_ranked
                FROM public.league_standings_snapshot s
                WHERE s.league_id = v_global_league_id AND s.timeframe = p_timeframe
                  AND s.period_label = p_period_label AND s.game_mode = v_mode AND s.elementle_rating > 0
                ON CONFLICT (user_id, timeframe, period_label, game_mode) DO NOTHING;

                GET DIAGNOSTICS v_row_count = ROW_COUNT;
                v_badges_inserted := v_badges_inserted + v_row_count;
            END IF;
        END IF;
    END LOOP;

    RETURN jsonb_build_object('medals_inserted', v_medals_inserted, 'badges_inserted', v_badges_inserted,
        'total_global_ranked', COALESCE(v_total_ranked, 0), 'timeframe', p_timeframe, 'period_label', p_period_label);
END;
$fn_grant_awards_v2$;


-- ─── 12. cleanup_old_standings v2 — cleans both modes ───────────────────────

CREATE OR REPLACE FUNCTION public.cleanup_old_standings()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $fn_cleanup_v2$
DECLARE v_deleted integer;
BEGIN
    DELETE FROM public.league_standings_live WHERE timeframe = 'mtd';
    GET DIAGNOSTICS v_deleted = ROW_COUNT;
    RETURN jsonb_build_object('mtd_rows_deleted', v_deleted, 'cleaned_at', now());
END;
$fn_cleanup_v2$;


-- ─── 13. allocate_monthly_percentile_badges v2 — both modes ─────────────────

CREATE OR REPLACE FUNCTION public.allocate_monthly_percentile_badges(
    p_timeframe text,
    p_period_label text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $fn_alloc_pctile_v2$
DECLARE
    v_league record; v_total_users integer; v_user record;
    v_percentile numeric; v_best_threshold integer; v_badge_id integer; v_existing_id integer;
    v_game_type text; v_badge_region text; v_mode text;
    v_global_badges integer := 0; v_regional_badges integer := 0;
BEGIN
    FOR v_mode IN SELECT unnest(ARRAY['region', 'user'])
    LOOP
        -- Global league
        FOR v_league IN
            SELECT id, system_region FROM public.leagues
            WHERE is_system_league = true AND system_region = 'GLOBAL'
        LOOP
            v_game_type := CASE WHEN v_mode = 'region' THEN 'REGION' ELSE 'USER' END;
            v_badge_region := 'GLOBAL';

            SELECT COUNT(*) INTO v_total_users FROM public.league_standings_snapshot
            WHERE league_id = v_league.id AND timeframe = p_timeframe
              AND period_label = p_period_label AND game_mode = v_mode AND elementle_rating > 0;

            IF v_total_users = 0 THEN CONTINUE; END IF;

            FOR v_user IN
                SELECT user_id, rank FROM public.league_standings_snapshot
                WHERE league_id = v_league.id AND timeframe = p_timeframe
                  AND period_label = p_period_label AND game_mode = v_mode AND elementle_rating > 0
            LOOP
                v_percentile := (v_user.rank::numeric / v_total_users) * 100;
                SELECT MIN(threshold) INTO v_best_threshold FROM public.badges
                WHERE LOWER(category) = 'percentile' AND threshold >= v_percentile;
                IF v_best_threshold IS NULL THEN CONTINUE; END IF;
                SELECT b.id INTO v_badge_id FROM public.badges b
                WHERE LOWER(b.category) = 'percentile' AND b.threshold = v_best_threshold;
                IF v_badge_id IS NULL THEN CONTINUE; END IF;

                SELECT ub.id INTO v_existing_id FROM public.user_badges ub
                WHERE ub.user_id = v_user.user_id AND ub.badge_id = v_badge_id
                  AND ub.game_type = v_game_type AND ub.region = v_badge_region;

                IF v_existing_id IS NOT NULL THEN
                    UPDATE public.user_badges SET badge_count = badge_count + 1,
                        is_awarded = false, awarded_at = now() WHERE id = v_existing_id;
                ELSE
                    INSERT INTO public.user_badges (user_id, badge_id, game_type, region, badge_count, is_awarded, awarded_at)
                    VALUES (v_user.user_id, v_badge_id, v_game_type, v_badge_region, 1, false, now());
                END IF;
                v_global_badges := v_global_badges + 1;
            END LOOP;
        END LOOP;

        -- Regional leagues
        FOR v_league IN
            SELECT id, system_region FROM public.leagues
            WHERE is_system_league = true AND system_region IS NOT NULL AND system_region <> 'GLOBAL'
        LOOP
            v_game_type := CASE WHEN v_mode = 'region' THEN 'REGION' ELSE 'USER' END;
            v_badge_region := v_league.system_region;

            SELECT COUNT(*) INTO v_total_users FROM public.league_standings_snapshot
            WHERE league_id = v_league.id AND timeframe = p_timeframe
              AND period_label = p_period_label AND game_mode = v_mode AND elementle_rating > 0;

            IF v_total_users = 0 THEN CONTINUE; END IF;

            FOR v_user IN
                SELECT user_id, rank FROM public.league_standings_snapshot
                WHERE league_id = v_league.id AND timeframe = p_timeframe
                  AND period_label = p_period_label AND game_mode = v_mode AND elementle_rating > 0
            LOOP
                v_percentile := (v_user.rank::numeric / v_total_users) * 100;
                SELECT MIN(threshold) INTO v_best_threshold FROM public.badges
                WHERE LOWER(category) = 'percentile' AND threshold >= v_percentile;
                IF v_best_threshold IS NULL THEN CONTINUE; END IF;
                SELECT b.id INTO v_badge_id FROM public.badges b
                WHERE LOWER(b.category) = 'percentile' AND b.threshold = v_best_threshold;
                IF v_badge_id IS NULL THEN CONTINUE; END IF;

                SELECT ub.id INTO v_existing_id FROM public.user_badges ub
                WHERE ub.user_id = v_user.user_id AND ub.badge_id = v_badge_id
                  AND ub.game_type = v_game_type AND ub.region = v_badge_region;

                IF v_existing_id IS NOT NULL THEN
                    UPDATE public.user_badges SET badge_count = badge_count + 1,
                        is_awarded = false, awarded_at = now() WHERE id = v_existing_id;
                ELSE
                    INSERT INTO public.user_badges (user_id, badge_id, game_type, region, badge_count, is_awarded, awarded_at)
                    VALUES (v_user.user_id, v_badge_id, v_game_type, v_badge_region, 1, false, now());
                END IF;
                v_regional_badges := v_regional_badges + 1;
            END LOOP;
        END LOOP;
    END LOOP;

    RETURN jsonb_build_object('global_badges', v_global_badges, 'regional_badges', v_regional_badges,
        'timeframe', p_timeframe, 'period_label', p_period_label);
END;
$fn_alloc_pctile_v2$;
