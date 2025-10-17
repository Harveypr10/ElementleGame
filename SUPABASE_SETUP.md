# Supabase Setup Instructions

## Prerequisites
- Supabase project created at [supabase.com](https://supabase.com)
- Environment variables set in Replit Secrets:
  - `SUPABASE_URL`
  - `SUPABASE_ANON_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY`

## Database Schema Setup

### 1. Enable UUID Extension
Run this in your Supabase SQL Editor:
```sql
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
```

### 2. Create Tables
The following tables will be created automatically via Drizzle push:

- **user_profiles** - Extends Supabase Auth users
- **puzzles** - Historical date puzzles
- **user_settings** - User preferences
- **game_attempts** - Game session tracking
- **guesses** - Individual guess records (governance)
- **user_stats** - Aggregated user statistics

### 3. Push Schema to Supabase

Run from your project root:
```bash
npm run db:push
```

If you encounter conflicts, use:
```bash
npm run db:push --force
```

### 4. Seed Puzzle Data

Run the seed script:
```bash
tsx server/supabase-seed.ts
```

This will populate the `puzzles` table with 31 October 2025 historical events.

## Row Level Security (RLS)

### Enable RLS on all tables:
```sql
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE guesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_stats ENABLE ROW LEVEL SECURITY;
```

### Create RLS Policies:

**user_profiles:**
```sql
-- Users can read their own profile
CREATE POLICY "Users can view own profile"
  ON user_profiles FOR SELECT
  USING (auth.uid() = id);

-- Users can update their own profile
CREATE POLICY "Users can update own profile"
  ON user_profiles FOR UPDATE
  USING (auth.uid() = id);

-- Service role can insert profiles (for signup)
CREATE POLICY "Service role can insert profiles"
  ON user_profiles FOR INSERT
  WITH CHECK (true);
```

**user_settings:**
```sql
CREATE POLICY "Users can manage own settings"
  ON user_settings FOR ALL
  USING (auth.uid() = user_id);
```

**game_attempts:**
```sql
-- Users can view their own attempts
CREATE POLICY "Users can view own attempts"
  ON game_attempts FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own attempts
CREATE POLICY "Users can insert own attempts"
  ON game_attempts FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Admins can view all attempts
CREATE POLICY "Admins can view all attempts"
  ON game_attempts FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND is_admin = true
    )
  );
```

**guesses:**
```sql
-- Users can view their own guesses
CREATE POLICY "Users can view own guesses"
  ON guesses FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM game_attempts
      WHERE game_attempts.id = guesses.game_attempt_id
      AND game_attempts.user_id = auth.uid()
    )
  );

-- Users can insert guesses for their own attempts
CREATE POLICY "Users can insert own guesses"
  ON guesses FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM game_attempts
      WHERE game_attempts.id = guesses.game_attempt_id
      AND game_attempts.user_id = auth.uid()
    )
  );

-- Admins can view all guesses
CREATE POLICY "Admins can view all guesses"
  ON guesses FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND is_admin = true
    )
  );
```

**user_stats:**
```sql
CREATE POLICY "Users can manage own stats"
  ON user_stats FOR ALL
  USING (auth.uid() = user_id);
```

**puzzles (public read):**
```sql
ALTER TABLE puzzles ENABLE ROW LEVEL SECURITY;

-- Everyone can read puzzles
CREATE POLICY "Puzzles are publicly readable"
  ON puzzles FOR SELECT
  TO authenticated, anon
  USING (true);

-- Only admins can modify puzzles
CREATE POLICY "Only admins can modify puzzles"
  ON puzzles FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND is_admin = true
    )
  );
```

## Supabase Auth Configuration

1. In Supabase Dashboard → Authentication → Providers:
   - Enable Email provider
   - Configure email templates (optional)

2. In Supabase Dashboard → Authentication → URL Configuration:
   - Set Site URL to your Replit app URL
   - Add redirect URLs as needed

## Edge Functions

### Deploy global-stats Function

1. Install Supabase CLI:
```bash
npm install -g supabase
```

2. Login to Supabase:
```bash
supabase login
```

3. Link your project:
```bash
supabase link --project-ref your-project-ref
```

4. Deploy the function:
```bash
supabase functions deploy global-stats
```

The Edge Function code is in `supabase/functions/global-stats/index.ts`

## Verification

1. Check that all tables exist in Supabase Dashboard → Table Editor
2. Verify RLS policies are active
3. Test authentication signup/login
4. Run a test game to ensure data persists correctly
