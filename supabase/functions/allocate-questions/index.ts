// supabase/functions/allocate-questions/index.ts
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
function dateRange(start, end) {
  const dates = [];
  let d = new Date(start);
  while(d <= end){
    dates.push(formatDate(d));
    d.setDate(d.getDate() + 1);
  }
  return dates;
}
// Centralised error logger that flags 42703 (unknown column) explicitly
function logDbError(label, err, context) {
  const code = err?.code ?? err?.status ?? null;
  const message = err?.message ?? String(err);
  const hint = err?.hint ?? null;
  console.error(`[${label}]`, {
    code,
    message,
    hint,
    context
  });
  if (code === "42703") {
    console.error(`[${label}] Column error detected (42703). Check for leftover 'category' references against available_question_spec or related views/functions.`, {
      context
    });
  }
}
// Spec query logging helpers
function logSpecQuery(scopeLabel, params) {
  console.log(`[SpecQuery:${scopeLabel}]`, params);
}
function logSpecInsert(scopeLabel, payload) {
  console.log(`[SpecInsert:${scopeLabel}] payload`, payload);
}
function logSpecInsertResult(scopeLabel, newSpec) {
  console.log(`[SpecInsert:${scopeLabel}] result`, {
    id: newSpec?.id,
    newSpec
  });
}
/**
 * Build a slot plan for a user demand window.
 * Ensures a balanced mix of location vs category slots,
 * respects user tier and preferences, and enforces rules like
 * "today must be a location slot".
 */
async function buildUserSlotPlan(missingDates: string[], userPrefs: number[], tier: string, recentAllocData: any[]) {
  const totalSlots = missingDates.length;

  // Count recent allocations (last 14 days) to balance
  const recentByType: Record<string, number> = {};
  for (const r of recentAllocData ?? []) {
    if (r.slot_type === "location") {
      recentByType["location"] = (recentByType["location"] ?? 0) + 1;
    } else if (r.slot_type === "category" && r.category_id) {
      recentByType[r.category_id] = (recentByType[r.category_id] ?? 0) + 1;
    }
  }

  // Target ratio: 1/3 location, 2/3 category
let targetLocation = Math.round(totalSlots / 3);
let targetCategory = totalSlots - targetLocation;

// Adjust location target based on recent allocations
targetLocation = Math.max(0, targetLocation - (recentByType["location"] ?? 0));

// ✅ Force minimum location slots for PRO users with no prefs
if (tier === "pro" && userPrefs.length === 0) {
  const minLocation = Math.max(1, Math.floor(totalSlots / 3));
  targetLocation = Math.max(targetLocation, minLocation);
  targetCategory = totalSlots - targetLocation;
}

  // Build category targets
  const categoryTargets: Record<number, number> = {};

    // Precompute shuffled category list for user slot planning (exclude 999)
  const allCatsForPlan = await getAllCategoryIds();
  let validCatsForPlan = allCatsForPlan.filter(c => c !== 999);
  validCatsForPlan = shuffle(validCatsForPlan);

  let planCatIdx = 0;
  function nextPlanCategory(): number {
    if (planCatIdx >= validCatsForPlan.length) {
      validCatsForPlan = shuffle(validCatsForPlan);
      planCatIdx = 0;
    }
    return validCatsForPlan[planCatIdx++];
  }

  if (tier === "pro" && userPrefs.length > 0) {
    // Distribute evenly across selected prefs
    const perCat = Math.floor(targetCategory / userPrefs.length);
    for (const cat of userPrefs) {
      categoryTargets[cat] = Math.max(0, perCat - (recentByType[cat] ?? 0));
    }
  } else {
    // No prefs → distribute across full list fairly
    for (let i = 0; i < targetCategory; i++) {
      const cat = nextPlanCategory();
      categoryTargets[cat] = (categoryTargets[cat] ?? 0) + 1;
    }
  }

  // Build slot list
  const slots: { slot_type: "location" | "category"; category_id?: number | null }[] = [];

  for (let i = 0; i < targetLocation; i++) {
    slots.push({ slot_type: "location" });
  }

  for (const [cat, count] of Object.entries(categoryTargets)) {
    const numCount = Number(count);
    for (let i = 0; i < numCount; i++) {
      slots.push({
        slot_type: "category",
        category_id: Number(cat)
      });
    }
  }

  // Fill any remaining slots with fair categories (never null)
  while (slots.length < totalSlots) {
    const cat = nextPlanCategory();
    slots.push({
      slot_type: "category",
      category_id: cat
    });
  }

  // Shuffle for fairness
  const shuffled = shuffle(slots);

  // Enforce rule: today must be location
  const todayStr = formatDate(new Date());
  return missingDates.map((date, idx) => {
    if (date === todayStr) {
      return { slot_type: "location" };
    }
    return shuffled[idx];
  });
}


function splitDateRanges(start, end, parts) {
  // End "9999-01-01" is a sentinel meaning "up to today"
  const startDate = new Date(start);
  const endDate = end === "9999-01-01" ? new Date() : new Date(end);
  const totalMs = endDate.getTime() - startDate.getTime();
  const oneDayMs = 24 * 60 * 60 * 1000;
  // Build boundaries (parts+1 points)
  const boundaries = [];
  for(let i = 0; i <= parts; i++){
    const t = startDate.getTime() + Math.floor(totalMs * i / parts);
    boundaries.push(new Date(t));
  }
  const ranges = [];
  for(let i = 0; i < parts; i++){
    // Start at boundary[i], except bump by +1 day for parts after the first
    const rawStart = boundaries[i];
    const startAdj = i === 0 ? rawStart : new Date(rawStart.getTime() + oneDayMs);
    // End at boundary[i+1], except last part uses sentinel '9999-01-01'
    const rawEnd = boundaries[i + 1];
    const endStr = i === parts - 1 ? "9999-01-01" : formatDate(rawEnd);
    ranges.push({
      start_date: formatDate(startAdj),
      end_date: endStr
    });
  }
  return ranges;
}
// Fetch user category preferences (ids)
async function getUserCategoryIds(userId) {
  const { data, error } = await supabase.from("user_category_preferences").select("category_id").eq("user_id", userId);
  if (error) throw error;
  return (data ?? []).map((r)=>r.category_id);
}
// Fetch all category ids
async function getAllCategoryIds() {
  const { data, error } = await supabase.from("categories").select("id");
  if (error) throw error;
  return (data ?? []).map((r)=>r.id);
}

// Resolve user tier via user_profiles.user_tier_id -> user_tier.id
async function getUserTierIdForUser(userId: string): Promise<number | null> {
  // 1) read user_profiles.user_tier_id
  const { data: profileRows, error: profileErr } = await supabase
    .from("user_profiles")
    .select("user_tier_id")
    .eq("id", userId)
    .limit(1);

  if (profileErr) throw profileErr;
  const tierFk = (profileRows?.[0]?.user_tier_id ?? null);

  if (tierFk === null) return null;

  // 2) read user_tier.id (canonical)
  const { data: tierRows, error: tierErr } = await supabase
    .from("user_tier")
    .select("id")
    .eq("id", tierFk)
    .limit(1);

  if (tierErr) throw tierErr;
  return tierRows?.[0]?.id ?? null;
}


// Resolve user tier via user_profiles.user_tier_id -> user_tier.tier (string)
async function getUserTierForUser(userId: string): Promise<string | null> {
  // 1) read user_profiles.user_tier_id
  const { data: profileRows, error: profileErr } = await supabase
    .from("user_profiles")
    .select("user_tier_id")
    .eq("id", userId)
    .limit(1);

  if (profileErr) throw profileErr;
  const tierFk = profileRows?.[0]?.user_tier_id ?? null;
  if (tierFk === null) return null;

  // 2) read user_tier.tier (canonical string, e.g. "pro", "standard")
  const { data: tierRows, error: tierErr } = await supabase
    .from("user_tier")
    .select("tier")
    .eq("id", tierFk)
    .limit(1);

  if (tierErr) throw tierErr;
  return tierRows?.[0]?.tier ?? null;
}

// Helper: interpret pro based on tier name string
function isProTierName(tierName: string | null): boolean {
  return tierName?.toLowerCase() === "pro";
}


// Fetch recent allocations for balancing (from generation queue as proxy)
async function getRecentAllocations(scopeType, scopeId) {
  const since = new Date();
  since.setDate(since.getDate() - 14);
  const { data, error } = await supabase.from("questions_to_generate").select("category_id").eq("scope_type", scopeType).eq("scope_id", scopeId).gte("puzzle_date", formatDate(since));
  if (error) throw error;
  return (data ?? []).map((r)=>r.category_id).filter((id)=>id !== null);
}
// Fisher–Yates shuffle
function shuffle(arr) {
  const a = [
    ...arr
  ];
  for(let i = a.length - 1; i > 0; i--){
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [
      a[j],
      a[i]
    ];
  }
  return a;
}
serve(async (req)=>{
// Handle CORS preflight
const corsHeaders = getCorsHeaders(req);
if (req.method === "OPTIONS") {
  return new Response("ok", { headers: corsHeaders });
}

  try {
    const allocatorRunId = crypto.randomUUID();
    // Parse optional input for scoping
    let targetUserId = null;
    let targetRegion = null;
    try {
      const body = await req.json();
      targetUserId = body.user_id ?? null;
      targetRegion = body.region ?? null;
    } catch  {
    // no body → global run
    }

// Force fresh read of category preferences to avoid stale cache
if (targetUserId) {
  const { data: categories, error: catErr } = await supabase
    .from("user_category_preferences")
    .select("*")
    .eq("user_id", targetUserId);

  if (catErr) {
    logDbError("UserCategoryFetch", catErr, { allocatorRunId, scope_id: targetUserId });
  } else {
    console.log("[Allocator] Fresh category preferences loaded:", categories);
  }
}

    // Load pending demand rows
    let demandQuery = supabase.from("demand_summary").select("*").eq("status", "pending").order("priority", {
      ascending: true
    }).order("start_date", {
      ascending: true
    });
    if (targetUserId) {
      demandQuery = demandQuery.eq("scope_type", "user").eq("scope_id", targetUserId);
    } else if (targetRegion) {
      demandQuery = demandQuery.eq("scope_type", "region").eq("scope_id", targetRegion);
    }
    const { data: demands, error } = await demandQuery;
    if (error) {
      logDbError("LoadDemands", error, {
        allocatorRunId
      });
      return new Response(JSON.stringify({
        error: String(error)
      }), {
        status: 500
      });
    }
    const toGenerate = [];
    const allocationLogs = [];
    for (const d of demands ?? []){
      const allDates = dateRange(new Date(d.start_date), new Date(d.end_date));
      // Look up existing allocations for this scope
      const allocTable = d.scope_type === "user" ? "questions_allocated_user" : "questions_allocated_region";
      const { data: existing, error: existErr } = await supabase.from(allocTable).select("puzzle_date").eq(d.scope_type === "user" ? "user_id" : "region", d.scope_id).gte("puzzle_date", d.start_date).lte("puzzle_date", d.end_date);
      if (existErr) {
        logDbError("ExistingAllocLookup", existErr, {
          allocatorRunId,
          demand_run_id: d.run_id,
          allocTable
        });
        continue;
      }
      const existingDates = new Set((existing ?? []).map((e)=>e.puzzle_date));
const missingDatesRaw = allDates.filter((date)=>!existingDates.has(date));

const todayStr = formatDate(new Date());
const todayDate = new Date(todayStr);

// Helper to convert string → Date
function toDate(str: string): Date { return new Date(str); }

// Partition missing dates
const todayDates = missingDatesRaw.filter(d => d === todayStr);

const pastDates = missingDatesRaw
  .filter(d => toDate(d) < todayDate)
  .sort((a,b) => toDate(b).getTime() - toDate(a).getTime()); // ✅ most recent first

const futureDates = missingDatesRaw
  .filter(d => toDate(d) > todayDate)
  .sort((a,b) => toDate(a).getTime() - toDate(b).getTime()); // ✅ soonest first

// Slice into windows
const past7 = pastDates.slice(0,7);
const pastRemaining = pastDates.slice(7);

const future7 = futureDates.slice(0,7);
const futureRemaining = futureDates.slice(7);

// Final ordered list
const missingDates = [
  ...todayDates,
  ...past7,
  ...future7,
  ...pastRemaining,
  ...futureRemaining
];

console.log("[Allocator] Ordered missingDates:", missingDates);

// --- BEGIN: honor existing queued reservations and seed queuedByDate ---
const { data: queuedJobs, error: queuedErr } = await supabase
  .from("questions_to_generate")
  .select("puzzle_date, slot_type, category_id, populated_place_id")
  .eq("scope_type", d.scope_type)
  .eq("scope_id", d.scope_id)
  .in("puzzle_date", missingDates);

if (queuedErr) {
  logDbError("QueuedJobsFetch", queuedErr, {
    allocatorRunId,
    scope_id: d.scope_id,
    missingDatesCount: missingDates.length
  });
}

// Map of date -> queued intent
const queuedByDate = new Map<string, {
  slot_type: "location" | "category";
  category_id: number | null;
  populated_place_id: number | null;
}>();

for (const q of queuedJobs ?? []) {
  queuedByDate.set(q.puzzle_date, {
    slot_type: q.slot_type as "location" | "category",
    category_id: q.category_id ?? null,
    populated_place_id: q.populated_place_id ?? null
  });
}
// --- END: honor existing queued reservations and seed queuedByDate ---


let allocatedCount = 0;
let generatedCount = 0;
let unmetCount = 0;

if (missingDates.length === 0) {
  const { error: updNoneErr } = await supabase.from("demand_summary").update({
    status: "processed",
    processed_at: new Date().toISOString()
  }).eq("id", d.id);

  if (updNoneErr) {
    logDbError("MarkProcessedNone", updNoneErr, {
      allocatorRunId,
      demand_row_id: d.id
    });
    continue;
  }

  allocationLogs.push({
    run_id: allocatorRunId,
    demand_run_id: d.run_id,
    demand_row_id: d.id,
    scope_type: d.scope_type,
    scope_id: d.scope_id,
    allocated_count: 0,
    generated_count: 0,
    unmet_count: 0,
    status: "success",
    created_at: new Date().toISOString()
  });
  continue;
}

if (d.scope_type === "region") {
  try {
    const { data: alreadyAlloc, error: allocErr } = await supabase
      .from("questions_allocated_region")
      .select(`
        question_id,
        category_id,
        categories ( name )
      `)
      .eq("region", d.scope_id);

    if (allocErr) {
      logDbError("RegionPreload", allocErr, {
        allocatorRunId,
        demand_run_id: d.run_id,
        scope_id: d.scope_id
      });
      unmetCount++;
      continue;
    }

    const usedQuestionIds = new Set((alreadyAlloc ?? []).map(r => r.question_id).filter(id => id !== null));

    // ✅ Paginate through all master questions
    let masterPool = [];
    let page = 0;
    const pageSize = 1000;
    let done = false;

    while (!done) {
      const { data, error } = await supabase
        .from("questions_master_region")
        .select("id, categories, question_kind, quality_score, target_sphere")
        .or('quality_score.is.null,quality_score.gte.3')
        .range(page * pageSize, (page + 1) * pageSize - 1);

      if (error) {
        logDbError("RegionMasterPoolPage", error, {
          allocatorRunId,
          demand_run_id: d.run_id,
          page
        });
        unmetCount++;
        break;
      }

      if (!data || data.length === 0) {
        done = true;
        break;
      }

      masterPool = masterPool.concat(data);
      if (data.length < pageSize) done = true;
      page++;
    }

    console.log("[Allocator][Region] Master pool loaded", {
      total: masterPool.length,
      includesTarget: masterPool.some(m => m.id === 1727),
      targetEntry: masterPool.find(m => m.id === 1727)
    });

    let availableMasters = (masterPool ?? []).filter(m => !usedQuestionIds.has(m.id));
    const categoryMasters = availableMasters.filter(m => m.question_kind === "category");

    const recent = await getRecentAllocations("region", d.scope_id);
    const recentCounts = {};
    for (const id of recent) {
      recentCounts[id] = (recentCounts[id] ?? 0) + 1;
    }

    availableMasters = shuffle(availableMasters);
    availableMasters.sort((a, b) => {
      const aCat = (a.categories && a.categories[0]) ?? null;
      const bCat = (b.categories && b.categories[0]) ?? null;
      return (recentCounts[aCat] ?? 0) - (recentCounts[bCat] ?? 0);
    });

    let nextMasterIdx = 0;


// Pre-fetch and shuffle valid categories once (exclude 999)
const allCats = await getAllCategoryIds();
let validCats = shuffle(allCats.filter(c => c !== 999));
let regionCatIdx = 0;
function nextRegionCategory(): number {
  if (regionCatIdx >= validCats.length) {
    validCats = shuffle(validCats);
    regionCatIdx = 0;
  }
  return validCats[regionCatIdx++];
}

for (const date of missingDates) {
  const chosenCat = nextRegionCategory();

  // Try to find a master for that chosen category
// Exclude any already used master IDs (redundant safeguard)
const unusedCategoryMasters = categoryMasters.filter(m => !usedQuestionIds.has(m.id));

// Filter by chosenCat membership in categories
const matchingMasters = unusedCategoryMasters.filter(m => {
  const cats = Array.isArray(m.categories) ? m.categories : [];
  return cats.includes(chosenCat);
});

// Pick one randomly if available
const master = matchingMasters.length > 0
  ? matchingMasters[Math.floor(Math.random() * matchingMasters.length)]
  : null;

if (master) {
  const primaryCategory = Array.isArray(master.categories) ? master.categories[0] : chosenCat;
  const { error: insErr } = await supabase.from("questions_allocated_region").insert({
    region: "UK",
    puzzle_date: date,
    question_id: master.id,
    slot_type: "category",
    category_id: primaryCategory,
    trigger_reason: d.trigger_reason,
    demand_run_id: d.run_id,
    allocator_run_id: allocatorRunId,
    created_at: new Date().toISOString()
  });

  if (!insErr) {
    allocatedCount++;
    continue;
  } else if (insErr?.code === "23505") {
    // Duplicate allocation for this date — safe to skip
    logDbError("RegionMasterAllocInsert(duplicate)", insErr, {
      allocatorRunId, date, master_id: master.id, primaryCategory
    });
    continue;
  } else {
    logDbError("RegionMasterAllocInsert", insErr, {
      allocatorRunId, date, master_id: master.id, primaryCategory
    });
    unmetCount++;
    continue;
  }
}


try {
  // Category specs are UK — never auto-create, they should exist from Phase 3
  const { data: specs, error: specErr } = await supabase
    .from("available_question_spec")
    .select("id")
    .eq("region", "UK")
    .eq("category_id", chosenCat)
    .eq("active", true);

  if (specErr) {
    logDbError("SpecLookup(region-category)", specErr, {
      allocatorRunId, region: "UK", category_id: chosenCat
    });
    unmetCount++;
    continue;
  }

  let chosenSpecId: number | null = null;
  if (specs && specs.length > 0) {
    const idx = Math.floor(Math.random() * specs.length);
    chosenSpecId = specs[idx].id;
  } else {
    // Failsafe: auto-create UK specs for a new category
    console.warn(`[allocate] No UK spec found for category ${chosenCat} — auto-creating`);
    const ranges = splitDateRanges("0001-01-01", "9999-01-01", 8);
    const payloads = ranges.map((r) => ({
      region: "UK",
      category_id: chosenCat,
      location: null,
      start_date: r.start_date,
      end_date: r.end_date,
      created_at: new Date().toISOString()
    }));
    const { data: newSpecs, error: newSpecErr } = await supabase
      .from("available_question_spec")
      .insert(payloads)
      .select();

    if (newSpecErr) {
      logDbError("SpecInsert(region-category)", newSpecErr, {
        allocatorRunId, payloads
      });
      unmetCount++;
      continue;
    }
    chosenSpecId = newSpecs[Math.floor(Math.random() * newSpecs.length)].id;
  }

// Priority by proximity to today
const today = formatDate(new Date());
const puzzleDateStr = formatDate(new Date(date));

let priorityVal: number;
if (puzzleDateStr === today) {
  priorityVal = 1; // absolute priority for today's question
} else {
  const diffDays = Math.floor((new Date(date).getTime() - new Date(today).getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays <= 7) {
    priorityVal = 2;
  } else if (diffDays <= 14) {
    priorityVal = 3;
  } else {
    priorityVal = 4;
  }
}


  toGenerate.push({
    scope_type: "region",
    scope_id: d.scope_id,
    region: d.region,
    puzzle_date: date,
    slot_type: "category",
    category_id: chosenCat,
    trigger_reason: d.trigger_reason,
    demand_run_id: d.run_id,
    allocator_run_id: allocatorRunId,
    priority: priorityVal,
    status: "pending",
    spec_id: chosenSpecId,
    created_at: new Date().toISOString()
  });
  generatedCount++;
} catch (err) {
  logDbError("RegionFallback", err, { allocatorRunId, scope_id: d.scope_id, date });
  unmetCount++;
  continue;
}

}

          // Mark demand row as processed once all dates attempted
const { error: updErr } = await supabase.from("demand_summary").update({
  status: "processed",
  processed_at: new Date().toISOString()
}).eq("id", d.id);

if (updErr) {
  logDbError("MarkProcessed(region)", updErr, {
    allocatorRunId,
    demand_row_id: d.id
  });
}

// Push allocation log entry for auditing
allocationLogs.push({
  run_id: allocatorRunId,
  demand_run_id: d.run_id,
  demand_row_id: d.id,
  scope_type: d.scope_type,
  scope_id: d.scope_id,
  allocated_count: allocatedCount,
  generated_count: generatedCount,
  unmet_count: unmetCount,
  status: updErr ? "error" : "success",
  created_at: new Date().toISOString()
});

        } catch (err) {
          logDbError("RegionAllocBlock", err, {
            allocatorRunId,
            demand_run_id: d.run_id
          });
          unmetCount++;
          continue;
        }
      } else if (d.scope_type === "user") {
        console.log("[UserBranch] Entered user allocation block", {
          allocatorRunId,
          demand_run_id: d.run_id,
          scope_id: d.scope_id,
          tier: d.tier,
          missingDates: missingDates.length
        });


// USER BRANCH (direct allocation: 50:50 mix, enforce today=location)
try {
  const { data: alreadyAlloc, error: allocErr } = await supabase
    .from("questions_allocated_user")
    .select(`
      question_id,
      category_id,
      categories ( name )
    `)
    .eq("user_id", d.scope_id);

  if (allocErr) {
    logDbError("UserPreload", allocErr, { allocatorRunId, demand_run_id: d.run_id, scope_id: d.scope_id });
    unmetCount++;
    continue;
  }

  const usedQuestionIds = new Set((alreadyAlloc ?? [])
    .map(r => r.question_id)
    .filter(id => id !== null));

let masterPool = [];
let page = 0;
const pageSize = 1000;
let done = false;

while (!done) {
  const { data, error } = await supabase
    .from("questions_master_user")
    .select("id, categories, populated_place_id, question_kind, quality_score, target_sphere, excluded_spheres, regions")
    .or('quality_score.is.null,quality_score.gte.3')
    .range(page * pageSize, (page + 1) * pageSize - 1);

  if (error) {
    logDbError("UserMasterPoolPage", error, { allocatorRunId, page });
    break;
  }

  if (data.length < pageSize) {
    done = true;
  }

  masterPool = masterPool.concat(data);
  page++;
}

  let availableMasters = (masterPool ?? [])
    .filter(m => !usedQuestionIds.has(m.id));

  // --- Tier 1 / ROW category wall ---
  // Fetch user's region, sub_region, and country reference data
  const { data: userProfileForSphere } = await supabase
    .from("user_profiles")
    .select("region, sub_region")
    .eq("id", d.scope_id)
    .single();

  const userRegionCode = userProfileForSphere?.region ?? 'UK';
  const userSubRegion = userProfileForSphere?.sub_region ?? null;

  const { data: userCountryRef } = await supabase
    .from("reference_countries")
    .select("cultural_sphere_code, is_tier_1")
    .eq("code", userRegionCode)
    .single();

  const isTier1User = userCountryRef?.is_tier_1 ?? false;
  const userSphereCode = userCountryRef?.cultural_sphere_code ?? 'ANG';

  let categoryMasters = availableMasters.filter(m => m.question_kind === "category");
  let locationMasters = availableMasters.filter(m => m.question_kind === "location");

  // Apply Universal Metadata filter to category masters only
  const preCatCount = categoryMasters.length;
  if (isTier1User) {
    // Tier 1: include if user's region code IS IN the regions array, or array contains "ALL"
    categoryMasters = categoryMasters.filter(m => {
      const regions = Array.isArray(m.regions) ? m.regions : [];
      return regions.includes(userRegionCode) || regions.includes('ALL');
    });
  } else {
    // ROW: include if target_sphere is set AND (matches user's sphere OR not excluded)
    categoryMasters = categoryMasters.filter(m => {
      if (!m.target_sphere) return false;
      if (m.target_sphere === userSphereCode) return true;
      const excluded = Array.isArray(m.excluded_spheres) ? m.excluded_spheres : [];
      if (excluded.includes('unique')) return false;
      return !excluded.includes(userSphereCode);
    });
  }
  console.log(`[Allocator][User] Universal metadata filter (tier1=${isTier1User}, region=${userRegionCode}, sphere=${userSphereCode}): category pool ${preCatCount} → ${categoryMasters.length}`);

const userPrefs = await getUserCategoryIds(d.scope_id);

// Resolve canonical tier
let userTierName = await getUserTierForUser(d.scope_id);
const isPro = isProTierName(userTierName);

// If PRO and no prefs → treat as "all categories allowed"
let effectivePrefs = userPrefs;
if (isPro && userPrefs.length === 0) {
    effectivePrefs = await getAllCategoryIds();   // <-- key fix
}

// Filter category masters only if prefs exist
if (effectivePrefs.length > 0) {
    categoryMasters = categoryMasters.filter(m => {
        if (!m.categories || m.categories.length === 0) return false;
        return m.categories.some(c => effectivePrefs.includes(c));
    });
}


  const { data: locAlloc, error: locErr } = await supabase
    .from("location_allocation")
    .select(`
      location_id,
      allocation_active,
      score,
      populated_places!inner(active)
    `)
    .eq("user_id", d.scope_id);

  if (locErr) {
    logDbError("UserLocationAllocFetch", locErr, { allocatorRunId, scope_id: d.scope_id });
    unmetCount++;
    continue;
  }

  // Top-scoring first, then round-robin
  const sortedPlaces = (locAlloc ?? [])
    .filter(r => {
      if (r.populated_places?.active) return true;
      if (!r.populated_places?.active && r.allocation_active) return true;
      return false;
    })
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0));

  const userPlaces: (string | null)[] = sortedPlaces.length > 0
    ? [sortedPlaces[0].location_id, ...shuffle(sortedPlaces).map(r => r.location_id)]
    : [];

  const totalSlots = missingDates.length;

// Build slots using preference-aware planner
const recentAllocData = await getRecentAllocations("user", d.scope_id);
const slots = await buildUserSlotPlan(
  missingDates,
  userPrefs,
  isPro ? "pro" : "standard",
  recentAllocData
);

console.log("[Allocator][User] Slot plan built", {
  user_id: d.scope_id,
  tier: isPro ? "pro" : "standard",
  userPrefs,
  slotsCount: slots.length,
  slots
});

  // Helpers
  const todayStrLocal = formatDate(new Date());
  const pickPlaceForIdx = (idx: number): string | null => {
    const candidate = userPlaces[idx % (userPlaces.length || 1)] ?? null;
    return candidate;
  };

// Precompute shuffled category list (exclude sentinel 999)
let validCats = shuffle((await getAllCategoryIds()).filter(c => c !== 999));


let catIdx = 0;
function nextCategory(): number {
  if (catIdx >= validCats.length) {
    // reshuffle and reset when exhausted
    validCats = shuffle(validCats);
    catIdx = 0;
  }
  return validCats[catIdx++];
}

// --- US/ROW LOCATION BRANCH (Option B) ---
// For users with no populated_places (US/ROW), detect their region and
// keep location slots using region/sub_region as the location identity.
if (userPlaces.length === 0) {
  const isUS = userRegionCode === 'US' && userSubRegion;
  const isROW = userRegionCode && userRegionCode !== 'UK' && !isUS;

  if (isUS || isROW) {
    // US/ROW user: use sub_region (US) or region code (ROW) as location identity
    const locationRegion = isUS ? userSubRegion : userRegionCode;
    console.log(`[Allocator][User] US/ROW detected (region=${userRegionCode}, sub_region=${userSubRegion}) → location identity: ${locationRegion}`);
    userPlaces.push(locationRegion);
  } else {
    // UK user with no locations, or unknown → category-only fallback (existing behavior)
    console.log("[Allocator][User] No active locations → converting all location slots to category slots");

    for (let i = 0; i < slots.length; i++) {
      if (slots[i].slot_type === "location") {
        slots[i] = {
          slot_type: "category",
          category_id: nextCategory()
        };
      }
    }

    console.log("[Allocator][User] Updated slot plan (category-only):", slots);
  }
}

  let nextMasterIdx = 0;

  for (const [idx, date] of missingDates.entries()) {

    // --- HONOUR EXISTING QUEUED JOBS FOR THIS DATE ---
const queued = queuedByDate.get(date);
if (queued) {
  console.log("[Allocator][User] Honouring queued job", {
    date,
    queued
  });
  // Do NOT attempt to allocate or generate again for this date.
  // The queued job will be processed by the generator.
  continue;
}

// Enforce rule: today must be location
const slot = slots[idx] ?? { slot_type: "category" as const, category_id: null };

console.log("[Allocator][User] Using slot", {
  date,
  idx,
  slot
});

if (slot.slot_type === "location") {
  const placeId = date === todayStrLocal ? userPlaces[0] ?? null : pickPlaceForIdx(idx);
  const normalizedPlaceId = String(placeId).trim();

  console.log("[Allocator][User][Location] Starting location allocation", {
    user_id: d.scope_id,
    date,
    placeId
  });

  const locMaster = locationMasters.find(
    m => String(m.populated_place_id).trim() === normalizedPlaceId
  );

  let masterFailed = false;

  if (locMaster) {
    const insertPayload = {
      user_id: d.scope_id,
      puzzle_date: date,
      question_id: locMaster.id,
      slot_type: "location",
      category_id: 999,
      trigger_reason: d.trigger_reason,
      demand_run_id: d.run_id,
      allocator_run_id: allocatorRunId,
      created_at: new Date().toISOString()
    };

    const { error: insErr } = await supabase
      .from("questions_allocated_user")
      .insert(insertPayload);

    if (!insErr) {
      console.log("[Allocator][User][Location] Master question allocated", {
        user_id: d.scope_id,
        date,
        placeId,
        locMasterId: locMaster.id
      });
      allocatedCount++;
      continue;
    }

    if (insErr?.code === "23505") {
      console.log("[Allocator][User][Location] Duplicate location allocation skipped", {
        user_id: d.scope_id,
        date,
        placeId,
        locMasterId: locMaster.id
      });
      continue;
    }

    console.error("[Allocator][Error] Insert failed for location master", {
      errorCode: insErr?.code,
      message: insErr?.message,
      payload: insertPayload
    });

    logDbError("UserLocationMasterAllocInsert", insErr, {
      allocatorRunId,
      date,
      placeId,
      locMasterId: locMaster.id
    });

    masterFailed = true;
  } else {
    console.warn("[Allocator][User][Location] No master found for location", {
      user_id: d.scope_id,
      date,
      placeId,
      locationMastersCount: locationMasters.length
    });
    masterFailed = true;
  }

  // 2) If master allocation failed, decide whether we are allowed to generate
  //
  // Virtual locations (US/ROW): placeId is non-numeric (e.g. "US-TX", "US", "DE").
  // These don't exist in location_allocation or populated_places tables,
  // so we treat them as always-active — their location identity comes from
  // the user's sub_region/region, not from the UK populated_places system.
  const isVirtualLocation = placeId && isNaN(Number(placeId));

  if (isVirtualLocation) {
    console.log("[Allocator][User][Location] Virtual location detected — bypassing active check", {
      user_id: d.scope_id,
      date,
      placeId
    });
  } else {
    const placeRow = locAlloc.find(r => r.location_id === placeId);
    const globalActive = placeRow?.populated_places?.active ?? false;
    const userActive = placeRow?.allocation_active ?? false;

    // We ALWAYS allow allocation of existing masters, even if globalActive is false.
    // But we ONLY generate new questions when the place is globally active.
    if (!userActive && !globalActive) {
      console.log("[Allocator][User][Location] Skipping generation — user and global inactive", {
        user_id: d.scope_id,
        date,
        placeId,
        allocation_active: userActive,
        global_active: globalActive
      });
      unmetCount++;
      continue;
    }
  }


  if (masterFailed) {
    try {
      logSpecQuery("user-location", {
        allocatorRunId,
        demand_run_id: d.run_id,
        scope_id: d.scope_id,
        date,
        region: d.region,
        location: placeId,
        active: true
      });

      const { data: specs, error: specErr } = await supabase
        .from("available_question_spec")
        .select("id")
        .eq("region", d.region)
        .eq("location", placeId)
        .eq("category_id", 999)
        .eq("active", true);

      if (specErr) {
        logDbError("SpecLookup(user-location)", specErr, {
          allocatorRunId,
          region: d.region,
          location: placeId
        });
        unmetCount++;
        continue;
      }

      let chosenSpecId: number | null = null;

      if (specs && specs.length > 0) {
        const idxSpec = Math.floor(Math.random() * specs.length);
        chosenSpecId = specs[idxSpec].id;
      } else {
        const ranges = splitDateRanges("0001-01-01", "9999-01-01", 2);
        const payloads = ranges.map(r => ({
          region: d.region,
          location: placeId,
          category_id: 999,
          start_date: r.start_date,
          end_date: r.end_date,
          created_at: new Date().toISOString()
        }));

        const { data: newSpecs, error: newSpecErr } = await supabase
          .from("available_question_spec")
          .insert(payloads)
          .select();

        if (newSpecErr) {
          logDbError("SpecInsert(user-location)", newSpecErr, {
            allocatorRunId,
            payloads
          });
          unmetCount++;
          continue;
        }

        logSpecInsertResult("user-location", newSpecs[0]);
        chosenSpecId = newSpecs[Math.floor(Math.random() * newSpecs.length)].id;
      }

      const today = formatDate(new Date());
      const puzzleDateStr = formatDate(new Date(date));
      const diffDays = Math.floor(
        (new Date(date).getTime() - new Date(today).getTime()) /
          (1000 * 60 * 60 * 24)
      );

      const priorityVal =
        puzzleDateStr === today
          ? 1
          : diffDays <= 7
          ? 2
          : diffDays <= 14
          ? 3
          : 4;

      toGenerate.push({
        scope_type: "user",
        scope_id: d.scope_id,
        region: d.region,
        tier: d.tier,
        puzzle_date: date,
        slot_type: "location",
        populated_place_id: placeId,
        category_id: 999,
        category_hint: null,
        trigger_reason: d.trigger_reason,
        demand_run_id: d.run_id,
        allocator_run_id: allocatorRunId,
        priority: priorityVal,
        status: "pending",
        spec_id: chosenSpecId,
        created_at: new Date().toISOString()
      });

      console.log("[Allocator][User][Location] Fallback spec-based generation queued", {
        user_id: d.scope_id,
        date,
        placeId,
        spec_id: chosenSpecId
      });

      generatedCount++;
      continue;
    } catch (err) {
      logDbError("UserLocationFallback", err, {
        allocatorRunId,
        scope_id: d.scope_id,
        placeId,
        date
      });
      unmetCount++;
      continue;
    }
  }
}

// Category branch: strictly enforce prefs for pro
let chosenCat: number | null = null;

if (isPro) {
    if (effectivePrefs.length > 0) {
        chosenCat = effectivePrefs[idx % effectivePrefs.length];
    } else {
        chosenCat = nextCategory(); // fallback, but now valid
    }
} else {
    chosenCat = nextCategory();
}


// Guard: never use sentinel
if (chosenCat === 999) {
  // Explicit error log: sentinel chosen in category path
  console.error("[Allocator] Sentinel category 999 selected in category branch — coercing to null", {
    user_id: d.scope_id, date, chosenCat, userPrefs, isPro
  });
  chosenCat = null;
}

// If pro and chosenCat is null for any reason, log and skip rather than use non-pref
if (isPro && userPrefs.length > 0 && !chosenCat) {
  console.error("[Allocator] Pro user has no valid chosen category for date — skipping allocation to avoid non-pref", {
    user_id: d.scope_id, date, userPrefs, reason: "null_or_invalid_category"
  });
  unmetCount++;
  continue;
}




// Ensure chosenCat is a real category id
if (chosenCat === 999) chosenCat = null;
if (!chosenCat) {
  chosenCat = nextCategory(); // use the precomputed shuffled iterator
}

// Exclude any already used master IDs (redundant safeguard)
const unusedCategoryMasters = categoryMasters.filter(m => !usedQuestionIds.has(m.id));

// Filter by chosenCat membership in categories
const matchingMasters = unusedCategoryMasters.filter(m => {
  const cats = Array.isArray(m.categories) ? m.categories : [];
  return cats.includes(chosenCat!);
});

// Pick one randomly if available
const catMaster = matchingMasters.length > 0
  ? matchingMasters[Math.floor(Math.random() * matchingMasters.length)]
  : null;

if (catMaster) {
  const { error: insErr } = await supabase.from("questions_allocated_user").insert({
    user_id: d.scope_id,
    puzzle_date: date,
    question_id: catMaster.id,
    slot_type: "category",
    category_id: chosenCat, // strictly enforce the chosen preference
    trigger_reason: d.trigger_reason,
    demand_run_id: d.run_id,
    allocator_run_id: allocatorRunId,
    created_at: new Date().toISOString()
  });

  if (!insErr) {
    console.log("[Allocator][User] Category master allocated", {
      user_id: d.scope_id,
      date,
      chosenCat,
      catMasterId: catMaster.id
    });
    allocatedCount++;
    continue;
  }

  if (insErr?.code === "23505") {
    console.log("[Allocator][User] Duplicate category allocation skipped", {
      user_id: d.scope_id,
      date,
      chosenCat,
      catMasterId: catMaster.id
    });
  } else {
    logDbError("UserCategoryMasterAllocInsert", insErr, {
      allocatorRunId,
      date,
      category_id: chosenCat,
      catMasterId: catMaster.id
    });
  }
}


// If not allocated, proceed to spec-aware fallback (as in the clean version)


// Spec-aware fallback (user + category)
try {
  let chosen = chosenCat;

  if (isPro && userPrefs.length > 0) {
    // Strict for pro: only choose from prefs
    if (!chosen) {
      chosen = userPrefs[idx % userPrefs.length];
    }
    // If still invalid or sentinel, skip rather than use non-pref
    if (!chosen || chosen === 999) {
      console.error("[Allocator] Pro user: no valid category spec to seed; skipping non-pref", {
        user_id: d.scope_id,
        date,
        userPrefs,
        reason: "null_or_sentinel"
      });
      unmetCount++;
      continue;
    }
  } else {
    // Non-pro: fall back to global pool if needed
    if (!chosen || chosen === 999) {
      chosen = nextCategory();
    }
  }

  console.log("[Allocator][User] Spec-aware category selection", {
    user_id: d.scope_id,
    date,
    chosen,
    isPro,
    userPrefs
  });

  logSpecQuery("user-category", {
    allocatorRunId,
    demand_run_id: d.run_id,
    scope_id: d.scope_id,
    date,
    region: d.region,
    category_id: chosen,
    active: true
  });

  // Category specs are UK — never auto-create
  const { data: specs, error: specErr } = await supabase
    .from("available_question_spec")
    .select("id")
    .eq("region", "UK")
    .eq("category_id", chosen)
    .eq("active", true);

  if (specErr) {
    logDbError("SpecLookup(user-category)", specErr, {
      allocatorRunId,
      region: "UK",
      category_id: chosen
    });
    unmetCount++;
    continue;
  }

  let chosenSpecId: number | null = null;
  if (specs && specs.length > 0) {
    const idxSpec = Math.floor(Math.random() * specs.length);
    chosenSpecId = specs[idxSpec].id;
  } else {
    // Failsafe: auto-create UK specs for a new category
    console.warn(`[allocate] No UK spec found for category ${chosen} — auto-creating`);
    const ranges = splitDateRanges("0001-01-01", "9999-01-01", 8);
    const payloads = ranges.map((r) => ({
      region: "UK",
      category_id: chosen,
      location: null,
      start_date: r.start_date,
      end_date: r.end_date,
      created_at: new Date().toISOString()
    }));
    const { data: newSpecs, error: newSpecErr } = await supabase
      .from("available_question_spec")
      .insert(payloads)
      .select();

    if (newSpecErr) {
      logDbError("SpecInsert(user-category)", newSpecErr, {
        allocatorRunId,
        payloads
      });
      unmetCount++;
      continue;
    }
    logSpecInsertResult("user-category", newSpecs[0]);
    chosenSpecId = newSpecs[Math.floor(Math.random() * newSpecs.length)].id;
  }

        // Priority by proximity to today
      const today = formatDate(new Date());
      const puzzleDateStr = formatDate(new Date(date));

      let priorityVal: number;
      if (puzzleDateStr === today) {
        priorityVal = 1;
      } else {
        const diffDays = Math.floor(
          (new Date(date).getTime() - new Date(today).getTime()) /
            (1000 * 60 * 60 * 24)
        );
        if (diffDays <= 7) {
          priorityVal = 2;
        } else if (diffDays <= 14) {
          priorityVal = 3;
        } else {
          priorityVal = 4;
        }
      }

      toGenerate.push({
        scope_type: "user",
        scope_id: d.scope_id,
        region: d.region,
        tier: d.tier,
        puzzle_date: date,
        slot_type: "category",
        category_id: chosen, // enforce chosen
        category_hint: null,
        trigger_reason: d.trigger_reason,
        demand_run_id: d.run_id,
        allocator_run_id: allocatorRunId,
        priority: priorityVal,
        status: "pending",
        spec_id: chosenSpecId,
        created_at: new Date().toISOString()
      });
      generatedCount++;
      continue;
    } catch (err) {
      logDbError("UserCategoryFallback", err, {
        allocatorRunId,
        scope_id: d.scope_id,
        date
      });
      unmetCount++;
      continue;
    }
  }

  // Mark demand row as processed (unchanged)
  const { error: updErr } = await supabase
    .from("demand_summary")
    .update({ status: "processed", processed_at: new Date().toISOString() })
    .eq("id", d.id);

  if (updErr) {
    logDbError("MarkProcessed(user)", updErr, {
      allocatorRunId,
      demand_row_id: d.id
    });
  }

  allocationLogs.push({
    run_id: allocatorRunId,
    demand_run_id: d.run_id,
    demand_row_id: d.id,
    scope_type: d.scope_type,
    scope_id: d.scope_id,
    allocated_count: allocatedCount,
    generated_count: generatedCount,
    unmet_count: unmetCount,
    status: updErr ? "error" : "success",
    created_at: new Date().toISOString()
  });
} catch (err) {
  logDbError("UserAllocBlock", err, {
    allocatorRunId,
    demand_run_id: d.run_id
  });
  unmetCount++;
  continue;
}
      }
    }

    // 🔁 GLOBAL: cleanup any stale queued jobs for this run, then insert
    if (toGenerate.length > 0) {
      const dates = toGenerate.map((j) => j.puzzle_date);
      const locationJobs = toGenerate.filter(j => j.slot_type === "location");
      const categoryJobs = toGenerate.filter(j => j.slot_type === "category");

      console.log(`[Allocator][BatchInsert] Preparing batch: total=${toGenerate.length}, location=${locationJobs.length}, category=${categoryJobs.length}, dates=${dates.length}`);
      if (locationJobs.length > 0) {
        console.log("[Allocator][BatchInsert] Location job sample:", JSON.stringify(locationJobs[0]));
      }

      const { error: delErr } = await supabase
        .from("questions_to_generate")
        .delete()
        .eq("scope_type", toGenerate[0].scope_type)
        .eq("scope_id", toGenerate[0].scope_id)
        .in("puzzle_date", dates);

      if (delErr) {
        logDbError("CleanupPending", delErr, {
          allocatorRunId,
          scope_id: toGenerate[0].scope_id,
          count: dates.length
        });
      } else {
        const { error: insErr } = await supabase
          .from("questions_to_generate")
          .insert(toGenerate);

        if (insErr) {
          console.error("[Allocator][BatchInsert] BATCH INSERT FAILED — falling back to one-by-one", {
            error: insErr.message,
            code: insErr.code,
            details: insErr.details,
            hint: insErr.hint,
            totalJobs: toGenerate.length
          });

          // Fallback: insert one-by-one to identify the problematic entry
          let successCount = 0;
          let failCount = 0;
          for (const job of toGenerate) {
            const { error: singleErr } = await supabase
              .from("questions_to_generate")
              .insert(job);

            if (singleErr) {
              failCount++;
              console.error("[Allocator][BatchInsert] Individual insert FAILED", {
                puzzle_date: job.puzzle_date,
                slot_type: job.slot_type,
                category_id: job.category_id,
                populated_place_id: job.populated_place_id,
                spec_id: job.spec_id,
                error: singleErr.message,
                code: singleErr.code,
                details: singleErr.details
              });
            } else {
              successCount++;
            }
          }
          console.log(`[Allocator][BatchInsert] Fallback complete: ${successCount} succeeded, ${failCount} failed out of ${toGenerate.length}`);
        } else {
          console.log(
            `[Allocator] Inserted ${toGenerate.length} jobs into questions_to_generate (location=${locationJobs.length}, category=${categoryJobs.length})`,
            toGenerate
          );
        }
      }
    }

    if (allocationLogs.length > 0) {
      const { error: logErr } = await supabase
        .from("allocation_log")
        .insert(allocationLogs);
      if (logErr) {
        logDbError("BulkInsertAllocationLogs", logErr, {
          allocatorRunId,
          allocationLogsCount: allocationLogs.length
        });
      }
    }

    return new Response(
      JSON.stringify({
        run_id: allocatorRunId,
        status: "success",
        generated: toGenerate.length,
        logs: allocationLogs
      }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      }
    );
  } catch (err) {
    logDbError("AllocatorTopLevel", err, {});
    return new Response(
      JSON.stringify({
        error: String(err)
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      }
    );
  }
});



