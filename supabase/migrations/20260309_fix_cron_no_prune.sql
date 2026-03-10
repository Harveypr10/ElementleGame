-- ============================================================================
-- FIX: Update snapshot retention in process_pending_snapshots()
--
-- Phase 3 changes:
--   - Rolling window: 7 days → 367 days (12 months, leap-safe)
--   - Permanent archive: never delete end-of-month snapshots
--     (checked via snapshot_date + INTERVAL '1 day' having day = 1)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.process_pending_snapshots()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $fn_snapshots$
DECLARE
    v_rec           record;
    v_user_tz       text;
    v_local_now     timestamp;
    v_yesterday     date;
    v_result_r_mtd  record;
    v_result_r_ytd  record;
    v_result_u_mtd  record;
    v_result_u_ytd  record;
    v_league        record;
    v_league_tz     text;
    v_league_yesterday date;
    v_users_frozen  int := 0;
    v_leagues_ranked int := 0;
    v_pruned_stats  int := 0;
    v_pruned_ranks  int := 0;
    v_start         timestamptz := clock_timestamp();
BEGIN
    -- ─────────────────────────────────────────────────────────────────────
    -- PHASE 1: Freeze user stats at each user's local midnight
    -- ─────────────────────────────────────────────────────────────────────
    FOR v_rec IN
        SELECT DISTINCT
            lm.user_id,
            COALESCE(up.region, 'UK') AS region
        FROM public.league_members lm
        JOIN public.user_profiles up ON up.id = lm.user_id
        WHERE lm.is_active_region = true OR lm.is_active_user = true
    LOOP
        v_user_tz   := public.region_to_timezone(v_rec.region);
        v_local_now := (now() AT TIME ZONE v_user_tz);
        v_yesterday := v_local_now::date - 1;

        -- Skip if already snapshotted for this user's yesterday
        IF EXISTS (
            SELECT 1 FROM public.daily_user_stats_snapshot
            WHERE user_id = v_rec.user_id
              AND snapshot_date = v_yesterday
              AND timeframe = 'mtd'
              AND game_mode = 'region'
        ) THEN
            CONTINUE;
        END IF;

        -- Freeze region mode stats
        SELECT * INTO v_result_r_mtd
        FROM public.calculate_user_league_rating(v_rec.user_id, v_rec.region, 'mtd', v_yesterday);
        SELECT * INTO v_result_r_ytd
        FROM public.calculate_user_league_rating(v_rec.user_id, v_rec.region, 'ytd', v_yesterday);

        INSERT INTO public.daily_user_stats_snapshot
            (user_id, snapshot_date, timeframe, game_mode,
             elementle_rating, games_played, games_won, win_rate,
             avg_guesses, max_streak, current_streak)
        VALUES
            (v_rec.user_id, v_yesterday, 'mtd', 'region',
             v_result_r_mtd.elementle_rating, v_result_r_mtd.games_played,
             v_result_r_mtd.games_won, v_result_r_mtd.win_rate,
             v_result_r_mtd.avg_guesses, v_result_r_mtd.max_streak,
             v_result_r_mtd.current_streak),
            (v_rec.user_id, v_yesterday, 'ytd', 'region',
             v_result_r_ytd.elementle_rating, v_result_r_ytd.games_played,
             v_result_r_ytd.games_won, v_result_r_ytd.win_rate,
             v_result_r_ytd.avg_guesses, v_result_r_ytd.max_streak,
             v_result_r_ytd.current_streak)
        ON CONFLICT (user_id, snapshot_date, timeframe, game_mode) DO NOTHING;

        -- Freeze user mode stats
        SELECT * INTO v_result_u_mtd
        FROM public.calculate_user_league_rating_user_mode(v_rec.user_id, 'mtd', v_yesterday);
        SELECT * INTO v_result_u_ytd
        FROM public.calculate_user_league_rating_user_mode(v_rec.user_id, 'ytd', v_yesterday);

        INSERT INTO public.daily_user_stats_snapshot
            (user_id, snapshot_date, timeframe, game_mode,
             elementle_rating, games_played, games_won, win_rate,
             avg_guesses, max_streak, current_streak)
        VALUES
            (v_rec.user_id, v_yesterday, 'mtd', 'user',
             v_result_u_mtd.elementle_rating, v_result_u_mtd.games_played,
             v_result_u_mtd.games_won, v_result_u_mtd.win_rate,
             v_result_u_mtd.avg_guesses, v_result_u_mtd.max_streak,
             v_result_u_mtd.current_streak),
            (v_rec.user_id, v_yesterday, 'ytd', 'user',
             v_result_u_ytd.elementle_rating, v_result_u_ytd.games_played,
             v_result_u_ytd.games_won, v_result_u_ytd.win_rate,
             v_result_u_ytd.avg_guesses, v_result_u_ytd.max_streak,
             v_result_u_ytd.current_streak)
        ON CONFLICT (user_id, snapshot_date, timeframe, game_mode) DO NOTHING;

        -- Also refresh live standings (for decay in Live view)
        PERFORM public.refresh_user_league_standings(v_rec.user_id, v_rec.region, 'region');
        PERFORM public.refresh_user_league_standings(v_rec.user_id, 'GLOBAL', 'user');

        v_users_frozen := v_users_frozen + 1;
    END LOOP;

    -- ─────────────────────────────────────────────────────────────────────
    -- PHASE 2: Rank leagues at each league's local midnight
    -- ─────────────────────────────────────────────────────────────────────
    FOR v_league IN
        SELECT id, timezone, last_snapshot_date FROM public.leagues
    LOOP
        v_league_tz        := v_league.timezone;
        v_local_now        := (now() AT TIME ZONE v_league_tz);
        v_league_yesterday := v_local_now::date - 1;

        -- Skip if already snapshotted for this league's yesterday
        IF v_league.last_snapshot_date IS NOT NULL
           AND v_league.last_snapshot_date >= v_league_yesterday THEN
            CONTINUE;
        END IF;

        -- Rank all members for this league's yesterday
        INSERT INTO public.daily_league_rank_snapshot
            (league_id, user_id, snapshot_date, timeframe, game_mode, rank)
        SELECT
            v_league.id,
            member_stats.user_id,
            v_league_yesterday,
            member_stats.timeframe,
            member_stats.game_mode,
            RANK() OVER (
                PARTITION BY member_stats.timeframe, member_stats.game_mode
                ORDER BY member_stats.elementle_rating DESC,
                         member_stats.games_played DESC,
                         member_stats.avg_guesses ASC
            )
        FROM (
            SELECT
                lm.user_id,
                tf.timeframe,
                gm.game_mode,
                COALESCE(ls.elementle_rating, 0) AS elementle_rating,
                COALESCE(ls.current_streak, 0) AS current_streak,
                COALESCE(ls.games_played, 0) AS games_played,
                COALESCE(ls.avg_guesses, 0) AS avg_guesses
            FROM public.league_members lm
            CROSS JOIN (VALUES ('mtd'), ('ytd')) AS tf(timeframe)
            CROSS JOIN (VALUES ('region'), ('user')) AS gm(game_mode)
            LEFT JOIN public.daily_user_stats_snapshot ls
                ON ls.user_id = lm.user_id
               AND ls.snapshot_date = v_league_yesterday
               AND ls.timeframe = tf.timeframe
               AND ls.game_mode = gm.game_mode
            WHERE lm.league_id = v_league.id
              AND CASE WHEN gm.game_mode = 'user'
                       THEN lm.is_active_user
                       ELSE lm.is_active_region END = true
        ) member_stats
        ON CONFLICT (league_id, user_id, snapshot_date, timeframe, game_mode)
        DO UPDATE SET rank = EXCLUDED.rank;

        -- Mark league as snapshotted
        UPDATE public.leagues
        SET last_snapshot_date = v_league_yesterday
        WHERE id = v_league.id;

        v_leagues_ranked := v_leagues_ranked + 1;
    END LOOP;

    -- ─────────────────────────────────────────────────────────────────────
    -- PHASE 3: Prune old daily snapshots (keep 12 months + end-of-month)
    --
    -- Rules:
    --   • Delete rows older than 367 days (12 months, leap-safe)
    --   • NEVER delete rows where snapshot_date is the last day of a month
    --     (these are permanent archives for monthly/yearly trophies)
    -- ─────────────────────────────────────────────────────────────────────
    DELETE FROM public.daily_user_stats_snapshot
    WHERE snapshot_date < CURRENT_DATE - 367
      AND EXTRACT(day FROM snapshot_date + INTERVAL '1 day') <> 1;
    GET DIAGNOSTICS v_pruned_stats = ROW_COUNT;

    DELETE FROM public.daily_league_rank_snapshot
    WHERE snapshot_date < CURRENT_DATE - 367
      AND EXTRACT(day FROM snapshot_date + INTERVAL '1 day') <> 1;
    GET DIAGNOSTICS v_pruned_ranks = ROW_COUNT;

    RETURN jsonb_build_object(
        'users_frozen',    v_users_frozen,
        'leagues_ranked',  v_leagues_ranked,
        'pruned_stats',    v_pruned_stats,
        'pruned_ranks',    v_pruned_ranks,
        'started_at',      v_start,
        'finished_at',     clock_timestamp()
    );
END;
$fn_snapshots$;
