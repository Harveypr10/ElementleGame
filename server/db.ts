import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

// Prefer direct connection (SUPABASE_DATABASE_URL) over pooled connection (DATABASE_URL)
// Direct connection uses port 5432, pooled uses port 6543
const databaseUrl = process.env.SUPABASE_DATABASE_URL || process.env.DATABASE_URL;

console.log("DB URL check - SUPABASE_DATABASE_URL exists:", !!process.env.SUPABASE_DATABASE_URL);
console.log("DB URL check - DATABASE_URL exists:", !!process.env.DATABASE_URL);

if (!databaseUrl) {
  throw new Error("SUPABASE_DATABASE_URL or DATABASE_URL must be set");
}

// Log connection info (hide password)
const safeUrl = databaseUrl.replace(/:([^:@]+)@/, ':****@');
console.log("Connecting to DB:", safeUrl);

const client = postgres(databaseUrl, { ssl: 'require', prepare: false });
export const db = drizzle(client);

