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
- **Authentication & User Management**: OTP verification has replaced email link verification for signup and email changes. The signup flow uses `supabase.auth.signInWithOtp`, and `auth.updateUser({ password })` for password setting. A country code selector is implemented for SMS OTP, along with E.164 parsing. Consent fields (terms, ads) persistence has been fixed during signup and profile updates.
- **Dual-Mode Architecture (Global vs Local)**: `GameSelectionPage` implements completely independent data fetching and rendering for Global (region-based) and Local (user-specific) panes. Each pane uses separate TanStack Query calls with authenticated fetching (`fetchAuthenticated` helper injects Supabase bearer tokens). Global pane queries: `/api/game-attempts/user`, `/api/stats`, `/api/stats/percentile` (region tables). Local pane queries: `/api/user/game-attempts/user`, `/api/user/stats`, `/api/user/stats/percentile` (user tables). Both panes independently compute play button status, intro messages, streaks, and percentiles with zero shared state or cross-contamination.

## External Dependencies

- **Database**: Drizzle ORM configured for PostgreSQL, `@neondatabase/serverless` for serverless connections, schema defined in `shared/schema.ts`, and `drizzle-kit` for migrations.
- **UI Component Libraries**: Radix UI primitives, Lucide React for iconography, cmdk for command palette, embla-carousel-react for carousels, date-fns for date manipulation.
- **Development Tools**: Replit-specific Vite plugins for enhanced development, tsx for TypeScript execution, PostCSS with Tailwind CSS and Autoprefixer.
- **Form Handling & Validation**: React Hook Form with `@hookform/resolvers`, Zod for runtime type validation, drizzle-zod for database schema validation.
- **Asset Management**: Generated hamster character images in `attached_assets/generated_images/`, Vite's asset handling with `@assets` alias. PWA static assets (manifest, icons) are located in `client/public/` for root URL serving and iOS home screen support.