-- admin_unallocated_masters: Returns master questions NOT allocated for a given region/user
-- Includes quality_score and accuracy_score for admin editing

CREATE OR REPLACE FUNCTION public.admin_unallocated_masters(
    p_table TEXT,
    p_filter_value TEXT,
    p_limit INT DEFAULT 100,
    p_offset INT DEFAULT 0
) RETURNS TABLE(
    question_id INT,
    event_title TEXT,
    event_description TEXT,
    answer_date TEXT,
    question_kind TEXT,
    quality_score INT,
    accuracy_score INT,
    is_approved BOOLEAN,
    categories JSONB,
    created_at TIMESTAMP
)
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    IF p_table = 'region' THEN
        RETURN QUERY
        SELECT
            qm.id AS question_id,
            qm.event_title::TEXT,
            qm.event_description::TEXT,
            qm.answer_date_canonical::TEXT AS answer_date,
            qm.question_kind::TEXT,
            qm.quality_score,
            qm.accuracy_score,
            qm.is_approved,
            qm.categories,
            qm.created_at
        FROM questions_master_region qm
        WHERE NOT EXISTS (
            SELECT 1 FROM questions_allocated_region qa
            WHERE qa.question_id = qm.id
            AND qa.region = p_filter_value
        )
        ORDER BY qm.answer_date_canonical DESC
        LIMIT p_limit OFFSET p_offset;
    ELSIF p_table = 'user' THEN
        RETURN QUERY
        SELECT
            qm.id AS question_id,
            qm.event_title::TEXT,
            qm.event_description::TEXT,
            qm.answer_date_canonical::TEXT AS answer_date,
            qm.question_kind::TEXT,
            qm.quality_score,
            qm.accuracy_score,
            qm.is_approved,
            qm.categories,
            qm.created_at
        FROM questions_master_user qm
        WHERE NOT EXISTS (
            SELECT 1 FROM questions_allocated_user qa
            WHERE qa.question_id = qm.id
            AND qa.user_id = p_filter_value::UUID
        )
        ORDER BY qm.answer_date_canonical DESC
        LIMIT p_limit OFFSET p_offset;
    ELSE
        RAISE EXCEPTION 'Invalid table parameter: must be region or user';
    END IF;
END;
$$;
