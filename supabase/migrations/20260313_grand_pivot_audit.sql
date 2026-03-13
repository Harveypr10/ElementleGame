-- ============================================================
-- Grand Pivot: Post-Migration Audit
-- Read-only checks on available_question_spec integrity
-- ============================================================

-- =====================
-- CHECK 1: Overlapping Active Specs
-- =====================
-- Two active specs for the same (region, location, category_id) must NOT
-- have overlapping date ranges. Zero rows = healthy.

SELECT
  'OVERLAP' AS check_type,
  a.id AS spec_a_id,
  b.id AS spec_b_id,
  a.region,
  a.location,
  a.category_id,
  a.start_date AS a_start, a.end_date AS a_end,
  b.start_date AS b_start, b.end_date AS b_end
FROM available_question_spec a
JOIN available_question_spec b
  ON a.id < b.id
  AND a.region = b.region
  AND a.category_id = b.category_id
  AND (
    (a.location IS NULL AND b.location IS NULL)
    OR a.location = b.location
  )
  AND a.active = true
  AND b.active = true
  AND a.start_date <= b.end_date
  AND b.start_date <= a.end_date;


-- =====================
-- CHECK 2: Invalid Schema Patterns
-- =====================
-- Category specs (category_id != 999) must have region = 'GLOBAL'.
-- Location specs (category_id = 999) must NOT have region = 'GLOBAL'.

SELECT 'CAT_NOT_GLOBAL' AS check_type, id, region, category_id, location
FROM available_question_spec
WHERE category_id != 999 AND region != 'GLOBAL' AND active = true;

SELECT 'LOC_IS_GLOBAL' AS check_type, id, region, category_id, location
FROM available_question_spec
WHERE category_id = 999 AND region = 'GLOBAL' AND active = true;


-- =====================
-- CHECK 3: Category Slice Verification
-- =====================
-- For every category question in questions_master_user, verify its date
-- is NOT covered by an active GLOBAL spec for any of its categories.
-- Zero rows = all dates correctly sliced out.

SELECT
  'UNSLICED_USER_CAT' AS check_type,
  qmu.id AS question_id,
  qmu.answer_date_canonical,
  cat_id::int AS category_id,
  aqs.id AS covering_spec_id,
  aqs.start_date,
  aqs.end_date
FROM questions_master_user qmu
CROSS JOIN LATERAL jsonb_array_elements_text(qmu.categories) AS cat_id
JOIN available_question_spec aqs
  ON aqs.region = 'GLOBAL'
  AND aqs.category_id = cat_id::int
  AND aqs.location IS NULL
  AND aqs.active = true
  AND qmu.answer_date_canonical BETWEEN aqs.start_date AND aqs.end_date
WHERE qmu.question_kind = 'category'
  AND cat_id::int != 999;

-- Same check for questions_master_region
SELECT
  'UNSLICED_REGION_CAT' AS check_type,
  qmr.id AS question_id,
  qmr.answer_date_canonical,
  cat_id::int AS category_id,
  aqs.id AS covering_spec_id,
  aqs.start_date,
  aqs.end_date
FROM questions_master_region qmr
CROSS JOIN LATERAL jsonb_array_elements_text(qmr.categories) AS cat_id
JOIN available_question_spec aqs
  ON aqs.region = 'GLOBAL'
  AND aqs.category_id = cat_id::int
  AND aqs.location IS NULL
  AND aqs.active = true
  AND qmr.answer_date_canonical BETWEEN aqs.start_date AND aqs.end_date
WHERE qmr.question_kind = 'category'
  AND cat_id::int != 999;


-- =====================
-- CHECK 4: Location Slice Verification
-- =====================
-- For ROW category questions (event_origin NOT IN WW/UK/US), verify
-- NO active location spec covers their date for their event_origin.
-- Zero rows = all dates correctly sliced out.

SELECT
  'UNSLICED_LOC_ROW' AS check_type,
  q.id AS question_id,
  q.source_table,
  q.answer_date_canonical,
  q.event_origin,
  aqs.id AS covering_spec_id,
  aqs.region AS spec_region,
  aqs.start_date,
  aqs.end_date
FROM (
  SELECT id, answer_date_canonical, event_origin, 'user' AS source_table
  FROM questions_master_user
  WHERE question_kind = 'category'
    AND event_origin IS NOT NULL
    AND event_origin NOT IN ('WW', 'UK', 'US')
  UNION ALL
  SELECT id, answer_date_canonical, event_origin, 'region' AS source_table
  FROM questions_master_region
  WHERE question_kind = 'category'
    AND event_origin IS NOT NULL
    AND event_origin NOT IN ('WW', 'UK', 'US')
) q
JOIN available_question_spec aqs
  ON aqs.category_id = 999
  AND aqs.active = true
  AND q.answer_date_canonical BETWEEN aqs.start_date AND aqs.end_date
  AND (
    (aqs.region = q.event_origin AND aqs.location IS NULL)
    OR (aqs.region = 'US' AND aqs.location = q.event_origin)
  );


-- =====================
-- SUMMARY COUNTS (for quick overview)
-- =====================
SELECT 'Active category specs (GLOBAL)' AS metric,
       COUNT(*) AS count
FROM available_question_spec
WHERE category_id != 999 AND active = true;

SELECT 'Active location specs (by region)' AS metric,
       region, COUNT(*) AS count
FROM available_question_spec
WHERE category_id = 999 AND active = true
GROUP BY region
ORDER BY count DESC
LIMIT 20;

SELECT 'Archived specs (total)' AS metric,
       COUNT(*) AS count
FROM available_question_spec_archive;

SELECT 'User master questions (category)' AS metric,
       COUNT(*) AS count
FROM questions_master_user
WHERE question_kind = 'category';

SELECT 'Region master questions (category)' AS metric,
       COUNT(*) AS count
FROM questions_master_region
WHERE question_kind = 'category';
