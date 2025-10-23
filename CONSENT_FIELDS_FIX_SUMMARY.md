# Consent Fields Fix Summary

## Problem Statement
When users signed up with consent checkboxes ticked, the consent flags (`accepted_terms`, `ads_consent`) and their timestamps (`accepted_terms_at`, `ads_consent_updated_at`) were not being persisted to the database. The PATCH `/api/auth/profile` endpoint was failing with the error:

```
TypeError: value.toISOString is not a function
at PgTimestamp.mapToDriverValue
```

## Root Causes Identified

### 1. Timestamp Type Mismatch
When existing timestamps were retrieved from the database, they came back as ISO timestamp strings (e.g., `"2025-10-23T21:00:00.000Z"`). However, when these values were passed back to Drizzle ORM's upsert operation, Drizzle expected Date objects, not strings.

When Drizzle tried to call `.toISOString()` on these string values, it threw the error.

### 2. Missing Consent Fields in Signup
The signup route was only creating user profiles with `firstName` and `lastName`, completely ignoring the `accepted_terms` and `ads_consent` values that were being sent from the frontend.

## Solutions Implemented

### Fix 1: Updated PATCH `/api/auth/profile` Route (`server/routes.ts`)

**Changes:**
- Build profile data conditionally instead of using inline ternary operators
- Only set timestamp fields when values actually change
- **Convert existing timestamp strings to Date objects** before passing to Drizzle
- This prevents the "toISOString is not a function" error

**Code Changes:**
```typescript
// Build profile data conditionally
const profileData: any = {
  id: userId,
  email,
  firstName,
  lastName,
  acceptedTerms: accepted_terms ?? existing?.acceptedTerms ?? false,
  adsConsent: ads_consent ?? existing?.adsConsent ?? false,
  emailVerified: existing?.emailVerified ?? false,
};

// Only set acceptedTermsAt when the value actually changes
if (accepted_terms !== undefined && accepted_terms !== existing?.acceptedTerms) {
  profileData.acceptedTermsAt = now;
} else if (existing?.acceptedTermsAt) {
  // Convert existing timestamp string to Date object
  profileData.acceptedTermsAt = new Date(existing.acceptedTermsAt);
}

// Only set adsConsentUpdatedAt when the value actually changes
if (ads_consent !== undefined && ads_consent !== existing?.adsConsent) {
  profileData.adsConsentUpdatedAt = now;
} else if (existing?.adsConsentUpdatedAt) {
  // Convert existing timestamp string to Date object
  profileData.adsConsentUpdatedAt = new Date(existing.adsConsentUpdatedAt);
}
```

### Fix 2: Updated POST `/api/auth/signup` Route (`server/routes.ts`)

**Changes:**
- Extract `accepted_terms` and `ads_consent` from `req.body`
- Include consent fields in the initial profile creation
- Set timestamps immediately when consents are accepted during signup

**Code Changes:**
```typescript
const { email, password, firstName, lastName, accepted_terms, ads_consent } = req.body;

const now = new Date();

// Create user profile with consent fields
const profileData: any = {
  id: authData.user.id,
  email: authData.user.email!,
  firstName,
  lastName,
  acceptedTerms: accepted_terms ?? false,
  adsConsent: ads_consent ?? false,
};

// Set timestamps for consents that were accepted
if (accepted_terms) {
  profileData.acceptedTermsAt = now;
}
if (ads_consent) {
  profileData.adsConsentUpdatedAt = now;
}

await storage.upsertUserProfile(profileData);
```

## Testing Instructions

### End-to-End Test for Signup with Consents

1. **Sign up a new user:**
   - Navigate to the signup page
   - Fill in all required fields (email, password, firstName, lastName)
   - **Check both consent boxes:**
     - ✅ "I accept the Terms of Service and Privacy Policy" (required)
     - ✅ "I agree to receive tailored ads..." (optional)
   - Submit the form

2. **Verify in Supabase:**
   ```sql
   SELECT id, email, first_name, last_name, 
          accepted_terms, ads_consent,
          accepted_terms_at, ads_consent_updated_at
   FROM user_profiles
   WHERE email = 'your-test-email@example.com';
   ```

   **Expected Results:**
   - `accepted_terms` = `true`
   - `ads_consent` = `true`
   - `accepted_terms_at` = timestamp (not NULL)
   - `ads_consent_updated_at` = timestamp (not NULL)

### Test for Updating Consents

1. **Log in as an existing user**
2. **Go to Account Settings**
3. **Update consent preferences:**
   - Change ad consent from unchecked to checked (or vice versa)
   - Submit the update

4. **Verify in Supabase:**
   ```sql
   SELECT ads_consent, ads_consent_updated_at
   FROM user_profiles
   WHERE id = 'user-id';
   ```

   **Expected Results:**
   - `ads_consent` reflects the new value
   - `ads_consent_updated_at` has been updated to the current timestamp

## Database Schema

The `user_profiles` table includes these consent-related columns:

```typescript
// Current consent flags
acceptedTerms: boolean("accepted_terms").notNull().default(false),
adsConsent: boolean("ads_consent").notNull().default(false),

// Audit timestamps
acceptedTermsAt: timestamp("accepted_terms_at", { withTimezone: true }),
adsConsentUpdatedAt: timestamp("ads_consent_updated_at", { withTimezone: true }),
```

## Key Takeaways

1. **Always convert database timestamp strings to Date objects** before passing them to Drizzle ORM
2. **Extract and persist all user consent data** during signup, not just in subsequent updates
3. **Set audit timestamps** (`_at` fields) whenever the corresponding boolean values change
4. **Use conditional object building** instead of inline ternary operators for cleaner, more maintainable code

## Additional Fix: CamelCase/Snake_case Alignment (October 23, 2025)

### Problem
After fixing the timestamp conversion issue, a new issue was discovered: the PrivacyPage toggle was failing with "Failed to update profile" because of naming convention mismatch:
- Frontend sent: `{ adsConsent: true }` (camelCase)
- Backend expected: `{ ads_consent: true }` (snake_case)

### Solution
Standardized on camelCase throughout the TypeScript/React layer:

**Backend Changes (`server/routes.ts`):**
- POST `/api/auth/signup`: Changed destructuring from `{ accepted_terms, ads_consent }` to `{ acceptedTerms, adsConsent }`
- PATCH `/api/auth/profile`: Changed destructuring from `{ accepted_terms, ads_consent }` to `{ acceptedTerms, adsConsent }`
- Internal logic still maps camelCase to snake_case DB columns correctly via Drizzle ORM

**Frontend Changes (`client/src/components/AuthPage.tsx`):**
- Updated `signInWithOtp` metadata to send `acceptedTerms` and `adsConsent` (instead of `accepted_terms` and `ads_consent`)
- Updated profile PATCH request body to send `acceptedTerms` and `adsConsent`

This ensures consistent camelCase naming in TypeScript/React while Drizzle ORM handles the mapping to snake_case database columns.

## Files Modified

- `server/routes.ts` - Updated both POST `/api/auth/signup` and PATCH `/api/auth/profile` routes to accept camelCase
- `client/src/components/AuthPage.tsx` - Updated to send camelCase in both signup and profile creation flows
- No changes needed to `server/storage.ts` - the upsertUserProfile method was already correct
- No changes needed to `shared/schema.ts` - schema was already correct
- No changes needed to `client/src/hooks/useProfile.ts` - already sending camelCase
