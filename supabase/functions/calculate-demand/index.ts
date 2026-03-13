// supabase/functions/calculate-demand/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const supabase = createClient(Deno.env.get("SUPABASE_URL"), Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"));
// Dynamic CORS headers: allow production + any .replit.dev preview domains
function getCorsHeaders(req: Request) {
  const origin = req.headers.get("Origin") || "";

  const isAllowed =
    origin === "https://elementle-game.replit.app" ||
    origin.endsWith(".replit.dev");

  return {
    "Access-Control-Allow-Origin": isAllowed
      ? origin
      : "https://elementle-game.replit.app",
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS"
  };
}

function formatDate(d) {
  return d.toISOString().slice(0, 10);
}
function addDays(base, days) {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d;
}
function buildDateSet(start, days) {
  const s = new Set();
  for(let i = 0; i < days; i++)s.add(formatDate(addDays(start, i)));
  return s;
}
function earliestMissing(expected, actual) {
  const sorted = Array.from(expected).sort();
  for (const day of sorted){
    if (!actual.has(day)) return day;
  }
  return null;
}
function clampEnd(startISO, topupDays, windowEndISO) {
  const start = new Date(startISO);
  const desired = formatDate(addDays(start, topupDays - 1));
  return desired > windowEndISO ? windowEndISO : desired;
}
async function getSettings(scopeType, tier, demandType) {
  let query = supabase.from("question_generation_settings").select("*").eq("scope_type", scopeType).eq("demand_type", demandType);
  if (tier === null) {
    query = query.is("tier", null); // region rows
  } else {
    query = query.eq("tier", tier);
  }
  const { data, error } = await query.maybeSingle();
  if (error) throw error;
  return data;
}
serve(async (req)=>{
// Handle CORS preflight
const corsHeaders = getCorsHeaders(req);
if (req.method === "OPTIONS") {
  return new Response("ok", { headers: corsHeaders });
}
  try {
    // Parse input (optional: today’s date, user_id, region)
    let today;
    let targetUserId = null;
    let targetRegion = null;
    try {
      const body = await req.json();
      today = body.today ?? formatDate(new Date());
      targetUserId = body.user_id ?? null;
      targetRegion = body.region ?? null;
    } catch  {
      today = formatDate(new Date());
    }
    const todayDate = new Date(today);
    const runId = crypto.randomUUID();
    const inserts = [];
    // -------------------------
// CLEAR EXISTING DEMAND (scoped clear + logging)
if (targetUserId) {
  const { error: clearErr } = await supabase
    .from("demand_summary")
    .delete()
    .eq("scope_type", "user")
    .eq("scope_id", targetUserId);
  if (clearErr) throw clearErr;
  console.log(`Cleared existing demand rows for user ${targetUserId}`);
} else if (targetRegion) {
  const { error: clearErr } = await supabase
    .from("demand_summary")
    .delete()
    .eq("scope_type", "region")
    .eq("scope_id", targetRegion);
  if (clearErr) throw clearErr;
  console.log(`Cleared existing demand rows for region ${targetRegion}`);
} else {
  console.log("No targetUserId or targetRegion provided — skipping demand clear");
}
// Force fresh read of category preferences to avoid stale cache
if (targetUserId) {
  const { data: categories, error: catErr } = await supabase
    .from("user_category_preferences")
    .select("*")
    .eq("user_id", targetUserId);

  if (catErr) {
    console.error("[CalculateDemand] Category fetch failed:", catErr);
  } else {
    console.log("[CalculateDemand] Fresh category preferences loaded:", categories);
  }
}

// -------------------------
// USER DEMAND (future + archive)
// -------------------------

// --- FUTURE DEMAND ---
const { data: futureNeeds, error: futureErr } = await supabase.rpc(
  "user_future_demand",
  {
    today: formatDate(todayDate),
    target_user: targetUserId
  }
);
if (futureErr) throw futureErr;
console.log(
  `user_future_demand returned ${futureNeeds?.length ?? 0} rows for user ${targetUserId}`
);

const scopedFutureNeeds = targetUserId
  ? (futureNeeds ?? []).filter((r) => r.user_id === targetUserId)
  : futureNeeds;

for (const row of scopedFutureNeeds ?? []) {
  const windowDays = row.min_threshold ?? 0;
  const topupDays = row.target_topup ?? windowDays;

  if (windowDays <= 0) continue;

  const windowStartISO = formatDate(todayDate);
  const strictWindowEndISO = formatDate(addDays(todayDate, windowDays - 1));

  // NEW: extended top‑up window (min_threshold + topup)
  const extendedEndISO = formatDate(
    addDays(todayDate, windowDays + topupDays - 1)
  );

  const { data: allocatedDays, error: allocErr } = await supabase
    .from("questions_allocated_user")
    .select("puzzle_date")
    .eq("user_id", row.user_id)
    .gte("puzzle_date", windowStartISO)
    .lte("puzzle_date", strictWindowEndISO);

  if (allocErr) throw allocErr;

  const expected = buildDateSet(todayDate, windowDays);
  const actual = new Set((allocatedDays ?? []).map((d) => d.puzzle_date));
  const earliestGap = earliestMissing(expected, actual);

// --- FUTURE WINDOW CHECK (corrected logic) ---
// If ANY date in the strict window (today → today + min_threshold - 1) is missing,
// regenerate the FULL extended window (today → today + min_threshold + topup - 1)

if (earliestGap) {
  // Missing at least one required future date → regenerate full window
  inserts.push({
    scope_type: "user",
    scope_id: row.user_id,
    tier: row.tier,
    region: row.region,
    start_date: windowStartISO,   // ALWAYS today
    end_date: extendedEndISO,     // ALWAYS full window
    trigger_reason: `future_window_gap_${windowDays}`,
    run_id: runId,
    priority: 1
  });
} else if ((allocatedDays?.length ?? 0) < windowDays) {
  // Not enough days allocated even if no explicit gap found
  inserts.push({
    scope_type: "user",
    scope_id: row.user_id,
    tier: row.tier,
    region: row.region,
    start_date: windowStartISO,
    end_date: extendedEndISO,
    trigger_reason: `future_below_min_${windowDays}`,
    run_id: runId,
    priority: 1
  });
}

}

// --- ARCHIVE DEMAND ---
const { data: archiveNeeds, error: archiveErr } = await supabase.rpc(
  "user_archive_demand",
  {
    today: formatDate(todayDate),
    target_user: targetUserId
  }
);
if (archiveErr) throw archiveErr;
console.log(
  `user_archive_demand returned ${archiveNeeds?.length ?? 0} rows for user ${targetUserId}`
);

const scopedArchiveNeeds = targetUserId
  ? (archiveNeeds ?? []).filter((r) => r.user_id === targetUserId)
  : archiveNeeds;

for (const row of scopedArchiveNeeds ?? []) {
  const windowDays = row.min_threshold ?? 0;
  const topupDays = row.target_topup ?? windowDays;

  const windowEnd = addDays(todayDate, -1);
  const windowStart = addDays(todayDate, -windowDays);
  const windowStartISO = formatDate(windowStart);
  const windowEndISO = formatDate(windowEnd);

  // NEW: extended archive end (yesterday + topup)
  const extendedArchiveEndISO = formatDate(
    addDays(windowEnd, topupDays)
  );

  // --- Seed coverage check (unchanged) ---
  if ((row.seed_amount ?? 0) > 0) {
    const seedDays = row.seed_amount;
    const seedStart = addDays(todayDate, -seedDays);
    const seedEnd = addDays(todayDate, -1);

    const expectedSeed = buildDateSet(seedStart, seedDays);

    const { data: allocatedSeed, error: allocSeedErr } = await supabase
      .from("questions_allocated_user")
      .select("puzzle_date")
      .eq("user_id", row.user_id)
      .gte("puzzle_date", formatDate(seedStart))
      .lte("puzzle_date", formatDate(seedEnd));

    if (allocSeedErr) throw allocSeedErr;

    const actualSeed = new Set((allocatedSeed ?? []).map((d) => d.puzzle_date));
    const earliestGapSeed = earliestMissing(expectedSeed, actualSeed);

    if (earliestGapSeed) {
      inserts.push({
        scope_type: "user",
        scope_id: row.user_id,
        tier: row.tier,
        region: row.region,
        start_date: earliestGapSeed,
        end_date: clampEnd(earliestGapSeed, seedDays, formatDate(seedEnd)),
        trigger_reason: `archive_seed_${row.tier}`,
        run_id: runId,
        priority: 2
      });
      continue;
    }
  }

  if (windowDays <= 0) continue;

  const { data: allocatedArchive, error: allocArchErr } = await supabase
    .from("questions_allocated_user")
    .select("puzzle_date")
    .eq("user_id", row.user_id)
    .gte("puzzle_date", windowStartISO)
    .lte("puzzle_date", windowEndISO);

  if (allocArchErr) throw allocArchErr;

  const expectedPast = buildDateSet(windowStart, windowDays);
  const actualPast = new Set((allocatedArchive ?? []).map((d) => d.puzzle_date));
  const earliestGapPast = earliestMissing(expectedPast, actualPast);

  if (earliestGapPast) {
    inserts.push({
      scope_type: "user",
      scope_id: row.user_id,
      tier: row.tier,
      region: row.region,
      start_date: earliestGapPast,
      end_date: clampEnd(earliestGapPast, topupDays, extendedArchiveEndISO),
      trigger_reason: `archive_window_gap_${windowDays}`,
      run_id: runId,
      priority: 2
    });
  } else if ((allocatedArchive?.length ?? 0) < windowDays) {
    inserts.push({
      scope_type: "user",
      scope_id: row.user_id,
      tier: row.tier,
      region: row.region,
      start_date: windowStartISO,
      end_date: extendedArchiveEndISO,
      trigger_reason: `archive_below_min_${windowDays}`,
      run_id: runId,
      priority: 2
    });
  }
}
// -------------------------
// REGION DEMAND (future + archive)
// -------------------------
// Region demand uses 'GLOBAL' only — category specs are now GLOBAL.
// Location demand (future) will be per-country but is handled separately.
const regionIds: string[] = targetRegion ? [targetRegion] : ["GLOBAL"];
console.log(`[RegionDemand] Processing regions:`, regionIds);

for (const regionId of regionIds) {
if (!targetUserId) {
// --- REGION FUTURE WINDOW CHECK (corrected logic) ---
const regionFutureSettings = await getSettings("region", null, "future");
if (regionFutureSettings && (regionFutureSettings.min_threshold ?? 0) > 0) {
  const windowDays = regionFutureSettings.min_threshold;
  const topupDays = regionFutureSettings.target_topup ?? windowDays;

  const windowStartISO = formatDate(todayDate);
  const strictWindowEndISO = formatDate(addDays(todayDate, windowDays - 1));

  const extendedEndISO = formatDate(
    addDays(todayDate, windowDays + topupDays - 1)
  );

  const { data: regionAllocated, error: regionFutureErr2 } = await supabase
    .from("questions_allocated_region")
    .select("puzzle_date")
    .eq("region", regionId)
    .gte("puzzle_date", windowStartISO)
    .lte("puzzle_date", strictWindowEndISO);

  if (regionFutureErr2) throw regionFutureErr2;

  const expected = buildDateSet(todayDate, windowDays);
  const actual = new Set((regionAllocated ?? []).map((d) => d.puzzle_date));
  const earliestGap = earliestMissing(expected, actual);

  if (earliestGap) {
    inserts.push({
      scope_type: "region",
      scope_id: regionId,
      tier: null,
      region: regionId,
      start_date: windowStartISO,   // ALWAYS today
      end_date: extendedEndISO,     // ALWAYS full window
      trigger_reason: `future_window_gap_${windowDays}`,
      run_id: runId,
      priority: 1
    });
  } else if ((regionAllocated?.length ?? 0) < windowDays) {
    inserts.push({
      scope_type: "region",
      scope_id: regionId,
      tier: null,
      region: regionId,
      start_date: windowStartISO,
      end_date: extendedEndISO,
      trigger_reason: `future_below_min_${windowDays}`,
      run_id: runId,
      priority: 1
    });
  }
}

  // ARCHIVE strict window + seed coverage + extended topup
  const regionArchiveSettings = await getSettings("region", null, "archive");
  if (regionArchiveSettings) {
    const seedAmount = regionArchiveSettings.seed_amount ?? 0;
    const windowDays = regionArchiveSettings.min_threshold ?? 0;
    const topupDays = regionArchiveSettings.target_topup ?? windowDays;

    const windowEnd = addDays(todayDate, -1);
    const windowStart = addDays(todayDate, -windowDays);
    const windowStartISO = formatDate(windowStart);
    const windowEndISO = formatDate(windowEnd);

    // NEW: extended archive end (yesterday + topup)
    const extendedArchiveEndISO = formatDate(
      addDays(windowEnd, topupDays)
    );

    // Check full seed coverage
    if (seedAmount > 0) {
      const seedStart = addDays(todayDate, -seedAmount);
      const seedEnd = addDays(todayDate, -1);
      const expectedSeed = buildDateSet(seedStart, seedAmount);

      const { data: allocatedSeed, error: allocSeedErr } = await supabase
        .from("questions_allocated_region")
        .select("puzzle_date")
        .eq("region", regionId)
        .gte("puzzle_date", formatDate(seedStart))
        .lte("puzzle_date", formatDate(seedEnd));

      if (allocSeedErr) throw allocSeedErr;

      const actualSeed = new Set(
        (allocatedSeed ?? []).map((d) => d.puzzle_date)
      );
      const earliestGapSeed = earliestMissing(expectedSeed, actualSeed);

      if (earliestGapSeed) {
        inserts.push({
          scope_type: "region",
          scope_id: regionId,
          tier: null,
          region: regionId,
          start_date: earliestGapSeed,
          end_date: clampEnd(
            earliestGapSeed,
            seedAmount,
            formatDate(seedEnd)
          ),
          trigger_reason: `archive_seed_${seedAmount}`,
          run_id: runId,
          priority: 2
        });
      }
    }

    // Existing archive gap logic with extended topup
    if (windowDays > 0) {
      const { data: regionAllocatedPast, error: regionArchErr2 } =
        await supabase
          .from("questions_allocated_region")
          .select("puzzle_date")
          .eq("region", regionId)
          .gte("puzzle_date", windowStartISO)
          .lte("puzzle_date", windowEndISO);

      if (regionArchErr2) throw regionArchErr2;

      const expectedPast = buildDateSet(windowStart, windowDays);
      const actualPast = new Set(
        (regionAllocatedPast ?? []).map((d) => d.puzzle_date)
      );
      const earliestGapPast = earliestMissing(expectedPast, actualPast);

      if (earliestGapPast) {
        inserts.push({
          scope_type: "region",
          scope_id: regionId,
          tier: null,
          region: regionId,
          start_date: earliestGapPast,
          end_date: clampEnd(
            earliestGapPast,
            topupDays,
            extendedArchiveEndISO
          ),
          trigger_reason: `archive_window_gap_${windowDays}`,
          run_id: runId,
          priority: 2
        });
      } else if ((regionAllocatedPast?.length ?? 0) < windowDays) {
        inserts.push({
          scope_type: "region",
          scope_id: regionId,
          tier: null,
          region: regionId,
          start_date: windowStartISO,
          end_date: extendedArchiveEndISO,
          trigger_reason: `archive_below_min_${windowDays}`,
          run_id: runId,
          priority: 2
        });
      }
    }
  }
}
} // end for (const regionId of regionIds)
// -------------------------
// ARCHIVE USAGE CHECK (GLOBAL RUN ONLY)
// -------------------------
if (!targetUserId && !targetRegion) {
  console.log("[ArchiveUsage] Checking archive usage for all users");

  const { data: usageRows, error: usageErr } = await supabase
    .from("user_profiles")
    .select(`
      id,
      region,
      user_tier!inner(tier),
      questions_allocated_user!left(
        puzzle_date,
        slot_type,
      )
    `);

  if (usageErr) {
    console.error("[ArchiveUsage] Query failed:", usageErr);
  } else {
    for (const u of usageRows ?? []) {
      const tier = u.user_tier?.tier ?? null;

      const settings = await getSettings("user", tier, "archive");
      if (!settings) continue;

      const minThreshold = settings.min_threshold ?? 0;

      const allocated = (u.questions_allocated_user ?? [])
        .filter(r => r.slot_type === "archive" && r.puzzle_date < formatDate(todayDate))
        .length;

      const answered = (u.questions_allocated_user ?? [])
        .filter(r => r.slot_type === "archive" && r.puzzle_date < formatDate(todayDate) && r.answered_at)
        .length;

      const remaining = allocated - answered;

      if (remaining < minThreshold) {
        const startISO = formatDate(addDays(todayDate, -minThreshold));
        const endISO = formatDate(addDays(todayDate, -1));

        inserts.push({
          scope_type: "user",
          scope_id: u.id,
          tier,
          region: u.region,
          start_date: startISO,
          end_date: endISO,
          trigger_reason: "archive_usage_extension",
          run_id: runId,
          priority: 2
        });

        console.log(
          `[ArchiveUsage] User ${u.id} has only ${remaining} archive left (< ${minThreshold}) → extending archive`
        );
      }
    }

    // -------------------------
    // REGION ARCHIVE USAGE CHECK
    // -------------------------
    const regionRemaining = new Map();

    for (const u of usageRows ?? []) {
      const tier = u.user_tier?.tier ?? null;
      const settings = await getSettings("user", tier, "archive");
      if (!settings) continue;

      const allocated = (u.questions_allocated_user ?? [])
        .filter(r => r.slot_type === "archive" && r.puzzle_date < formatDate(todayDate))
        .length;

      const answered = (u.questions_allocated_user ?? [])
        .filter(r => r.slot_type === "archive" && r.puzzle_date < formatDate(todayDate) && r.answered_at)
        .length;

      const remaining = allocated - answered;

      if (!regionRemaining.has(u.region)) regionRemaining.set(u.region, []);
      regionRemaining.get(u.region).push(remaining);
    }

    for (const [region, remainings] of regionRemaining.entries()) {
      const lowest = Math.min(...remainings);

      const regionSettings = await getSettings("region", null, "archive");
      if (!regionSettings) continue;

      const regionMin = regionSettings.min_threshold ?? 0;

      if (lowest < regionMin) {
        const startISO = formatDate(addDays(todayDate, -regionMin));
        const endISO = formatDate(addDays(todayDate, -1));

        inserts.push({
          scope_type: "region",
          scope_id: region,
          tier: null,
          region,
          start_date: startISO,
          end_date: endISO,
          trigger_reason: "region_archive_usage_extension",
          run_id: runId,
          priority: 2
        });

        console.log(
          `[ArchiveUsage][Region] Region ${region} lowest remaining = ${lowest} (< ${regionMin}) → extending region archive`
        );
      }
    }
  }
}

// -------------------------
// GLOBAL RUN: RESET ALL EXISTING DEMAND ROWS
// -------------------------
if (!targetUserId && !targetRegion) {
  console.log("[Global] Resetting all existing demand rows to pending");

  const { error: resetErr } = await supabase
    .from("demand_summary")
    .update({
      status: "pending",
      processed_at: null
    })
    .neq("status", "pending"); // only reset processed rows

  if (resetErr) throw resetErr;
}

// -------------------------
// 3‑DAY FUTURE FAILSAFE (GLOBAL RUN ONLY)
// -------------------------
if (!targetUserId && !targetRegion) {
  console.log("[Failsafe] Running 3‑day future coverage check for all users");

  // Fetch all users
const { data: allUsers, error: userErr } = await supabase
  .from("user_profiles")
  .select("id, region, user_tier:user_tier_id (tier)");

  if (userErr) throw userErr;

  const day0 = formatDate(todayDate);
  const day1 = formatDate(addDays(todayDate, 1));
  const day2 = formatDate(addDays(todayDate, 2));
  const next3 = [day0, day1, day2];

  for (const user of allUsers) {
    const userId = user.id;

    // Fetch allocated future days for this user
    const { data: allocated, error: allocErr } = await supabase
      .from("questions_allocated_user")
      .select("puzzle_date")
      .eq("user_id", userId)
      .in("puzzle_date", next3);

    if (allocErr) throw allocErr;

    const allocatedSet = new Set((allocated ?? []).map((d) => d.puzzle_date));
    const missing = next3.filter((d) => !allocatedSet.has(d));

    if (missing.length > 0) {
      const start = missing[0];
      const end = missing[missing.length - 1];
      const tier = user.user_tier?.tier ?? null;

      inserts.push({
        scope_type: "user",
        scope_id: userId,
        tier,
        region: user.region,
        start_date: start,
        end_date: end,
        trigger_reason: "future_3day_failsafe",
        run_id: runId,
        priority: 0
      });

      console.log(
        `[Failsafe] User ${userId} missing ${missing.length} future days → ${start} to ${end}`
      );
    }
  }
}


// -------------------------
// INSERT / UPSERT NEW DEMAND SNAPSHOT
// -------------------------
if (inserts.length > 0) {
  console.log(`Clearing legacy demand rows before upsert for ${targetUserId ?? targetRegion ?? "global"}`);

  // Clear any legacy rows for this scope (user or region)
  if (targetUserId) {
    const { error: clearLegacyErr } = await supabase
      .from("demand_summary")
      .delete()
      .eq("scope_type", "user")
      .eq("scope_id", targetUserId);
    if (clearLegacyErr) {
      console.error("[CalculateDemand] Legacy clear failed:", clearLegacyErr);
    }
  } else if (targetRegion) {
    const { error: clearLegacyErr } = await supabase
      .from("demand_summary")
      .delete()
      .eq("scope_type", "region")
      .eq("scope_id", targetRegion);
    if (clearLegacyErr) {
      console.error("[CalculateDemand] Legacy clear failed:", clearLegacyErr);
    }
  }

  console.log(`Upserting ${inserts.length} demand rows into demand_summary`, inserts);

  // Upsert to avoid duplicate key errors
  const upsertsWithStatus = inserts.map((row) => ({
    ...row,
    status: "pending",
    processed_at: null
  }));

const { error } = await supabase
  .from("demand_summary")
  .upsert(upsertsWithStatus, { onConflict: ["scope_type", "scope_id", "trigger_reason"] });


  if (error) throw error;
} else {
  console.log(`No demand rows generated for ${targetUserId ?? targetRegion ?? "global"} — likely already fully allocated or thresholds = 0`);
}


    // If demand rows were inserted, trigger allocation immediately
    if (inserts.length > 0) {
      await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/allocate-questions`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          user_id: targetUserId,
          region: targetRegion
        })
      });
    }
    return new Response(JSON.stringify({
      runId,
      scope: targetUserId ? `user:${targetUserId}` : targetRegion ? `region:${targetRegion}` : "global",
      inserted: inserts.length
    }), {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json"
      }
    });
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({
      error: String(err)
    }), {
      status: 500,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json"
      }
    });
  }
});
