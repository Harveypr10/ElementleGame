-- ============================================================================
-- PHASE 6 PART 1: Push Notification Infrastructure
--
-- 1. Add expo_push_token column to user_profiles
-- 2. Schedule cron job to trigger award notification Edge Function
--
-- Run in Supabase SQL Editor.
-- ============================================================================


-- ─── 1. ALTER user_profiles ─────────────────────────────────────────────────
-- Stores the Expo Push Token for each user, used to send remote push
-- notifications via the Expo Push API.

ALTER TABLE public.user_profiles
    ADD COLUMN IF NOT EXISTS expo_push_token text;

COMMENT ON COLUMN public.user_profiles.expo_push_token
    IS 'Expo Push Token for remote notifications — set by the mobile app on login/startup';


-- ─── 2. pg_cron: Trigger award notifications at 12:05 UTC on the 1st ───────
-- Fires 4 minutes after grant_period_awards (12:01) to ensure all awards
-- are committed before we query them.
-- Uses pg_net (net schema) to call the Supabase Edge Function.

SELECT cron.schedule(
    'send-award-notifications',
    '5 12 1 * *',
    $$
    SELECT net.http_post(
        url := '<INSERT_SUPABASE_URL>/functions/v1/send-award-notifications',
        headers := jsonb_build_object(
            'Authorization', 'Bearer <INSERT_SERVICE_ROLE_KEY>',
            'Content-Type', 'application/json'
        ),
        body := '{}'::jsonb
    )
    $$
);
