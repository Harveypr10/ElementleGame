-- ============================================================================
-- TEST DATA: February 2026 Snapshot + Awards for Global League
--
-- This script:
--   1. Computes what the real Feb 2026 standings would have been from
--      actual game_attempts_region data for all Global league members
--   2. Inserts snapshot rows into league_standings_snapshot
--   3. Grants gold/silver/bronze medals to the top 3 via league_awards
--
-- Safe to re-run — uses ON CONFLICT DO UPDATE.
-- ============================================================================

-- ─── STEP 1: Create February 2026 snapshot from real game data ──────────────
-- Calculates Elementle Rating for every active member of the Global league
-- for games played between 2026-02-01 and 2026-02-28.

WITH feb_game_data AS (
    -- Aggregate game data for February 2026 for each user
    SELECT
        g.user_id,
        COUNT(DISTINCT g.allocated_region_id) AS games_played,
        COUNT(DISTINCT g.allocated_region_id) FILTER (WHERE g.result = 'won') AS games_won,
        COALESCE(SUM(CASE WHEN g.result = 'lost' THEN 6 ELSE g.num_guesses END), 0) AS total_guess_value,
        COALESCE(SUM(CASE WHEN g.result = 'won' AND g.num_guesses = 1 THEN 1 ELSE 0 END), 0) AS guess1_count,
        COALESCE(SUM(CASE WHEN g.result = 'won' AND g.num_guesses = 2 THEN 1 ELSE 0 END), 0) AS guess2_count
    FROM public.game_attempts_region g
    JOIN public.questions_allocated_region qar ON qar.id = g.allocated_region_id
    WHERE g.result IN ('won', 'lost')
      AND qar.puzzle_date >= '2026-02-01'
      AND qar.puzzle_date < '2026-03-01'
    GROUP BY g.user_id
),
feb_ratings AS (
    -- Calculate Elementle Rating using the same formula as the live system
    -- Using 28 days for February 2026, with standard thresholds:
    --   max_guess1_per_month = 3, max_guess2_per_month = 5
    SELECT
        d.user_id,
        d.games_played,
        d.games_won,
        ROUND(d.games_won::numeric / NULLIF(d.games_played, 0) * 100, 1) AS win_rate,
        -- Qualifying games: exclude if guess1 > 3 or guess2 > 5
        GREATEST(
            d.games_played
            - CASE WHEN d.guess1_count > 3 THEN d.guess1_count ELSE 0 END
            - CASE WHEN d.guess2_count > 5 THEN d.guess2_count ELSE 0 END,
            0
        ) AS qualifying_games,
        d.total_guess_value,
        d.guess1_count,
        d.guess2_count
    FROM feb_game_data d
),
feb_final AS (
    SELECT
        r.user_id,
        r.games_played,
        r.games_won,
        r.win_rate,
        CASE WHEN r.qualifying_games > 0
             THEN ROUND(r.total_guess_value::numeric / r.qualifying_games, 2)
             ELSE 0 END AS avg_guesses,
        CASE WHEN r.qualifying_games > 0
             THEN ROUND(
                    (6 - (r.total_guess_value::numeric / r.qualifying_games))
                    * (3 * (r.qualifying_games::numeric / 28)),
                  2)
             ELSE 0 END AS elementle_rating
    FROM feb_ratings r
),
global_league AS (
    -- Find the Global system league
    SELECT id FROM public.leagues
    WHERE is_system_league = true AND system_region = 'GLOBAL'
    LIMIT 1
),
ranked_members AS (
    -- Only include users who are Global league members
    SELECT
        f.user_id,
        gl.id AS league_id,
        f.elementle_rating,
        ROW_NUMBER() OVER (
            ORDER BY f.elementle_rating DESC, f.games_won DESC,
                     f.games_played DESC, f.avg_guesses ASC
        ) AS rank
    FROM feb_final f
    CROSS JOIN global_league gl
    INNER JOIN public.league_members lm
        ON lm.league_id = gl.id AND lm.user_id = f.user_id
    WHERE f.elementle_rating > 0
)
-- Insert snapshot rows
INSERT INTO public.league_standings_snapshot
    (league_id, user_id, timeframe, period_label, game_mode, elementle_rating, rank, frozen_at)
SELECT
    rm.league_id,
    rm.user_id,
    'mtd',
    '2026-02',
    'region',
    rm.elementle_rating,
    rm.rank,
    '2026-03-01 12:00:00+00'::timestamptz
FROM ranked_members rm
ON CONFLICT (league_id, user_id, timeframe, period_label, game_mode)
DO UPDATE SET
    elementle_rating = EXCLUDED.elementle_rating,
    rank = EXCLUDED.rank,
    frozen_at = EXCLUDED.frozen_at;


-- ─── STEP 2: Grant medals to top 3 ─────────────────────────────────────────
-- Awards gold/silver/bronze using the snapshot we just created.

INSERT INTO public.league_awards
    (league_id, user_id, timeframe, period_label, game_mode, medal, elementle_rating, awarded_at)
SELECT
    s.league_id,
    s.user_id,
    'mtd',
    '2026-02',
    'region',
    CASE s.rank
        WHEN 1 THEN 'gold'
        WHEN 2 THEN 'silver'
        WHEN 3 THEN 'bronze'
    END,
    s.elementle_rating,
    '2026-03-01 12:01:00+00'::timestamptz
FROM public.league_standings_snapshot s
WHERE s.league_id = (
        SELECT id FROM public.leagues
        WHERE is_system_league = true AND system_region = 'GLOBAL'
        LIMIT 1
    )
  AND s.timeframe = 'mtd'
  AND s.period_label = '2026-02'
  AND s.game_mode = 'region'
  AND s.rank <= 3
  AND s.elementle_rating > 0
ON CONFLICT (league_id, user_id, timeframe, period_label, game_mode)
DO UPDATE SET
    medal = EXCLUDED.medal,
    elementle_rating = EXCLUDED.elementle_rating,
    awarded_at = EXCLUDED.awarded_at;


-- ─── STEP 3: Verify what was created ────────────────────────────────────────

-- Show the snapshot standings (top 10)
SELECT
    s.rank,
    COALESCE(up.global_display_name, up.first_name, 'Player') AS display_name,
    s.elementle_rating,
    s.user_id
FROM public.league_standings_snapshot s
LEFT JOIN public.user_profiles up ON up.id = s.user_id
WHERE s.league_id = (
        SELECT id FROM public.leagues
        WHERE is_system_league = true AND system_region = 'GLOBAL'
        LIMIT 1
    )
  AND s.timeframe = 'mtd'
  AND s.period_label = '2026-02'
  AND s.game_mode = 'region'
ORDER BY s.rank
LIMIT 10;

-- Show the awarded medals
SELECT
    la.medal,
    COALESCE(up.global_display_name, up.first_name, 'Player') AS display_name,
    la.elementle_rating,
    la.user_id
FROM public.league_awards la
LEFT JOIN public.user_profiles up ON up.id = la.user_id
WHERE la.timeframe = 'mtd'
  AND la.period_label = '2026-02'
  AND la.game_mode = 'region'
ORDER BY
    CASE la.medal WHEN 'gold' THEN 1 WHEN 'silver' THEN 2 WHEN 'bronze' THEN 3 END;
