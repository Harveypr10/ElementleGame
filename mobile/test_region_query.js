
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config(); // Load .env if present, but we might need to rely on process.env from expo run context or hardcode for test if .env not processed by node directly comfortably. 
// I'll try to use the values from the environment variables if available or prompt the user if I can't read them.
// But since I am agent, I can read .env file.

const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '.env');
let supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
let supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (fs.existsSync(envPath)) {
    const envConfig = require('dotenv').parse(fs.readFileSync(envPath));
    supabaseUrl = envConfig.EXPO_PUBLIC_SUPABASE_URL;
    supabaseKey = envConfig.EXPO_PUBLIC_SUPABASE_ANON_KEY;
}

if (!supabaseUrl || !supabaseKey) {
    console.error("Missing Supabase credentials.");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testQuery() {
    // Authenticate anonymously first
    console.log("Signing in anonymously...");
    const { data: authData, error: authError } = await supabase.auth.signInAnonymously();
    if (authError) {
        console.error("Auth Error:", authError);
        // continue anyway to see if public works
    } else {
        console.log("Signed in:", authData.user.id);
    }

    const today = new Date().toISOString().split('T')[0];
    console.log(`Testing query for UK region on ${today}...`);

    // 1. Check if 'today' exists
    const { data: todayData, error: todayError } = await supabase
        .from('questions_allocated_region')
        .select('*, categories(id, name)')
        .eq('region', 'UK')
        .eq('puzzle_date', today)
        .maybeSingle();

    if (todayError) console.error("Today Query Error:", todayError);
    else console.log("Today Data:", todayData);

    // 2. Fetch ANY recent puzzles (ignoring region to check data existence)
    console.log("\nFetching ANY 5 recent puzzles (no region filter)...");
    const { data: anyData, error: anyError } = await supabase
        .from('questions_allocated_region')
        .select('*')
        .limit(5);

    if (anyError) console.error("Any Query Error:", anyError);
    // 3. Test Categories (Reference table, likely public)
    console.log("\nFetching 5 categories...");
    const { data: catData, error: catError } = await supabase
        .from('categories')
        .select('*')
        .limit(5);

    if (catError) console.error("Categories Query Error:", catError);
    // 4. Test Potential Public Views
    console.log("\nFetching from questions_allocated_public (blind guess)...");
    const { data: viewData, error: viewError } = await supabase
        .from('questions_allocated_public')
        .select('*')
        .limit(5);

    if (viewError) console.error("View Query Error:", viewError);
    else {
        console.log(`Found ${viewData ? viewData.length : 0} rows in public view.`);
    }
}

testQuery();
