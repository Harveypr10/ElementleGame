# Elementle - Daily Historical Date Puzzle Game

## Overview
Elementle is a daily puzzle game inspired by NYT Games and Duolingo, where players guess historical dates. It's a full-stack web application with a React frontend and an Express backend, designed for daily engagement and educational entertainment, featuring a hamster mascot and color-coded feedback. The project aims to engage players daily with historical events through a fun puzzle format.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework & Build System**: React 18 with TypeScript, Vite, Wouter for routing.
- **UI Component System**: Shadcn UI (New York style) based on Radix UI, Tailwind CSS, CSS Variables for theming.
- **State Management**: TanStack Query for server state, local React state for UI, LocalStorage for persistence.
- **Preload & Cache System**: `PreloadProvider` for critical assets and data (settings, profile, stats, attempts, puzzles, user categories), prioritizing cache-first rendering. Date format settings are instantly cached in LocalStorage.
- **Design System**: Custom color palette for game feedback, responsive design, mobile-first approach, and game-specific visual feedback.
- **Realtime Subscriptions**: `useRealtimeSubscriptions` hook for automatic UI refresh on database changes, refetching queries directly.
- **Navigation-Based Data Refresh**: Automatic puzzle data refetching on navigation, especially for new signups and archive pages.
- **Intro Screen**: Displays game information (formatted date, clue, event title) and a Play button for new games or unattempted archive puzzles.

### Backend Architecture
- **Server Framework**: Express.js with Node.js (ES modules) and TypeScript.
- **Data Storage Strategy**: Currently uses in-memory storage with an `IStorage` interface, designed for future database integration.
- **Session Management**: Configured for future PostgreSQL-backed session storage and authentication.

### Application Structure
- **Page Organization**: Includes `WelcomePage`, `GameSelectionPage`, `PlayPage`, `StatsPage`, and `ArchivePage`.
- **Shared Code**: Schema definitions for type consistency and path aliases.
- **Game Logic**: Client-side puzzle validation, feedback calculation, LocalStorage-based statistics, 5-attempt limit with directional hints.
- **Authentication & User Management**: Direct email/password signup via Supabase, OTP for email changes, first login tracking, and consent field persistence.
- **Pro Subscription System**: Dynamic database-driven subscription tiers with regional pricing, including components for managing subscriptions and category selection.
- **Pro UI Design**: Distinct UI elements for Pro users, including "Go Pro" buttons, orange gradients for premium features, and a dedicated "Select Categories" button.
- **Question Regeneration Workflow**: Triggers an Edge Function to reset and reallocate questions based on postcode or category changes, displaying a `GeneratingQuestionsScreen`.
- **Advertising System**: `AdBanner` for banner ads (Google AdMob) and `InterstitialAd` for interstitial ads after archive puzzle completions, disabled for Pro subscribers.
- **Guest Mode & Restrictions**: Guests can play Global puzzles but are restricted from Personal mode and Archive, prompted to register/login.
- **Dual-Mode Architecture (Global vs Local)**: Independent data fetching and rendering for Global and Local game modes using separate TanStack Query calls.
- **Archive Calendar**: Dynamically calculates earliest available month based on puzzle data, with timezone-safe date parsing and status matching by puzzle date.
- **Admin Panel**: Admin-only page for configuring postcode change restrictions and demand scheduler cron jobs.
- **Streak Saver System**: Allows users to protect their streaks when missing a day, with tier-based allowances, backend storage, and a `StreakSaverPopup` UI.
- **Holiday Protection System**: Pro-only feature to pause Local mode puzzles without losing streaks, managed via API endpoints and displaying a blocking overlay on `PlayPage`.
- **Subscription Management**: Dedicated screens for Pro and Standard users to view subscription details and allowances.
  - **ManageSubscriptionPage**: Full-screen page showing subscription tier, renewal date (for non-lifetime), streak saver/holiday allowances with usage tracking, and auto-renewal toggle for Pro users.
  - **Pro User Flow**: Settings menu "Pro - Manage your subscription" button navigates to ManageSubscriptionPage showing tier name (Pro - Monthly/Annual/Lifetime), renewal date, allowances remaining, and auto-renewal toggle.
  - **Standard User Flow**: Settings menu shows "Go Pro" button plus "Streak Saver" menu item below it. Both navigate to ManageSubscriptionPage showing Standard tier view with current allowances (1 streak saver, 0 holidays) and "Go Pro to increase your allowances" upgrade button.
  - **Auto-Renewal Toggle**: Pro users can toggle auto-renewal on/off. Turning off shows warning popup listing all Pro benefits that will be lost (ad-free, custom categories, streak savers, holidays, personal mode).
  - **API Endpoint**: `POST /api/subscription/auto-renew` updates `auto_renew` flag in `user_subscriptions` table.

## External Dependencies

- **Database**: Drizzle ORM configured for PostgreSQL (`@neondatabase/serverless`), `drizzle-kit` for migrations.
- **UI Component Libraries**: Radix UI, Lucide React, cmdk, embla-carousel-react, date-fns.
- **Development Tools**: Replit-specific Vite plugins, tsx, PostCSS with Tailwind CSS and Autoprefixer.
- **Form Handling & Validation**: React Hook Form with Zod, drizzle-zod.
- **Asset Management**: Generated hamster character images, Vite's asset handling, PWA static assets.