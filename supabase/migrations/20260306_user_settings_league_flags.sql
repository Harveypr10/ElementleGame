-- Add league display flags to user_settings for cross-device persistence
ALTER TABLE user_settings
  ADD COLUMN IF NOT EXISTS league_tables_enabled BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS league_auto_unlock_done BOOLEAN DEFAULT false;
