import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL must be set to your Supabase Postgres connection string");
}

const client = postgres(databaseUrl, { ssl: 'require', prepare: false });
export const db = drizzle(client);
console.log("Connecting to DB:", databaseUrl);

