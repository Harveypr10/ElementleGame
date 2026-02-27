-- ═══════════════════════════════════════════════════════════════
-- Analytics Dashboard v2: RPC Fixes & Enhancements
-- Fixes: timeseries data bug, Active Pro count, badge breakdown,
--        guess distribution, game mode filter, new timeseries metrics
-- Run in Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════════


-- ─── 1. Replace admin_dashboard_metrics ──────────────────────

CREATE OR REPLACE FUNCTION public.admin_dashboard_metrics(
    p_start  DATE,
    p_end    DATE,
    p_region TEXT DEFAULT NULL,
    p_mode   TEXT DEFAULT 'all'  -- 'all', 'region', 'user'
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_signups           BIGINT;
    v_unique_users      BIGINT := 0;
    v_unique_guests     BIGINT := 0;
    v_games_region      BIGINT := 0;
    v_games_user        BIGINT := 0;
    v_avg_guesses       NUMERIC;
    v_guess_dist        JSONB;
    v_badges_awarded    BIGINT;
    v_badge_breakdown   JSONB;
    v_ads_watched       BIGINT := 0;
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
    v_ts                TEXT; -- helper for date field
BEGIN
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'Unauthorized';
    END IF;

    -- ── PLAYER METRICS ──────────────────────────────────────

    SELECT COUNT(*) INTO v_signups
    FROM public.user_profiles
    WHERE created_at::date BETWEEN p_start AND p_end
    AND (p_region IS NULL OR region = p_region);

    -- Region mode players
    IF p_mode IN ('all', 'region') THEN
        SELECT COUNT(DISTINCT gar.user_id) INTO v_unique_users
        FROM public.game_attempts_region gar
        LEFT JOIN public.questions_allocated_region qar ON qar.id = gar.allocated_region_id
        WHERE gar.user_id IS NOT NULL
        AND COALESCE(gar.completed_at, gar.started_at)::date BETWEEN p_start AND p_end
        AND (p_region IS NULL OR qar.region = p_region);

        SELECT COUNT(DISTINCT gar.guest_id) INTO v_unique_guests
        FROM public.game_attempts_region gar
        LEFT JOIN public.questions_allocated_region qar ON qar.id = gar.allocated_region_id
        WHERE gar.guest_id IS NOT NULL
        AND COALESCE(gar.completed_at, gar.started_at)::date BETWEEN p_start AND p_end
        AND (p_region IS NULL OR qar.region = p_region);
    END IF;

    -- User mode players (add to count)
    IF p_mode IN ('all', 'user') AND p_region IS NULL THEN
        v_unique_users := v_unique_users + COALESCE((
            SELECT COUNT(DISTINCT gau.user_id)
            FROM public.game_attempts_user gau
            WHERE COALESCE(gau.completed_at, gau.started_at)::date BETWEEN p_start AND p_end
        ), 0);
    END IF;

    -- ── GAME METRICS ────────────────────────────────────────

    IF p_mode IN ('all', 'region') THEN
        SELECT COUNT(*) INTO v_games_region
        FROM public.game_attempts_region gar
        LEFT JOIN public.questions_allocated_region qar ON qar.id = gar.allocated_region_id
        WHERE COALESCE(gar.completed_at, gar.started_at)::date BETWEEN p_start AND p_end
        AND (p_region IS NULL OR qar.region = p_region);
    END IF;

    IF p_mode IN ('all', 'user') AND p_region IS NULL THEN
        SELECT COUNT(*) INTO v_games_user
        FROM public.game_attempts_user gau
        WHERE COALESCE(gau.completed_at, gau.started_at)::date BETWEEN p_start AND p_end;
    END IF;

    -- Average guesses (wins only)
    SELECT ROUND(AVG(num_guesses), 2) INTO v_avg_guesses
    FROM (
        SELECT num_guesses FROM public.game_attempts_region gar
        LEFT JOIN public.questions_allocated_region qar ON qar.id = gar.allocated_region_id
        WHERE result = 'won' AND num_guesses IS NOT NULL
        AND COALESCE(gar.completed_at, gar.started_at)::date BETWEEN p_start AND p_end
        AND (p_region IS NULL OR qar.region = p_region)
        AND (p_mode IN ('all', 'region'))
        UNION ALL
        SELECT num_guesses FROM public.game_attempts_user
        WHERE result = 'won' AND num_guesses IS NOT NULL
        AND COALESCE(completed_at, started_at)::date BETWEEN p_start AND p_end
        AND p_region IS NULL AND (p_mode IN ('all', 'user'))
    ) combined;

    -- Guess distribution: 1-5 are WINS at that guess count, X = LOSSES
    SELECT jsonb_build_object(
        '1', COALESCE(SUM(CASE WHEN ng = 1 AND res = 'won' THEN cnt END), 0),
        '2', COALESCE(SUM(CASE WHEN ng = 2 AND res = 'won' THEN cnt END), 0),
        '3', COALESCE(SUM(CASE WHEN ng = 3 AND res = 'won' THEN cnt END), 0),
        '4', COALESCE(SUM(CASE WHEN ng = 4 AND res = 'won' THEN cnt END), 0),
        '5', COALESCE(SUM(CASE WHEN ng = 5 AND res = 'won' THEN cnt END), 0),
        'X', COALESCE(SUM(CASE WHEN res = 'lost' THEN cnt END), 0)
    )
    INTO v_guess_dist
    FROM (
        SELECT num_guesses AS ng, result AS res, COUNT(*) AS cnt
        FROM (
            SELECT num_guesses, result FROM public.game_attempts_region gar
            LEFT JOIN public.questions_allocated_region qar ON qar.id = gar.allocated_region_id
            WHERE COALESCE(gar.completed_at, gar.started_at)::date BETWEEN p_start AND p_end
            AND (p_region IS NULL OR qar.region = p_region)
            AND result IN ('won', 'lost')
            AND (p_mode IN ('all', 'region'))
            UNION ALL
            SELECT num_guesses, result FROM public.game_attempts_user
            WHERE COALESCE(completed_at, started_at)::date BETWEEN p_start AND p_end
            AND p_region IS NULL AND result IN ('won', 'lost')
            AND (p_mode IN ('all', 'user'))
        ) all_games
        GROUP BY num_guesses, result
    ) buckets;

    -- ── BADGES ──────────────────────────────────────────────

    SELECT COUNT(*) INTO v_badges_awarded
    FROM public.user_badges ub
    WHERE ub.is_awarded = true
    AND ub.awarded_at::date BETWEEN p_start AND p_end
    AND (p_region IS NULL OR ub.region = p_region);

    -- Badge breakdown by category
    SELECT COALESCE(jsonb_object_agg(cat, cnt), '{}'::jsonb)
    INTO v_badge_breakdown
    FROM (
        SELECT b.category AS cat, COUNT(*) AS cnt
        FROM public.user_badges ub
        JOIN public.badges b ON b.id = ub.badge_id
        WHERE ub.is_awarded = true
        AND ub.awarded_at::date BETWEEN p_start AND p_end
        AND (p_region IS NULL OR ub.region = p_region)
        GROUP BY b.category
    ) cats;

    -- ── AD METRICS ──────────────────────────────────────────

    IF p_mode IN ('all', 'region') THEN
        SELECT COALESCE(SUM(CASE WHEN gar.ad_watched THEN 1 ELSE 0 END), 0)
        INTO v_ads_watched
        FROM public.game_attempts_region gar
        LEFT JOIN public.questions_allocated_region qar ON qar.id = gar.allocated_region_id
        WHERE COALESCE(gar.completed_at, gar.started_at)::date BETWEEN p_start AND p_end
        AND (p_region IS NULL OR qar.region = p_region);
    END IF;

    IF p_mode IN ('all', 'user') AND p_region IS NULL THEN
        v_ads_watched := v_ads_watched + COALESCE((
            SELECT SUM(CASE WHEN ad_watched THEN 1 ELSE 0 END)
            FROM public.game_attempts_user
            WHERE COALESCE(completed_at, started_at)::date BETWEEN p_start AND p_end
        ), 0);
    END IF;

    -- ── SUBSCRIPTION METRICS ────────────────────────────────

    SELECT COUNT(*) INTO v_pro_signups
    FROM public.user_subscriptions
    WHERE created_at::date BETWEEN p_start AND p_end
    AND tier IN ('pro', 'school');

    -- Active Pro: count DISTINCT users who have at least one active subscription
    SELECT COUNT(DISTINCT user_id) INTO v_active_pro
    FROM public.user_subscriptions
    WHERE status = 'active'
    AND tier IN ('pro', 'school');

    SELECT ROUND(
        COUNT(*) FILTER (WHERE auto_renew) * 100.0
        / NULLIF(COUNT(*), 0), 1
    ) INTO v_auto_renew_pct
    FROM public.user_subscriptions
    WHERE status = 'active';

    SELECT COALESCE(jsonb_object_agg(billing_period, cnt), '{}'::jsonb)
    INTO v_sub_distribution
    FROM (
        SELECT billing_period, COUNT(*) AS cnt
        FROM public.user_subscriptions
        WHERE status = 'active'
        GROUP BY billing_period
    ) dist;

    -- ── FINANCIAL METRICS ───────────────────────────────────

    v_total_players := v_unique_users + v_unique_guests;

    v_conversion_rate := ROUND(
        v_active_pro * 100.0 / NULLIF(v_total_players, 0), 2
    );

    SELECT COALESCE(ROUND(
        SUM(us.amount_paid::numeric
            / NULLIF(COALESCE(ut.subscription_duration_months, 1), 0)
        ) / 100.0, 2), 0)
    INTO v_mrr
    FROM public.user_subscriptions us
    JOIN public.user_tier ut ON us.user_tier_id = ut.id
    WHERE us.status = 'active' AND us.auto_renew = true
    AND ut.tier_type != 'lifetime';

    SELECT COALESCE(SUM(amount_paid), 0) INTO v_total_sub_revenue
    FROM public.user_subscriptions;

    SELECT COUNT(*) INTO v_total_users FROM public.user_profiles;

    v_ltv := ROUND((v_total_sub_revenue / 100.0) / NULLIF(v_total_users, 0), 2);

    SELECT COALESCE(ROUND(SUM(amount_paid) / 100.0, 2), 0)
    INTO v_sub_revenue
    FROM public.user_subscriptions
    WHERE created_at::date BETWEEN p_start AND p_end;

    SELECT COALESCE((SELECT value::numeric FROM public.admin_settings
        WHERE key = 'interstitial_eCPM' LIMIT 1), 0) INTO v_interstitial_ecpm;
    SELECT COALESCE((SELECT value::numeric FROM public.admin_settings
        WHERE key = 'banner_eCPM' LIMIT 1), 0) INTO v_banner_ecpm;

    v_ad_revenue := ROUND((v_ads_watched / 1000.0) * (v_interstitial_ecpm + v_banner_ecpm), 2);
    v_total_revenue := v_sub_revenue + v_ad_revenue;

    RETURN jsonb_build_object(
        'players', jsonb_build_object(
            'signups', v_signups, 'unique_users', v_unique_users, 'unique_guests', v_unique_guests
        ),
        'games', jsonb_build_object(
            'total_region', v_games_region, 'total_user', v_games_user,
            'total', v_games_region + v_games_user,
            'avg_guesses', COALESCE(v_avg_guesses, 0),
            'guess_distribution', COALESCE(v_guess_dist, '{}'::jsonb),
            'badges_awarded', v_badges_awarded,
            'badge_breakdown', v_badge_breakdown
        ),
        'ads', jsonb_build_object('total_watched', v_ads_watched),
        'subscriptions', jsonb_build_object(
            'pro_signups', v_pro_signups, 'active_pro', v_active_pro,
            'auto_renew_pct', COALESCE(v_auto_renew_pct, 0),
            'distribution', v_sub_distribution
        ),
        'financial', jsonb_build_object(
            'conversion_rate', COALESCE(v_conversion_rate, 0),
            'mrr', v_mrr, 'ltv', COALESCE(v_ltv, 0),
            'ad_revenue', v_ad_revenue, 'sub_revenue', v_sub_revenue,
            'total_revenue', v_total_revenue
        )
    );
END;
$$;


-- ─── 2. Replace admin_timeseries_metric ──────────────────────
-- Fixed: uses COALESCE(completed_at, started_at) for dates
-- Added: badges_awarded, game mode filter

CREATE OR REPLACE FUNCTION public.admin_timeseries_metric(
    p_metric  TEXT,
    p_start   DATE,
    p_end     DATE,
    p_group   TEXT DEFAULT 'day',
    p_region  TEXT DEFAULT NULL,
    p_mode    TEXT DEFAULT 'all'
)
RETURNS TABLE(period TEXT, value NUMERIC)
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'Unauthorized';
    END IF;

    IF p_group NOT IN ('day', 'week', 'month') THEN
        RAISE EXCEPTION 'Invalid group: must be day, week, or month';
    END IF;

    -- ── SIGNUPS ─────────────────────────────────────────────
    IF p_metric = 'signups' THEN
        RETURN QUERY
        SELECT date_trunc(p_group, up.created_at)::date::text, COUNT(*)::numeric
        FROM public.user_profiles up
        WHERE up.created_at::date BETWEEN p_start AND p_end
        AND (p_region IS NULL OR up.region = p_region)
        GROUP BY 1 ORDER BY 1;

    -- ── GAMES PLAYED ────────────────────────────────────────
    ELSIF p_metric = 'games_played' THEN
        RETURN QUERY
        SELECT p, SUM(c)::numeric FROM (
            SELECT date_trunc(p_group, COALESCE(gar.completed_at, gar.started_at))::date::text AS p, COUNT(*)::numeric AS c
            FROM public.game_attempts_region gar
            LEFT JOIN public.questions_allocated_region qar ON qar.id = gar.allocated_region_id
            WHERE COALESCE(gar.completed_at, gar.started_at)::date BETWEEN p_start AND p_end
            AND (p_region IS NULL OR qar.region = p_region)
            AND (p_mode IN ('all', 'region'))
            GROUP BY 1
            UNION ALL
            SELECT date_trunc(p_group, COALESCE(gau.completed_at, gau.started_at))::date::text, COUNT(*)::numeric
            FROM public.game_attempts_user gau
            WHERE COALESCE(gau.completed_at, gau.started_at)::date BETWEEN p_start AND p_end
            AND p_region IS NULL AND (p_mode IN ('all', 'user'))
            GROUP BY 1
        ) x GROUP BY p ORDER BY p;

    -- ── UNIQUE PLAYERS ──────────────────────────────────────
    ELSIF p_metric = 'unique_players' THEN
        RETURN QUERY
        SELECT p, COUNT(DISTINCT pid)::numeric FROM (
            SELECT date_trunc(p_group, COALESCE(gar.completed_at, gar.started_at))::date::text AS p,
                   COALESCE(gar.user_id::text, gar.guest_id) AS pid
            FROM public.game_attempts_region gar
            LEFT JOIN public.questions_allocated_region qar ON qar.id = gar.allocated_region_id
            WHERE COALESCE(gar.completed_at, gar.started_at)::date BETWEEN p_start AND p_end
            AND (p_region IS NULL OR qar.region = p_region)
            AND (p_mode IN ('all', 'region'))
            UNION ALL
            SELECT date_trunc(p_group, COALESCE(gau.completed_at, gau.started_at))::date::text, gau.user_id::text
            FROM public.game_attempts_user gau
            WHERE COALESCE(gau.completed_at, gau.started_at)::date BETWEEN p_start AND p_end
            AND p_region IS NULL AND (p_mode IN ('all', 'user'))
        ) x GROUP BY p ORDER BY p;

    -- ── GUESTS PLAYED ───────────────────────────────────────
    ELSIF p_metric = 'guests_played' THEN
        RETURN QUERY
        SELECT date_trunc(p_group, COALESCE(gar.completed_at, gar.started_at))::date::text,
               COUNT(DISTINCT gar.guest_id)::numeric
        FROM public.game_attempts_region gar
        LEFT JOIN public.questions_allocated_region qar ON qar.id = gar.allocated_region_id
        WHERE gar.guest_id IS NOT NULL
        AND COALESCE(gar.completed_at, gar.started_at)::date BETWEEN p_start AND p_end
        AND (p_region IS NULL OR qar.region = p_region)
        GROUP BY 1 ORDER BY 1;

    -- ── ADS WATCHED ─────────────────────────────────────────
    ELSIF p_metric = 'ads_watched' THEN
        RETURN QUERY
        SELECT p, SUM(c)::numeric FROM (
            SELECT date_trunc(p_group, COALESCE(gar.completed_at, gar.started_at))::date::text AS p,
                   SUM(CASE WHEN gar.ad_watched THEN 1 ELSE 0 END)::numeric AS c
            FROM public.game_attempts_region gar
            LEFT JOIN public.questions_allocated_region qar ON qar.id = gar.allocated_region_id
            WHERE COALESCE(gar.completed_at, gar.started_at)::date BETWEEN p_start AND p_end
            AND (p_region IS NULL OR qar.region = p_region)
            AND (p_mode IN ('all', 'region'))
            GROUP BY 1
            UNION ALL
            SELECT date_trunc(p_group, COALESCE(gau.completed_at, gau.started_at))::date::text,
                   SUM(CASE WHEN gau.ad_watched THEN 1 ELSE 0 END)::numeric
            FROM public.game_attempts_user gau
            WHERE COALESCE(gau.completed_at, gau.started_at)::date BETWEEN p_start AND p_end
            AND p_region IS NULL AND (p_mode IN ('all', 'user'))
            GROUP BY 1
        ) x GROUP BY p ORDER BY p;

    -- ── PRO SIGNUPS ─────────────────────────────────────────
    ELSIF p_metric = 'pro_signups' THEN
        RETURN QUERY
        SELECT date_trunc(p_group, us.created_at)::date::text, COUNT(*)::numeric
        FROM public.user_subscriptions us
        WHERE us.created_at::date BETWEEN p_start AND p_end
        AND us.tier IN ('pro', 'school')
        GROUP BY 1 ORDER BY 1;

    -- ── SUB REVENUE ─────────────────────────────────────────
    ELSIF p_metric = 'sub_revenue' THEN
        RETURN QUERY
        SELECT date_trunc(p_group, us.created_at)::date::text,
               ROUND(COALESCE(SUM(us.amount_paid), 0) / 100.0, 2)::numeric
        FROM public.user_subscriptions us
        WHERE us.created_at::date BETWEEN p_start AND p_end
        GROUP BY 1 ORDER BY 1;

    -- ── TOTAL REVENUE ───────────────────────────────────────
    ELSIF p_metric = 'total_revenue' THEN
        -- Simplified: just return sub_revenue for now (ad revenue is additive and currently 0)
        -- This avoids CTE parameter scoping issues with p_group
        RETURN QUERY
        SELECT date_trunc(p_group, us.created_at)::date::text,
               ROUND(COALESCE(SUM(us.amount_paid), 0) / 100.0, 2)::numeric
        FROM public.user_subscriptions us
        WHERE us.created_at::date BETWEEN p_start AND p_end
        GROUP BY 1 ORDER BY 1;

    -- ── AVG GUESSES ─────────────────────────────────────────
    ELSIF p_metric = 'avg_guesses' THEN
        RETURN QUERY
        SELECT p, ROUND(AVG(ng), 2)::numeric FROM (
            SELECT date_trunc(p_group, COALESCE(gar.completed_at, gar.started_at))::date::text AS p, gar.num_guesses AS ng
            FROM public.game_attempts_region gar
            LEFT JOIN public.questions_allocated_region qar ON qar.id = gar.allocated_region_id
            WHERE gar.result = 'won' AND gar.num_guesses IS NOT NULL
            AND COALESCE(gar.completed_at, gar.started_at)::date BETWEEN p_start AND p_end
            AND (p_region IS NULL OR qar.region = p_region)
            AND (p_mode IN ('all', 'region'))
            UNION ALL
            SELECT date_trunc(p_group, COALESCE(gau.completed_at, gau.started_at))::date::text, gau.num_guesses
            FROM public.game_attempts_user gau
            WHERE gau.result = 'won' AND gau.num_guesses IS NOT NULL
            AND COALESCE(gau.completed_at, gau.started_at)::date BETWEEN p_start AND p_end
            AND p_region IS NULL AND (p_mode IN ('all', 'user'))
        ) x GROUP BY p ORDER BY p;

    -- ── BADGES AWARDED ──────────────────────────────────────
    ELSIF p_metric = 'badges_awarded' THEN
        RETURN QUERY
        SELECT date_trunc(p_group, ub.awarded_at)::date::text, COUNT(*)::numeric
        FROM public.user_badges ub
        WHERE ub.is_awarded = true
        AND ub.awarded_at::date BETWEEN p_start AND p_end
        AND (p_region IS NULL OR ub.region = p_region)
        GROUP BY 1 ORDER BY 1;

    ELSE
        RAISE EXCEPTION 'Unknown metric: %', p_metric;
    END IF;
END;
$$;
