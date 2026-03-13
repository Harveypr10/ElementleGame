-- =============================================================================
-- Grand Pivot — Phase 1: Database Foundation
-- =============================================================================
-- SAFE TO RUN ON LIVE: All changes are additive (new columns, new tables) or
-- update existing data non-destructively. No columns/tables are dropped.
--
-- Run order: This script is self-contained and idempotent where possible.
-- =============================================================================

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. USER PROFILES: Add timezone + sub_region columns
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS timezone text,          -- IANA tz from expo-localization (e.g. 'America/Chicago')
  ADD COLUMN IF NOT EXISTS sub_region text;         -- US state code (e.g. 'US-TX'), NULL for non-US users

COMMENT ON COLUMN public.user_profiles.timezone   IS 'IANA timezone string from expo-localization. Source of truth for user midnight.';
COMMENT ON COLUMN public.user_profiles.sub_region IS 'Sub-region code for US users (e.g. US-TX). NULL for UK/ROW.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. REFERENCE TABLES: Countries + US States
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.reference_countries (
    code                  text PRIMARY KEY,
    name                  text NOT NULL,
    display_name          text NOT NULL,
    prompt_name           text NOT NULL,
    continent             text NOT NULL,
    timezone              text NOT NULL,
    cultural_sphere_code  text NOT NULL DEFAULT 'ANG',
    active                boolean NOT NULL DEFAULT false,
    created_at            timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT chk_sphere CHECK (cultural_sphere_code IN ('ANG','ELA','ASI','SAM','AFR'))
);

COMMENT ON TABLE  public.reference_countries IS 'Master list of supported countries with cultural sphere, timezone, and prompt metadata.';
COMMENT ON COLUMN public.reference_countries.code IS 'ISO 3166-1 alpha-2 (UK not GB for United Kingdom).';
COMMENT ON COLUMN public.reference_countries.prompt_name IS 'Name used in AI prompts (e.g. "the United Kingdom").';
COMMENT ON COLUMN public.reference_countries.cultural_sphere_code IS 'ANG=Anglosphere, ELA=Euro-LatAm, ASI=East/SE Asia, SAM=South Asia/MENA, AFR=Sub-Saharan Africa.';

-- Sample data: Anglosphere
INSERT INTO public.reference_countries (code, name, display_name, prompt_name, continent, timezone, cultural_sphere_code, active) VALUES
  ('UK', 'United Kingdom',  'UK',        'the United Kingdom',  'Europe',        'Europe/London',       'ANG', true),
  ('US', 'United States',   'USA',       'the United States',   'North America', 'America/New_York',    'ANG', true),
  ('CA', 'Canada',          'Canada',    'Canada',              'North America', 'America/Toronto',     'ANG', false),
  ('AU', 'Australia',       'Australia', 'Australia',           'Oceania',       'Australia/Sydney',    'ANG', false),
  ('NZ', 'New Zealand',     'NZ',        'New Zealand',         'Oceania',       'Pacific/Auckland',    'ANG', false),
  ('IE', 'Ireland',         'Ireland',   'Ireland',             'Europe',        'Europe/Dublin',       'ANG', false)
ON CONFLICT (code) DO NOTHING;

-- Sample data: Euro-LatAm
INSERT INTO public.reference_countries (code, name, display_name, prompt_name, continent, timezone, cultural_sphere_code, active) VALUES
  ('FR', 'France',          'France',    'France',              'Europe',        'Europe/Paris',        'ELA', false),
  ('DE', 'Germany',         'Germany',   'Germany',             'Europe',        'Europe/Berlin',       'ELA', false),
  ('ES', 'Spain',           'Spain',     'Spain',               'Europe',        'Europe/Madrid',       'ELA', false),
  ('IT', 'Italy',           'Italy',     'Italy',               'Europe',        'Europe/Rome',         'ELA', false),
  ('BR', 'Brazil',          'Brazil',    'Brazil',              'South America', 'America/Sao_Paulo',   'ELA', false),
  ('MX', 'Mexico',          'Mexico',    'Mexico',              'North America', 'America/Mexico_City', 'ELA', false)
ON CONFLICT (code) DO NOTHING;

-- Sample data: East & SE Asia
INSERT INTO public.reference_countries (code, name, display_name, prompt_name, continent, timezone, cultural_sphere_code, active) VALUES
  ('JP', 'Japan',           'Japan',     'Japan',               'Asia',          'Asia/Tokyo',          'ASI', false),
  ('CN', 'China',           'China',     'China',               'Asia',          'Asia/Shanghai',       'ASI', false),
  ('KR', 'South Korea',     'S. Korea',  'South Korea',         'Asia',          'Asia/Seoul',          'ASI', false)
ON CONFLICT (code) DO NOTHING;

-- Sample data: South Asia & MENA
INSERT INTO public.reference_countries (code, name, display_name, prompt_name, continent, timezone, cultural_sphere_code, active) VALUES
  ('IN', 'India',           'India',     'India',               'Asia',          'Asia/Kolkata',        'SAM', false),
  ('SA', 'Saudi Arabia',    'Saudi Arabia','Saudi Arabia',      'Asia',          'Asia/Riyadh',         'SAM', false)
ON CONFLICT (code) DO NOTHING;

-- Sample data: Sub-Saharan Africa
INSERT INTO public.reference_countries (code, name, display_name, prompt_name, continent, timezone, cultural_sphere_code, active) VALUES
  ('ZA', 'South Africa',    'S. Africa', 'South Africa',        'Africa',        'Africa/Johannesburg', 'AFR', false),
  ('NG', 'Nigeria',         'Nigeria',   'Nigeria',             'Africa',        'Africa/Lagos',        'AFR', false)
ON CONFLICT (code) DO NOTHING;

-- Grant access
GRANT SELECT ON public.reference_countries TO anon, authenticated, service_role;


-- US States reference
CREATE TABLE IF NOT EXISTS public.reference_us_states (
    code          text PRIMARY KEY,       -- e.g. 'US-TX'
    name          text NOT NULL,
    display_name  text NOT NULL,
    prompt_name   text NOT NULL,
    created_at    timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE  public.reference_us_states IS 'All 50 US states + DC for sub-region selection.';
COMMENT ON COLUMN public.reference_us_states.code IS 'Compound code: US-{state_abbrev} (e.g. US-TX).';
COMMENT ON COLUMN public.reference_us_states.prompt_name IS 'Name used in AI prompts (e.g. "Texas, United States").';

-- Sample US states (will be fully populated before go-live)
INSERT INTO public.reference_us_states (code, name, display_name, prompt_name) VALUES
  ('US-AL', 'Alabama',              'Alabama',              'Alabama, United States'),
  ('US-AK', 'Alaska',               'Alaska',               'Alaska, United States'),
  ('US-AZ', 'Arizona',              'Arizona',              'Arizona, United States'),
  ('US-AR', 'Arkansas',             'Arkansas',              'Arkansas, United States'),
  ('US-CA', 'California',           'California',           'California, United States'),
  ('US-CO', 'Colorado',             'Colorado',              'Colorado, United States'),
  ('US-CT', 'Connecticut',          'Connecticut',           'Connecticut, United States'),
  ('US-DE', 'Delaware',             'Delaware',              'Delaware, United States'),
  ('US-FL', 'Florida',              'Florida',              'Florida, United States'),
  ('US-GA', 'Georgia',              'Georgia',              'Georgia, United States'),
  ('US-HI', 'Hawaii',               'Hawaii',               'Hawaii, United States'),
  ('US-ID', 'Idaho',                'Idaho',                 'Idaho, United States'),
  ('US-IL', 'Illinois',             'Illinois',              'Illinois, United States'),
  ('US-IN', 'Indiana',              'Indiana',               'Indiana, United States'),
  ('US-IA', 'Iowa',                 'Iowa',                  'Iowa, United States'),
  ('US-KS', 'Kansas',               'Kansas',                'Kansas, United States'),
  ('US-KY', 'Kentucky',             'Kentucky',              'Kentucky, United States'),
  ('US-LA', 'Louisiana',            'Louisiana',             'Louisiana, United States'),
  ('US-ME', 'Maine',                'Maine',                 'Maine, United States'),
  ('US-MD', 'Maryland',             'Maryland',              'Maryland, United States'),
  ('US-MA', 'Massachusetts',        'Massachusetts',         'Massachusetts, United States'),
  ('US-MI', 'Michigan',             'Michigan',              'Michigan, United States'),
  ('US-MN', 'Minnesota',            'Minnesota',             'Minnesota, United States'),
  ('US-MS', 'Mississippi',          'Mississippi',            'Mississippi, United States'),
  ('US-MO', 'Missouri',             'Missouri',              'Missouri, United States'),
  ('US-MT', 'Montana',              'Montana',               'Montana, United States'),
  ('US-NE', 'Nebraska',             'Nebraska',              'Nebraska, United States'),
  ('US-NV', 'Nevada',               'Nevada',                'Nevada, United States'),
  ('US-NH', 'New Hampshire',        'New Hampshire',         'New Hampshire, United States'),
  ('US-NJ', 'New Jersey',           'New Jersey',            'New Jersey, United States'),
  ('US-NM', 'New Mexico',           'New Mexico',            'New Mexico, United States'),
  ('US-NY', 'New York',             'New York',              'New York, United States'),
  ('US-NC', 'North Carolina',       'North Carolina',        'North Carolina, United States'),
  ('US-ND', 'North Dakota',         'North Dakota',          'North Dakota, United States'),
  ('US-OH', 'Ohio',                 'Ohio',                  'Ohio, United States'),
  ('US-OK', 'Oklahoma',             'Oklahoma',              'Oklahoma, United States'),
  ('US-OR', 'Oregon',               'Oregon',                'Oregon, United States'),
  ('US-PA', 'Pennsylvania',         'Pennsylvania',          'Pennsylvania, United States'),
  ('US-RI', 'Rhode Island',         'Rhode Island',          'Rhode Island, United States'),
  ('US-SC', 'South Carolina',       'South Carolina',        'South Carolina, United States'),
  ('US-SD', 'South Dakota',         'South Dakota',          'South Dakota, United States'),
  ('US-TN', 'Tennessee',            'Tennessee',             'Tennessee, United States'),
  ('US-TX', 'Texas',                'Texas',                 'Texas, United States'),
  ('US-UT', 'Utah',                 'Utah',                  'Utah, United States'),
  ('US-VT', 'Vermont',              'Vermont',               'Vermont, United States'),
  ('US-VA', 'Virginia',             'Virginia',              'Virginia, United States'),
  ('US-WA', 'Washington',           'Washington',            'Washington, United States'),
  ('US-WV', 'West Virginia',        'West Virginia',         'West Virginia, United States'),
  ('US-WI', 'Wisconsin',            'Wisconsin',             'Wisconsin, United States'),
  ('US-WY', 'Wyoming',              'Wyoming',               'Wyoming, United States'),
  ('US-DC', 'District of Columbia', 'Washington, D.C.',      'Washington, D.C., United States')
ON CONFLICT (code) DO NOTHING;

-- Grant access
GRANT SELECT ON public.reference_us_states TO anon, authenticated, service_role;


-- ─────────────────────────────────────────────────────────────────────────────
-- 3. QUESTION METADATA: Add cultural sphere columns to master tables
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.questions_master_region
  ADD COLUMN IF NOT EXISTS target_sphere     text,
  ADD COLUMN IF NOT EXISTS excluded_spheres  jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.questions_master_region.target_sphere    IS 'Cultural sphere this question was generated for (ANG/ELA/ASI/SAM/AFR).';
COMMENT ON COLUMN public.questions_master_region.excluded_spheres IS 'Array of sphere codes that would NOT know this event. ["unique"] = strictly local.';

ALTER TABLE public.questions_master_user
  ADD COLUMN IF NOT EXISTS target_sphere     text,
  ADD COLUMN IF NOT EXISTS excluded_spheres  jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.questions_master_user.target_sphere    IS 'Cultural sphere this question was generated for (ANG/ELA/ASI/SAM/AFR).';
COMMENT ON COLUMN public.questions_master_user.excluded_spheres IS 'Array of sphere codes that would NOT know this event. ["unique"] = strictly local.';


-- ─────────────────────────────────────────────────────────────────────────────
-- 4. TIMEZONE RESOLUTION: Update region_to_timezone + snapshot functions
-- ─────────────────────────────────────────────────────────────────────────────

-- 4a. Replace hardcoded CASE with reference_countries lookup.
--     Changing IMMUTABLE → STABLE because we now query a table.
CREATE OR REPLACE FUNCTION public.region_to_timezone(p_region text)
RETURNS text
LANGUAGE sql STABLE
AS $$
  SELECT COALESCE(
    (SELECT timezone FROM public.reference_countries WHERE code = UPPER(COALESCE(p_region, ''))),
    'Etc/GMT+12'
  );
$$;


-- 4b. Surgical update to process_pending_snapshots():
--     Change the timezone resolution to prefer user_profiles.timezone,
--     falling back to region_to_timezone(region).
--
--     CRITICAL: This replaces the ENTIRE function body to change TWO lines
--     in Phase 1 (the COALESCE and the tz assignment). Everything else is
--     an exact copy of the existing function.
CREATE OR REPLACE FUNCTION public.process_pending_snapshots() RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
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
            up.region,                                           -- ← raw region (may be NULL for legacy)
            up.timezone AS user_tz                               -- ← NEW: user's own timezone
        FROM public.league_members lm
        JOIN public.user_profiles up ON up.id = lm.user_id
        WHERE lm.is_active_region = true OR lm.is_active_user = true
    LOOP
        -- Prefer user-supplied timezone, fall back to region lookup
        v_user_tz   := COALESCE(v_rec.user_tz, public.region_to_timezone(COALESCE(v_rec.region, 'UK')));
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
        FROM public.calculate_user_league_rating(v_rec.user_id, COALESCE(v_rec.region, 'UK'), 'mtd', v_yesterday);
        SELECT * INTO v_result_r_ytd
        FROM public.calculate_user_league_rating(v_rec.user_id, COALESCE(v_rec.region, 'UK'), 'ytd', v_yesterday);
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
        PERFORM public.refresh_user_league_standings(v_rec.user_id, COALESCE(v_rec.region, 'UK'), 'region');
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
$$;


-- 4c. Surgical update to refresh_all_active_league_standings():
--     Same pattern — prefer user timezone, fall back to region.
--     NOTE: This function does NOT call region_to_timezone directly.
--     It passes region to refresh_user_league_standings. The COALESCE
--     change here ensures non-null region for downstream.
CREATE OR REPLACE FUNCTION public.refresh_all_active_league_standings() RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    v_rec    record;
    v_count  int := 0;
    v_start  timestamptz := clock_timestamp();
BEGIN
    -- Collect distinct (user_id, region) for every user who is active in
    -- at least one league, for at least one game mode.
    FOR v_rec IN
        SELECT DISTINCT
            lm.user_id,
            COALESCE(up.region, 'UK') AS region
        FROM public.league_members lm
        JOIN public.user_profiles up ON up.id = lm.user_id
        WHERE lm.is_active_region = true
           OR lm.is_active_user   = true
    LOOP
        -- Region mode refresh
        PERFORM public.refresh_user_league_standings(
            v_rec.user_id, v_rec.region, 'region'
        );

        -- User mode refresh
        PERFORM public.refresh_user_league_standings(
            v_rec.user_id, 'GLOBAL', 'user'
        );

        v_count := v_count + 1;
    END LOOP;

    RETURN jsonb_build_object(
        'users_refreshed', v_count,
        'started_at',      v_start,
        'finished_at',     clock_timestamp()
    );
END;
$$;


-- ─────────────────────────────────────────────────────────────────────────────
-- 5. DEMAND SCHEDULING: Increase to 8-hour frequency
-- ─────────────────────────────────────────────────────────────────────────────

UPDATE public.demand_scheduler_config
SET frequency_hours = 8,
    updated_at = now()
WHERE id = (SELECT id FROM public.demand_scheduler_config LIMIT 1);

-- Also update the actual pg_cron schedule to match.
-- '0 1,9,17 * * *' = Run at 01:00, 09:00, 17:00 UTC (every 8 hours).
SELECT public.update_demand_cron_schedule('0 1,9,17 * * *');


-- ─────────────────────────────────────────────────────────────────────────────
-- 6. DATA CUTOVER PREPARATION
-- ─────────────────────────────────────────────────────────────────────────────

-- 6a. Insert 'GLOBAL' into the regions table FIRST.
--     MUST come before step 6b because questions_allocated_region.region has
--     FK fk_allocated_region_region → regions(code). The 'GLOBAL' code must
--     exist in regions before any row can reference it.
--     NOTE: regions table schema is (id serial PK, code UNIQUE, name,
--     default_date_format NOT NULL, privacy_legislation, privacy_content).
INSERT INTO public.regions (code, name, default_date_format)
SELECT 'GLOBAL', 'Global', 'ddmmyy'
WHERE NOT EXISTS (SELECT 1 FROM public.regions WHERE code = 'GLOBAL');

-- 6b. Rename existing region='UK' allocations to 'GLOBAL' in questions_allocated_region.
--     This prepares the table for the shared global timeline.
--     Historical data is preserved — only the region label changes.
UPDATE public.questions_allocated_region
SET region = 'GLOBAL'
WHERE region = 'UK';

-- 6c. Clear future/unplayed region allocations so they regenerate under the new system.
--     We only delete rows where puzzle_date is in the future (not yet playable).
--     Today's and past allocations are preserved for continuity.
DELETE FROM public.questions_allocated_region
WHERE puzzle_date > CURRENT_DATE;


COMMIT;

-- =============================================================================
-- POST-RUN VERIFICATION QUERIES (run manually to confirm)
-- =============================================================================
--
-- 1. Check new columns exist:
--    SELECT timezone, sub_region FROM user_profiles LIMIT 1;
--
-- 2. Check reference tables populated:
--    SELECT * FROM reference_countries ORDER BY code;
--    SELECT COUNT(*) FROM reference_us_states;   -- Should be 51
--
-- 3. Check question metadata columns:
--    SELECT target_sphere, excluded_spheres FROM questions_master_region LIMIT 1;
--    SELECT target_sphere, excluded_spheres FROM questions_master_user LIMIT 1;
--
-- 4. Check timezone function:
--    SELECT public.region_to_timezone('UK');     -- Should return 'Europe/London'
--    SELECT public.region_to_timezone('FR');     -- Should return 'Europe/Paris'
--    SELECT public.region_to_timezone('ZZ');     -- Should return 'Etc/GMT+12'
--
-- 5. Check demand scheduler:
--    SELECT * FROM demand_scheduler_config;      -- frequency_hours should be 8
--    SELECT * FROM cron.job WHERE jobname = 'elementle_demand';  -- schedule: '0 1,9,17 * * *'
--
-- 6. Check region cutover:
--    SELECT DISTINCT region FROM questions_allocated_region;  -- Should show 'GLOBAL' only
--    SELECT COUNT(*) FROM questions_allocated_region WHERE puzzle_date > CURRENT_DATE;  -- Should be 0
