# Elementle - Daily Historical Date Puzzle Game

## Overview
Elementle is a daily puzzle game inspired by NYT Games and Duolingo, where players guess historical dates in DDMMYY format. The game features a hamster mascot, color-coded feedback, and focuses on engaging players daily with historical events. It is a full-stack web application with a React frontend and an Express backend, designed for daily engagement and educational entertainment.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework & Build System**: React 18 with TypeScript, Vite for fast HMR and optimized builds, Wouter for lightweight routing.
- **UI Component System**: Shadcn UI (New York style) based on Radix UI, Tailwind CSS for utility-first styling with custom design tokens, CSS Variables for theming (light/dark mode).
- **State Management**: TanStack Query for server state, local React state for UI state, LocalStorage for persisting game statistics and theme preferences.
- **Preload & Cache System**: A `PreloadProvider` preloads critical assets (hamster SVGs, icons) and prefetches data (settings, profile, stats, attempts, puzzles) on app mount. It uses `Promise.allSettled` for independent error handling, prioritizes cache-first rendering for instant loads, and performs background reconciliation to update data from Supabase. Cache keys are structured for various data types, and `clearUserCache()` handles logout.
- **Format Cache System**: `client/src/lib/formatCache.ts` provides instant localStorage caching for date format settings (region, digitPreference) to prevent visual "flipping" on page load. The `useProfile`, `useUserSettings`, and `useUserDateFormat` hooks automatically sync with this cache via their `onSuccess` callbacks. PlayPage includes a loading gate that prevents rendering until format data is ready, showing "Loading... Preparing your game" to ensure no format inconsistencies are visible to users. AccountInfoPage uses the hook's `updateProfile` function to guarantee automatic cache synchronization when settings change.
- **Design System**: Custom color palette for game feedback (correct/green, in-sequence/amber, not-in-sequence/grey), responsive design with a mobile-first approach, and game-specific visual feedback including directional arrows.

### Backend Architecture
- **Server Framework**: Express.js with Node.js (ES modules) and TypeScript.
- **Development & Production Setup**: Vite middleware for development, separate build processes for client and server (esbuild).
- **Data Storage Strategy**: Currently uses in-memory storage (`MemStorage`) with an `IStorage` interface for future database integration.
- **Session Management**: `connect-pg-simple` and Express session middleware are configured for future PostgreSQL-backed session storage and authentication.

### Application Structure
- **Page Organization**: Includes `WelcomePage`, `GameSelectionPage`, `PlayPage` (core game mechanics), `StatsPage`, and `ArchivePage`.
- **Shared Code**: Schema definitions in `shared/schema.ts` for type consistency, path aliases (`@shared`, `@/components`, etc.).
- **Game Logic**: Client-side puzzle validation, feedback calculation, LocalStorage-based statistics tracking (games played, won, streak, guess distribution), and a 5-attempt limit with directional hints.
- **Intro Screen (New Games)**: `IntroScreen` component displays when entering a new game with no guesses yet. Shows: Historian-Hamster-Blue.svg image, puzzle date formatted per user preference (DD/MM/YY → "25th November 2025", MM/DD/YY → "November 25, 2025"), clue prompt prefixed with category name when available ("History and World Events: On what date in history did this event occur?" when clues enabled, or "Take on the challenge of guessing a date in history!" when disabled) with event title below, and a centered Play button (50% width, reduced height) colored to match Global (#7DAAE8) or Local (#66becb) mode. Light grey background (bg-gray-100 dark:bg-gray-900). Clicking Play triggers fade transition to the game screen. Games with any guesses or completed games bypass intro and go directly to the game screen. Archive puzzles that haven't been attempted show intro; already-played archive puzzles go straight to game view.
- **Authentication & User Management**: Direct email/password signup using `supabase.auth.signUp` (no 2FA for signup). OTP verification is preserved only for email changes in AccountInfoPage for security. First login tracking uses Supabase user_metadata (`first_login_completed` flag) to trigger GeneratingQuestionsScreen on first sign-in. Consent fields (terms, ads) persistence has been fixed during signup and profile updates.
- **Pro Subscription System**: Three-tier Pro subscription (Bronze $3.99/mo, Silver $6.99/mo, Gold $9.99/mo) with ad removal and category selection features. Components: `GoProButton` (visible only for authenticated users in GameSelectionPage header), `ProSubscriptionDialog` (tier selection modal), `CategorySelectionScreen` (min 3 category picks), and `useSubscription` hook. **Subscription tier is stored in `user_profiles.tier` column** (values: 'standard' or 'pro'). The `/api/subscription` endpoint reads tier from user profile and maps 'pro' → 'bronze' for UI display. `useSubscription` hook determines `isPro = tier !== 'free'`. Go Pro button also available in Settings menu for all users.
- **Pro UI Design**: 
  - GoProButton shows just "Pro" (orange gradient background, white text) when user is Pro, or "Ads on / Go Pro" for non-Pro users
  - Settings menu Pro items have orange gradient backgrounds with white text
  - "Pro" button shows "Manage your subscription" inline (not below)
  - "Select Categories" button (replaces "Regenerate Questions") navigates to CategorySelectionScreen
  - Categories are fetched from `categories` table in Supabase (20 items, excludes id 999)
  - User category preferences stored in `user_category_preferences` table (links user_id to category_id)
- **Advertising System**: Banner ads via `AdBanner` component with Google AdMob test ID (ca-app-pub-3940256099942544/2435281174), fixed bottom positioning with z-index 90. All pages include pb-16 padding to accommodate. Interstitial ads via `InterstitialAd` component shown after archive puzzle completions with 5-second countdown, z-index 200 overlay. Pro subscribers have ads disabled.
- **Guest Mode & Restrictions**: 
  - Guest users (unauthenticated) can play Global puzzles using the `/api/puzzles/guest` endpoint (defaults to UK region).
  - Guests cannot swipe to Personal (Local) mode or access Archive - attempts trigger snap-back animation and `GuestRestrictionPopup` with hamster image and Register/Login buttons.
  - Mode toggle (`ModeToggle` component) has dynamic width based on label lengths, supports names up to 11 characters before reverting to "Personal", and uses cached profile for instant name display.
  - Options button visible for all users (guests and authenticated).
  - `GoProButton` shows "Ads on" (non-bold) and "Go Pro" (bold, larger) styling.
  - AuthPage styling uses light blue accent (#7DAAE8) for registration prompts.
- **Dual-Mode Architecture (Global vs Local)**: `GameSelectionPage` implements completely independent data fetching and rendering for Global (region-based) and Local (user-specific) panes. Each pane uses separate TanStack Query calls with authenticated fetching (`fetchAuthenticated` helper injects Supabase bearer tokens). Global pane queries: `/api/game-attempts/user`, `/api/stats`, `/api/stats/percentile` (region tables). Local pane queries: `/api/user/game-attempts/user`, `/api/user/stats`, `/api/user/stats/percentile` (user tables). Both panes independently compute play button status, intro messages, streaks, and percentiles with zero shared state or cross-contamination.
- **Archive Calendar**: The archive calendar dynamically calculates the earliest available month based on actual puzzle data (works for both Global and Local modes). The "Previous month" button becomes inactive when scrolled back to the earliest month containing playable puzzles. Date parsing is timezone-safe (manual string splitting to avoid UTC conversion issues).

## External Dependencies

- **Database**: Drizzle ORM configured for PostgreSQL, `@neondatabase/serverless` for serverless connections, schema defined in `shared/schema.ts`, and `drizzle-kit` for migrations.
- **UI Component Libraries**: Radix UI primitives, Lucide React for iconography, cmdk for command palette, embla-carousel-react for carousels, date-fns for date manipulation.
- **Development Tools**: Replit-specific Vite plugins for enhanced development, tsx for TypeScript execution, PostCSS with Tailwind CSS and Autoprefixer.
- **Form Handling & Validation**: React Hook Form with `@hookform/resolvers`, Zod for runtime type validation, drizzle-zod for database schema validation.
- **Asset Management**: Generated hamster character images in `attached_assets/generated_images/`, Vite's asset handling with `@assets` alias. PWA static assets (manifest, icons) are located in `client/public/` for root URL serving and iOS home screen support.