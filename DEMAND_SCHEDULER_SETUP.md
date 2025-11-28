# Demand Scheduler Setup

This document contains the setup instructions for the Demand Scheduler feature in the Admin Panel.

## Prerequisites

Ensure these environment variables are set in your Replit project (they should already exist if Supabase is configured):
- `SUPABASE_URL` - Your Supabase project URL
- `SUPABASE_ANON_KEY` - Your Supabase anonymous key
- `SUPABASE_SERVICE_ROLE_KEY` - Your Supabase service role key (for Edge Function)

## 1. Database Table

Run this SQL in your Supabase SQL Editor to create the required table:

```sql
-- Create demand_scheduler_config table (singleton - only ONE row should ever exist)
CREATE TABLE IF NOT EXISTS public.demand_scheduler_config (
  id uuid PRIMARY KEY,
  start_time text NOT NULL, -- format 'HH:mm'
  frequency_hours integer NOT NULL CHECK (frequency_hours > 0),
  updated_at timestamp with time zone DEFAULT now(),
  updated_by uuid REFERENCES user_profiles(id)
);

-- Insert the singleton config with a fixed ID (01:00 daily default)
-- The app always uses this fixed ID for upserts
INSERT INTO public.demand_scheduler_config (id, start_time, frequency_hours)
VALUES ('00000000-0000-0000-0000-000000000001', '01:00', 24)
ON CONFLICT (id) DO NOTHING;

-- Grant access to authenticated users (admins will be checked in API)
ALTER TABLE public.demand_scheduler_config ENABLE ROW LEVEL SECURITY;

-- Policy for admins to manage demand scheduler config
CREATE POLICY "Allow admins to manage demand scheduler config"
  ON public.demand_scheduler_config
  FOR ALL
  USING (auth.jwt() ->> 'is_admin' = 'true')
  WITH CHECK (auth.jwt() ->> 'is_admin' = 'true');

-- Allow service role full access (needed for Edge Function)
CREATE POLICY "Allow service role full access"
  ON public.demand_scheduler_config
  FOR ALL
  USING (auth.role() = 'service_role');
```

### Cleanup: If you have duplicate rows

If you already created the table and have multiple rows, run this to clean up:

```sql
-- Step 1: Delete all rows except keep the most recent one
DELETE FROM demand_scheduler_config
WHERE id NOT IN (
  SELECT id FROM demand_scheduler_config 
  ORDER BY updated_at DESC 
  LIMIT 1
);

-- Step 2: Update the remaining row to use the singleton ID
UPDATE demand_scheduler_config
SET id = '00000000-0000-0000-0000-000000000001'
WHERE id != '00000000-0000-0000-0000-000000000001';

-- Verify: Should show exactly 1 row with the singleton ID
SELECT * FROM demand_scheduler_config;
```

## 2. Database Function for Cron Update

Create this PostgreSQL function to allow updating the cron schedule. This must be created before deploying the Edge Function:

```sql
-- Function to update the demand cron schedule
-- This function uses SECURITY DEFINER to run with elevated privileges
CREATE OR REPLACE FUNCTION update_demand_cron_schedule(new_schedule text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  job_id bigint;
BEGIN
  -- Find the job ID for elementle_demand
  SELECT jobid INTO job_id
  FROM cron.job
  WHERE jobname = 'elementle_demand';
  
  IF job_id IS NULL THEN
    RAISE EXCEPTION 'Cron job elementle_demand not found. Please ensure the cron job exists.';
  END IF;
  
  -- Update the schedule
  PERFORM cron.alter_job(job_id, schedule := new_schedule);
END;
$$;

-- Grant execute permission to service role
GRANT EXECUTE ON FUNCTION update_demand_cron_schedule(text) TO service_role;
```

## 3. Edge Function: update-demand-schedule

Create a new Edge Function in Supabase called `update-demand-schedule`.

### Deployment Steps:
1. Go to Supabase Dashboard > Edge Functions
2. Click "New Function"
3. Name it `update-demand-schedule`
4. Paste the code below and deploy

### File: supabase/functions/update-demand-schedule/index.ts

```typescript
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-user-access-token',
}

interface SchedulerConfig {
  id: string
  start_time: string
  frequency_hours: number
}

function calculateCronExpression(startTime: string, frequencyHours: number): string {
  const [hours, minutes] = startTime.split(':').map(Number)
  
  if (frequencyHours === 24) {
    // Daily at the specified time
    return `${minutes} ${hours} * * *`
  }
  
  // Calculate all run hours based on start time and frequency
  const runHours: number[] = []
  let currentHour = hours
  
  for (let i = 0; i < Math.floor(24 / frequencyHours); i++) {
    runHours.push(currentHour)
    currentHour = (currentHour + frequencyHours) % 24
  }
  
  // Sort hours and format as comma-separated list
  runHours.sort((a, b) => a - b)
  
  return `${minutes} ${runHours.join(',')} * * *`
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Initialize Supabase client with service role for cron job management
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Get the user access token from custom header (passed from backend)
    // The backend authenticates with anon key, but passes user token for admin verification
    const userAccessToken = req.headers.get('x-user-access-token')
    
    if (!userAccessToken) {
      return new Response(
        JSON.stringify({ error: 'Missing user access token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Verify the user token and check admin status
    const { data: { user }, error: authError } = await supabase.auth.getUser(userAccessToken)
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid user token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check if user is admin
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('is_admin')
      .eq('id', user.id)
      .single()

    if (profileError || !profile?.is_admin) {
      return new Response(
        JSON.stringify({ error: 'Admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Fetch the current scheduler config
    const { data: config, error: configError } = await supabase
      .from('demand_scheduler_config')
      .select('*')
      .single()

    if (configError || !config) {
      return new Response(
        JSON.stringify({ error: 'No scheduler config found', details: configError?.message }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const typedConfig = config as SchedulerConfig
    
    // Calculate the new cron expression
    const cronExpression = calculateCronExpression(
      typedConfig.start_time,
      typedConfig.frequency_hours
    )

    console.log(`Updating cron job with expression: ${cronExpression}`)

    // Update the existing cron job 'elementle_demand' using the RPC function
    const { error: updateError } = await supabase.rpc(
      'update_demand_cron_schedule',
      { new_schedule: cronExpression }
    )

    if (updateError) {
      console.error('Error updating cron job:', updateError)
      return new Response(
        JSON.stringify({ 
          error: 'Failed to update cron job',
          details: updateError.message,
          cronExpression 
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Cron job updated successfully',
        cronExpression,
        startTime: typedConfig.start_time,
        frequencyHours: typedConfig.frequency_hours
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error in update-demand-schedule:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
```

## 4. Ensure Cron Job Exists

Before using the scheduler, ensure the `elementle_demand` cron job exists in Supabase. This should already be set up, but you can verify with:

```sql
SELECT * FROM cron.job WHERE jobname = 'elementle_demand';
```

If it doesn't exist, create it:

```sql
SELECT cron.schedule(
  'elementle_demand',
  '0 1 * * *', -- Default: daily at 01:00 UTC
  $$SELECT net.http_post(
    url := 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/calculate-demand',
    headers := '{"Authorization": "Bearer YOUR_SERVICE_ROLE_KEY"}'::jsonb,
    body := '{}'::jsonb
  )$$
);
```

## 5. Usage

1. Navigate to Admin page in the app (Settings > Admin, visible only to admins)
2. In the "Demand Scheduler" section:
   - Set the **Start Time** (24-hour format, e.g., "01:00")
   - Set the **Frequency** (6, 8, 12, or 24 hours)
3. Click "Save & Apply Schedule"
4. The preview will show the next 4 scheduled run times

## Cron Expression Examples

| Start Time | Frequency | Cron Expression |
|------------|-----------|-----------------|
| 01:00 | 24 hours | `0 1 * * *` (daily at 01:00) |
| 01:00 | 12 hours | `0 1,13 * * *` (at 01:00 and 13:00) |
| 01:00 | 6 hours | `0 1,7,13,19 * * *` (at 01:00, 07:00, 13:00, 19:00) |
| 00:30 | 8 hours | `30 0,8,16 * * *` (at 00:30, 08:30, 16:30) |

## Troubleshooting

### "Cron job elementle_demand not found" error
This means the cron job hasn't been created yet. Follow step 4 above to create it.

### "No scheduler config found" error
Run the SQL in step 1 to create the config table and insert a default row.

### Edge Function returns 401
Ensure the backend is passing the user access token via the `x-user-access-token` header. Check that `SUPABASE_ANON_KEY` and `SUPABASE_URL` are set in your environment.

### Edge Function returns 403
The user making the request is not an admin. Verify `is_admin` is set to `true` in the `user_profiles` table for that user.
