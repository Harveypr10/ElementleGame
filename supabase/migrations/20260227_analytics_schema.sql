-- ═══════════════════════════════════════════════════════════════
-- Analytics Dashboard: Schema Updates
-- Adds guest_id, ad_watched columns + anonymous RLS policies
-- Run in Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════════

-- ─── 1. Add guest_id to game_attempts_region ─────────────────

ALTER TABLE public.game_attempts_region
    ADD COLUMN IF NOT EXISTS guest_id TEXT;

-- Index for fast guest aggregation
CREATE INDEX IF NOT EXISTS idx_gar_guest_id
    ON public.game_attempts_region(guest_id)
    WHERE guest_id IS NOT NULL;

-- Constraint: new rows must have at least one identifier.
-- Legacy rows (user_id=NULL, guest_id=NULL) are allowed via NOT VALID.
ALTER TABLE public.game_attempts_region
    ADD CONSTRAINT chk_user_or_guest
    CHECK (
        user_id IS NOT NULL
        OR guest_id IS NOT NULL
    )
    NOT VALID;


-- ─── 2. Add ad_watched to both attempt tables ───────────────

ALTER TABLE public.game_attempts_region
    ADD COLUMN IF NOT EXISTS ad_watched BOOLEAN DEFAULT FALSE;

ALTER TABLE public.game_attempts_user
    ADD COLUMN IF NOT EXISTS ad_watched BOOLEAN DEFAULT FALSE;


-- ─── 3. Anonymous RLS: Guest game inserts ────────────────────

-- Allow anonymous (unauthenticated) users to INSERT game attempts
-- only when guest_id is present and user_id is null.
CREATE POLICY "Anon can insert guest game_attempts_region"
    ON public.game_attempts_region FOR INSERT
    TO anon
    WITH CHECK (
        user_id IS NULL
        AND guest_id IS NOT NULL
    );

-- Allow anonymous users to INSERT guesses for guest game attempts.
-- Validates that the referenced game_attempt belongs to a guest.
CREATE POLICY "Anon can insert guest guesses_region"
    ON public.guesses_region FOR INSERT
    TO anon
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.game_attempts_region ga
            WHERE ga.id = game_attempt_id
            AND ga.guest_id IS NOT NULL
            AND ga.user_id IS NULL
        )
    );


-- ─── 4. Analytics support indexes ───────────────────────────

-- Speed up time-range queries on game attempts
CREATE INDEX IF NOT EXISTS idx_gar_started_at
    ON public.game_attempts_region(started_at);

CREATE INDEX IF NOT EXISTS idx_gau_started_at
    ON public.game_attempts_user(started_at);

-- Speed up time-range queries on subscriptions
CREATE INDEX IF NOT EXISTS idx_usub_created_at
    ON public.user_subscriptions(created_at);

-- Speed up time-range queries on user profiles (signups)
CREATE INDEX IF NOT EXISTS idx_uprof_created_at
    ON public.user_profiles(created_at);
