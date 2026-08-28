import { neon } from "@neondatabase/serverless";

const dsn = process.env.DATABASE_URL;
if (!dsn) {
  console.error("Set DATABASE_URL env var");
  process.exit(1);
}

const sql = neon(dsn);

async function main() {
  console.log("Testing Neon connection...");

  // Test basic query
  const result = await sql`SELECT NOW() as time`;
  console.log(`Connected at: ${result[0].time}`);

  // Test readings table
  const count = await sql`SELECT COUNT(*) as total FROM readings`;
  console.log(`Readings table: ${count[0].total} rows`);

  // Test latest reading
  const latest = await sql`SELECT ts, source, field_id, val FROM readings ORDER BY ts DESC LIMIT 1`;
  if (latest.length > 0) {
    console.log(`Latest reading: ${latest[0].ts} [${latest[0].source}] ${latest[0].field_id} = ${latest[0].val}`);
  }

  // Test users table
  const users = await sql`SELECT email, name FROM users`;
  console.log(`Users: ${users.map((u) => u.email).join(", ") || "none"}`);

  // Test settings table
  const settings = await sql`SELECT key, value FROM settings`;
  console.log(`Settings: ${settings.map((s) => `${s.key}=${s.value}`).join(", ") || "none"}`);

  console.log("\nAll tests passed!");
}

main().catch((err) => {
  console.error("DB test failed:", err);
  process.exit(1);
});
