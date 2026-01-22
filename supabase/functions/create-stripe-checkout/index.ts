import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from 'https://esm.sh/stripe@14.11.0'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
    apiVersion: '2023-10-16',
})

serve(async (req) => {
    try {
        // 1. Get authenticated user
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

        // 2. Parse request body
        const { tier_id, promotion_code } = await req.json()

        if (!tier_id) {
            return new Response(JSON.stringify({ error: 'tier_id is required' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            })
        }

        console.log(`[create-stripe-checkout] User: ${user.id}, Tier: ${tier_id}`)

        // 3. Get tier details
        const { data: tier, error: tierError } = await supabaseClient
            .from('user_tier')
            .select('id, stripe_price_id, tier, tier_type, billing_period')
            .eq('id', tier_id)
            .eq('active', true)
            .single()

        if (tierError || !tier) {
            console.error('[create-stripe-checkout] Tier not found:', tierError)
            return new Response(JSON.stringify({ error: 'Invalid or inactive tier' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            })
        }

        if (!tier.stripe_price_id) {
            console.error('[create-stripe-checkout] Tier has no Stripe price ID')
            return new Response(JSON.stringify({ error: 'Tier not configured for Stripe' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            })
        }

        console.log(`[create-stripe-checkout] Tier: ${tier.tier} ${tier.tier_type}, Price ID: ${tier.stripe_price_id}`)

        // 4. Get user email
        const { data: profile } = await supabaseClient
            .from('user_profiles')
            .select('email')
            .eq('id', user.id)
            .single()

        const userEmail = profile?.email || user.email

        // 5. Create or retrieve Stripe customer
        let customer: Stripe.Customer

        // Try to find existing customer by email
        const existingCustomers = await stripe.customers.list({
            email: userEmail,
            limit: 1
        })

        if (existingCustomers.data.length > 0) {
            customer = existingCustomers.data[0]
            console.log(`[create-stripe-checkout] Found existing customer: ${customer.id}`)
        } else {
            // Create new customer
            customer = await stripe.customers.create({
                email: userEmail,
                metadata: {
                    user_id: user.id
                }
            })
            console.log(`[create-stripe-checkout] Created new customer: ${customer.id}`)
        }

        // 6. Mark old pending subscriptions as unpaid (using service role for admin access)
        const supabaseAdmin = createClient(
            Deno.env.get('SUPABASE_URL')!,
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
        )

        await supabaseAdmin
            .from('user_subscriptions')
            .update({ status: 'unpaid' })
            .eq('stripe_customer_id', customer.id)
            .eq('status', 'pending')

        // 7. Insert pending subscription
        const { error: insertError } = await supabaseAdmin
            .from('user_subscriptions')
            .insert({
                user_id: user.id,
                user_tier_id: tier.id,
                stripe_customer_id: customer.id,
                status: 'pending',
                source: 'stripe',
                // RevenueCat columns explicitly NULL
                revenuecat_subscriber_id: null,
                revenuecat_product_id: null
            })

        if (insertError) {
            console.error('[create-stripe-checkout] Error inserting pending subscription:', insertError)
            throw insertError
        }

        console.log('[create-stripe-checkout] Inserted pending subscription')

        // 8. Create Stripe Checkout Session
        const baseUrl = req.headers.get('origin') || 'http://localhost:5173'

        const sessionParams: Stripe.Checkout.SessionCreateParams = {
            mode: 'subscription',
            payment_method_types: ['card'],
            line_items: [
                {
                    price: tier.stripe_price_id,
                    quantity: 1
                }
            ],
            customer: customer.id,
            metadata: {
                user_id: user.id,
                tier_id: tier.id
            },
            success_url: `${baseUrl}/manage-subscription?success=true`,
            cancel_url: `${baseUrl}/?canceled=true`
        }

        // Add promotion code if provided
        if (promotion_code) {
            // TODO: Validate and apply promotion code
            // For now, we'll skip this - can be added later
            console.log(`[create-stripe-checkout] Promotion code requested: ${promotion_code}`)
        }

        const session = await stripe.checkout.sessions.create(sessionParams)

        console.log(`[create-stripe-checkout] Created session: ${session.id}`)

        return new Response(JSON.stringify({
            success: true,
            url: session.url
        }), {
            headers: { 'Content-Type': 'application/json' }
        })

    } catch (error) {
        console.error('[create-stripe-checkout] Error:', error)
        return new Response(JSON.stringify({
            error: error.message || 'Internal server error'
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        })
    }
})
