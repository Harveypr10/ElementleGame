-- ═══════════════════════════════════════════════════════════════
-- Question Management CMS: SQL Setup
-- Run in Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════════

-- ─── 1. RLS Policies ────────────────────────────────────────

-- Admin UPDATE on master tables (for editing fields + approving)
CREATE POLICY "Admins can update questions_master_region"
    ON public.questions_master_region FOR UPDATE
    USING (public.is_admin());

CREATE POLICY "Admins can update questions_master_user"
    ON public.questions_master_user FOR UPDATE
    USING (public.is_admin());

-- Admin UPDATE on allocated tables (for re-dating, unallocating)
CREATE POLICY "Admins can update questions_allocated_region"
    ON public.questions_allocated_region FOR UPDATE
    USING (public.is_admin());

CREATE POLICY "Admins can update questions_allocated_user"
    ON public.questions_allocated_user FOR UPDATE
    USING (public.is_admin());

-- Admin DELETE on allocated tables (for unallocating)
CREATE POLICY "Admins can delete questions_allocated_region"
    ON public.questions_allocated_region FOR DELETE
    USING (public.is_admin());

CREATE POLICY "Admins can delete questions_allocated_user"
    ON public.questions_allocated_user FOR DELETE
    USING (public.is_admin());


-- ─── 2. Views for Master Library ────────────────────────────

-- Region master + allocation stats
CREATE OR REPLACE VIEW public.v_questions_master_region_stats AS
SELECT
    qm.*,
    COALESCE(agg.allocation_count, 0) AS allocation_count,
    agg.earliest_allocation_date
FROM public.questions_master_region qm
LEFT JOIN LATERAL (
    SELECT
        COUNT(*) AS allocation_count,
        MIN(qa.puzzle_date)::DATE AS earliest_allocation_date
    FROM public.questions_allocated_region qa
    WHERE qa.question_id = qm.id
) agg ON TRUE;

-- User master + allocation stats
CREATE OR REPLACE VIEW public.v_questions_master_user_stats AS
SELECT
    qm.*,
    COALESCE(agg.allocation_count, 0) AS allocation_count,
    agg.earliest_allocation_date
FROM public.questions_master_user qm
LEFT JOIN LATERAL (
    SELECT
        COUNT(*) AS allocation_count,
        MIN(qa.puzzle_date)::DATE AS earliest_allocation_date
    FROM public.questions_allocated_user qa
    WHERE qa.question_id = qm.id
) agg ON TRUE;

-- RLS on views — views inherit from underlying table policies,
-- but we grant explicit SELECT to ensure admin access:
GRANT SELECT ON public.v_questions_master_region_stats TO authenticated;
GRANT SELECT ON public.v_questions_master_user_stats TO authenticated;


-- ─── 3. RPC: Atomic Swap of Puzzle Dates ────────────────────

CREATE OR REPLACE FUNCTION public.admin_swap_puzzle_dates(
    p_table TEXT,
    p_alloc_id_a BIGINT,
    p_alloc_id_b BIGINT
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_date_a DATE;
    v_date_b DATE;
    v_played_a BOOLEAN;
    v_played_b BOOLEAN;
BEGIN
    -- Validate table parameter
    IF p_table NOT IN ('region', 'user') THEN
        RETURN jsonb_build_object('success', false, 'error', 'Invalid table parameter');
    END IF;

    -- Fetch current dates and played status
    IF p_table = 'region' THEN
        SELECT qa.puzzle_date::DATE,
               EXISTS(SELECT 1 FROM game_attempts_region ga WHERE ga.allocated_region_id = qa.id)
        INTO v_date_a, v_played_a
        FROM questions_allocated_region qa WHERE qa.id = p_alloc_id_a;

        SELECT qa.puzzle_date::DATE,
               EXISTS(SELECT 1 FROM game_attempts_region ga WHERE ga.allocated_region_id = qa.id)
        INTO v_date_b, v_played_b
        FROM questions_allocated_region qa WHERE qa.id = p_alloc_id_b;
    ELSE
        SELECT qa.puzzle_date::DATE,
               EXISTS(SELECT 1 FROM game_attempts_user ga WHERE ga.allocated_user_id = qa.id)
        INTO v_date_a, v_played_a
        FROM questions_allocated_user qa WHERE qa.id = p_alloc_id_a;

        SELECT qa.puzzle_date::DATE,
               EXISTS(SELECT 1 FROM game_attempts_user ga WHERE ga.allocated_user_id = qa.id)
        INTO v_date_b, v_played_b
        FROM questions_allocated_user qa WHERE qa.id = p_alloc_id_b;
    END IF;

    -- Safety: both must exist and be unplayed
    IF v_date_a IS NULL OR v_date_b IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'One or both allocation IDs not found');
    END IF;

    IF v_played_a OR v_played_b THEN
        RETURN jsonb_build_object('success', false, 'error', 'Cannot swap: one or both puzzles have been played');
    END IF;

    IF v_date_a = v_date_b THEN
        RETURN jsonb_build_object('success', false, 'error', 'Both allocations have the same date');
    END IF;

    -- Atomic 3-step swap using sentinel date to avoid unique constraint violation
    IF p_table = 'region' THEN
        UPDATE questions_allocated_region SET puzzle_date = '1900-01-01' WHERE id = p_alloc_id_a;
        UPDATE questions_allocated_region SET puzzle_date = v_date_a WHERE id = p_alloc_id_b;
        UPDATE questions_allocated_region SET puzzle_date = v_date_b WHERE id = p_alloc_id_a;
    ELSE
        UPDATE questions_allocated_user SET puzzle_date = '1900-01-01' WHERE id = p_alloc_id_a;
        UPDATE questions_allocated_user SET puzzle_date = v_date_a WHERE id = p_alloc_id_b;
        UPDATE questions_allocated_user SET puzzle_date = v_date_b WHERE id = p_alloc_id_a;
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'swapped', jsonb_build_object(
            'id_a', p_alloc_id_a, 'new_date_a', v_date_b,
            'id_b', p_alloc_id_b, 'new_date_b', v_date_a
        )
    );
END;
$$;


-- ─── 4. RPC: Find Unallocated Date Gaps ─────────────────────

CREATE OR REPLACE FUNCTION public.admin_find_date_gaps(
    p_table TEXT,
    p_filter_value TEXT,
    p_extend_days INT DEFAULT 7
) RETURNS TABLE(gap_date DATE)
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_min DATE;
    v_max DATE;
BEGIN
    IF p_table NOT IN ('region', 'user') THEN
        RAISE EXCEPTION 'Invalid table parameter';
    END IF;

    -- Get current date range
    IF p_table = 'region' THEN
        SELECT MIN(qa.puzzle_date)::DATE, MAX(qa.puzzle_date)::DATE
        INTO v_min, v_max
        FROM questions_allocated_region qa
        WHERE qa.region = p_filter_value;
    ELSE
        SELECT MIN(qa.puzzle_date)::DATE, MAX(qa.puzzle_date)::DATE
        INTO v_min, v_max
        FROM questions_allocated_user qa
        WHERE qa.user_id = p_filter_value::UUID;
    END IF;

    IF v_min IS NULL THEN RETURN; END IF;

    -- Generate continuous date series and exclude already-allocated dates
    IF p_table = 'region' THEN
        RETURN QUERY
        SELECT d::DATE AS gap_date
        FROM generate_series(
            v_min - p_extend_days,
            v_max + p_extend_days,
            '1 day'::INTERVAL
        ) d
        WHERE NOT EXISTS (
            SELECT 1 FROM questions_allocated_region qa
            WHERE qa.region = p_filter_value
            AND qa.puzzle_date = d::DATE
        )
        ORDER BY d;
    ELSE
        RETURN QUERY
        SELECT d::DATE AS gap_date
        FROM generate_series(
            v_min - p_extend_days,
            v_max + p_extend_days,
            '1 day'::INTERVAL
        ) d
        WHERE NOT EXISTS (
            SELECT 1 FROM questions_allocated_user qa
            WHERE qa.user_id = p_filter_value::UUID
            AND qa.puzzle_date = d::DATE
        )
        ORDER BY d;
    END IF;
END;
$$;


-- ─── 5. RPC: Allocation Stats (pre-joined with game data) ───

CREATE OR REPLACE FUNCTION public.admin_allocation_stats(
    p_table TEXT,
    p_filter_value TEXT,
    p_limit INT DEFAULT 100,
    p_offset INT DEFAULT 0
) RETURNS TABLE(
    alloc_id BIGINT,
    puzzle_date DATE,
    question_id BIGINT,
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
            qa.question_id::BIGINT,
            qa.category_id::INT,
            c.name AS category_name,
            qm.event_title,
            qm.event_description,
            qm.answer_date_canonical AS answer_date,
            qm.question_kind,
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
            qa.question_id::BIGINT,
            qa.category_id::INT,
            c.name AS category_name,
            qm.event_title,
            qm.event_description,
            qm.answer_date_canonical AS answer_date,
            qm.question_kind,
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
