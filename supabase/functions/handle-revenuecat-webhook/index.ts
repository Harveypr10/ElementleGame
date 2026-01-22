import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const REVENUECAT_WEBHOOK_SECRET = Deno.env.get('REVENUECAT_WEBHOOK_SECRET')

serve(async (req) => {
    try {
        // 1. Parse the webhook payload
        const payload = await req.json()

        console.log('[RevenueCat Webhook] Received payload')

        // RevenueCat webhook format can vary
        const eventType = payload.type || payload.event?.type
        const eventData = payload.event || payload
        const appUserId = eventData.app_user_id || eventData.original_app_user_id || payload.event?.app_user_id
        const productId = eventData.product_id || payload.event?.product_id

        console.log(`[RevenueCat Webhook] Event: ${eventType} for user: ${appUserId}`)

        if (!eventType) {
            console.error('[RevenueCat Webhook] No event type found')
            return new Response(JSON.stringify({ error: 'No event type' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            })
        }

        if (!appUserId) {
            console.error('[RevenueCat Webhook] No app_user_id found')
            return new Response(JSON.stringify({ error: 'No app_user_id' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            })
        }

        const supabaseClient = createClient(
            Deno.env.get('SUPABASE_URL')!,
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
        )

        // 2. Handle different event types
        switch (eventType) {
            case 'INITIAL_PURCHASE':
            case 'RENEWAL':
            case 'UNCANCELLATION':
            case 'PRODUCT_CHANGE':
                await handleSubscriptionActive(supabaseClient, appUserId, eventData)
                break

            case 'CANCELLATION':
                await handleCancellation(supabaseClient, appUserId)
                break

            case 'EXPIRATION':
                await handleExpiration(supabaseClient, appUserId)
                break

            case 'BILLING_ISSUE':
                await handleBillingIssue(supabaseClient, appUserId)
                break

            default:
                console.log(`[RevenueCat Webhook] Unhandled event type: ${eventType}`)
        }

        return new Response(JSON.stringify({ received: true }), {
            headers: { 'Content-Type': 'application/json' }
        })

    } catch (error) {
        console.error('[RevenueCat Webhook] Error:', error)
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        })
    }
})

/**
 * Handle subscription activation/renewal
 */
async function handleSubscriptionActive(supabase: any, userId: string, eventData: any) {
    console.log(`[Webhook] Activating subscription for user: ${userId}`)

    const productId = eventData.product_id

    if (!productId) {
        console.error('[Webhook] No product_id in event data')
        return
    }

    // Get user's region
    const { data: profile } = await supabase
        .from('user_profiles')
        .select('region')
        .eq('id', userId)
        .single()

    const region = profile?.region || 'UK'

    // Find tier by product ID + region
    const { data: tier } = await supabase
        .from('user_tier')
        .select('id')
        .eq('region', region)
        .eq('revenuecat_product_id', productId)
        .single()

    if (!tier) {
        console.error(`[Webhook] No tier found for product ${productId} in region ${region}`)
        return
    }

    // EXTEND OR INSERT logic to avoid EXCLUDE constraint violations
    const { data: existingSubscription } = await supabase
        .from('user_subscriptions')
        .select('id')
        .eq('user_id', userId)
        .eq('status', 'active')
        .single()

    const subscriptionData = {
        user_tier_id: tier.id,
        revenuecat_subscriber_id: userId,
        revenuecat_product_id: productId,
        expires_at: eventData.expiration_at_ms ? new Date(eventData.expiration_at_ms).toISOString() : null,
        auto_renew: eventData.will_renew !== false,
        status: 'active',
        source: 'revenuecat',
        stripe_subscription_id: null,
        stripe_customer_id: null,
        stripe_price_id: null
    }

    if (existingSubscription) {
        // CASE A: Update existing subscription (renewal/extension)
        console.log('[Webhook] Updating existing subscription')

        const { error: updateError } = await supabase
            .from('user_subscriptions')
            .update(subscriptionData)
            .eq('id', existingSubscription.id)

        if (updateError) {
            console.error('[Webhook] Error updating subscription:', updateError)
            return
        }
    } else {
        // CASE B: Insert new subscription
        console.log('[Webhook] Inserting new subscription')

        const { error: insertError } = await supabase
            .from('user_subscriptions')
            .insert({
                user_id: userId,
                ...subscriptionData
            })

        if (insertError) {
            console.error('[Webhook] Error inserting subscription:', insertError)
            return
        }
    }

    // Update user_profiles
    const { error: profileError } = await supabase
        .from('user_profiles')
        .update({
            user_tier_id: tier.id,
            subscription_end_date: eventData.expiration_at_ms ? new Date(eventData.expiration_at_ms).toISOString() : null
        })
        .eq('id', userId)

    if (profileError) {
        console.error('[Webhook] Error updating profile:', profileError)
        return
    }

    console.log(`[Webhook] Subscription activated for user: ${userId}`)
}

/**
 * Handle cancellation - user turned off auto-renew but still has paid time
 */
async function handleCancellation(supabase: any, userId: string) {
    console.log(`[Webhook] Handling cancellation for user: ${userId}`)

    const { error } = await supabase
        .from('user_subscriptions')
        .update({
            auto_renew: false,
            status: 'active'
        })
        .eq('user_id', userId)
        .eq('status', 'active')

    if (error) {
        console.error('[Webhook] Error updating auto_renew:', error)
    }
}

/**
 * Handle expiration - subscription time is up, revoke access
 */
async function handleExpiration(supabase: any, userId: string) {
    console.log(`[Webhook] Handling expiration for user: ${userId}`)

    const { data: profile } = await supabase
        .from('user_profiles')
        .select('region')
        .eq('id', userId)
        .single()

    const { data: standardTier } = await supabase
        .from('user_tier')
        .select('id')
        .eq('region', profile?.region || 'UK')
        .ilike('tier', 'Standard')
        .single()

    if (!standardTier) {
        console.error('[Webhook] No Standard tier found')
        return
    }

    await supabase
        .from('user_profiles')
        .update({
            user_tier_id: standardTier.id,
            subscription_end_date: null
        })
        .eq('id', userId)

    await supabase
        .from('user_subscriptions')
        .update({ status: 'expired' })
        .eq('user_id', userId)
        .eq('status', 'active')

    console.log(`[Webhook] User ${userId} downgraded to Standard`)
}

/**
 * Handle billing issues
 */
async function handleBillingIssue(supabase: any, userId: string) {
    console.log(`[Webhook] Handling billing issue for user: ${userId}`)

    await supabase
        .from('user_subscriptions')
        .update({ status: 'past_due' })
        .eq('user_id', userId)
        .eq('status', 'active')
}
