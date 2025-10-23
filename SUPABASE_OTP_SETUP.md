# Supabase OTP Configuration Guide

## ⚠️ Root Cause: Why You're Getting Magic Links Instead of OTP Codes

When using `signInWithOtp()` with `shouldCreateUser: true`, Supabase sends emails using the **"Magic Link"** template, **NOT** the "Confirm Signup" template.

You configured the "Confirm Signup" template with `{{ .Token }}`, but that template is only used by the old `signUp()` method, which we're no longer using.

## ✅ Solution: Configure the Magic Link Template

### Step 1: Update Magic Link Template in Supabase Dashboard

1. Go to your Supabase Dashboard
2. Navigate to **Authentication** → **Email Templates**
3. Select the **"Magic Link"** template
4. Replace `{{ .ConfirmationURL }}` with `{{ .Token }}`
5. Click **Save**

**Example OTP Email Template:**

```html
<h2>Your Verification Code</h2>
<p>Welcome to Elementle! Enter this code to verify your email:</p>
<h1 style="font-size: 32px; letter-spacing: 8px; font-family: monospace;">{{ .Token }}</h1>
<p>This code expires in 24 hours.</p>
<p>If you didn't request this code, you can safely ignore this email.</p>
```

### Step 2: Verify Your Code Implementation

Our code is **already correct**:

#### ✅ AuthPage.tsx (Line 85)
```typescript
await supabase.auth.signInWithOtp({
  email: formData.email,
  options: {
    shouldCreateUser: true,  // ✓ Creates user if doesn't exist
    // ✓ NO emailRedirectTo (would trigger magic link)
    data: {
      first_name: formData.firstName,
      last_name: formData.lastName,
    },
  },
});
```

#### ✅ OTPVerificationScreen.tsx (Line 115)
```typescript
await supabase.auth.verifyOtp({
  email,
  token: code,
  type: "email",  // ✓ Correct type for signInWithOtp
});
```

#### ✅ Resend Email (Line 177)
```typescript
await supabase.auth.signInWithOtp({
  email,
  options: {
    shouldCreateUser: type === "signup",
    // ✓ NO emailRedirectTo parameter
  },
});
```

### Step 3: Test the Flow

1. Open your browser's **Developer Console** (F12)
2. Go to the **Console** tab
3. Try signing up with a new email
4. Look for these log messages:

```
[AUTH] Calling signInWithOtp for signup with email: user@example.com
[AUTH] Parameters: { shouldCreateUser: true, emailRedirectTo: undefined }
[AUTH] signInWithOtp result: Success - check email for OTP code
```

5. Check your email - you should now receive a **6-digit OTP code** instead of a magic link
6. Enter the code and look for:

```
[OTP] Verifying OTP with type: email for email: user@example.com
[OTP] verifyOtp result: Success
```

### Step 4: Verify Environment Variables

Make sure your Replit environment is using the correct Supabase project:

1. Check that `SUPABASE_URL` and `SUPABASE_ANON_KEY` in your Replit Secrets match the Supabase project where you configured the Magic Link template
2. You can verify by checking the URL in the Supabase dashboard

## 📋 Checklist

- [ ] Updated **"Magic Link"** template (not "Confirm Signup") to use `{{ .Token }}`
- [ ] Saved the template changes in Supabase Dashboard
- [ ] Verified environment variables point to correct Supabase project
- [ ] Tested signup flow and checked browser console for debug logs
- [ ] Received OTP code (6 digits) instead of magic link in email
- [ ] Successfully verified OTP code

## 🔍 Debugging

If you're still receiving magic links after updating the template:

1. **Clear your browser cache** - Old email templates may be cached
2. **Wait 1-2 minutes** - Template changes may take a moment to propagate
3. **Check the correct project** - Verify your environment variables point to the project where you made the changes
4. **Inspect the email** - Look at the raw HTML source to confirm it contains `{{ .Token }}` not `{{ .ConfirmationURL }}`
5. **Check browser console** - The debug logs will show exactly what Supabase method is being called

## 📚 Official Documentation

- [Supabase signInWithOtp() Reference](https://supabase.com/docs/reference/javascript/auth-signinwithotp)
- [Supabase Email OTP Guide](https://supabase.com/docs/guides/auth/passwordless-login/auth-email-otp)
- [Email Templates Configuration](https://supabase.com/docs/guides/auth/auth-email-templates)

## ✨ What's Implemented

### Email OTP Flow
1. User fills signup form
2. `signInWithOtp({ email, shouldCreateUser: true })` sends OTP code
3. User receives **6-digit code** in email (via Magic Link template with `{{ .Token }}`)
4. User enters code in OTPVerificationScreen
5. `verifyOtp({ email, token, type: 'email' })` verifies the code
6. Password set via `updateUser({ password })`
7. User profile created in database

### SMS OTP Flow
1. User switches to SMS delivery
2. Enters phone number with country code
3. `signInWithOtp({ phone })` sends SMS OTP
4. User receives 6-digit code via SMS
5. Verification works the same way

### Security Features
- ✅ Password NEVER stored in user metadata
- ✅ Password only in local component state
- ✅ OTP codes expire after 24 hours
- ✅ Proper E.164 phone number formatting
- ✅ No magic link fallback

## 🎯 Next Steps

After configuring the Magic Link template:

1. Test the complete signup flow
2. Verify OTP codes are received via email
3. Test SMS OTP if needed
4. Remove debug console.log statements (optional - they don't affect production)
