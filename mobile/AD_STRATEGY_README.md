# Ad Strategy — Elementle

## Architecture Overview

```
┌─ Age Verification ──────────────────────────────────────────────────┐
│  User provides birth year/month → stored in AsyncStorage            │
│  (user_age_date, user_is_adult, user_age_verified)                  │
│                                                                     │
│  Also synced to/from Supabase (user_profiles.age_date, is_adult)    │
└─────────────────────────────────────────────────────────────────────┘
              │
              ▼
┌─ AdManager.initializeAds() ─────────────────────────────────────────┐
│  1. Reads age data from AsyncStorage                                 │
│  2. Determines age category (child / teen / adult)                   │
│  3. Selects provider based on age + USE_APPLOVIN_FOR_ADULTS flag     │
│  4. Initializes the selected SDK                                     │
│  5. Notifies subscribers (AdBanner re-renders)                       │
└─────────────────────────────────────────────────────────────────────┘
```

## Age-Based Ad Routing

| Age Group | Provider                      | Content Rating              | File Reference                  |
|-----------|-------------------------------|-----------------------------|---------------------------------|
| < 16      | `'none'` (COPPA — no ads)     | N/A                         | `AdManager.ts:78-82`            |
| 16-17     | `'admob'`                     | `MaxAdContentRating.PG`     | `AdManager.ts:84-88`            |
| 18+       | `'admob'` (AppLovin deferred) | `MaxAdContentRating.MA`     | `AdManager.ts:90-98`            |

## The AppLovin Switch

**Current state**: `USE_APPLOVIN_FOR_ADULTS = false` (line 20 in `AdManager.ts`)

**To activate AppLovin for 18+ users**:

1. Replace placeholder IDs in `APPLOVIN_CONFIG` (lines 54-64 in `AdManager.ts`)
2. Set `USE_APPLOVIN_FOR_ADULTS = true` (line 20)
3. Install `react-native-applovin-max` package
4. Uncomment the real SDK initialization in `initializeAppLovin()` (line 122)
5. Update `AdBanner.tsx` to render AppLovin banner component when provider is `'applovin'`

## Production Checklist (AdMob-Only Launch)

- [x] AdMob App IDs configured in `app.config.ts` plugin + `app.json`
- [x] Production ad unit IDs hardcoded in `ADMOB_CONFIG` (no env vars needed)
- [x] `GADApplicationIdentifier` / `SKAdNetworkItems` auto-injected by plugin
- [x] `AdBanner` subscribes to init state (re-renders when ready)
- [x] Age verification gate prevents SDK init for < 16

## How to Verify Production Fix Locally

```bash
# Option 1: Build a production profile locally
eas build --profile production --platform ios --local

# Option 2: Internal distribution (installs on device via link)
eas build --profile preview --platform ios

# Option 3: Check logs in Expo Go / dev client
# Look for: "[AdManager] Initialization complete: { provider: 'admob', category: 'adult' }"
# Then:     "[AdBanner] Ad loaded successfully"
```

## Key Files

| File | Purpose |
|------|---------|
| `lib/AdManager.ts` | Singleton manager — init, provider routing, subscriber API |
| `lib/adConfig.ts` | Dynamic ad unit ID getter (test vs production) |
| `components/AdBanner.tsx` | Banner ad component (subscribes to init) |
| `hooks/useInterstitialAd.ts` | Interstitial ad hook |
| `lib/ageVerification.ts` | Age date calculation and AsyncStorage persistence |
| `app/_layout.tsx:212` | Calls `initializeAds()` when age verification is confirmed |
