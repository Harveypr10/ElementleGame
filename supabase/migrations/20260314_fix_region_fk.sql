-- ============================================================================
-- FIX: Re-point user_profiles.region FK to reference_countries(code)
--
-- The legacy FK pointed to a "regions" table (only UK/US), but the app's
-- region picker reads from reference_countries (179 countries). This mismatch
-- blocks ROW signups with error 23503.
--
-- Steps:
--   1. Preview any orphaned rows (region not in reference_countries)
--   2. Fix orphaned rows by defaulting to 'UK'
--   3. Drop the legacy FK
--   4. Add the new FK pointing to reference_countries(code)
-- ============================================================================

-- 1. Preview: which user_profiles rows have a region NOT in reference_countries?
--    (Run this SELECT first to see what would be affected)
SELECT up.id, up.first_name, up.region
FROM public.user_profiles up
WHERE up.region IS NOT NULL
  AND up.region NOT IN (SELECT code FROM public.reference_countries);

-- 2. Fix any orphaned rows — default them to 'UK' so the constraint succeeds
UPDATE public.user_profiles
SET region = 'UK'
WHERE region IS NOT NULL
  AND region NOT IN (SELECT code FROM public.reference_countries);

-- 3. Drop the legacy FK
ALTER TABLE public.user_profiles
DROP CONSTRAINT IF EXISTS fk_user_profiles_region;

-- 4. Add the new FK pointing to reference_countries(code)
ALTER TABLE public.user_profiles
ADD CONSTRAINT fk_user_profiles_region
FOREIGN KEY (region) REFERENCES public.reference_countries(code);
