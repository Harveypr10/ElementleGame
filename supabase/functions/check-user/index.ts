import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
    // Handle CORS preflight requests
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const url = new URL(req.url)
        const email = url.searchParams.get('email')

        if (!email) {
            return new Response(
                JSON.stringify({ error: 'Email parameter is required' }),
                {
                    status: 400,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                }
            )
        }

        // Create Supabase client with service role to bypass RLS
        const supabaseAdmin = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
            {
                auth: {
                    autoRefreshToken: false,
                    persistSession: false
                }
            }
        )

        // Query user_profiles table (same as web app's /api/auth/check-user)
        const { data: profile, error: profileError } = await supabaseAdmin
            .from('user_profiles')
            .select('id, email, password_created, google_linked, apple_linked, magic_link')
            .eq('email', email.trim().toLowerCase())
            .single()

        if (profileError) {
            console.log('[check-user] Query error:', profileError.message)
        }

        if (profileError || !profile) {
            // User doesn't exist in user_profiles
            console.log('[check-user] User not found:', email)
            return new Response(
                JSON.stringify({
                    exists: false,
                    hasPassword: false,
                    magicLinkEnabled: false,
                    googleLinked: false,
                    appleLinked: false,
                }),
                {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                }
            )
        }

        // User exists - return their auth configuration
        const hasPassword = profile.password_created === true
        const googleLinked = profile.google_linked === true
        const appleLinked = profile.apple_linked === true

        // Read magic_link from database, default to true if not set
        const magicLinkEnabled = profile.magic_link !== false

        console.log('[check-user] User found:', email, {
            hasPassword,
            magicLinkEnabled,
            googleLinked,
            appleLinked
        })

        return new Response(
            JSON.stringify({
                exists: true,
                hasPassword,
                magicLinkEnabled,
                googleLinked,
                appleLinked,
            }),
            {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            }
        )
    } catch (error) {
        console.error('[check-user] Error:', error)
        return new Response(
            JSON.stringify({ error: 'Internal server error' }),
            {
                status: 500,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            }
        )
    }
})
