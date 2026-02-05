import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { decode as decodeJwt } from "https://deno.land/x/djwt@v3.0.1/mod.ts"

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface RequestBody {
    provider: 'google' | 'apple';
    idToken?: string;  // Not required for disable/unlink action
    action: 'check' | 'link' | 'signin' | 'disable' | 'enable' | 'unlink';
}

interface CheckResponse {
    found: boolean;
    userId?: string;
    email?: string;
    disabled?: boolean;
}

interface SignInResponse {
    success: boolean;
    error?: string;
    accessToken?: string;
    refreshToken?: string;
    userId?: string;
    isNewUser?: boolean;
    isDisabled?: boolean;  // True if identity was disabled
}

interface LinkResponse {
    success: boolean;
    error?: string;
}

serve(async (req) => {
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        // Parse request body
        const body: RequestBody = await req.json()
        const { provider, idToken, action } = body

        if (!provider || !action) {
            return new Response(
                JSON.stringify({ error: 'Missing required fields: provider, action' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        if (!['google', 'apple'].includes(provider)) {
            return new Response(
                JSON.stringify({ error: 'Invalid provider. Must be google or apple' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        if (!['check', 'link', 'signin', 'disable', 'enable', 'unlink'].includes(action)) {
            return new Response(
                JSON.stringify({ error: 'Invalid action. Must be check, link, signin, disable, enable, or unlink' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // Create Supabase admin client
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

        // Get the calling user from the authorization header
        const authHeader = req.headers.get('Authorization')
        let callingUserId: string | null = null

        if (authHeader) {
            const token = authHeader.replace('Bearer ', '')
            const { data: { user } } = await supabaseAdmin.auth.getUser(token)
            callingUserId = user?.id ?? null
        }

        // Handle DISABLE action - no idToken needed, just uses auth header
        if (action === 'disable') {
            if (!callingUserId) {
                return new Response(
                    JSON.stringify({ success: false, error: 'Authentication required' }),
                    { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                )
            }

            // Set disabled_at on the linked identity
            const { error: updateError } = await supabaseAdmin
                .from('linked_identities')
                .update({ disabled_at: new Date().toISOString() })
                .eq('user_id', callingUserId)
                .eq('provider', provider)

            if (updateError) {
                console.error('[link-social-identity] Disable error:', updateError)
                return new Response(
                    JSON.stringify({ success: false, error: 'Failed to disable identity' }),
                    { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                )
            }

            // Also update user_profiles
            const updateField = provider === 'google' ? 'google_linked' : 'apple_linked'
            await supabaseAdmin
                .from('user_profiles')
                .update({ [updateField]: false })
                .eq('id', callingUserId)

            console.log(`[link-social-identity] DISABLED: ${provider} for user ${callingUserId}`)

            return new Response(
                JSON.stringify({ success: true }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // Handle UNLINK action - removes identity from auth.identities using admin REST API
        if (action === 'unlink') {
            if (!callingUserId) {
                return new Response(
                    JSON.stringify({ success: false, error: 'Authentication required' }),
                    { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                )
            }

            console.log(`[link-social-identity] UNLINK: Starting for ${provider}, user ${callingUserId}`)

            // Get user's identities via admin API
            const { data: userData, error: userError } = await supabaseAdmin.auth.admin.getUserById(callingUserId)

            if (userError || !userData.user) {
                console.error('[link-social-identity] Failed to get user:', userError)
                return new Response(
                    JSON.stringify({ success: false, error: 'Failed to get user data' }),
                    { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                )
            }

            // Log all identities for this user
            console.log(`[link-social-identity] User has ${userData.user.identities?.length || 0} identities:`)
            userData.user.identities?.forEach((id: any, index: number) => {
                console.log(`[link-social-identity]   [${index}] provider: ${id.provider}, id: ${id.id}, identity_id: ${id.identity_id}`)
            })

            // Find the identity for this provider
            const identity = userData.user.identities?.find(
                (id: { provider: string }) => id.provider === provider
            )

            let deleteResult = { found: false, deleted: false, error: null as string | null }

            if (!identity) {
                console.log(`[link-social-identity] No ${provider} identity found for user ${callingUserId}`)
                deleteResult.error = 'No identity found'
            } else {
                deleteResult.found = true
                console.log(`[link-social-identity] Found identity to delete:`, JSON.stringify(identity))

                // Call the database function to delete the identity
                // This function has SECURITY DEFINER to access auth.identities
                const { data: rpcResult, error: rpcError } = await supabaseAdmin
                    .rpc('delete_user_identity', {
                        target_user_id: callingUserId,
                        target_provider: provider
                    })

                console.log(`[link-social-identity] RPC result:`, rpcResult, 'error:', rpcError)

                if (rpcError) {
                    console.error(`[link-social-identity] RPC delete failed:`, rpcError)
                    deleteResult.error = `RPC failed: ${rpcError.message}`
                } else if (rpcResult === true) {
                    console.log(`[link-social-identity] Successfully deleted ${provider} identity via RPC`)
                    deleteResult.deleted = true
                } else {
                    console.log(`[link-social-identity] RPC returned false - no rows deleted (already gone?)`)
                    deleteResult.deleted = false
                    deleteResult.error = 'No rows deleted'
                }
            }

            // Delete from linked_identities table (complete removal)
            const { error: linkedDeleteError } = await supabaseAdmin
                .from('linked_identities')
                .delete()
                .eq('user_id', callingUserId)
                .eq('provider', provider)

            if (linkedDeleteError) {
                console.error(`[link-social-identity] Failed to delete from linked_identities:`, linkedDeleteError)
            } else {
                console.log(`[link-social-identity] Deleted from linked_identities table`)
            }

            // Update user_profiles to mark as unlinked
            const updateField = provider === 'google' ? 'google_linked' : 'apple_linked'
            await supabaseAdmin
                .from('user_profiles')
                .update({ [updateField]: false })
                .eq('id', callingUserId)

            console.log(`[link-social-identity] UNLINK complete: ${JSON.stringify(deleteResult)}`)

            return new Response(
                JSON.stringify({
                    success: deleteResult.deleted || !deleteResult.found,
                    debug: deleteResult
                }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // Handle ENABLE action - requires idToken to verify ownership
        if (action === 'enable') {
            if (!callingUserId) {
                return new Response(
                    JSON.stringify({ success: false, error: 'Authentication required' }),
                    { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                )
            }

            if (!idToken) {
                return new Response(
                    JSON.stringify({ success: false, error: 'ID token required to enable identity' }),
                    { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                )
            }

            // Decode token to get provider user ID
            let providerUserId: string
            try {
                const [_header, payload, _signature] = decodeJwt(idToken)
                const claims = payload as Record<string, unknown>
                providerUserId = claims.sub as string
                if (!providerUserId) throw new Error('No sub claim')
            } catch (e) {
                return new Response(
                    JSON.stringify({ success: false, error: 'Invalid ID token' }),
                    { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                )
            }

            // Verify this identity belongs to the calling user
            const { data: existingLink, error: checkError } = await supabaseAdmin
                .from('linked_identities')
                .select('user_id, disabled_at')
                .eq('provider', provider)
                .eq('provider_user_id', providerUserId)
                .single()

            if (checkError && checkError.code !== 'PGRST116') {
                console.error('[link-social-identity] Enable check error:', checkError)
            }

            if (!existingLink) {
                // No existing link - create a new one
                console.log(`[link-social-identity] ENABLE: No existing link, creating new one for user ${callingUserId}`)

                // Get email from token
                let providerEmail: string | undefined
                try {
                    const [_h, payload, _s] = decodeJwt(idToken)
                    providerEmail = (payload as Record<string, unknown>).email as string | undefined
                } catch (e) { }

                const { error: insertError } = await supabaseAdmin
                    .from('linked_identities')
                    .insert({
                        user_id: callingUserId,
                        provider: provider,
                        provider_user_id: providerUserId,
                        provider_email: providerEmail
                    })

                if (insertError) {
                    console.error('[link-social-identity] Enable insert error:', insertError)
                    return new Response(
                        JSON.stringify({ success: false, error: 'Failed to link identity' }),
                        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                    )
                }

                // Update user_profiles
                const updateField = provider === 'google' ? 'google_linked' : 'apple_linked'
                await supabaseAdmin
                    .from('user_profiles')
                    .update({ [updateField]: true })
                    .eq('id', callingUserId)

                console.log(`[link-social-identity] LINKED (via enable): ${provider} to user ${callingUserId}`)

                return new Response(
                    JSON.stringify({ success: true }),
                    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                )
            }

            if (existingLink.user_id !== callingUserId) {
                // Identity belongs to a different user - this is already linked elsewhere
                console.log(`[link-social-identity] BLOCKED: Cannot enable ${provider} - belongs to different user`)
                return new Response(
                    JSON.stringify({ success: false, error: `This ${provider === 'apple' ? 'Apple ID' : 'Google account'} is already linked to another Elementle account.` }),
                    { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                )
            }

            // Clear disabled_at
            const { error: updateError } = await supabaseAdmin
                .from('linked_identities')
                .update({ disabled_at: null })
                .eq('user_id', callingUserId)
                .eq('provider', provider)

            if (updateError) {
                console.error('[link-social-identity] Enable error:', updateError)
                return new Response(
                    JSON.stringify({ success: false, error: 'Failed to enable identity' }),
                    { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                )
            }

            // Update user_profiles
            const updateField = provider === 'google' ? 'google_linked' : 'apple_linked'
            await supabaseAdmin
                .from('user_profiles')
                .update({ [updateField]: true })
                .eq('id', callingUserId)

            console.log(`[link-social-identity] ENABLED: ${provider} for user ${callingUserId}`)

            return new Response(
                JSON.stringify({ success: true }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // For remaining actions (check, link, signin), idToken is required
        if (!idToken) {
            return new Response(
                JSON.stringify({ error: 'ID token required for this action' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // Decode the ID token to extract the 'sub' (subject) claim
        let providerUserId: string
        let providerEmail: string | undefined

        try {
            const [_header, payload, _signature] = decodeJwt(idToken)
            const claims = payload as Record<string, unknown>

            providerUserId = claims.sub as string
            providerEmail = claims.email as string | undefined

            if (!providerUserId) {
                throw new Error('No sub claim in token')
            }

            console.log(`[link-social-identity] Decoded token: provider=${provider}, sub=${providerUserId}, email=${providerEmail}`)
        } catch (decodeError) {
            console.error('[link-social-identity] Failed to decode token:', decodeError)
            return new Response(
                JSON.stringify({ error: 'Invalid ID token format' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // Handle CHECK action
        if (action === 'check') {
            // First check our linked_identities table
            const { data: linkedIdentity, error } = await supabaseAdmin
                .from('linked_identities')
                .select('user_id, provider_email, disabled_at')
                .eq('provider', provider)
                .eq('provider_user_id', providerUserId)
                .single()

            if (error && error.code !== 'PGRST116') {
                console.error('[link-social-identity] Check error:', error)
            }

            if (linkedIdentity) {
                // Found in linked_identities table
                const response: CheckResponse = {
                    found: true,
                    userId: linkedIdentity.user_id,
                    email: linkedIdentity.provider_email || providerEmail,
                    disabled: !!linkedIdentity.disabled_at
                }
                console.log(`[link-social-identity] CHECK result (linked_identities): found=true, disabled=${response.disabled}, userId=${response.userId}`)
                return new Response(
                    JSON.stringify(response),
                    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                )
            }

            // Not found in linked_identities - also check Supabase auth.identities
            // This catches users who signed up before we started populating linked_identities
            console.log(`[link-social-identity] Not in linked_identities, checking auth.identities for ${provider}:${providerUserId}`)

            try {
                // Query auth.identities directly using a database function or raw query
                // The provider_id in auth.identities stores the 'sub' claim value
                const { data: authIdentity, error: authError } = await supabaseAdmin
                    .rpc('find_user_by_identity', {
                        p_provider: provider,
                        p_provider_id: providerUserId
                    })

                if (authError) {
                    console.log('[link-social-identity] auth.identities check via RPC failed:', authError.message)
                    // Fall through to return not found
                } else if (authIdentity && authIdentity.length > 0) {
                    // Found in auth.identities - user exists in Supabase
                    const userId = authIdentity[0].user_id
                    console.log(`[link-social-identity] CHECK result (auth.identities): found existing user ${userId}`)

                    // Auto-create the linked_identities entry so future checks are faster
                    const { error: insertError } = await supabaseAdmin
                        .from('linked_identities')
                        .insert({
                            user_id: userId,
                            provider: provider,
                            provider_user_id: providerUserId,
                            provider_email: providerEmail
                        })

                    if (insertError && insertError.code !== '23505') { // Ignore duplicate key errors
                        console.warn('[link-social-identity] Failed to backfill linked_identities:', insertError.message)
                    } else {
                        console.log('[link-social-identity] Backfilled linked_identities entry')
                    }

                    const response: CheckResponse = {
                        found: true,
                        userId: userId,
                        email: providerEmail,
                        disabled: false
                    }
                    return new Response(
                        JSON.stringify(response),
                        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                    )
                }
            } catch (rpcError) {
                console.error('[link-social-identity] RPC error checking auth.identities:', rpcError)
                // Fall through to return not found
            }

            // Not found in either table
            const response: CheckResponse = {
                found: false,
                email: providerEmail,
                disabled: false
            }

            console.log(`[link-social-identity] CHECK result: found=false (not in linked_identities or auth.identities)`)

            return new Response(
                JSON.stringify(response),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // Handle SIGNIN action - Sign in as a linked user
        if (action === 'signin') {
            // Look up linked identity
            const { data: linkedIdentity, error: lookupError } = await supabaseAdmin
                .from('linked_identities')
                .select('user_id, provider_email, disabled_at')
                .eq('provider', provider)
                .eq('provider_user_id', providerUserId)
                .single()

            if (lookupError && lookupError.code !== 'PGRST116') {
                console.error('[link-social-identity] Signin lookup error:', lookupError)
            }

            if (!linkedIdentity) {
                // No linked identity found - return indicator that a new account should be created
                console.log('[link-social-identity] SIGNIN: No linked identity, new account needed')
                const response: SignInResponse = {
                    success: true,
                    isNewUser: true
                }
                return new Response(
                    JSON.stringify(response),
                    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                )
            }

            // Check if identity is disabled
            if (linkedIdentity.disabled_at) {
                console.log(`[link-social-identity] SIGNIN: Identity is DISABLED for user ${linkedIdentity.user_id}`)
                const response: SignInResponse = {
                    success: false,
                    isDisabled: true,
                    error: `This ${provider === 'apple' ? 'Apple ID' : 'Google account'} was previously linked to an Elementle account but has been disabled. Please sign in using your email/password, then enable your ${provider === 'apple' ? 'Apple' : 'Google'} account in Settings → Account Info.`
                }
                return new Response(
                    JSON.stringify(response),
                    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                )
            }

            // Found active linked identity - generate session for that user
            console.log(`[link-social-identity] SIGNIN: Found linked user ${linkedIdentity.user_id}`)

            // Get user details
            const { data: userData, error: userError } = await supabaseAdmin.auth.admin.getUserById(
                linkedIdentity.user_id
            )

            if (userError || !userData.user) {
                console.error('[link-social-identity] Failed to get linked user:', userError)
                return new Response(
                    JSON.stringify({ success: false, error: 'Linked user not found' }),
                    { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                )
            }

            // Generate a magic link for the user
            try {
                const { data: sessionData, error: sessionError } = await supabaseAdmin.auth.admin.generateLink({
                    type: 'magiclink',
                    email: userData.user.email!,
                    options: {
                        redirectTo: 'elementle://auth/callback'
                    }
                })

                if (sessionError) {
                    console.error('[link-social-identity] Failed to generate link:', sessionError)
                    return new Response(
                        JSON.stringify({ success: false, error: 'Failed to authenticate linked user' }),
                        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                    )
                }

                // Extract token from generated link
                const linkUrl = new URL(sessionData.properties.hashed_token ?
                    `${Deno.env.get('SUPABASE_URL')}/auth/v1/verify?token=${sessionData.properties.hashed_token}&type=magiclink` :
                    sessionData.properties.action_link
                )
                const verifyToken = linkUrl.searchParams.get('token')

                if (!verifyToken) {
                    console.error('[link-social-identity] No token in generated link')
                    return new Response(
                        JSON.stringify({ success: false, error: 'Failed to generate authentication token' }),
                        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                    )
                }

                // Verify the token to get a session
                const { data: verifyData, error: verifyError } = await supabaseAdmin.auth.verifyOtp({
                    token_hash: verifyToken,
                    type: 'magiclink'
                })

                if (verifyError || !verifyData.session) {
                    console.error('[link-social-identity] Failed to verify OTP:', verifyError)
                    return new Response(
                        JSON.stringify({ success: false, error: 'Failed to create session for linked user' }),
                        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                    )
                }

                console.log(`[link-social-identity] SIGNIN SUCCESS: Created session for user ${linkedIdentity.user_id}`)

                const response: SignInResponse = {
                    success: true,
                    isNewUser: false,
                    userId: linkedIdentity.user_id,
                    accessToken: verifyData.session.access_token,
                    refreshToken: verifyData.session.refresh_token
                }

                return new Response(
                    JSON.stringify(response),
                    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                )

            } catch (authError) {
                console.error('[link-social-identity] Auth error:', authError)
                return new Response(
                    JSON.stringify({ success: false, error: 'Authentication failed' }),
                    { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                )
            }
        }

        // Handle LINK action
        if (action === 'link') {
            if (!callingUserId) {
                return new Response(
                    JSON.stringify({ success: false, error: 'Authentication required to link identity' }),
                    { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                )
            }

            // Check if this identity is already linked
            const { data: existingLink, error: checkError } = await supabaseAdmin
                .from('linked_identities')
                .select('user_id, disabled_at')
                .eq('provider', provider)
                .eq('provider_user_id', providerUserId)
                .single()

            if (checkError && checkError.code !== 'PGRST116') {
                console.error('[link-social-identity] Check existing error:', checkError)
            }

            if (existingLink) {
                if (existingLink.user_id === callingUserId) {
                    // Already linked to this user - re-enable if disabled
                    if (existingLink.disabled_at) {
                        await supabaseAdmin
                            .from('linked_identities')
                            .update({ disabled_at: null })
                            .eq('user_id', callingUserId)
                            .eq('provider', provider)

                        const updateField = provider === 'google' ? 'google_linked' : 'apple_linked'
                        await supabaseAdmin
                            .from('user_profiles')
                            .update({ [updateField]: true })
                            .eq('id', callingUserId)

                        console.log(`[link-social-identity] RE-ENABLED: ${provider} for user ${callingUserId}`)
                    }
                    return new Response(
                        JSON.stringify({ success: true }),
                        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                    )
                } else {
                    // Linked to a different user - ERROR
                    console.log(`[link-social-identity] BLOCKED: ${provider} identity already linked to user ${existingLink.user_id}`)
                    const response: LinkResponse = {
                        success: false,
                        error: `This ${provider === 'apple' ? 'Apple ID' : 'Google account'} is already linked to another Elementle account and cannot be linked to a second account.`
                    }
                    return new Response(
                        JSON.stringify(response),
                        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                    )
                }
            }

            // Insert new link
            const { error: insertError } = await supabaseAdmin
                .from('linked_identities')
                .insert({
                    user_id: callingUserId,
                    provider: provider,
                    provider_user_id: providerUserId,
                    provider_email: providerEmail
                })

            if (insertError) {
                console.error('[link-social-identity] Insert error:', insertError)
                return new Response(
                    JSON.stringify({ success: false, error: 'Failed to link identity' }),
                    { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                )
            }

            // Also update user_profiles
            const updateField = provider === 'google' ? 'google_linked' : 'apple_linked'
            await supabaseAdmin
                .from('user_profiles')
                .update({ [updateField]: true })
                .eq('id', callingUserId)

            console.log(`[link-social-identity] SUCCESS: Linked ${provider} to user ${callingUserId}`)

            const response: LinkResponse = { success: true }
            return new Response(
                JSON.stringify(response),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        return new Response(
            JSON.stringify({ error: 'Invalid action' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )

    } catch (error) {
        console.error('[link-social-identity] Error:', error)
        return new Response(
            JSON.stringify({ error: 'Internal server error' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }
})
