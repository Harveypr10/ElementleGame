# Elementle - Daily Historical Date Puzzle Game

## Overview
Elementle is a daily puzzle game inspired by NYT Games and Duolingo, where players guess historical dates. It is a full-stack web application designed for daily engagement and educational entertainment, featuring a hamster mascot and color-coded feedback. The project aims to engage players daily with historical events through a fun puzzle format.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend
- **Framework & UI**: React with TypeScript, Vite, Wouter for routing, Shadcn UI (New York style) based on Radix UI, Tailwind CSS.
- **State Management**: TanStack Query for server state, local React state, LocalStorage for persistence.
- **Data Preloading**: `PreloadProvider` caches critical assets and data (settings, profile, stats, puzzles, subscriptions) for fast rendering.
- **UI/UX**: Custom color palette, responsive mobile-first design, Lottie animations for loading, and game-specific visual feedback.
- **Features**: Realtime UI updates via `useRealtimeSubscriptions`, navigation-based data refresh, intro screen for game info.
- **Loading System**: `SpinnerProvider` with a hamster wheel animation, including timeout/retry logic and data validation before completion.
- **Game Modes**: Supports Global and Local game modes with independent data handling. CRITICAL: Mode switching uses explicit `puzzleSourceMode` state to avoid race conditions with React's async state updates. The system fetches both global and local puzzles/attempts simultaneously and uses a pending navigation pattern (`pendingPlayMode`) to wait for data to load before navigating to PlayPage - ensuring `showCelebrationFirst` and `hasExistingProgress` are computed with correct data. See `handlePlayGlobal`/`handlePlayLocal` in Home.tsx.
- **Subscription UI**: Dynamic display of subscription tiers, renewal options, and allowances for Pro and Standard users.
- **Restriction System**: Cooldowns for location and category changes, managed by admin settings and implemented with React Query for robust client-side validation and UI feedback.
- **Streak & Holiday Protection**: UI for managing streak savers and Pro-only holiday protection.

### Backend
- **Framework**: Express.js with Node.js and TypeScript.
- **Data Storage**: Currently uses in-memory storage, designed for future PostgreSQL integration.
- **Session Management**: Configured for future PostgreSQL-backed session storage and authentication.

### Core Features
- **Game Logic**: Client-side puzzle validation, feedback calculation, LocalStorage-based statistics, 5-attempt limit with hints.
- **Authentication**: Direct email/password signup via Supabase, OTP for email changes, first login tracking (`first_login_completed` in user_metadata).
- **Pro Subscription**: Dynamic, database-driven subscription tiers with regional pricing, including API endpoints for status, tier display, checkout, auto-renew, and downgrade. Uses `user_profiles.user_tier_id` and `subscription_end_date` for fast lookup.
- **Question Regeneration**: Triggers an Edge Function to reset and reallocate questions based on user changes (postcode/category), with idempotency guards and timestamp updates upon completion.
- **Advertising**: `AdBanner` and `InterstitialAd` (Google AdMob), disabled for Pro subscribers.
- **Guest Mode**: Allows playing Global puzzles with restrictions on Personal mode and Archive, prompting registration.
- **Onboarding Flow**: New users see OnboardingScreen after SplashScreen with Play/Login/Subscribe buttons. Play shows interstitial ad first, then takes guests directly to today's Global puzzle using handlePlayGlobal (waits for data to load, skips IntroScreen). Authenticated users see WelcomePage → GameSelectionPage.
- **Guest Game Flow**: Guests play in 8-digit mode by default. After game ends, EndGameModal shows single "Continue" button (blue with white text) instead of Stats/Home/Archive. Clicking Continue goes to LoginPage with subtitle: "Sign up to track your stats, play personalised games and discover endless history in the archives."
- **Login Page**: New LoginPage component with dynamic email detection. Shows "Log in or create an account" initially, then:
  - CRITICAL: AuthPage personalise mode passes postcode/region directly to Home.tsx via onSuccess callback (stored in `personaliseData` state). This ensures GeneratingQuestionsScreen receives the correct postcode immediately, without waiting for profile refetch.
  - For existing users: "Welcome back" with password field and magic link option (60s cooldown for resend).
  - For new users: "Create your free account" with magic link option, password creation fields, and terms acceptance.
  - After account creation via password or magic link, redirects to "Personalise your game" screen (AuthPage in personalise mode) to set name/region/postcode before generating questions.
  - Uses `/api/auth/check-user` endpoint to verify user existence and password_created status. Magic link uses `supabase.auth.signInWithOtp()` with 5-minute expiry message.
- **iOS PWA Authentication**: iOS PWA has isolated storage from Safari, so magic links don't work in PWA context.
  - `isIosPwa()` helper in pwaContext.ts detects iOS PWA context (standalone mode + iOS user agent)
  - Magic link options are hidden for iOS PWA users in LoginPage (both login and signup flows)
  - Returning iOS PWA users without a password see "Set up a password" step that sends a password reset email via `/api/auth/send-password-reset` (secure - uses Supabase's built-in reset flow)
  - User sets password in Safari via reset link, then returns to PWA to log in with password
  - `/api/auth/set-password` requires authentication (verifySupabaseAuth) - only authenticated users can set their own password
- **Password Recovery Flow**: When user clicks password reset link from email:
  - SupabaseProvider detects `type=recovery` in URL and sets `isPasswordRecovery=true`
  - Home.tsx renders PasswordResetScreen when isPasswordRecovery is true
  - User enters new password, calls `supabase.auth.updateUser({ password })`
  - After success, `password_created` is updated in user_profiles, URL is cleaned up, and user is redirected to selection screen
  - `usePasswordRecovery()` hook exposes isPasswordRecovery state and clearPasswordRecovery function
- **Google OAuth Sign-In**: Users can sign in with Google via `signInWithOAuth` in LoginPage
  - SupabaseProvider listens for `SIGNED_IN` events and updates `signup_method` to "google" in user_profiles if not already set
  - AccountInfoPage shows Google connection status by checking `user.identities` and `user.app_metadata.providers`
  - Users can connect Google from Account Info if not already connected
- **Mandatory Personalise Screen**: Users CANNOT bypass the "Personalise your game" screen until they complete it and click "Generate Questions":
  - CRITICAL: `handleSplashComplete` checks `hasCompletedFirstLogin()` and redirects users without completed first login directly to "personalise" screen
  - A navigation guard in Home.tsx prevents access to protected screens (selection, play, stats, archive, settings, options, account-info) until `first_login_completed` is true in user_metadata
  - Guard includes a session-aware bypass: if `needsFirstLoginSetup=false && hasShownGeneratingScreen=true`, user just completed setup this session and shouldn't be redirected (handles async metadata update timing)
  - `markFirstLoginCompleted()` updates Supabase user_metadata after GeneratingQuestionsScreen completes
- **Session Persistence**: useAuth hook handles session persistence with:
  - Visibility change handler refreshes session when tab resumes focus (prevents stale sessions)
  - Auth state change listener updates user state on sign-in/sign-out events
  - Auth guard in Home.tsx redirects to OnboardingScreen if user is signed out while on protected screens
- **Sign-Out Flow**: Signing out navigates to OnboardingScreen and clears all cache:
  - `clearUserCache()` clears game progress, stats, puzzle-progress-*, guess-cache-*, Supabase session tokens (sb-*-auth-token), first-login tracking, and demand call keys
  - React Query cache is also cleared to prevent data leaks between users
  - `handleSignOutComplete` resets `needsFirstLoginSetup` and `hasShownGeneratingScreen` flags to prevent personalisation bypass
  - User will NOT be automatically logged back in on reload
- **Admin Panel**: For configuring postcode/region/category change restrictions and demand scheduler cron jobs.
- **Streak Saver System**: Allows users to protect streaks with tier-based allowances, with API for status and usage.
  - **Navigation**: Fetches yesterday's puzzle directly from API (`/api/puzzles/:date` or `/api/user/puzzles/:date`) via `handlePlayYesterdaysPuzzle` in Home.tsx, storing in `streakSaverPuzzle` state.
  - **Usage Tracking**: Streak saver is only consumed after puzzle played to conclusion (win or lose), not when popup clicked.
  - **Exit Behavior**: Exiting without completion triggers warning popup; confirming resets streak to 0 via decline API but does NOT consume streak saver.
  - **State Management**: `streakSaverPuzzle` cleared when navigating away from PlayPage to prevent stale navigation.
- **Holiday Protection System**: Pro-only feature to pause Local mode puzzles.
  - **streak_day_status values**: 0 = holiday day (streak protected), 1 = played day (streak continues), NULL = missed day (streak breaks)
  - **Exit Holiday Behavior**: When user exits holiday mode:
    - Previous dates with streak_day_status=0 remain protected even if replayed
    - Today's puzzle: Win sets streak_day_status=1, Loss sets streak_day_status=NULL (breaks streak), Not played keeps streak_day_status=0
  - **StreakSaver Popup Prevention**: Popup won't trigger if yesterday's puzzle has streak_day_status=0 (holiday) or 1 (played)
  - **Holiday Mode Activation from Popup**: When holiday mode is activated from first StreakSaver popup, second popup for other game mode is suppressed via `holidayJustActivated` flag
- **Badge System**: Achievement badges for milestones across three categories:
  - **Elementle In**: Awarded for winning in 1 or 2 guesses (checked immediately after each game)
  - **Streak**: Awarded for streak milestones (7, 14, 30, 50, 100, 150, 250, 365, 500, 750, 1000 days) (checked immediately after each game)
  - **Percentile (TOP %)**: Region-scoped rankings (Top 50%, 40%, 30%, 20%, 15%, 10%, 5%, 3%, 2%, 1%) - **Monthly cron job only**
    - A Supabase scheduled function runs monthly to calculate rankings and insert pending badges (is_awarded=false)
    - NOT checked after each game - only processed when GameSelectionPage loads
  - Badge celebration popup with Trophy.json Lottie animation after streak celebration
  - BadgesRow displays earned badges on Stats screen with hexagonal slots
  - **Pending Badge Processing**: GameSelectionPage checks for unawarded badges (isAwarded=false) on mount
    - Uses processedBadgeIds Set to track shown badges per session
    - Shows BadgeCelebrationPopup for each pending badge sequentially
    - On dismiss: marks badge as awarded, refetches pending lists, navigates to Stats
    - BadgeSlot animates (fade-in + grow) for newly awarded badges using Framer Motion
    - Error handling with toast notification and retry support

## External Dependencies

- **Database**: Drizzle ORM for PostgreSQL (`@neondatabase/serverless`), `drizzle-kit` for migrations.
- **UI Components**: Radix UI, Lucide React, cmdk, embla-carousel-react, date-fns.
- **Form Handling**: React Hook Form with Zod, drizzle-zod.
- **Authentication**: Supabase.
- **Advertising**: Google AdMob.
- **Animation**: Lottie (for hamster animation).