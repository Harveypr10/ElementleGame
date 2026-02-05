# Remaining Tasks - Mobile App Release

**Generated:** 2026-02-04  
**Source:** Full audit comparing `Client/` (Web) vs `mobile/` (React Native)

---

## Legend
- 🍎 **Low Hanging Fruit** - Easy wins, minimal risk
- ⚠️ **Complex/Risk** - Requires careful implementation
- 🔗 **Dependency** - Blocked by external factors

---

## 1. Authentication & Account Linking

### Critical

- [ ] ⚠️ **Implement Google Account Linking**
  - **Web Reference:** `Client/src/components/AccountInfoPage.tsx` lines 292-366
  - **Mobile Location:** Create flow in settings or account info
  - **Supabase Method:** `supabase.auth.linkIdentity({ provider: 'google' })`
  - **Complexity:** Medium - need OAuth redirect handling in Expo

- [ ] ⚠️ **Implement Apple Account Linking**
  - **Web Reference:** Same as above
  - **Mobile Location:** Create flow in settings or account info
  - **Supabase Method:** `supabase.auth.linkIdentity({ provider: 'apple' })`
  - **Complexity:** Medium - need expo-apple-authentication integration

- [ ] 🍎 **Test Magic Link Flow End-to-End**
  - **Mobile Location:** `app/(auth)/login.tsx`
  - **Action:** Verify magic link emails arrive, deep link opens app, user authenticated
  - **Note:** Web has magic link toggle; mobile may not need it for MVP

- [ ] 🍎 **Test Password Reset Flow End-to-End**
  - **Mobile Location:** `app/(auth)/password-reset.tsx`
  - **Action:** Send reset email → click link → verify password update
  - **Deep Link:** `elementle://reset-password` configured

---

## 2. Advertising Infrastructure ✅ (Phase 1 Complete)

### Done

- [x] ✅ **AdMob Integration with Age-Based Conditional Initialization**
  - Under 16: No ads (COPPA compliance)
  - 16-17: AdMob with age-restricted settings
  - 18+: AdMob with full personalization

- [x] ✅ **Implement 18+ Age Gate at Signup**
  - Location: `app/(auth)/age-verification.tsx` and `app/(auth)/login.tsx`
  - Year/Month wheel picker with animated month reveal
  - Data stored in AsyncStorage + synced to `user_profiles.age_date`

### Deferred to Post-Launch

- [ ] ⏸️ **Switch from AdMob to AppLovin MAX**
  - Marked as optional; AdMob is working for launch
  - AppLovin integration can be done after initial release

### Still Required

- [ ] 🍎 **Add Production Ad Unit IDs**
  - **Location:** `lib/adConfig.ts`
  - **Action:** Replace placeholder IDs with real AdMob unit IDs

---

## 3. UI/UX Polish

### Pre-Launch

- [ ] ⚠️ **Redesign AllBadgesModal**
  - **Current:** `components/stats/AllBadgesModal.tsx` (346 lines)
  - **Web Reference:** `Client/src/components/badges/AllBadgesPopup.tsx` (502 lines)
  - **Issues Noted:** Layout/alignment issues, doesn't match app aesthetic
  - **Key Features from Web:** Framer Motion swipe gestures, category navigation

- [ ] 🍎 **Dark Mode Consistency Audit**
  - **Screens to Check:**
    - [ ] `app/(auth)/password-reset.tsx` - has `dark:` classes
    - [ ] `app/(auth)/login.tsx`
    - [ ] `app/(auth)/otp-verification.tsx`
    - [ ] `app/stats.tsx`
    - [ ] `app/archive.tsx`
    - [ ] `app/game-result.tsx`
    - [ ] All modal components
  - **Action:** Ensure all text/backgrounds have dark: variants

- [ ] 🍎 **Fix Password Reset Back Button Color**
  - **Location:** `app/(auth)/password-reset.tsx` line 72
  - **Issue:** ChevronLeft uses hardcoded `#1e293b` (dark color on dark bg)
  - **Fix:** Use `useThemeColor` hook

---

## 4. Backend Integration

### Pre-Launch

- [ ] 🍎 **RevenueCat Production Keys**
  - **Location:** `lib/RevenueCat.js`
  - **Action:** Switch from sandbox to production API keys
  - **Test:** Make real purchase on TestFlight

- [ ] 🍎 **Verify Webhook Endpoints**
  - RevenueCat webhook → Edge Function works in production
  - Supabase secrets properly configured

---

## 5. App Store Preparation

### Assets Required

- [ ] 🍎 🔗 **Create App Icon**
  - iOS: 1024x1024px + all sizes per FINAL_POLISH_CHECKLIST.md
  - Android: 512x512px + adaptive icon

- [ ] 🍎 🔗 **Create Splash Screen**
  - Size: 1284x2778px for iOS
  - Configure in `app.json`
  - Test dark mode splash

- [ ] 🍎 **Screenshots**
  - 6.7" iPhone, 6.5" iPhone, 5.5" iPhone, iPad Pro

### Compliance

- [ ] 🍎 **Privacy Policy Link**
  - Verify `app/privacy.tsx` is accessible and complete

- [ ] 🍎 **Account Deletion**
  - Verify user can delete account from settings
  - Required for App Store approval

---

## 6. Account Info Features

### Feature Parity with Web

- [ ] **Create Account Info Screen**
  - **Web Reference:** `Client/src/components/AccountInfoPage.tsx` (1522 lines)
  - **Mobile:** Settings → Account Info route exists (`handleAccountInfo`)
  - **Features to Implement:**
    - [ ] Display current email
    - [ ] Display linked accounts (Google/Apple)
    - [ ] Change display name
    - [ ] Change email address (with OTP verification)
    - [ ] Change password
    - [ ] Region change (with confirmation)
    - [ ] Toggle magic link login

---

## 7. Testing & QA

### E2E Test Flows

- [ ] **Guest → Signed Up User Flow**
  - Play as guest → complete puzzles → sign up → verify data migrated

- [ ] **Streak Saver Flow**
  - Miss a day → trigger popup → recover streak → verify celebration

- [ ] **Holiday Mode Flow**  
  - Activate holiday → return after days → verify streak protected

- [ ] **Purchase Flow**
  - Open paywall → purchase → verify pro status → ads removed

- [ ] **Account Linking Flow** (once implemented)
  - Link Google/Apple → unlink → verify access still works

---

## Quick Reference: File Locations

```
Authentication:
├── app/(auth)/login.tsx        - Main login/signup
├── app/(auth)/password-reset.tsx
├── app/(auth)/otp-verification.tsx
├── lib/auth.tsx                - Auth context

Ads:
├── lib/adConfig.ts             - Ad configuration
├── components/AdBanner.tsx     - Banner ads

Badges:
├── components/stats/AllBadgesModal.tsx
├── components/game/BadgeUnlockModal.tsx
├── hooks/useBadgeSystem.ts

Settings:
├── app/(tabs)/settings.tsx     - Main settings
├── app/(tabs)/settings/admin/  - Admin tools
```

---

## Priority Order (Recommended)

1. **AppLovin MAX + 18+ Gate** (blockers for production)
2. **Google/Apple Linking** (common user request)
3. **AllBadgesModal Redesign** (user-facing polish)
4. **Dark Mode Audit** (quality pass)
5. **App Icons/Splash** (store submission requirement)
6. **Final E2E Testing** (release validation)
