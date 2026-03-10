-- ============================================================================
-- GLOBAL LEAGUE BACKFILL: 2025-11-01 → 2026-03-09
--
-- This script:
--   1. Clears existing snapshot data for the Global League in the date range
--   2. Backfills daily_user_stats_snapshot + daily_league_rank_snapshot for
--      every day, for both Region and User game modes, both MTD and YTD
--   3. Creates end-of-period snapshots in league_standings_snapshot for each
--      completed month (Nov 2025, Dec 2025, Jan 2026, Feb 2026) and year (2025)
--   4. Awards gold/silver/bronze trophies to monthly and annual top 3
--
-- Holiday Mode: Automatically handled — calculate_user_league_rating and
-- calculate_user_league_rating_user_mode both filter g.result IN ('won','lost'),
-- so Holiday Mode rows (result = 'active' or NULL) are excluded.
--
-- Safe to re-run — uses ON CONFLICT.
-- ============================================================================


-- ─── Step A: Clear existing backfill data for Global League ─────────────────

DO $$
DECLARE
    v_global_league_id uuid;
BEGIN
    SELECT id INTO v_global_league_id
    FROM public.leagues
    WHERE is_system_league = true AND system_region = 'GLOBAL'
    LIMIT 1;

    IF v_global_league_id IS NULL THEN
        RAISE EXCEPTION 'Global league not found!';
    END IF;

    -- Clear league rank snapshots
    DELETE FROM public.daily_league_rank_snapshot
    WHERE league_id = v_global_league_id
      AND snapshot_date BETWEEN '2025-11-01' AND '2026-03-09';

    -- Clear user stats snapshots (for users in Global league only)
    DELETE FROM public.daily_user_stats_snapshot
    WHERE user_id IN (
        SELECT user_id FROM public.league_members WHERE league_id = v_global_league_id
    )
    AND snapshot_date BETWEEN '2025-11-01' AND '2026-03-09';

    -- Clear end-of-period snapshots for Global league
    DELETE FROM public.league_standings_snapshot
    WHERE league_id = v_global_league_id
      AND period_label IN ('2025-11','2025-12','2026-01','2026-02','2025');

    -- Clear existing awards for Global league in these periods
    DELETE FROM public.league_awards
    WHERE league_id = v_global_league_id
      AND period_label IN ('2025-11','2025-12','2026-01','2026-02','2025');

    RAISE NOTICE 'Cleared existing data for Global League %', v_global_league_id;
END $$;


-- ─── Step B: Backfill daily snapshots ──────────────────────────────────────

DO $$
DECLARE
    snap_date           DATE;
    v_rec               RECORD;
    v_result_r_mtd      RECORD;
    v_result_r_ytd      RECORD;
    v_result_u_mtd      RECORD;
    v_result_u_ytd      RECORD;
    v_global_league_id  uuid;
    v_min_games         INT;
    v_day_count         INT := 0;
BEGIN
    -- Get Global league ID
    SELECT id INTO v_global_league_id
    FROM public.leagues
    WHERE is_system_league = true AND system_region = 'GLOBAL'
    LIMIT 1;

    IF v_global_league_id IS NULL THEN
        RAISE EXCEPTION 'Global league not found!';
    END IF;

    -- Get min games threshold
    SELECT COALESCE(
        (SELECT value::int FROM admin_settings WHERE key = 'min_games_for_cumulative_percentile'), 5
    ) INTO v_min_games;

    RAISE NOTICE 'Starting backfill for Global League %, min_games = %', v_global_league_id, v_min_games;

    -- Loop through each day from 2025-11-01 to 2026-03-09
    FOR snap_date IN SELECT generate_series('2025-11-01'::date, '2026-03-09'::date, '1 day'::interval)::date
    LOOP
        v_day_count := v_day_count + 1;
        IF v_day_count % 10 = 0 THEN
            RAISE NOTICE 'Processing day % (%)', v_day_count, snap_date;
        END IF;

        -- Phase 1: Calculate each Global league member's stats as of snap_date
        FOR v_rec IN
            SELECT DISTINCT lm.user_id, COALESCE(up.region, 'UK') AS region
            FROM public.league_members lm
            JOIN public.user_profiles up ON up.id = lm.user_id
            WHERE lm.league_id = v_global_league_id
        LOOP
            -- ── Region mode ──
            SELECT * INTO v_result_r_mtd
            FROM public.calculate_user_league_rating(v_rec.user_id, v_rec.region, 'mtd'::text, snap_date);
            SELECT * INTO v_result_r_ytd
            FROM public.calculate_user_league_rating(v_rec.user_id, v_rec.region, 'ytd'::text, snap_date);

            INSERT INTO public.daily_user_stats_snapshot
                (user_id, snapshot_date, timeframe, game_mode,
                 elementle_rating, games_played, games_won, win_rate,
                 avg_guesses, max_streak, current_streak)
            VALUES
                (v_rec.user_id, snap_date, 'mtd', 'region',
                 v_result_r_mtd.elementle_rating, v_result_r_mtd.games_played,
                 v_result_r_mtd.games_won, v_result_r_mtd.win_rate,
                 v_result_r_mtd.avg_guesses, v_result_r_mtd.max_streak,
                 v_result_r_mtd.current_streak),
                (v_rec.user_id, snap_date, 'ytd', 'region',
                 v_result_r_ytd.elementle_rating, v_result_r_ytd.games_played,
                 v_result_r_ytd.games_won, v_result_r_ytd.win_rate,
                 v_result_r_ytd.avg_guesses, v_result_r_ytd.max_streak,
                 v_result_r_ytd.current_streak)
            ON CONFLICT (user_id, snapshot_date, timeframe, game_mode) DO NOTHING;

            -- ── User mode ──
            SELECT * INTO v_result_u_mtd
            FROM public.calculate_user_league_rating_user_mode(v_rec.user_id, 'mtd'::text, snap_date);
            SELECT * INTO v_result_u_ytd
            FROM public.calculate_user_league_rating_user_mode(v_rec.user_id, 'ytd'::text, snap_date);

            INSERT INTO public.daily_user_stats_snapshot
                (user_id, snapshot_date, timeframe, game_mode,
                 elementle_rating, games_played, games_won, win_rate,
                 avg_guesses, max_streak, current_streak)
            VALUES
                (v_rec.user_id, snap_date, 'mtd', 'user',
                 v_result_u_mtd.elementle_rating, v_result_u_mtd.games_played,
                 v_result_u_mtd.games_won, v_result_u_mtd.win_rate,
                 v_result_u_mtd.avg_guesses, v_result_u_mtd.max_streak,
                 v_result_u_mtd.current_streak),
                (v_rec.user_id, snap_date, 'ytd', 'user',
                 v_result_u_ytd.elementle_rating, v_result_u_ytd.games_played,
                 v_result_u_ytd.games_won, v_result_u_ytd.win_rate,
                 v_result_u_ytd.avg_guesses, v_result_u_ytd.max_streak,
                 v_result_u_ytd.current_streak)
            ON CONFLICT (user_id, snapshot_date, timeframe, game_mode) DO NOTHING;
        END LOOP;

        -- Phase 2: Rank Global league members (only users with >= min_games)
        INSERT INTO public.daily_league_rank_snapshot
            (league_id, user_id, snapshot_date, timeframe, game_mode, rank)
        SELECT
            v_global_league_id,
            member_stats.user_id,
            snap_date,
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
                COALESCE(ds.elementle_rating, 0) AS elementle_rating,
                COALESCE(ds.current_streak, 0) AS current_streak,
                COALESCE(ds.games_played, 0) AS games_played,
                COALESCE(ds.avg_guesses, 0) AS avg_guesses
            FROM public.league_members lm
            CROSS JOIN (VALUES ('mtd'), ('ytd')) AS tf(timeframe)
            CROSS JOIN (VALUES ('region'), ('user')) AS gm(game_mode)
            LEFT JOIN public.daily_user_stats_snapshot ds
                ON ds.user_id = lm.user_id
               AND ds.snapshot_date = snap_date
               AND ds.timeframe = tf.timeframe
               AND ds.game_mode = gm.game_mode
            WHERE lm.league_id = v_global_league_id
              AND COALESCE(ds.games_played, 0) >= v_min_games
        ) member_stats
        ON CONFLICT (league_id, user_id, snapshot_date, timeframe, game_mode)
        DO UPDATE SET rank = EXCLUDED.rank;

    END LOOP;

    RAISE NOTICE 'Daily snapshot backfill complete! Processed % days.', v_day_count;
END $$;


-- ─── Step C: Create end-of-period snapshots (league_standings_snapshot) ──────
-- These are the "frozen" standings used to display medals for completed months.
-- We use the last day of each month's daily snapshot data.

DO $$
DECLARE
    v_global_league_id  uuid;
    v_period            RECORD;
    v_min_games         INT;
BEGIN
    SELECT id INTO v_global_league_id
    FROM public.leagues
    WHERE is_system_league = true AND system_region = 'GLOBAL'
    LIMIT 1;

    SELECT COALESCE(
        (SELECT value::int FROM admin_settings WHERE key = 'min_games_for_cumulative_percentile'), 5
    ) INTO v_min_games;

    -- Process each completed month
    FOR v_period IN
        SELECT * FROM (VALUES
            ('2025-11', '2025-11-30'::date, 'mtd'),
            ('2025-12', '2025-12-31'::date, 'mtd'),
            ('2026-01', '2026-01-31'::date, 'mtd'),
            ('2026-02', '2026-02-28'::date, 'mtd'),
            ('2025',    '2025-12-31'::date, 'ytd')
        ) AS t(period_label, last_day, timeframe)
    LOOP
        RAISE NOTICE 'Creating end-of-period snapshot for % (% on %)',
            v_period.period_label, v_period.timeframe, v_period.last_day;

        -- Insert for BOTH game modes (region & user)
        INSERT INTO public.league_standings_snapshot
            (league_id, user_id, timeframe, period_label, game_mode, elementle_rating, rank, frozen_at)
        SELECT
            v_global_league_id,
            ranked.user_id,
            v_period.timeframe,
            v_period.period_label,
            ranked.game_mode,
            ranked.elementle_rating,
            ranked.final_rank,
            (v_period.last_day + INTERVAL '1 day' + INTERVAL '12 hours')::timestamptz
        FROM (
            SELECT
                dr.user_id,
                dr.game_mode,
                ds.elementle_rating,
                dr.rank AS final_rank
            FROM public.daily_league_rank_snapshot dr
            JOIN public.daily_user_stats_snapshot ds
                ON ds.user_id = dr.user_id
               AND ds.snapshot_date = dr.snapshot_date
               AND ds.timeframe = dr.timeframe
               AND ds.game_mode = dr.game_mode
            WHERE dr.league_id = v_global_league_id
              AND dr.snapshot_date = v_period.last_day
              AND dr.timeframe = v_period.timeframe
              AND COALESCE(ds.games_played, 0) >= v_min_games
        ) ranked
        ON CONFLICT (league_id, user_id, timeframe, period_label, game_mode)
        DO UPDATE SET
            elementle_rating = EXCLUDED.elementle_rating,
            rank = EXCLUDED.rank,
            frozen_at = EXCLUDED.frozen_at;
    END LOOP;

    RAISE NOTICE 'End-of-period snapshots complete!';
END $$;


-- ─── Step D: Award trophies (gold/silver/bronze) for monthly and annual top 3 ──

DO $$
DECLARE
    v_global_league_id  uuid;
    v_period            RECORD;
BEGIN
    SELECT id INTO v_global_league_id
    FROM public.leagues
    WHERE is_system_league = true AND system_region = 'GLOBAL'
    LIMIT 1;

    -- Award medals for each completed period
    FOR v_period IN
        SELECT * FROM (VALUES
            ('2025-11', 'mtd'),
            ('2025-12', 'mtd'),
            ('2026-01', 'mtd'),
            ('2026-02', 'mtd'),
            ('2025',    'ytd')
        ) AS t(period_label, timeframe)
    LOOP
        RAISE NOTICE 'Awarding trophies for period % (%)', v_period.period_label, v_period.timeframe;

        -- Award for BOTH game modes
        INSERT INTO public.league_awards
            (league_id, user_id, timeframe, period_label, game_mode, medal, elementle_rating, awarded_at)
        SELECT
            v_global_league_id,
            s.user_id,
            v_period.timeframe,
            v_period.period_label,
            s.game_mode,
            CASE s.rank
                WHEN 1 THEN 'gold'
                WHEN 2 THEN 'silver'
                WHEN 3 THEN 'bronze'
            END,
            s.elementle_rating,
            s.frozen_at + INTERVAL '1 minute'
        FROM public.league_standings_snapshot s
        WHERE s.league_id = v_global_league_id
          AND s.timeframe = v_period.timeframe
          AND s.period_label = v_period.period_label
          AND s.rank <= 3
          AND s.elementle_rating > 0
        ON CONFLICT (league_id, user_id, timeframe, period_label, game_mode)
        DO UPDATE SET
            medal = EXCLUDED.medal,
            elementle_rating = EXCLUDED.elementle_rating,
            awarded_at = EXCLUDED.awarded_at;
    END LOOP;

    RAISE NOTICE 'Trophy awards complete!';
END $$;


-- ─── Step E: Verification queries ──────────────────────────────────────────

-- Check daily snapshot counts per month
SELECT
    TO_CHAR(snapshot_date, 'YYYY-MM') AS month,
    game_mode,
    COUNT(DISTINCT snapshot_date) AS days_with_data,
    COUNT(*) AS total_rows
FROM public.daily_league_rank_snapshot
WHERE league_id = (SELECT id FROM public.leagues WHERE is_system_league = true AND system_region = 'GLOBAL' LIMIT 1)
  AND timeframe = 'mtd'
GROUP BY 1, 2
ORDER BY 1, 2;

-- Check end-of-period snapshots
SELECT
    period_label,
    game_mode,
    timeframe,
    COUNT(*) AS members_ranked,
    MIN(rank) AS min_rank,
    MAX(rank) AS max_rank
FROM public.league_standings_snapshot
WHERE league_id = (SELECT id FROM public.leagues WHERE is_system_league = true AND system_region = 'GLOBAL' LIMIT 1)
  AND period_label IN ('2025-11','2025-12','2026-01','2026-02','2025')
GROUP BY 1, 2, 3
ORDER BY 1, 2, 3;

-- Check awarded trophies
SELECT
    la.period_label,
    la.game_mode,
    la.timeframe,
    la.medal,
    COALESCE(up.global_display_name, up.first_name, 'Player') AS display_name,
    la.elementle_rating
FROM public.league_awards la
LEFT JOIN public.user_profiles up ON up.id = la.user_id
WHERE la.league_id = (SELECT id FROM public.leagues WHERE is_system_league = true AND system_region = 'GLOBAL' LIMIT 1)
  AND la.period_label IN ('2025-11','2025-12','2026-01','2026-02','2025')
ORDER BY la.period_label, la.game_mode, la.timeframe,
    CASE la.medal WHEN 'gold' THEN 1 WHEN 'silver' THEN 2 WHEN 'bronze' THEN 3 END;
