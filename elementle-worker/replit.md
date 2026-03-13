# Elementle Worker

## Overview
Node.js worker service that connects to Supabase and polls the `questions_to_generate` table for pending jobs. This service is designed to be deployed on Railway or similar container platforms.

## Recent Changes
- 2025-11-06: Initial project scaffolding
  - Created worker loop with Supabase integration
  - Added Docker support for containerized deployment
  - Configured package.json with @supabase/supabase-js dependency
  - Added comprehensive README with deployment instructions

## Project Architecture
- **Runtime**: Node.js 20
- **Database Client**: @supabase/supabase-js
- **Deployment**: Docker container (Railway-ready)
- **Configuration**: Environment variables for Supabase credentials

### Key Files
- `index.js`: Main worker loop that polls Supabase
- `package.json`: Dependencies and scripts
- `Dockerfile`: Container configuration
- `.env.example`: Required environment variables template
- `README.md`: Setup and deployment documentation

## Environment Variables Required
- `SUPABASE_URL`: Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY`: Service role key for backend access

## Current State
Worker scaffold is complete. The service polls for pending jobs every 5 seconds, logs job details, and includes graceful shutdown handling. Ready for deployment to Railway.
