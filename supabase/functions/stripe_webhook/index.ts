import { serve } from "https://deno.land/std/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js";

// Safely convert Unix seconds to ISO; returns null if invalid
function safeIsoFromUnix(unixTime?: number | null): string | null {
  if (!unixTime || Number.isNaN(unixTime)) return null;
  try {
    return new Date(unixTime * 1000).toISOString();
  } catch {
    return null;
  }
}

// Determine the next renewal/end based on subscription or items
function getPeriodEndUnix(sub: Stripe.Subscription): number | null {
  const subLevel = (sub as any).current_period_end as number | undefined;
  if (typeof subLevel === "number" && !Number.isNaN(subLevel)) return subLevel;

  if (sub.items?.data?.length) {
    let maxEnd: number | null = null;
    for (const it of sub.items.data) {
      const itemEnd = (it as any).current_period_end as number | undefined;
      if (typeof itemEnd === "number" && !Number.isNaN(itemEnd)) {
        maxEnd = maxEnd === null ? itemEnd : Math.max(maxEnd, itemEnd);
      }
    }
    return maxEnd;
  }
  return null;
}

serve(async (req) => {
  const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
    apiVersion: "2023-10-16",
  });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const signature = req.headers.get("stripe-signature");
  const body = await req.text();

  let event;
  try {
    event = await stripe.webhooks.constructEventAsync(
      body,
      signature!,
      Deno.env.get("STRIPE_WEBHOOK_SECRET")!
    );
  } catch {
    return new Response("Invalid signature", { status: 400 });
  }

  // Helpers
const getCustomerAndUserId = async (customerId: string) => {
  const customer = await stripe.customers.retrieve(customerId);
  const metaUserId = (customer as any)?.metadata?.user_id as string | undefined;
  if (metaUserId) return { customer, userId: metaUserId };

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("id")
    .eq("stripe_customer_id", customerId)
    .maybeSingle();
  return { customer, userId: profile?.id as string | undefined };
};

const resolveTierUuidFromPrice = async (priceId: string | null | undefined) => {
  if (!priceId) return null;
  const { data: tierRow } = await supabase
    .from("user_tier")
    .select("id, stripe_price_id")
    .eq("stripe_price_id", priceId)
    .maybeSingle();
  return tierRow?.id ?? null;
};

const getLatestInvoiceAmountPaid = (sub: Stripe.Subscription): number | null => {
  const amt = (sub.latest_invoice as any)?.amount_paid;
  return typeof amt === "number" ? amt / 100 : null;
};

const archiveAndInsert = async (args: {
  userId: string;
  userTierId: string | null;
  stripeCustomerId: string;
  stripeSubscriptionId: string;
  stripePriceId: string | null;
  amountPaid: number | null;
  currency: string | null;
  expiresAt: string | null;
  autoRenew: boolean;
  status: string | null;       // status for new row (usually 'active'), null if cancel
  oldStatus: string;           // 'inactive' for plan change, 'canceled' for cancel
}) => {
  await supabase.rpc("archive_and_insert_subscription", {
    p_user_id: args.userId,
    p_user_tier_id: args.userTierId,
    p_stripe_customer_id: args.stripeCustomerId,
    p_stripe_subscription_id: args.stripeSubscriptionId,
    p_stripe_price_id: args.stripePriceId,
    p_amount_paid: args.amountPaid ?? 0,
    p_currency: args.currency ?? "GBP",
    p_expires_at: args.expiresAt,
    p_auto_renew: args.autoRenew,
    p_status: args.status,      // null means no new row
    p_old_status: args.oldStatus,
  });
};

const updateActiveBySubscriptionId = async (args: {
  stripeSubscriptionId: string;
  stripeCustomerId?: string;
  stripePriceId?: string | null;
  currency?: string | null;
  expiresAt?: string | null;
  autoRenew?: boolean;
  status?: string;
  userTierId?: string | null;
  amountPaid?: number | null;
}) => {
  const fields: Record<string, any> = {};
  if (args.stripeCustomerId) fields.stripe_customer_id = args.stripeCustomerId;
  if (args.stripePriceId) fields.stripe_price_id = args.stripePriceId;
  if (args.currency) fields.currency = args.currency ?? "GBP";
  if (args.expiresAt !== undefined) fields.expires_at = args.expiresAt; // corrected
  if (args.autoRenew !== undefined) fields.auto_renew = args.autoRenew;
  if (args.status) fields.status = args.status;
  if (args.userTierId !== undefined) fields.user_tier_id = args.userTierId;
  if (args.amountPaid !== undefined) fields.amount_paid = args.amountPaid ?? 0;

  await supabase.from("user_subscriptions")
    .update(fields)
    .eq("stripe_subscription_id", args.stripeSubscriptionId);
};

// Flow handlers

// checkout.session.completed → finalize pending row if present, else archive+insert
if (event.type === "checkout.session.completed") {
  const session: any = event.data.object;
  const customerId: string = session.customer;
  const subscriptionId: string | undefined = session.subscription;

  if (subscriptionId) {
    const sub = await stripe.subscriptions.retrieve(subscriptionId);
    const { userId } = await getCustomerAndUserId(customerId);
    const priceId = sub.items.data[0].price.id;
    const tierUuid = await resolveTierUuidFromPrice(priceId);
    const expiresAt = safeIsoFromUnix(getPeriodEndUnix(sub));
    const amountPaid = getLatestInvoiceAmountPaid(sub);

    const { data: pendingRows } = await supabase
      .from("user_subscriptions")
      .select("id")
      .eq("stripe_customer_id", customerId)
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(1);

    if (pendingRows && pendingRows.length > 0) {
      const latestPendingId = pendingRows[0].id;
      await supabase
        .from("user_subscriptions")
        .update({
          user_id: userId,
          user_tier_id: tierUuid,
          stripe_customer_id: customerId,
          stripe_subscription_id: sub.id,
          stripe_price_id: priceId,
          amount_paid: amountPaid ?? 0,
          currency: sub.items.data[0].price.currency ?? "GBP",
          expires_at: expiresAt, // corrected
          auto_renew: !sub.cancel_at_period_end,
          status: sub.status,
        })
        .eq("id", latestPendingId);
    } else if (userId) {
      await archiveAndInsert({
        userId,
        userTierId: tierUuid,
        stripeCustomerId: customerId,
        stripeSubscriptionId: sub.id,
        stripePriceId: priceId,
        amountPaid,
        currency: sub.items.data[0].price.currency ?? "GBP",
        expiresAt,
        autoRenew: !sub.cancel_at_period_end,
        status: sub.status,   // new row active
        oldStatus: "inactive"
      });
    }
  }
}

   // invoice.payment_succeeded → finalize pending row if present, else update/insert
  if (event.type === "invoice.payment_succeeded") {
    const invoice: any = event.data.object;
    const customerId: string = invoice.customer;
    const subscriptionId: string | undefined = invoice.subscription;

    if (subscriptionId) {
      const sub = await stripe.subscriptions.retrieve(subscriptionId);
      const { userId } = await getCustomerAndUserId(customerId);
      const priceId = sub.items.data[0].price.id;
      const tierUuid = await resolveTierUuidFromPrice(priceId);
      const expiresAt = safeIsoFromUnix(getPeriodEndUnix(sub));
      const amountPaid =
        typeof invoice.amount_paid === "number"
          ? invoice.amount_paid / 100
          : getLatestInvoiceAmountPaid(sub);

      // Prefer finalizing the latest pending row for this customer
      const { data: pendingRows } = await supabase
        .from("user_subscriptions")
        .select("id")
        .eq("stripe_customer_id", customerId)
        .eq("status", "pending")
        .order("created_at", { ascending: false })
        .limit(1);

      if (pendingRows && pendingRows.length > 0) {
        const latestPendingId = pendingRows[0].id;
        await supabase
          .from("user_subscriptions")
          .update({
            user_id: userId,
            user_tier_id: tierUuid,
            stripe_customer_id: customerId,
            stripe_subscription_id: sub.id,
            stripe_price_id: priceId,
            amount_paid: amountPaid ?? 0,
            currency: sub.items.data[0].price.currency ?? "GBP",
            expires_at: expiresAt,   // corrected field name
            auto_renew: !sub.cancel_at_period_end,
            status: sub.status,
          })
          .eq("id", latestPendingId);
      } else {
        // No pending row → update existing active row or archive+insert
        const { data: existing } = await supabase
          .from("user_subscriptions")
          .select("id")
          .eq("stripe_subscription_id", sub.id)
          .limit(1);

        if (existing && existing.length > 0) {
          await updateActiveBySubscriptionId({
            stripeSubscriptionId: sub.id,
            stripeCustomerId: customerId,
            stripePriceId: priceId,
            currency: sub.items.data[0].price.currency ?? "GBP",
            expiresAt,   // passed into helper, which maps to expires_at
            autoRenew: !sub.cancel_at_period_end,
            status: sub.status,
            userTierId: tierUuid,
            amountPaid,
          });
        } else if (userId) {
          await archiveAndInsert({
            userId,
            userTierId: tierUuid,
            stripeCustomerId: customerId,
            stripeSubscriptionId: sub.id,
            stripePriceId: priceId,
            amountPaid,
            currency: sub.items.data[0].price.currency ?? "GBP",
            expiresAt,
            autoRenew: !sub.cancel_at_period_end,
            status: sub.status,     // new row active
            oldStatus: "inactive",  // previous row marked inactive
          });
        }
      }
    }
  }

  // customer.subscription.deleted → mark canceled; keep history intact
  if (event.type === "customer.subscription.deleted") {
    const subEvt: any = event.data.object;
    const fullSub = await stripe.subscriptions.retrieve(subEvt.id);
    const expiresAt = safeIsoFromUnix(getPeriodEndUnix(fullSub));
    const { userId } = await getCustomerAndUserId(fullSub.customer as string);

    if (userId) {
      // Archive current active row as canceled, no new row inserted
      await archiveAndInsert({
        userId,
        userTierId: null,
        stripeCustomerId: fullSub.customer as string,
        stripeSubscriptionId: fullSub.id,
        stripePriceId: fullSub.items.data[0].price.id,
        amountPaid: getLatestInvoiceAmountPaid(fullSub),
        currency: fullSub.items.data[0].price.currency ?? "GBP",
        expiresAt,
        autoRenew: false,
        status: null,            // no new row
        oldStatus: "canceled",   // mark old row canceled
      });
    }
  }

  // customer.subscription.updated → archive+insert on price change, else update fields
  if (event.type === "customer.subscription.updated") {
    const subEvt: any = event.data.object;
    const fullSub = await stripe.subscriptions.retrieve(subEvt.id);
    const customerId: string = fullSub.customer as string;
    const { userId } = await getCustomerAndUserId(customerId);
    const priceId = fullSub.items.data[0].price.id;
    const tierUuid = await resolveTierUuidFromPrice(priceId);
    const expiresAt = safeIsoFromUnix(getPeriodEndUnix(fullSub));
    const amountPaid = getLatestInvoiceAmountPaid(fullSub);

    const { data: existing } = await supabase
      .from("user_subscriptions")
      .select("id, stripe_price_id, status")
      .eq("stripe_subscription_id", fullSub.id)
      .limit(1);

    const existingRow = existing?.[0];

    if (existingRow && existingRow.stripe_price_id && existingRow.stripe_price_id !== priceId && userId) {
      // Price changed → archive current row as inactive and insert new active row
      await archiveAndInsert({
        userId,
        userTierId: tierUuid,
        stripeCustomerId: customerId,
        stripeSubscriptionId: fullSub.id,
        stripePriceId: priceId,
        amountPaid,
        currency: fullSub.items.data[0].price.currency ?? "GBP",
        expiresAt,
        autoRenew: !fullSub.cancel_at_period_end,
        status: fullSub.status,   // new row active
        oldStatus: "inactive",    // previous row inactive
      });
    } else {
      // No price change → update current row in place
      await updateActiveBySubscriptionId({
        stripeSubscriptionId: fullSub.id,
        stripeCustomerId: customerId,
        stripePriceId: priceId,
        currency: fullSub.items.data[0].price.currency ?? "GBP",
        expiresAt,   // passed into helper, which maps to expires_at
        autoRenew: !fullSub.cancel_at_period_end,
        status: fullSub.status,
        userTierId: tierUuid,
        amountPaid,
      });
    }
  }

  return new Response("Webhook processed", { status: 200 });
});

