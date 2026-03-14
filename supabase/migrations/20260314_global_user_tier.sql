-- ============================================================
-- Migration: Make user_tier region-agnostic
-- Date: 2026-03-14
-- Purpose: Remove region from user_tier, treating UK tiers as
--          the global master set. This unblocks signup for
--          non-UK/US countries (e.g. Australia).
-- ============================================================

BEGIN;

-- --------------------------------------------------------
-- 1. Drop the view that depends on user_tier.region
--    (must be dropped before we can drop the column)
-- --------------------------------------------------------
DROP VIEW IF EXISTS public.user_active_tier_view CASCADE;

-- --------------------------------------------------------
-- 2. Reassign users on non-UK tiers → matching UK master tier
-- --------------------------------------------------------
UPDATE user_profiles up
SET    user_tier_id = uk_tier.id,
       updated_at   = NOW()
FROM   user_tier current_tier,
       user_tier uk_tier
WHERE  up.user_tier_id    = current_tier.id
  AND  current_tier.region != 'UK'
  AND  uk_tier.region       = 'UK'
  AND  uk_tier.tier         = current_tier.tier
  AND  uk_tier.tier_type    = current_tier.tier_type;

-- Also update user_subscriptions that reference non-UK tiers
UPDATE user_subscriptions us
SET    user_tier_id = uk_tier.id
FROM   user_tier current_tier,
       user_tier uk_tier
WHERE  us.user_tier_id     = current_tier.id
  AND  current_tier.region != 'UK'
  AND  uk_tier.region       = 'UK'
  AND  uk_tier.tier         = current_tier.tier
  AND  uk_tier.tier_type    = current_tier.tier_type;

-- --------------------------------------------------------
-- 3. Delete duplicate non-UK tiers (now unreferenced)
-- --------------------------------------------------------
DELETE FROM user_tier
WHERE  region != 'UK';

-- --------------------------------------------------------
-- 4. Drop old constraint and column
-- --------------------------------------------------------
ALTER TABLE public.user_tier
  DROP CONSTRAINT IF EXISTS user_tier_region_tier_type_key;

ALTER TABLE public.user_tier
  DROP COLUMN IF EXISTS region;

-- --------------------------------------------------------
-- 5. Add new unique constraint (region-free)
-- --------------------------------------------------------
ALTER TABLE public.user_tier
  ADD CONSTRAINT user_tier_tier_tier_type_key
  UNIQUE (tier, tier_type);

-- --------------------------------------------------------
-- 6. Recreate user_active_tier_view WITHOUT region
--    Original: COALESCE(ut.region, 'UK') AS region
--    Original: LEFT JOIN user_tier st ON st.tier = 'standard' AND st.region = 'UK'
--    Now:      Standard fallback uses LOWER(tier) = 'standard' + tier_type = 'lifetime'
-- --------------------------------------------------------
CREATE OR REPLACE VIEW public.user_active_tier_view AS
SELECT
  u.id AS user_id,
  COALESCE(ut.id, st.id) AS tier_id,
  COALESCE(ut.tier, 'standard') AS tier,
  ut.subscription_cost,
  ut.currency,
  ut.subscription_duration_months,
  COALESCE(ut.streak_savers, 0) AS streak_savers,
  COALESCE(ut.holiday_savers, 0) AS holiday_savers,
  COALESCE(ut.holiday_duration_days, 0) AS holiday_duration_days,
  ut.description,
  us.expires_at,
  us.auto_renew,
  CASE
    WHEN us.id IS NOT NULL
     AND us.status = 'active'
     AND (us.expires_at IS NULL OR us.expires_at > NOW())
    THEN true
    ELSE false
  END AS is_active
FROM auth.users u
LEFT JOIN user_subscriptions us
  ON  us.user_id = u.id
  AND us.status = 'active'
  AND (us.expires_at IS NULL OR us.expires_at > NOW())
LEFT JOIN user_tier ut
  ON ut.id = us.user_tier_id
LEFT JOIN user_tier st
  ON LOWER(st.tier) = 'standard'
  AND st.tier_type = 'lifetime';

-- --------------------------------------------------------
-- 7. Patch the AU test user (assign global standard tier)
-- --------------------------------------------------------
UPDATE user_profiles
SET    user_tier_id = (
         SELECT id FROM user_tier
         WHERE LOWER(tier) = 'standard'
           AND tier_type = 'lifetime'
         LIMIT 1
       ),
       updated_at = NOW()
WHERE  id = '6b113618-7c46-482d-82a7-f3c28ff55516'
  AND  user_tier_id IS NULL;

COMMIT;
