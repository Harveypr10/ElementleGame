# Elementle Worker

This is the Elementle question generation worker service. It connects to Supabase and polls the `questions_to_generate` table for pending jobs, processes them, and updates their status.

## Architecture

The worker runs as a continuous service that:
1. Connects to Supabase using the service role key
2. Polls the `questions_to_generate` table for pending jobs
3. Processes one job at a time
4. Sleeps when no jobs are found to avoid excessive polling

## Prerequisites

- Node.js 20 or higher
- A Supabase project with a `questions_to_generate` table
- Supabase service role key (for backend access)

## Environment Variables

The following environment variables are required:

- `SUPABASE_URL`: Your Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY`: Your Supabase service role key (not the anon key)

Copy `.env.example` to `.env` and fill in your values:

```bash
cp .env.example .env
```

## Running Locally

1. Install dependencies:
```bash
npm install
```

2. Set up your environment variables in a `.env` file or export them:
```bash
export SUPABASE_URL=your-supabase-url
export SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

3. Start the worker:
```bash
npm start
```

The worker will begin polling for jobs and log its activity to the console.

## Docker

Build the Docker image:
```bash
docker build -t elementle-worker .
```

Run the container with environment variables:
```bash
docker run -e SUPABASE_URL=your-url -e SUPABASE_SERVICE_ROLE_KEY=your-key elementle-worker
```

## Deployment

This service is designed to be deployed on Railway or similar container platforms:

1. Push the code to GitHub
2. Connect your GitHub repository to Railway
3. Set the required environment variables in Railway's dashboard
4. Deploy

Railway will automatically detect the Dockerfile and build the container.

## Project Structure

```
elementle-worker/
├── index.js              # Main worker loop
├── package.json          # Node.js dependencies and scripts
├── Dockerfile            # Container configuration
├── .env.example          # Example environment variables
└── README.md             # This file
```

## How It Works

The worker continuously:
1. Queries Supabase for pending jobs in the `questions_to_generate` table
2. Fetches one job at a time
3. Logs the job details (processing logic to be implemented)
4. Sleeps for 5 seconds if no jobs are found
5. Repeats the cycle

## Development Notes

- The worker uses the `@supabase/supabase-js` client library
- Graceful shutdown is handled for SIGTERM and SIGINT signals
- Error handling is implemented for database connection issues
- The poll interval is set to 5 seconds to balance responsiveness and database load
