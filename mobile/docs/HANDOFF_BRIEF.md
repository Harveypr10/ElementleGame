# Session Handoff Brief - Mobile App RevenueCat Integration

## 📋 Executive Summary

This session successfully implemented a **complete multi-provider subscription system** for the Elementle mobile app, supporting both RevenueCat (iOS in-app purchases) and Stripe (web payments). The core RevenueCat flow is **fully functional** and tested in sandbox.

---

## ✅ Completed Infrastructure

### Database Schema Changes

#### 1. user_tier Table Updates
- **Added**: `revenuecat_product_id` column (text, nullable)
- **Populated**: Product IDs for both UK and US regions
  - Example: `com.dobl.elementlegame.pro_monthly`, `com.dobl.elementlegame.pro_annual`
- **Purpose**: Enable exact matching of RevenueCat products to tier UUIDs

#### 2. user_subscriptions Table Updates
- **Added**: `revenuecat_subscriber_id` (text, nullable)
- **Added**: `revenuecat_product_id` (text, nullable)
- **Added**: `amount_paid` (numeric, nullable)
- **Existing**: `stripe_subscription_id`, `stripe_customer_id`, `stripe_price_id`
- **Constraint**: PostgreSQL EXCLUDE constraint on `(user_id, validity)` prevents overlapping subscriptions

#### 3. Provider Isolation Pattern
- RevenueCat subscriptions: Populate `revenuecat_*` columns, set `stripe_*` to NULL
- Stripe subscriptions: Populate `stripe_*` columns, set `revenuecat_*` to NULL
- **Database Logic**: Extend-or-insert (query for active subscription → UPDATE if exists, INSERT if not)
- **Avoids**: Constraint violations from overlapping date ranges

---

### Edge Functions (Supabase)

#### 1. sync-revenuecat-subscription ✅
**Location**: `supabase/functions/sync-revenuecat-subscription/index.ts`
**Purpose**: Server-side verification of RevenueCat entitlements
**Deployed**: Yes

**Flow**:
1. Get authenticated user from Supabase session
2. Call RevenueCat REST API to verify entitlement
3. Parse `subscriber.entitlements['pro']` (NOT `.active['pro']`)
4. Validate `expires_date` is in future
5. Get user's region from `user_profiles`
6. Query `user_tier` WHERE `revenuecat_product_id = ?` AND `region = ?`
7. **Extend-or-insert** to `user_subscriptions`:
   - Query for existing active subscription
   - UPDATE if found (renewal/extension)
   - INSERT if not found (new subscription)
8. Update `user_profiles` with `user_tier_id` and `subscription_end_date`
9. Populate `amount_paid` from `user_tier.subscription_cost`

**Key Fixes**:
- ✅ Exact product ID matching (no more tier_type guessing)
- ✅ Multi-region support (UK/US)
- ✅ Extend-or-insert pattern (no constraint violations)
- ✅ Retry logic on client-side (2-second delay for sandbox receipt processing)

---

#### 2. handle-revenuecat-webhook ✅
**Location**: `supabase/functions/handle-revenuecat-webhook/index.ts`
**Purpose**: Process RevenueCat webhook events
**Deployed**: Yes

**Events Handled**:
- **INITIAL_PURCHASE / RENEWAL**: Activate subscription (extend-or-insert)
- **CANCELLATION**: Set `auto_renew = false`, keep status `active` (user retains access until expiration)
- **EXPIRATION**: Downgrade to Standard tier, set status `expired`
- **BILLING_ISSUE**: Set status `past_due`

**Key Features**:
- Flexible payload parsing (handles nested event structures)
- Proper CANCELLATION vs EXPIRATION split
- Extend-or-insert database logic
- Region-aware tier lookups

---

#### 3. create-stripe-checkout ✅
**Location**: `supabase/functions/create-stripe-checkout/index.ts`
**Purpose**: Replace Express `/api/subscription/create-checkout`
**Deployed**: Yes

**Flow**:
1. Validate `tier_id` and get `stripe_price_id`
2. Create/retrieve Stripe customer
3. Mark old pending subscriptions as `unpaid`
4. Insert new pending subscription
5. Create Stripe Checkout Session with metadata
6. Return checkout URL

---

#### 4. handle-stripe-webhook ✅
**Location**: `supabase/functions/handle-stripe-webhook/index.ts`
**Purpose**: Process Stripe webhook events
**Deployed**: Yes

**Events Handled**:
- `checkout.session.completed`: Activate subscription
- `invoice.payment_succeeded`: Process renewal
- `customer.subscription.deleted`: Downgrade to Standard
- `customer.subscription.updated`: Update auto-renew status

---

## 🎯 Current State: Pro Subscription Flow (WORKING)

### Mobile App (RevenueCat)

**Working Files**:
- `mobile/lib/RevenueCat.js` - Complete SDK integration
- `mobile/components/Paywall.tsx` - Subscription purchase UI
- `mobile/lib/auth.tsx` - Identity linking on login/logout
- `mobile/hooks/useSubscription.ts` - Real-time subscription status

**User Flow**:
```
1. User logs in → RevenueCat identity linked (Purchases.logIn)
2. User opens Paywall → Offerings loaded
3. User selects plan → Purchase via Apple
4. Purchase succeeds → syncSubscriptionToDatabase() called
   ↓ (with 2-second retry for sandbox)
5. Edge Function verifies entitlement server-side
6. Database updated (user_subscriptions + user_profiles)
7. useSubscription hook refreshed
8. isPro = true, ads disappear
```

**Key Fixes Applied**:
- ✅ Identity linking: `logInRevenueCat(userId)` on SIGNED_IN
- ✅ Anonymous logout handling (no more errors)
- ✅ Retry logic for sandbox receipt processing
- ✅ Query cache invalidation on purchase
- ✅ Proper entitlement parsing

---

## 🚧 Next Task: Question Generation Orchestration

### Context
The **legacy web app** used the frontend to orchestrate the question generation workflow after category selection. The mobile app was stopping after saving categories and calling `reset-and-reallocate-user`. We need to replicate the full web app experience.

### What We Completed
✅ Navigation flow: `category-selection.tsx` → `generating-questions.tsx`
✅ Passing params (userId, postcode, region, categoryIds)
✅ `generating-questions.tsx` already has ALL backend logic implemented

### Complete Workflow (Now Implemented)

**File**: `mobile/app/(auth)/category-selection.tsx`
**File**: `mobile/app/(auth)/generating-questions.tsx`

```
User Flow:
1. User selects 3+ categories in category-selection.tsx
2. Taps "Generate" button
   ↓
3. Categories saved to user_category_preferences
4. reset-and-reallocate-user Edge Function called
5. User profile fetched (postcode, region)
   ↓
6. Navigate to generating-questions.tsx with params
   ↓
7. Animation starts (10 seconds)
8. **Parallel Backend Processing**:
   - populate_user_locations RPC
   - calculate-demand Edge Function
   - allocate-questions (internal, writes to questions_allocated_user)
   ↓
9. Poll questions_allocated_user (max 10 seconds)
10. Animation completes
11. Navigate to homepage
12. React Query cache invalidated
13. New questions appear!
```

### Backend Workflows (Already in generating-questions.tsx)

**Step 1: Fetch Event Titles** (for animation)
- Currently uses mock data
- TODO: Replace with real Supabase query when category filtering added

**Step 2: Populate Locations** (if postcode exists)
```typescript
await supabase.rpc('populate_user_locations', {
    p_user_id: userId,
    p_postcode: postcode
});
```

**Step 3: Calculate Demand**
```typescript
await supabase.functions.invoke('calculate-demand', {
    body: { user_id: userId }
});
```
- Internally calls `allocate-questions`
- Inserts into `questions_allocated_user`

**Step 4: Poll for Completion**
- Polls `questions_allocated_user` table
- Max 10 attempts (1 second intervals)

**Step 5: Navigate & Invalidate**
- Wait for animation completion
- Navigate to homepage
- React Query auto-invalidates

### Status
✅ **COMPLETE** - Navigation wired up, all backend logic present
🧪 **TESTING NEEDED** - End-to-end flow needs validation

---

## 📁 Documentation Location

All documentation has been saved to:
```
/Users/paulharvey/ElementleGame/mobile/docs/
```

**Files**:
1. `HANDOFF_BRIEF.md` - This document
2. `SUBSCRIPTION_ROADMAP.md` - Updated roadmap
3. `CURRENT_TASKS.md` - Task breakdown

---

## 🔑 Critical Configuration

### Supabase Secrets (Required)
```bash
# RevenueCat
REVENUECAT_SECRET_KEY=<your_key>
REVENUECAT_WEBHOOK_SECRET=<your_secret>

# Stripe
STRIPE_SECRET_KEY=<your_key>
STRIPE_WEBHOOK_SECRET=<your_secret>
```

### RevenueCat Configuration
- **Dashboard**: Products linked to `pro` entitlement
- **Webhook**: Configured to `https://chhtmbrsxmdwwgrgsczd.supabase.co/functions/v1/handle-revenuecat-webhook`
- **Events**: INITIAL_PURCHASE, RENEWAL, CANCELLATION, EXPIRATION, PRODUCT_CHANGE, BILLING_ISSUE

### Stripe Configuration
- **Webhook**: `https://chhtmbrsxmdwwgrgsczd.supabase.co/functions/v1/handle-stripe-webhook`
- **Events**: checkout.session.completed, invoice.payment_succeeded, customer.subscription.deleted, customer.subscription.updated

---

## 🐛 Known Issues & Fixes

### Fixed This Session
✅ RevenueCat anonymous logout error (graceful handling)
✅ category-selection.tsx routing (moved to `app/(auth)/`)
✅ Identity mismatch (logIn/logOut implemented)
✅ Entitlement parsing (using `entitlements['pro']`)
✅ Database constraints (extend-or-insert pattern)
✅ Sandbox receipt processing (retry logic)

### Outstanding
- None for RevenueCat flow (fully working)
- Question generation needs end-to-end testing

---

## 📊 Testing Status

**RevenueCat (Mobile)**:
- ✅ Purchase flow tested in sandbox
- ✅ Database sync verified
- ✅ Pro status updates correctly
- ✅ Ads disappear for Pro users
- ✅ Restore purchases works

**Question Generation**:
- ⏳ Pending full end-to-end test
- ✅ Navigation works
- ✅ Backend logic present

---

## 🚀 Immediate Next Steps for New Session

1. **Test question generation workflow end-to-end**
   - Select categories
   - Verify generation screen shows
   - Confirm backend processing completes
   - Check new questions allocated

2. **Production readiness**
   - Switch to production RevenueCat API keys
   - Configure production webhooks
   - Test with real Apple purchases

3. **Web app migration** (if needed)
   - Update web app to use Stripe Edge Functions
   - Decommission Express server
   - Test Stripe checkout flow

---

## 📞 Context for AI Assistant

**Project**: Elementle mobile app (React Native/Expo)
**Database**: Supabase (PostgreSQL)
**Payments**: RevenueCat (iOS), Stripe (Web)
**State**: RevenueCat flow fully functional, question generation implemented

**Key Patterns**:
- Multi-provider isolation (RevenueCat vs Stripe columns)
- Extend-or-insert (avoid constraint violations)
- Server-side verification (Edge Functions)
- Identity linking (Supabase user ↔ RevenueCat user)

**Architecture**:
- Edge Functions handle all payment logic
- Mobile app calls Edge Functions
- Database enforces data integrity
- React Query manages cache

---

## 📖 Reference Documents

See `/Users/paulharvey/ElementleGame/mobile/docs/` for:
- Complete roadmap
- Task breakdown
- Implementation details
- Testing guides

**Artifact History** (in brain folder):
- 30+ implementation artifacts created
- Full change log available
- All Edge Function code documented
