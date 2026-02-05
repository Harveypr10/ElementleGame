# Social Authentication Implementation Plan

**Created:** 2026-02-04  
**Status:** Phase 2: Authentication & Account Linking

---

## Executive Summary

This document outlines the implementation of **native** Google and Apple sign-in for the Elementle mobile app, along with account linking for existing password users. We will use the native SDKs (One Tap for Google, FaceID/Native for Apple) rather than browser-based redirects.

---

## Current State Audit

### Web App (Working Reference)
| Feature | File | Method |
|---------|------|--------|
| Google Sign In | `LoginPage.tsx:430` | `supabase.auth.signInWithOAuth({ provider: 'google' })` |
| Google Linking | `AccountInfoPage.tsx:1381` | `supabase.auth.linkIdentity({ provider: 'google' })` |
| Apple | Not implemented (placeholder) | - |

### Mobile App (Current)
| Item | Status |
|------|--------|
| `expo-auth-session` | ✅ Installed (v6.0.3) |
| `@react-native-google-signin/google-signin` | ❌ Not installed |
| `expo-apple-authentication` | ❌ Not installed |
| iOS Bundle ID | ✅ `com.dobl.elementlegame` |
| Android Package | Not set in app.json |
| Social auth buttons in login.tsx | ❌ Not present |
| Account Info screen | Exists in settings, needs OAuth UI |

---

## Part A: User Actions (Console Setup)

### A1. Google Cloud Console - iOS OAuth Client

1. Go to [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
2. Select your project (or create one for Elementle)
3. Click **Create Credentials** → **OAuth client ID**
4. Select **iOS** as application type
5. Enter:
   - **Name:** `Elementle iOS`
   - **Bundle ID:** `com.dobl.elementlegame`
6. Click **Create** and save the **iOS Client ID**

### A2. Google Cloud Console - Android OAuth Client

1. Same location as above
2. Click **Create Credentials** → **OAuth client ID**
3. Select **Android** as application type
4. Enter:
   - **Name:** `Elementle Android`
   - **Package name:** `com.dobl.elementlegame`
   - **SHA-1 fingerprint:** Run this command (I will help you generate it):
     ```bash
     cd mobile/android && ./gradlew signingReport
     ```
5. Click **Create** and save the **Android Client ID**

### A3. Apple Developer Portal - Sign in with Apple

1. Go to [Apple Developer Portal](https://developer.apple.com/account/resources/identifiers/list)
2. Click on your App ID (`com.dobl.elementlegame`)
3. Enable **Sign In with Apple** capability
4. Under Certificates, Identifiers & Profiles → Keys:
   - Create a new key for "Sign in with Apple"
   - Download the `.p8` key file
   - Note the **Key ID** and your **Team ID**

### A4. Supabase Dashboard Configuration

1. Go to Supabase Dashboard → Authentication → Providers
2. **Google:**
   - Enable Google provider
   - Enter Web Client ID (from existing web setup)
   - Enter iOS Client ID (from A1)
   - Enter Android Client ID (from A2)
3. **Apple:**
   - Enable Apple provider
   - Enter Service ID Bundle (com.dobl.elementlegame)
   - Upload the .p8 key file or enter as text
   - Enter Key ID and Team ID

> [!IMPORTANT]
> You will need to provide me with the following after completing the console setup:
> - iOS Google Client ID
> - Android Google Client ID  
> - Apple Key ID and Team ID
> - Confirmation that .p8 key is configured in Supabase

---

## Part B: Engineering Tasks (I Will Implement)

### B1. Install Native SDKs

```bash
# Google Sign-In (native One Tap)
npx expo install @react-native-google-signin/google-signin

# Apple Authentication (native FaceID/TouchID)
npx expo install expo-apple-authentication
```

### B2. Configure app.json

Add iOS URL schemes and Android config for Google/Apple:

```json
{
  "expo": {
    "ios": {
      "bundleIdentifier": "com.dobl.elementlegame",
      "usesAppleSignIn": true,
      "infoPlist": {
        "CFBundleURLSchemes": [
          "com.googleusercontent.apps.YOUR_IOS_CLIENT_ID"
        ]
      }
    },
    "android": {
      "package": "com.dobl.elementlegame",
      "googleServicesFile": "./google-services.json"
    },
    "plugins": [
      "@react-native-google-signin/google-signin",
      "expo-apple-authentication"
    ]
  }
}
```

### B3. Create lib/socialAuth.ts

New module for Google/Apple native sign-in:

```typescript
// Native Google Sign-In
import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';
import * as AppleAuthentication from 'expo-apple-authentication';
import { supabase } from './supabase';

export async function signInWithGoogle(): Promise<{ error?: Error }> {
  GoogleSignin.configure({
    iosClientId: 'YOUR_IOS_CLIENT_ID',
    webClientId: 'YOUR_WEB_CLIENT_ID', // Required for Supabase
  });
  
  const { idToken } = await GoogleSignin.signIn();
  
  const { error } = await supabase.auth.signInWithIdToken({
    provider: 'google',
    token: idToken,
  });
  
  return { error };
}

export async function signInWithApple(): Promise<{ error?: Error }> {
  const credential = await AppleAuthentication.signInAsync({
    requestedScopes: [
      AppleAuthentication.AppleAuthenticationScope.EMAIL,
      AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
    ],
  });
  
  const { error } = await supabase.auth.signInWithIdToken({
    provider: 'apple',
    token: credential.identityToken!,
  });
  
  return { error };
}
```

### B4. Update login.tsx

Add Google and Apple buttons to the login screen:
- Import `signInWithGoogle`, `signInWithApple` from socialAuth
- Add "Continue with Google" and "Continue with Apple" buttons
- Handle success → navigate to home or personalise screen
- Handle errors → show alert

### B5. Create Account Linking in Settings

Add a new screen or update existing Account Info:
- Show current linked accounts (from `user_profiles.google_linked`, `apple_linked`)
- "Link Google" button → calls `supabase.auth.linkIdentity()` or native flow
- "Link Apple" button → same pattern
- "Unlink" buttons (with validation that user has at least one login method)

### B6. Add Password Creation Flow

For users who signed up with Google/Apple and want to add a password:
- Check `user_profiles.password_created`
- Show "Create Password" in Account Info if not set
- Form: New Password + Confirm
- Call `supabase.auth.updateUser({ password })`
- Update `password_created` in user_profiles

### B7. Testing Requirements

> [!CAUTION]
> Native authentication **does not work in Expo Go**. You must use a Development Build.

**Steps to test:**
1. Create EAS development build:
   ```bash
   eas build --profile development --platform ios
   ```
2. Install on physical device or simulator
3. Test flows:
   - Fresh Google sign-in
   - Fresh Apple sign-in
   - Link Google to existing password account
   - Link Apple to existing password account
   - Unlink (with validation)
   - Add password to OAuth-only account

---

## Implementation Order

| Step | Task | Blocked By |
|------|------|------------|
| 1 | User creates Google & Apple credentials in consoles | - |
| 2 | User configures Supabase OAuth providers | Step 1 |
| 3 | Install native SDKs | - |
| 4 | Configure app.json with client IDs | Step 1 |
| 5 | Create socialAuth.ts module | Steps 3, 4 |
| 6 | Add buttons to login.tsx | Step 5 |
| 7 | Create Account Linking UI | Step 5 |
| 8 | Add Password Creation flow | - |
| 9 | Build Development Build | Steps 3-7 |
| 10 | Test all flows | Step 9 |

---

## Files to Create/Modify

| File | Action |
|------|--------|
| `lib/socialAuth.ts` | **NEW** - Native Google/Apple auth functions |
| `app/(auth)/login.tsx` | **MODIFY** - Add social auth buttons |
| `app/(tabs)/settings/account-info.tsx` | **NEW** - Account linking UI |
| `app.json` | **MODIFY** - Add plugins and URL schemes |
| `package.json` | **MODIFY** - Add native SDKs |
| `lib/auth.tsx` | **MODIFY** - Add OAuth session handling |

---

## Summary

Once you complete the console setup (Part A), I can proceed with all engineering tasks (Part B). The critical path is:

1. **You:** Create Google OAuth clients (iOS + Android) + Apple Sign in with Apple key
2. **You:** Configure Supabase Authentication providers
3. **Me:** Install SDKs, configure app, implement auth flows
4. **Together:** Build and test Development Build
