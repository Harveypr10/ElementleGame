# Client-Side Authentication Fix for Profile Updates

## Problem Diagnosis (October 23, 2025)

### Symptoms
- PrivacyPage ads consent toggle showed "Failed to update profile" error
- Backend PATCH route was correctly returning 200 status in some cases
- Client still throwing errors even with successful backend responses

### Root Cause
The `patchProfile` function in `client/src/hooks/useProfile.ts` was missing the Supabase Authorization header when making PATCH requests to `/api/auth/profile`.

**Server logs showed:**
```
PATCH /api/auth/profile 401 in 0ms :: {"error":"Unauthorized"}
```

**Original broken code:**
```typescript
async function patchProfile(updates: Partial<UserProfile>): Promise<UserProfile> {
  const res = await fetch("/api/auth/profile", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },  // ❌ Missing Authorization header!
    body: JSON.stringify(updates),
  });
  if (!res.ok) {
    throw new Error("Failed to update profile");
  }
  return res.json();
}
```

The backend route requires authentication via `verifySupabaseAuth` middleware:
```typescript
app.patch("/api/auth/profile", verifySupabaseAuth, async (req: any, res) => {
  // This middleware checks for Authorization: Bearer <token>
  // Without it, request returns 401 Unauthorized
})
```

## Solution Implemented

### Updated `client/src/hooks/useProfile.ts`

**Key changes:**
1. Import Supabase client: `import { getSupabaseClient } from "@/lib/supabaseClient"`
2. Get session token before making request
3. Include Authorization header with bearer token
4. Add comprehensive logging for debugging

**Fixed code:**
```typescript
async function patchProfile(updates: Partial<UserProfile>): Promise<UserProfile> {
  const supabase = await getSupabaseClient();
  const { data: { session } } = await supabase.auth.getSession();
  
  if (!session?.access_token) {
    console.error("[patchProfile] No valid session");
    throw new Error("Not authenticated");
  }

  console.log("[patchProfile] Sending PATCH with body:", updates);
  
  const res = await fetch("/api/auth/profile", {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${session.access_token}`,  // ✅ Now included!
    },
    body: JSON.stringify(updates),
  });
  
  console.log("[patchProfile] Response status:", res.status);
  
  if (!res.ok) {
    const errorText = await res.text();
    console.error("[patchProfile] Request failed:", res.status, errorText);
    throw new Error("Failed to update profile");
  }
  
  const data = await res.json();
  console.log("[patchProfile] Response body:", data);
  return data;
}
```

## Testing Instructions

### 1. Manual Testing
1. Log in to your account
2. Navigate to Options → Privacy page
3. Toggle the "Ads Consent" checkbox on/off
4. **Expected behavior:**
   - No "Failed to update profile" error
   - Toggle updates smoothly
   - Supabase `ads_consent` and `ads_consent_updated_at` fields update correctly

### 2. Browser DevTools Verification
Open Browser Console and check for:
```
[patchProfile] Sending PATCH with body: { adsConsent: true }
[patchProfile] Response status: 200
[patchProfile] Response body: { id: "...", adsConsent: true, ... }
```

### 3. Server Logs Verification
Check application logs for:
```
PATCH /api/auth/profile body: { adsConsent: true }
PATCH /api/auth/profile 200 in XXXms :: {"id":"...","adsConsent":true,...}
```

### 4. Database Verification
Query Supabase users table:
```sql
SELECT id, ads_consent, ads_consent_updated_at FROM users WHERE id = '<your-user-id>';
```

Expected result:
- `ads_consent` toggles between true/false
- `ads_consent_updated_at` timestamp updates only when value changes

## Acceptance Criteria

✅ Browser Network tab shows PATCH `/api/auth/profile` returns **200 status**  
✅ Response includes full UserProfile JSON with updated fields  
✅ `useProfile.ts` successfully parses and returns the updated profile  
✅ No "Failed to update profile" error in client  
✅ Toggling adsConsent updates Supabase database  
✅ UI reflects the change immediately  
✅ Console logs show successful request/response flow  

## Pattern for Future Authenticated Requests

All authenticated fetch requests in this codebase should follow this pattern:

```typescript
import { getSupabaseClient } from "@/lib/supabaseClient";

async function makeAuthenticatedRequest() {
  const supabase = await getSupabaseClient();
  const { data: { session } } = await supabase.auth.getSession();
  
  if (!session?.access_token) {
    throw new Error("Not authenticated");
  }

  const response = await fetch("/api/your-endpoint", {
    method: "POST", // or GET, PATCH, DELETE
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${session.access_token}`,
    },
    body: JSON.stringify(yourData),
  });
  
  if (!response.ok) {
    throw new Error("Request failed");
  }
  
  return response.json();
}
```

## Files Modified

- `client/src/hooks/useProfile.ts` - Added Supabase auth header and logging to `patchProfile` function

## Related Documentation

- See `CONSENT_FIELDS_FIX_SUMMARY.md` for backend camelCase/snake_case alignment
- See `replit.md` for full authentication flow documentation
