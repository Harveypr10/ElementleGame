-- Final audit: add remaining user settings columns for cross-device persistence
ALTER TABLE user_settings
  ADD COLUMN IF NOT EXISTS streaks_enabled BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS has_seen_how_to_play BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS last_retention_reminder_date TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS winback_shown_for TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS league_order JSONB DEFAULT NULL;
