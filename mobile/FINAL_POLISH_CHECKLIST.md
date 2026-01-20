# Final Polish Checklist

## App Icon & Splash Screen

### App Icon Requirements

**iOS:**
- [ ] 1024x1024px PNG (App Store)
- [ ] 180x180px (iPhone 3x)
- [ ] 120x120px (iPhone 2x)
- [ ] 167x167px (iPad Pro)
- [ ] 152x152px (iPad 2x)
- [ ] 76x76px (iPad 1x)

**Android:**
- [ ] 512x512px (Play Store)
- [ ] Adaptive icon (foreground + background)
- [ ] 192x192px (xxxhdpi)
- [ ] 144x144px (xxhdpi)
- [ ] 96x96px (xhdpi)
- [ ] 72x72px (hdpi)
- [ ] 48x48px (mdpi)

### Splash Screen
- [ ] Create `splash.png` (1284x2778px for iOS)
- [ ] Configure `app.json` splash settings
- [ ] Test on all device sizes
- [ ] Verify dark mode splash
- [ ] Optimize image size (<200KB)

## Store Listing

### App Store (iOS)

**Metadata:**
- [ ] App name (30 chars max)
- [ ] Subtitle (30 chars max)
- [ ] Description (4000 chars max)
- [ ] Keywords (100 chars max, comma separated)
- [ ] Support URL
- [ ] Marketing URL (optional)
- [ ] Privacy Policy URL

**Screenshots:** (Required for all supported device sizes)
- [ ] 6.7" iPhone (1290x2796)
- [ ] 6.5" iPhone (1284x2778)
- [ ] 5.5" iPhone (1242x2208)
- [ ] 12.9" iPad Pro (2048x2732)

**App Preview Video:** (Optional but recommended)
- [ ] 15-30 second video
- [ ] Show core gameplay
- [ ] Highlight unique features

### Play Store (Android)

**Metadata:**
- [ ] App name (50 chars max)
- [ ] Short description (80 chars max)
- [ ] Full description (4000 chars max)
- [ ] Category selection
- [ ] Content rating questionnaire

**Graphics:**
- [ ] Feature graphic (1024x500)
- [ ] Phone screenshots (min 2, max 8)
- [ ] 7" tablet screenshots
- [ ] 10" tablet screenshots
- [ ] Promo video (YouTube link)

## Performance Optimization

### Build Size
- [ ] Review bundle size (`npx expo export`)
- [ ] Remove unused dependencies
- [ ] Optimize image assets  
- [ ] Enable Hermes engine (Android)
- [ ] Strip debug symbols (production)

**Target:** <50MB download size

### Launch Time
- [ ] Measure cold start time
- [ ] Optimize initial render
- [ ] Lazy load heavy components
- [ ] Preload critical data

**Target:** <2 seconds to interactive

### Memory Usage
- [ ] Profile with Xcode Instruments
- [ ] Fix memory leaks
- [ ] Optimize image caching
- [ ] Clear unused caches

**Target:** <100MB peak usage

## Legal & Compliance

### Required Documents
- [ ] Privacy Policy published
- [ ] Terms of Service published
- [ ] GDPR compliance (if EU users)
- [ ] COPPA compliance (if <13 users)
- [ ] Data deletion process

### In-App Disclosures
- [ ] Data collection notice
- [ ] Third-party services list
- [ ] User rights information
- [ ] Contact information

## App Store Review Checklist

### iOS App Review

**Common Rejection Reasons:**
- [ ] Ensure app works without internet (or handles gracefully)
- [ ] All buttons functional
- [ ] No placeholder content
- [ ] Proper error messages
- [ ] Account deletion option (if accounts exist)
- [ ] Privacy manifest included
- [ ] Sign in with Apple (if other OAuth)

**Testing Before Submit:**
- [ ] Test on oldest supported iOS version
- [ ] Test on smallest screen size
- [ ] Test all user flows
- [ ] Verify all links work
- [ ] Check dark mode support

### Android Play Review

**Common Issues:**
- [ ] Correct package name
- [ ] Proper permissions justification
- [ ] Adequate content rating
- [ ] Privacy policy accessible
- [ ] Target latest API level

## Pre-Launch Testing

### Beta Testing
- [ ] TestFlight (iOS) - Min 10 testers
- [ ] Internal testing (Android) - Min 20 testers
- [ ] Collect feedback
- [ ] Fix critical issues
- [ ] Monitor crash reports

### Devices to Test
**iOS:**
- [ ] iPhone SE (smallest)
- [ ] iPhone 14/15 (standard)
- [ ] iPhone 14/15 Pro Max (largest)
- [ ] iPad (if supported)

**Android:**
- [ ] Small phone (5" screen)
- [ ] Mid-range phone
- [ ] Large phone (6.5"+)
- [ ] Tablet (if supported)

### Network Conditions
- [ ] WiFi
- [ ] 4G/5G
- [ ] 3G (slow)
- [ ] Offline mode
- [ ] Airplane mode transitions

## Analytics & Monitoring

### Setup Required
- [ ] Firebase Analytics configured
- [ ] Crash reporting (Sentry/Crashlytics)
- [ ] Performance monitoring
- [ ] User flow tracking
- [ ] Conversion tracking

### Key Metrics to Track
- [ ] Daily Active Users (DAU)
- [ ] Session duration
- [ ] Puzzle completion rate
- [ ] Crash-free sessions
- [ ] App store rating

## Post-Launch

### Week 1
- [ ] Monitor crash reports daily
- [ ] Respond to reviews
- [ ] Track key metrics
- [ ] Fix critical bugs immediately
- [ ] Prepare hotfix if needed

### Week 2-4
- [ ] Analyze user behavior
- [ ] A/B test improvements
- [ ] Gather feature requests
- [ ] Plan next update

### Ongoing
- [ ] Monthly performance review
- [ ] Quarterly feature releases
- [ ] Annual major updates
- [ ] Maintain >4.5 star rating

## Final Checks

**Before Submitting to Stores:**
- [ ] All test IDs removed from production
- [ ] Debug logs disabled
- [ ] API keys secured
- [ ] Version number correct
- [ ] Build number incremented
- [ ] Release notes prepared
- [ ] Support email active
- [ ] Marketing materials ready
- [ ] Press kit available
- [ ] Launch announcement drafted

**Code Quality:**
- [ ] No TODO/FIXME in critical paths
- [ ] All lint errors resolved
- [ ] TypeScript strict mode passes
- [ ] No console.log in production
- [ ] Code reviewed and approved

**Legal Sign-Off:**
- [ ] Legal team approval
- [ ] Privacy policy reviewed
- [ ] Terms accepted
- [ ] Copyright info correct
- [ ] Trademark usage verified

---

**Ready to Ship?** ✅

Once all items above are checked, you're ready to submit to the App Store and Play Store!
