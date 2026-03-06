-- ============================================================================
-- Add notification/prompt flag columns to user_settings
-- These were previously stored only in local AsyncStorage.
-- Moving to Supabase enables cross-device persistence.
-- ============================================================================

ALTER TABLE public.user_settings
  ADD COLUMN IF NOT EXISTS reminder_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS reminder_time text NOT NULL DEFAULT '09:00',
  ADD COLUMN IF NOT EXISTS streak_reminder_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS streak_reminder_time text NOT NULL DEFAULT '09:00',
  ADD COLUMN IF NOT EXISTS prompted_streak2 boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS prompted_streak7 boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS never_ask_reminder boolean NOT NULL DEFAULT false;
