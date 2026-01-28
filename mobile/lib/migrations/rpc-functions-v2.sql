-- =====================================================
-- Supabase RPC Functions Update (v2)
-- =====================================================
-- Fixes the PGRST202 error by properly defining the function
-- with the new p_start_date parameter.
-- =====================================================

-- Function: Activate Holiday Mode (Mobile)
-- Updated with p_start_date parameter for backfilling scenarios
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

    -- Update stats: Increment holidays used, Reset streak, Set Holiday Flags
    UPDATE user_stats_user
    SET 
        holidays_used_year = v_holidays_used + p_duration_days,
        current_streak = 0, -- Reset streak (protected)
        holiday_active = TRUE,
        holiday_start_date = v_start_date,
        holiday_end_date = v_end_date,
        missed_yesterday_flag_user = FALSE,
        holiday_days_taken_current_period = 0,
        holiday_ended = FALSE
    WHERE user_id = p_user_id;

    -- Update Region Stats too (Clear missed flag to ensure global rescue)
    UPDATE user_stats_region
    SET missed_yesterday_flag_region = FALSE
    WHERE user_id = p_user_id;

    -- Insert Holiday Rows (BACKFILL ONLY)
    -- Only insert if we have a streak to save AND date is in the past
    IF v_current_streak > 0 THEN
        FOR i IN 0..p_duration_days-1 LOOP
            v_check_date := v_start_date + i;
            
            -- STRICTLY BACKFILL: Only insert for past dates. Future protection is handled by holiday_active flag.
            IF v_check_date < CURRENT_DATE THEN
                -- Check if attempt already exists (by joining with allocation)
                IF NOT EXISTS (
                    SELECT 1 
                    FROM game_attempts_user gau
                    JOIN questions_allocated_user qau ON gau.allocated_user_id = qau.id
                    WHERE gau.user_id = p_user_id 
                    AND qau.puzzle_date = v_check_date
                ) THEN
                    -- Find allocation for this date
                    DECLARE
                        v_allocation_id INTEGER;
                    BEGIN
                        SELECT id INTO v_allocation_id
                        FROM questions_allocated_user
                        WHERE user_id = p_user_id 
                        AND puzzle_date = v_check_date
                        LIMIT 1;

                        -- Only insert if allocation exists
                        IF v_allocation_id IS NOT NULL THEN
                            INSERT INTO game_attempts_user (
                                user_id,
                                allocated_user_id,
                                streak_day_status, -- 0 = Holiday
                                num_guesses
                            ) VALUES (
                                p_user_id,
                                v_allocation_id,
                                0, -- Holiday Status
                                0
                            );
                        END IF;
                    END;
                END IF;
            END IF;
        END LOOP;
    END IF;

    RETURN QUERY SELECT TRUE, 'Holiday mode activated successfully from ' || v_start_date::TEXT;
END;
$$;
