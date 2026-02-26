-- admin_move_question: Atomically moves a master question between region ↔ user tables.
-- Only works if the question has zero allocations.
-- Returns JSON with { success, new_id, moved_to } or { success: false, error }.

CREATE OR REPLACE FUNCTION public.admin_move_question(
    p_from_table TEXT,
    p_question_id INT
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_new_id INT;
    v_alloc_count INT;
BEGIN
    IF p_from_table = 'region' THEN
        -- Check no allocations exist
        SELECT COUNT(*) INTO v_alloc_count
        FROM questions_allocated_region WHERE question_id = p_question_id;

        IF v_alloc_count > 0 THEN
            RETURN jsonb_build_object('success', false, 'error', 'Question has allocations — unallocate first');
        END IF;

        -- Copy to user table (triggers will fire naturally)
        INSERT INTO questions_master_user (
            answer_date_canonical, event_title, event_description,
            regions, categories, created_at, populated_place_id,
            question_kind, event_origin, quality_score, archive_id,
            accuracy_score, ai_model_used, is_approved
        )
        SELECT
            answer_date_canonical, event_title, event_description,
            regions, categories, created_at, populated_place_id,
            question_kind, event_origin, quality_score, archive_id,
            accuracy_score, ai_model_used, is_approved
        FROM questions_master_region WHERE id = p_question_id
        RETURNING id INTO v_new_id;

        IF v_new_id IS NULL THEN
            RETURN jsonb_build_object('success', false, 'error', 'Source question not found');
        END IF;

        -- Delete from source
        DELETE FROM questions_master_region WHERE id = p_question_id;

        RETURN jsonb_build_object('success', true, 'new_id', v_new_id, 'moved_to', 'user');

    ELSIF p_from_table = 'user' THEN
        SELECT COUNT(*) INTO v_alloc_count
        FROM questions_allocated_user WHERE question_id = p_question_id;

        IF v_alloc_count > 0 THEN
            RETURN jsonb_build_object('success', false, 'error', 'Question has allocations — unallocate first');
        END IF;

        INSERT INTO questions_master_region (
            answer_date_canonical, event_title, event_description,
            regions, categories, created_at, populated_place_id,
            question_kind, event_origin, quality_score, archive_id,
            accuracy_score, ai_model_used, is_approved
        )
        SELECT
            answer_date_canonical, event_title, event_description,
            regions, categories, created_at, populated_place_id,
            question_kind, event_origin, quality_score, archive_id,
            accuracy_score, ai_model_used, is_approved
        FROM questions_master_user WHERE id = p_question_id
        RETURNING id INTO v_new_id;

        IF v_new_id IS NULL THEN
            RETURN jsonb_build_object('success', false, 'error', 'Source question not found');
        END IF;

        DELETE FROM questions_master_user WHERE id = p_question_id;

        RETURN jsonb_build_object('success', true, 'new_id', v_new_id, 'moved_to', 'region');
    ELSE
        RETURN jsonb_build_object('success', false, 'error', 'Invalid table: must be region or user');
    END IF;
END;
$$;
