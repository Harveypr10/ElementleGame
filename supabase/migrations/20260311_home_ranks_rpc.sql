-- ============================================================================
-- HOME SCREEN RANKINGS: Lightweight RPC for scalable rank fetching
--
-- Instead of calling the full get_league_standings RPC (which builds the
-- entire leaderboard with window functions), this RPC returns just the
-- current user's rank and rank change in their system leagues.
--
-- Uses COUNT(*) + 1 to compute rank — O(index scan) instead of O(n log n).
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_my_home_ranks(
    p_game_mode text DEFAULT 'region'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $fn_home_ranks$
DECLARE
    v_user_id           uuid := auth.uid();
    v_global_league_id  uuid;
    v_region_league_id  uuid;
    v_region_name       text;
    v_my_rating_g       numeric;
    v_my_rating_r       numeric;
    v_my_games_g        int;
    v_my_games_r        int;
    v_global_rank       int;
    v_region_rank       int;
    v_global_yest_rank  int;
    v_region_yest_rank  int;
    v_min_games         int;
    v_latest_snap_date  date;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required';
    END IF;

    -- Get min games threshold
    SELECT COALESCE(
        (SELECT value::int FROM public.admin_settings WHERE key = 'min_games_for_cumulative_percentile'),
        5
    ) INTO v_min_games;

    -- Find the user's system leagues
    SELECT l.id INTO v_global_league_id
    FROM public.leagues l
    JOIN public.league_members lm ON lm.league_id = l.id
    WHERE l.is_system_league = true AND l.system_region = 'GLOBAL'
      AND lm.user_id = v_user_id
      AND CASE WHEN p_game_mode = 'user' THEN lm.is_active_user ELSE lm.is_active_region END = true
    LIMIT 1;

    SELECT l.id, l.system_region INTO v_region_league_id, v_region_name
    FROM public.leagues l
    JOIN public.league_members lm ON lm.league_id = l.id
    WHERE l.is_system_league = true AND l.system_region != 'GLOBAL'
      AND lm.user_id = v_user_id
      AND CASE WHEN p_game_mode = 'user' THEN lm.is_active_user ELSE lm.is_active_region END = true
    LIMIT 1;

    -- ── Global rank ──
    IF v_global_league_id IS NOT NULL THEN
        -- Get my rating + games_played
        SELECT COALESCE(s.elementle_rating, 0), COALESCE(s.games_played, 0)
        INTO v_my_rating_g, v_my_games_g
        FROM public.league_standings_live s
        WHERE s.league_id = v_global_league_id
          AND s.user_id = v_user_id
          AND s.timeframe = 'mtd'
          AND s.game_mode = p_game_mode;

        -- Only rank if meets minimum games
        IF v_my_games_g >= v_min_games THEN
            SELECT COUNT(*) + 1 INTO v_global_rank
            FROM public.league_standings_live s
            JOIN public.league_members lm
                ON lm.league_id = s.league_id AND lm.user_id = s.user_id
            WHERE s.league_id = v_global_league_id
              AND s.timeframe = 'mtd'
              AND s.game_mode = p_game_mode
              AND s.user_id != v_user_id
              AND COALESCE(s.games_played, 0) >= v_min_games
              AND CASE WHEN p_game_mode = 'user' THEN lm.is_active_user ELSE lm.is_active_region END = true
              AND (
                  s.elementle_rating > v_my_rating_g
                  OR (s.elementle_rating = v_my_rating_g AND COALESCE(s.games_played, 0) > v_my_games_g)
              );
        END IF;

        -- Yesterday's rank from latest snapshot
        SELECT MAX(snapshot_date) INTO v_latest_snap_date
        FROM public.daily_league_rank_snapshot
        WHERE league_id = v_global_league_id
          AND timeframe = 'mtd' AND game_mode = p_game_mode;

        IF v_latest_snap_date IS NOT NULL THEN
            SELECT rank INTO v_global_yest_rank
            FROM public.daily_league_rank_snapshot
            WHERE league_id = v_global_league_id
              AND user_id = v_user_id
              AND snapshot_date = v_latest_snap_date
              AND timeframe = 'mtd' AND game_mode = p_game_mode;
        END IF;
    END IF;

    -- ── Region rank ──
    IF v_region_league_id IS NOT NULL THEN
        SELECT COALESCE(s.elementle_rating, 0), COALESCE(s.games_played, 0)
        INTO v_my_rating_r, v_my_games_r
        FROM public.league_standings_live s
        WHERE s.league_id = v_region_league_id
          AND s.user_id = v_user_id
          AND s.timeframe = 'mtd'
          AND s.game_mode = p_game_mode;

        IF v_my_games_r >= v_min_games THEN
            SELECT COUNT(*) + 1 INTO v_region_rank
            FROM public.league_standings_live s
            JOIN public.league_members lm
                ON lm.league_id = s.league_id AND lm.user_id = s.user_id
            WHERE s.league_id = v_region_league_id
              AND s.timeframe = 'mtd'
              AND s.game_mode = p_game_mode
              AND s.user_id != v_user_id
              AND COALESCE(s.games_played, 0) >= v_min_games
              AND CASE WHEN p_game_mode = 'user' THEN lm.is_active_user ELSE lm.is_active_region END = true
              AND (
                  s.elementle_rating > v_my_rating_r
                  OR (s.elementle_rating = v_my_rating_r AND COALESCE(s.games_played, 0) > v_my_games_r)
              );
        END IF;

        -- Yesterday's rank from latest snapshot
        IF v_latest_snap_date IS NULL THEN
            SELECT MAX(snapshot_date) INTO v_latest_snap_date
            FROM public.daily_league_rank_snapshot
            WHERE league_id = v_region_league_id
              AND timeframe = 'mtd' AND game_mode = p_game_mode;
        END IF;

        IF v_latest_snap_date IS NOT NULL THEN
            SELECT rank INTO v_region_yest_rank
            FROM public.daily_league_rank_snapshot
            WHERE league_id = v_region_league_id
              AND user_id = v_user_id
              AND snapshot_date = v_latest_snap_date
              AND timeframe = 'mtd' AND game_mode = p_game_mode;
        END IF;
    END IF;

    RETURN jsonb_build_object(
        'global_rank', v_global_rank,
        'global_yesterdays_rank', v_global_yest_rank,
        'region_rank', v_region_rank,
        'region_yesterdays_rank', v_region_yest_rank,
        'region_name', COALESCE(v_region_name, 'UK')
    );
END;
$fn_home_ranks$;
