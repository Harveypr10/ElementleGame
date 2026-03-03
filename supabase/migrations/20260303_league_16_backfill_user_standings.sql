-- ============================================================================
-- BACKFILL: Populate league_standings_live for game_mode = 'user'
--
-- The dual-mode schema added game_mode support, but the live standings were
-- never backfilled for user-mode games. This script force-refreshes every
-- league member's user-mode standings using the existing rating functions.
--
-- refresh_user_league_standings handles ALL leagues for a given user internally,
-- so we only need to call it once per distinct user.
-- ============================================================================

DO $$
DECLARE
    v_user_id uuid;
    v_count int := 0;
BEGIN
    RAISE NOTICE 'Starting user-mode standings backfill...';

    -- Loop through every distinct user who is active in at least one user-board league
    FOR v_user_id IN
        SELECT DISTINCT lm.user_id
        FROM public.league_members lm
        JOIN public.leagues lg ON lg.id = lm.league_id
        WHERE lm.is_active_user = true
          AND lg.has_user_board = true
    LOOP
        -- Force-refresh user-mode standings for this user across all their leagues
        -- refresh_user_league_standings uses ON CONFLICT DO UPDATE, so it will
        -- overwrite any zero-value rows from the initial hydration
        PERFORM public.refresh_user_league_standings(
            v_user_id,
            'GLOBAL',  -- region param is unused for user mode, but required
            'user'     -- game_mode
        );

        v_count := v_count + 1;
    END LOOP;

    RAISE NOTICE 'Backfill complete. Refreshed standings for % users.', v_count;
END;
$$;
