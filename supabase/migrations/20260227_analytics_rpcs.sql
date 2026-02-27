-- ═══════════════════════════════════════════════════════════════
-- Analytics Dashboard: Postgres RPCs
-- Two SECURITY DEFINER functions for dashboard data aggregation
-- Run in Supabase SQL Editor AFTER 20260227_analytics_schema.sql
-- ═══════════════════════════════════════════════════════════════


-- ─── 1. admin_dashboard_metrics ──────────────────────────────
-- Returns a single JSONB payload with all dashboard KPIs.
-- Parameters:
--   p_start  DATE  — Start of period (inclusive)
--   p_end    DATE  — End of period (inclusive)
--   p_region TEXT  — Region code filter, or NULL for all regions

CREATE OR REPLACE FUNCTION public.admin_dashboard_metrics(
    p_start DATE,
    p_end   DATE,
    p_region TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_signups           BIGINT;
    v_unique_users      BIGINT;
    v_unique_guests     BIGINT;
    v_games_region      BIGINT;
    v_games_user        BIGINT;
    v_avg_guesses       NUMERIC;
    v_guess_dist        JSONB;
    v_badges_awarded    BIGINT;
    v_ads_watched       BIGINT;
    v_pro_signups       BIGINT;
    v_active_pro        BIGINT;
    v_auto_renew_pct    NUMERIC;
    v_sub_distribution  JSONB;
    v_mrr               NUMERIC;
    v_ltv               NUMERIC;
    v_conversion_rate   NUMERIC;
    v_ad_revenue        NUMERIC;
    v_sub_revenue       NUMERIC;
    v_total_revenue     NUMERIC;
    v_total_players     BIGINT;
    v_total_users       BIGINT;
    v_total_sub_revenue NUMERIC;
    v_interstitial_ecpm NUMERIC;
    v_banner_ecpm       NUMERIC;
BEGIN
    -- Security guard
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'Unauthorized: admin access required';
    END IF;

    -- ── PLAYER METRICS ──────────────────────────────────────

    -- Signups in period
    SELECT COUNT(*)
    INTO v_signups
    FROM public.user_profiles
    WHERE created_at::date BETWEEN p_start AND p_end
    AND (p_region IS NULL OR region = p_region);

    -- Unique registered users who played (region mode)
    SELECT COUNT(DISTINCT gar.user_id)
    INTO v_unique_users
    FROM public.game_attempts_region gar
    LEFT JOIN public.questions_allocated_region qar ON qar.id = gar.allocated_region_id
    WHERE gar.user_id IS NOT NULL
    AND gar.started_at::date BETWEEN p_start AND p_end
    AND (p_region IS NULL OR qar.region = p_region);

    -- Add unique users from user mode
    v_unique_users := v_unique_users + (
        SELECT COUNT(DISTINCT gau.user_id)
        FROM public.game_attempts_user gau
        WHERE gau.started_at::date BETWEEN p_start AND p_end
        -- User mode is not region-filtered
        AND (p_region IS NULL)
    );

    -- Unique guests who played
    SELECT COUNT(DISTINCT gar.guest_id)
    INTO v_unique_guests
    FROM public.game_attempts_region gar
    LEFT JOIN public.questions_allocated_region qar ON qar.id = gar.allocated_region_id
    WHERE gar.guest_id IS NOT NULL
    AND gar.started_at::date BETWEEN p_start AND p_end
    AND (p_region IS NULL OR qar.region = p_region);


    -- ── GAME METRICS ────────────────────────────────────────

    -- Total games: region mode
    SELECT COUNT(*)
    INTO v_games_region
    FROM public.game_attempts_region gar
    LEFT JOIN public.questions_allocated_region qar ON qar.id = gar.allocated_region_id
    WHERE gar.started_at::date BETWEEN p_start AND p_end
    AND (p_region IS NULL OR qar.region = p_region);

    -- Total games: user mode
    SELECT COUNT(*)
    INTO v_games_user
    FROM public.game_attempts_user gau
    WHERE gau.started_at::date BETWEEN p_start AND p_end
    AND (p_region IS NULL);

    -- Average guesses (wins only, both modes combined)
    SELECT ROUND(AVG(num_guesses), 2)
    INTO v_avg_guesses
    FROM (
        SELECT num_guesses FROM public.game_attempts_region gar
        LEFT JOIN public.questions_allocated_region qar ON qar.id = gar.allocated_region_id
        WHERE result = 'won'
        AND gar.started_at::date BETWEEN p_start AND p_end
        AND (p_region IS NULL OR qar.region = p_region)
        UNION ALL
        SELECT num_guesses FROM public.game_attempts_user
        WHERE result = 'won'
        AND started_at::date BETWEEN p_start AND p_end
        AND (p_region IS NULL)
    ) combined;

    -- Guess distribution (1–6+ buckets, wins only)
    SELECT jsonb_build_object(
        '1', COALESCE(SUM(CASE WHEN ng = 1 THEN cnt END), 0),
        '2', COALESCE(SUM(CASE WHEN ng = 2 THEN cnt END), 0),
        '3', COALESCE(SUM(CASE WHEN ng = 3 THEN cnt END), 0),
        '4', COALESCE(SUM(CASE WHEN ng = 4 THEN cnt END), 0),
        '5', COALESCE(SUM(CASE WHEN ng = 5 THEN cnt END), 0),
        '6+', COALESCE(SUM(CASE WHEN ng >= 6 THEN cnt END), 0)
    )
    INTO v_guess_dist
    FROM (
        SELECT LEAST(num_guesses, 6) AS ng, COUNT(*) AS cnt
        FROM (
            SELECT num_guesses FROM public.game_attempts_region gar
            LEFT JOIN public.questions_allocated_region qar ON qar.id = gar.allocated_region_id
            WHERE result = 'won' AND num_guesses IS NOT NULL
            AND gar.started_at::date BETWEEN p_start AND p_end
            AND (p_region IS NULL OR qar.region = p_region)
            UNION ALL
            SELECT num_guesses FROM public.game_attempts_user
            WHERE result = 'won' AND num_guesses IS NOT NULL
            AND started_at::date BETWEEN p_start AND p_end
            AND (p_region IS NULL)
        ) wins
        GROUP BY LEAST(num_guesses, 6)
    ) buckets;

    -- Badges awarded in period
    SELECT COUNT(*)
    INTO v_badges_awarded
    FROM public.user_badges
    WHERE is_awarded = true
    AND awarded_at::date BETWEEN p_start AND p_end
    AND (p_region IS NULL OR region = p_region);


    -- ── AD METRICS ──────────────────────────────────────────

    SELECT COALESCE(SUM(
        (CASE WHEN gar.ad_watched THEN 1 ELSE 0 END)
    ), 0)
    INTO v_ads_watched
    FROM public.game_attempts_region gar
    LEFT JOIN public.questions_allocated_region qar ON qar.id = gar.allocated_region_id
    WHERE gar.started_at::date BETWEEN p_start AND p_end
    AND (p_region IS NULL OR qar.region = p_region);

    -- Add user mode ads
    v_ads_watched := v_ads_watched + COALESCE((
        SELECT SUM(CASE WHEN ad_watched THEN 1 ELSE 0 END)
        FROM public.game_attempts_user
        WHERE started_at::date BETWEEN p_start AND p_end
        AND (p_region IS NULL)
    ), 0);


    -- ── SUBSCRIPTION METRICS ────────────────────────────────

    -- Pro signups in period
    SELECT COUNT(*)
    INTO v_pro_signups
    FROM public.user_subscriptions
    WHERE created_at::date BETWEEN p_start AND p_end
    AND tier IN ('pro', 'school');

    -- Total active pro users (point-in-time, not period-bound)
    SELECT COUNT(*)
    INTO v_active_pro
    FROM public.user_subscriptions
    WHERE status = 'active'
    AND tier IN ('pro', 'school');

    -- Auto-renew percentage of active subs
    SELECT ROUND(
        COUNT(*) FILTER (WHERE auto_renew) * 100.0
        / NULLIF(COUNT(*), 0),
        1
    )
    INTO v_auto_renew_pct
    FROM public.user_subscriptions
    WHERE status = 'active';

    -- Subscription distribution by billing_period
    SELECT COALESCE(jsonb_object_agg(billing_period, cnt), '{}'::jsonb)
    INTO v_sub_distribution
    FROM (
        SELECT billing_period, COUNT(*) AS cnt
        FROM public.user_subscriptions
        WHERE status = 'active'
        GROUP BY billing_period
    ) dist;


    -- ── FINANCIAL METRICS ───────────────────────────────────

    -- Total unique players (for conversion rate)
    v_total_players := v_unique_users + v_unique_guests;

    -- Conversion rate: active pro / total unique players in period
    v_conversion_rate := ROUND(
        v_active_pro * 100.0 / NULLIF(v_total_players, 0),
        2
    );

    -- MRR: sum amount_paid for active, auto-renewing, non-lifetime subs
    -- Divide by subscription_duration_months to normalize to monthly
    SELECT COALESCE(ROUND(
        SUM(
            us.amount_paid::numeric
            / NULLIF(COALESCE(ut.subscription_duration_months, 1), 0)
        ) / 100.0,  -- cents to currency
        2
    ), 0)
    INTO v_mrr
    FROM public.user_subscriptions us
    JOIN public.user_tier ut ON us.user_tier_id = ut.id
    WHERE us.status = 'active'
    AND us.auto_renew = true
    AND ut.tier_type != 'lifetime';

    -- LTV: total historical revenue / total unique registered users
    SELECT COALESCE(SUM(amount_paid), 0)
    INTO v_total_sub_revenue
    FROM public.user_subscriptions;

    SELECT COUNT(*)
    INTO v_total_users
    FROM public.user_profiles;

    v_ltv := ROUND(
        (v_total_sub_revenue / 100.0)  -- cents to currency
        / NULLIF(v_total_users, 0),
        2
    );

    -- Subscription revenue in period
    SELECT COALESCE(ROUND(SUM(amount_paid) / 100.0, 2), 0)
    INTO v_sub_revenue
    FROM public.user_subscriptions
    WHERE created_at::date BETWEEN p_start AND p_end;

    -- Estimated ad revenue: fetch eCPM from admin_settings
    SELECT COALESCE((
        SELECT value::numeric FROM public.admin_settings
        WHERE key = 'interstitial_eCPM' LIMIT 1
    ), 0) INTO v_interstitial_ecpm;

    SELECT COALESCE((
        SELECT value::numeric FROM public.admin_settings
        WHERE key = 'banner_eCPM' LIMIT 1
    ), 0) INTO v_banner_ecpm;

    v_ad_revenue := ROUND(
        (v_ads_watched / 1000.0) * (v_interstitial_ecpm + v_banner_ecpm),
        2
    );

    -- Total revenue
    v_total_revenue := v_sub_revenue + v_ad_revenue;


    -- ── RETURN PAYLOAD ──────────────────────────────────────

    RETURN jsonb_build_object(
        'players', jsonb_build_object(
            'signups',       v_signups,
            'unique_users',  v_unique_users,
            'unique_guests', v_unique_guests
        ),
        'games', jsonb_build_object(
            'total_region',      v_games_region,
            'total_user',        v_games_user,
            'total',             v_games_region + v_games_user,
            'avg_guesses',       COALESCE(v_avg_guesses, 0),
            'guess_distribution', COALESCE(v_guess_dist, '{}'::jsonb),
            'badges_awarded',    v_badges_awarded
        ),
        'ads', jsonb_build_object(
            'total_watched', v_ads_watched
        ),
        'subscriptions', jsonb_build_object(
            'pro_signups',     v_pro_signups,
            'active_pro',      v_active_pro,
            'auto_renew_pct',  COALESCE(v_auto_renew_pct, 0),
            'distribution',    v_sub_distribution
        ),
        'financial', jsonb_build_object(
            'conversion_rate', COALESCE(v_conversion_rate, 0),
            'mrr',             v_mrr,
            'ltv',             COALESCE(v_ltv, 0),
            'ad_revenue',      v_ad_revenue,
            'sub_revenue',     v_sub_revenue,
            'total_revenue',   v_total_revenue
        )
    );
END;
$$;


-- ─── 2. admin_timeseries_metric ──────────────────────────────
-- Returns time-grouped data points for a specific metric.
-- Parameters:
--   p_metric  TEXT  — Metric name (see CASE branches)
--   p_start   DATE  — Start date (inclusive)
--   p_end     DATE  — End date (inclusive)
--   p_group   TEXT  — 'day', 'week', or 'month'
--   p_region  TEXT  — Region code filter, or NULL for all

CREATE OR REPLACE FUNCTION public.admin_timeseries_metric(
    p_metric  TEXT,
    p_start   DATE,
    p_end     DATE,
    p_group   TEXT DEFAULT 'day',
    p_region  TEXT DEFAULT NULL
)
RETURNS TABLE(period TEXT, value NUMERIC)
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    -- Security guard
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'Unauthorized: admin access required';
    END IF;

    -- Validate group parameter
    IF p_group NOT IN ('day', 'week', 'month') THEN
        RAISE EXCEPTION 'Invalid group parameter: must be day, week, or month';
    END IF;

    -- ── SIGNUPS ─────────────────────────────────────────────
    IF p_metric = 'signups' THEN
        RETURN QUERY
        SELECT
            date_trunc(p_group, up.created_at)::date::text AS period,
            COUNT(*)::numeric AS value
        FROM public.user_profiles up
        WHERE up.created_at::date BETWEEN p_start AND p_end
        AND (p_region IS NULL OR up.region = p_region)
        GROUP BY date_trunc(p_group, up.created_at)
        ORDER BY period;

    -- ── GAMES PLAYED (combined region + user) ───────────────
    ELSIF p_metric = 'games_played' THEN
        RETURN QUERY
        SELECT period, SUM(cnt)::numeric AS value
        FROM (
            SELECT
                date_trunc(p_group, gar.started_at)::date::text AS period,
                COUNT(*)::numeric AS cnt
            FROM public.game_attempts_region gar
            LEFT JOIN public.questions_allocated_region qar
                ON qar.id = gar.allocated_region_id
            WHERE gar.started_at::date BETWEEN p_start AND p_end
            AND (p_region IS NULL OR qar.region = p_region)
            GROUP BY date_trunc(p_group, gar.started_at)

            UNION ALL

            SELECT
                date_trunc(p_group, gau.started_at)::date::text AS period,
                COUNT(*)::numeric AS cnt
            FROM public.game_attempts_user gau
            WHERE gau.started_at::date BETWEEN p_start AND p_end
            AND (p_region IS NULL)
            GROUP BY date_trunc(p_group, gau.started_at)
        ) combined
        GROUP BY period
        ORDER BY period;

    -- ── UNIQUE PLAYERS ──────────────────────────────────────
    ELSIF p_metric = 'unique_players' THEN
        RETURN QUERY
        SELECT period, COUNT(DISTINCT player_id)::numeric AS value
        FROM (
            SELECT
                date_trunc(p_group, gar.started_at)::date::text AS period,
                COALESCE(gar.user_id::text, gar.guest_id) AS player_id
            FROM public.game_attempts_region gar
            LEFT JOIN public.questions_allocated_region qar
                ON qar.id = gar.allocated_region_id
            WHERE gar.started_at::date BETWEEN p_start AND p_end
            AND (p_region IS NULL OR qar.region = p_region)

            UNION ALL

            SELECT
                date_trunc(p_group, gau.started_at)::date::text AS period,
                gau.user_id::text AS player_id
            FROM public.game_attempts_user gau
            WHERE gau.started_at::date BETWEEN p_start AND p_end
            AND (p_region IS NULL)
        ) combined
        GROUP BY period
        ORDER BY period;

    -- ── GUESTS PLAYED ───────────────────────────────────────
    ELSIF p_metric = 'guests_played' THEN
        RETURN QUERY
        SELECT
            date_trunc(p_group, gar.started_at)::date::text AS period,
            COUNT(DISTINCT gar.guest_id)::numeric AS value
        FROM public.game_attempts_region gar
        LEFT JOIN public.questions_allocated_region qar
            ON qar.id = gar.allocated_region_id
        WHERE gar.guest_id IS NOT NULL
        AND gar.started_at::date BETWEEN p_start AND p_end
        AND (p_region IS NULL OR qar.region = p_region)
        GROUP BY date_trunc(p_group, gar.started_at)
        ORDER BY period;

    -- ── ADS WATCHED ─────────────────────────────────────────
    ELSIF p_metric = 'ads_watched' THEN
        RETURN QUERY
        SELECT period, SUM(cnt)::numeric AS value
        FROM (
            SELECT
                date_trunc(p_group, gar.started_at)::date::text AS period,
                SUM(CASE WHEN gar.ad_watched THEN 1 ELSE 0 END)::numeric AS cnt
            FROM public.game_attempts_region gar
            LEFT JOIN public.questions_allocated_region qar
                ON qar.id = gar.allocated_region_id
            WHERE gar.started_at::date BETWEEN p_start AND p_end
            AND (p_region IS NULL OR qar.region = p_region)
            GROUP BY date_trunc(p_group, gar.started_at)

            UNION ALL

            SELECT
                date_trunc(p_group, gau.started_at)::date::text AS period,
                SUM(CASE WHEN gau.ad_watched THEN 1 ELSE 0 END)::numeric AS cnt
            FROM public.game_attempts_user gau
            WHERE gau.started_at::date BETWEEN p_start AND p_end
            AND (p_region IS NULL)
            GROUP BY date_trunc(p_group, gau.started_at)
        ) combined
        GROUP BY period
        ORDER BY period;

    -- ── PRO SIGNUPS ─────────────────────────────────────────
    ELSIF p_metric = 'pro_signups' THEN
        RETURN QUERY
        SELECT
            date_trunc(p_group, us.created_at)::date::text AS period,
            COUNT(*)::numeric AS value
        FROM public.user_subscriptions us
        WHERE us.created_at::date BETWEEN p_start AND p_end
        AND us.tier IN ('pro', 'school')
        GROUP BY date_trunc(p_group, us.created_at)
        ORDER BY period;

    -- ── SUBSCRIPTION REVENUE ────────────────────────────────
    ELSIF p_metric = 'sub_revenue' THEN
        RETURN QUERY
        SELECT
            date_trunc(p_group, us.created_at)::date::text AS period,
            ROUND(COALESCE(SUM(us.amount_paid), 0) / 100.0, 2)::numeric AS value
        FROM public.user_subscriptions us
        WHERE us.created_at::date BETWEEN p_start AND p_end
        GROUP BY date_trunc(p_group, us.created_at)
        ORDER BY period;

    -- ── TOTAL REVENUE (sub + estimated ad) ──────────────────
    ELSIF p_metric = 'total_revenue' THEN
        RETURN QUERY
        WITH ecpm AS (
            SELECT
                COALESCE((SELECT value::numeric FROM admin_settings WHERE key = 'interstitial_eCPM' LIMIT 1), 0)
                + COALESCE((SELECT value::numeric FROM admin_settings WHERE key = 'banner_eCPM' LIMIT 1), 0)
                AS combined_ecpm
        ),
        sub_rev AS (
            SELECT
                date_trunc(p_group, us.created_at)::date::text AS period,
                ROUND(COALESCE(SUM(us.amount_paid), 0) / 100.0, 2) AS rev
            FROM public.user_subscriptions us
            WHERE us.created_at::date BETWEEN p_start AND p_end
            GROUP BY date_trunc(p_group, us.created_at)
        ),
        ad_rev AS (
            SELECT period, ROUND(SUM(ad_cnt) / 1000.0 * (SELECT combined_ecpm FROM ecpm), 2) AS rev
            FROM (
                SELECT
                    date_trunc(p_group, gar.started_at)::date::text AS period,
                    SUM(CASE WHEN gar.ad_watched THEN 1 ELSE 0 END)::numeric AS ad_cnt
                FROM public.game_attempts_region gar
                LEFT JOIN public.questions_allocated_region qar
                    ON qar.id = gar.allocated_region_id
                WHERE gar.started_at::date BETWEEN p_start AND p_end
                AND (p_region IS NULL OR qar.region = p_region)
                GROUP BY date_trunc(p_group, gar.started_at)

                UNION ALL

                SELECT
                    date_trunc(p_group, gau.started_at)::date::text AS period,
                    SUM(CASE WHEN gau.ad_watched THEN 1 ELSE 0 END)::numeric AS ad_cnt
                FROM public.game_attempts_user gau
                WHERE gau.started_at::date BETWEEN p_start AND p_end
                AND (p_region IS NULL)
                GROUP BY date_trunc(p_group, gau.started_at)
            ) ads_combined
            GROUP BY period
        ),
        all_periods AS (
            SELECT period FROM sub_rev
            UNION
            SELECT period FROM ad_rev
        )
        SELECT
            ap.period,
            (COALESCE(sr.rev, 0) + COALESCE(ar.rev, 0))::numeric AS value
        FROM all_periods ap
        LEFT JOIN sub_rev sr ON sr.period = ap.period
        LEFT JOIN ad_rev ar ON ar.period = ap.period
        ORDER BY ap.period;

    -- ── AVG GUESSES (per period, wins only) ─────────────────
    ELSIF p_metric = 'avg_guesses' THEN
        RETURN QUERY
        SELECT period, ROUND(AVG(ng), 2)::numeric AS value
        FROM (
            SELECT
                date_trunc(p_group, gar.started_at)::date::text AS period,
                gar.num_guesses AS ng
            FROM public.game_attempts_region gar
            LEFT JOIN public.questions_allocated_region qar
                ON qar.id = gar.allocated_region_id
            WHERE gar.result = 'won' AND gar.num_guesses IS NOT NULL
            AND gar.started_at::date BETWEEN p_start AND p_end
            AND (p_region IS NULL OR qar.region = p_region)

            UNION ALL

            SELECT
                date_trunc(p_group, gau.started_at)::date::text AS period,
                gau.num_guesses AS ng
            FROM public.game_attempts_user gau
            WHERE gau.result = 'won' AND gau.num_guesses IS NOT NULL
            AND gau.started_at::date BETWEEN p_start AND p_end
            AND (p_region IS NULL)
        ) combined
        GROUP BY period
        ORDER BY period;

    ELSE
        RAISE EXCEPTION 'Unknown metric: %', p_metric;
    END IF;
END;
$$;
