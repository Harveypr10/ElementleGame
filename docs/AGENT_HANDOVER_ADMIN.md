# Admin CRM & CMS — Architectural Handover

> **Last updated:** 2026-02-27  
> **Audience:** AI agents and developers who will work on this codebase next.

---

## 1. Admin Architecture Overview

The admin system comprises two primary screens, both React Native components using **plain `StyleSheet`** (no NativeWind):

| Screen | File | Purpose |
|--------|------|---------|
| **User CRM** | `mobile/app/(tabs)/settings/admin/users.tsx` | Master-detail user management — stats, subscriptions, badges, games, locations, settings, categories |
| **Question CMS** | `mobile/app/(tabs)/settings/admin/questions.tsx` | 4-tab question management — Master Library, Region Tracks, User Tracks, QA Audit |

### Split-Pane UI Pattern

Both screens use a **responsive split-pane layout**:

```
┌─ isWide (≥768px) ──────────────────────┐
│  ┌──────────┐  ┌──────────────────────┐ │
│  │  Master   │  │  Detail Panel        │ │
│  │  List     │  │  (rendered inline)   │ │
│  │  (0.4)    │  │  (0.6)              │ │
│  └──────────┘  └──────────────────────┘ │
└─────────────────────────────────────────┘

┌─ !isWide (<768px) ─────────────────────┐
│  Master List  ──tap──▶  Detail (full)  │
│  ◀──back btn──  (selectedUserId=null)  │
└─────────────────────────────────────────┘
```

- **Width detection:** `useWindowDimensions().width >= 768` determines layout.
- **Safe Area:** Both screens wrap their root return in `<SafeAreaView edges={['top']}>` from `react-native-safe-area-context` to avoid iOS status bar overlap.
- **Mode toggle:** Both screens have a Region/User mode toggle controlling which database tables are queried (`user_stats_region` vs `user_stats_user`, `game_attempts_region` vs `game_attempts_user`, etc.).

### Hook Architecture

Each screen's data logic is separated into dedicated hooks:

| Hook | File | Responsibility |
|------|------|----------------|
| `useAdminUsers` | `hooks/useAdminUsers.ts` | Paginated user list with filters (region, tier, plan) |
| `useAdminUserDetail` | `hooks/useAdminUserDetail.ts` | All detail data for a selected user (stats, subs, badges, games, locations, settings, categories, tiers) |
| `useAdminMutations` | `hooks/useAdminMutations.ts` | Write operations on user data (edit stats, toggle settings, award badges, assign subscriptions, edit streak days) |
| `useAdminQuestions` | `hooks/useAdminQuestions.ts` | Master library question listing with search, sort, pagination |
| `useAdminAllocations` | `hooks/useAdminAllocations.ts` | Track allocation data (region/user tracks, unallocated questions, status filters) |
| `useAdminQuestionMutations` | `hooks/useAdminQuestionMutations.ts` | Write operations on questions (approve, edit fields, allocate, unallocate, swap dates) |
| `useAdminCases` | `hooks/useAdminCases.ts` | Support case management |
| `useAdminLogic` | `hooks/useAdminLogic.ts` | Shared admin utility logic |

---

## 2. Security & RLS

### The `public.is_admin()` Function

All admin RLS policies use a Postgres helper function:

```sql
public.is_admin()  -- Returns BOOLEAN
```

**How it works:** This function queries `user_profiles.is_admin` for the currently authenticated user (`auth.uid()`). It is defined directly in the Supabase database (not in local migration files).

> [!IMPORTANT]
> **Why a function?** Writing `(SELECT is_admin FROM user_profiles WHERE id = auth.uid())` directly in an RLS policy on `user_profiles` itself would cause **infinite recursion** — the policy would need to evaluate itself to check the row. Wrapping this in a `SECURITY DEFINER` function bypasses the caller's RLS context, breaking the loop.

### RLS Policy Coverage

Admin RLS policies are defined in two migration files:

| Migration File | Tables Covered |
|---|---|
| `20260226_question_admin_setup.sql` | `questions_master_region`, `questions_master_user`, `questions_allocated_region`, `questions_allocated_user` (UPDATE + DELETE) |
| `20260226_admin_update_policies.sql` | `user_stats_user`, `user_stats_region`, `user_subscriptions`, `user_badges`, `user_settings`, `user_profiles`, `game_attempts_user`, `game_attempts_region`, `admin_action_logs` (UPDATE + INSERT) |

All use `USING (public.is_admin())` for UPDATE/DELETE and `WITH CHECK (public.is_admin())` for INSERT.

> [!CAUTION]
> If you add a new admin mutation that writes to a table not listed above, you **must** create an RLS policy for it. Without a policy, Supabase `.update()` calls will **silently succeed with 0 rows affected** — there is no error returned, making this extremely difficult to debug.

---

## 3. Key RPCs & Database Quirks

### 3.1 `admin_assign_subscription`

- **Defined:** Directly in Supabase (not in local migrations)
- **Called from:** `useAdminMutations.ts → assignSubscription()`
- **Uses `SECURITY DEFINER`:** Yes — because it needs to INSERT into `user_subscriptions` and UPDATE `user_profiles`, both of which have RLS enabled.
- **Parameters:** `p_user_id`, `p_user_tier_id`, `p_tier`, `p_billing_period`, `p_expires_at`, `p_auto_renew`
- **Audit logging:** Handled internally by the RPC.

**Quirk — `billing_period` for lifetime tiers:**  
The `user_tier` table stores `billing_period = 'month'` even for lifetime tiers. The client-side code explicitly overrides this:

```typescript
const billingPeriod = tier.tier_type === 'lifetime' ? 'lifetime' : tier.billing_period;
```

### 3.2 `admin_swap_puzzle_dates`

- **Location:** `supabase/migrations/20260226_question_admin_setup.sql`
- **Purpose:** Atomically swap `puzzle_date` between two allocation rows.

**The `1900-01-01` Sentinel Date Workaround:**

The allocated tables have a **unique constraint** on `(region/user_id, puzzle_date)`. A direct swap (`A → B, B → A`) would violate this constraint on the first UPDATE. The solution is a 3-step swap:

```sql
-- Step 1: Move A to a sentinel date that can never conflict
UPDATE ... SET puzzle_date = '1900-01-01' WHERE id = p_alloc_id_a;
-- Step 2: Move B to A's original date (now free)
UPDATE ... SET puzzle_date = v_date_a WHERE id = p_alloc_id_b;
-- Step 3: Move A from sentinel to B's original date
UPDATE ... SET puzzle_date = v_date_b WHERE id = p_alloc_id_a;
```

**Safety checks:** Both allocations must exist, neither can have been played (checked via `game_attempts` JOIN), and dates must differ.

### 3.3 `admin_unallocated_masters`

- **Location:** `supabase/migrations/20260226_unallocated_masters_rpc.sql`
- **Purpose:** Returns master questions that have **not yet been allocated** to a specific region or user.

**The `NOT EXISTS` Pattern:**

```sql
SELECT qm.*
FROM questions_master_region qm
WHERE NOT EXISTS (
    SELECT 1 FROM questions_allocated_region qa
    WHERE qa.question_id = qm.id
    AND qa.region = p_filter_value
)
```

This is a correlated subquery that efficiently excludes already-allocated questions. It uses `SECURITY DEFINER` because the caller may not have SELECT access to the underlying tables.

### 3.4 Other RPCs

| RPC | Location | Purpose |
|-----|----------|---------|
| `admin_allocation_stats` | `20260226_question_admin_setup.sql` | Pre-joined allocation + game attempt data with play count, win count, avg guesses |
| `admin_find_date_gaps` | `20260226_question_admin_setup.sql` | Finds unallocated dates in a given region/user's track using `generate_series` |

### 3.5 `TIMESTAMPTZ` vs `TIMESTAMP` Casting

> [!WARNING]
> Several columns use `TIMESTAMP WITHOUT TIME ZONE` (e.g., `user_subscriptions.created_at`, `user_subscriptions.expires_at`) while others use `TIMESTAMP WITH TIME ZONE` (e.g., `effective_start_at`). The `validity` column is a computed `tstzrange` that casts between these:
>
> ```sql
> validity tstzrange GENERATED ALWAYS AS (
>     tstzrange(effective_start_at, (expires_at AT TIME ZONE 'UTC'), '[)')
> ) STORED
> ```
>
> When writing RPC return types or passing dates from the client, always be explicit about timezone handling. The client sends dates as plain `YYYY-MM-DD` strings (implicitly UTC).

---

## 4. Data Aggregation — Postgres Views

Two views provide pre-joined data for the Master Library UI:

```sql
-- Region master + allocation stats
CREATE OR REPLACE VIEW public.v_questions_master_region_stats AS
SELECT qm.*,
       COALESCE(agg.allocation_count, 0) AS allocation_count,
       agg.earliest_allocation_date
FROM public.questions_master_region qm
LEFT JOIN LATERAL (
    SELECT COUNT(*) AS allocation_count,
           MIN(qa.puzzle_date)::DATE AS earliest_allocation_date
    FROM public.questions_allocated_region qa
    WHERE qa.question_id = qm.id
) agg ON TRUE;

-- Equivalent view exists for user mode:
-- public.v_questions_master_user_stats
```

**Why views?**  
- Avoids N+1 queries in the master library list.
- The `allocation_count` and `earliest_allocation_date` are computed once per row via `LEFT JOIN LATERAL`.
- Views inherit RLS from underlying tables, but explicit `GRANT SELECT` is given to `authenticated` role.

---

## 5. Mutation Safety

### ConfirmModal Pattern

Every admin write operation is gated behind `<ConfirmModal>` (`mobile/components/admin/ConfirmModal.tsx`):

```
User action → setModal({ type: '...', field, label, currentValue })
            → ConfirmModal renders with title, message, optional children (input fields)
            → User clicks Confirm → onConfirm async handler runs
            → Validation → setModalError() if invalid
            → API call → setModalLoading(true/false)
            → closeModal() → refresh data
```

**Features:**
- Displays a `⚠️` title and configurable message
- Shows inline validation errors in a red box
- Includes a permanent footer: *"This action is logged and may not be easily undone."*
- Supports `children` prop for custom input fields (text inputs, pickers)
- `destructive` prop turns confirm button red

### Audit Logging

All mutations write to `admin_action_logs` via the `logAction()` helper in `useAdminMutations.ts`:

```typescript
async function logAction(
    adminId: string,
    targetUserId: string,
    actionType: string,        // e.g. 'edit_stat', 'toggle_setting', 'award_badge'
    description: string,       // Human-readable summary
    previousState?: any,       // JSON snapshot of old value
    newState?: any,            // JSON snapshot of new value
)
```

The `admin_assign_subscription` RPC handles its own audit logging internally.

> [!NOTE]
> Mutations that use direct `supabase.from().update()` calls (e.g., `editSubExpiry`, `deactivateSub`, `editBadgeCount`) currently do **not** write to `admin_action_logs`. Consider adding `logAction()` calls to these handlers for complete audit coverage.

---

## 6. Key Data Model Notes

### `user_subscriptions` CHECK Constraints

```
status  IN ('active', 'canceled', 'trialing', 'past_due', 'unpaid', 'pending')
tier    IN ('school', 'trial', 'pro')
```

- Note: **American spelling** `'canceled'` (one L), not British `'cancelled'`.
- There is no `'expired'` or `'standard'` status — deactivation uses `'canceled'`.

### Subscription Deactivation Flow

When deactivating a subscription via the admin CRM:

1. Set `user_subscriptions.status = 'canceled'`
2. **Manually** update `user_profiles.user_tier_id` to the Standard tier and clear `subscription_end_date`

> [!IMPORTANT]
> The `user_subscriptions_tier_sync` trigger does **not** handle cancellation → standard revert. The profile update must be done explicitly in client code.

### EXCLUDE Constraint

```sql
EXCLUDE USING gist (user_id WITH =, validity WITH &&)
```

This prevents overlapping active subscriptions for the same user. When assigning a new subscription, the old one must be deactivated first (or have a non-overlapping `validity` range).

---

## 7. File Reference

```
mobile/
├── app/(tabs)/settings/admin/
│   ├── users.tsx              # User CRM screen (split-pane)
│   ├── questions.tsx          # Question CMS screen (4-tab split-pane)
│   ├── tiers.tsx              # Subscription tier editor
│   ├── scheduler.tsx          # Question scheduling
│   ├── gallery.tsx            # Asset gallery
│   ├── restrictions.tsx       # Content restrictions
│   ├── cases.tsx              # Support case management
│   ├── navigator.tsx          # Admin tab navigator
│   └── index.native.tsx       # Admin hub (native)
│
├── components/admin/
│   └── ConfirmModal.tsx       # Reusable confirmation dialog
│
├── hooks/
│   ├── useAdminUsers.ts       # Paginated user list
│   ├── useAdminUserDetail.ts  # User detail data fetcher
│   ├── useAdminMutations.ts   # User data mutations + audit logging
│   ├── useAdminQuestions.ts   # Master library questions
│   ├── useAdminAllocations.ts # Track allocations
│   ├── useAdminQuestionMutations.ts  # Question mutations
│   ├── useAdminCases.ts       # Support cases
│   └── useAdminLogic.ts       # Shared admin utilities
│
supabase/migrations/
├── 20260226_question_admin_setup.sql   # RLS + RPCs + Views for questions
├── 20260226_admin_update_policies.sql  # RLS UPDATE/INSERT for user tables
└── 20260226_unallocated_masters_rpc.sql # Unallocated masters RPC
```
