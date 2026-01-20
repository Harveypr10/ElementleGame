# E2E Testing Guide

## Overview

This document outlines the E2E (End-to-End) testing strategy for the Elementle mobile app.

## Testing Framework

**Recommended:** Maestro (https://maestro.mobile.dev/)

**Why Maestro:**
- Simple YAML-based test definitions
- Fast execution
- Cross-platform (iOS + Android)
- No complex setup required
- Built-in screen recording

### Installation

```bash
# Install Maestro CLI
curl -Ls "https://get.maestro.mobile.dev" | bash

# Verify installation
maestro --version
```

## Test IDs Reference

### Home Screen
- `home-card-play` - Play today button
- `home-card-archive` - Archive button
- `home-card-stats` - Stats button

### Keyboard
- `keyboard-digit-0` through `keyboard-digit-9` - Number keys
- `keyboard-enter` - Submit button
- `keyboard-delete` - Delete button
- `keyboard-clear` - Clear button

### Onboarding
- `onboarding-screen` - Main container
- `button-onboarding-play` - Start playing button
- `button-onboarding-login` - Login button

### Auth
- `password-reset-email-input` - Email input field
- `password-reset-submit` - Submit button
- `otp-input-0` through `otp-input-5` - OTP input fields
- `category-history`, `category-science`, etc. - Category selection

## Critical Test Flows

### 1. Core Game Play Flow

**File:** `maestro/game-play-flow.yaml`

```yaml
appId: com.elementle.app
---
# Launch app
- launchApp

# Navigate to play
- tapOn:
    id: home-card-play

# Enter a guess (ddmmyy format: 120189 = 12th Jan 1989)
- tapOn:
    id: keyboard-digit-1
- tapOn:
    id: keyboard-digit-2
- tapOn:
    id: keyboard-digit-0
- tapOn:
    id: keyboard-digit-1
- tapOn:
    id: keyboard-digit-8
- tapOn:
    id: keyboard-digit-9

# Submit guess
- tapOn:
    id: keyboard-enter
    
# Verify feedback appears
- assertVisible: "Congratulations!" | "Unlucky!"
```

### 2. Archive Navigation

**File:** `maestro/archive-flow.yaml`

```yaml
appId: com.elementle.app
---
- launchApp

# Go to archive
- tapOn:
    id: home-card-archive

# Wait for calendar to load
- assertVisible: "Archive"

# Select a day (if not guest)
- tapOn: 
    text: "15"

# Verify game loads
- assertVisible:
    id: keyboard-enter
```

### 3. Stats View

**File:** `maestro/stats-flow.yaml`

```yaml
appId: com.elementle.app
---
- launchApp

# Go to stats
- tapOn:
    id: home-card-stats

# Verify stats load
- assertVisible: "Win Rate"
- assertVisible: "Current Streak"
- assertVisible: "Total Games"
```

### 4. Guest Mode Restriction

**File:** `maestro/guest-restriction-flow.yaml`

```yaml
appId: com.elementle.app
---
- launchApp

# Continue as guest (if applicable)
- tapOn:
    text: "Continue as guest"

# Try to access archive
- tapOn:
    id: home-card-archive

# Verify restriction modal appears
- assertVisible: "Create Free Account"
- assertVisible: "Maybe Later"

# Dismiss modal
- tapOn:
    text: "Maybe Later"

# Verify back to home
- assertVisible:
    id: home-card-play
```

## Running Tests

```bash
# Run all tests
maestro test maestro/

# Run specific test
maestro test maestro/game-play-flow.yaml

# Run with screen recording
maestro test maestro/game-play-flow.yaml --record
```

## CI/CD Integration

### GitHub Actions Example

```yaml
name: E2E Tests

on:
  pull_request:
  push:
    branches: [main]

jobs:
  e2e:
    runs-on: macos-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node
        uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Install dependencies
        run: npm install
        working-directory: ./mobile
      
      - name: Install Maestro
        run: curl -Ls "https://get.maestro.mobile.dev" | bash
      
      - name: Build iOS app
        run: npx expo prebuild --platform ios
        working-directory: ./mobile
      
      - name: Run E2E tests
        run: maestro test maestro/
        working-directory: ./mobile
```

## Test Coverage Goals

- **Core Gameplay:** 100%
- **Navigation:** 100%
- **Authentication:** 90%
- **Settings:** 80%
- **Edge Cases:** 70%

## Manual Testing Checklist

Beyond automated tests, the following should be tested manually:

### Visual/UX
- [ ] Dark mode transitions smooth
- [ ] Animations feel natural
- [ ] Haptic feedback appropriate
- [ ] Sound effects play correctly
- [ ] Share sheet opens properly

### Platform-Specific
**iOS:**
- [ ] Safe area handling on all models
- [ ] Back swipe gesture works
- [ ] Keyboard avoidance correct
- [ ] App review prompt appears

**Android:**
- [ ] Hardware back button works
- [ ] Status bar colors correct
- [ ] System navigation gestures work
- [ ] Share intent works

### Edge Cases
- [ ] Offline mode handling
- [ ] Poor network behavior
- [ ] App backgrounding/foregrounding
- [ ] Memory pressure
- [ ] Date/time changes
- [ ] Timezone changes

## Debugging Failed Tests

```bash
# Run test with verbose logging
maestro test --debug maestro/game-play-flow.yaml

# Record video of test
maestro test --record maestro/game-play-flow.yaml

# Run test on specific device
maestro test --device "iPhone 14 Pro" maestro/game-play-flow.yaml
```

## Best Practices

1. **Use Test IDs:** Always prefer testID over text matching
2. **Wait for Elements:** Use `assertVisible` before interactions
3. **Keep Tests Atomic:** Each test should be independent
4. **Use Descriptive Names:** Test files should clearly state what they test
5. **Regular Maintenance:** Update tests when UI changes
6. **Run Locally First:** Verify tests pass locally before CI

## Resources

- [Maestro Documentation](https://maestro.mobile.dev/getting-started/introduction)
- [Test ID Conventions](../lib/accessibility.ts)
- [CI/CD Setup Guide](.github/workflows/e2e.yml)
