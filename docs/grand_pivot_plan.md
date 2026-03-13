# Grand Pivot — Final Unified Implementation Plan

> **Objective:** Transform Elementle from a UK-only app to a multi-region, internationally-aware trivia game with per-country question generation, cultural-sphere-aware sharing, and a Global puzzle mode.

> [!CAUTION]
> **NO CODE YET.** This is the architecture blueprint. All changes must be reviewed before any SQL or code is written.

---

## 1. Finalized Design Decisions

| # | Decision | Resolution |
|---|---|---|
| 1 | Country Codes | ISO 3166-1 alpha-2. `'UK'` for United Kingdom (not `'GB'`). |
| 2 | Event Origin | AI receives ISO + descriptive name. Returns ISO. `'WW'` for worldwide. |
| 3 | Allocator Math | **UNCHANGED.** No modifications to `buildUserSlotPlan()` or region branch logic. |
| 4 | User Slot Ratio | Keep **1/3 location, 2/3 category**. No "Global slot" in user branch. |
| 5 | Global Game | Same allocator. Only changes: worker prompt asks for "truly worldwide" events; UI labels update. |
| 6 | Location Tiers | 3 tiers: UK (PostGIS), US (state autocomplete), ROW (country reference). |
| 7 | Cultural Spheres | 5 spheres (ANG/ELA/ASI/SAM/AFR) for category question sharing. |
| 8 | Date Split | **One-way:** Category question splits category spec AND location spec for `event_origin`. `'WW'` splits location specs for ALL countries. |
| 9 | Timezone SoT | `user_profiles.timezone` (from expo-localization). `reference_countries.timezone` = fallback only. |
| 10 | Demand Schedule | `frequency_hours = 8` (3× daily at 8-hour intervals). |
| 11 | US Sub-Regions | `reference_us_states` table. `user_profiles.sub_region = 'US-TX'`. |
| 12 | Spec Rebase | Pause cron → rebase → verify → restart. Fast cutover. |

---

## 2. The 3 Tiers of Location Questions

Location questions are the "hyper-local" tier. How they work depends on the user's country:

### 2.1 Tier 1: UK (Existing System — No Change)

```
User enters postcode → geocode_postcode Edge Function
  → postcodes.io API → lat/lng
  → get_nearby_locations RPC (PostGIS, 20mi radius)
  → Score: sizePoints(size) × (1/distance)
  → Top 10 → location_allocation
  → Spec: category_id=999, location=place_id
```

**AI Prompt:** *"an event highly relevant to {place_name}, a {local_type} in {postcode_district}, which would be unlikely to be known widely in other parts of the UK."*

### 2.2 Tier 2: US (New — State Autocomplete)

```
User selects US → app shows state autocomplete
  → user_profiles.sub_region = 'US-TX'
  → No geocoding, no populated_places
  → Spec: category_id=999, region='US-TX', location=NULL
```

**AI Prompt:** *"an event highly relevant to a specific region, city, or town within Texas, United States, which would be unlikely to be known widely in other countries or even nationwide."*

**Spec cascade:** `US-TX` → `US` → North America → any country

### 2.3 Tier 3: Rest of World (New — Country-Level)

```
User selects France → user_profiles.region = 'FR'
  → No sub-region, no geocoding
  → Spec: category_id=999, region='FR', location=NULL
```

**AI Prompt:** *"an event highly relevant to a specific region, city, or town within France, which would be unlikely to be known widely in other countries or even nationwide."*

### 2.4 How the Allocator Handles This

The allocator is **unchanged**. The key is what `location_allocation` returns:
- **UK users:** `location_allocation` has place IDs → allocator uses existing PostGIS logic
- **US users:** No place IDs. `location_allocation` is empty → allocator converts all location slots to category slots **unless** we seed a synthetic row
- **ROW users:** Same — empty allocations → category-only

> [!IMPORTANT]
> **Decision needed:** For US/ROW, we have two options:
> - **Option A:** Seed `location_allocation` with a synthetic entry (e.g., `location_id = 'US-TX'` or `location_id = 'FR'`) so the allocator's existing location logic works unchanged. This requires `populated_places` to accept non-OSGB IDs, or a new reference approach.
> - **Option B:** Add a branch in the allocator that detects US/ROW users and creates location-type jobs directly (without `location_allocation`). The sub_region/region IS the location context.
>
> Both keep the allocator math (1/3 location ratio) intact. The difference is where the location identity comes from.

---

## 3. The 5 Cultural Spheres

Cultural spheres solve the "category question sharing" problem. A question about the UK's first Labour government is relevant to Anglosphere users but not to East Asian users.

### 3.1 Sphere Definitions

| Code | Name | Example Countries |
|---|---|---|
| `ANG` | Anglosphere | US, UK, CA, AU, NZ, IE |
| `ELA` | Euro-LatAm | FR, DE, ES, IT, BR, AR, MX |
| `ASI` | East & Southeast Asia | JP, CN, KR, TH, VN, SG |
| `SAM` | South Asia & MENA | IN, PK, BD, SA, AE, EG |
| `AFR` | Sub-Saharan Africa | NG, ZA, KE, GH, ET |

### 3.2 Schema Changes

```sql
-- Add sphere to country reference
ALTER TABLE reference_countries ADD COLUMN cultural_sphere_code text NOT NULL DEFAULT 'ANG';
-- Constraint: must be one of the 5 codes
ALTER TABLE reference_countries ADD CONSTRAINT chk_sphere
  CHECK (cultural_sphere_code IN ('ANG', 'ELA', 'ASI', 'SAM', 'AFR'));

-- Add sphere metadata to generated questions
ALTER TABLE questions_master_user ADD COLUMN target_sphere text;
ALTER TABLE questions_master_user ADD COLUMN excluded_spheres jsonb DEFAULT '[]'::jsonb;

-- Same for region master
ALTER TABLE questions_master_region ADD COLUMN target_sphere text;
ALTER TABLE questions_master_region ADD COLUMN excluded_spheres jsonb DEFAULT '[]'::jsonb;
```

### 3.3 AI Prompt Logic

The worker prompt must include:

> *"After generating the question, assess its cultural relevance:*
> - *If the event is strictly local to the target country/sphere, output `excluded_spheres: ['unique']`.*
> - *Otherwise, output an array of 3-letter sphere codes that would definitely NOT know this event (e.g., `['ASI', 'AFR']`).*
> - *Leave `excluded_spheres` empty `[]` if the event is globally known."*

### 3.4 How Spheres Affect Allocation

When the allocator searches for a category master question for a user:
1. Determine user's sphere: `SELECT cultural_sphere_code FROM reference_countries WHERE code = user.region`
2. Filter master pool: exclude questions where `user_sphere = ANY(excluded_spheres)`
3. This prevents allocating a question to a user in a sphere that was explicitly excluded

**The allocator math is unchanged** — we only add a WHERE filter to the master pool query.

---

## 4. One-Way Date Split (Anti-Duplication)

This is the most architecturally significant change. Currently, spec splitting only affects the same scope. Post-pivot, it must cross-pollinate.

### 4.1 Current Behavior (Single-Scope)

```
Category question inserted into questions_master_*
  → trg_split_*_specs fires
  → Splits category spec for (region='UK', category_id=X) at event_date
  → Only affects category specs for UK
```

### 4.2 New Behavior (One-Way Cross-Scope)

```
Category question inserted (event_origin='FR', categories=[10,22])
  → Split CATEGORY specs for:
      Each category (10, 22) × GLOBAL region (shared timeline)
  → Split LOCATION spec for:
      event_origin='FR', category_id=999 (prevents location question for same event)
  → If event_origin='WW':
      Split LOCATION specs for ALL active countries × category_id=999
```

### 4.3 Why One-Way?

- **Category → Location (YES):** If a category question covers the Battle of Waterloo (1815-06-18), no location question for Belgium should land on that date. The event is "used up" for location purposes too.
- **Location → Category (NO):** A hyper-local event in a tiny UK hamlet should NOT block a globally-shared category spec for that date. The event is too obscure to create conflicts.

### 4.4 Implementation

The `trg_split_*_specs()` trigger functions must be extended:

```sql
-- EXISTING: split category spec at event_date (per category)
FOR each category_id IN NEW.categories:
  split_spec(region=<global>, category_id=cat, event_date)

-- NEW: also split location spec for event_origin
IF NEW.question_kind = 'category' THEN
  IF NEW.event_origin = 'WW' THEN
    -- Split location specs for ALL active countries
    FOR each country IN (SELECT code FROM reference_countries WHERE active):
      split_spec(region=country, category_id=999, event_date)
  ELSE
    -- Split location spec for origin country only
    split_spec(region=NEW.event_origin, category_id=999, event_date)
  END IF;
END IF;
```

> [!WARNING]
> Category specs use a **shared global timeline** — `region` on category specs represents the global pool, NOT per-country specs. This means category specs should use a sentinel like `'GLOBAL'` or continue using the current region but be queried without region filtering for category questions.

---

## 5. Timezone Handling

### 5.1 Source of Truth

```
Primary:  user_profiles.timezone     (IANA string from expo-localization)
Fallback: reference_countries.timezone (for legacy app versions without the field)
```

### 5.2 `region_to_timezone()` Update

```sql
CREATE OR REPLACE FUNCTION region_to_timezone(p_region text)
RETURNS text LANGUAGE sql STABLE AS $$
  SELECT COALESCE(
    (SELECT timezone FROM reference_countries WHERE code = p_region),
    'Etc/GMT+12'
  );
$$;
```

But `process_pending_snapshots()` should prefer `user_profiles.timezone` directly:

```sql
-- Current:
region_to_timezone(COALESCE(up.region, 'UK'))

-- New:
COALESCE(up.timezone, region_to_timezone(up.region))
```

### 5.3 New Column

```sql
ALTER TABLE user_profiles ADD COLUMN timezone text;
-- Populated by mobile app on login via expo-localization
-- e.g., 'America/Chicago', 'Europe/Paris'
```

### 5.4 Demand Scheduler

```sql
UPDATE demand_scheduler_config SET frequency_hours = 8;
```

Runs at 01:00, 09:00, 17:00 UTC — covers midnight windows for all major timezone groups.

---

## 6. Database Schema — Complete Change List

### 6.1 New Tables

```sql
CREATE TABLE reference_countries (
    code text PRIMARY KEY,
    name text NOT NULL,
    display_name text NOT NULL,
    prompt_name text NOT NULL,
    continent text NOT NULL,
    timezone text NOT NULL,
    cultural_sphere_code text NOT NULL DEFAULT 'ANG',
    active boolean DEFAULT false,
    CONSTRAINT chk_sphere CHECK (cultural_sphere_code IN ('ANG','ELA','ASI','SAM','AFR'))
);

CREATE TABLE reference_us_states (
    code text PRIMARY KEY,      -- e.g., 'US-TX'
    name text NOT NULL,
    display_name text NOT NULL,
    prompt_name text NOT NULL
);
```

### 6.2 Column Additions

| Table | Column | Type | Default | Notes |
|---|---|---|---|---|
| `user_profiles` | `timezone` | text | NULL | From expo-localization |
| `user_profiles` | `sub_region` | text | NULL | e.g., 'US-TX' |
| `reference_countries` | `cultural_sphere_code` | text | `'ANG'` | See §3 |
| `questions_master_region` | `target_sphere` | text | NULL | AI-set |
| `questions_master_region` | `excluded_spheres` | jsonb | `'[]'` | AI-set |
| `questions_master_user` | `target_sphere` | text | NULL | AI-set |
| `questions_master_user` | `excluded_spheres` | jsonb | `'[]'` | AI-set |

### 6.3 Data Normalization

```sql
-- event_origin: inconsistent full names → ISO codes
UPDATE questions_master_region SET event_origin = CASE event_origin
  WHEN 'Japan' THEN 'JP'
  WHEN 'USA' THEN 'US'  WHEN 'United States' THEN 'US'
  WHEN 'France' THEN 'FR'  WHEN 'Germany' THEN 'DE'
  WHEN 'Spain' THEN 'ES'  WHEN 'United Kingdom' THEN 'UK'
  -- ... map ALL distinct values (query: SELECT DISTINCT event_origin FROM questions_master_region)
  ELSE event_origin
END;
-- Same for questions_master_user
```

### 6.4 Function Changes

| Function | Change |
|---|---|
| `region_to_timezone()` | CASE → lookup from `reference_countries`. `IMMUTABLE` → `STABLE`. |
| `trg_split_region_specs()` | Replace 26× `'UK'` with `NEW.event_origin`. Add one-way location split. |
| `trg_split_user_specs()` | Same. |
| `process_pending_snapshots()` | `COALESCE(up.timezone, region_to_timezone(up.region))` |
| `refresh_all_active_league_standings()` | Same COALESCE pattern. |
| `user_future_demand()` | Remove `WHERE u.postcode IS NOT NULL` filter (ROW users have no postcode). |
| `user_archive_demand()` | Same. |

### 6.5 Edge Function Changes

| Function | Change |
|---|---|
| `calculate-demand` | Loop through all active countries for region demand (not just `'UK'`). |
| `allocate-questions` (region branch) | Add `excluded_spheres` filter when selecting from master pool. |
| `allocate-questions` (user branch) | Add `excluded_spheres` filter. Handle US/ROW location resolution. |
| Worker prompt | Add sphere assessment instructions. Add location prompt variants for US/ROW. |

### 6.6 Config Changes

```sql
UPDATE demand_scheduler_config SET frequency_hours = 8;
```

---

## 7. Global Game — What Actually Changes

The Global game is the simplest change because we are NOT modifying the allocator:

| Component | Change |
|---|---|
| `calculate-demand` | Region demand loop already processes region scope. Ensure `'GLOBAL'` is processed. |
| `allocate-questions` (region branch) | No change — it picks random categories and allocates from master pool / queues generation. |
| Worker prompt | Change to: *"a truly worldwide, universally recognized historical event. The event should be known by educated people in every country."* |
| UI labels | "Region" → "Global" on the relevant game mode. |
| `questions_master_region` | `event_origin` = `'WW'` for worldwide events → triggers location splits for all countries. |

---

## 8. Worker Prompt Design

### 8.1 Category Question (User/Region)

```
Generate a historical event question for the category "{category_name}".
Country context: {prompt_name} (ISO: {code}).

The event must have occurred between {start_date} and {end_date}.

After generating, assess cultural relevance:
- target_sphere: "{user_sphere}" (the sphere this question was created for)
- excluded_spheres: Array of sphere codes that would NOT know this event.
  Use ['unique'] if strictly local. Use [] if globally known.
  Valid codes: ANG, ELA, ASI, SAM, AFR.
```

### 8.2 Location Question — UK

```
Generate an event relevant to {place_name}, a {local_type} in {postcode_district}.
The event should be highly local — unlikely to be known in other parts of the UK.
Date range: {start_date} to {end_date}.
```

### 8.3 Location Question — US State

```
Generate an event highly relevant to a specific region, city, or town within
{state_name}, United States, which would be unlikely to be known widely in
other countries or even nationwide.
Date range: {start_date} to {end_date}.
```

### 8.4 Location Question — ROW

```
Generate an event highly relevant to a specific region, city, or town within
{country_prompt_name}, which would be unlikely to be known widely in other
countries or even nationwide.
Date range: {start_date} to {end_date}.
```

### 8.5 Global Question

```
Generate a question about a truly worldwide, universally recognized historical
event. The event should be recognizable to educated people in every country,
regardless of their cultural background.
Date range: {start_date} to {end_date}.

Only use the 'WW' event_origin flag for the most universally recognized events
in human history (e.g., end of World War II, the Covid pandemic).
```

---

## 9. Spec Rebase & Cutover Plan

### 9.1 Sequence

```
1. Deploy all schema changes (new tables, columns, functions)
2. Run event_origin normalization migration
3. Pause elementle_demand cron job
4. Wait for worker to drain questions_to_generate queue
5. Archive all existing specs:
   UPDATE available_question_spec SET active = false, deactivate_reason = 'pivot_rebase';
   (triggers archive via trg_archive_inactive_spec)
6. Deploy updated Edge Functions (calculate-demand, allocate-questions)
7. Deploy updated Worker (new prompts, new fields)
8. Set demand_scheduler_config.frequency_hours = 8
9. Re-enable elementle_demand cron
10. Monitor: first demand run creates fresh specs for all active countries
```

### 9.2 Legacy App Support

Legacy app versions (without expo-localization timezone) will:
- Default `user_profiles.timezone = NULL`
- Fall back to `reference_countries.timezone` via `region_to_timezone()`
- Continue working with `region = 'UK'`

Fast cutover: push app update, legacy support needed for ~3 days max.

---

## 10. Verification Plan

### 10.1 Pre-Deployment

- [ ] All distinct `event_origin` values mapped to ISO codes
- [ ] `reference_countries` seeded with correct timezones, sphere codes
- [ ] `reference_us_states` seeded with all 50 states + DC
- [ ] `region_to_timezone()` returns correct TZ for all active countries
- [ ] Trigger functions tested with non-UK `event_origin`
- [ ] One-way split tested: category INSERT → location spec split confirmed
- [ ] `'WW'` flag tested: splits location specs for all active countries
- [ ] `excluded_spheres` filter tested in allocator master pool query

### 10.2 Post-Deployment

- [ ] Demand runs for all active countries (not just UK)
- [ ] Specs created per-country
- [ ] Worker generates with correct prompt variants (UK/US/ROW/Global)
- [ ] Cultural sphere filtering works (ANG user doesn't get AFR-excluded question)
- [ ] League snapshots fire at correct local midnight
- [ ] 8-hour demand cycle covers all TZ windows
- [ ] US state users get state-specific location questions
- [ ] ROW users get country-specific location questions

---

## 11. Open Questions

> [!IMPORTANT]
> **§2.4** — For US/ROW location questions, should we:
> - **(A)** Seed `location_allocation` with a synthetic entry so the existing allocator works unchanged?
> - **(B)** Add a small branch that detects US/ROW and creates location jobs directly?
>
> Both preserve the 1/3 location ratio. The difference is implementation complexity vs schema purity.

> [!IMPORTANT]
> **Category spec region key** — Should category specs use a shared `'GLOBAL'` region key (single timeline) or remain per-country? Single timeline is simpler for the one-way split but means all category questions share one spec pool globally.
