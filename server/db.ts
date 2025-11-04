import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

// Use SUPABASE_DATABASE_URL if available, otherwise DATABASE_URL
let databaseUrl = process.env.SUPABASE_DATABASE_URL || process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("SUPABASE_DATABASE_URL or DATABASE_URL must be set");
}

// Convert direct connection to session pooler for better compatibility with Replit
// Direct: postgresql://postgres:pwd@db.xxx.supabase.co:5432/postgres
// Pooler: postgresql://postgres.xxx:pwd@aws-0-xx.pooler.supabase.com:6543/postgres?pgbouncer=true
if (databaseUrl.includes('db.') && databaseUrl.includes('.supabase.co:5432')) {
  // Extract project ref from db.{project-ref}.supabase.co
  const match = databaseUrl.match(/db\.([^.]+)\.supabase\.co/);
  if (match) {
    const projectRef = match[1];
    const [protocol, rest] = databaseUrl.split('://');
    const [credentials, hostAndDb] = rest.split('@');
    const [username, password] = credentials.split(':');
    const dbName = hostAndDb.split('/')[1];
    
    // For pgbouncer, username must be postgres.{project-ref}
    const poolerUsername = `postgres.${projectRef}`;
    const poolerHost = `aws-1-eu-west-2.pooler.supabase.com`;
    
    databaseUrl = `${protocol}://${poolerUsername}:${password}@${poolerHost}:6543/${dbName}?pgbouncer=true`;
    console.log("Converted direct connection to session pooler with proper username format");
  }
}

// Log connection info (hide password)
const safeUrl = databaseUrl.replace(/:([^:@]+)@/, ':****@');
console.log("Connecting to DB:", safeUrl);

const client = postgres(databaseUrl, { ssl: 'require', prepare: false });
export const db = drizzle(client);

