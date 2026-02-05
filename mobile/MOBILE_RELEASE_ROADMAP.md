# Mobile Release Roadmap

**Last Updated:** 2026-02-04  
**Based On:** Full Project Audit comparing Web App (Client) vs Mobile App

---

## Executive Summary

The mobile app is approximately **80-85% feature-complete** relative to the web app. Recent work on Streak Saver, Holiday Mode, Guest signup flow, and UI improvements has been comprehensive. The remaining work falls into three categories below.

---

## 🚨 Critical for Launch

These items must be completed before App Store submission.

### 1. Authentication & Account Management ⬅️ **CURRENT FOCUS**
| Task | Status | Effort | Notes |
|------|--------|--------|-------|
| Google/Apple Sign In & Linking | 🔄 In Progress | Medium | Requires native SDKs + Supabase OAuth |
| Magic Link Testing | ⚠️ Untested | Low | Screen exists but magic link flow needs validation |
| Password Reset Testing | ⚠️ Untested | Low | Screen exists (`password-reset.tsx`) |

### 2. Advertising Infrastructure
| Task | Status | Effort | Notes |
|------|--------|--------|-------|
| ✅ Switch to AppLovin MAX | ⏸️ Deferred | - | AdMob working; AppLovin post-launch |
| ✅ 18+ Age Gate at Signup | ✅ Done | - | Year/Month picker with COPPA compliance |
| Production Ad Unit IDs | ❌ Missing | Low | Placeholders in `adConfig.ts` |

### 3. App Store Requirements
| Task | Status | Effort | Notes |
|------|--------|--------|-------|
| App Icon Assets | ❌ Missing | Low | iOS + Android sizes needed |
| Splash Screen | ❌ Missing | Low | Create and configure in app.json |
| Privacy Policy Integration | ⚠️ Partial | Low | Screen exists, needs linking |
| Account Deletion Option | ⚠️ Untested | Low | Required for iOS App Store |

### 4. Production Configuration
| Task | Status | Effort | Notes |
|------|--------|--------|-------|
| RevenueCat Production Keys | ⚠️ Pending | Low | Currently sandbox tested |
| Supabase Production Secrets | ⚠️ Pending | Low | Webhook secrets etc. |

---

## 🎯 Nice to Have (Before Launch)

These enhance user experience but aren't blockers.

### 1. UI Polish
| Task | Status | Effort | Notes |
|------|--------|--------|-------|
| AllBadgesModal Redesign | ⚠️ Needed | Medium | Redesign to match app aesthetic |
| Dark Mode Consistency | ⚠️ Audit | Medium | Check all screens for dark mode support |
| Percentile Badge Display | ⚠️ Basic | Low | "Top %" badges in stats screen |

### 2. Feature Parity
| Task | Status | Effort | Notes |
|------|--------|--------|-------|
| Account Info Page | ⚠️ Basic | Medium | Web has full profile management |
| Change Display Name | ❓ Check | Low | May exist, needs verification |
| Change Email Address | ❓ Check | Low | May exist, needs verification |

### 3. Quality of Life
| Task | Status | Effort | Notes |
|------|--------|--------|-------|
| Loading States Polish | ✅ Complete | - | Skeleton loaders implemented |
| Error Messages | ⚠️ Partial | Low | More user-friendly messages |
| Promotion Code Support | ❌ Missing | Low | RevenueCat promo codes |

---

## 🔮 Post-Launch Polish

These can be addressed in v1.1+

### 1. Advanced Features
- Web-to-App deep link handling refinements
- Advanced analytics integration (Firebase/Sentry)
- A/B testing framework
- Performance profiling and optimization

### 2. UI/UX Improvements
- Advanced animations (Reanimated 3 patterns)
- Micro-interactions polish
- Tablet layout optimization
- Landscape mode support

### 3. Feature Enhancements
- Push notifications for streak reminders
- Widget support (iOS 14+)
- Apple Watch companion (future)
- Offline mode improvements

---

## Milestone Summary

```
Week 1: Critical Launch Blockers
├── Day 1-2: AppLovin MAX integration + 18+ gate
├── Day 2-3: Google/Apple account linking
├── Day 3-4: App icons, splash screen, production config
└── Day 4-5: E2E testing of all auth flows

Week 2: Polish & Submission
├── Day 1-2: AllBadgesModal redesign
├── Day 2-3: Dark mode consistency pass
├── Day 3-4: Final QA on all user flows
└── Day 4-5: App Store submission
```

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| AppLovin SDK integration issues | Medium | High | Research SDK early, test in dev branch |
| Apple OAuth linking complexity | Medium | Medium | Supabase has documentation; web works |
| App Store rejection | Low | High | Use app review checklist in FINAL_POLISH_CHECKLIST.md |

---

## Dependencies

1. **AppLovin MAX SDK**: Need to research React Native compatibility
2. **Apple Developer Account**: Required for production IAP testing
3. **App-specific passwords**: For App Store Connect submission
4. **Design assets**: App icon artwork needed from design
