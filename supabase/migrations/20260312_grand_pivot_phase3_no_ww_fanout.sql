-- ============================================================
-- Phase 3 Correction: Remove WW Fan-Out, Lean 1-Way Slicing
-- ============================================================
-- 1-Way location slice rules:
--   WW  → NO location slice (only category timeline)
--   UK  → NO location slice (UK uses per-place specs)
--   US  → NO location slice (US uses per-state specs)
--   US-TX → YES: slice specific US state spec
--   FR  → YES: slice specific ROW country spec

-- =====================
-- PART 1: Corrected Retroactive Slicing DO Block
-- =====================
-- Safe to re-run: already-sliced specs won't match (active=false).

DO $$
DECLARE
  rec RECORD;
  spec_rec RECORD;
  q_date date;
  s_date date;
  e_date date;
  near_threshold int := 3;
  sliced_count int := 0;
BEGIN
  RAISE NOTICE '[Phase3:Slice] Starting lean retroactive location slicing...';

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

    UPDATE questions_to_generate SET spec_id = NULL WHERE spec_id = spec_rec.id;

    s_date := spec_rec.start_date;
    e_date := spec_rec.end_date;

    UPDATE available_question_spec
       SET active = false, deactivate_reason = 'retroactive location slice', updated_at = now()
     WHERE id = spec_rec.id;

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

  RAISE NOTICE '[Phase3:Slice] Total slices: %', sliced_count;
END;
$$;


-- =====================
-- PART 2: Corrected trg_split_user_specs
-- =====================

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
    if new.populated_place_id like 'osgb%' then
      select id, start_date, end_date, region, location into spec_rec
      from available_question_spec
      where region = 'UK' and category_id = c_placeholder_id
        and location = new.populated_place_id and active = true
        and q_date between start_date and end_date
      limit 1;
    elsif new.populated_place_id like 'US-%' then
      select id, start_date, end_date, region, location into spec_rec
      from available_question_spec
      where region = 'US' and category_id = c_placeholder_id
        and location = new.populated_place_id and active = true
        and q_date between start_date and end_date
      limit 1;
    else
      select id, start_date, end_date, region, location into spec_rec
      from available_question_spec
      where region = new.event_origin and category_id = c_placeholder_id
        and location is null and active = true
        and q_date between start_date and end_date
      limit 1;
    end if;

    raise notice '[user split:location] q_date=%, place=%, found spec id=%',
      q_date, new.populated_place_id, spec_rec.id;

    if spec_rec.id is null then
      return new;
    end if;

    update questions_to_generate set spec_id = null where spec_id = spec_rec.id;

    v_region := spec_rec.region;
    v_location := spec_rec.location;
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
        values (q_date + interval '1 day', e_date, v_region, c_placeholder_id, v_location, true, now(), now())
        returning id into new_spec2_id;
      end if;
    elsif q_date >= e_date - make_interval(days => near_threshold) then
      new_spec2_id := null;
      if q_date > s_date then
        insert into available_question_spec
          (start_date, end_date, region, category_id, location, active, created_at, updated_at)
        values (s_date, q_date - interval '1 day', v_region, c_placeholder_id, v_location, true, now(), now())
        returning id into new_spec1_id;
      end if;
    else
      if q_date > s_date then
        insert into available_question_spec
          (start_date, end_date, region, category_id, location, active, created_at, updated_at)
        values (s_date, q_date - interval '1 day', v_region, c_placeholder_id, v_location, true, now(), now())
        returning id into new_spec1_id;
      end if;
      if q_date < e_date then
        insert into available_question_spec
          (start_date, end_date, region, category_id, location, active, created_at, updated_at)
        values (q_date + interval '1 day', e_date, v_region, c_placeholder_id, v_location, true, now(), now())
        returning id into new_spec2_id;
      end if;
    end if;

    -- Reassign: UK and US use exact populated_place_id, ROW uses region
    if new.populated_place_id like 'osgb%' or new.populated_place_id like 'US-%' then
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
    -- ========== CATEGORY SPLIT (GLOBAL) ==========
    for cat in
      select (jsonb_array_elements_text(new.categories))::int
    loop
      if cat = 999 then continue; end if;

      select id, start_date, end_date into spec_rec
      from available_question_spec
      where region = 'GLOBAL' and category_id = cat
        and location is null and active = true
        and q_date between start_date and end_date
      limit 1;

      raise notice '[user split:category] q_date=%, cat=%, found spec id=%', q_date, cat, spec_rec.id;

      if spec_rec.id is null then continue; end if;

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
          values (q_date + interval '1 day', e_date, 'GLOBAL', cat, null, true, now(), now())
          returning id into new_spec2_id;
        end if;
      elsif q_date >= e_date - make_interval(days => near_threshold) then
        new_spec2_id := null;
        if q_date > s_date then
          insert into available_question_spec
            (start_date, end_date, region, category_id, location, active, created_at, updated_at)
          values (s_date, q_date - interval '1 day', 'GLOBAL', cat, null, true, now(), now())
          returning id into new_spec1_id;
        end if;
      else
        if q_date > s_date then
          insert into available_question_spec
            (start_date, end_date, region, category_id, location, active, created_at, updated_at)
          values (s_date, q_date - interval '1 day', 'GLOBAL', cat, null, true, now(), now())
          returning id into new_spec1_id;
        end if;
        if q_date < e_date then
          insert into available_question_spec
            (start_date, end_date, region, category_id, location, active, created_at, updated_at)
          values (q_date + interval '1 day', e_date, 'GLOBAL', cat, null, true, now(), now())
          returning id into new_spec2_id;
        end if;
      end if;

      if new_spec1_id is not null and new_spec2_id is not null then
        update questions_to_generate
        set spec_id = case when random() < 0.5 then new_spec1_id else new_spec2_id end
        where spec_id is null and status in ('pending','retry')
          and region = 'GLOBAL' and slot_type = 'category' and category_id = cat;
      elsif new_spec1_id is not null then
        update questions_to_generate set spec_id = new_spec1_id
        where spec_id is null and status in ('pending','retry')
          and region = 'GLOBAL' and slot_type = 'category' and category_id = cat;
      elsif new_spec2_id is not null then
        update questions_to_generate set spec_id = new_spec2_id
        where spec_id is null and status in ('pending','retry')
          and region = 'GLOBAL' and slot_type = 'category' and category_id = cat;
      end if;
    end loop;

    -- ========== 1-WAY LOCATION SPEC SPLIT ==========
    -- Only for specific ROW codes or US state codes.
    -- WW, UK, US country-level: NO location slice.
    if new.event_origin is not null
       and new.event_origin not in ('WW', 'UK', 'US')
    then
      select id, start_date, end_date, region, location into loc_spec
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
            values (q_date + interval '1 day', e_date, loc_spec.region, 999, loc_spec.location, true, now(), now());
          end if;
        elsif q_date >= e_date - make_interval(days => near_threshold) then
          if q_date > s_date then
            insert into available_question_spec
              (start_date, end_date, region, category_id, location, active, created_at, updated_at)
            values (s_date, q_date - interval '1 day', loc_spec.region, 999, loc_spec.location, true, now(), now());
          end if;
        else
          if q_date > s_date then
            insert into available_question_spec
              (start_date, end_date, region, category_id, location, active, created_at, updated_at)
            values (s_date, q_date - interval '1 day', loc_spec.region, 999, loc_spec.location, true, now(), now());
          end if;
          if q_date < e_date then
            insert into available_question_spec
              (start_date, end_date, region, category_id, location, active, created_at, updated_at)
            values (q_date + interval '1 day', e_date, loc_spec.region, 999, loc_spec.location, true, now(), now());
          end if;
        end if;
      end if;
    end if;

  end if;

  return new;
end;
$$;


-- =====================
-- PART 3: Corrected trg_split_region_specs
-- =====================

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
    if cat = 999 then continue; end if;

    select id, start_date, end_date into spec_rec
    from available_question_spec
    where region = 'GLOBAL' and category_id = cat
      and location is null and active = true
      and q_date between start_date and end_date
    limit 1;

    raise notice '[region split] q_date=%, cat=%, found spec id=%', q_date, cat, spec_rec.id;

    if spec_rec.id is null then continue; end if;

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
        values (q_date + interval '1 day', e_date, 'GLOBAL', cat, null, true, now(), now())
        returning id into new_spec2_id;
      end if;
    elsif q_date >= e_date - make_interval(days => near_threshold) then
      new_spec2_id := null;
      if q_date > s_date then
        insert into available_question_spec
          (start_date, end_date, region, category_id, location, active, created_at, updated_at)
        values (s_date, q_date - interval '1 day', 'GLOBAL', cat, null, true, now(), now())
        returning id into new_spec1_id;
      end if;
    else
      if q_date > s_date then
        insert into available_question_spec
          (start_date, end_date, region, category_id, location, active, created_at, updated_at)
        values (s_date, q_date - interval '1 day', 'GLOBAL', cat, null, true, now(), now())
        returning id into new_spec1_id;
      end if;
      if q_date < e_date then
        insert into available_question_spec
          (start_date, end_date, region, category_id, location, active, created_at, updated_at)
        values (q_date + interval '1 day', e_date, 'GLOBAL', cat, null, true, now(), now())
        returning id into new_spec2_id;
      end if;
    end if;

    if new_spec1_id is not null and new_spec2_id is not null then
      update questions_to_generate
      set spec_id = case when random() < 0.5 then new_spec1_id else new_spec2_id end
      where spec_id is null and status in ('pending','retry')
        and region = 'GLOBAL' and slot_type = 'category' and category_id = cat;
    elsif new_spec1_id is not null then
      update questions_to_generate set spec_id = new_spec1_id
      where spec_id is null and status in ('pending','retry')
        and region = 'GLOBAL' and slot_type = 'category' and category_id = cat;
    elsif new_spec2_id is not null then
      update questions_to_generate set spec_id = new_spec2_id
      where spec_id is null and status in ('pending','retry')
        and region = 'GLOBAL' and slot_type = 'category' and category_id = cat;
    end if;
  end loop;

  -- ========== 1-WAY LOCATION SPEC SPLIT ==========
  -- Only for specific ROW codes or US state codes.
  -- WW, UK, US country-level: NO location slice.
  if new.event_origin is not null
     and new.event_origin not in ('WW', 'UK', 'US')
  then
    select id, start_date, end_date, region, location into loc_spec
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
          values (q_date + interval '1 day', e_date, loc_spec.region, 999, loc_spec.location, true, now(), now());
        end if;
      elsif q_date >= e_date - make_interval(days => near_threshold) then
        if q_date > s_date then
          insert into available_question_spec
            (start_date, end_date, region, category_id, location, active, created_at, updated_at)
          values (s_date, q_date - interval '1 day', loc_spec.region, 999, loc_spec.location, true, now(), now());
        end if;
      else
        if q_date > s_date then
          insert into available_question_spec
            (start_date, end_date, region, category_id, location, active, created_at, updated_at)
          values (s_date, q_date - interval '1 day', loc_spec.region, 999, loc_spec.location, true, now(), now());
        end if;
        if q_date < e_date then
          insert into available_question_spec
            (start_date, end_date, region, category_id, location, active, created_at, updated_at)
          values (q_date + interval '1 day', e_date, loc_spec.region, 999, loc_spec.location, true, now(), now());
        end if;
      end if;
    end if;
  end if;

  return new;
end;
$$;
