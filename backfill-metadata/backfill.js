require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const OpenAI = require('openai');

// ── Config ──────────────────────────────────────────────────
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const BATCH_SIZE = 20; // Set to 10 for our test run!
const DELAY_MS = 1000;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !OPENAI_API_KEY) {
  console.error('Missing required env vars: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, OPENAI_API_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

// ── Aggressive Prompt ───────────────────────────────────────
function buildPrompt(row) {
  const cats = Array.isArray(row.categories)
    ? row.categories.join(', ')
    : JSON.stringify(row.categories);

  return `You are a trivia game editor. Your job is to assess legacy UK trivia questions and determine their global relevance.

Event Title: ${row.event_title}
Event Description: ${row.event_description}
Event Date: ${row.answer_date_canonical}
Categories: [${cats}]

### Allocation Rules for Tier 1 Regions (UK, US, CA, AU, NZ, IE)
You must distinguish between "Universal Knowledge" and "Local Ephemera".

1. UNIVERSAL KNOWLEDGE -> Output ["ALL"]
- Major scientific discoveries and inventions (e.g., Isaac Newton, William Harvey, Archimedes).
- Foundational English-language history (e.g., William Caxton printing the first book, Shakespeare).
- Ancient world history and global conflicts (e.g., Rome, World War II).
These belong in the trivia games of ALL Tier 1 countries.

2. LOCAL EPHEMERA -> Output strictly ["UK"]
- "National Firsts" that are NOT "Global Firsts". If the event is specifically the first time something happened *in the UK* (e.g., "First UK petrol car", "Insulin first used in the UK", "First UK nuclear power station"), it is ONLY a UK question. The rest of the world does not care when the UK adopted a global invention.
- Domestic politics, local campaigns, or hyper-local infrastructure (e.g., Jamie Oliver's school dinners, a specific Saxon water mill).
- Domestic TV, minor celebrities, or local chart music (e.g., BBC's 'Spooks', a UK chart-topping album).

### JSON Output Format
Return a strict JSON object with exactly these four fields:
- event_origin: strict 2-letter ISO country code where the event primarily occurred (e.g., "UK", "GR", "FR"). Use "WW" only for truly worldwide events.
- target_sphere: MUST be exactly one of these 5 codes: "ANG", "ELA", "ASI", "SAM", "AFR". Do NOT use "WW" here.
- excluded_spheres: Array of sphere codes whose audiences would NOT recognize this event. (Use ["unique"] if strictly local).
* CRITICAL RULE: If your regions array is ["ALL"], your excluded_spheres array MUST NOT be ["unique"]. You cannot be universally famous and strictly local at the same time.
- regions: Array of Tier 1 country ISO codes. MUST include "UK" or be ["ALL"].

Return ONLY the valid JSON object, nothing else.`;
}

// ── Process one row ─────────────────────────────────────────
async function processRow(row) {
  const prompt = buildPrompt(row);

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o', // Make sure this matches your Railway worker model
    messages: [
      { role: 'system', content: 'You are a ruthless historical metadata classifier. Always return valid JSON.' },
      { role: 'user', content: prompt }
    ],
    response_format: { type: 'json_object' }
  });

  const raw = completion.choices[0]?.message?.content;
  if (!raw) throw new Error(`Empty response for ID ${row.id}`);

  const metadata = JSON.parse(raw);

  // Validate required fields
  if (!metadata.event_origin || !metadata.target_sphere ||
    !Array.isArray(metadata.excluded_spheres) || !Array.isArray(metadata.regions)) {
    throw new Error(`Invalid metadata for ID ${row.id}: ${raw}`);
  }

  // Safety check: ensure UK is in regions
  if (!metadata.regions.includes('UK') && !metadata.regions.includes('ALL')) {
    console.warn(`  ⚠ ID ${row.id}: AI didn't include UK in regions, forcing UK inclusion`);
    metadata.regions.push('UK');
  }

  // Update the database
  const { error } = await supabase
    .from('questions_master_user')
    .update({
      event_origin: metadata.event_origin,
      target_sphere: metadata.target_sphere,
      excluded_spheres: metadata.excluded_spheres,
      regions: metadata.regions
    })
    .eq('id', row.id);

  if (error) throw new Error(`DB update failed for ID ${row.id}: ${error.message}`);

  const tokens = completion.usage?.total_tokens || '?';

  // Format the output so it's easy to read in the terminal
  console.log(`✓ ID ${row.id}: ${row.event_title.substring(0, 35).padEnd(35)} | Origin: ${metadata.event_origin.padEnd(3)} | Regions: ${JSON.stringify(metadata.regions)}`);
}

// ── Main loop ───────────────────────────────────────────────
async function main() {
  console.log('=== Universal Metadata Backfill Bot (Aggressive Mode) ===\n');

  let totalProcessed = 0;
  let totalErrors = 0;
  let batch = 0;

  while (true) {
    batch++;
    console.log(`\n--- Batch ${batch} (fetching up to ${BATCH_SIZE} rows) ---`);

    const { data: rows, error } = await supabase
      .from('questions_master_user')
      .select('id, event_title, event_description, answer_date_canonical, categories')
      .eq('question_kind', 'category')
      .is('target_sphere', null)
      .order('id', { ascending: true })
      .limit(BATCH_SIZE);

    if (error) {
      console.error('DB fetch error:', error.message);
      process.exit(1);
    }

    if (!rows || rows.length === 0) {
      console.log('\n✅ No more rows to process. Backfill complete!');
      break;
    }

    for (const row of rows) {
      try {
        await processRow(row);
        totalProcessed++;
      } catch (err) {
        console.error(`  ✗ ID ${row.id}: ${err.message}`);
        totalErrors++;
      }

      // Rate limit delay
      await new Promise(resolve => setTimeout(resolve, DELAY_MS));
    }

    // HARD STOP FOR TESTING
    console.log(`\n🛑 Test run complete. Processed ${totalProcessed} rows.`);
    console.log(`Check the output above. If the AI is still too generous, we will tweak the prompt!`);

  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});