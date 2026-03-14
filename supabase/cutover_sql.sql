-- =============================================================================
-- GLOBAL LAUNCH CUT-OVER SQL
-- Run these commands manually in order during the cutover window.
-- =============================================================================

-- =============================================================================
-- STEP 1: Add is_legacy_tester column to user_profiles
-- Safe to run at any time — no impact on live app.
-- =============================================================================

ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS is_legacy_tester BOOLEAN DEFAULT false;

-- Mark ALL existing users as legacy testers (they are the ~20 TestFlight users)
UPDATE public.user_profiles
  SET is_legacy_tester = true;


-- =============================================================================
-- STEP 2: Drop FK constraints (for testing new US/ROW users)
-- WARNING: This will break PostgREST JOINs used by the LEGACY app.
--          Legacy users will NOT be able to play USER mode until FKs are re-added.
-- =============================================================================

-- Drop FK on questions_master_user (used by User mode location JOINs)
ALTER TABLE public.questions_master_user
  DROP CONSTRAINT IF EXISTS fk_qmu_pop_place;

-- Drop FK on questions_master_region (region questions don't use location)
ALTER TABLE public.questions_master_region
  DROP CONSTRAINT IF EXISTS fk_qmr_pop_place;

-- Reload PostgREST schema cache so it stops inferring the dropped relationships
NOTIFY pgrst, 'reload schema';


-- =============================================================================
-- STEP 3: Re-add FK constraints (to restore legacy app functionality)
-- Run this AFTER you've finished testing, to let legacy users play again.
-- WARNING: Will fail if any questions_master_user rows have populated_place_id
--          values that don't exist in populated_places (e.g. 'US-TX').
--          You may need to clean up test data first:
--
--   DELETE FROM questions_master_user
--     WHERE populated_place_id NOT IN (SELECT id FROM populated_places)
--       AND populated_place_id IS NOT NULL;
-- =============================================================================

-- Re-add FK on questions_master_user
ALTER TABLE public.questions_master_user
  ADD CONSTRAINT fk_qmu_pop_place
  FOREIGN KEY (populated_place_id) REFERENCES public.populated_places(id);

-- Re-add FK on questions_master_region
ALTER TABLE public.questions_master_region
  ADD CONSTRAINT fk_qmr_pop_place
  FOREIGN KEY (populated_place_id) REFERENCES public.populated_places(id);

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';


-- =============================================================================
-- STEP 4: FINAL DROP (run only after the NEW app is live in the App Store)
-- =============================================================================
-- Once the new app is deployed and users have updated, permanently drop the FKs:
--
-- ALTER TABLE public.questions_master_user
--   DROP CONSTRAINT IF EXISTS fk_qmu_pop_place;
--
-- ALTER TABLE public.questions_master_region
--   DROP CONSTRAINT IF EXISTS fk_qmr_pop_place;
--
-- NOTIFY pgrst, 'reload schema';
