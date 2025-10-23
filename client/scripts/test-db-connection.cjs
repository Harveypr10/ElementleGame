// client/scripts/test-db-connection.cjs
const { Client } = require("pg");

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("❌ Missing DATABASE_URL env var");
  process.exit(1);
}

const client = new Client({
  connectionString,
  ssl: { rejectUnauthorized: false },
});

async function main() {
  try {
    await client.connect();
    const res = await client.query(
      "SELECT now() as server_time, current_user, current_database()"
    );
    console.log("✅ Connected!");
    console.table(res.rows);
  } catch (err) {
    console.error("❌ Connection failed:", err.message);
  } finally {
    await client.end();
  }
}

main();
