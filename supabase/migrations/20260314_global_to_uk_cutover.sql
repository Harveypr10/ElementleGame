-- ============================================================
-- Grand Pivot: Final Cutover — GLOBAL → UK
-- ============================================================
-- Strategic simplification: the 'UK' region key is now the single
-- unified global game. Category specs, allocations, demand, and
-- the spec-splitting triggers all switch from 'GLOBAL' to 'UK'.
--
-- IMPORTANT: The 1-Way Location Split logic is UNTOUCHED.
-- It uses dynamic region values from the covering spec (loc_spec.region)
-- and does NOT hardcode any region value.
-- ============================================================

-- =====================
-- PART 1: DATA MIGRATION
-- =====================
-- Convert all existing GLOBAL rows back to UK.

BEGIN;

-- 1a. Category specs (active + inactive)
UPDATE available_question_spec
   SET region = 'UK', updated_at = now()
 WHERE region = 'GLOBAL';

UPDATE available_question_spec_archive
   SET region = 'UK'
 WHERE region = 'GLOBAL';

-- 1b. Region game allocations
UPDATE questions_allocated_region
   SET region = 'UK'
 WHERE region = 'GLOBAL';

-- 1c. Demand summary rows
UPDATE demand_summary
   SET scope_id = 'UK', region = 'UK'
 WHERE scope_id = 'GLOBAL';

-- 1d. Pending generation jobs
UPDATE questions_to_generate
   SET region = 'UK', scope_id = 'UK'
 WHERE region = 'GLOBAL' OR scope_id = 'GLOBAL';

COMMIT;


-- =====================
-- PART 2: TRIGGER FUNCTIONS (Surgical Update)
-- =====================
-- Only the category branch GLOBAL references change to UK.
-- Location split logic is identical to Phase 3 (UNTOUCHED).


-- ======================
-- trg_split_user_specs
-- ======================
-- Fires AFTER INSERT on questions_master_user.

CREATE OR REPLACE FUNCTION "public"."trg_split_user_specs"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
declare
  q_date date := new.answer_date_canonical::date;
  c_placeholder_id int := 999;
  spec_rec record;
  loc_spec record;
  s_date date;
  e_date date;
  cat int;
  new_spec1_id bigint;
  new_spec2_id bigint;
  near_threshold int := 3;
  v_region text;
  v_location text;
begin
  if new.question_kind = 'location' then
    -- ========== LOCATION SPLIT ==========
    -- Determine covering spec based on populated_place_id format
    if new.populated_place_id like 'osgb%' then
      -- UK: match by populated_place_id
      select id, start_date, end_date, region, location
      into spec_rec
      from available_question_spec
      where region = 'UK'
        and category_id = c_placeholder_id
        and location = new.populated_place_id
        and active = true
        and q_date between start_date and end_date
      limit 1;
    elsif new.populated_place_id like 'US-%' then
      -- US: match by state code in location
      select id, start_date, end_date, region, location
      into spec_rec
      from available_question_spec
      where region = 'US'
        and category_id = c_placeholder_id
        and location = new.populated_place_id
        and active = true
        and q_date between start_date and end_date
      limit 1;
    else
      -- ROW: match by event_origin as region, location NULL
      select id, start_date, end_date, region, location
      into spec_rec
      from available_question_spec
      where region = new.event_origin
        and category_id = c_placeholder_id
        and location is null
        and active = true
        and q_date between start_date and end_date
      limit 1;
    end if;

    raise notice '[user split:location] q_date=%, place=%, found spec id=% range=%..%',
      q_date, new.populated_place_id, spec_rec.id, spec_rec.start_date, spec_rec.end_date;

    if spec_rec.id is null then
      return new;
    end if;

    -- Detach jobs
    update questions_to_generate
    set spec_id = null
    where spec_id = spec_rec.id;

    v_region := spec_rec.region;
    v_location := spec_rec.location;
    s_date := spec_rec.start_date;
    e_date := spec_rec.end_date;

    -- Deactivate (triggers archive cascade)
    update available_question_spec
    set active = false,
        deactivate_reason = 'spec split',
        updated_at = now()
    where id = spec_rec.id;

    raise notice '[user split] deactivated spec %, creating children', spec_rec.id;

    -- Create children using same near-threshold logic
    if q_date <= s_date + make_interval(days => near_threshold) then
      new_spec1_id := null;
      if q_date < e_date then
        insert into available_question_spec
          (start_date, end_date, region, category_id, location, active, created_at, updated_at)
        values
          (q_date + interval '1 day', e_date, v_region, c_placeholder_id, v_location, true, now(), now())
        returning id into new_spec2_id;
      end if;

    elsif q_date >= e_date - make_interval(days => near_threshold) then
      new_spec2_id := null;
      if q_date > s_date then
        insert into available_question_spec
          (start_date, end_date, region, category_id, location, active, created_at, updated_at)
        values
          (s_date, q_date - interval '1 day', v_region, c_placeholder_id, v_location, true, now(), now())
        returning id into new_spec1_id;
      end if;

    else
      if q_date > s_date then
        insert into available_question_spec
          (start_date, end_date, region, category_id, location, active, created_at, updated_at)
        values
          (s_date, q_date - interval '1 day', v_region, c_placeholder_id, v_location, true, now(), now())
        returning id into new_spec1_id;
      end if;

      if q_date < e_date then
        insert into available_question_spec
          (start_date, end_date, region, category_id, location, active, created_at, updated_at)
        values
          (q_date + interval '1 day', e_date, v_region, c_placeholder_id, v_location, true, now(), now())
        returning id into new_spec2_id;
      end if;
    end if;

    -- Reassign detached jobs
    if new.populated_place_id like 'osgb%' or new.populated_place_id like 'US-%' then
      -- UK and US: reassign by exact populated_place_id
      if new_spec1_id is not null and new_spec2_id is not null then
        update questions_to_generate
        set spec_id = case when random() < 0.5 then new_spec1_id else new_spec2_id end
        where spec_id is null and status in ('pending','retry')
          and populated_place_id = new.populated_place_id and slot_type = 'location';
      elsif new_spec1_id is not null then
        update questions_to_generate set spec_id = new_spec1_id
        where spec_id is null and status in ('pending','retry')
          and populated_place_id = new.populated_place_id and slot_type = 'location';
      elsif new_spec2_id is not null then
        update questions_to_generate set spec_id = new_spec2_id
        where spec_id is null and status in ('pending','retry')
          and populated_place_id = new.populated_place_id and slot_type = 'location';
      end if;
    else
      -- US/ROW: reassign by region + slot_type
      if new_spec1_id is not null and new_spec2_id is not null then
        update questions_to_generate
        set spec_id = case when random() < 0.5 then new_spec1_id else new_spec2_id end
        where spec_id is null and status in ('pending','retry')
          and region = v_region and slot_type = 'location' and category_id = c_placeholder_id;
      elsif new_spec1_id is not null then
        update questions_to_generate set spec_id = new_spec1_id
        where spec_id is null and status in ('pending','retry')
          and region = v_region and slot_type = 'location' and category_id = c_placeholder_id;
      elsif new_spec2_id is not null then
        update questions_to_generate set spec_id = new_spec2_id
        where spec_id is null and status in ('pending','retry')
          and region = v_region and slot_type = 'location' and category_id = c_placeholder_id;
      end if;
    end if;

  elsif new.question_kind = 'category' then
    -- ========== CATEGORY SPLIT ==========
    -- Split UK category specs + 1-Way location spec split
    -- >>> CHANGED: 'GLOBAL' → 'UK' (strategic simplification) <<<

    for cat in
      select (jsonb_array_elements_text(new.categories))::int
    loop
      if cat = 999 then
        continue;
      end if;

      -- Find covering UK category spec
      select id, start_date, end_date
      into spec_rec
      from available_question_spec
      where region = 'UK'
        and category_id = cat
        and location is null
        and active = true
        and q_date between start_date and end_date
      limit 1;

      raise notice '[user split:category] q_date=%, cat=%, found spec id=%', q_date, cat, spec_rec.id;

      if spec_rec.id is null then
        continue;
      end if;

      update questions_to_generate set spec_id = null where spec_id = spec_rec.id;

      s_date := spec_rec.start_date;
      e_date := spec_rec.end_date;

      update available_question_spec
      set active = false, deactivate_reason = 'spec split', updated_at = now()
      where id = spec_rec.id;

      if q_date <= s_date + make_interval(days => near_threshold) then
        new_spec1_id := null;
        if q_date < e_date then
          insert into available_question_spec
            (start_date, end_date, region, category_id, location, active, created_at, updated_at)
          values
            (q_date + interval '1 day', e_date, 'UK', cat, null, true, now(), now())
          returning id into new_spec2_id;
        end if;
      elsif q_date >= e_date - make_interval(days => near_threshold) then
        new_spec2_id := null;
        if q_date > s_date then
          insert into available_question_spec
            (start_date, end_date, region, category_id, location, active, created_at, updated_at)
          values
            (s_date, q_date - interval '1 day', 'UK', cat, null, true, now(), now())
          returning id into new_spec1_id;
        end if;
      else
        if q_date > s_date then
          insert into available_question_spec
            (start_date, end_date, region, category_id, location, active, created_at, updated_at)
          values
            (s_date, q_date - interval '1 day', 'UK', cat, null, true, now(), now())
          returning id into new_spec1_id;
        end if;
        if q_date < e_date then
          insert into available_question_spec
            (start_date, end_date, region, category_id, location, active, created_at, updated_at)
          values
            (q_date + interval '1 day', e_date, 'UK', cat, null, true, now(), now())
          returning id into new_spec2_id;
        end if;
      end if;

      -- Reassign category jobs
      if new_spec1_id is not null and new_spec2_id is not null then
        update questions_to_generate
        set spec_id = case when random() < 0.5 then new_spec1_id else new_spec2_id end
        where spec_id is null and status in ('pending','retry')
          and region = 'UK' and slot_type = 'category' and category_id = cat;
      elsif new_spec1_id is not null then
        update questions_to_generate set spec_id = new_spec1_id
        where spec_id is null and status in ('pending','retry')
          and region = 'UK' and slot_type = 'category' and category_id = cat;
      elsif new_spec2_id is not null then
        update questions_to_generate set spec_id = new_spec2_id
        where spec_id is null and status in ('pending','retry')
          and region = 'UK' and slot_type = 'category' and category_id = cat;
      end if;
    end loop;

    -- ========== 1-WAY LOCATION SPEC SPLIT ==========
    -- Also carve this date out of matching location spec(s)
    -- >>> UNTOUCHED: Uses dynamic loc_spec.region <<<
    if new.event_origin = 'WW' then
      -- Fan-out: slice ALL active location specs covering this date
      for loc_spec in
        select id, start_date, end_date, region, location
        from available_question_spec
        where category_id = 999 and active = true
          and q_date between start_date and end_date
      loop
        update questions_to_generate set spec_id = null where spec_id = loc_spec.id;

        s_date := loc_spec.start_date;
        e_date := loc_spec.end_date;

        update available_question_spec
        set active = false, deactivate_reason = '1-way category slice (WW)', updated_at = now()
        where id = loc_spec.id;

        new_spec1_id := null;
        new_spec2_id := null;

        if q_date <= s_date + make_interval(days => near_threshold) then
          if q_date < e_date then
            insert into available_question_spec
              (start_date, end_date, region, category_id, location, active, created_at, updated_at)
            values
              (q_date + interval '1 day', e_date, loc_spec.region, 999, loc_spec.location, true, now(), now());
          end if;
        elsif q_date >= e_date - make_interval(days => near_threshold) then
          if q_date > s_date then
            insert into available_question_spec
              (start_date, end_date, region, category_id, location, active, created_at, updated_at)
            values
              (s_date, q_date - interval '1 day', loc_spec.region, 999, loc_spec.location, true, now(), now());
          end if;
        else
          if q_date > s_date then
            insert into available_question_spec
              (start_date, end_date, region, category_id, location, active, created_at, updated_at)
            values
              (s_date, q_date - interval '1 day', loc_spec.region, 999, loc_spec.location, true, now(), now());
          end if;
          if q_date < e_date then
            insert into available_question_spec
              (start_date, end_date, region, category_id, location, active, created_at, updated_at)
            values
              (q_date + interval '1 day', e_date, loc_spec.region, 999, loc_spec.location, true, now(), now());
          end if;
        end if;
      end loop;

    elsif new.event_origin is not null then
      -- Single spec: try ROW match (region=origin, location NULL) or US state match
      select id, start_date, end_date, region, location
      into loc_spec
      from available_question_spec
      where category_id = 999 and active = true
        and q_date between start_date and end_date
        and (
          (region = new.event_origin and location is null)
          or (region = 'US' and location = new.event_origin)
        )
      limit 1;

      if loc_spec.id is not null then
        update questions_to_generate set spec_id = null where spec_id = loc_spec.id;

        s_date := loc_spec.start_date;
        e_date := loc_spec.end_date;

        update available_question_spec
        set active = false, deactivate_reason = '1-way category slice', updated_at = now()
        where id = loc_spec.id;

        if q_date <= s_date + make_interval(days => near_threshold) then
          if q_date < e_date then
            insert into available_question_spec
              (start_date, end_date, region, category_id, location, active, created_at, updated_at)
            values
              (q_date + interval '1 day', e_date, loc_spec.region, 999, loc_spec.location, true, now(), now());
          end if;
        elsif q_date >= e_date - make_interval(days => near_threshold) then
          if q_date > s_date then
            insert into available_question_spec
              (start_date, end_date, region, category_id, location, active, created_at, updated_at)
            values
              (s_date, q_date - interval '1 day', loc_spec.region, 999, loc_spec.location, true, now(), now());
          end if;
        else
          if q_date > s_date then
            insert into available_question_spec
              (start_date, end_date, region, category_id, location, active, created_at, updated_at)
            values
              (s_date, q_date - interval '1 day', loc_spec.region, 999, loc_spec.location, true, now(), now());
          end if;
          if q_date < e_date then
            insert into available_question_spec
              (start_date, end_date, region, category_id, location, active, created_at, updated_at)
            values
              (q_date + interval '1 day', e_date, loc_spec.region, 999, loc_spec.location, true, now(), now());
          end if;
        end if;
      end if;
    end if;

  end if;

  return new;
end;
$$;


-- ======================
-- trg_split_region_specs
-- ======================
-- Fires AFTER INSERT on questions_master_region.
-- Only handles category questions (same as original).
-- Uses UK region + 1-Way location split.

CREATE OR REPLACE FUNCTION "public"."trg_split_region_specs"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
declare
  q_date date := new.answer_date_canonical::date;
  cat int;
  spec_rec record;
  loc_spec record;
  s_date date;
  e_date date;
  new_spec1_id bigint;
  new_spec2_id bigint;
  near_threshold int := 3;
begin
  if new.question_kind is distinct from 'category' then
    return new;
  end if;

  for cat in
    select (jsonb_array_elements_text(new.categories))::int
  loop
    if cat = 999 then
      continue;
    end if;

    -- >>> CHANGED: 'GLOBAL' → 'UK' <<<
    select id, start_date, end_date
    into spec_rec
    from available_question_spec
    where region = 'UK'
      and category_id = cat
      and location is null
      and active = true
      and q_date between start_date and end_date
    limit 1;

    raise notice '[region split] q_date=%, cat=%, found spec id=% range=%..%',
      q_date, cat, spec_rec.id, spec_rec.start_date, spec_rec.end_date;

    if spec_rec.id is null then
      continue;
    end if;

    update questions_to_generate set spec_id = null where spec_id = spec_rec.id;

    s_date := spec_rec.start_date;
    e_date := spec_rec.end_date;

    update available_question_spec
    set active = false, deactivate_reason = 'spec split', updated_at = now()
    where id = spec_rec.id;

    raise notice '[region split] deactivated spec %', spec_rec.id;

    -- >>> CHANGED: Child spec inserts use 'UK' instead of 'GLOBAL' <<<
    if q_date <= s_date + make_interval(days => near_threshold) then
      new_spec1_id := null;
      if q_date < e_date then
        insert into available_question_spec
          (start_date, end_date, region, category_id, location, active, created_at, updated_at)
        values
          (q_date + interval '1 day', e_date, 'UK', cat, null, true, now(), now())
        returning id into new_spec2_id;
      end if;
    elsif q_date >= e_date - make_interval(days => near_threshold) then
      new_spec2_id := null;
      if q_date > s_date then
        insert into available_question_spec
          (start_date, end_date, region, category_id, location, active, created_at, updated_at)
        values
          (s_date, q_date - interval '1 day', 'UK', cat, null, true, now(), now())
        returning id into new_spec1_id;
      end if;
    else
      if q_date > s_date then
        insert into available_question_spec
          (start_date, end_date, region, category_id, location, active, created_at, updated_at)
        values
          (s_date, q_date - interval '1 day', 'UK', cat, null, true, now(), now())
        returning id into new_spec1_id;
      end if;
      if q_date < e_date then
        insert into available_question_spec
          (start_date, end_date, region, category_id, location, active, created_at, updated_at)
        values
          (q_date + interval '1 day', e_date, 'UK', cat, null, true, now(), now())
        returning id into new_spec2_id;
      end if;
    end if;

    -- >>> CHANGED: Job reassignment uses 'UK' instead of 'GLOBAL' <<<
    if new_spec1_id is not null and new_spec2_id is not null then
      update questions_to_generate
      set spec_id = case when random() < 0.5 then new_spec1_id else new_spec2_id end
      where spec_id is null and status in ('pending','retry')
        and region = 'UK' and slot_type = 'category' and category_id = cat;
    elsif new_spec1_id is not null then
      update questions_to_generate set spec_id = new_spec1_id
      where spec_id is null and status in ('pending','retry')
        and region = 'UK' and slot_type = 'category' and category_id = cat;
    elsif new_spec2_id is not null then
      update questions_to_generate set spec_id = new_spec2_id
      where spec_id is null and status in ('pending','retry')
        and region = 'UK' and slot_type = 'category' and category_id = cat;
    end if;
  end loop;

  -- ========== 1-WAY LOCATION SPEC SPLIT ==========
  -- >>> UNTOUCHED: Uses dynamic loc_spec.region <<<
  if new.event_origin = 'WW' then
    for loc_spec in
      select id, start_date, end_date, region, location
      from available_question_spec
      where category_id = 999 and active = true
        and q_date between start_date and end_date
    loop
      update questions_to_generate set spec_id = null where spec_id = loc_spec.id;
      s_date := loc_spec.start_date;
      e_date := loc_spec.end_date;

      update available_question_spec
      set active = false, deactivate_reason = '1-way category slice (WW)', updated_at = now()
      where id = loc_spec.id;

      if q_date <= s_date + make_interval(days => near_threshold) then
        if q_date < e_date then
          insert into available_question_spec
            (start_date, end_date, region, category_id, location, active, created_at, updated_at)
          values
            (q_date + interval '1 day', e_date, loc_spec.region, 999, loc_spec.location, true, now(), now());
        end if;
      elsif q_date >= e_date - make_interval(days => near_threshold) then
        if q_date > s_date then
          insert into available_question_spec
            (start_date, end_date, region, category_id, location, active, created_at, updated_at)
          values
            (s_date, q_date - interval '1 day', loc_spec.region, 999, loc_spec.location, true, now(), now());
        end if;
      else
        if q_date > s_date then
          insert into available_question_spec
            (start_date, end_date, region, category_id, location, active, created_at, updated_at)
          values
            (s_date, q_date - interval '1 day', loc_spec.region, 999, loc_spec.location, true, now(), now());
        end if;
        if q_date < e_date then
          insert into available_question_spec
            (start_date, end_date, region, category_id, location, active, created_at, updated_at)
          values
            (q_date + interval '1 day', e_date, loc_spec.region, 999, loc_spec.location, true, now(), now());
        end if;
      end if;
    end loop;

  elsif new.event_origin is not null then
    select id, start_date, end_date, region, location
    into loc_spec
    from available_question_spec
    where category_id = 999 and active = true
      and q_date between start_date and end_date
      and (
        (region = new.event_origin and location is null)
        or (region = 'US' and location = new.event_origin)
      )
    limit 1;

    if loc_spec.id is not null then
      update questions_to_generate set spec_id = null where spec_id = loc_spec.id;
      s_date := loc_spec.start_date;
      e_date := loc_spec.end_date;

      update available_question_spec
      set active = false, deactivate_reason = '1-way category slice', updated_at = now()
      where id = loc_spec.id;

      if q_date <= s_date + make_interval(days => near_threshold) then
        if q_date < e_date then
          insert into available_question_spec
            (start_date, end_date, region, category_id, location, active, created_at, updated_at)
          values
            (q_date + interval '1 day', e_date, loc_spec.region, 999, loc_spec.location, true, now(), now());
        end if;
      elsif q_date >= e_date - make_interval(days => near_threshold) then
        if q_date > s_date then
          insert into available_question_spec
            (start_date, end_date, region, category_id, location, active, created_at, updated_at)
          values
            (s_date, q_date - interval '1 day', loc_spec.region, 999, loc_spec.location, true, now(), now());
        end if;
      else
        if q_date > s_date then
          insert into available_question_spec
            (start_date, end_date, region, category_id, location, active, created_at, updated_at)
          values
            (s_date, q_date - interval '1 day', loc_spec.region, 999, loc_spec.location, true, now(), now());
        end if;
        if q_date < e_date then
          insert into available_question_spec
            (start_date, end_date, region, category_id, location, active, created_at, updated_at)
          values
            (q_date + interval '1 day', e_date, loc_spec.region, 999, loc_spec.location, true, now(), now());
        end if;
      end if;
    end if;
  end if;

  return new;
end;
$$;


-- =====================
-- PART 3: VERIFICATION QUERIES
-- =====================
-- Run these after executing Parts 1+2 to confirm success.

-- Should return 0:
-- SELECT count(*) FROM available_question_spec WHERE region = 'GLOBAL';
-- SELECT count(*) FROM available_question_spec_archive WHERE region = 'GLOBAL';
-- SELECT count(*) FROM questions_allocated_region WHERE region = 'GLOBAL';
-- SELECT count(*) FROM demand_summary WHERE scope_id = 'GLOBAL';
-- SELECT count(*) FROM questions_to_generate WHERE region = 'GLOBAL' OR scope_id = 'GLOBAL';

-- Should confirm trigger code has no GLOBAL:
-- SELECT prosrc FROM pg_proc WHERE proname = 'trg_split_user_specs';
-- SELECT prosrc FROM pg_proc WHERE proname = 'trg_split_region_specs';
