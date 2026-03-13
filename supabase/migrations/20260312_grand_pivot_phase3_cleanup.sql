-- ============================================================
-- Legacy Data Cleanup & Phase 3 Catch-Up
-- Run AFTER Phase 3 Steps 1-2 and Triggers.
-- ============================================================

-- =====================
-- PART 1: Populate reference_countries (~195 countries)
-- =====================
-- ON CONFLICT (code) DO NOTHING preserves existing 19 rows.
-- All new countries: active=false, is_tier_1=false.

INSERT INTO reference_countries (code, name, display_name, prompt_name, continent, timezone, cultural_sphere_code, active) VALUES
-- Anglosphere (ANG)
('GB', 'Great Britain', 'Great Britain', 'Great Britain', 'Europe', 'Europe/London', 'ANG', false),
('JM', 'Jamaica', 'Jamaica', 'Jamaica', 'North America', 'America/Jamaica', 'ANG', false),
('TT', 'Trinidad and Tobago', 'Trinidad', 'Trinidad and Tobago', 'North America', 'America/Port_of_Spain', 'ANG', false),
('GY', 'Guyana', 'Guyana', 'Guyana', 'South America', 'America/Guyana', 'ANG', false),
('BZ', 'Belize', 'Belize', 'Belize', 'North America', 'America/Belize', 'ANG', false),
('BB', 'Barbados', 'Barbados', 'Barbados', 'North America', 'America/Barbados', 'ANG', false),
('BS', 'Bahamas', 'Bahamas', 'the Bahamas', 'North America', 'America/Nassau', 'ANG', false),
('FJ', 'Fiji', 'Fiji', 'Fiji', 'Oceania', 'Pacific/Fiji', 'ANG', false),
('PG', 'Papua New Guinea', 'PNG', 'Papua New Guinea', 'Oceania', 'Pacific/Port_Moresby', 'ANG', false),
('SG', 'Singapore', 'Singapore', 'Singapore', 'Asia', 'Asia/Singapore', 'ANG', false),
('PH', 'Philippines', 'Philippines', 'the Philippines', 'Asia', 'Asia/Manila', 'ANG', false),
('MY', 'Malaysia', 'Malaysia', 'Malaysia', 'Asia', 'Asia/Kuala_Lumpur', 'ANG', false),
('GH', 'Ghana', 'Ghana', 'Ghana', 'Africa', 'Africa/Accra', 'ANG', false),
('KE', 'Kenya', 'Kenya', 'Kenya', 'Africa', 'Africa/Nairobi', 'ANG', false),
('MT', 'Malta', 'Malta', 'Malta', 'Europe', 'Europe/Malta', 'ANG', false),
('CY', 'Cyprus', 'Cyprus', 'Cyprus', 'Europe', 'Asia/Nicosia', 'ANG', false),
-- Euro-Latin American (ELA)
('PT', 'Portugal', 'Portugal', 'Portugal', 'Europe', 'Europe/Lisbon', 'ELA', false),
('NL', 'Netherlands', 'Netherlands', 'the Netherlands', 'Europe', 'Europe/Amsterdam', 'ELA', false),
('BE', 'Belgium', 'Belgium', 'Belgium', 'Europe', 'Europe/Brussels', 'ELA', false),
('CH', 'Switzerland', 'Switzerland', 'Switzerland', 'Europe', 'Europe/Zurich', 'ELA', false),
('AT', 'Austria', 'Austria', 'Austria', 'Europe', 'Europe/Vienna', 'ELA', false),
('SE', 'Sweden', 'Sweden', 'Sweden', 'Europe', 'Europe/Stockholm', 'ELA', false),
('NO', 'Norway', 'Norway', 'Norway', 'Europe', 'Europe/Oslo', 'ELA', false),
('DK', 'Denmark', 'Denmark', 'Denmark', 'Europe', 'Europe/Copenhagen', 'ELA', false),
('FI', 'Finland', 'Finland', 'Finland', 'Europe', 'Europe/Helsinki', 'ELA', false),
('PL', 'Poland', 'Poland', 'Poland', 'Europe', 'Europe/Warsaw', 'ELA', false),
('CZ', 'Czech Republic', 'Czechia', 'the Czech Republic', 'Europe', 'Europe/Prague', 'ELA', false),
('SK', 'Slovakia', 'Slovakia', 'Slovakia', 'Europe', 'Europe/Bratislava', 'ELA', false),
('HU', 'Hungary', 'Hungary', 'Hungary', 'Europe', 'Europe/Budapest', 'ELA', false),
('RO', 'Romania', 'Romania', 'Romania', 'Europe', 'Europe/Bucharest', 'ELA', false),
('BG', 'Bulgaria', 'Bulgaria', 'Bulgaria', 'Europe', 'Europe/Sofia', 'ELA', false),
('HR', 'Croatia', 'Croatia', 'Croatia', 'Europe', 'Europe/Zagreb', 'ELA', false),
('SI', 'Slovenia', 'Slovenia', 'Slovenia', 'Europe', 'Europe/Ljubljana', 'ELA', false),
('RS', 'Serbia', 'Serbia', 'Serbia', 'Europe', 'Europe/Belgrade', 'ELA', false),
('BA', 'Bosnia and Herzegovina', 'Bosnia', 'Bosnia and Herzegovina', 'Europe', 'Europe/Sarajevo', 'ELA', false),
('ME', 'Montenegro', 'Montenegro', 'Montenegro', 'Europe', 'Europe/Podgorica', 'ELA', false),
('MK', 'North Macedonia', 'N. Macedonia', 'North Macedonia', 'Europe', 'Europe/Skopje', 'ELA', false),
('AL', 'Albania', 'Albania', 'Albania', 'Europe', 'Europe/Tirane', 'ELA', false),
('GR', 'Greece', 'Greece', 'Greece', 'Europe', 'Europe/Athens', 'ELA', false),
('LT', 'Lithuania', 'Lithuania', 'Lithuania', 'Europe', 'Europe/Vilnius', 'ELA', false),
('LV', 'Latvia', 'Latvia', 'Latvia', 'Europe', 'Europe/Riga', 'ELA', false),
('EE', 'Estonia', 'Estonia', 'Estonia', 'Europe', 'Europe/Tallinn', 'ELA', false),
('IS', 'Iceland', 'Iceland', 'Iceland', 'Europe', 'Atlantic/Reykjavik', 'ELA', false),
('LU', 'Luxembourg', 'Luxembourg', 'Luxembourg', 'Europe', 'Europe/Luxembourg', 'ELA', false),
('AR', 'Argentina', 'Argentina', 'Argentina', 'South America', 'America/Argentina/Buenos_Aires', 'ELA', false),
('CL', 'Chile', 'Chile', 'Chile', 'South America', 'America/Santiago', 'ELA', false),
('CO', 'Colombia', 'Colombia', 'Colombia', 'South America', 'America/Bogota', 'ELA', false),
('PE', 'Peru', 'Peru', 'Peru', 'South America', 'America/Lima', 'ELA', false),
('VE', 'Venezuela', 'Venezuela', 'Venezuela', 'South America', 'America/Caracas', 'ELA', false),
('EC', 'Ecuador', 'Ecuador', 'Ecuador', 'South America', 'America/Guayaquil', 'ELA', false),
('BO', 'Bolivia', 'Bolivia', 'Bolivia', 'South America', 'America/La_Paz', 'ELA', false),
('PY', 'Paraguay', 'Paraguay', 'Paraguay', 'South America', 'America/Asuncion', 'ELA', false),
('UY', 'Uruguay', 'Uruguay', 'Uruguay', 'South America', 'America/Montevideo', 'ELA', false),
('CR', 'Costa Rica', 'Costa Rica', 'Costa Rica', 'North America', 'America/Costa_Rica', 'ELA', false),
('PA', 'Panama', 'Panama', 'Panama', 'North America', 'America/Panama', 'ELA', false),
('GT', 'Guatemala', 'Guatemala', 'Guatemala', 'North America', 'America/Guatemala', 'ELA', false),
('HN', 'Honduras', 'Honduras', 'Honduras', 'North America', 'America/Tegucigalpa', 'ELA', false),
('SV', 'El Salvador', 'El Salvador', 'El Salvador', 'North America', 'America/El_Salvador', 'ELA', false),
('NI', 'Nicaragua', 'Nicaragua', 'Nicaragua', 'North America', 'America/Managua', 'ELA', false),
('CU', 'Cuba', 'Cuba', 'Cuba', 'North America', 'America/Havana', 'ELA', false),
('DO', 'Dominican Republic', 'Dom. Republic', 'the Dominican Republic', 'North America', 'America/Santo_Domingo', 'ELA', false),
('HT', 'Haiti', 'Haiti', 'Haiti', 'North America', 'America/Port-au-Prince', 'ELA', false),
('PR', 'Puerto Rico', 'Puerto Rico', 'Puerto Rico', 'North America', 'America/Puerto_Rico', 'ELA', false),
('UA', 'Ukraine', 'Ukraine', 'Ukraine', 'Europe', 'Europe/Kyiv', 'ELA', false),
('MD', 'Moldova', 'Moldova', 'Moldova', 'Europe', 'Europe/Chisinau', 'ELA', false),
('BY', 'Belarus', 'Belarus', 'Belarus', 'Europe', 'Europe/Minsk', 'ELA', false),
('RU', 'Russia', 'Russia', 'Russia', 'Europe', 'Europe/Moscow', 'ELA', false),
('GE', 'Georgia', 'Georgia', 'Georgia', 'Asia', 'Asia/Tbilisi', 'ELA', false),
('AM', 'Armenia', 'Armenia', 'Armenia', 'Asia', 'Asia/Yerevan', 'ELA', false),
('AZ', 'Azerbaijan', 'Azerbaijan', 'Azerbaijan', 'Asia', 'Asia/Baku', 'ELA', false),
-- East & SE Asia (ASI)
('TW', 'Taiwan', 'Taiwan', 'Taiwan', 'Asia', 'Asia/Taipei', 'ASI', false),
('HK', 'Hong Kong', 'Hong Kong', 'Hong Kong', 'Asia', 'Asia/Hong_Kong', 'ASI', false),
('MO', 'Macau', 'Macau', 'Macau', 'Asia', 'Asia/Macau', 'ASI', false),
('MN', 'Mongolia', 'Mongolia', 'Mongolia', 'Asia', 'Asia/Ulaanbaatar', 'ASI', false),
('TH', 'Thailand', 'Thailand', 'Thailand', 'Asia', 'Asia/Bangkok', 'ASI', false),
('VN', 'Vietnam', 'Vietnam', 'Vietnam', 'Asia', 'Asia/Ho_Chi_Minh', 'ASI', false),
('ID', 'Indonesia', 'Indonesia', 'Indonesia', 'Asia', 'Asia/Jakarta', 'ASI', false),
('MM', 'Myanmar', 'Myanmar', 'Myanmar', 'Asia', 'Asia/Yangon', 'ASI', false),
('KH', 'Cambodia', 'Cambodia', 'Cambodia', 'Asia', 'Asia/Phnom_Penh', 'ASI', false),
('LA', 'Laos', 'Laos', 'Laos', 'Asia', 'Asia/Vientiane', 'ASI', false),
('BN', 'Brunei', 'Brunei', 'Brunei', 'Asia', 'Asia/Brunei', 'ASI', false),
('TL', 'Timor-Leste', 'Timor-Leste', 'Timor-Leste', 'Asia', 'Asia/Dili', 'ASI', false),
('KP', 'North Korea', 'North Korea', 'North Korea', 'Asia', 'Asia/Pyongyang', 'ASI', false),
-- South Asia & MENA (SAM)
('PK', 'Pakistan', 'Pakistan', 'Pakistan', 'Asia', 'Asia/Karachi', 'SAM', false),
('BD', 'Bangladesh', 'Bangladesh', 'Bangladesh', 'Asia', 'Asia/Dhaka', 'SAM', false),
('LK', 'Sri Lanka', 'Sri Lanka', 'Sri Lanka', 'Asia', 'Asia/Colombo', 'SAM', false),
('NP', 'Nepal', 'Nepal', 'Nepal', 'Asia', 'Asia/Kathmandu', 'SAM', false),
('AF', 'Afghanistan', 'Afghanistan', 'Afghanistan', 'Asia', 'Asia/Kabul', 'SAM', false),
('IR', 'Iran', 'Iran', 'Iran', 'Asia', 'Asia/Tehran', 'SAM', false),
('IQ', 'Iraq', 'Iraq', 'Iraq', 'Asia', 'Asia/Baghdad', 'SAM', false),
('SY', 'Syria', 'Syria', 'Syria', 'Asia', 'Asia/Damascus', 'SAM', false),
('JO', 'Jordan', 'Jordan', 'Jordan', 'Asia', 'Asia/Amman', 'SAM', false),
('LB', 'Lebanon', 'Lebanon', 'Lebanon', 'Asia', 'Asia/Beirut', 'SAM', false),
('IL', 'Israel', 'Israel', 'Israel', 'Asia', 'Asia/Jerusalem', 'SAM', false),
('PS', 'Palestine', 'Palestine', 'Palestine', 'Asia', 'Asia/Hebron', 'SAM', false),
('AE', 'United Arab Emirates', 'UAE', 'the United Arab Emirates', 'Asia', 'Asia/Dubai', 'SAM', false),
('QA', 'Qatar', 'Qatar', 'Qatar', 'Asia', 'Asia/Qatar', 'SAM', false),
('KW', 'Kuwait', 'Kuwait', 'Kuwait', 'Asia', 'Asia/Kuwait', 'SAM', false),
('BH', 'Bahrain', 'Bahrain', 'Bahrain', 'Asia', 'Asia/Bahrain', 'SAM', false),
('OM', 'Oman', 'Oman', 'Oman', 'Asia', 'Asia/Muscat', 'SAM', false),
('YE', 'Yemen', 'Yemen', 'Yemen', 'Asia', 'Asia/Aden', 'SAM', false),
('TR', 'Turkey', 'Turkey', 'Turkey', 'Asia', 'Europe/Istanbul', 'SAM', false),
('EG', 'Egypt', 'Egypt', 'Egypt', 'Africa', 'Africa/Cairo', 'SAM', false),
('LY', 'Libya', 'Libya', 'Libya', 'Africa', 'Africa/Tripoli', 'SAM', false),
('TN', 'Tunisia', 'Tunisia', 'Tunisia', 'Africa', 'Africa/Tunis', 'SAM', false),
('DZ', 'Algeria', 'Algeria', 'Algeria', 'Africa', 'Africa/Algiers', 'SAM', false),
('MA', 'Morocco', 'Morocco', 'Morocco', 'Africa', 'Africa/Casablanca', 'SAM', false),
('SD', 'Sudan', 'Sudan', 'Sudan', 'Africa', 'Africa/Khartoum', 'SAM', false),
('MV', 'Maldives', 'Maldives', 'the Maldives', 'Asia', 'Indian/Maldives', 'SAM', false),
('UZ', 'Uzbekistan', 'Uzbekistan', 'Uzbekistan', 'Asia', 'Asia/Tashkent', 'SAM', false),
('KZ', 'Kazakhstan', 'Kazakhstan', 'Kazakhstan', 'Asia', 'Asia/Almaty', 'SAM', false),
('TM', 'Turkmenistan', 'Turkmenistan', 'Turkmenistan', 'Asia', 'Asia/Ashgabat', 'SAM', false),
('KG', 'Kyrgyzstan', 'Kyrgyzstan', 'Kyrgyzstan', 'Asia', 'Asia/Bishkek', 'SAM', false),
('TJ', 'Tajikistan', 'Tajikistan', 'Tajikistan', 'Asia', 'Asia/Dushanbe', 'SAM', false),
-- Sub-Saharan Africa (AFR)
('ET', 'Ethiopia', 'Ethiopia', 'Ethiopia', 'Africa', 'Africa/Addis_Ababa', 'AFR', false),
('TZ', 'Tanzania', 'Tanzania', 'Tanzania', 'Africa', 'Africa/Dar_es_Salaam', 'AFR', false),
('UG', 'Uganda', 'Uganda', 'Uganda', 'Africa', 'Africa/Kampala', 'AFR', false),
('RW', 'Rwanda', 'Rwanda', 'Rwanda', 'Africa', 'Africa/Kigali', 'AFR', false),
('CD', 'Democratic Republic of the Congo', 'DRC', 'the Democratic Republic of the Congo', 'Africa', 'Africa/Kinshasa', 'AFR', false),
('CG', 'Republic of the Congo', 'Congo', 'the Republic of the Congo', 'Africa', 'Africa/Brazzaville', 'AFR', false),
('CM', 'Cameroon', 'Cameroon', 'Cameroon', 'Africa', 'Africa/Douala', 'AFR', false),
('CI', 'Ivory Coast', 'Ivory Coast', 'Ivory Coast', 'Africa', 'Africa/Abidjan', 'AFR', false),
('SN', 'Senegal', 'Senegal', 'Senegal', 'Africa', 'Africa/Dakar', 'AFR', false),
('ML', 'Mali', 'Mali', 'Mali', 'Africa', 'Africa/Bamako', 'AFR', false),
('BF', 'Burkina Faso', 'Burkina Faso', 'Burkina Faso', 'Africa', 'Africa/Ouagadougou', 'AFR', false),
('NE', 'Niger', 'Niger', 'Niger', 'Africa', 'Africa/Niamey', 'AFR', false),
('TD', 'Chad', 'Chad', 'Chad', 'Africa', 'Africa/Ndjamena', 'AFR', false),
('AO', 'Angola', 'Angola', 'Angola', 'Africa', 'Africa/Luanda', 'AFR', false),
('MZ', 'Mozambique', 'Mozambique', 'Mozambique', 'Africa', 'Africa/Maputo', 'AFR', false),
('ZM', 'Zambia', 'Zambia', 'Zambia', 'Africa', 'Africa/Lusaka', 'AFR', false),
('ZW', 'Zimbabwe', 'Zimbabwe', 'Zimbabwe', 'Africa', 'Africa/Harare', 'AFR', false),
('MW', 'Malawi', 'Malawi', 'Malawi', 'Africa', 'Africa/Blantyre', 'AFR', false),
('MG', 'Madagascar', 'Madagascar', 'Madagascar', 'Africa', 'Indian/Antananarivo', 'AFR', false),
('BW', 'Botswana', 'Botswana', 'Botswana', 'Africa', 'Africa/Gaborone', 'AFR', false),
('NA', 'Namibia', 'Namibia', 'Namibia', 'Africa', 'Africa/Windhoek', 'AFR', false),
('LS', 'Lesotho', 'Lesotho', 'Lesotho', 'Africa', 'Africa/Maseru', 'AFR', false),
('SZ', 'Eswatini', 'Eswatini', 'Eswatini', 'Africa', 'Africa/Mbabane', 'AFR', false),
('GM', 'Gambia', 'Gambia', 'the Gambia', 'Africa', 'Africa/Banjul', 'AFR', false),
('GW', 'Guinea-Bissau', 'Guinea-Bissau', 'Guinea-Bissau', 'Africa', 'Africa/Bissau', 'AFR', false),
('GN', 'Guinea', 'Guinea', 'Guinea', 'Africa', 'Africa/Conakry', 'AFR', false),
('SL', 'Sierra Leone', 'Sierra Leone', 'Sierra Leone', 'Africa', 'Africa/Freetown', 'AFR', false),
('LR', 'Liberia', 'Liberia', 'Liberia', 'Africa', 'Africa/Monrovia', 'AFR', false),
('TG', 'Togo', 'Togo', 'Togo', 'Africa', 'Africa/Lome', 'AFR', false),
('BJ', 'Benin', 'Benin', 'Benin', 'Africa', 'Africa/Porto-Novo', 'AFR', false),
('GA', 'Gabon', 'Gabon', 'Gabon', 'Africa', 'Africa/Libreville', 'AFR', false),
('GQ', 'Equatorial Guinea', 'Eq. Guinea', 'Equatorial Guinea', 'Africa', 'Africa/Malabo', 'AFR', false),
('CF', 'Central African Republic', 'CAR', 'the Central African Republic', 'Africa', 'Africa/Bangui', 'AFR', false),
('SS', 'South Sudan', 'South Sudan', 'South Sudan', 'Africa', 'Africa/Juba', 'AFR', false),
('ER', 'Eritrea', 'Eritrea', 'Eritrea', 'Africa', 'Africa/Asmara', 'AFR', false),
('DJ', 'Djibouti', 'Djibouti', 'Djibouti', 'Africa', 'Africa/Djibouti', 'AFR', false),
('SO', 'Somalia', 'Somalia', 'Somalia', 'Africa', 'Africa/Mogadishu', 'AFR', false),
('KM', 'Comoros', 'Comoros', 'Comoros', 'Africa', 'Indian/Comoro', 'AFR', false),
('MU', 'Mauritius', 'Mauritius', 'Mauritius', 'Africa', 'Indian/Mauritius', 'AFR', false),
('SC', 'Seychelles', 'Seychelles', 'the Seychelles', 'Africa', 'Indian/Mahe', 'AFR', false),
('CV', 'Cape Verde', 'Cabo Verde', 'Cape Verde', 'Africa', 'Atlantic/Cape_Verde', 'AFR', false),
('ST', 'Sao Tome and Principe', 'Sao Tome', 'Sao Tome and Principe', 'Africa', 'Africa/Sao_Tome', 'AFR', false),
-- Pacific Islands (ANG sphere proximity)
('WS', 'Samoa', 'Samoa', 'Samoa', 'Oceania', 'Pacific/Apia', 'ANG', false),
('TO', 'Tonga', 'Tonga', 'Tonga', 'Oceania', 'Pacific/Tongatapu', 'ANG', false),
('VU', 'Vanuatu', 'Vanuatu', 'Vanuatu', 'Oceania', 'Pacific/Efate', 'ANG', false),
('SB', 'Solomon Islands', 'Solomon Islands', 'the Solomon Islands', 'Oceania', 'Pacific/Guadalcanal', 'ANG', false)
ON CONFLICT (code) DO NOTHING;


-- =====================
-- PART 2: Text-to-ISO event_origin Translation
-- =====================
-- Match text event_origin against reference_countries.name (case-insensitive).
-- Also handle questions_master_user.

-- questions_master_region
UPDATE questions_master_region qmr
  SET event_origin = rc.code
FROM reference_countries rc
WHERE lower(qmr.event_origin) = lower(rc.name)
  AND qmr.event_origin !~ '^[A-Z]{2}$';

-- questions_master_user
UPDATE questions_master_user qmu
  SET event_origin = rc.code
FROM reference_countries rc
WHERE lower(qmu.event_origin) = lower(rc.name)
  AND qmu.event_origin !~ '^[A-Z]{2}$';


-- =====================
-- PART 3: Seed Location Specs for ALL ROW Countries
-- =====================
-- Remove the active=true filter so EVERY country gets a base timeline.
-- FK constraints fk_aqs_location and fk_aqs_archive_location were already
-- dropped in the earlier Phase 3 run.

INSERT INTO available_question_spec
  (start_date, end_date, region, category_id, location, active, created_at, updated_at)
SELECT '0001-01-01'::date, '9999-01-01'::date, code, 999, NULL, true, now(), now()
FROM reference_countries
WHERE code NOT IN ('UK', 'US')
  AND NOT EXISTS (
    SELECT 1 FROM available_question_spec aqs
    WHERE aqs.region = reference_countries.code AND aqs.category_id = 999 AND aqs.location IS NULL
  );


-- =====================
-- PART 4: Retroactive Location Slicing
-- =====================
-- Slices existing category question dates out of matching location specs.
-- Uses corrected dual-match for ROW + US states.
-- Skips UK and US country-level origins (no matching spec).
-- WW fan-out slices ALL active location specs.

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

-- =====================
-- Verification Queries (uncomment to check)
-- =====================
-- SELECT COUNT(*) FROM reference_countries;  -- Should be ~170+
-- SELECT event_origin, COUNT(*) FROM questions_master_region WHERE event_origin !~ '^[A-Z]{2}$' AND event_origin != 'WW' GROUP BY event_origin; -- Unmapped outliers
-- SELECT event_origin, COUNT(*) FROM questions_master_user WHERE event_origin !~ '^[A-Z]{2}$' AND event_origin != 'WW' GROUP BY event_origin;  -- Unmapped outliers
-- SELECT region, COUNT(*) FROM available_question_spec WHERE category_id = 999 AND active = true GROUP BY region ORDER BY region;  -- Location specs per region
