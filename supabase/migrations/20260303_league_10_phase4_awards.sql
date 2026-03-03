-- ============================================================================
-- PHASE 4: End-of-Period Awards System
--
-- Tables:
--   1. league_awards           — Gold/Silver/Bronze per league per period
--   2. global_percentile_awards — Percentile badges from Global League
--
-- Functions:
--   3. grant_period_awards()        — medals + percentile calculation
--   4. get_historical_standings()   — read from snapshot
--   5. get_league_standings() v3    — blind phase logic + is_historical flag
--   6. get_my_awards()              — user's medals & badges
--   7. cleanup_old_standings()      — hard delete MTD live data
--   8. prune_old_snapshots()        — DB hygiene
--
-- pg_cron:
--   9. Noon UTC pipeline (snapshot → awards → cleanup → prune)
--
-- Run in Supabase SQL Editor.
-- ============================================================================


-- ─── 1. league_awards ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.league_awards (
    id               bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    league_id        uuid NOT NULL REFERENCES public.leagues(id) ON DELETE CASCADE,
    user_id          uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    timeframe        text NOT NULL CHECK (timeframe IN ('mtd', 'ytd')),
    period_label     text NOT NULL,          -- e.g. '2026-03', '2026'
    medal            text NOT NULL CHECK (medal IN ('gold', 'silver', 'bronze')),
    elementle_rating numeric,
    awarded_at       timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT uq_league_award UNIQUE (league_id, user_id, timeframe, period_label)
);

CREATE INDEX IF NOT EXISTS idx_league_awards_user
    ON public.league_awards (user_id, timeframe, period_label);

COMMENT ON TABLE public.league_awards IS 'Permanent medal records — Gold/Silver/Bronze for top-3 per league per period';

ALTER TABLE public.league_awards DISABLE ROW LEVEL SECURITY;


-- ─── 2. global_percentile_awards ────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.global_percentile_awards (
    id               bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id          uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    timeframe        text NOT NULL CHECK (timeframe IN ('mtd', 'ytd')),
    period_label     text NOT NULL,          -- e.g. '2026-03', '2026'
    percentile_rank  numeric NOT NULL,       -- exact value, e.g. 4.7
    percentile_tier  text NOT NULL,          -- 'top_1','top_5','top_10','top_25','top_50','below_50'
    elementle_rating numeric,
    total_ranked     integer,
    awarded_at       timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT uq_global_percentile UNIQUE (user_id, timeframe, period_label)
);

CREATE INDEX IF NOT EXISTS idx_global_percentile_user
    ON public.global_percentile_awards (user_id, timeframe);

COMMENT ON TABLE public.global_percentile_awards
    IS 'Permanent percentile badges from the Global League only';

ALTER TABLE public.global_percentile_awards DISABLE ROW LEVEL SECURITY;


-- ─── 3. grant_period_awards ─────────────────────────────────────────────────
-- Called by pg_cron at 12:01 PM UTC on the 1st.
-- Reads from league_standings_snapshot (frozen at 12:00 PM UTC).
-- Grants medals to ranks 1-3 in every league,
-- and calculates percentile badges for the Global League.

CREATE OR REPLACE FUNCTION public.grant_period_awards(
    p_timeframe text,
    p_period_label text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $fn_grant_awards$
DECLARE
    v_global_league_id uuid;
    v_total_ranked integer;
    v_medals_inserted integer := 0;
    v_badges_inserted integer := 0;
BEGIN
    -- ── STEP 1: MEDALS (all leagues) ──
    -- Read ranks 1-3 from the snapshot and insert medals
    INSERT INTO public.league_awards
        (league_id, user_id, timeframe, period_label, medal, elementle_rating)
    SELECT
        s.league_id,
        s.user_id,
        p_timeframe,
        p_period_label,
        CASE s.rank
            WHEN 1 THEN 'gold'
            WHEN 2 THEN 'silver'
            WHEN 3 THEN 'bronze'
        END,
        s.elementle_rating
    FROM public.league_standings_snapshot s
    WHERE s.timeframe = p_timeframe
      AND s.period_label = p_period_label
      AND s.rank <= 3
      AND s.elementle_rating > 0   -- Must have actually played
    ON CONFLICT (league_id, user_id, timeframe, period_label) DO NOTHING;

    GET DIAGNOSTICS v_medals_inserted = ROW_COUNT;

    -- ── STEP 2: GLOBAL PERCENTILE BADGES ──
    -- Find the Global League (system league with system_region = 'GLOBAL')
    SELECT id INTO v_global_league_id
    FROM public.leagues
    WHERE is_system_league = true AND system_region = 'GLOBAL'
    LIMIT 1;

    IF v_global_league_id IS NOT NULL THEN
        -- Count total ranked users in global league for this period
        SELECT COUNT(*) INTO v_total_ranked
        FROM public.league_standings_snapshot
        WHERE league_id = v_global_league_id
          AND timeframe = p_timeframe
          AND period_label = p_period_label
          AND elementle_rating > 0;

        IF v_total_ranked > 0 THEN
            INSERT INTO public.global_percentile_awards
                (user_id, timeframe, period_label, percentile_rank, percentile_tier,
                 elementle_rating, total_ranked)
            SELECT
                s.user_id,
                p_timeframe,
                p_period_label,
                ROUND((s.rank::numeric / v_total_ranked) * 100, 2) AS pct_rank,
                CASE
                    WHEN (s.rank::numeric / v_total_ranked) * 100 <= 1  THEN 'top_1'
                    WHEN (s.rank::numeric / v_total_ranked) * 100 <= 5  THEN 'top_5'
                    WHEN (s.rank::numeric / v_total_ranked) * 100 <= 10 THEN 'top_10'
                    WHEN (s.rank::numeric / v_total_ranked) * 100 <= 25 THEN 'top_25'
                    WHEN (s.rank::numeric / v_total_ranked) * 100 <= 50 THEN 'top_50'
                    ELSE 'below_50'
                END,
                s.elementle_rating,
                v_total_ranked
            FROM public.league_standings_snapshot s
            WHERE s.league_id = v_global_league_id
              AND s.timeframe = p_timeframe
              AND s.period_label = p_period_label
              AND s.elementle_rating > 0
            ON CONFLICT (user_id, timeframe, period_label) DO NOTHING;

            GET DIAGNOSTICS v_badges_inserted = ROW_COUNT;
        END IF;
    END IF;

    RETURN jsonb_build_object(
        'medals_inserted', v_medals_inserted,
        'badges_inserted', v_badges_inserted,
        'total_global_ranked', COALESCE(v_total_ranked, 0),
        'timeframe', p_timeframe,
        'period_label', p_period_label
    );
END;
$fn_grant_awards$;


-- ─── 4. get_historical_standings ────────────────────────────────────────────
-- Reads from league_standings_snapshot for a past period.

CREATE OR REPLACE FUNCTION public.get_historical_standings(
    p_league_id uuid,
    p_timeframe text,
    p_period_label text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $fn_hist_standings$
DECLARE
    v_user_id uuid := auth.uid();
    v_standings jsonb;
    v_my_rank integer;
    v_total integer;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required';
    END IF;

    -- Must be a member (active or inactive) to view historical data
    IF NOT EXISTS(
        SELECT 1 FROM public.league_members
        WHERE league_id = p_league_id AND user_id = v_user_id
    ) THEN
        RAISE EXCEPTION 'Not a member of this league';
    END IF;

    SELECT jsonb_agg(row_data ORDER BY (row_data->>'rank')::int)
    INTO v_standings
    FROM (
        SELECT jsonb_build_object(
            'rank', s.rank,
            'user_id', s.user_id,
            'league_nickname', COALESCE(lm.league_nickname, up.global_display_name, 'Player'),
            'global_display_name', COALESCE(up.global_display_name, up.first_name, 'Player'),
            'global_tag', COALESCE(up.global_tag, '#0000'),
            'elementle_rating', ROUND(COALESCE(s.elementle_rating, 0), 1),
            'current_streak', 0,      -- not tracked in snapshot
            'games_played', 0,        -- not tracked in snapshot
            'games_won', 0,           -- not tracked in snapshot
            'win_rate', 0,            -- not tracked in snapshot
            'avg_guesses', 0,         -- not tracked in snapshot
            'is_me', (s.user_id = v_user_id),
            'yesterdays_rank', NULL
        ) AS row_data
        FROM public.league_standings_snapshot s
        LEFT JOIN public.league_members lm
            ON lm.league_id = s.league_id AND lm.user_id = s.user_id
        LEFT JOIN public.user_profiles up
            ON up.id = s.user_id
        WHERE s.league_id = p_league_id
          AND s.timeframe = p_timeframe
          AND s.period_label = p_period_label
    ) ranked;

    -- My rank from snapshot
    SELECT (row_data->>'rank')::integer INTO v_my_rank
    FROM (
        SELECT jsonb_array_elements(v_standings) AS row_data
    ) t
    WHERE row_data->>'user_id' = v_user_id::text;

    v_total := COALESCE(jsonb_array_length(v_standings), 0);

    RETURN jsonb_build_object(
        'standings', COALESCE(v_standings, '[]'::jsonb),
        'my_rank', v_my_rank,
        'total_members', v_total,
        'is_historical', true,
        'period_label', p_period_label
    );
END;
$fn_hist_standings$;


-- ─── 5. get_league_standings v3 — with blind phase ─────────────────────────
-- If we're early in the period (day < min_games_for_cumulative_percentile),
-- return last period's snapshot instead of live data.

CREATE OR REPLACE FUNCTION public.get_league_standings(
    p_league_id uuid,
    p_timeframe text DEFAULT 'mtd'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $fn_standings_v3$
DECLARE
    v_user_id uuid := auth.uid();
    v_blind_threshold int;
    v_day_of_period int;
    v_prev_label text;
    v_standings jsonb;
    v_my_rank integer;
    v_total integer;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required';
    END IF;

    IF NOT EXISTS(
        SELECT 1 FROM public.league_members
        WHERE league_id = p_league_id AND user_id = v_user_id AND is_active = true
    ) THEN
        RAISE EXCEPTION 'Not a member of this league';
    END IF;

    -- ── Blind Phase Check ──
    SELECT COALESCE(
        (SELECT value::int FROM public.admin_settings WHERE key = 'min_games_for_cumulative_percentile'),
        5
    ) INTO v_blind_threshold;

    IF p_timeframe = 'mtd' THEN
        v_day_of_period := EXTRACT(day FROM CURRENT_DATE)::int;
        v_prev_label := TO_CHAR(CURRENT_DATE - INTERVAL '1 month', 'YYYY-MM');
    ELSE -- ytd
        v_day_of_period := EXTRACT(doy FROM CURRENT_DATE)::int;
        v_prev_label := TO_CHAR(CURRENT_DATE - INTERVAL '1 year', 'YYYY');
    END IF;

    -- If in blind phase, return previous period's snapshot
    IF v_day_of_period < v_blind_threshold THEN
        -- Check if snapshot exists for previous period
        IF EXISTS (
            SELECT 1 FROM public.league_standings_snapshot
            WHERE league_id = p_league_id
              AND timeframe = p_timeframe
              AND period_label = v_prev_label
        ) THEN
            RETURN public.get_historical_standings(p_league_id, p_timeframe, v_prev_label);
        END IF;
        -- If no snapshot exists (brand new league), fall through to live data
    END IF;

    -- ── Live Standings (normal path) ──
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
        'total_members', v_total,
        'is_historical', false
    );
END;
$fn_standings_v3$;


-- ─── 6. get_my_awards ──────────────────────────────────────────────────────
-- Returns all medals and percentile badges for the authenticated user.

CREATE OR REPLACE FUNCTION public.get_my_awards()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $fn_my_awards$
DECLARE
    v_user_id uuid := auth.uid();
    v_medals jsonb;
    v_badges jsonb;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required';
    END IF;

    -- Medals
    SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
            'league_id', la.league_id,
            'league_name', lg.name,
            'timeframe', la.timeframe,
            'period_label', la.period_label,
            'medal', la.medal,
            'elementle_rating', ROUND(COALESCE(la.elementle_rating, 0), 1),
            'awarded_at', la.awarded_at
        ) ORDER BY la.awarded_at DESC
    ), '[]'::jsonb)
    INTO v_medals
    FROM public.league_awards la
    JOIN public.leagues lg ON lg.id = la.league_id
    WHERE la.user_id = v_user_id;

    -- Global Percentile Badges
    SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
            'timeframe', gpa.timeframe,
            'period_label', gpa.period_label,
            'percentile_rank', gpa.percentile_rank,
            'percentile_tier', gpa.percentile_tier,
            'elementle_rating', ROUND(COALESCE(gpa.elementle_rating, 0), 1),
            'total_ranked', gpa.total_ranked,
            'awarded_at', gpa.awarded_at
        ) ORDER BY gpa.awarded_at DESC
    ), '[]'::jsonb)
    INTO v_badges
    FROM public.global_percentile_awards gpa
    WHERE gpa.user_id = v_user_id;

    RETURN jsonb_build_object(
        'medals', v_medals,
        'percentile_badges', v_badges
    );
END;
$fn_my_awards$;


-- ─── 7. cleanup_old_standings ───────────────────────────────────────────────
-- Hard deletes all MTD rows from league_standings_live.
-- The LEFT JOIN in get_league_standings handles zeros gracefully.
-- Called at 12:02 PM UTC on the 1st.

CREATE OR REPLACE FUNCTION public.cleanup_old_standings()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $fn_cleanup$
DECLARE
    v_deleted integer;
BEGIN
    DELETE FROM public.league_standings_live
    WHERE timeframe = 'mtd';

    GET DIAGNOSTICS v_deleted = ROW_COUNT;

    RETURN jsonb_build_object(
        'mtd_rows_deleted', v_deleted,
        'cleaned_at', now()
    );
END;
$fn_cleanup$;


-- ─── 8. prune_old_snapshots ─────────────────────────────────────────────────
-- Removes MTD snapshots older than 12 months and YTD snapshots older than 5 years.
-- Called at 12:03 PM UTC on the 1st.

CREATE OR REPLACE FUNCTION public.prune_old_snapshots()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $fn_prune$
DECLARE
    v_mtd_deleted integer;
    v_ytd_deleted integer;
    v_mtd_cutoff text;
    v_ytd_cutoff text;
BEGIN
    -- MTD cutoff: 12 months ago
    v_mtd_cutoff := TO_CHAR(CURRENT_DATE - INTERVAL '12 months', 'YYYY-MM');

    DELETE FROM public.league_standings_snapshot
    WHERE timeframe = 'mtd' AND period_label < v_mtd_cutoff;

    GET DIAGNOSTICS v_mtd_deleted = ROW_COUNT;

    -- YTD cutoff: 5 years ago
    v_ytd_cutoff := TO_CHAR(CURRENT_DATE - INTERVAL '5 years', 'YYYY');

    DELETE FROM public.league_standings_snapshot
    WHERE timeframe = 'ytd' AND period_label < v_ytd_cutoff;

    GET DIAGNOSTICS v_ytd_deleted = ROW_COUNT;

    RETURN jsonb_build_object(
        'mtd_snapshots_deleted', v_mtd_deleted,
        'ytd_snapshots_deleted', v_ytd_deleted,
        'mtd_cutoff', v_mtd_cutoff,
        'ytd_cutoff', v_ytd_cutoff,
        'pruned_at', now()
    );
END;
$fn_prune$;


-- ─── 9. pg_cron Schedule ───────────────────────────────────────────────────
-- Run these MANUALLY in Supabase SQL Editor (pg_cron must be enabled).
-- All execute sequentially at Noon UTC on the 1st of each month.

-- MONTHLY PIPELINE (every month)

-- 12:00 PM UTC — Snapshot MTD standings
SELECT cron.schedule(
    'snapshot-monthly-standings',
    '0 12 1 * *',
    $$SELECT public.snapshot_period_standings('mtd', TO_CHAR(NOW() - INTERVAL '1 day', 'YYYY-MM'))$$
);

-- 12:01 PM UTC — Grant MTD awards (medals + percentiles)
SELECT cron.schedule(
    'grant-monthly-awards',
    '1 12 1 * *',
    $$SELECT public.grant_period_awards('mtd', TO_CHAR(NOW() - INTERVAL '1 day', 'YYYY-MM'))$$
);

-- 12:02 PM UTC — Hard delete MTD standings
SELECT cron.schedule(
    'cleanup-monthly-standings',
    '2 12 1 * *',
    $$SELECT public.cleanup_old_standings()$$
);

-- 12:03 PM UTC — Prune old snapshots
SELECT cron.schedule(
    'prune-old-snapshots',
    '3 12 1 * *',
    $$SELECT public.prune_old_snapshots()$$
);


-- YEARLY PIPELINE (January only)

-- 12:00 PM UTC, Jan 1st — Snapshot YTD standings
SELECT cron.schedule(
    'snapshot-yearly-standings',
    '0 12 1 1 *',
    $$SELECT public.snapshot_period_standings('ytd', TO_CHAR(NOW() - INTERVAL '1 day', 'YYYY'))$$
);

-- 12:01 PM UTC, Jan 1st — Grant YTD awards
SELECT cron.schedule(
    'grant-yearly-awards',
    '1 12 1 1 *',
    $$SELECT public.grant_period_awards('ytd', TO_CHAR(NOW() - INTERVAL '1 day', 'YYYY'))$$
);

-- 12:02 PM UTC, Jan 1st — Hard delete YTD standings
SELECT cron.schedule(
    'cleanup-yearly-standings',
    '2 12 1 1 *',
    $$DELETE FROM public.league_standings_live WHERE timeframe = 'ytd'$$
);
