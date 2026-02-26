-- Fix: cast all VARCHAR columns to TEXT in admin_allocation_stats
-- The actual table columns use VARCHAR(100) etc. but the RPC declares TEXT.

DROP FUNCTION IF EXISTS public.admin_allocation_stats(TEXT, TEXT, INT, INT);

CREATE OR REPLACE FUNCTION public.admin_allocation_stats(
    p_table TEXT,
    p_filter_value TEXT,
    p_limit INT DEFAULT 100,
    p_offset INT DEFAULT 0
) RETURNS TABLE(
    alloc_id INT,
    puzzle_date DATE,
    question_id INT,
    category_id INT,
    category_name TEXT,
    event_title TEXT,
    event_description TEXT,
    answer_date TEXT,
    question_kind TEXT,
    is_approved BOOLEAN,
    play_count BIGINT,
    win_count BIGINT,
    avg_guesses NUMERIC,
    is_played BOOLEAN
)
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    IF p_table = 'region' THEN
        RETURN QUERY
        SELECT
            qa.id AS alloc_id,
            qa.puzzle_date::DATE,
            qa.question_id,
            qa.category_id,
            c.name::TEXT AS category_name,
            qm.event_title::TEXT,
            qm.event_description::TEXT,
            qm.answer_date_canonical::TEXT AS answer_date,
            qm.question_kind::TEXT,
            qm.is_approved,
            COUNT(ga.id)::BIGINT AS play_count,
            COUNT(ga.id) FILTER (WHERE ga.result = 'won')::BIGINT AS win_count,
            ROUND(AVG(ga.num_guesses) FILTER (WHERE ga.result = 'won'), 1) AS avg_guesses,
            (COUNT(ga.id) > 0) AS is_played
        FROM questions_allocated_region qa
        JOIN questions_master_region qm ON qm.id = qa.question_id
        JOIN categories c ON c.id = qa.category_id
        LEFT JOIN game_attempts_region ga ON ga.allocated_region_id = qa.id
        WHERE qa.region = p_filter_value
        GROUP BY qa.id, qa.puzzle_date, qa.question_id, qa.category_id,
                 c.name, qm.event_title, qm.event_description,
                 qm.answer_date_canonical, qm.question_kind, qm.is_approved
        ORDER BY qa.puzzle_date DESC
        LIMIT p_limit OFFSET p_offset;
    ELSIF p_table = 'user' THEN
        RETURN QUERY
        SELECT
            qa.id AS alloc_id,
            qa.puzzle_date::DATE,
            qa.question_id,
            qa.category_id,
            c.name::TEXT AS category_name,
            qm.event_title::TEXT,
            qm.event_description::TEXT,
            qm.answer_date_canonical::TEXT AS answer_date,
            qm.question_kind::TEXT,
            qm.is_approved,
            COUNT(ga.id)::BIGINT AS play_count,
            COUNT(ga.id) FILTER (WHERE ga.result = 'won')::BIGINT AS win_count,
            ROUND(AVG(ga.num_guesses) FILTER (WHERE ga.result = 'won'), 1) AS avg_guesses,
            (COUNT(ga.id) > 0) AS is_played
        FROM questions_allocated_user qa
        JOIN questions_master_user qm ON qm.id = qa.question_id
        JOIN categories c ON c.id = qa.category_id
        LEFT JOIN game_attempts_user ga ON ga.allocated_user_id = qa.id
        WHERE qa.user_id = p_filter_value::UUID
        GROUP BY qa.id, qa.puzzle_date, qa.question_id, qa.category_id,
                 c.name, qm.event_title, qm.event_description,
                 qm.answer_date_canonical, qm.question_kind, qm.is_approved
        ORDER BY qa.puzzle_date DESC
        LIMIT p_limit OFFSET p_offset;
    ELSE
        RAISE EXCEPTION 'Invalid table parameter: must be region or user';
    END IF;
END;
$$;
