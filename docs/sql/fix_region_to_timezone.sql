-- ============================================================
-- Fix: Replace region_to_timezone() hardcoded CASE statement
-- with dynamic lookup against reference_countries table.
-- ============================================================

-- Drop and recreate (must change from IMMUTABLE to STABLE
-- since it now reads from a table)
CREATE OR REPLACE FUNCTION public.region_to_timezone(p_region text)
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(
    (SELECT timezone FROM public.reference_countries WHERE code = UPPER(COALESCE(p_region, ''))),
    CASE UPPER(COALESCE(p_region, ''))
      WHEN 'GLOBAL' THEN 'Etc/GMT+12'
      ELSE 'Etc/GMT+12'
    END
  );
$$;

-- Verify it works for known codes
-- SELECT region_to_timezone('UK');     -- expect 'Europe/London'
-- SELECT region_to_timezone('US');     -- expect 'America/New_York'
-- SELECT region_to_timezone('FR');     -- expect 'Europe/Paris'
-- SELECT region_to_timezone('GLOBAL'); -- expect 'Etc/GMT+12'
-- SELECT region_to_timezone(NULL);     -- expect 'Etc/GMT+12'
