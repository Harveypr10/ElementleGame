# API Documentation

## Supabase Backend API

### Authentication

#### Sign Up
```typescript
const { data, error } = await supabase.auth.signUp({
  email: string,
  password: string,
});
```

#### Sign In
```typescript
const { data, error } = await supabase.auth.signInWithPassword({
  email: string,
  password: string,
});
```

#### Sign Out
```typescript
const { error } = await supabase.auth.signOut();
```

#### Reset Password
```typescript
const { error } = await supabase.auth.resetPasswordForEmail(email, {
  redirectTo: 'elementle://reset-password',
});
```

### Database Tables

#### `user_profiles`
Stores user profile information.

**Columns:**
- `id` (uuid, primary key)
- `email` (text)
- `full_name` (text, nullable)
- `region` (text, default: 'UK')
- `categories` (text[], nullable) - User mode categories
- `created_at` (timestamp)
- `updated_at` (timestamp)

**Queries:**
```typescript
// Get user profile
const { data, error } = await supabase
  .from('user_profiles')
  .select('*')
  .eq('id', userId)
  .single();

// Update profile
const { error } = await supabase
  .from('user_profiles')
  .update({ full_name: 'John Doe' })
  .eq('id', userId);
```

#### `game_attempts_region`
Stores game attempts for REGION mode.

**Columns:**
- `id` (uuid, primary key)
- `user_id` (uuid, foreign key)
- `puzzle_id` (integer, foreign key)
- `puzzle_date` (date)
- `guesses` (integer)
- `won` (boolean)
- `guess_history` (jsonb)
- `created_at` (timestamp)

**Queries:**
```typescript
// Save game attempt
const { error } = await supabase
  .from('game_attempts_region')
  .insert({
    user_id: userId,
    puzzle_id: puzzleId,
    puzzle_date: date,
    guesses: guessCount,
    won: isWin,
    guess_history: guesses,
  });

// Get user's games
const { data, error } = await supabase
  .from('game_attempts_region')
  .select('*')
  .eq('user_id', userId)
  .order('puzzle_date', { ascending: false });
```

#### `game_attempts_user`
Same structure as `game_attempts_region`, but for USER mode.

#### `questions_allocated_region`
Stores puzzle data for REGION mode.

**Columns:**
- `id` (integer, primary key)
- `external_id` (integer)
- `allocated_date` (date)
- `question_data` (jsonb) - Contains event details
- `created_at` (timestamp)

**Queries:**
```typescript
// Get today's puzzle
const { data, error } = await supabase
  .from('questions_allocated_region')
  .select('*')
  .eq('allocated_date', today)
  .single();

// Get puzzle by ID
const { data, error } = await supabase
  .from('questions_allocated_region')
  .select('*')
  .eq('id', puzzleId)
  .single();
```

#### `questions_allocated_user`
Same structure as `questions_allocated_region`, but for USER mode.

#### `user_subscriptions`
Stores subscription information.

**Columns:**
- `id` (uuid, primary key)
- `user_id` (uuid, foreign key)
- `tier` (text) - 'free', 'pro', etc.
- `status` (text) - 'active', 'canceled', 'expired'
- `start_date` (timestamp)
- `end_date` (timestamp, nullable)
- `created_at` (timestamp)

**Queries:**
```typescript
// Get user subscription
const { data, error } = await supabase
  .from('user_subscriptions')
  .select('*')
  .eq('user_id', userId)
  .single();
```

### RPC Functions

#### `get_current_streak`
Calculates user's current streak.

```typescript
const { data, error } = await supabase.rpc('get_current_streak', {
  p_user_id: userId,
  p_mode: 'REGION', // or 'USER'
});
```

#### `get_max_streak`
Calculates user's maximum streak.

```typescript
const { data, error } = await supabase.rpc('get_max_streak', {
  p_user_id: userId,
  p_mode: 'REGION',
});
```

### Realtime Subscriptions

```typescript
// Subscribe to profile changes
const subscription = supabase
  .channel('profile-changes')
  .on(
    'postgres_changes',
    {
      event: 'UPDATE',
      schema: 'public',
      table: 'user_profiles',
      filter: `id=eq.${userId}`,
    },
    (payload) => {
      console.log('Profile updated:', payload);
    }
  )
  .subscribe();

// Cleanup
subscription.unsubscribe();
```

## Local API Utilities

### Sound Manager
```typescript
import soundManager from './lib/soundManager';

// Initialize (call once at app start)
await soundManager.initialize();

// Play sound
soundManager.play('tap');
soundManager.play('game_win');
soundManager.play('game_lose');

// Available sounds: tap, game_win, game_lose, streak, badge, error, success
```

### Haptics Manager
```typescript
import hapticsManager from './lib/hapticsManager';

// Light tap
hapticsManager.light();

// Medium tap
hapticsManager.medium();

// Heavy tap
hapticsManager.heavy();

// Success feedback
hapticsManager.success();

// Warning feedback
hapticsManager.warning();

// Error feedback
hapticsManager.error();
```

### Share Functionality
```typescript
import { shareGameResult } from './lib/share';

const result = await shareGameResult({
  date: '2024-01-20',
  guesses: 3,
  result: 'won',
  mode: 'REGION',
  eventTitle: 'Example Event',
});

if (result.success) {
  console.log('Shared successfully');
}
```

### Platform Utilities
```typescript
import { 
  requestReview, 
  setupDeepLinking, 
  parseDeepLink 
} from './lib/platform';

// Request app review
await requestReview();

// Setup deep linking
const cleanup = setupDeepLinking((url) => {
  const parsed = parseDeepLink(url);
  // Handle deep link
});

// Cleanup on unmount
cleanup();
```

## Error Handling

All API calls should handle errors appropriately:

```typescript
const { data, error } = await supabase
  .from('user_profiles')
  .select('*')
  .eq('id', userId)
  .single();

if (error) {
  console.error('Error fetching profile:', error);
  // Show user-friendly error message
  return;
}

// Use data
console.log('Profile:', data);
```

## Rate Limiting

Supabase has rate limits. Best practices:
- Cache frequently accessed data
- Use React Query for automatic caching
- Batch requests when possible
- Implement request deduplication

## Security

- Never expose `SUPABASE_SERVICE_ROLE_KEY` in client code
- Use Row Level Security (RLS) policies on all tables
- Validate user input before database operations
- Use parameterized queries to prevent SQL injection
