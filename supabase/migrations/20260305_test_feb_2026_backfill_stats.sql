-- ============================================================================
-- TEST DATA: Backfill February 2026 snapshot with game stats
--
-- Run AFTER 20260305_league_15_snapshot_stats.sql (which adds the columns)
-- and AFTER 20260305_test_feb_2026_awards.sql (which created the snapshot rows).
--
-- This updates the existing Feb 2026 snapshot rows with real game stats.
-- ============================================================================

WITH feb_game_data AS (
    SELECT
        g.user_id,
        COUNT(DISTINCT g.allocated_region_id) AS games_played,
        COUNT(DISTINCT g.allocated_region_id) FILTER (WHERE g.result = 'won') AS games_won,
        ROUND(
            COUNT(DISTINCT g.allocated_region_id) FILTER (WHERE g.result = 'won')::numeric
            / NULLIF(COUNT(DISTINCT g.allocated_region_id), 0) * 100, 1
        ) AS win_rate,
        ROUND(
            COALESCE(SUM(CASE WHEN g.result = 'lost' THEN 6 ELSE g.num_guesses END), 0)::numeric
            / NULLIF(COUNT(DISTINCT g.allocated_region_id), 0), 1
        ) AS avg_guesses
    FROM public.game_attempts_region g
    JOIN public.questions_allocated_region qar ON qar.id = g.allocated_region_id
    WHERE g.result IN ('won', 'lost')
      AND qar.puzzle_date >= '2026-02-01'
      AND qar.puzzle_date < '2026-03-01'
    GROUP BY g.user_id
)
UPDATE public.league_standings_snapshot s
SET
    games_played = d.games_played,
    games_won = d.games_won,
    win_rate = d.win_rate,
    avg_guesses = d.avg_guesses
FROM feb_game_data d
WHERE s.user_id = d.user_id
  AND s.timeframe = 'mtd'
  AND s.period_label = '2026-02'
  AND s.game_mode = 'region';

-- Verify
SELECT
    s.rank,
    COALESCE(up.global_display_name, up.first_name, 'Player') AS name,
    s.elementle_rating AS rating,
    s.games_played AS played,
    s.win_rate,
    s.avg_guesses AS avg
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
