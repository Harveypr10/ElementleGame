// Supabase Edge Function: evaluate_promotions
import { serve } from "https://deno.land/std/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js";

serve(async (req) => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL"),
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
  );

  const now = new Date();

  // 1. Fetch active promotions
  const { data: promotions, error: promoError } = await supabase
    .from("promotions")
    .select("*")
    .eq("active", true)
    .lte("starts_at", now.toISOString())
    .gte("ends_at", now.toISOString());

  if (promoError) {
    console.error("Error fetching promotions:", promoError);
    return new Response("Error fetching promotions", { status: 500 });
  }

  // 2. Evaluate eligibility and upsert grants
  for (const promo of promotions ?? []) {
    // Extension offers (<min_days_remaining)
    if (promo.min_days_remaining) {
      const { data: subs } = await supabase
        .from("user_subscriptions")
        .select("id,user_id,expires_at")
        .eq("tier", promo.tier_type)
        .gte("expires_at", now.toISOString());

      for (const sub of subs ?? []) {
        const daysRemaining =
          (new Date(sub.expires_at).getTime() - now.getTime()) /
          (1000 * 60 * 60 * 24);

        if (daysRemaining < promo.min_days_remaining) {
          await supabase.from("user_promo_grants").upsert(
            {
              user_id: sub.user_id,
              promotion_id: promo.id,
              expires_at: promo.ends_at,
              next_reminder_at: new Date(
                now.getTime() + promo.reminder_interval_days * 86400000
              ).toISOString(),
            },
            { onConflict: "user_id,promotion_id" }
          );
        }
      }
    }

    // Win-back offers (requires lapsed)
    if (promo.requires_lapsed) {
      const { data: subs } = await supabase
        .from("user_subscriptions")
        .select("user_id,expires_at")
        .eq("tier", promo.tier_type);

      for (const sub of subs ?? []) {
        if (new Date(sub.expires_at) < now) {
          await supabase.from("user_promo_grants").upsert(
            {
              user_id: sub.user_id,
              promotion_id: promo.id,
              expires_at: promo.ends_at,
              next_reminder_at: new Date(
                now.getTime() + promo.reminder_interval_days * 86400000
              ).toISOString(),
            },
            { onConflict: "user_id,promotion_id" }
          );
        }
      }
    }
  }

  // 3. Expire stale grants
  const { data: staleGrants } = await supabase
    .from("user_promo_grants")
    .select("id")
    .lt("expires_at", now.toISOString())
    .eq("redeemed", false);

  for (const grant of staleGrants ?? []) {
    await supabase
      .from("user_promo_grants")
      .delete()
      .eq("id", grant.id);
  }

  // 4. Update reminders
  const { data: dueReminders } = await supabase
    .from("user_promo_grants")
    .select("id,reminders_sent,reminder_interval_days")
    .eq("redeemed", false)
    .lte("next_reminder_at", now.toISOString());

  for (const grant of dueReminders ?? []) {
    await supabase.from("user_promo_grants").update({
      reminders_sent: (grant.reminders_sent ?? 0) + 1,
      next_reminder_at: new Date(
        now.getTime() + grant.reminder_interval_days * 86400000
      ).toISOString(),
    }).eq("id", grant.id);
  }

  return new Response("Promotion evaluation + expiry + reminders complete", {
    status: 200,
  });
});
