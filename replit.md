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
- **Game Modes**: Supports Global and Local game modes with independent data handling. CRITICAL: Mode switching uses explicit `puzzleSourceMode` state to avoid race conditions with React's async state updates. The system fetches both global and local puzzles/attempts simultaneously and uses a pending navigation pattern (`pendingPlayMode`, `pendingYesterdayPuzzle`) to wait for data to load before navigating to PlayPage - ensuring `showCelebrationFirst` and `hasExistingProgress` are computed with correct data. See `handlePlayGlobal`/`handlePlayLocal` and `handlePlayYesterdaysPuzzle` in Home.tsx.
- **Subscription UI**: Dynamic display of subscription tiers, renewal options, and allowances for Pro and Standard users.
- **Restriction System**: Cooldowns for location and category changes, managed by admin settings and implemented with React Query for robust client-side validation and UI feedback.
- **Streak & Holiday Protection**: UI for managing streak savers and Pro-only holiday protection.

### Backend
- **Framework**: Express.js with Node.js and TypeScript.
- **Data Storage**: Currently uses in-memory storage, designed for future PostgreSQL integration.
- **Session Management**: Configured for future PostgreSQL-backed session storage and authentication.

### Core Features
- **Game Logic**: Client-side puzzle validation, feedback calculation, LocalStorage-based statistics, 5-attempt limit with hints.
- **Authentication**: Direct email/password signup via Supabase, OTP for email changes, first login tracking.
- **Pro Subscription**: Dynamic, database-driven subscription tiers with regional pricing, including API endpoints for status, tier display, checkout, auto-renew, and downgrade. Uses `user_profiles.user_tier_id` and `subscription_end_date` for fast lookup.
- **Question Regeneration**: Triggers an Edge Function to reset and reallocate questions based on user changes (postcode/category), with idempotency guards and timestamp updates upon completion.
- **Advertising**: `AdBanner` and `InterstitialAd` (Google AdMob), disabled for Pro subscribers.
- **Guest Mode**: Allows playing Global puzzles with restrictions on Personal mode and Archive, prompting registration.
- **Admin Panel**: For configuring postcode/region/category change restrictions and demand scheduler cron jobs.
- **Streak Saver System**: Allows users to protect streaks with tier-based allowances, with API for status and usage.
- **Holiday Protection System**: Pro-only feature to pause Local mode puzzles.
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