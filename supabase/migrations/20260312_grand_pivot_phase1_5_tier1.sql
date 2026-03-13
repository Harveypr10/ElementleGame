-- ============================================================
-- Grand Pivot: Phase 1.5 — Universal Metadata Foundation
-- Run AFTER Phase 1 foundation, BEFORE deploying Phase 2 code.
-- ============================================================
-- NOTE: target_sphere and excluded_spheres already exist on master
-- tables from Phase 1 migration. This only adds is_tier_1.
-- NOTE: target_country was added by a prior run of this file and
-- exists in the DB but is unused. Left in place (harmless).
-- NOTE: regions is JSONB (not text[]), so we use jsonb functions.

BEGIN;

-- 1. Add is_tier_1 flag to reference_countries (idempotent)
ALTER TABLE public.reference_countries
  ADD COLUMN IF NOT EXISTS is_tier_1 boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.reference_countries.is_tier_1
  IS 'Core 6 markets that get bespoke per-country category questions (UK, US, CA, AU, NZ, IE).';

-- Set Core 6 Tier 1 countries
UPDATE public.reference_countries
  SET is_tier_1 = true
  WHERE code IN ('UK', 'US', 'CA', 'AU', 'NZ', 'IE');

-- 2. Backfill: existing user-scope category questions need regions = '["UK"]'
--    Currently they have regions = '["<user-uuid>"]' which won't match
--    any Tier 1 country code in the new Universal Metadata filter.
--    Safely targets only rows where regions is a single-element array
--    whose value looks like a UUID (8 hex chars followed by a dash).
UPDATE public.questions_master_user
  SET regions = '["UK"]'::jsonb
  WHERE question_kind = 'category'
    AND jsonb_array_length(regions) = 1
    AND (regions->>0) ~ '^[0-9a-f]{8}-';

-- Verification queries (uncomment to check):
--   SELECT is_tier_1, code, name FROM reference_countries ORDER BY is_tier_1 DESC, code;
--   SELECT regions->>0 AS first_region, COUNT(*) FROM questions_master_user WHERE question_kind = 'category' GROUP BY first_region;

COMMIT;
