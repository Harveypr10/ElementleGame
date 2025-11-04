// Diagnostic script to check database tables and data
import { db } from "./db";
import { sql } from "drizzle-orm";

async function diagnoseTables() {
  console.log("\n===== DATABASE DIAGNOSTICS =====\n");

  try {
    // Check which tables exist
    const tables = await db.execute(sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `);
    
    console.log("📋 Existing tables:");
    tables.rows.forEach((row: any) => {
      console.log(`  - ${row.table_name}`);
    });

    // Check row counts for key tables
    console.log("\n📊 Row counts:");
    
    const tablesToCheck = [
      'user_profiles',
      'user_settings',
      'user_stats_region',
      'questions_master_region',
      'questions_allocated_region',
      'game_attempts_region',
      'guesses_region',
      'questions_master_user',
      'questions_allocated_user',
      'game_attempts_user',
      'guesses_user',
      'user_stats_user',
      'regions'
    ];

    for (const table of tablesToCheck) {
      try {
        const result = await db.execute(sql.raw(`SELECT COUNT(*) FROM ${table}`));
        console.log(`  ${table}: ${result.rows[0].count} rows`);
      } catch (e: any) {
        console.log(`  ${table}: ERROR - ${e.message}`);
      }
    }

    // Check for RLS policies
    console.log("\n🔒 RLS Status:");
    const rlsStatus = await db.execute(sql`
      SELECT 
        schemaname,
        tablename,
        rowsecurity
      FROM pg_tables 
      WHERE schemaname = 'public' 
      ORDER BY tablename
    `);
    
    rlsStatus.rows.forEach((row: any) => {
      console.log(`  ${row.tablename}: ${row.rowsecurity ? 'ENABLED' : 'DISABLED'}`);
    });

    // Check policies for each table
    console.log("\n🛡️  RLS Policies:");
    const policies = await db.execute(sql`
      SELECT 
        schemaname,
        tablename,
        policyname,
        permissive,
        roles,
        cmd
      FROM pg_policies 
      WHERE schemaname = 'public'
      ORDER BY tablename, policyname
    `);
    
    if (policies.rows.length === 0) {
      console.log("  ⚠️  NO POLICIES FOUND - This may cause data access issues!");
    } else {
      policies.rows.forEach((row: any) => {
        console.log(`  ${row.tablename}.${row.policyname} (${row.cmd}) for roles: ${row.roles}`);
      });
    }

  } catch (error) {
    console.error("❌ Diagnostic error:", error);
  }
  
  console.log("\n================================\n");
}

diagnoseTables().then(() => process.exit(0));
