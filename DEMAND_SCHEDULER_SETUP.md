# Demand Scheduler Setup

This document contains the setup instructions for the Demand Scheduler feature.

## 1. Database Table

Run this SQL in your Supabase SQL Editor to create the required table:

```sql
-- Create demand_scheduler_config table
create table if not exists public.demand_scheduler_config (
  id uuid primary key default gen_random_uuid(),
  start_time text not null, -- format 'HH:mm'
  frequency_hours integer not null check (frequency_hours > 0),
  updated_at timestamp with time zone default now(),
  updated_by uuid references user_profiles(id)
);

-- Insert default config (01:00 daily)
insert into public.demand_scheduler_config (start_time, frequency_hours)
values ('01:00', 24)
on conflict do nothing;

-- Grant access to authenticated users (admins will be checked in API)
alter table public.demand_scheduler_config enable row level security;

create policy "Allow admins to manage demand scheduler config"
  on public.demand_scheduler_config
  for all
  using (auth.jwt() ->> 'is_admin' = 'true')
  with check (auth.jwt() ->> 'is_admin' = 'true');

-- Allow service role full access
create policy "Allow service role full access"
  on public.demand_scheduler_config
  for all
  using (auth.role() = 'service_role');
```

## 2. Edge Function: update-demand-schedule

Create a new Edge Function in Supabase called `update-demand-schedule` with the following code:

### File: supabase/functions/update-demand-schedule/index.ts

```typescript
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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

    // Verify the user is an admin
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Verify JWT and check admin status
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid token' }),
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

    // Update the existing cron job 'elementle_demand'
    // This requires calling the cron.alter_job function
    const { data: updateResult, error: updateError } = await supabase.rpc(
      'update_demand_cron_schedule',
      { new_schedule: cronExpression }
    )

    if (updateError) {
      console.error('Error updating cron job:', updateError)
      
      // Try alternative approach using direct SQL
      const { error: sqlError } = await supabase.rpc('exec_sql', {
        sql_query: `
          SELECT cron.alter_job(
            job_id := (SELECT jobid FROM cron.job WHERE jobname = 'elementle_demand'),
            schedule := '${cronExpression}'
          )
        `
      })

      if (sqlError) {
        return new Response(
          JSON.stringify({ 
            error: 'Failed to update cron job',
            details: sqlError.message,
            cronExpression 
          }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
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

## 3. Database Function for Cron Update

Create this PostgreSQL function to allow updating the cron schedule:

```sql
-- Function to update the demand cron schedule
create or replace function update_demand_cron_schedule(new_schedule text)
returns void
language plpgsql
security definer
as $$
declare
  job_id bigint;
begin
  -- Find the job ID for elementle_demand
  select jobid into job_id
  from cron.job
  where jobname = 'elementle_demand';
  
  if job_id is null then
    raise exception 'Cron job elementle_demand not found';
  end if;
  
  -- Update the schedule
  perform cron.alter_job(job_id, schedule := new_schedule);
end;
$$;

-- Grant execute permission to service role
grant execute on function update_demand_cron_schedule(text) to service_role;
```

## 4. Usage

1. Navigate to Admin page in the app
2. In the "Demand Scheduler" section:
   - Set the **Start Time** (24-hour format, e.g., "01:00")
   - Set the **Frequency** (6, 12, or 24 hours)
3. Click "Save & Apply Schedule"
4. The preview will show the next 4 scheduled run times

## Cron Expression Examples

| Start Time | Frequency | Cron Expression |
|------------|-----------|-----------------|
| 01:00 | 24 hours | `0 1 * * *` (daily at 01:00) |
| 01:00 | 12 hours | `0 1,13 * * *` (at 01:00 and 13:00) |
| 01:00 | 6 hours | `0 1,7,13,19 * * *` (at 01:00, 07:00, 13:00, 19:00) |
| 00:30 | 8 hours | `30 0,8,16 * * *` (at 00:30, 08:30, 16:30) |
