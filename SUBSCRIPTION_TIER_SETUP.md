# Subscription Tier System Setup

This document explains how to set up the new dynamic subscription tier system in Supabase.

## Overview

The new subscription system replaces the hardcoded tier definitions with a database-driven approach:
- **`user_tier`** table: Defines available subscription tiers per region with pricing
- **`user_subscriptions`** table: Tracks user subscription history
- **`user_active_tier_view`** view: Resolves the active tier for each user

## Backward Compatibility

The system includes graceful fallback to the legacy `user_profiles.tier` column:
- If the new tables don't exist, the app continues to work with the old system
- Legacy tiers are shown in the Pro dialog until the new tables are created
- Once tables exist, the app automatically uses the new tier system

## Database Setup

### 1. Create the `user_tier` Table

```sql
CREATE TABLE IF NOT EXISTS user_tier (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  region VARCHAR(10) NOT NULL,
  tier VARCHAR(50) NOT NULL,
  subscription_cost INTEGER,
  currency VARCHAR(3),
  subscription_duration_months INTEGER,
  streak_savers INTEGER DEFAULT 0,
  holiday_savers INTEGER DEFAULT 0,
  holiday_duration_days INTEGER DEFAULT 0,
  description TEXT,
  sort_order INTEGER DEFAULT 0,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_user_tier_region ON user_tier(region);
CREATE INDEX idx_user_tier_active ON user_tier(active);
```

### 2. Create the `user_subscriptions` Table

```sql
CREATE TABLE IF NOT EXISTS user_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_tier_id UUID NOT NULL REFERENCES user_tier(id),
  amount_paid INTEGER,
  currency VARCHAR(3),
  expires_at TIMESTAMPTZ,
  auto_renew BOOLEAN DEFAULT false,
  source VARCHAR(50) DEFAULT 'web',
  validity VARCHAR(20) DEFAULT 'active',
  effective_start_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_user_subscriptions_user_id ON user_subscriptions(user_id);
CREATE INDEX idx_user_subscriptions_validity ON user_subscriptions(validity);
```

### 3. Create the `user_active_tier_view` View

This view resolves the active tier for each user, falling back to 'standard' if no active subscription:

```sql
CREATE OR REPLACE VIEW user_active_tier_view AS
SELECT 
  u.id AS user_id,
  COALESCE(ut.id, st.id) AS tier_id,
  COALESCE(ut.tier, 'standard') AS tier,
  COALESCE(ut.region, 'UK') AS region,
  ut.subscription_cost,
  ut.currency,
  ut.subscription_duration_months,
  COALESCE(ut.streak_savers, 0) AS streak_savers,
  COALESCE(ut.holiday_savers, 0) AS holiday_savers,
  COALESCE(ut.holiday_duration_days, 0) AS holiday_duration_days,
  ut.description,
  us.expires_at,
  us.auto_renew,
  CASE WHEN us.id IS NOT NULL AND us.validity = 'active' AND (us.expires_at IS NULL OR us.expires_at > NOW()) THEN true ELSE false END AS is_active
FROM auth.users u
LEFT JOIN user_subscriptions us ON us.user_id = u.id 
  AND us.validity = 'active' 
  AND (us.expires_at IS NULL OR us.expires_at > NOW())
LEFT JOIN user_tier ut ON ut.id = us.user_tier_id
LEFT JOIN user_tier st ON st.tier = 'standard' AND st.region = 'UK';
```

### 4. Insert Standard Tier Definitions

Insert the default UK tiers (modify pricing/currency for other regions):

```sql
INSERT INTO user_tier (region, tier, subscription_cost, currency, subscription_duration_months, streak_savers, holiday_savers, holiday_duration_days, description, sort_order) VALUES
  ('UK', 'standard', NULL, NULL, NULL, 0, 0, 0, 'Free tier with ads', 0),
  ('UK', 'pro_monthly', 79, 'GBP', 1, 1, 0, 0, 'Auto-renews monthly', 1),
  ('UK', 'pro_annual', 699, 'GBP', 12, 3, 1, 7, 'Auto-renews annually', 2),
  ('UK', 'pro_lifetime', 1199, 'GBP', NULL, 999, 999, 365, 'One off - Best value', 3);
```

### 5. Add Column to user_profiles (if not exists)

Add the `user_tier_id` column to track the current tier FK:

```sql
ALTER TABLE user_profiles 
ADD COLUMN IF NOT EXISTS user_tier_id UUID REFERENCES user_tier(id);
```

### 6. Create Sync Trigger (Optional)

Create a trigger to sync `user_profiles.tier` when subscriptions change:

```sql
CREATE OR REPLACE FUNCTION sync_user_tier_on_subscription() 
RETURNS TRIGGER AS $$
BEGIN
  UPDATE user_profiles 
  SET 
    tier = (SELECT tier FROM user_tier WHERE id = NEW.user_tier_id),
    user_tier_id = NEW.user_tier_id,
    updated_at = NOW()
  WHERE id = NEW.user_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_sync_user_tier
AFTER INSERT OR UPDATE ON user_subscriptions
FOR EACH ROW
EXECUTE FUNCTION sync_user_tier_on_subscription();
```

## Multi-Region Pricing

To support different pricing per region, insert additional rows:

```sql
INSERT INTO user_tier (region, tier, subscription_cost, currency, subscription_duration_months, description, sort_order) VALUES
  ('US', 'standard', NULL, NULL, NULL, 'Free tier with ads', 0),
  ('US', 'pro_monthly', 99, 'USD', 1, 'Auto-renews monthly', 1),
  ('US', 'pro_annual', 899, 'USD', 12, 'Auto-renews annually', 2),
  ('US', 'pro_lifetime', 1499, 'USD', NULL, 'One off - Best value', 3);
```

## API Endpoints

The following API endpoints are updated:

- **GET `/api/subscription`**: Returns user's active tier from `user_active_tier_view`
- **GET `/api/tiers`**: Returns available purchasable tiers for user's region
- **POST `/api/subscription/create-checkout`**: Creates subscription with `tierId` (UUID)

## Frontend Components

- **`useSubscription`** hook: Now includes `tierName`, `metadata` (streakSavers, holidaySavers, etc.)
- **`ProSubscriptionDialog`**: Fetches tiers dynamically from `/api/tiers`
