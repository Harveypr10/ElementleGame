-- ============================================================
-- Grand Pivot: Phase 3 — Spec Migration & Retroactive Slicing
-- Run AFTER Phase 1 + Phase 1.5, BEFORE re-enabling generation.
-- ============================================================

-- =====================
-- STEP 1: Category Spec Migration (UK → GLOBAL)
-- =====================
-- Category specs (category_id != 999) move to GLOBAL region.
-- UK location specs (category_id = 999) keep region = 'UK'.
-- Does NOT touch 'active', so trg_archive_inactive_spec will NOT fire.

BEGIN;

UPDATE available_question_spec
  SET region = 'GLOBAL', updated_at = now()
  WHERE region = 'UK' AND category_id != 999;

UPDATE available_question_spec_archive
  SET region = 'GLOBAL'
  WHERE region = 'UK' AND category_id != 999;

COMMIT;

-- =====================
-- STEP 2: Seed New Location Specs
-- =====================
-- One full-range spec per US State and per active ROW country.
-- UK already has per-populated-place specs, US gets per-state, ROW gets per-country.

BEGIN;

-- Drop FK that requires location values to exist in populated_places.
-- This FK was designed for UK-only populated places (osgb* IDs).
-- US state specs use location='US-TX' which isn't in populated_places.
ALTER TABLE available_question_spec DROP CONSTRAINT IF EXISTS fk_aqs_location;
ALTER TABLE available_question_spec_archive DROP CONSTRAINT IF EXISTS fk_aqs_archive_location;

-- US States: region='US', location=state_code (e.g. 'US-TX')
INSERT INTO available_question_spec
  (start_date, end_date, region, category_id, location, active, created_at, updated_at)
SELECT '0001-01-01'::date, '9999-01-01'::date, 'US', 999, code, true, now(), now()
FROM reference_us_states
WHERE NOT EXISTS (
  SELECT 1 FROM available_question_spec aqs
  WHERE aqs.region = 'US' AND aqs.category_id = 999 AND aqs.location = reference_us_states.code
);

-- ROW Countries: region=country_code, location=NULL
-- Exclude UK (has populated_place specs) and US (has state specs)
INSERT INTO available_question_spec
  (start_date, end_date, region, category_id, location, active, created_at, updated_at)
SELECT '0001-01-01'::date, '9999-01-01'::date, code, 999, NULL, true, now(), now()
FROM reference_countries
WHERE active = true
  AND code NOT IN ('UK', 'US')
  AND NOT EXISTS (
    SELECT 1 FROM available_question_spec aqs
    WHERE aqs.region = reference_countries.code AND aqs.category_id = 999 AND aqs.location IS NULL
  );

COMMIT;

-- =====================
-- STEP 3: Retroactive Location Slicing
-- =====================
-- For every existing category question, slice its date out of the matching
-- location spec (by event_origin). Preserves the exact split math from the
-- existing triggers (near_threshold = 3 days).
--
-- Pattern per date:
--   1. Find covering location spec
--   2. Detach any jobs (should be none during migration)
--   3. Set active=false (triggers archive cascade → archives + deletes)
--   4. Insert child specs

DO $$
DECLARE
  rec RECORD;
  spec_rec RECORD;
  q_date date;
  s_date date;
  e_date date;
  near_threshold int := 3;
  sliced_count int := 0;
  ww_spec RECORD;
BEGIN
  RAISE NOTICE '[Phase3:Slice] Starting retroactive location slicing...';

  -- ---- Non-WW dates ----
  FOR rec IN
    SELECT DISTINCT event_origin, answer_date_canonical
    FROM (
      SELECT event_origin, answer_date_canonical
        FROM questions_master_user WHERE question_kind = 'category'
      UNION
      SELECT event_origin, answer_date_canonical
        FROM questions_master_region WHERE question_kind = 'category'
    ) q
    WHERE event_origin IS NOT NULL
      AND event_origin NOT IN ('WW', 'UK', 'US')
    ORDER BY event_origin, answer_date_canonical
  LOOP
    q_date := rec.answer_date_canonical;

    -- ROW or US-state lookup: match by event_origin
    SELECT id, start_date, end_date, region, location
      INTO spec_rec
      FROM available_question_spec
     WHERE category_id = 999
       AND active = true
       AND q_date BETWEEN start_date AND end_date
       AND (
         (region = rec.event_origin AND location IS NULL)
         OR (region = 'US' AND location = rec.event_origin)
       )
     LIMIT 1;

    IF spec_rec.id IS NULL THEN
      CONTINUE;
    END IF;

    -- Detach jobs (should be none)
    UPDATE questions_to_generate SET spec_id = NULL WHERE spec_id = spec_rec.id;

    s_date := spec_rec.start_date;
    e_date := spec_rec.end_date;

    -- Deactivate → triggers archive cascade
    UPDATE available_question_spec
       SET active = false, deactivate_reason = 'retroactive location slice', updated_at = now()
     WHERE id = spec_rec.id;

    -- Create children
    IF q_date <= s_date + make_interval(days => near_threshold) THEN
      IF q_date < e_date THEN
        INSERT INTO available_question_spec
          (start_date, end_date, region, category_id, location, active, created_at, updated_at)
        VALUES
          (q_date + interval '1 day', e_date, spec_rec.region, 999, spec_rec.location, true, now(), now());
      END IF;
    ELSIF q_date >= e_date - make_interval(days => near_threshold) THEN
      IF q_date > s_date THEN
        INSERT INTO available_question_spec
          (start_date, end_date, region, category_id, location, active, created_at, updated_at)
        VALUES
          (s_date, q_date - interval '1 day', spec_rec.region, 999, spec_rec.location, true, now(), now());
      END IF;
    ELSE
      IF q_date > s_date THEN
        INSERT INTO available_question_spec
          (start_date, end_date, region, category_id, location, active, created_at, updated_at)
        VALUES
          (s_date, q_date - interval '1 day', spec_rec.region, 999, spec_rec.location, true, now(), now());
      END IF;
      IF q_date < e_date THEN
        INSERT INTO available_question_spec
          (start_date, end_date, region, category_id, location, active, created_at, updated_at)
        VALUES
          (q_date + interval '1 day', e_date, spec_rec.region, 999, spec_rec.location, true, now(), now());
      END IF;
    END IF;

    sliced_count := sliced_count + 1;
  END LOOP;

  RAISE NOTICE '[Phase3:Slice] Non-WW slices done: %', sliced_count;

  -- ---- WW fan-out dates ----
  FOR rec IN
    SELECT DISTINCT answer_date_canonical
    FROM (
      SELECT answer_date_canonical FROM questions_master_user
       WHERE question_kind = 'category' AND event_origin = 'WW'
      UNION
      SELECT answer_date_canonical FROM questions_master_region
       WHERE question_kind = 'category' AND event_origin = 'WW'
    ) q
    ORDER BY answer_date_canonical
  LOOP
    q_date := rec.answer_date_canonical;

    FOR ww_spec IN
      SELECT id, start_date, end_date, region, location
        FROM available_question_spec
       WHERE category_id = 999
         AND active = true
         AND q_date BETWEEN start_date AND end_date
    LOOP
      UPDATE questions_to_generate SET spec_id = NULL WHERE spec_id = ww_spec.id;

      s_date := ww_spec.start_date;
      e_date := ww_spec.end_date;

      UPDATE available_question_spec
         SET active = false, deactivate_reason = 'retroactive location slice (WW)', updated_at = now()
       WHERE id = ww_spec.id;

      IF q_date <= s_date + make_interval(days => near_threshold) THEN
        IF q_date < e_date THEN
          INSERT INTO available_question_spec
            (start_date, end_date, region, category_id, location, active, created_at, updated_at)
          VALUES
            (q_date + interval '1 day', e_date, ww_spec.region, 999, ww_spec.location, true, now(), now());
        END IF;
      ELSIF q_date >= e_date - make_interval(days => near_threshold) THEN
        IF q_date > s_date THEN
          INSERT INTO available_question_spec
            (start_date, end_date, region, category_id, location, active, created_at, updated_at)
          VALUES
            (s_date, q_date - interval '1 day', ww_spec.region, 999, ww_spec.location, true, now(), now());
        END IF;
      ELSE
        IF q_date > s_date THEN
          INSERT INTO available_question_spec
            (start_date, end_date, region, category_id, location, active, created_at, updated_at)
          VALUES
            (s_date, q_date - interval '1 day', ww_spec.region, 999, ww_spec.location, true, now(), now());
        END IF;
        IF q_date < e_date THEN
          INSERT INTO available_question_spec
            (start_date, end_date, region, category_id, location, active, created_at, updated_at)
          VALUES
            (q_date + interval '1 day', e_date, ww_spec.region, 999, ww_spec.location, true, now(), now());
        END IF;
      END IF;

      sliced_count := sliced_count + 1;
    END LOOP;
  END LOOP;

  RAISE NOTICE '[Phase3:Slice] Total slices (incl WW fan-out): %', sliced_count;
END;
$$;
