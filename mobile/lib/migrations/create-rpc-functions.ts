/**
 * Supabase RPC Function Migration Script
 * 
 * This script creates all required RPC functions for:
 * - Holiday Mode (activate/end)
 * - Badge Awarding (streak, elementle, percentile)
 * 
 * Run this once to set up the database functions.
 */

import { supabase } from './supabase';

const RPC_FUNCTIONS = {
    activate_holiday_mode: `
CREATE OR REPLACE FUNCTION activate_holiday_mode(
    p_user_id UUID,
    p_duration_days INTEGER
)
RETURNS TABLE(success BOOLEAN, message TEXT)
LANGUAGE plpgsql
AS $$
DECLARE
    v_holidays_used INTEGER;
    v_current_streak INTEGER;
    v_start_date DATE := CURRENT_DATE;
    v_end_date DATE := CURRENT_DATE + p_duration_days;
    v_check_date DATE;
BEGIN
    -- Get current stats
    SELECT holidays_used_year, current_streak
    INTO v_holidays_used, v_current_streak
    FROM user_stats_user
    WHERE user_id = p_user_id;
    
    -- Check if eligible (has streak, hasn't exceeded allowance)
    IF v_current_streak = 0 THEN
        RETURN QUERY SELECT FALSE, 'No streak to protect';
        RETURN;
    END IF;
    
    -- Update stats
    UPDATE user_stats_user
    SET 
        holiday_active = TRUE,
        holiday_start_date = v_start_date,
        holiday_end_date = v_end_date,
        holiday_days_taken_current_period = 0,
        holidays_used_year = holidays_used_year + 1
    WHERE user_id = p_user_id;
    
    -- Create game attempts with streak_day_status = 0 for date range
    v_check_date := v_start_date;
    WHILE v_check_date <= v_end_date LOOP
        -- Insert into game_attempts_user if allocated question exists for this date
        INSERT INTO game_attempts_user (user_id, allocated_user_id, streak_day_status)
        SELECT p_user_id, qa.id, 0
        FROM questions_allocated_user qa
        WHERE qa.user_id = p_user_id 
          AND qa.puzzle_date = v_check_date
        ON CONFLICT (user_id, allocated_user_id) 
        DO UPDATE SET streak_day_status = 0;
        
        v_check_date := v_check_date + 1;
    END LOOP;
    
    RETURN QUERY SELECT TRUE, 'Holiday activated';
END;
$$;
  `,

    end_holiday_mode: `
CREATE OR REPLACE FUNCTION end_holiday_mode(
    p_user_id UUID,
    p_acknowledge BOOLEAN DEFAULT FALSE
)
RETURNS TABLE(success BOOLEAN, message TEXT)
LANGUAGE plpgsql
AS $$
BEGIN
    UPDATE user_stats_user
    SET 
        holiday_active = FALSE,
        holiday_ended = CASE WHEN p_acknowledge THEN FALSE ELSE TRUE END,
        holiday_days_taken_current_period = CURRENT_DATE - holiday_start_date
    WHERE user_id = p_user_id
      AND holiday_active = TRUE;
    
    RETURN QUERY SELECT TRUE, 'Holiday ended';
END;
$$;
  `,

    check_and_award_streak_badge: `
CREATE OR REPLACE FUNCTION check_and_award_streak_badge(
    p_user_id UUID,
    p_streak INTEGER,
    p_game_type TEXT,
    p_region TEXT
)
RETURNS TABLE(
    id INTEGER,
    user_id UUID,
    badge_id INTEGER,
    game_type TEXT,
    region TEXT,
    badge_count INTEGER,
    is_awarded BOOLEAN,
    awarded_at TIMESTAMP,
    badge_name TEXT,
    badge_category TEXT,
    badge_threshold INTEGER
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_threshold INTEGER;
    v_badge_id INTEGER;
    v_existing_id INTEGER;
BEGIN
    -- Find highest qualified threshold
    SELECT MAX(threshold) INTO v_threshold
    FROM badges
    WHERE category = 'Streak' AND threshold <= p_streak;
    
    IF v_threshold IS NULL THEN
        RETURN; -- No badge earned
    END IF;
    
    -- Get badge ID
    SELECT badges.id INTO v_badge_id
    FROM badges
    WHERE category = 'Streak' AND threshold = v_threshold;
    
    -- Check if already exists
    SELECT user_badges.id INTO v_existing_id
    FROM user_badges
    WHERE user_badges.user_id = p_user_id
      AND user_badges.badge_id = v_badge_id
      AND user_badges.game_type = p_game_type
      AND user_badges.region = p_region;
    
    IF v_existing_id IS NOT NULL THEN
        -- Increment badge_count, set is_awarded = false
        UPDATE user_badges
        SET badge_count = badge_count + 1,
            is_awarded = FALSE,
            awarded_at = NOW()
        WHERE user_badges.id = v_existing_id;
        
        RETURN QUERY
        SELECT ub.id, ub.user_id, ub.badge_id, ub.game_type, ub.region, 
               ub.badge_count, ub.is_awarded, ub.awarded_at,
               b.name, b.category, b.threshold
        FROM user_badges ub
        JOIN badges b ON ub.badge_id = b.id
        WHERE ub.id = v_existing_id;
    ELSE
        -- Create new badge
        INSERT INTO user_badges (user_id, badge_id, game_type, region, badge_count, is_awarded)
        VALUES (p_user_id, v_badge_id, p_game_type, p_region, 1, FALSE)
        RETURNING user_badges.id INTO v_existing_id;
        
        RETURN QUERY
        SELECT ub.id, ub.user_id, ub.badge_id, ub.game_type, ub.region, 
               ub.badge_count, ub.is_awarded, ub.awarded_at,
               b.name, b.category, b.threshold
        FROM user_badges ub
        JOIN badges b ON ub.badge_id = b.id
        WHERE ub.id = v_existing_id;
    END IF;
END;
$$;
  `,

    check_and_award_elementle_badge: `
CREATE OR REPLACE FUNCTION check_and_award_elementle_badge(
    p_user_id UUID,
    p_guess_count INTEGER,
    p_game_type TEXT,
    p_region TEXT
)
RETURNS TABLE(
    id INTEGER,
    user_id UUID,
    badge_id INTEGER,
    game_type TEXT,
    region TEXT,
    badge_count INTEGER,
    is_awarded BOOLEAN,
    awarded_at TIMESTAMP,
    badge_name TEXT,
    badge_category TEXT,
    badge_threshold INTEGER
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_badge_id INTEGER;
    v_existing_id INTEGER;
BEGIN
    -- Only award for 1 or 2 guesses
    IF p_guess_count <> 1 AND p_guess_count <> 2 THEN
        RETURN;
    END IF;
    
    -- Get badge ID for this threshold
    SELECT badges.id INTO v_badge_id
    FROM badges
    WHERE category = 'Elementle In' AND threshold = p_guess_count;
    
    IF v_badge_id IS NULL THEN
        RETURN; -- No badge found
    END IF;
    
    -- Check if already exists
    SELECT user_badges.id INTO v_existing_id
    FROM user_badges
    WHERE user_badges.user_id = p_user_id
      AND user_badges.badge_id = v_badge_id
      AND user_badges.game_type = p_game_type
      AND user_badges.region = p_region;
    
    IF v_existing_id IS NOT NULL THEN
        -- Increment badge_count, set is_awarded = false
        UPDATE user_badges
        SET badge_count = badge_count + 1,
            is_awarded = FALSE,
            awarded_at = NOW()
        WHERE user_badges.id = v_existing_id;
        
        RETURN QUERY
        SELECT ub.id, ub.user_id, ub.badge_id, ub.game_type, ub.region, 
               ub.badge_count, ub.is_awarded, ub.awarded_at,
               b.name, b.category, b.threshold
        FROM user_badges ub
        JOIN badges b ON ub.badge_id = b.id
        WHERE ub.id = v_existing_id;
    ELSE
        -- Create new badge
        INSERT INTO user_badges (user_id, badge_id, game_type, region, badge_count, is_awarded)
        VALUES (p_user_id, v_badge_id, p_game_type, p_region, 1, FALSE)
        RETURNING user_badges.id INTO v_existing_id;
        
        RETURN QUERY
        SELECT ub.id, ub.user_id, ub.badge_id, ub.game_type, ub.region, 
               ub.badge_count, ub.is_awarded, ub.awarded_at,
               b.name, b.category, b.threshold
        FROM user_badges ub
        JOIN badges b ON ub.badge_id = b.id
        WHERE ub.id = v_existing_id;
    END IF;
END;
$$;
  `,

    check_and_award_percentile_badge: `
CREATE OR REPLACE FUNCTION check_and_award_percentile_badge(
    p_user_id UUID,
    p_game_type TEXT,
    p_region TEXT
)
RETURNS TABLE(
    id INTEGER,
    user_id UUID,
    badge_id INTEGER,
    game_type TEXT,
    region TEXT,
    badge_count INTEGER,
    is_awarded BOOLEAN,
    awarded_at TIMESTAMP,
    badge_name TEXT,
    badge_category TEXT,
    badge_threshold INTEGER
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_user_rank INTEGER;
    v_total_users INTEGER;
    v_percentile NUMERIC;
    v_threshold INTEGER;
    v_badge_id INTEGER;
    v_existing_id INTEGER;
    v_stats_table TEXT;
BEGIN
    -- Determine which stats table to query
    v_stats_table := CASE WHEN p_game_type = 'REGION' THEN 'user_stats_region' ELSE 'user_stats_user' END;
    
    -- Get user's rank and total users (ordered by games_won DESC, then games_played ASC)
    -- For REGION mode, filter by region
    IF p_game_type = 'REGION' THEN
        EXECUTE format('
            SELECT 
                ROW_NUMBER() OVER (ORDER BY games_won DESC, games_played ASC),
                COUNT(*) OVER ()
            FROM %I
            WHERE region = $1 AND user_id = $2
        ', v_stats_table)
        INTO v_user_rank, v_total_users
        USING p_region, p_user_id;
    ELSE
        EXECUTE format('
            SELECT 
                ROW_NUMBER() OVER (ORDER BY games_won DESC, games_played ASC),
                COUNT(*) OVER ()
            FROM %I
            WHERE user_id = $1
        ', v_stats_table)
        INTO v_user_rank, v_total_users
        USING p_user_id;
    END IF;
    
    -- Calculate percentile
    IF v_total_users = 0 OR v_user_rank IS NULL THEN
        RETURN; -- No data
    END IF;
    
    v_percentile := (v_user_rank::NUMERIC / v_total_users::NUMERIC) * 100;
    
    -- Find highest qualified percentile badge (lower is better: 1% > 5% > 10%)
    SELECT MIN(threshold) INTO v_threshold
    FROM badges
    WHERE category = 'Percentile' AND threshold >= v_percentile;
    
    IF v_threshold IS NULL THEN
        RETURN; -- No badge earned
    END IF;
    
    -- Get badge ID
    SELECT badges.id INTO v_badge_id
    FROM badges
    WHERE category = 'Percentile' AND threshold = v_threshold;
    
    -- Check if already exists
    SELECT user_badges.id INTO v_existing_id
    FROM user_badges
    WHERE user_badges.user_id = p_user_id
      AND user_badges.badge_id = v_badge_id
      AND user_badges.game_type = p_game_type
      AND user_badges.region = p_region;
    
    IF v_existing_id IS NOT NULL THEN
        -- Increment badge_count, set is_awarded = false
        UPDATE user_badges
        SET badge_count = badge_count + 1,
            is_awarded = FALSE,
            awarded_at = NOW()
        WHERE user_badges.id = v_existing_id;
        
        RETURN QUERY
        SELECT ub.id, ub.user_id, ub.badge_id, ub.game_type, ub.region, 
               ub.badge_count, ub.is_awarded, ub.awarded_at,
               b.name, b.category, b.threshold
        FROM user_badges ub
        JOIN badges b ON ub.badge_id = b.id
        WHERE ub.id = v_existing_id;
    ELSE
        -- Create new badge
        INSERT INTO user_badges (user_id, badge_id, game_type, region, badge_count, is_awarded)
        VALUES (p_user_id, v_badge_id, p_game_type, p_region, 1, FALSE)
        RETURNING user_badges.id INTO v_existing_id;
        
        RETURN QUERY
        SELECT ub.id, ub.user_id, ub.badge_id, ub.game_type, ub.region, 
               ub.badge_count, ub.is_awarded, ub.awarded_at,
               b.name, b.category, b.threshold
        FROM user_badges ub
        JOIN badges b ON ub.badge_id = b.id
        WHERE ub.id = v_existing_id;
    END IF;
END;
$$;
  `
};

export async function createRPCFunctions() {
    console.log('🚀 Creating Supabase RPC functions...');

    for (const [name, sql] of Object.entries(RPC_FUNCTIONS)) {
        try {
            console.log(`Creating function: ${name}...`);

            const { data, error } = await supabase.rpc('exec_sql', {
                sql_query: sql
            });

            if (error) {
                console.error(`❌ Error creating ${name}:`, error);
                throw error;
            }

            console.log(`✅ Created ${name}`);
        } catch (error) {
            console.error(`❌ Failed to create ${name}:`, error);
            throw error;
        }
    }

    console.log('🎉 All RPC functions created successfully!');
}

// Self-executing if run directly
if (require.main === module) {
    createRPCFunctions()
        .then(() => {
            console.log('Migration complete!');
            process.exit(0);
        })
        .catch((error) => {
            console.error('Migration failed:', error);
            process.exit(1);
        });
}
