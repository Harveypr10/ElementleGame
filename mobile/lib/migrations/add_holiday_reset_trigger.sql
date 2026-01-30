-- Migration: Add Holiday Reset Date Trigger
-- Ensures 'next_holiday_reset_date' is initialized when a user upgrades to a tier with holiday allowance.

-- 1. Create the Trigger Function
CREATE OR REPLACE FUNCTION set_initial_holiday_reset_date()
RETURNS TRIGGER 
LANGUAGE plpgsql
AS $$
DECLARE
    v_holiday_savers INTEGER;
BEGIN
    -- Check if the NEW tier has holiday allowance (holiday_savers > 0)
    -- We join user_tier to get the allowance count
    SELECT holiday_savers INTO v_holiday_savers
    FROM user_tier
    WHERE id = NEW.user_tier_id;

    -- If the new tier allows holidays (v_holiday_savers > 0)
    IF v_holiday_savers > 0 THEN
        -- Update the reset date for this user, BUT ONLY if it is currently NULL
        -- This prevents overwriting an existing cycle date for returning pro users
        UPDATE user_stats_user
        SET next_holiday_reset_date = (CURRENT_DATE + INTERVAL '1 year')::DATE
        WHERE user_id = NEW.id
          AND next_holiday_reset_date IS NULL;
    END IF;

    RETURN NEW;
END;
$$;

-- 2. Create the Trigger on user_profiles
-- We trigger on UPDATE of user_tier_id, as that signals a subscription change
DROP TRIGGER IF EXISTS trg_set_initial_holiday_reset ON user_profiles;

CREATE TRIGGER trg_set_initial_holiday_reset
AFTER UPDATE OF user_tier_id ON user_profiles
FOR EACH ROW
WHEN (OLD.user_tier_id IS DISTINCT FROM NEW.user_tier_id) -- Optimization: Only run when tier actually changes
EXECUTE FUNCTION set_initial_holiday_reset_date();

-- 3. Also cover INSERT (for new users created directly with a Pro tier, if that happens)
DROP TRIGGER IF EXISTS trg_set_initial_holiday_reset_insert ON user_profiles;

CREATE TRIGGER trg_set_initial_holiday_reset_insert
AFTER INSERT ON user_profiles
FOR EACH ROW
EXECUTE FUNCTION set_initial_holiday_reset_date();
