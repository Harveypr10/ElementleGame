-- ============================================================
-- Cleanup: Remove Rogue Spec + Allocation Rows from Cron Anomaly
-- ============================================================
-- Root cause: allocate-questions auto-created category specs with
-- region='UK'/'US' because the demand used those regions, but specs
-- are now GLOBAL. This created 168 rogue spec rows and 496 rogue allocations.

-- Preview first (uncomment to verify before deleting):
-- SELECT * FROM available_question_spec WHERE category_id != 999 AND region != 'GLOBAL' AND active = true;
-- SELECT * FROM questions_allocated_region WHERE region IN ('US', 'GLOBAL') AND created_at >= '2026-03-13';

-- Step 1: Delete rogue category specs (non-GLOBAL, non-999)
DELETE FROM available_question_spec
WHERE category_id != 999
  AND region != 'GLOBAL'
  AND active = true;

-- Step 2: Delete rogue GLOBAL and US allocations from the cron runs
-- These were created on 2026-03-13 by the unintended allocator run.
-- UK allocations from before the migration are kept.
DELETE FROM questions_allocated_region
WHERE region IN ('US', 'GLOBAL')
  AND created_at >= '2026-03-13 00:00:00+00';

-- Step 3: Clean up any demand_summary rows from the rogue runs
DELETE FROM demand_summary
WHERE region IN ('US', 'GLOBAL')
  AND scope_type = 'region';

-- Step 4: Clean up any questions_to_generate rows pointing to deleted specs
UPDATE questions_to_generate
SET spec_id = NULL, status = 'retry'
WHERE spec_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM available_question_spec WHERE id = questions_to_generate.spec_id
  );

-- Verification: should all return 0
SELECT 'Rogue specs remaining' AS check,
  COUNT(*) FROM available_question_spec WHERE category_id != 999 AND region != 'GLOBAL' AND active = true;

SELECT 'Rogue GLOBAL/US allocations remaining' AS check,
  COUNT(*) FROM questions_allocated_region WHERE region IN ('US', 'GLOBAL') AND created_at >= '2026-03-13 00:00:00+00';
