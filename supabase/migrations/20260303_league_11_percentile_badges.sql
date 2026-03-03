-- ============================================================================
-- PHASE 4 ADDON: Refactored allocate_monthly_percentile_badges
--
-- Replaces the broken legacy function that read from user_stats_user/region.
-- Now calculates percentiles dynamically from league_standings_snapshot,
-- matching badge thresholds in the badges table (category = 'Percentile'),
-- and upserts into user_badges with is_awarded = false (triggers frontend popup).
--
-- Run in Supabase SQL Editor AFTER 20260303_league_10_phase4_awards.sql.
-- ============================================================================


CREATE OR REPLACE FUNCTION public.allocate_monthly_percentile_badges(
    p_timeframe text,
    p_period_label text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $fn_alloc_pctile$
DECLARE
    v_league record;
    v_total_users integer;
    v_user record;
    v_percentile numeric;
    v_best_threshold integer;
    v_badge_id integer;
    v_existing_id integer;
    v_game_type text;
    v_badge_region text;
    v_global_badges_awarded integer := 0;
    v_regional_badges_awarded integer := 0;
BEGIN

    -- ─── PART 1: GLOBAL (USER) PERCENTILE BADGES ────────────────────────
    -- Find the Global System League
    FOR v_league IN
        SELECT id, system_region
        FROM public.leagues
        WHERE is_system_league = true AND system_region = 'GLOBAL'
    LOOP
        v_game_type := 'USER';
        v_badge_region := 'GLOBAL';

        -- Count total ranked users in this snapshot
        SELECT COUNT(*) INTO v_total_users
        FROM public.league_standings_snapshot
        WHERE league_id = v_league.id
          AND timeframe = p_timeframe
          AND period_label = p_period_label
          AND elementle_rating > 0;

        IF v_total_users = 0 THEN
            CONTINUE;
        END IF;

        -- Iterate through every ranked user in the snapshot
        FOR v_user IN
            SELECT user_id, rank, elementle_rating
            FROM public.league_standings_snapshot
            WHERE league_id = v_league.id
              AND timeframe = p_timeframe
              AND period_label = p_period_label
              AND elementle_rating > 0
        LOOP
            -- Calculate percentile: (rank / total) * 100
            v_percentile := (v_user.rank::numeric / v_total_users) * 100;

            -- Find the best (lowest) badge threshold the user qualifies for
            -- Percentile badges: threshold >= calculated percentile (e.g. top 5% badge for 4.7%)
            SELECT MIN(threshold) INTO v_best_threshold
            FROM public.badges
            WHERE LOWER(category) = 'percentile'
              AND threshold >= v_percentile;

            IF v_best_threshold IS NULL THEN
                CONTINUE; -- No badge earned (below 50%)
            END IF;

            -- Get the badge_id for this threshold
            SELECT b.id INTO v_badge_id
            FROM public.badges b
            WHERE LOWER(b.category) = 'percentile'
              AND b.threshold = v_best_threshold;

            IF v_badge_id IS NULL THEN
                CONTINUE;
            END IF;

            -- Upsert into user_badges
            SELECT ub.id INTO v_existing_id
            FROM public.user_badges ub
            WHERE ub.user_id = v_user.user_id
              AND ub.badge_id = v_badge_id
              AND ub.game_type = v_game_type
              AND ub.region = v_badge_region;

            IF v_existing_id IS NOT NULL THEN
                -- Increment count, reset is_awarded to trigger popup
                UPDATE public.user_badges
                SET badge_count = badge_count + 1,
                    is_awarded = false,
                    awarded_at = now()
                WHERE id = v_existing_id;
            ELSE
                -- Insert new badge record
                INSERT INTO public.user_badges
                    (user_id, badge_id, game_type, region, badge_count, is_awarded, awarded_at)
                VALUES
                    (v_user.user_id, v_badge_id, v_game_type, v_badge_region, 1, false, now());
            END IF;

            v_global_badges_awarded := v_global_badges_awarded + 1;
        END LOOP;
    END LOOP;


    -- ─── PART 2: REGIONAL PERCENTILE BADGES ─────────────────────────────
    -- Iterate through all Regional System Leagues (e.g. UK)
    FOR v_league IN
        SELECT id, system_region
        FROM public.leagues
        WHERE is_system_league = true
          AND system_region IS NOT NULL
          AND system_region <> 'GLOBAL'
    LOOP
        v_game_type := 'REGION';
        v_badge_region := v_league.system_region;

        -- Count total ranked users in this regional snapshot
        SELECT COUNT(*) INTO v_total_users
        FROM public.league_standings_snapshot
        WHERE league_id = v_league.id
          AND timeframe = p_timeframe
          AND period_label = p_period_label
          AND elementle_rating > 0;

        IF v_total_users = 0 THEN
            CONTINUE;
        END IF;

        -- Iterate through every ranked user in the snapshot
        FOR v_user IN
            SELECT user_id, rank, elementle_rating
            FROM public.league_standings_snapshot
            WHERE league_id = v_league.id
              AND timeframe = p_timeframe
              AND period_label = p_period_label
              AND elementle_rating > 0
        LOOP
            v_percentile := (v_user.rank::numeric / v_total_users) * 100;

            SELECT MIN(threshold) INTO v_best_threshold
            FROM public.badges
            WHERE LOWER(category) = 'percentile'
              AND threshold >= v_percentile;

            IF v_best_threshold IS NULL THEN
                CONTINUE;
            END IF;

            SELECT b.id INTO v_badge_id
            FROM public.badges b
            WHERE LOWER(b.category) = 'percentile'
              AND b.threshold = v_best_threshold;

            IF v_badge_id IS NULL THEN
                CONTINUE;
            END IF;

            SELECT ub.id INTO v_existing_id
            FROM public.user_badges ub
            WHERE ub.user_id = v_user.user_id
              AND ub.badge_id = v_badge_id
              AND ub.game_type = v_game_type
              AND ub.region = v_badge_region;

            IF v_existing_id IS NOT NULL THEN
                UPDATE public.user_badges
                SET badge_count = badge_count + 1,
                    is_awarded = false,
                    awarded_at = now()
                WHERE id = v_existing_id;
            ELSE
                INSERT INTO public.user_badges
                    (user_id, badge_id, game_type, region, badge_count, is_awarded, awarded_at)
                VALUES
                    (v_user.user_id, v_badge_id, v_game_type, v_badge_region, 1, false, now());
            END IF;

            v_regional_badges_awarded := v_regional_badges_awarded + 1;
        END LOOP;
    END LOOP;


    RETURN jsonb_build_object(
        'global_badges_awarded', v_global_badges_awarded,
        'regional_badges_awarded', v_regional_badges_awarded,
        'timeframe', p_timeframe,
        'period_label', p_period_label
    );
END;
$fn_alloc_pctile$;


-- ─── pg_cron: Add to Noon UTC pipeline ──────────────────────────────────
-- Runs at 12:01 PM UTC on the 1st (alongside grant_period_awards).

SELECT cron.schedule(
    'allocate-monthly-percentile-badges',
    '1 12 1 * *',
    $$SELECT public.allocate_monthly_percentile_badges('mtd', TO_CHAR(NOW() - INTERVAL '1 day', 'YYYY-MM'))$$
);

-- January only: YTD percentile badges
SELECT cron.schedule(
    'allocate-yearly-percentile-badges',
    '1 12 1 1 *',
    $$SELECT public.allocate_monthly_percentile_badges('ytd', TO_CHAR(NOW() - INTERVAL '1 day', 'YYYY'))$$
);
