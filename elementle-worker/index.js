const { createClient } = require('@supabase/supabase-js');
const OpenAI = require("openai");

// Environment variables
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const WORKER_MODE = process.env.WORKER_MODE || 'continuous';
const POLL_INTERVAL_MS = 5000;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
// Separate model choices for generation vs verification
const AI_MODEL_GENERATOR = process.env.AI_MODEL_GENERATOR || "gpt-4o";
const AI_MODEL_VERIFIER  = process.env.AI_MODEL_VERIFIER  || "gpt-5.1";



if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables are required');
  process.exit(1);
}
if (!OPENAI_API_KEY) {
  console.error('Error: OPENAI_API_KEY environment variable is required');
  process.exit(1);
}

async function getColumnTypes(table) {
  const { data, error } = await supabase
    .rpc('describe_table_columns', { p_table_name: table }); // <-- you likely don’t have this RPC yet
  if (error) {
    console.warn(`[SchemaDescribe] Failed to describe ${table}:`, error.message);
    return null;
  }
  // Expect rows: { column_name, data_type }
  const map = {};
  for (const r of data || []) {
    map[r.column_name] = r.data_type;
  }
  return map;
}


const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
const openai = new OpenAI({ apiKey: OPENAI_API_KEY });
const crypto = require('crypto');

// Static category list (tightened definitions to reduce catch‑all bias)
const CATEGORY_LIST = `
10 - History & World Events: wars, revolutions, treaties, discoveries, turning points (not politics or culture)
11 - Geography: countries, capitals, borders, landmarks, maps
12 - Science & Inventions: discoveries, breakthroughs, inventions
13 - Technology: computing, internet, space, gadgets
14 - Sports: Olympics, World Cups, matches, records, legends
15 - Music: albums, concerts, artists, genres, charts
16 - Film & TV: movies, premieres, awards, directors, shows
17 - Literature: publications, authors, novels, poetry, movements
18 - Art & Design: art movements, exhibitions, architecture, works
19 - Mythology & Religion: myths, folklore, religious dates
20 - Politics & Current Affairs: elections, leaders, governments, global events (not general history)
21 - Business & Economics: company founding, entrepreneurs, stock market, economic history
22 - Food & Drink: cuisines, product launches, traditions, chefs
23 - Travel & Culture: festivals, traditions, UNESCO sites, practices
24 - Nature & Environment: conservation, climate, ecosystems, species
25 - Health & Medicine: breakthroughs, epidemics, vaccines, healthcare
26 - Language & Words: etymology, speeches, first uses, trivia
27 - Pop Culture & Celebrities: celebrity milestones, viral moments, entertainment culture
28 - Anime: series launches, manga, cultural impact
29 - Video Games: console releases, landmark titles, eSports
`;


function buildPrompt(job, spec, nearbyEvents) {
  let prompt = "";

  // Normalise end_date: replace sentinel 9999-01-01 with today's date
  const effectiveEndDate = spec.end_date === "9999-01-01"
    ? new Date().toISOString().slice(0, 10)
    : spec.end_date;

  // Build a compact nearby list
  const nearbyList = (nearbyEvents || [])
    .slice(0, 25) // cap to avoid huge prompts
    .map(ev => `- ${ev.answer_date_canonical}: ${ev.event_title}`)
    .join("\n");

  const noDuplicateBlock = nearbyList
    ? `Do not duplicate any of the following nearby events:\n${nearbyList}\n`
    : "";

  // Common strictness block
  const strictnessBlock = `
IMPORTANT RULES:
- Do NOT use 1st January as a placeholder when only the year is known.
- Only return dates where the exact day and month are reliably documented.
- If the precise date is not known, return null (JSON null).
- The date range is strictly AD (Anno Domini / Common Era). Do NOT return BC dates.
`;

  // Cultural sphere descriptions for ROW prompts
  const sphereDescriptions = {
    ANG: 'the Anglosphere (UK, US, Canada, Australia, NZ, Ireland)',
    ELA: 'the Euro-Latin American sphere (Western Europe, Latin America)',
    ASI: 'the East & SE Asian sphere (Japan, China, Korea, etc.)',
    SAM: 'the South Asian & MENA sphere (India, Middle East, North Africa)',
    AFR: 'the Sub-Saharan African sphere'
  };

  // Country context from enrichment (set by processJob)
  const countryPromptName = job._countryPromptName || "the United Kingdom";
  const sphereCode = job._sphereCode || "ANG";
  const isTier1 = job._isTier1 ?? false;
  const sphereDescription = sphereDescriptions[sphereCode] || sphereCode;

  // Universal Metadata block — shared across all category prompts (user + region)
  const universalMetadataBlock = `
Universal Metadata Assessment:
In addition to the event itself, you MUST assess which audiences would recognise this event.

### Allocation Rules for Tier 1 Regions (UK, US, CA, AU, NZ, IE)
You must distinguish between "Universal Knowledge" and "Local Ephemera".

1. UNIVERSAL KNOWLEDGE -> regions = ["ALL"]
- Major scientific discoveries and inventions (e.g., Isaac Newton, penicillin, Archimedes).
- Foundational world history and global conflicts (e.g., Rome, World War II, Moon Landing).
- Ancient civilisations, major empires, and truly global events.
These belong in the trivia games of ALL Tier 1 countries.

2. LOCAL EPHEMERA -> regions = only the relevant country codes
- "National Firsts" that are NOT "Global Firsts". If the event is specifically the first time something happened *in one country* (e.g., "First UK petrol car", "Insulin first used in the UK"), it is ONLY relevant to that country.
- Domestic politics, local campaigns, or hyper-local infrastructure.
- Domestic TV, minor celebrities, or local chart music.

### Sphere and Metadata Rules
- The 5 cultural spheres are: ANG (Anglosphere), ELA (Euro-LatAm), ASI (East/SE Asia), SAM (South Asia/MENA), AFR (Sub-Saharan Africa).
- target_sphere: MUST be exactly one of these 5 codes: ANG, ELA, ASI, SAM, AFR. Do NOT use "WW" or any other value.
- excluded_spheres: Array of sphere codes whose audiences would NOT recognise this event.
  Use ["unique"] if strictly local/niche and only relevant to one sphere.
  Use [] (empty array) if universally known worldwide.
  CRITICAL: If regions is ["ALL"], excluded_spheres MUST NOT be ["unique"]. You cannot be universally famous and strictly local.
- regions: Array of Tier 1 ISO codes that would find this event relevant.
  If relevant to ALL Tier 1 countries, output ["ALL"].
  If only relevant to some, list them (e.g. ["UK", "IE"] or ["US", "CA"]).
  If not relevant to any Tier 1 country, output [].
- event_origin: strict 2-letter ISO country code where the event primarily occurred (e.g. "UK", "US", "FR"). Use "WW" only for truly worldwide events with no single origin.
`;

  if (job.scope_type === "user" && job.slot_type === "category") {
    if (isTier1) {
      // Tier 1: bespoke country-specific category question
      prompt = `Generate a memorable or interesting event that happened in or is directly relevant to ${countryPromptName}, suitable as a question in a family game.
The event must be on an exact recorded date and must fall strictly between ${spec.start_date} and ${effectiveEndDate}.
${noDuplicateBlock}The event must relate to the category "${job.category?.name}" (id ${job.category_id}), described as: "${job.category?.description}".
Only return events that appear to be from reliable sources. If none exist for the requested window and scope, return null (JSON null).
Estimate a quality score for the event, based on its historical significance and how interesting or quirky it is, 1 being poor to 5 being excellent.
Also estimate an accuracy_score (integer 1–5). Only give 5 if this is a well-documented event with a precise, reliable recorded date.
${strictnessBlock}
${universalMetadataBlock}
You may also assign up to 2 additional categories but only if they are a very strong match, chosen only from the list below:
${CATEGORY_LIST}

Return a valid JSON object with double‑quoted keys and values, e.g. {"event_title": "...", "categories": [27,15]}, with fields:
- event_title (<=50 chars) - do not include any reference to the date in the title
- event_description (<=200 chars)
- answer_date_canonical (yyyy-mm-dd)
- quality_score (integer 1–5, self-assessed quality of the event)
- accuracy_score (integer 1–5, 5 = well-documented with precise date)
- categories (include ${job.category_id}, plus up to 2 more ids if very strongly relevant)
- event_origin (strict ISO code)
- target_sphere (string: sphere code)
- excluded_spheres (array of sphere codes, or ["unique"], or [])
- regions (array of Tier 1 ISO codes, or ["ALL"], or [])`;
    } else {
      // ROW: sphere-specific category question
      prompt = `Generate a memorable or interesting event that would be well known to audiences in ${sphereDescription}, suitable as a question in a family game.
The event must be on an exact recorded date and must fall strictly between ${spec.start_date} and ${effectiveEndDate}.
${noDuplicateBlock}The event must relate to the category "${job.category?.name}" (id ${job.category_id}), described as: "${job.category?.description}".
The event should resonate with people in this cultural sphere — it does not need to have occurred in one specific country.
Only return events that appear to be from reliable sources. If none exist for the requested window and scope, return null (JSON null).
Estimate a quality score for the event, based on its historical significance and how interesting or quirky it is, 1 being poor to 5 being excellent.
Also estimate an accuracy_score (integer 1–5). Only give 5 if this is a well-documented event with a precise, reliable recorded date.
${strictnessBlock}
${universalMetadataBlock}
You may also assign up to 2 additional categories but only if they are a very strong match, chosen only from the list below:
${CATEGORY_LIST}

Return a valid JSON object with double‑quoted keys and values, e.g. {"event_title": "...", "categories": [27,15]}, with fields:
- event_title (<=50 chars) - do not include any reference to the date in the title
- event_description (<=200 chars)
- answer_date_canonical (yyyy-mm-dd)
- quality_score (integer 1–5, self-assessed quality of the event)
- accuracy_score (integer 1–5, 5 = well-documented with precise date)
- categories (include ${job.category_id}, plus up to 2 more ids if very strongly relevant)
- event_origin (strict ISO code)
- target_sphere (string: sphere code)
- excluded_spheres (array of sphere codes, or ["unique"], or [])
- regions (array of Tier 1 ISO codes, or ["ALL"], or [])`;
    }
  }

  if (job.scope_type === "user" && job.slot_type === "location") {
    // 3-tier location prompts: UK (populated_place), US (state), ROW (country)
    if (job.populated_place_id && job.populated_place?.name1) {
      // UK tier: existing populated_places-based prompt
      prompt = `Generate a memorable or interesting local UK event, suitable as a question in a family game.
The event must be on an exact recorded date and must fall strictly between ${spec.start_date} and ${effectiveEndDate}.
${noDuplicateBlock}The event must be associated specifically with the place "${job.populated_place?.name1}" (populated_place_id: ${job.populated_place_id}).
The event must be historically significant, culturally notable, or widely reported in reliable sources — not a minor local fair or routine community gathering.
Only return events that appear to be from reliable sources. If none exist for the requested window and scope, return null (JSON null).
Estimate a quality score for the event, based on its local historical significance and how interesting or quirky it is, 1 being poor to 5 being excellent.
Also estimate an accuracy_score (integer 1–5). Only give 5 if this is a well-documented event with a precise, reliable recorded date.
${strictnessBlock}
Return a valid JSON object with double‑quoted keys and values, e.g. {"event_title": "...", "categories": [27,15]}, with fields:
- event_title (<=50 chars) - do not include any reference to the date in the title
- event_description (<=200 chars)
- answer_date_canonical (yyyy-mm-dd)
- categories = [NULL]
- quality_score (integer 1–5, self-assessed quality of the event)
- accuracy_score (integer 1–5, 5 = well-documented with precise date)
- populated_place_id ("${job.populated_place_id}")`;
    } else if (job._statePromptName) {
      // US tier: state-based prompt
      prompt = `Generate a memorable or interesting event that is highly relevant to ${job._statePromptName}, suitable as a question in a family game.
The event must be on an exact recorded date and must fall strictly between ${spec.start_date} and ${effectiveEndDate}.
${noDuplicateBlock}The event must be directly associated with this US state — either occurring there, involving people from there, or significantly impacting that state.
The event must be historically significant, culturally notable, or widely reported in reliable sources.
Only return events that appear to be from reliable sources. If none exist for the requested window and scope, return null (JSON null).
Estimate a quality score for the event, based on its historical significance and how interesting or quirky it is, 1 being poor to 5 being excellent.
Also estimate an accuracy_score (integer 1–5). Only give 5 if this is a well-documented event with a precise, reliable recorded date.
${strictnessBlock}
Return a valid JSON object with double‑quoted keys and values, with fields:
- event_title (<=50 chars) - do not include any reference to the date in the title
- event_description (<=200 chars)
- answer_date_canonical (yyyy-mm-dd)
- categories = [NULL]
- quality_score (integer 1–5, self-assessed quality of the event)
- accuracy_score (integer 1–5, 5 = well-documented with precise date)
- event_origin ("United States")`;
    } else {
      // ROW tier: country-based prompt
      prompt = `Generate a memorable or interesting event that is highly relevant to ${countryPromptName}, suitable as a question in a family game.
The event must be on an exact recorded date and must fall strictly between ${spec.start_date} and ${effectiveEndDate}.
${noDuplicateBlock}The event must be directly associated with this country — either occurring there, involving people from there, or significantly impacting it.
The event must be historically significant, culturally notable, or widely reported in reliable sources.
Only return events that appear to be from reliable sources. If none exist for the requested window and scope, return null (JSON null).
Estimate a quality score for the event, based on its historical significance and how interesting or quirky it is, 1 being poor to 5 being excellent.
Also estimate an accuracy_score (integer 1–5). Only give 5 if this is a well-documented event with a precise, reliable recorded date.
${strictnessBlock}
Return a valid JSON object with double‑quoted keys and values, with fields:
- event_title (<=50 chars) - do not include any reference to the date in the title
- event_description (<=200 chars)
- answer_date_canonical (yyyy-mm-dd)
- categories = [NULL]
- quality_score (integer 1–5, self-assessed quality of the event)
- accuracy_score (integer 1–5, 5 = well-documented with precise date)
- event_origin (the most relevant country for the event)`;
    }
  }

  if (job.scope_type === "region") {
    if (job.scope_id === "UK") {
      // UK is the single unified global game: truly worldwide, universally recognised events
      // NOTE: No universalMetadataBlock here — region questions don't need sphere/regions metadata.
      // We hardcode regions=["ALL"], target_sphere=null, excluded_spheres=[] at INSERT time.
      prompt = `Generate a truly worldwide, universally recognised historical event, suitable as a question in a global family game.
The event must be on an exact recorded date and fall strictly between ${spec.start_date} and ${effectiveEndDate}.
${noDuplicateBlock}The event should be recognisable to audiences across any culture or continent — not specific to one country.
CRITICAL: Do NOT generate "National Firsts" (e.g., "First radio broadcast in the Netherlands", "First Portuguese dictionary"). If the event is a "First", it MUST be the first time it happened in the ENTIRE WORLD (a true World First). National or regional firsts are NOT acceptable for the GLOBAL game.
The event must relate to the category "${job.category?.name}" (id ${job.category_id}), described as: "${job.category?.description}".
Only return events that are verifiable in reliable sources. If none exist for the requested window and scope, return null (JSON null).
Estimate a quality score for the event. A score of 4 or 5 means the event is genuinely famous, historically significant, or delightfully quirky. A score of 3 means it is obscure or only relevant regionally — AVOID generating events that would score 3 or below. Aim for 4+.
Also estimate an accuracy_score (integer 1–5). Only give 5 if this is a well-documented event with a precise, reliable recorded date.
${strictnessBlock}
You may also assign up to 2 additional categories but only if they are a very strong match, chosen only from the list below:
${CATEGORY_LIST}

Return a valid JSON object with double‑quoted keys and values, e.g. {"event_title": "...", "categories": [27,15]}, with fields:
- event_title (<=50 chars) - do not include any reference to the date in the title
- event_description (<=200 chars)
- answer_date_canonical (yyyy-mm-dd)
- categories (include ${job.category_id}, plus up to 2 more ids if very strongly relevant)
- quality_score (integer 1–5, self-assessed quality of the event)
- accuracy_score (integer 1–5, 5 = well-documented with precise date)
- event_origin (strict 2-letter ISO country code where the event occurred, e.g. "FR", "US". Use "UK" for United Kingdom, NOT "GB")`;
    } else {
      // Country-specific region game (future per-country regions or legacy)
      // NOTE: No universalMetadataBlock here — region questions don't need sphere/regions metadata.
      prompt = `Generate a memorable or interesting event relevant to ${countryPromptName}, suitable as a question in a family game.
The event must be on an exact recorded date and fall strictly between ${spec.start_date} and ${effectiveEndDate}.
${noDuplicateBlock}The event can be from anywhere in the world, but should feel relevant to a "${job.scope_id}" audience.
The event must relate to the category "${job.category?.name}" (id ${job.category_id}), described as: "${job.category?.description}".
Only return events that are verifiable in reliable sources. If none exist for the requested window and scope, return null (JSON null).
Estimate a quality score for the event. A score of 4 or 5 means the event is genuinely famous, historically significant, or delightfully quirky. A score of 3 means it is obscure or only relevant regionally — AVOID generating events that would score 3 or below. Aim for 4+.
Also estimate an accuracy_score (integer 1–5). Only give 5 if this is a well-documented event with a precise, reliable recorded date.
${strictnessBlock}
You may also assign up to 2 additional categories but only if they are a very strong match, chosen only from the list below:
${CATEGORY_LIST}

Return a valid JSON object with double‑quoted keys and values, e.g. {"event_title": "...", "categories": [27,15]}, with fields:
- event_title (<=50 chars) - do not include any reference to the date in the title
- event_description (<=200 chars)
- answer_date_canonical (yyyy-mm-dd)
- categories (include ${job.category_id}, plus up to 2 more ids if very strongly relevant)
- quality_score (integer 1–5, self-assessed quality of the event)
- accuracy_score (integer 1–5, 5 = well-documented with precise date)
- event_origin (strict 2-letter ISO country code where the event occurred, e.g. "FR", "US". Use "UK" for United Kingdom, NOT "GB")`;
    }
  }

  return prompt || "Generate a valid event JSON.";
}


async function verifyEventCandidate(candidate, job) {
  // Build scope-aware verifier rules
  const scopeId = job.scope_id || job.scope_type || "unknown";
  const nationalFirstRule = scopeId === "UK"
    ? `\nNational-First check (UK/Global scope): Determine whether this event is merely a "National First" — i.e. the first time something happened in ONE particular country, rather than a true World First or a universally significant event. Examples of national firsts to reject: "First radio broadcast in the Netherlands", "First Portuguese dictionary". Set is_strictly_national_first to true if so.`
    : '';

  const verifierPrompt = `
You are a historical verification assistant. Work independently with no prior context.

Task: Assess whether the following event occurred and whether its date is accurate. Use widely accepted, reliable historical sources (e.g., encyclopedias, reference works). If evidence is insufficient, treat as likely fictitious.

Special rule: If the date is 1st January of any year, treat it as suspicious. Confirm only if reliable sources explicitly record 1st January as the true date. Otherwise, return verdict="hallucination" or provide a corrected specific date if known.
${nationalFirstRule}

Scope: ${scopeId}

Input JSON:
${JSON.stringify(candidate)}

Return JSON with:
- verdict: one of ["confirm","hallucination","corrected"]
- rationale: short explanation (<=200 chars)
- accuracy_score: integer 1–5 (5 = well-documented with a precise date)
- corrected_event_title (<=50 chars - do not include any reference to the date in the title): string or null
- corrected_event_description (<=200 chars): string or null
- corrected_answer_date_canonical: yyyy-mm-dd or null
- is_strictly_national_first: boolean (true if the event is merely a national/regional first, not a world first or universally significant event; false otherwise)
`;

  const completion = await openai.chat.completions.create({
    model: AI_MODEL_VERIFIER,
    messages: [
      { role: "system", content: "You are a historical verification assistant. Always return valid JSON." },
      { role: "user", content: verifierPrompt }
    ],
    response_format: { type: "json_object" }
  });

  // Log token usage for verifier
  if (completion.usage) {
    console.log(`[verifyEventCandidate] Job ${job.id} verifier token usage: prompt=${completion.usage.prompt_tokens}, completion=${completion.usage.completion_tokens}, total=${completion.usage.total_tokens}`);

    const { error: usageError } = await supabase
      .from("questions_to_generate")
      .update({ token_usage_verifier: completion.usage.total_tokens })
      .eq("id", job.id);

    if (usageError) {
      console.warn(`[verifyEventCandidate] Failed to update verifier usage for job ${job.id}: ${usageError.message}`);
    }
  }

  try {
    return JSON.parse(completion.choices[0].message.content);
  } catch (err) {
    console.warn("[verifyEventCandidate] invalid_json from verifier:", err.message);
    return { verdict: "hallucination", rationale: "Verifier produced invalid JSON.", accuracy_score: 1 };
  }
}

async function callVerifierAI({ newQuestion, existingQuestion, jobId, categoryId }) {
  const completion = await openai.chat.completions.create({
    model: AI_MODEL_VERIFIER,
    messages: [
      {
        role: "system",
        content: `
You are an event verifier. You must decide if two questions describe the same historical event.
Always respond with strict JSON: {"same": true/false, "confidence": number, "rationale": "text"}.
If you are uncertain or the evidence is ambiguous, set "same": true (erring on caution).
Confidence should be between 0 and 1.`
      },
      {
        role: "user",
        content: JSON.stringify({ newQuestion, existingQuestion })
      }
    ]
  });

  // Log the raw model output with job context
  const rawOutput = completion.choices[0].message.content;
  console.log(`[Verifier raw output] job=${jobId}, category=${categoryId}`, rawOutput);

  let parsed;
  try {
    parsed = JSON.parse(rawOutput);
  } catch (e) {
    console.warn(`[Verifier parse error] job=${jobId}, category=${categoryId}`, e.message);
    // Default to "same" if parsing fails
    parsed = { same: true, confidence: 0.0, rationale: "parse error, defaulted to same" };
  }

  // Ensure required fields exist
  if (typeof parsed.same !== "boolean") {
    parsed.same = true;
    parsed.rationale = (parsed.rationale || "") + " | forced default to same";
  }

  // Conservative override: if marked different but confidence is low, flip to same
  if (parsed.same === false && (parsed.confidence === undefined || parsed.confidence < 0.7)) {
    parsed.same = true;
    parsed.rationale = (parsed.rationale || "") + " | low confidence, defaulted to same";
  }

  // Log the final verdict with job context
  console.log(`[Verifier final verdict] job=${jobId}, category=${categoryId}`, parsed);

  return parsed;
}


// Normalise categories to integers only
function normalizeCategories(rawCats) {
  if (!Array.isArray(rawCats)) return [];
  return rawCats
    .map(c => {
      const num = Number(c);
      return Number.isInteger(num) ? num : null;
    })
    .filter(c => c !== null);
}

async function archiveJob(job, finalStatus, { attempts = 1, reason = null } = {}) {
  const { error } = await supabase.rpc("archive_and_delete_job", {
    job_id: job.id,
    final_status: finalStatus,
    p_error_context: reason
  });

  if (error) {
    console.error(`[worker] Failed to archive/delete job ${job.id}:`, error.message);
  } else {
    console.log(`[worker] Job ${job.id} archived and deleted with final_status=${finalStatus}, attempts=${attempts}, reason=${reason}`);
  }
}


async function getNearbyEvents(job, spec) {
  const start = new Date(spec.start_date);
  const end = new Date(spec.end_date);

  const twoYearsMs = 2 * 365 * 24 * 60 * 60 * 1000;
  const minDate = new Date("0001-01-01");
  const maxDate = new Date();

  // Build start and end windows (±2 years, clamped)
  let startWindowMin = new Date(Math.max(start.getTime() - twoYearsMs, minDate.getTime()));
  let startWindowMax = new Date(Math.min(start.getTime() + twoYearsMs, maxDate.getTime()));
  let endWindowMin   = new Date(Math.max(end.getTime() - twoYearsMs, minDate.getTime()));
  let endWindowMax   = new Date(Math.min(end.getTime() + twoYearsMs, maxDate.getTime()));

  const table = job.scope_type === "user" ? "questions_master_user" : "questions_master_region";

  let query = supabase
    .from(table)
    .select("event_title, answer_date_canonical, categories, populated_place_id");

  if (job.slot_type === "location" && job.populated_place_id) {
    query = query.eq("populated_place_id", job.populated_place_id);
    console.log(`[NearbyEvents] Location filter applied on ${table}`, { populated_place_id: job.populated_place_id });
  } else {
    console.log(`[NearbyEvents] No location filter applied on ${table}`);
  }

  // Apply union of start and end windows
  const { data, error } = await query.or(
    `and(answer_date_canonical.gte.${startWindowMin.toISOString().slice(0,10)},answer_date_canonical.lte.${startWindowMax.toISOString().slice(0,10)}),` +
    `and(answer_date_canonical.gte.${endWindowMin.toISOString().slice(0,10)},answer_date_canonical.lte.${endWindowMax.toISOString().slice(0,10)})`
  );

  if (error) {
    console.error("[NearbyEvents] Error fetching events:", error);
    return [];
  }

  const rows = data || [];
  console.log(`[NearbyEvents] Retrieved ${rows.length} candidate events`);

  // In-memory category filtering
  let filtered = rows;
  if (job.slot_type !== "location" && job.category_id != null) {
    const catId = Number(job.category_id);
    filtered = rows.filter(ev => Array.isArray(ev?.categories) && ev.categories.includes(catId));
    console.log(`[NearbyEvents] Category filter applied (id=${catId}): ${rows.length} → ${filtered.length}`);
  } else {
    console.log("[NearbyEvents] No category filter applied");
  }

  console.log("[NearbyEvents] Sample titles:", filtered.slice(0, 3).map(ev =>
    `${ev.answer_date_canonical}: ${ev.event_title}`
  ));

  return filtered;
}


async function processJob(job) {
  let attempts = 0;
  let firstFailureCaptured = false;
  let spec; // declare spec in outer scope so it's visible in catch

  try {
    console.log(`Processing job ID: ${job.id}`);

    // --- Option A: Enrich job with country/state metadata for prompt construction ---
    const jobRegion = job.region || 'UK';
    job._countryPromptName = 'the United Kingdom'; // default
    job._sphereCode = 'ANG'; // default
    job._statePromptName = null;
    job._isTier1 = false; // default

    try {
      const { data: countryRef } = await supabase
        .from('reference_countries')
        .select('prompt_name, cultural_sphere_code, is_tier_1')
        .eq('code', jobRegion)
        .single();

      if (countryRef) {
        job._countryPromptName = countryRef.prompt_name;
        job._sphereCode = countryRef.cultural_sphere_code;
        job._isTier1 = countryRef.is_tier_1 ?? false;
      }

      // If the populated_place_id looks like a US state code (e.g. 'US-TX'),
      // fetch the state prompt name for US-tier location prompts
      if (job.populated_place_id && job.populated_place_id.startsWith('US-')) {
        const { data: stateRef } = await supabase
          .from('reference_us_states')
          .select('prompt_name')
          .eq('code', job.populated_place_id)
          .single();
        if (stateRef) {
          job._statePromptName = stateRef.prompt_name;
        }
      }
    } catch (enrichErr) {
      console.warn(`[worker] Country enrichment failed for job ${job.id}, region=${jobRegion}:`, enrichErr.message);
      // Continue with defaults — don't fail the job over enrichment
    }
    console.log(`[worker] Job ${job.id} enriched: country="${job._countryPromptName}", sphere=${job._sphereCode}, tier1=${job._isTier1}, state=${job._statePromptName}`);

    // Fetch spec row
    const { data, error: specError } = await supabase
      .from('available_question_spec')
      .select('*')
      .eq('id', job.spec_id)
      .single();

    spec = data; // assign to outer variable

    if (specError || !spec || spec.active === false) {
      const { error: deactivateError } = await supabase.rpc("archive_and_delete_spec", { p_spec_id: job.spec_id, p_reason: "spec_missing_or_inactive" });
      if (deactivateError) {
        console.warn(`[worker] Failed to mark spec ${job.spec_id} inactive: ${deactivateError.message}`);
      } else {
        console.log(`[worker] Spec ${job.spec_id} marked inactive (spec missing/inactive)`);
      }
      return false;
    }

    console.log('Fetched spec:', JSON.stringify(spec, null, 2));

    // 👉 Define effectiveEndDate here, once per job
    const effectiveEndDate = spec.end_date === "9999-01-01"
      ? new Date().toISOString().slice(0, 10)
      : spec.end_date;

    // Helpers
    function isDateWithinRange(dateStr, start, end) {
      const d = new Date(dateStr);
      return d >= new Date(start) && d <= new Date(end);
    }
    function isFirstOfJanuary(dateStr) {
      return /^\d{4}-01-01$/.test(dateStr);
    }

    let aiResponse = null;
    let qualityScore = null;
    const nearbyEvents = await getNearbyEvents(job, spec);

    // Retry loop: up to 2 tries
    for (let i = 0; i < 2; i++) {
      attempts++;

      let prompt = buildPrompt(job, spec, nearbyEvents);
      console.log(`Attempt ${attempts} prompt:`, prompt);

      const completion = await openai.chat.completions.create({
        model: AI_MODEL_GENERATOR,
        messages: [
          { role: "system", content: "You are a question generation assistant. Always return valid JSON." },
          { role: "user", content: prompt }
        ],
        response_format: { type: "json_object" }
      });

// Log token usage and increment attempt count
if (completion.usage) {
  console.log(
    `[worker] Job ${job.id} generator token usage: ` +
    `prompt=${completion.usage.prompt_tokens}, completion=${completion.usage.completion_tokens}, total=${completion.usage.total_tokens}`
  );

  // Fetch current token usage and attempt count
  const { data: existingRow, error: fetchError } = await supabase
    .from("questions_to_generate")
    .select("token_usage_generator, attempt_count")
    .eq("id", job.id)
    .single();

  let existingUsage = 0;
  let existingAttempts = 0;
  if (existingRow) {
    existingUsage = Number(existingRow.token_usage_generator) || 0;
    existingAttempts = Number(existingRow.attempt_count) || 0;
  }

  // Add new usage to running total and increment attempt count
  const newTotalUsage = existingUsage + (completion.usage.total_tokens || 0);
  const newAttemptCount = existingAttempts + 1;

  const { error: usageError } = await supabase
    .from("questions_to_generate")
    .update({
      token_usage_generator: newTotalUsage,
      attempt_count: newAttemptCount,
      ai_model_used: AI_MODEL_GENERATOR   // ✅ provenance
    })
    .eq("id", job.id);

  if (usageError) {
    console.warn(
      `[worker] Failed to update generator usage/attempts for job ${job.id}: ${usageError.message}`
    );
  } else {
    console.log(
      `[worker] Updated job ${job.id}: cumulative tokens=${newTotalUsage}, attempts=${newAttemptCount}, model=${AI_MODEL_GENERATOR}`
    );
  }
}


      // 👉 NEW: capture raw completion before parsing
      const rawContent = completion.choices[0].message.content;
      console.log(`[worker] Raw completion for job ${job.id}:`, rawContent);

      let candidate;
      try {
        candidate = JSON.parse(rawContent);
        console.log(`[worker] Parsed candidate for job ${job.id}:`, JSON.stringify(candidate, null, 2));
        console.log(`[worker] Raw content for job ${job.id}:`, rawContent);

      } catch (err) {
        const reason = "invalid_json";
        console.warn(`Job ${job.id}: ${reason}; retrying. Raw content was:`, rawContent);
        if (!firstFailureCaptured) {
          await supabase
            .from("questions_to_generate")
            .update({
              failed_candidate_date: null,
              failed_candidate_description: rawContent || "invalid_json"
            })
            .eq("id", job.id);
          firstFailureCaptured = true;
        }
        if (attempts >= 2) {
          await supabase.rpc("archive_and_delete_spec", { p_spec_id: job.spec_id, p_reason: "spec_missing_or_inactive" });
          throw new Error(reason);
        }
        continue;
      }

      // 👉 NEW unified null handling
      if (
        !candidate ||
        candidate.answer_date_canonical == null ||
        candidate.answer_date_canonical === "null"
      ) {
        const reason = "no_event_or_invalid";
        console.warn(`Job ${job.id}: ${reason}; retrying. Raw content was:`, rawContent);

        if (!firstFailureCaptured) {
          await supabase
            .from("questions_to_generate")
            .update({
              failed_candidate_date: candidate?.answer_date_canonical || null,
              failed_candidate_description: candidate?.event_description || rawContent
            })
            .eq("id", job.id);
          firstFailureCaptured = true;
        }
        if (attempts >= 2) {
          await supabase.rpc("archive_and_delete_spec", { p_spec_id: job.spec_id, p_reason: "spec_missing_or_inactive" });
          throw new Error(reason);
        }
        continue;
      }

      // Special case: YYYY-01-01
      if (isFirstOfJanuary(candidate.answer_date_canonical)) {
        console.log(`Job ${job.id}: candidate returned 1st January (${candidate.answer_date_canonical}); verifying specificity`);
        const verify = await verifyEventCandidate({
          ...candidate,
          feedback: "The event was returned with a date of 1st January. Please confirm if this is a genuine recorded date, provide the correct specific date if known, or state that no precise date exists."
        }, job);

        if (verify.verdict === "hallucination" || (verify.verdict === "corrected" && !verify.corrected_answer_date_canonical)) {
          console.log(`Job ${job.id}: 1st January date unverifiable; retrying`);
          if (!firstFailureCaptured) {
            await supabase
              .from("questions_to_generate")
              .update({
                failed_candidate_date: candidate.answer_date_canonical,
                failed_candidate_description: candidate.event_description || rawContent
              })
              .eq("id", job.id);
            firstFailureCaptured = true;
          }
          if (attempts >= 2) {
            await supabase.rpc("archive_and_delete_spec", { p_spec_id: job.spec_id, p_reason: "spec_missing_or_inactive" });
            throw new Error("invalid_first_january_date");
          }
          continue;
        }
        if (verify.corrected_answer_date_canonical) {
          candidate.answer_date_canonical = verify.corrected_answer_date_canonical;
        }
      }

      // Range check (only runs if we have a non-null date string)
      const inRange = isDateWithinRange(candidate.answer_date_canonical, spec.start_date, effectiveEndDate);
      if (!inRange) {
        const reason = "date_out_of_range";
        console.warn(`Job ${job.id}: ${reason}; retrying. Raw content was:`, rawContent);

        if (!firstFailureCaptured) {
          await supabase
            .from("questions_to_generate")
            .update({
              failed_candidate_date: candidate.answer_date_canonical,
              failed_candidate_description: candidate.event_description || rawContent
            })
            .eq("id", job.id);
          firstFailureCaptured = true;
        }

        // Add feedback for next attempt
        prompt = buildPrompt(job, spec, nearbyEvents) + `
      IMPORTANT FEEDBACK:
      - The last attempt produced an event outside the valid date range (${spec.start_date} to ${effectiveEndDate}).
      - Do NOT repeat this event or any event outside the range.
      - Only AD/Common Era dates are valid. BC dates are not acceptable.
      - If no valid event exists strictly within the range, return null (JSON null).
      `;

        if (attempts >= 2) {
          await supabase.rpc("archive_and_delete_spec", { p_spec_id: job.spec_id, p_reason: "spec_missing_or_inactive" });
          throw new Error(reason);
        }
        continue;
      }



      qualityScore = Number(candidate.quality_score ?? 0);
      const accuracyScore = Number(candidate.accuracy_score ?? 0);

      // Accuracy gating
      if (accuracyScore <= 2) {
        console.log(`Job ${job.id}: low accuracy ${accuracyScore}; retrying`);
        console.log(`[worker] Candidate details for job ${job.id}:`, JSON.stringify(candidate, null, 2));
        console.log(`[worker] Raw content for job ${job.id}:`, rawContent);
        if (!firstFailureCaptured) {
          await supabase
            .from("questions_to_generate")
            .update({
              failed_candidate_date: candidate.answer_date_canonical,
              failed_candidate_description: candidate.event_description
            })
            .eq("id", job.id);
          firstFailureCaptured = true;
        }
        if (attempts >= 2) {
          await supabase.rpc("archive_and_delete_spec", { p_spec_id: job.spec_id, p_reason: "spec_missing_or_inactive" });
          throw new Error("low_accuracy");
        }
        continue;
      }

// Secondary verification loop
if (accuracyScore >= 3 && accuracyScore < 5) {
  const verify = await verifyEventCandidate(candidate, job);
  console.log(`[Verifier] verdict=${verify.verdict} accuracy=${verify.accuracy_score} rationale=${verify.rationale}`);

  if (verify.verdict === "hallucination") {
    console.log(`Job ${job.id}: verifier flagged hallucination; retrying`);
    console.log(`[worker] Candidate details for job ${job.id}:`, JSON.stringify(candidate, null, 2));
    console.log(`[worker] Raw content for job ${job.id}:`, rawContent);

    if (!firstFailureCaptured) {
      await supabase
        .from("questions_to_generate")
        .update({
          failed_candidate_date: candidate.answer_date_canonical,
          failed_candidate_description: candidate.event_description
        })
        .eq("id", job.id);
      firstFailureCaptured = true;
    }
    if (attempts >= 2) {
      await supabase.rpc("archive_and_delete_spec", { p_spec_id: job.spec_id, p_reason: "spec_missing_or_inactive" });
      throw new Error("verifier_hallucination");
    }
    continue;
  }

  // ✅ National First gating (GLOBAL scope only)
  if (verify.is_strictly_national_first === true && (job.scope_id === "UK")) {
    console.log(`Job ${job.id}: verifier flagged as National First — rejecting for GLOBAL scope`);
    if (!firstFailureCaptured) {
      await supabase
        .from("questions_to_generate")
        .update({
          failed_candidate_date: candidate.answer_date_canonical,
          failed_candidate_description: `[National First] ${candidate.event_description}`
        })
        .eq("id", job.id);
      firstFailureCaptured = true;
    }
    if (attempts >= 2) {
      await supabase.rpc("archive_and_delete_spec", { p_spec_id: job.spec_id, p_reason: "national_first_rejected" });
      throw new Error("national_first_rejected");
    }
    continue;
  }

  if (verify.verdict === "corrected" || verify.verdict === "confirm") {
    candidate.event_title = verify.corrected_event_title ?? candidate.event_title;
    candidate.event_description = verify.corrected_event_description ?? candidate.event_description;
    candidate.answer_date_canonical = verify.corrected_answer_date_canonical ?? candidate.answer_date_canonical;

    // ✅ overwrite accuracy_score with verifier's score
    candidate.accuracy_score = verify.accuracy_score;

    // ✅ reject if verifier score <= 3
    if (candidate.accuracy_score <= 3) {
      console.log(`Job ${job.id}: verifier accuracy ${candidate.accuracy_score} too low; rejecting`);
      if (!firstFailureCaptured) {
        await supabase
          .from("questions_to_generate")
          .update({
            failed_candidate_date: candidate.answer_date_canonical,
            failed_candidate_description: candidate.event_description
          })
          .eq("id", job.id);
        firstFailureCaptured = true;
      }
      if (attempts >= 2) {
        await supabase.rpc("archive_and_delete_spec", { p_spec_id: job.spec_id, p_reason: "verifier_low_accuracy" });
        throw new Error("verifier_low_accuracy");
      }
      continue; // retry loop
    }

    const correctedInRange = isDateWithinRange(candidate.answer_date_canonical, spec.start_date, spec.end_date);
    if (!correctedInRange) {
      console.log(`Job ${job.id}: corrected date out of range; retrying`);
      console.log(`[worker] Candidate details for job ${job.id}:`, JSON.stringify(candidate, null, 2));
      console.log(`[worker] Raw content for job ${job.id}:`, rawContent);

      if (!firstFailureCaptured) {
        await supabase
          .from("questions_to_generate")
          .update({
            failed_candidate_date: candidate.answer_date_canonical,
            failed_candidate_description: candidate.event_description
          })
          .eq("id", job.id);
        firstFailureCaptured = true;
      }
      if (attempts >= 2) {
        await supabase.rpc("archive_and_delete_spec", { p_spec_id: job.spec_id, p_reason: "spec_missing_or_inactive" });
        throw new Error("corrected_date_out_of_range");
      }
      continue;
    }
  }
}

if (qualityScore < 3 && attempts < 2) {
  console.log(`Job ${job.id}: low score ${qualityScore}; retrying`);
  console.log(`[worker] Candidate details for job ${job.id}:`, JSON.stringify(candidate, null, 2));
  console.log(`[worker] Raw content for job ${job.id}:`, rawContent);

  if (!firstFailureCaptured) {
    await supabase
      .from("questions_to_generate")
      .update({
        failed_candidate_date: candidate.answer_date_canonical,
        failed_candidate_description: candidate.event_description
      })
      .eq("id", job.id);
    firstFailureCaptured = true;
  }
  continue;
}

aiResponse = candidate;
break;
    }

    // If still invalid after retries
    if (!aiResponse) {
      const reason = "exhausted_retries";
      console.warn(`Job ${job.id}: ${reason} after ${attempts} attempts`);
      const { error: deactivateError } = await supabase.rpc("archive_and_delete_spec", { p_spec_id: job.spec_id, p_reason: "spec_missing_or_inactive" });
      if (deactivateError) {
        console.warn(`[worker] Failed to mark spec ${spec.id} inactive: ${deactivateError.message}`);
      } else {
        console.log(`[worker] Spec ${spec.id} marked inactive`);
      }
      throw new Error(reason);
    }

    // Interpret quality score outcomes
    // Quality < 3 → reject outright and deactivate spec
    if (qualityScore < 3) {
      const reason = `low_quality_score_${qualityScore}`;
      console.log(`Job ${job.id}: ${reason}; fail + deactivate spec`);
      const { error: deactivateError } = await supabase.rpc("archive_and_delete_spec", { p_spec_id: job.spec_id, p_reason: "spec_missing_or_inactive" });
      if (deactivateError) {
        console.warn(`[worker] Failed to mark spec ${spec.id} inactive: ${deactivateError.message}`);
      } else {
        console.log(`[worker] Spec ${spec.id} marked inactive`);
      }
      throw new Error(reason);
    }

    // Pre-insert diagnostics
    console.log("[JobFields]", {
      id: job.id,
      scope_type: job.scope_type,
      scope_id: job.scope_id,
      slot_type: job.slot_type,
      category_id: job.category_id,
      populated_place_id: job.populated_place_id,
      types: {
        scope_id: typeof job.scope_id,
        category_id: typeof job.category_id,
        populated_place_id: typeof job.populated_place_id
      }
    });

    console.log("[SpecRowFetched]", JSON.stringify(spec, null, 2));

    // --- Post-generation metadata sanitisation ---
    // Bug 3 fix: Map GB → UK for event_origin (our convention uses UK, not ISO GB)
    let sanitisedEventOrigin = aiResponse.event_origin || "Unknown";
    if (sanitisedEventOrigin === "GB") sanitisedEventOrigin = "UK";

    // Bug 2 fix: Validate target_sphere (must be one of the 5 allowed codes)
    const VALID_SPHERES = ["ANG", "ELA", "ASI", "SAM", "AFR"];
    let sanitisedTargetSphere = aiResponse.target_sphere || null;
    if (sanitisedTargetSphere && !VALID_SPHERES.includes(sanitisedTargetSphere)) {
      console.warn(`[worker] Invalid target_sphere "${sanitisedTargetSphere}" from AI — setting to null`);
      sanitisedTargetSphere = null;
    }

    // Scope-aware insert
    let targetTable, payload;
    if (job.scope_type === "user") {
      targetTable = "questions_master_user";
      payload = {
        regions: [job.scope_id],
        event_title: aiResponse.event_title,
        event_description: aiResponse.event_description,
        answer_date_canonical: aiResponse.answer_date_canonical,
        categories: normalizeCategories(aiResponse.categories),
        question_kind: job.slot_type,
        event_origin: sanitisedEventOrigin === "Unknown" ? (job.region || "UK") : sanitisedEventOrigin,
        quality_score: qualityScore,
        accuracy_score: Number(aiResponse.accuracy_score ?? null),
        archive_id: job.archive_id || job.id,
        ai_model_used: AI_MODEL_GENERATOR,
        is_approved: true,
        target_sphere: sanitisedTargetSphere,
        excluded_spheres: aiResponse.excluded_spheres || []
      };

      // For category questions, use AI-provided Tier 1 inclusion list
      if (job.slot_type === "category" && Array.isArray(aiResponse.regions)) {
        payload.regions = aiResponse.regions;
      }

      if (job.slot_type === "location") {
        payload.populated_place_id = job.populated_place_id;
        payload.categories = [999];
      }
    } else {
      // Region-scope questions: hardcode metadata (no AI sphere/regions needed)
      targetTable = "questions_master_region";
      payload = {
        regions: ["ALL"],
        event_title: aiResponse.event_title,
        event_description: aiResponse.event_description,
        answer_date_canonical: aiResponse.answer_date_canonical,
        categories: normalizeCategories(aiResponse.categories),
        question_kind: job.slot_type,
        event_origin: sanitisedEventOrigin,
        quality_score: qualityScore,
        accuracy_score: Number(aiResponse.accuracy_score ?? null),
        archive_id: job.archive_id || job.id,
        ai_model_used: AI_MODEL_GENERATOR,
        is_approved: true,
        target_sphere: null,
        excluded_spheres: []
      };

      if (job.slot_type === "location") {
        payload.populated_place_id = job.populated_place_id;
        payload.categories = [999];
      }
    }

    // Log payload types and schema side by side
    const firstRegion = Array.isArray(payload.regions) && payload.regions.length > 0 ? payload.regions[0] : undefined;
    console.log("[InsertPayloadTypes]", {
      regionsDefined: Array.isArray(payload.regions),
      regionsCount: Array.isArray(payload.regions) ? payload.regions.length : 0,
      regionsFirstType: typeof firstRegion,
      populatedPlaceIdType: typeof payload.populated_place_id,
      payload
    });

    // Fetch schema types for targetTable
    try {
      const { data: schemaCols, error: schemaErr } = await supabase.rpc("describe_table_columns", { p_table_name: targetTable });
      if (schemaErr) {
        console.warn(`[SchemaDescribe] Failed for ${targetTable}:`, schemaErr.message);
      } else {
        console.log("[TargetTableColumnTypes]", schemaCols);
      }
    } catch (schemaCatchErr) {
      console.warn(`[SchemaDescribe] Exception for ${targetTable}:`, schemaCatchErr.message);
    }

    const { data: insertedQuestion, error: insertError } = await supabase
      .from(targetTable)
      .insert(payload)
      .select()
      .single();

    if (insertError) {
      console.error(`[worker] Insert failed for job ${job.id}. Candidate was:`, JSON.stringify(aiResponse, null, 2));
      console.error(`[worker] Payload attempted:`, JSON.stringify(payload, null, 2));
      console.error(`[worker] Insert error meta:`, {
        message: insertError.message,
        code: insertError.code,
        details: insertError.details,
        hint: insertError.hint
      });
      throw new Error(`Failed to insert question: ${insertError.message}`);
    }

    console.log('Inserted question:', JSON.stringify(insertedQuestion, null, 2));


// 👉 Immediate allocation via direct Supabase insert
try {
  const runId = crypto.randomUUID();
  let allocPayload;

  console.log("[AllocPayloadCheck]", {
    scopeType: job.scope_type,
    scopeId: job.scope_id,
    isUuid: /^[0-9a-fA-F-]{36}$/.test(job.scope_id),
    puzzleDateFromJob: job.puzzle_date, // ✅ log the puzzle date you’ll use
    eventDateFromInsert: insertedQuestion.answer_date_canonical
  });

  // Derive category_id safely
  const isLocationSlot = (job.slot_type === "location" || insertedQuestion.question_kind === "location");
  const primaryCategory = Array.isArray(insertedQuestion.categories) && insertedQuestion.categories.length > 0
    ? insertedQuestion.categories[0]
    : null;

  const derivedCategoryId = isLocationSlot
    ? 999
    : (primaryCategory ?? job.category_id ?? null);

  if (!isLocationSlot && (derivedCategoryId === null || derivedCategoryId === undefined)) {
    console.error("[worker] No category_id available for category slot, aborting allocation", {
      jobId: job.id,
      questionId: insertedQuestion.id,
      insertedQuestionCategories: insertedQuestion.categories,
      jobCategoryId: job.category_id
    });
    throw new Error("Missing category_id for category allocation");
  }

  // ---- Same-event conflict gate (primary category only) ----
  const eventDate = job.puzzle_date; // canonical date you’re generating for
  const primaryCategoryId = job.category_id; // the category the job is for

  // Find candidates on same date in both master tables
  const [userSameDate, regionSameDate] = await Promise.all([
    supabase
      .from("questions_master_user")
      .select("id, question_kind, event_title, categories, answer_date_canonical")
      .eq("answer_date_canonical", eventDate)
      .eq("question_kind", "category"),
    supabase
      .from("questions_master_region")
      .select("id, question_kind, event_title, categories, answer_date_canonical")
      .eq("answer_date_canonical", eventDate)
  ]);

  if (userSameDate.error) throw userSameDate.error;
  if (regionSameDate.error) throw regionSameDate.error;

  const candidates = [
    ...(userSameDate.data || []).map(r => ({ scope: "user", ...r })),
    ...(regionSameDate.data || []).map(r => ({ scope: "region", ...r }))
  ];

// Consult AI to determine “same event”
let sameEvent = false;
for (const c of candidates) {
  const verdict = await callVerifierAI({
    newQuestion: {
      category_id: primaryCategoryId,
      answer_date_canonical: eventDate,
      // include brief context from your prompt inputs if available
    },
    existingQuestion: {
      id: c.id,
      event_title: c.event_title,
      categories: c.categories
    },
    jobId: job.id,
    categoryId: primaryCategoryId
  });

  if (verdict?.same === true) {
    sameEvent = true;
    break;
  }
}


  if (sameEvent) {
    // Resolve in DB: split covering spec, archive original, set job to retry and assign spec
    const regionForPrimary = (job.scope_type === "user") ? job.region : job.scope_id;

    const { data: rpcRes, error: rpcErr } = await supabase.rpc("split_spec_and_reset_job", {
      p_region: regionForPrimary,
      p_category_id: primaryCategoryId,
      p_event_date: eventDate,
      p_job_id: job.id,
      p_reason: "question_already_exists"
    });

    if (rpcErr) {
      console.error("[worker] split_spec_and_reset_job failed", rpcErr.message);
      throw rpcErr;
    }

    console.log("[worker] Same-event conflict handled via RPC", rpcRes);

    // Do not create question_master or allocations; exit early
    await archiveJob(job, "completed", { attempts, note: "same_event_conflict_retry" });
    return true;
  }

  if (job.scope_type === "user") {
    allocPayload = {
      user_id: job.scope_id,
      puzzle_date: job.puzzle_date,
      question_id: insertedQuestion.id,
      slot_type: insertedQuestion.question_kind,
      category_id: derivedCategoryId,
      allocator_run_id: runId,
      created_at: new Date().toISOString()
    };

    const { error: allocUserErr } = await supabase
      .from("questions_allocated_user")
      .insert(allocPayload);

    if (allocUserErr) {
      console.error("[worker] User allocation insert failed", {
        jobId: job.id,
        code: allocUserErr.code,
        message: allocUserErr.message,
        payload: allocPayload
      });
      throw allocUserErr;
    } else {
      console.log(`[worker] Allocated user question for job ${job.id}`);
    }

// ✅ Fallback: additional categories — split only if an ACTIVE covering spec overlaps the event date; else do nothing
if (Array.isArray(insertedQuestion.categories) && insertedQuestion.categories.length > 0) {
  const eventDate = insertedQuestion.answer_date_canonical;

  for (const cat of insertedQuestion.categories) {
    if (cat === 999) continue;
    if (job.slot_type === "category" && cat === job.category_id) {
      console.log(`[worker] Skipping primary job category ${cat} for fallback`);
      continue;
    }

    const { data: specRows, error: specErr } = await supabase
      .from("available_question_spec")
      .select("id, active, start_date, end_date")
      .eq("region", job.scope_type === "user" ? job.region : job.scope_id)
      .eq("category_id", cat)
      .is("location", null)
      .eq("active", true)
      .lte("start_date", eventDate)
      .gte("end_date", eventDate);

    if (specErr) {
      console.warn(`[worker] Spec lookup failed for cat ${cat}: ${specErr.message}`);
      continue;
    }

    if (!specRows || specRows.length === 0) {
      console.log(`[worker] No ACTIVE covering spec for additional cat ${cat} on ${eventDate}; no split created.`);
      continue;
    }

    const covering = specRows[0];
    const evD = new Date(eventDate + 'T00:00:00Z');
    const leftStartStr  = "0001-01-01";
    const leftEndStr    = new Date(evD.getTime() - 24*60*60*1000).toISOString().slice(0,10);
    const rightStartStr = new Date(evD.getTime() + 24*60*60*1000).toISOString().slice(0,10);
    const rightEndStr   = "9999-01-01";

    // Insert around-event specs if not already present
    const { data: existingSplit } = await supabase
      .from("available_question_spec")
      .select("id")
      .eq("region", job.scope_type === "user" ? job.region : job.scope_id)
      .eq("category_id", cat)
      .is("location", null)
      .eq("active", true)
      .in("start_date", [leftStartStr, rightStartStr])
      .in("end_date", [leftEndStr, rightEndStr]);

    if (!existingSplit || existingSplit.length < 2) {
      const payloads = [
        { region: job.scope_type === "user" ? job.region : job.scope_id, category_id: cat, start_date: leftStartStr,  end_date: leftEndStr,  created_at: new Date().toISOString() },
        { region: job.scope_type === "user" ? job.region : job.scope_id, category_id: cat, start_date: rightStartStr, end_date: rightEndStr, created_at: new Date().toISOString() }
      ];
      await supabase.from("available_question_spec").insert(payloads).select();
      console.log(`[worker] Inserted event split specs for additional cat ${cat} around ${eventDate}`);
    }

    await supabase.rpc("archive_and_delete_spec", {
      p_spec_id: covering.id,
      p_reason: "additional_category_event_split"
    });
    console.log(`[worker] Spec ${covering.id} (cat ${cat}) archived after split`);
  }
}





} else {
  allocPayload = {
    region: job.scope_id,
    puzzle_date: job.puzzle_date,
    question_id: insertedQuestion.id,
    slot_type: insertedQuestion.question_kind,
    category_id: derivedCategoryId,
    allocator_run_id: runId,
    created_at: new Date().toISOString()
  };

  const { error: allocRegionErr } = await supabase
    .from("questions_allocated_region")
    .insert(allocPayload);

  if (allocRegionErr) {
    console.error("[worker] Region allocation insert failed", {
      jobId: job.id,
      code: allocRegionErr.code,
      message: allocRegionErr.message,
      payload: allocPayload
    });
    throw allocRegionErr;
  } else {
    console.log(`[worker] Allocated region question for job ${job.id}`);
  }

// ✅ Fallback: additional categories — split only if an ACTIVE covering spec overlaps the event date; else do nothing
if (Array.isArray(insertedQuestion.categories) && insertedQuestion.categories.length > 0) {
  const eventDate = insertedQuestion.answer_date_canonical;

  for (const cat of insertedQuestion.categories) {
    if (cat === 999) continue; // skip location sentinel

    if (job.slot_type === "category" && cat === job.category_id) {
      console.log(`[worker] Skipping primary job category ${cat} for fallback`);
      continue;
    }

    // ACTIVE covering spec on the event date?
    const { data: specRows, error: specErr } = await supabase
      .from("available_question_spec")
      .select("id, active, start_date, end_date")
      .eq("region", job.scope_id)          // REGION branch uses scope_id
      .eq("category_id", cat)
      .is("location", null)
      .eq("active", true)
      .lte("start_date", eventDate)
      .gte("end_date", eventDate);

    if (specErr) {
      console.warn(`[worker] Spec lookup failed for cat ${cat} (region fallback): ${specErr.message}`);
      continue;
    }

    if (!specRows || specRows.length === 0) {
      console.log(`[worker] No ACTIVE covering spec for additional cat ${cat} on ${eventDate}; no split created.`);
      continue;
    }

    const covering = specRows[0];
    const evD = new Date(eventDate + 'T00:00:00Z');
    const leftStartStr  = "0001-01-01";
    const leftEndStr    = new Date(evD.getTime() - 24*60*60*1000).toISOString().slice(0,10);
    const rightStartStr = new Date(evD.getTime() + 24*60*60*1000).toISOString().slice(0,10);
    const rightEndStr   = "9999-01-01";

    // Idempotency check
    const { data: existingSplit } = await supabase
      .from("available_question_spec")
      .select("id")
      .eq("region", job.scope_id)
      .eq("category_id", cat)
      .is("location", null)
      .eq("active", true)
      .in("start_date", [leftStartStr, rightStartStr])
      .in("end_date", [leftEndStr, rightEndStr]);

    if (!existingSplit || existingSplit.length < 2) {
      const payloads = [
        { region: job.scope_id, category_id: cat, start_date: leftStartStr,  end_date: leftEndStr,  created_at: new Date().toISOString() },
        { region: job.scope_id, category_id: cat, start_date: rightStartStr, end_date: rightEndStr, created_at: new Date().toISOString() }
      ];
      await supabase.from("available_question_spec").insert(payloads).select();
      console.log(`[worker] Inserted event split specs for additional cat ${cat} around ${eventDate}`);
    } else {
      console.log(`[worker] Event split specs already present for cat ${cat}, skipping insert`);
    }

    const { error: rpcErr } = await supabase.rpc("archive_and_delete_spec", {
      p_spec_id: covering.id,
      p_reason: "additional_category_event_split"
    });
    if (rpcErr) {
      console.warn(`[worker] archive_and_delete_spec failed for spec ${covering.id} (region, cat ${cat}): ${rpcErr.message}`);
    } else {
      console.log(`[worker] Spec ${covering.id} (region, cat ${cat}) archived after split`);
    }
  }
}
  }


  // Update allocation_log
  await supabase.from("allocation_log").insert({
    run_id: runId,
    scope_type: job.scope_type,
    scope_id: job.scope_id,
    allocated_count: 1,
    generated_count: 1,
    unmet_count: 0,
    status: "success",
    created_at: new Date().toISOString()
  });
  console.log(`[worker] Allocation log updated for job ${job.id}`);
} catch (allocErr) {
  console.error(`[worker] Immediate allocation insert failed for job ${job.id}:`, allocErr.message);
}


    // Archive and delete job on success
    await archiveJob(job, "completed", { attempts });
    console.log(`Job ID ${job.id} archived as completed`);

    return true;
    } catch (error) {
    console.error(`Error processing job ID ${job.id}:`, error.message);

    if (spec && spec.id) {
      const { error: deactivateError } = await supabase.rpc("archive_and_delete_spec", { p_spec_id: spec.id, p_reason: "worker_exception" });
      if (deactivateError) {
        console.warn(`[worker] Failed to mark spec ${spec.id} inactive via catch block: ${deactivateError.message}`);
      } else {
        console.log(`[worker] Spec ${spec.id} marked inactive via catch block`);
      }
    } else {
      // fallback: deactivate by job.spec_id if spec wasn't fetched
      const { error: deactivateError } = await supabase.rpc("archive_and_delete_spec", { p_spec_id: job.spec_id, p_reason: "worker_exception_fallback" });
      if (deactivateError) {
        console.warn(`[worker] Failed to mark spec ${job.spec_id} inactive via catch block: ${deactivateError.message}`);
      } else {
        console.log(`[worker] Spec ${job.spec_id} marked inactive via catch block (fallback)`);
      }
    }

    return false;
    }
    }



async function pollForJobs(batchSize = 5) {
  try {
    console.log(`Polling for up to ${batchSize} pending jobs...`);

    // Fetch by priority only; we'll do custom date sorting in JS
    const { data, error } = await supabase
      .from('questions_to_generate')
      .select(`
        *,
        category:categories(name, description)
      `)
      .in('status', ['pending', 'retry'])
      .order('priority', { ascending: true })
      .limit(batchSize * 5); // fetch a bit more so we can sort/filter

    if (error) {
      if (error.code === 'PGRST116') {
        console.log('No pending jobs found');
        return [];
      }
      throw error;
    }

    if (data && data.length > 0) {
      console.log(`Found ${data.length} pending job(s)`);

      // Resolve populated_place name for UK-style (numeric) place IDs
      const ukPlaceIds = data
        .filter(j => j.populated_place_id && !isNaN(Number(j.populated_place_id)))
        .map(j => j.populated_place_id);

      if (ukPlaceIds.length > 0) {
        const uniquePlaceIds = [...new Set(ukPlaceIds)];
        const { data: places, error: placesErr } = await supabase
          .from('populated_places')
          .select('id, name1')
          .in('id', uniquePlaceIds);

        if (!placesErr && places) {
          const placeMap = Object.fromEntries(places.map(p => [p.id, p]));
          for (const job of data) {
            if (job.populated_place_id && placeMap[job.populated_place_id]) {
              job.populated_place = placeMap[job.populated_place_id];
            }
          }
        } else if (placesErr) {
          console.warn('[Worker] Failed to resolve UK place names:', placesErr.message);
        }
      }


      const today = new Date();

      // Custom sort: priority first, then puzzle_date direction depends on trigger_reason
      data.sort((a, b) => {
        if (a.priority !== b.priority) return a.priority - b.priority;

        const aDate = new Date(a.puzzle_date);
        const bDate = new Date(b.puzzle_date);

        const aIsArchive = a.trigger_reason?.includes("archive");
        const bIsArchive = b.trigger_reason?.includes("archive");

        if (aIsArchive && bIsArchive) {
          // Archive jobs: oldest first
          return aDate - bDate;
        } else if (!aIsArchive && !bIsArchive) {
          // Future jobs: nearest to today first (youngest date first)
          const aDiff = Math.abs(aDate.getTime() - today.getTime());
          const bDiff = Math.abs(bDate.getTime() - today.getTime());
          return aDiff - bDiff;
        } else {
          // Mixed types with same priority: keep stable
          return 0;
        }
      });

      // Return only up to batchSize jobs after sorting
      return data.slice(0, batchSize);
    }
    return [];
  } catch (error) {
    console.error('Error polling for jobs:', error.message);
    return [];
  }
}


async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function finalizeScopeCheck(scopesProcessed) {
  // scopesProcessed: { users: Set<string>, regions: Set<string> }
  const users = Array.from(scopesProcessed.users || []);
  const regions = Array.from(scopesProcessed.regions || []);

  if (users.length === 0 && regions.length === 0) {
    console.log("[Worker] Finalize check: no scopes to verify");
    return;
  }

  console.log("[Worker] Finalize check: verifying demand for scopes", { users, regions });

  // For each user, clear demand_summary and re-run calculate-demand
  for (const userId of users) {
    try {
// Check if any jobs still queued for this user
      const { data: queuedJobs, error: queuedErr } = await supabase
        .from("questions_to_generate")
        .select("id, scope_type, scope_id, status")  // include fields for visibility
        .eq("scope_type", "user")
        .eq("scope_id", userId)
        .in("status", ["pending", "retry"])
        .limit(5);  // fetch a few rows for inspection

      console.log(`[Worker] Finalize: queuedJobs for user ${userId} -> count=${queuedJobs ? queuedJobs.length : 0}`, queuedJobs);


if (queuedErr) {
  console.warn(`[Worker] Finalize: failed checking queued jobs for user ${userId}: ${queuedErr.message}`);
  continue;
}

if (queuedJobs && queuedJobs.length > 0) {
  console.log(`[Worker] Finalize: user ${userId} still has queued jobs, skipping calculate-demand`);
  continue;
}

// Only if no queued jobs, clear demand_summary and recalc
const { error: clearErr } = await supabase
  .from("demand_summary")
  .delete()
  .eq("scope_type", "user")
  .eq("scope_id", userId);

if (clearErr) {
  console.warn(`[Worker] Finalize: failed clearing demand for user ${userId}: ${clearErr.message}`);
  continue;
}

const resp = await fetch(`${SUPABASE_URL}/functions/v1/calculate-demand`, {
  method: "POST",
  headers: {
    "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    "Content-Type": "application/json"
  },
  body: JSON.stringify({ user_id: userId })
});


      if (!resp.ok) {
        const txt = await resp.text();
        console.warn(`[Worker] Finalize: calculate-demand failed for user ${userId}: ${txt}`);
        continue;
      }

      const result = await resp.json();
      console.log(`[Worker] Finalize: calculate-demand for user ${userId}`, { inserted: result.inserted });

      // No need to call allocate-questions here; calculate-demand already triggers it if inserted > 0
    } catch (err) {
      console.warn(`[Worker] Finalize: exception for user ${userId}: ${err.message}`);
    }
  }

  // For each region, clear demand_summary and re-run calculate-demand
  for (const regionId of regions) {
    try {
    // Check if any jobs still queued for this region
    const { data: queuedJobs, error: queuedErr } = await supabase
      .from("questions_to_generate")
      .select("id")
      .eq("scope_type", "region")
      .eq("scope_id", regionId)
      .in("status", ["pending", "retry"])
      .limit(1);

    if (queuedErr) {
      console.warn(`[Worker] Finalize: failed checking queued jobs for region ${regionId}: ${queuedErr.message}`);
      continue;
    }

    if (queuedJobs && queuedJobs.length > 0) {
      console.log(`[Worker] Finalize: region ${regionId} still has queued jobs, skipping calculate-demand`);
      continue;
    }

    // Only if no queued jobs, clear demand_summary and recalc
    const { error: clearErr } = await supabase
      .from("demand_summary")
      .delete()
      .eq("scope_type", "region")
      .eq("scope_id", regionId);

    if (clearErr) {
      console.warn(`[Worker] Finalize: failed clearing demand for region ${regionId}: ${clearErr.message}`);
      continue;
    }

    const resp = await fetch(`${SUPABASE_URL}/functions/v1/calculate-demand`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ region: regionId })
    });

      if (!resp.ok) {
        const txt = await resp.text();
        console.warn(`[Worker] Finalize: calculate-demand failed for region ${regionId}: ${txt}`);
        continue;
      }

      const result = await resp.json();
      console.log(`[Worker] Finalize: calculate-demand for region ${regionId}`, { inserted: result.inserted });
    } catch (err) {
      console.warn(`[Worker] Finalize: exception for region ${regionId}: ${err.message}`);
    }
  }
}


async function runWorker() {
  console.log('Elementle Worker started');
  console.log(`Worker mode: ${WORKER_MODE}`);
  console.log('Connecting to Supabase...');

  let processedCount = 0;
  const maxTestBatch = parseInt(process.env.WORKER_TEST_BATCH || "60", 10);
  console.log(`Test mode batch size: ${maxTestBatch}`);

while (true) {
  const jobs = await pollForJobs(5); // fetch up to 5 jobs at a time

  if (jobs.length === 0) {
    console.log(`No jobs found, sleeping for ${POLL_INTERVAL_MS}ms...`);

    if (WORKER_MODE === 'test') {
      console.log(`Test mode: No jobs found, exiting after ${processedCount} jobs...`);
      process.exit(0);
    }

    await sleep(POLL_INTERVAL_MS);
    continue;
  }

  console.log(`[Worker] Cycle start: ${jobs.length} jobs fetched`);

  // 🔧 Deduplicate: allow only one job per category_id and one per populated_place_id
  const seenCategories = new Set();
  const seenLocations = new Set();
  const filteredJobs = [];

  for (const job of jobs) {
    if (job.slot_type === "category") {
      if (seenCategories.has(job.category_id)) {
        console.log(`[Worker] Skipping duplicate category job in batch (category ${job.category_id}, job ${job.id})`);
        continue;
      }
      seenCategories.add(job.category_id);
      filteredJobs.push(job);
    } else if (job.slot_type === "location") {
      if (seenLocations.has(job.populated_place_id)) {
        console.log(`[Worker] Skipping duplicate location job in batch (location ${job.populated_place_id}, job ${job.id})`);
        continue;
      }
      seenLocations.add(job.populated_place_id);
      filteredJobs.push(job);
    } else {
      filteredJobs.push(job);
    }
  }

  // Track scopes processed in this cycle (for finalize check)
  const scopesProcessed = {
    users: new Set(),
    regions: new Set()
  };

  // Process jobs with catch‑net after each one
  for (let i = 0; i < filteredJobs.length; i++) {
    const job = filteredJobs[i];
    const success = await processJob(job);
    processedCount++;

    // Always remember the scope, even if job failed
    if (job.scope_type === "user") scopesProcessed.users.add(job.scope_id);
    else if (job.scope_type === "region") scopesProcessed.regions.add(job.scope_id);

    console.log(`[Worker] Cycle scope tracking: added ${job.scope_type} ${job.scope_id}`);

    // ✅ Safety net: if this was a location job and it succeeded, ensure place is active if active specs exist.
    // Skip for virtual locations (US states, ROW countries) — they don't exist in populated_places.
    const isVirtualPlace = job.populated_place_id && isNaN(Number(job.populated_place_id));
    if (success && job.slot_type === "location" && job.populated_place_id && !isVirtualPlace) {
      const { data: activeSpecs, error: specCheckErr } = await supabase
        .from("available_question_spec")
        .select("id")
        .eq("location", job.populated_place_id)
        .eq("active", true)
        .limit(1);

      if (specCheckErr) {
        console.warn(`[Worker] Failed to check active specs for place ${job.populated_place_id}: ${specCheckErr.message}`);
      } else if (activeSpecs && activeSpecs.length > 0) {
        const { error: placeUpdateErr } = await supabase
          .from("populated_places")
          .update({ active: true, updated_at: new Date().toISOString() })
          .eq("id", job.populated_place_id);

        if (placeUpdateErr) {
          console.warn(`[Worker] Failed to correct place ${job.populated_place_id} to active: ${placeUpdateErr.message}`);
        } else {
          console.log(`[Worker] Corrected place ${job.populated_place_id} back to active (active specs exist)`);
        }
      }
    }

    if (success && Array.isArray(job.categories) && job.categories.length > 0) {
      // 🔧 Catch‑net: remove overlapping category jobs later in the batch
      for (let j = i + 1; j < filteredJobs.length; j++) {
        const otherJob = filteredJobs[j];
        if (otherJob.slot_type === "category" && job.categories.includes(otherJob.category_id)) {
          console.log(`[Worker] Catch‑net: abandoning overlapping category job ${otherJob.id} (category ${otherJob.category_id})`);
          await supabase.from("questions_to_generate")
            .update({ status: "pending" })
            .eq("id", otherJob.id);
          filteredJobs.splice(j, 1);
          j--;
        }
      }
    }

    if (WORKER_MODE === 'test') {
      console.log(
        `Test mode: Job ${job.id} processed (${success ? 'success' : 'failure'}). ` +
        `Processed ${processedCount}/${maxTestBatch} jobs.`
      );

      if (processedCount >= maxTestBatch) {
        console.log(`Test mode: Reached batch limit (${maxTestBatch}), exiting...`);
        // Before exit, run finalize check for scopes we processed
        await finalizeScopeCheck(scopesProcessed);
        process.exit(0);
      }
    }
  }

  // 🔁 Finalize check once per cycle: verify demand satisfied, re-run demand+allocation if needed
  await finalizeScopeCheck(scopesProcessed);

  await sleep(POLL_INTERVAL_MS);
}

}

// Graceful shutdown handlers
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully...');
  process.exit(0);
});

// Start the worker
runWorker().catch(error => {
  console.error('Fatal error in worker:', error);
  process.exit(1);
});


