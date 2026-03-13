-- Add sub_region and timezone columns to user_profiles
-- sub_region: Used for US state identification (format: 'US-XX')
-- timezone: IANA timezone string from device locale detection

ALTER TABLE user_profiles
    ADD COLUMN IF NOT EXISTS sub_region TEXT DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS timezone TEXT DEFAULT NULL;

-- Optional: Add a comment explaining usage
COMMENT ON COLUMN user_profiles.sub_region IS 'Sub-region identifier, e.g. US-TX for Texas. Used for US state-level question personalisation.';
COMMENT ON COLUMN user_profiles.timezone IS 'IANA timezone string from device locale detection, e.g. America/New_York.';
