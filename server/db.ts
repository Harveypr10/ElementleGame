import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

const databaseUrl = process.env.SUPABASE_DATABASE_URL || process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("SUPABASE_DATABASE_URL or DATABASE_URL environment variable is not set");
}

const client = postgres(databaseUrl, { ssl: 'require', prepare: false });
export const db = drizzle(client);
