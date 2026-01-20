# Deployment Guide

## Pre-Deployment Checklist

### 1. Environment Configuration
- [ ] Update `.env` with production values
- [ ] Set `EXPO_PUBLIC_SUPABASE_URL` to production URL
- [ ] Set `EXPO_PUBLIC_SUPABASE_ANON_KEY` to production key
- [ ] Verify all environment variables are correct

### 2. App Configuration (app.json)
```json
{
  "expo": {
    "name": "Elementle",
    "slug": "elementle",
    "version": "1.0.0",
    "ios": {
      "bundleIdentifier": "com.elementle.app",
      "buildNumber": "1"
    },
    "android": {
      "package": "com.elementle.app",
      "versionCode": 1
    }
  }
}
```

- [ ] Update app name
- [ ] Set unique bundle identifier (iOS)
- [ ] Set unique package name (Android)
- [ ] Increment version/build numbers for updates

### 3. Build Configuration

**iOS:**
```bash
# Install EAS CLI
npm install -g eas-cli

# Login to Expo account
eas login

# Configure build
eas build:configure

# Create production build
eas build --platform ios --profile production

# Submit to App Store
eas submit --platform ios
```

**Android:**
```bash
# Create production build
eas build --platform android --profile production

# Submit to Play Store
eas submit --platform android
```

### 4. Code Quality Checks
- [ ] Run `npm run lint` - fix all errors
- [ ] Run `npm run typecheck` - fix all TypeScript errors
- [ ] Remove all `console.log` statements from production code
- [ ] Remove all test IDs (optional for production)
- [ ] Verify no `TODO` or `FIXME` in critical paths

### 5. Performance Optimization
- [ ] Run `npx expo export` to check bundle size
- [ ] Optimize images (compress to <200KB each)
- [ ] Enable Hermes engine (Android)
- [ ] Test on oldest supported device/OS
- [ ] Profile memory usage
- [ ] Test slow 3G network conditions

### 6. Security Review
- [ ] Verify API keys are not hardcoded
- [ ] Enable SSL pinning (if applicable)
- [ ] Review data storage (no sensitive data in AsyncStorage)
- [ ] Implement code obfuscation (if needed)
- [ ] Test authentication flows thoroughly

### 7. Testing
- [ ] Test all user flows end-to-end
- [ ] Test guest mode → signup conversion
- [ ] Test offline mode handling
- [ ] Test on various device sizes
- [ ] Test dark mode
- [ ] Verify haptics work on real device
- [ ] Verify sounds play correctly

## EAS Build Configuration

Create `eas.json`:

```json
{
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal"
    },
    "preview": {
      "distribution": "internal",
      "ios": {
        "simulator": true
      }
    },
    "production": {
      "env": {
        "EXPO_PUBLIC_SUPABASE_URL": "YOUR_PRODUCTION_URL",
        "EXPO_PUBLIC_SUPABASE_ANON_KEY": "YOUR_PRODUCTION_KEY"
      }
    }
  },
  "submit": {
    "production": {
      "ios": {
        "appleId": "your@email.com",
        "ascAppId": "YOUR_APP_ID",
        "appleTeamId": "YOUR_TEAM_ID"
      },
      "android": {
        "serviceAccountKeyPath": "./path/to/api-key.json",
        "track": "internal"
      }
    }
  }
}
```

## App Store Submission

### iOS App Store

1. **App Store Connect Setup:**
   - Create app in App Store Connect
   - Fill out app information
   - Upload screenshots (see FINAL_POLISH_CHECKLIST.md)
   - Set up pricing and availability

2. **Build Upload:**
   ```bash
   eas build --platform ios --profile production
   eas submit --platform ios
   ```

3. **TestFlight:**
   - Add internal testers
   - Test thoroughly before submitting
   - Gather feedback

4. **Submit for Review:**
   - Provide demo account (if login required)
   - Add review notes
   - Submit for review
   - Average wait: 24-48 hours

### Android Play Store

1. **Play Console Setup:**
   - Create app in Play Console
   - Complete store listing
   - Upload screenshots
   - Set up content rating

2. **Build Upload:**
   ```bash
   eas build --platform android --profile production
   eas submit --platform android
   ```

3. **Internal Testing:**
   - Add internal testers
   - Test APK thoroughly
   - Promote to beta when ready

4. **Production Release:**
   - Choose rollout percentage (start with 10%)
   - Monitor crash reports
   - Gradually increase rollout

## Post-Deployment

### Monitoring
- [ ] Set up Sentry for crash reporting
- [ ] Monitor Firebase Analytics
- [ ] Track key metrics (DAU, retention, etc.)
- [ ] Monitor app store reviews

### Maintenance
- [ ] Respond to reviews within 24 hours
- [ ] Fix critical bugs immediately (hotfix)
- [ ] Plan monthly updates
- [ ] Keep dependencies up to date

### Rollback Plan
If critical issues arise:
1. Submit hotfix build ASAP
2. Respond to user reviews explaining fix
3. Monitor crash reports for new issues
4. Consider phased rollout for future updates

## Update Releases

For each update:
1. Increment version number in app.json
2. Increment build number (iOS) / versionCode (Android)
3. Update changelog
4. Test thoroughly
5. Build and submit
6. Release notes in store listing

## Troubleshooting

**Build Fails:**
- Check `eas build` logs
- Verify credentials are correct
- Try clearing build cache

**Submission Rejected:**
- Review rejection reason carefully
- Fix issues
- Add clarification in review  notes
- Resubmit

**App Crashes:**
- Check Sentry/crash reports
- Reproduce issue
- Fix and release hotfix
- Test on affected devices/OS versions

## Resources

- [Expo EAS Build Docs](https://docs.expo.dev/build/introduction/)
- [Expo Submit Docs](https://docs.expo.dev/submit/introduction/)
- [App Store Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)
- [Play Store Policies](https://play.google.com/about/developer-content-policy/)
