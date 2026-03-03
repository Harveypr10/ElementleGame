-- ============================================================================
-- LEAGUE SYSTEM — Part 2a: Helper Functions (generate_display_tag, generate_join_code)
-- Run this AFTER Part 1 (tables)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.generate_display_tag(p_display_name text)
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
    v_max_num integer;
    v_new_tag text;
BEGIN
    SELECT COALESCE(
        MAX(CAST(SUBSTRING(display_tag FROM 2) AS integer)),
        0
    )
    INTO v_max_num
    FROM public.league_members
    WHERE LOWER(display_name) = LOWER(p_display_name);

    v_new_tag := '#' || LPAD((v_max_num + 1)::text, 4, '0');
    RETURN v_new_tag;
END;
$$;

CREATE OR REPLACE FUNCTION public.generate_join_code()
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
    v_code text;
    v_exists boolean;
    v_chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
BEGIN
    LOOP
        v_code := '';
        FOR i IN 1..8 LOOP
            v_code := v_code || SUBSTR(v_chars, FLOOR(RANDOM() * LENGTH(v_chars) + 1)::int, 1);
        END LOOP;

        SELECT EXISTS(SELECT 1 FROM public.leagues WHERE join_code = v_code)
        INTO v_exists;

        IF NOT v_exists THEN
            RETURN v_code;
        END IF;
    END LOOP;
END;
$$;
