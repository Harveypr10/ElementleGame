# Elementle - Daily Historical Date Puzzle Game

## Overview

Elementle is a daily puzzle game where players guess historical dates in DDMMYY format. Drawing inspiration from NYT Games (Wordle, Connections) for clean puzzle mechanics and Duolingo's playful character-driven personality, the game features a hamster mascot and provides color-coded feedback to guide players toward discovering famous historical events.

The application is built as a full-stack web application with a React frontend and Express backend, designed for daily engagement with historical date puzzles.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

**Framework & Build System**
- React 18 with TypeScript for type-safe component development
- Vite as the build tool and development server for fast HMR and optimized production builds
- Wouter for lightweight client-side routing

**UI Component System**
- Shadcn UI component library (New York style variant) built on Radix UI primitives
- Tailwind CSS for utility-first styling with custom design tokens
- CSS Variables-based theming system supporting light and dark modes
- Component aliases configured via TypeScript path mapping (@/components, @/lib, @/hooks)

**State Management**
- TanStack Query (React Query) for server state management and caching
- Local React state (useState, useEffect) for component-level UI state
- LocalStorage for persisting game statistics and theme preferences

**Preload & Cache System** (Added October 2025)
- PreloadProvider wraps the entire application and runs on mount to preload critical assets and data
- Image preloading: All hamster SVGs, tick/cross icons loaded before first render
- Data prefetching: Uses Promise.allSettled to fetch settings, profile, stats, attempts, and puzzles in parallel
- Independent error handling: One failed fetch (e.g., 401 from /api/settings) doesn't prevent other caches from populating
- Cache-first rendering: All pages read from localStorage cache first for instant, flicker-free loads
- Background reconciliation: After showing cached data, pages fetch fresh data from Supabase and update cache
- Automatic cache updates: All mutations update both TanStack Query cache and localStorage
- Cache keys: cached-settings, cached-profile, cached-stats, cached-attempts, cached-today-outcome, cached-archive-YYYY-MM
- Logout flow: Clears user-specific caches via clearUserCache() utility function

**Design System**
- Custom color palette defined in CSS variables for game feedback states (correct/green, in-sequence/amber, not-in-sequence/grey)
- Responsive design with mobile-first approach
- Game-specific visual feedback using color-coded cells and directional arrows

### Backend Architecture

**Server Framework**
- Express.js for HTTP server and API routing
- Node.js with ES modules (type: "module")
- TypeScript for type safety across the stack

**Development & Production Setup**
- Vite middleware integration in development mode for SSR-style development experience
- Separate build process for client (Vite) and server (esbuild)
- Custom logging middleware for API request tracking

**Data Storage Strategy**
- In-memory storage implementation (MemStorage class) for current development phase
- Storage interface (IStorage) designed for future database integration
- Hardcoded puzzle data currently stored in client-side Home component

**Session Management**
- connect-pg-simple for future PostgreSQL-backed session storage
- Express session middleware ready for authentication implementation

### External Dependencies

**Database (Configured but Not Yet Used)**
- Drizzle ORM configured for PostgreSQL
- @neondatabase/serverless for serverless Postgres connections
- Schema defined in shared/schema.ts (users table with authentication fields)
- Migration system configured via drizzle-kit

**UI Component Libraries**
- Radix UI primitives (25+ components) for accessible, unstyled base components
- Lucide React for iconography
- cmdk for command palette functionality
- embla-carousel-react for carousel components
- date-fns for date manipulation and formatting

**Development Tools**
- Replit-specific plugins (@replit/vite-plugin-runtime-error-modal, @replit/vite-plugin-cartographer, @replit/vite-plugin-dev-banner) for enhanced development experience
- tsx for TypeScript execution in development
- PostCSS with Tailwind CSS and Autoprefixer for CSS processing

**Form Handling & Validation**
- React Hook Form with @hookform/resolvers for form state management
- Zod for runtime type validation
- drizzle-zod for database schema validation

**Asset Management**
- Generated hamster character images stored in attached_assets/generated_images/
- Images imported via Vite's asset handling system with @assets alias
- **PWA Static Assets** (October 25, 2025):
  - PWA manifest and icons stored in `client/public/` directory
  - Files in `client/public/` are served at root URL without fingerprinting
  - Includes: manifest.json, Icon-180.png, Icon-192.png, Icon-512.png
  - Essential for iOS Safari home screen app icon support
  - Vite automatically copies these to build output during production builds

### Application Structure

**Page Organization**
- WelcomePage: Initial landing with authentication placeholders
- GameSelectionPage: Main menu for accessing play, stats, and archive
- PlayPage: Core game mechanics with input grid and keyboard
- StatsPage: Player statistics and game distribution visualization
- ArchivePage: Access to previous puzzles

**Shared Code**
- Schema definitions in shared/schema.ts for type consistency between client and server
- Path aliases configured for clean imports (@shared, @/components, @/lib, @/hooks)

**Game Logic**
- Client-side puzzle validation and feedback calculation
- LocalStorage-based statistics tracking (games played, won, streak, guess distribution)
- 5-attempt limit per puzzle with directional hints for incorrect digits

## Recent Changes (October 25, 2025)

**Personalized Welcome Messaging on GameSelectionPage**
- Implemented time-based greeting system using local browser time:
  - "Good morning" (05:00-11:59)
  - "Good afternoon" (12:00-17:59)
  - "Good evening" (18:00-04:59)
- Personalized greeting includes user's first name from profile
- Conditional messaging based on daily play status:
  - **Before playing**: Shows streak encouragement with current streak count (e.g., "You're on a 3-day streak! Keep it going!")
  - **After playing**: Shows percentile ranking among all players (e.g., "You've beaten 85.7% of all players!")
- Created new API endpoint `GET /api/stats/percentile` that calculates user ranking:
  - Percentile = (users_with_fewer_wins / total_users) × 100
  - Protected by Supabase authentication
  - Returns JSON: `{percentile: number}`
- Fixed authentication on stats API calls by including `Authorization: Bearer {token}` header
- Uses `getSupabaseClient()` from `client/src/lib/supabaseClient.ts` to retrieve session tokens
- Greeting only displays for authenticated users
- Streak detection uses puzzle's actual date property, not navigation path

## Recent Changes (October 23, 2025)

**Consent Fields Persistence Fix**
- Fixed critical bug where user consent flags and timestamps were not persisting during signup
- Root cause: Drizzle ORM received timestamp strings instead of Date objects, causing "toISOString is not a function" error
- Solutions implemented:
  1. Updated POST `/api/auth/signup` to extract and persist consent fields from request body
  2. Modified PATCH `/api/auth/profile` to convert existing timestamp strings to Date objects before passing to Drizzle
  3. Set audit timestamps (`accepted_terms_at`, `ads_consent_updated_at`) immediately when consents are accepted
  4. Aligned naming convention: Backend now accepts camelCase (`acceptedTerms`, `adsConsent`) from frontend, maps internally to snake_case DB columns
  5. **Client-side auth fix**: Added Supabase Authorization header to `patchProfile` function in `useProfile.ts` (was getting 401 Unauthorized)
- Both signup and profile update flows now correctly persist consent preferences to database
- PrivacyPage ads consent toggle now works correctly without "Failed to update profile" errors
- See `CONSENT_FIELDS_FIX_SUMMARY.md` and `CLIENT_SIDE_AUTH_FIX.md` for detailed technical documentation

**7 UX Improvements Implemented**
1. **OTP Verification Screen**: Changed from center to top alignment (pt-8) for better mobile keyboard visibility
2. **Signup Form Field Progression**: Implemented Enter key navigation across all fields using refs
3. **Password Visibility Toggle**: Created unified PasswordInput component for Safari mobile compatibility
4. **Toast Notifications**: Moved from top-0 to bottom-0 to prevent keyboard occlusion during signup
5. **GameSelection Auto-Focus**: Play button automatically receives focus on page load for better accessibility
6. **Streak Logic**: Fixed to only count puzzles completed on their actual date (not archive puzzles played later)
7. **Bug Report & Feedback Forms**: Split Support into two separate forms with mailto: links (functional without backend email service)

## Recent Changes (October 2025)

**Preload & Local Cache System Implementation**
- Created `client/src/lib/localCache.ts` utility with type-safe localStorage access (readLocal, writeLocal, clearUserCache)
- Created `client/src/lib/PreloadProvider.tsx` that preloads all images and prefetches data on app mount
- Updated all major pages (GameSelectionPage, OptionsPage, StatsPage, ArchivePage, PlayPage) to read from cache first
- Implemented background reconciliation pattern: cache → render → fetch → reconcile → update cache
- Fixed critical bug using Promise.allSettled to ensure independent error handling for each prefetch
- Archive page now caches data by month with pattern: cached-archive-YYYY-MM
- PlayPage writes today's outcome to cache on game completion (only for non-archive puzzles)
- SettingsPage clears user-specific caches on logout

**Benefits**
- Instant, flicker-free page loads by showing cached data immediately
- Resilient to partial fetch failures (e.g., 401 responses during auth warm-up)
- Reduced network requests and improved perceived performance
- Seamless offline-to-online transitions with background reconciliation

**In-Progress Game Loading Fix (October 23, 2025)**
- Fixed critical authentication issue where PlayPage couldn't load guesses for in-progress games (result = NULL)
- Root cause: PlayPage was calling `/api/guesses/all` with `fetch()` directly without the Supabase Authorization header
- Solution: Import `getSupabaseClient`, retrieve session token, and include `Authorization: Bearer {token}` header
- In-progress games now correctly load all saved guesses when users click on them from the Archive
- Archive status display already working correctly - shows blue background with guess count for in-progress games

**OTP Verification System (October 23, 2025)**

1. **Replaced Email Link Verification with OTP**
   - Removed `emailVerified` field from database schema and all UI components
   - Created `OTPVerificationScreen` component with 6-digit code input
   - Supports both email and SMS delivery options with toggle
   - Includes resend button with 15-second cooldown timer
   - Cancel button returns to previous screen without saving changes

2. **Sign-up Flow with OTP (Fixed October 23, 2025)**
   - Uses `supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: true } })` to send 6-digit email codes
   - Password is NEVER stored in user metadata (security fix)
   - After OTP verification, sets password via `auth.updateUser({ password })` from local component state
   - Creates user profile in database via PATCH `/api/auth/profile`
   - On cancel, no account is created - user returns to signup form with data intact
   - Verification type: `type: 'email'` for signInWithOtp-based signup

3. **Country Code Selector for SMS (Added October 23, 2025)**
   - Added country code dropdown with 10 common countries (UK, US, France, Germany, Spain, Italy, Australia, India, China, Japan)
   - Defaults to +44 (United Kingdom)
   - User enters local phone number without country code prefix
   - Automatically removes leading zeros from local numbers
   - Intelligent E.164 phone number parsing:
     - Matches against known country codes first
     - Falls back to dynamic regex extraction for unlisted countries: `/^(\+\d{1,3})(\d+)$/`
     - Preserves arbitrary international prefixes (e.g., +353 for Ireland)
     - Prevents country code duplication when resending SMS
   - Full E.164 format constructed: `${countryCode}${cleanedLocalNumber}`
   - Clear instructions: "Enter your local number without the country code. For UK numbers, omit the leading 0."

4. **Email Change Flow with OTP**
   - Uses `supabase.auth.updateUser({ email })` to initiate email change
   - Supabase sends OTP to new email address
   - User verifies code in OTPVerificationScreen
   - After verification, email updated in both Supabase Auth and database
   - On cancel, email resets to original value

5. **Archive Access**
   - Removed all email verification checks
   - Archive now accessible to all authenticated users immediately after signup
   - Simplified user experience without verification gating

6. **Password Visibility Toggle (Safari Mobile Fix)**
   - Created `PasswordInput` component with Eye/EyeOff toggle button
   - Replaced all password Input fields in AuthPage and AccountInfoPage
   - Resolves Safari mobile compatibility issues with password visibility

7. **Sound Toggle Functionality**
   - Added `soundManager.setEnabled()` calls throughout OptionsPage:
     - Cache load useEffect
     - Supabase/localStorage reconciliation useEffect
     - `handleSoundsToggle` function
   - Sound effects now properly mute/unmute when user toggles the switch