-- Migration: Fix Holiday Logic for Mobile (Instance-based Usage & Inclusive Daily Calc)

-- 1. Helper Function: Recalculate Progress (Ensures consistent inclusive calculation)
-- This is shared or new, so name can be generic.
CREATE OR REPLACE FUNCTION recalc_holiday_progress(p_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
    v_holiday_start DATE;
    v_holiday_active BOOLEAN;
    v_days_taken INTEGER;
BEGIN
    SELECT holiday_start_date, holiday_active
    INTO v_holiday_start, v_holiday_active
    FROM user_stats_user
    WHERE user_id = p_user_id;

    IF v_holiday_active AND v_holiday_start IS NOT NULL THEN
        -- Inclusive calculation: (Current - Start) + 1
        v_days_taken := (CURRENT_DATE - v_holiday_start) + 1;
        
        -- Don't allow negative
        IF v_days_taken < 0 THEN v_days_taken := 0; END IF;

        UPDATE user_stats_user
        SET holiday_days_taken_current_period = v_days_taken
        WHERE user_id = p_user_id;
    END IF;
END;
$$;

-- 2. Update Activate Holiday Mode MOBILE (Fixing the increment bug)
-- Mobile version supports p_start_date for backfilling
CREATE OR REPLACE FUNCTION activate_holiday_mode_mobile(
    p_user_id UUID,
    p_duration_days INTEGER,
    p_start_date DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE(success BOOLEAN, message TEXT)
LANGUAGE plpgsql
AS $$
DECLARE
    v_holidays_used INTEGER;
    v_current_streak INTEGER;
    v_start_date DATE := p_start_date;
    v_end_date DATE := p_start_date + p_duration_days;
    v_check_date DATE;
BEGIN
    -- Get current stats
    SELECT holidays_used_year, current_streak
    INTO v_holidays_used, v_current_streak
    FROM user_stats_user
    WHERE user_id = p_user_id;
    
    -- Check if user exists
    IF NOT FOUND THEN
        RETURN QUERY SELECT FALSE, 'User stats not found';
        RETURN;
    END IF;
    
    -- Update stats
    UPDATE user_stats_user
    SET 
        holidays_used_year = holidays_used_year + 1, -- FIX: Increment by 1 INSTANCE (was + duration)
        current_streak = 0, -- Reset streak (protected)
        holiday_active = TRUE,
        holiday_start_date = v_start_date,
        holiday_end_date = v_end_date,
        missed_yesterday_flag_user = FALSE,
        holiday_days_taken_current_period = 0, -- Will be updated by recalc or next view
        holiday_ended = FALSE
    WHERE user_id = p_user_id;

    -- Update Region Stats too (Clear missed flag to ensure global rescue)
    UPDATE user_stats_region
    SET missed_yesterday_flag_region = FALSE
    WHERE user_id = p_user_id;

    -- Note: Mobile client handles game_attempts_user backfill via hook logic 
    -- OR this function can do it. The existing v2 logic had backfill loop.
    -- We should preserve the backfill loop from v2 if we are replacing it.
    -- Re-adding backfill logic from v2 to ensure no regression:
    
    IF v_current_streak > 0 THEN
        FOR i IN 0..p_duration_days-1 LOOP
            v_check_date := v_start_date + i;
            IF v_check_date < CURRENT_DATE THEN
                -- Check if attempt already exists
                IF NOT EXISTS (
                    SELECT 1 
                    FROM game_attempts_user gau
                    JOIN questions_allocated_user qau ON gau.allocated_user_id = qau.id
                    WHERE gau.user_id = p_user_id 
                    AND qau.puzzle_date = v_check_date
                ) THEN
                    -- Find allocation and insert holiday row
                     INSERT INTO game_attempts_user (user_id, allocated_user_id, streak_day_status, num_guesses)
                     SELECT p_user_id, id, 0, 0
                     FROM questions_allocated_user
                     WHERE user_id = p_user_id AND puzzle_date = v_check_date
                     LIMIT 1;
                END IF;
            END IF;
        END LOOP;
    END IF;

    RETURN QUERY SELECT TRUE, 'Holiday mode activated successfully';
END;
$$;

-- 3. Update End Holiday Mode MOBILE (Fixing calculation, no refund)
CREATE OR REPLACE FUNCTION end_holiday_mode_mobile(
    p_user_id UUID,
    p_acknowledge BOOLEAN DEFAULT FALSE
)
RETURNS TABLE(success BOOLEAN, message TEXT)
LANGUAGE plpgsql
AS $$
DECLARE
    v_start_date DATE;
    v_days_used INTEGER;
BEGIN
    SELECT holiday_start_date INTO v_start_date
    FROM user_stats_user
    WHERE user_id = p_user_id AND holiday_active = TRUE;

    -- Calculate final days used (inclusive)
    IF v_start_date IS NOT NULL THEN
        v_days_used := (CURRENT_DATE - v_start_date) + 1;
        IF v_days_used < 0 THEN v_days_used := 0; END IF;
    ELSE
        v_days_used := 0;
    END IF;

    -- Update Stats
    UPDATE user_stats_user
    SET 
        holiday_active = FALSE,
        holiday_ended = CASE WHEN p_acknowledge THEN FALSE ELSE TRUE END,
        holiday_days_taken_current_period = v_days_used,
        holiday_start_date = NULL,
        holiday_end_date = NULL
    WHERE user_id = p_user_id
      AND holiday_active = TRUE;
    
    RETURN QUERY SELECT TRUE, 'Holiday ended';
END;
$$;
