# NEXT_STEPS.md — Deep-Dive Audit Report

**Generated:** 2026-02-10  
**Scope:** Full comparison of `client/` (Web App) vs `mobile/` (React Native) + known issue verification

---

## Executive Summary

The mobile app is approximately **85-90% feature-complete** relative to the web app. Core gameplay, streak/holiday logic, subscriptions, and guest mode are all ported and functional. The remaining work falls into three categories: **critical iOS blockers**, **UI polish gaps**, and **Android readiness**.

### Key Findings
- ✅ Auth "Nuke on Logout" is correctly implemented
- ✅ `usePuzzleReadiness` is robust with two-phase polling + caching
- ⚠️ Splash screen image is still the **Expo default placeholder** (not custom)
- ⚠️ AppLovin dead code remains in codebase (should be cleaned up)
- ⚠️ Production ad unit IDs still have placeholders (Android interstitial, iOS interstitial)
- ⚠️ `AllBadgesModal` has known layout/alignment issues and lacks web parity

---

## 🚨 Section 1: Critical Fixes (iOS Release Blockers)

### 1.1 Splash Screen — Still Using Expo Default Placeholder

| Item | Detail |
|------|--------|
| **File** | `app.config.ts` line 56 → `./assets/splash-icon.png` |
| **Issue** | `splash-icon.png` is the Expo default grid/circle logo, NOT a branded Elementle splash |
| **Impact** | Users see a generic icon for ~1-2 seconds on cold start before the custom `SplashScreen.tsx` component loads |
| **Fix** | Create a proper branded splash image (1284×2778px) and replace `assets/splash-icon.png` |
| **Note** | The in-app `SplashScreen.tsx` component (hamster + "Welcome back") is correct, but the native OS splash before React loads is wrong |

### 1.2 Production Ad Unit IDs — Incomplete

| File | Issue |
|------|-------|
| `lib/adConfig.ts` | iOS banner ID looks real (`ca-app-pub-6974310366527526/5514109458`) ✅ |
| `lib/adConfig.ts` | iOS interstitial ID = `ca-app-pub-XXXXXXXXXXXXXXXX/YYYYYYYYYY` ❌ Placeholder |
| `lib/adConfig.ts` | Android banner & interstitial = placeholders ❌ |
| `lib/AdManager.ts` | Has actual AdMob IDs for iOS banner (`5514109458`) and interstitial (`5106915348`) and Android equivalents |

> [!CAUTION]
> There is a **conflict**: `adConfig.ts` has placeholder IDs, while `AdManager.ts` has what appear to be real production IDs. The `AdBanner.tsx` component imports from `adConfig.ts` (placeholder) but also imports `getActiveProvider` from `AdManager.ts`. Need to reconcile which file is the source of truth for ad unit IDs.

### 1.3 AppLovin Dead Code — Cleanup Required

| File | Lines of AppLovin code |
|------|----------------------|
| `lib/AdManager.ts` | Type definition, `APPLOVIN_CONFIG` object (placeholder keys), `initializeAppLovin()` function (lines 20-31, 87-96, 122-123, 164-172) |
| `lib/AdManager.web.ts` | Type definition and config (placeholder) |
| `lib/AdManager.android.ts` | Type definition |
| `lib/ageVerification.ts` | Comment reference (line 180) |
| `app/(auth)/age-verification.tsx` | Comment reference (line 5) |
| `app/_layout.tsx` | Comment reference (line 296) |

> [!IMPORTANT]
> The `initializeAppLovin()` function currently **falls back to AdMob** (line 89-91), so it's not broken — but it adds unnecessary complexity. If AppLovin MAX has been fully deferred to post-launch, all traces should be removed and the `AdProvider` type simplified to `'admob' | 'none'`.

### 1.4 Account Deletion — Needs Verification

Apple requires a working "Delete Account" feature for App Store approval. The settings screen (`app/(tabs)/settings.tsx`) exists, along with `account-info.tsx` — but this flow needs end-to-end testing to ensure the account is fully deleted from Supabase and the user is signed out cleanly.

### 1.5 Google/Apple Sign-In — Not Yet Implemented

| Item | Status |
|------|--------|
| `@react-native-google-signin/google-signin` | Listed in `app.config.ts` plugins but SDKs may need credential configuration |
| `expo-apple-authentication` | Listed in `app.config.ts` plugins |
| `lib/socialAuth.ts` | File exists (18KB) — implementation present |
| Login screen buttons | Need verification that Google/Apple buttons are visible and functional |

> [!NOTE]
> The `AUTH_IMPLEMENTATION_PLAN.md` outlines the full plan. Console credentials (Google Cloud, Apple Developer Portal, Supabase provider config) are prerequisites that may not yet be completed.

---

## 🎨 Section 2: UI Polish List

### 2.1 AllBadgesModal — Needs Redesign

| Aspect | Web App | Mobile App | Gap |
|--------|---------|------------|-----|
| **File** | `badges/AllBadgesPopup.tsx` (502 lines) | `stats/AllBadgesModal.tsx` (476 lines) | — |
| **Components** | `AllBadgesPopup`, `BadgeCelebrationPopup`, `BadgeSlot`, `BadgesRow`, `index.ts` (5 files) | `AllBadgesModal`, `BadgeSlot` (2 files) | Missing `BadgeCelebrationPopup`, `BadgesRow` |
| **Animations** | Framer Motion with swipe gestures, pan handling | Known layout/alignment issues per conversation history | Web UX is significantly more polished |
| **Categories** | `elementle`, `streak`, `percentile` with animated transitions | Present but alignment issues noted | Category navigation UX needs work |

### 2.2 Dark Mode Consistency Audit

Screens that need dark mode verification:

| Screen | File | Has `.web.tsx` variant | Dark mode status |
|--------|------|----------------------|-----------------|
| Password Reset | `app/(auth)/password-reset.tsx` | No | ⚠️ Known hardcoded `#1e293b` for back button |
| Login | `app/(auth)/login.tsx` | No | Needs audit |
| OTP Verification | `app/(auth)/otp-verification.tsx` | No | Needs audit |
| Stats | `app/stats.tsx` / `stats.web.tsx` | ✅ | Needs audit |
| Archive | `app/archive.tsx` / `archive.web.tsx` | ✅ | Needs audit |
| Game Result | `app/game-result.tsx` / `game-result.web.tsx` | ✅ | Needs audit |
| About | `app/about.tsx` / `about.web.tsx` | ✅ | Needs audit |
| Privacy | `app/privacy.tsx` / `privacy.web.tsx` | ✅ | Needs audit |
| Terms | `app/terms.tsx` / `terms.web.tsx` | ✅ | Needs audit |
| Manage Subscription | `app/manage-subscription.native.tsx` / `.web.tsx` | ✅ | Needs audit |

### 2.3 Home Screen Loading States

From conversation history, recent sessions focused on caching the user's name, game status, and subscription status to eliminate FOUC (flash of unstyled content). The `usePuzzleReadiness.ts` hook provides a solid two-phase polling mechanism with AsyncStorage caching. **Verify these caching layers work correctly after a fresh app launch.**

### 2.4 Missing Web Components in Mobile

| Web Component | Mobile Equivalent | Status |
|---------------|-------------------|--------|
| `BadgeCelebrationPopup.tsx` | `game/BadgeUnlockModal.tsx` | ✅ Different name, exists |
| `BadgesRow.tsx` | Inline in `stats.tsx` (lines 530-634) | ✅ Equivalent — 3 `BadgeSlot` pressables + "View all" link, rendered directly in stats page rather than as a separate component |
| `HolidayActivationOverlay.tsx` | Holiday mode in `useStreakSaverStatus.ts` | ✅ Logic present |
| `HolidayEndedPopup.tsx` | Via `useStreakSaverStatus.ts` | ✅ Logic present |
| `IntroScreen.tsx` (web) | `OnboardingScreen.tsx` | ✅ Exists |
| `RenewalPopup.tsx` | No equivalent | ⚠️ Component exists in web but is **not imported anywhere** (orphan code). The `useSubscription` hook tracks `isExpired` state. If renewal prompting is desired for mobile, a new popup triggered by `isExpired === true` would be needed (see note below) |
| `StreakCelebrationPopup.tsx` | `game/StreakCelebration.tsx` + `.web.tsx` | ✅ Fully implemented — used in `game-result.tsx`, `ActiveGame.tsx`, and admin gallery with `useEndGameLogic.ts` hook support |
| `ThemeToggle.tsx` | `useThemeColor.ts` | ✅ Automatic dark mode support |
| `WelcomePage.tsx` | `SplashScreen.tsx` | ✅ Exists |
| `ProSubscriptionDialog.tsx` | `Paywall.tsx` | ✅ Exists |

---

## 🤖 Section 3: Android Readiness Checklist

### 3.1 Build Configuration
- [x] Package name set: `com.dobl.elementlegame` in `app.config.ts`
- [x] Adaptive icon configured (uses `Icon-512.png`)
- [x] Permissions declared (RECORD_AUDIO, AUDIO_SETTINGS, LOCATION)
- [x] Edge-to-edge enabled
- [ ] **Google Mobile Ads plugin excluded from Android builds** (via `EAS_BUILD_PLATFORM` check in `app.config.ts`) — this means **no ads on Android currently**

### 3.2 Ad System on Android
- `AdBanner.android.tsx` → Returns invisible `<View>` (no-op) ✅ No crash risk
- `useInterstitialAd.android.ts` → Exists as stub
- `AdManager.android.ts` → Minimal stub
- `adConfig.android.ts` → Stub

> [!WARNING]
> Android ads are completely disabled. The `app.config.ts` excludes the `react-native-google-mobile-ads` plugin on Android builds due to Gradle/Kotlin version conflicts. This is intentional for now but means **Android launches without ads**. Production ad unit IDs for Android are also placeholders.

### 3.3 Platform-Specific Files Audit

The following platform-specific file patterns are used:

| Component | `.tsx` (iOS default) | `.web.tsx` | `.android.tsx` | `.native.tsx` |
|-----------|---------------------|------------|----------------|---------------|
| `AdBanner` | ✅ | ✅ | ✅ | — |
| `InputGrid` | ✅ | ✅ | — | — |
| `NumericKeyboard` | ✅ | ✅ | — | — |
| `GoProButton` | ✅ | ✅ | — | — |
| `ThemedText` | ✅ | ✅ | — | — |
| `useInterstitialAd` | ✅ | ✅ | ✅ | — |
| `AdManager` | ✅ | ✅ | ✅ | — |
| `adConfig` | ✅ | ✅ | ✅ | — |
| `socialAuth` | ✅ | ✅ | — | — |
| Home (`index`) | ✅ | ✅ | — | — |
| Stats | ✅ | ✅ | — | — |
| Archive | ✅ | ✅ | — | — |
| Settings | ✅ | ✅ | — | — |
| Options | ✅ | ✅ | — | — |
| `subscription` | — | ✅ | — | ✅ |
| `manage-subscription` | — | ✅ | — | ✅ |

### 3.4 Android-Specific Testing Checklist

- [ ] **Build & launch:** Run `eas build --platform android --profile development` and install on emulator/device
- [ ] **Navigation:** Test all tab navigation, auth flow, game flow
- [ ] **Keyboard:** Verify `NumericKeyboard.tsx` works on Android (no `.android.tsx` variant — uses default)
- [ ] **Input Grid:** Verify `InputGrid.tsx` layout on various Android screen sizes
- [ ] **Social Auth:** Test Google Sign-In on Android (requires SHA-1 fingerprint setup)
- [ ] **Deep Linking:** Test `elementle://` scheme on Android
- [ ] **Back Button:** Verify Android hardware back button behavior (predictive back gesture disabled)
- [ ] **RevenueCat:** Test purchase flow on Google Play (separate product setup needed)
- [ ] **Splash Screen:** Verify splash image displays correctly on Android
- [ ] **Dark Mode:** Test dark mode toggle and system-level dark mode on Android
- [ ] **Permissions:** Test location permission flow, audio permissions
- [ ] **Crash Testing:** Test edge cases — rapid logout/login, network loss, backgrounding

---

## ✅ Section 4: Verified Known Issues

### 4.1 Ads — CONFIRMED: Purely AdMob (with AppLovin dead code)
- The app uses `react-native-google-mobile-ads` exclusively
- AppLovin MAX was considered but **deferred to post-launch**
- Dead code remains (see Section 1.3) but `initializeAppLovin()` safely falls back to AdMob
- **No AppLovin SDK is installed** (not in `package.json` or plugins)

### 4.2 Auth State / signOut — CONFIRMED: Working Correctly
The "Nuke on Logout" implementation in `lib/auth.tsx` is robust:
1. `queryClient.removeQueries()` — clears ALL React Query caches ✅
2. `AsyncStorage.multiRemove(keysToRemove)` — clears 6 specific cache keys ✅
3. Dynamically clears any `puzzle_data_*` keys ✅
4. Resets `session`, `user`, `isGuest` state ✅
5. RevenueCat logout handled via `onAuthStateChange` listener (not duplicated in `signOut`) ✅
6. AppState listener handles background/foreground session refresh ✅

### 4.3 Splash Screen — CONFIRMED: Issue Present
- `app.config.ts` splash config → `./assets/splash-icon.png` (Expo default placeholder ❌)
- In-app `SplashScreen.tsx` component shows hamster + "Welcome back" (custom, correct ✅)
- `Icon-512.png` is the real hamster app icon (correct ✅)
- **Gap:** The native OS splash (before React loads) shows the default Expo logo instead of the hamster

---

## 📋 Section 5: Priority Action Items

### Tier 1 — Must Fix Before iOS Release
1. **Replace splash screen image** with branded Elementle asset
2. **Reconcile ad unit ID sources** (`adConfig.ts` vs `AdManager.ts`)
3. **Remove AppLovin dead code** or clearly gate it for post-launch
4. **Verify account deletion flow** end-to-end
5. **Test Google/Apple Sign-In** if credentials are configured

### Tier 2 — Should Fix Before iOS Release
6. **Dark mode consistency audit** across all screens (start with `password-reset.tsx` hardcoded color)
7. **AllBadgesModal alignment fixes** (known issues from conversation history)
8. **Verify production RevenueCat keys** are configured

### Tier 3 — Android Launch Prep
9. **Create first Android development build** and test on device
10. **Enable Android ads** (resolve Gradle/Kotlin conflict or ship without ads initially)
11. **Set up Google Play Console** and configure RevenueCat for Android
12. **Test all platform-specific file rendering** on Android

### Tier 4 — Post-Launch Polish
13. Add `BadgesRow` component for stats page parity with web
14. Advanced animations polish
15. Push notifications for streak reminders
16. Analytics/crash reporting integration (Sentry/Firebase)
