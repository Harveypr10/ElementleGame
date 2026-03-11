// supabase/functions/holiday-scheduler/index.ts
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js";
console.log("holiday-scheduler function triggered");

serve(async () => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")! // service role key for bypassing RLS
  );

  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

  // Find users with holiday mode active
  const { data: activeUsers, error } = await supabase
    .from("user_stats_user")
    .select("user_id, holiday_start_date, holiday_active")
    .eq("holiday_active", true);

  if (error) {
    console.error("Error fetching holiday users:", error.message);
    return new Response(error.message, { status: 500 });
  }

  let processedUsers = 0;
  let processedRegions = 0;
  let autoEnded = 0;

  for (const row of activeUsers ?? []) {
    const userId = row.user_id;

    // Get region and tier from user_profiles
    const { data: profile, error: profileErr } = await supabase
      .from("user_profiles")
      .select("region, user_tier_id")
      .eq("id", userId)
      .single();

    if (profileErr) {
      console.error("Profile fetch error", userId, profileErr.message);
      continue;
    }

    const region = profile?.region ?? "UK";

    // Insert holiday attempts
    const { error: uErr } = await supabase.rpc("add_user_holiday_attempt", {
      p_user_id: userId,
      p_puzzle_date: today,
    });
    if (!uErr) processedUsers++;

    const { error: rErr } = await supabase.rpc("add_region_holiday_attempt", {
      p_user_id: userId,
      p_region: region,
      p_puzzle_date: today,
    });
    if (!rErr) processedRegions++;

    // Recalculate holiday progress
    await supabase.rpc("recalc_holiday_progress", { p_user_id: userId });

    // Check if duration exceeded
    const { data: stats } = await supabase
      .from("user_stats_user")
      .select("holiday_days_taken_current_period, holiday_active")
      .eq("user_id", userId)
      .single();

    const { data: tier } = await supabase
      .from("user_tier")
      .select("holiday_duration_days")
      .eq("id", profile?.user_tier_id)
      .single();

    const duration = tier?.holiday_duration_days ?? 14;
    const daysTaken = stats?.holiday_days_taken_current_period ?? 0;

    if (stats?.holiday_active && daysTaken >= duration) {
      await supabase
        .from("user_stats_user")
        .update({ holiday_active: false, holiday_ended: true })
        .eq("user_id", userId);
      autoEnded++;
    }
  }

  return new Response(
    `Processed users=${processedUsers}, regions=${processedRegions}; auto-ended=${autoEnded} for ${today}`
  );
});
