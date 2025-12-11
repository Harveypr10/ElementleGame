# Elementle - Daily Historical Date Puzzle Game

## Overview
Elementle is a daily puzzle game inspired by NYT Games and Duolingo, where players guess historical dates. It is a full-stack web application designed for daily engagement and educational entertainment, featuring a hamster mascot and color-coded feedback. The project aims to engage players daily with historical events through a fun puzzle format, providing a blend of education and entertainment with market potential for broad appeal.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### UI/UX Decisions
The application features a responsive, mobile-first design with a custom color palette and a "New York" style UI derived from Shadcn UI. Lottie animations are used for loading and game-specific visual feedback, including a hamster wheel spinner. The UI provides dynamic displays for subscription tiers, real-time updates, and an intro screen.

### Technical Implementations
- **Frontend**: React with TypeScript, Vite, Wouter for routing. State management uses TanStack Query for server state and local React state with LocalStorage for persistence. A `PreloadProvider` caches critical data for fast rendering.
- **Backend**: Express.js with Node.js and TypeScript, currently using in-memory storage, designed for future PostgreSQL integration.
- **Game Modes**: Supports Global and Local game modes with independent data handling, ensuring proper data loading and state management to prevent race conditions during mode switching.
- **Authentication & User Management**: Direct email/password signup via Supabase, with OTP for email changes. Implements a comprehensive onboarding flow, Google OAuth sign-in, and specific handling for iOS PWA authentication challenges. Users are guided through a mandatory "Personalise your game" screen before accessing protected content. Session persistence is managed with a `useAuth` hook, including debounced auth guards and optimized session refreshing. Sign-out clears all caches and resets user-specific flags.
- **Subscription & Monetization**: Dynamic, database-driven Pro subscription tiers with regional pricing, including API endpoints for status, checkout, and renewal. Ad banners and interstitial ads are displayed for non-Pro users.
- **Game Mechanics**: Client-side puzzle validation, feedback calculation, and LocalStorage-based statistics. Features include a Streak Saver system with tier-based allowances and a Pro-only Holiday Protection system to pause local puzzles.
- **Badge System**: Achievements for milestones (Elementle In, Streak, Percentile) with a monthly cron job for percentile rankings. Badges are processed and celebrated via a dedicated popup and displayed on the Stats screen.
- **Restrictions**: Cooldowns for location and category changes managed by admin settings and implemented with React Query.

### System Design Choices
The architecture prioritizes client-side performance through data preloading and efficient state management. Authentication and user personalization are deeply integrated, ensuring a tailored experience. The system is designed for scalability with planned PostgreSQL integration and robust error handling for various user flows, including password recovery and OAuth linking. Modularity is emphasized through component-based UI development and clear separation of frontend and backend concerns.

## External Dependencies

- **Database**: Drizzle ORM for PostgreSQL (`@neondatabase/serverless`), `drizzle-kit`.
- **UI Components**: Radix UI, Lucide React, cmdk, embla-carousel-react, date-fns.
- **Form Handling**: React Hook Form with Zod, drizzle-zod.
- **Authentication**: Supabase.
- **Advertising**: Google AdMob.
- **Animation**: Lottie.