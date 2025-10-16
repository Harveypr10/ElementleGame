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