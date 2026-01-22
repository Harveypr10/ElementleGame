import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from 'https://esm.sh/stripe@14.11.0'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
    apiVersion: '2023-10-16',
})

const STRIPE_WEBHOOK_SECRET = Deno.env.get('STRIPE_WEBHOOK_SECRET')!

serve(async (req) => {
    const signature = req.headers.get('stripe-signature')

    if (!signature) {
        return new Response(JSON.stringify({ error: 'No signature' }), { status: 400 })
    }

    try {
        // 1. Verify webhook signature
        const body = await req.text()
        const event = stripe.webhooks.constructEvent(body, signature, STRIPE_WEBHOOK_SECRET)

        console.log(`[stripe-webhook] Received event: ${event.type}`)

        const supabaseAdmin = createClient(
            Deno.env.get('SUPABASE_URL')!,
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
        )

        // 2. Handle different event types
        switch (event.type) {
            case 'checkout.session.completed':
                await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session, supabaseAdmin)
                break

            case 'invoice.payment_succeeded':
                await handlePaymentSucceeded(event.data.object as Stripe.Invoice, supabaseAdmin)
                break

            case 'customer.subscription.deleted':
                await handleSubscriptionDeleted(event.data.object as Stripe.Subscription, supabaseAdmin)
                break

            case 'customer.subscription.updated':
                await handleSubscriptionUpdated(event.data.object as Stripe.Subscription, supabaseAdmin)
                break

            default:
                console.log(`[stripe-webhook] Unhandled event type: ${event.type}`)
        }

        return new Response(JSON.stringify({ received: true }), {
            headers: { 'Content-Type': 'application/json' }
        })

    } catch (error) {
        console.error('[stripe-webhook] Error:', error)
        return new Response(JSON.stringify({ error: error.message }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
        })
    }
})

/**
 * Handle initial checkout completion
 */
async function handleCheckoutCompleted(session: Stripe.Checkout.Session, supabase: any) {
    console.log(`[stripe-webhook] Processing checkout.session.completed: ${session.id}`)

    const userId = session.metadata?.user_id
    const tierId = session.metadata?.tier_id

    if (!userId) {
        console.error('[stripe-webhook] No user_id in session metadata')
        return
    }

    // Retrieve subscription details
    if (!session.subscription) {
        console.error('[stripe-webhook] No subscription in session')
        return
    }

    const subscription = await stripe.subscriptions.retrieve(session.subscription as string)
    const invoice = session.invoice ? await stripe.invoices.retrieve(session.invoice as string) : null

    // Get price ID from subscription
    const priceId = subscription.items.data[0]?.price.id

    // Look up tier - priority: 1) metadata tier_id, 2) lookup by price_id
    let tier
    if (tierId) {
        const { data } = await supabase
            .from('user_tier')
            .select('id, billing_period')
            .eq('id', tierId)
            .single()
        tier = data
    } else if (priceId) {
        // Fallback: lookup by price_id (be careful with multi-region!)
        const { data } = await supabase
            .from('user_tier')
            .select('id, billing_period')
            .eq('stripe_price_id', priceId)
            .single()
        tier = data
    }

    if (!tier) {
        console.error('[stripe-webhook] Could not find tier')
        return
    }

    // Calculate amount paid
    const amountPaid = invoice ? (invoice.amount_paid / 100) : null

    // Update user_subscriptions - find pending record and activate it
    const { error: updateError } = await supabase
        .from('user_subscriptions')
        .update({
            status: 'active',
            stripe_subscription_id: subscription.id,
            stripe_price_id: priceId,
            expires_at: new Date(subscription.current_period_end * 1000).toISOString(),
            auto_renew: !subscription.cancel_at_period_end,
            billing_period: tier.billing_period,
            amount_paid: amountPaid,
            currency: invoice?.currency?.toUpperCase() || 'GBP',
            // Ensure RevenueCat columns stay NULL
            revenuecat_subscriber_id: null,
            revenuecat_product_id: null
        })
        .eq('user_id', userId)
        .eq('status', 'pending')

    if (updateError) {
        console.error('[stripe-webhook] Error updating subscription:', updateError)
        return
    }

    // Update user_profiles
    const { error: profileError } = await supabase
        .from('user_profiles')
        .update({
            user_tier_id: tier.id,
            subscription_end_date: new Date(subscription.current_period_end * 1000).toISOString()
        })
        .eq('id', userId)

    if (profileError) {
        console.error('[stripe-webhook] Error updating profile:', profileError)
        return
    }

    console.log(`[stripe-webhook] Activated subscription for user: ${userId}`)
}

/**
 * Handle subscription renewal
 */
async function handlePaymentSucceeded(invoice: Stripe.Invoice, supabase: any) {
    console.log(`[stripe-webhook] Processing invoice.payment_succeeded: ${invoice.id}`)

    // Skip if this is the first invoice (already handled by checkout.session.completed)
    if (invoice.billing_reason === 'subscription_create') {
        console.log('[stripe-webhook] Skipping first invoice (handled by checkout completion)')
        return
    }

    const subscriptionId = invoice.subscription as string
    if (!subscriptionId) {
        console.error('[stripe-webhook] No subscription ID in invoice')
        return
    }

    // Retrieve subscription
    const subscription = await stripe.subscriptions.retrieve(subscriptionId)
    const priceId = subscription.items.data[0]?.price.id

    // Find user_subscriptions record by stripe_subscription_id
    const { data: subRecord } = await supabase
        .from('user_subscriptions')
        .select('user_id, user_tier_id')
        .eq('stripe_subscription_id', subscriptionId)
        .single()

    if (!subRecord) {
        console.error('[stripe-webhook] No subscription record found for:', subscriptionId)
        return
    }

    // Update subscription record for renewal
    const amountPaid = invoice.amount_paid / 100

    const { error: updateError } = await supabase
        .from('user_subscriptions')
        .update({
            status: 'active',
            expires_at: new Date(subscription.current_period_end * 1000).toISOString(),
            auto_renew: !subscription.cancel_at_period_end,
            amount_paid: amountPaid,
            currency: invoice.currency?.toUpperCase() || 'GBP'
        })
        .eq('stripe_subscription_id', subscriptionId)

    if (updateError) {
        console.error('[stripe-webhook] Error updating subscription:', updateError)
        return
    }

    // Update user_profiles subscription_end_date
    const { error: profileError } = await supabase
        .from('user_profiles')
        .update({
            subscription_end_date: new Date(subscription.current_period_end * 1000).toISOString()
        })
        .eq('id', subRecord.user_id)

    if (profileError) {
        console.error('[stripe-webhook] Error updating profile:', profileError)
        return
    }

    console.log(`[stripe-webhook] Renewed subscription for user: ${subRecord.user_id}`)
}

/**
 * Handle subscription deletion (expiration/cancellation)
 */
async function handleSubscriptionDeleted(subscription: Stripe.Subscription, supabase: any) {
    console.log(`[stripe-webhook] Processing customer.subscription.deleted: ${subscription.id}`)

    // Find user by stripe_subscription_id
    const { data: subRecord } = await supabase
        .from('user_subscriptions')
        .select('user_id, user_tier_id')
        .eq('stripe_subscription_id', subscription.id)
        .single()

    if (!subRecord) {
        console.error('[stripe-webhook] No subscription record found')
        return
    }

    // Get user's region to find Standard tier
    const { data: profile } = await supabase
        .from('user_profiles')
        .select('region')
        .eq('id', subRecord.user_id)
        .single()

    const region = profile?.region || 'UK'

    // Find Standard tier for this region
    const { data: standardTier } = await supabase
        .from('user_tier')
        .select('id')
        .eq('region', region)
        .ilike('tier', 'Standard')
        .single()

    if (!standardTier) {
        console.error('[stripe-webhook] No Standard tier found for region:', region)
        return
    }

    // Update subscription status
    await supabase
        .from('user_subscriptions')
        .update({ status: 'canceled' })
        .eq('stripe_subscription_id', subscription.id)

    // Downgrade user to Standard tier
    await supabase
        .from('user_profiles')
        .update({
            user_tier_id: standardTier.id,
            subscription_end_date: null
        })
        .eq('id', subRecord.user_id)

    console.log(`[stripe-webhook] Downgraded user to Standard: ${subRecord.user_id}`)
}

/**
 * Handle subscription updates (e.g., cancellation scheduled)
 */
async function handleSubscriptionUpdated(subscription: Stripe.Subscription, supabase: any) {
    console.log(`[stripe-webhook] Processing customer.subscription.updated: ${subscription.id}`)

    // Update auto_renew status
    const { error } = await supabase
        .from('user_subscriptions')
        .update({
            auto_renew: !subscription.cancel_at_period_end
        })
        .eq('stripe_subscription_id', subscription.id)

    if (error) {
        console.error('[stripe-webhook] Error updating auto_renew:', error)
    }
}
