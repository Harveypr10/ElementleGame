import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const REVENUECAT_API_KEY = Deno.env.get('REVENUECAT_SECRET_KEY')!
const REVENUECAT_API_URL = 'https://api.revenuecat.com/v1'

serve(async (req) => {
    try {
        // 1. Get authenticated user from Supabase
        const supabaseClient = createClient(
            Deno.env.get('SUPABASE_URL')!,
            Deno.env.get('SUPABASE_ANON_KEY')!,
            { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
        )

        const { data: { user }, error: userError } = await supabaseClient.auth.getUser()
        if (userError || !user) {
            return new Response(JSON.stringify({ error: 'Unauthorized' }), {
                status: 401,
                headers: { 'Content-Type': 'application/json' }
            })
        }

        console.log(`[sync-revenuecat] Processing for user: ${user.id}`)

        // 2. Call RevenueCat API to get subscriber info (SERVER-SIDE VERIFICATION)
        const rcResponse = await fetch(
            `${REVENUECAT_API_URL}/subscribers/${user.id}`,
            {
                headers: {
                    'Authorization': `Bearer ${REVENUECAT_API_KEY}`,
                    'Content-Type': 'application/json'
                }
            }
        )

        if (!rcResponse.ok) {
            const errorText = await rcResponse.text()
            console.error(`[sync-revenuecat] RevenueCat API error ${rcResponse.status}:`, errorText)
            throw new Error(`RevenueCat API error: ${rcResponse.status}`)
        }

        const subscriberInfo = await rcResponse.json()

        // 3. Check for 'pro' entitlement (CORRECT: entitlements['pro'], NOT entitlements.active['pro'])
        const proEntitlement = subscriberInfo.subscriber?.entitlements?.['pro']

        if (!proEntitlement) {
            console.log('[sync-revenuecat] No Pro entitlement found')
            return new Response(JSON.stringify({
                success: false,
                message: 'No Pro entitlement found'
            }), {
                headers: { 'Content-Type': 'application/json' }
            })
        }

        // 4. Check if entitlement is valid (expires_date in future)
        const expiresDate = new Date(proEntitlement.expires_date)
        const now = new Date()

        if (expiresDate <= now) {
            console.log('[sync-revenuecat] Pro entitlement expired:', proEntitlement.expires_date)
            return new Response(JSON.stringify({
                success: false,
                message: 'Pro entitlement expired'
            }), {
                headers: { 'Content-Type': 'application/json' }
            })
        }

        console.log('[sync-revenuecat] Valid Pro entitlement found:', proEntitlement.product_identifier)
        console.log('[sync-revenuecat] Expires:', proEntitlement.expires_date)

        // 5. Get RevenueCat identifiers
        const productId = proEntitlement.product_identifier
        const subscriberId = subscriberInfo.subscriber.original_app_user_id

        // 6. Get user's region from profile
        const { data: profile, error: profileError } = await supabaseClient
            .from('user_profiles')
            .select('region')
            .eq('id', user.id)
            .single()

        if (profileError || !profile) {
            console.error('[sync-revenuecat] Error fetching profile:', profileError)
            throw new Error('Failed to fetch user profile')
        }

        if (!profile.region) {
            console.error('[sync-revenuecat] User has no region set')
            throw new Error('User region not set in profile')
        }

        const region = profile.region
        console.log(`[sync-revenuecat] User region: ${region}`)

        // 7. Find matching user_tier by EXACT product_id + region match
        const { data: tierData, error: tierError } = await supabaseClient
            .from('user_tier')
            .select('id, tier_type, tier, subscription_cost')
            .eq('region', region)
            .eq('revenuecat_product_id', productId)
            .single()

        if (tierError || !tierData) {
            console.error(`[sync-revenuecat] No tier found for product ${productId} in region ${region}:`, tierError)
            throw new Error(`No tier found for product ${productId} in region ${region}`)
        }

        const userTierId = tierData.id
        const amountPaid = tierData.subscription_cost || null
        console.log(`[sync-revenuecat] Matched tier: ${tierData.tier} ${tierData.tier_type} (ID: ${userTierId}, Cost: ${amountPaid})`)


        // 8. EXTEND OR INSERT logic to avoid EXCLUDE constraint violations
        // Query for existing active subscription
        const { data: existingSubscription } = await supabaseClient
            .from('user_subscriptions')
            .select('id')
            .eq('user_id', user.id)
            .eq('status', 'active')
            .single()

        const subscriptionData = {
            user_tier_id: userTierId,
            revenuecat_subscriber_id: subscriberId,
            revenuecat_product_id: productId,
            stripe_subscription_id: null,
            stripe_customer_id: null,
            stripe_price_id: null,
            expires_at: proEntitlement.expires_date,
            auto_renew: proEntitlement.will_renew || false,
            status: 'active',
            source: 'revenuecat',
            currency: 'GBP',
            amount_paid: amountPaid
        }

        if (existingSubscription) {
            // CASE A: Update existing active subscription (renewal/extension)
            console.log('[sync-revenuecat] Updating existing subscription:', existingSubscription.id)

            const { error: updateError } = await supabaseClient
                .from('user_subscriptions')
                .update(subscriptionData)
                .eq('id', existingSubscription.id)

            if (updateError) {
                console.error('[sync-revenuecat] Error updating subscription:', updateError)
                throw updateError
            }
        } else {
            // CASE B: Insert new subscription
            console.log('[sync-revenuecat] Inserting new subscription')

            const { error: insertError } = await supabaseClient
                .from('user_subscriptions')
                .insert({
                    user_id: user.id,
                    ...subscriptionData
                })

            if (insertError) {
                console.error('[sync-revenuecat] Error inserting subscription:', insertError)
                throw insertError
            }
        }

        console.log('[sync-revenuecat] Subscription record saved')

        // 9. Update user_profiles (user_tier_id + subscription_end_date)
        const { error: profileUpdateError } = await supabaseClient
            .from('user_profiles')
            .update({
                user_tier_id: userTierId,
                subscription_end_date: proEntitlement.expires_date
            })
            .eq('id', user.id)

        if (profileUpdateError) {
            console.error('[sync-revenuecat] Error updating profile:', profileUpdateError)
            throw profileUpdateError
        }

        console.log('[sync-revenuecat] Profile updated successfully')

        return new Response(JSON.stringify({
            success: true,
            tier: tierData.tier,
            tier_type: tierData.tier_type,
            expires_at: proEntitlement.expires_date,
            will_renew: proEntitlement.will_renew
        }), {
            headers: { 'Content-Type': 'application/json' }
        })

    } catch (error) {
        console.error('[sync-revenuecat] Error:', error)
        return new Response(JSON.stringify({
            error: error.message || 'Internal server error'
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        })
    }
})
