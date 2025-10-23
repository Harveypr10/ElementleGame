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

2. **Sign-up Flow with OTP**
   - Uses `supabase.auth.signUp()` to create pending user and send OTP code
   - User enters verification code in OTPVerificationScreen
   - After successful verification, creates user profile in database via PATCH `/api/auth/profile`
   - On cancel, no account is created - user returns to signup form with data intact
   - Removed email link sending from server `/api/auth/signup` endpoint

3. **Email Change Flow with OTP**
   - Uses `supabase.auth.updateUser({ email })` to initiate email change
   - Supabase sends OTP to new email address
   - User verifies code in OTPVerificationScreen
   - After verification, email updated in both Supabase Auth and database
   - On cancel, email resets to original value

4. **Archive Access**
   - Removed all email verification checks
   - Archive now accessible to all authenticated users immediately after signup
   - Simplified user experience without verification gating

5. **Password Visibility Toggle (Safari Mobile Fix)**
   - Created `PasswordInput` component with Eye/EyeOff toggle button
   - Replaced all password Input fields in AuthPage and AccountInfoPage
   - Resolves Safari mobile compatibility issues with password visibility

6. **Sound Toggle Functionality**
   - Added `soundManager.setEnabled()` calls throughout OptionsPage:
     - Cache load useEffect
     - Supabase/localStorage reconciliation useEffect
     - `handleSoundsToggle` function
   - Sound effects now properly mute/unmute when user toggles the switch