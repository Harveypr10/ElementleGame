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