import { neon } from "@neondatabase/serverless";
import bcrypt from "bcryptjs";

const sql = neon(process.env.DATABASE_URL!);

async function main() {
  const email = process.argv[2] || "admin@jpcode.cl";
  const password = process.argv[3] || "solar123";

  console.log(`Creating user: ${email}`);

  // Create tables if not exist
  await sql`
    CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      name TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS readings (
      ts TIMESTAMPTZ NOT NULL,
      source TEXT NOT NULL,
      field_id TEXT NOT NULL,
      title TEXT,
      unit TEXT,
      val DOUBLE PRECISION,
      val_text TEXT,
      PRIMARY KEY (ts, source, field_id)
    )
  `;

  await sql`CREATE INDEX IF NOT EXISTS idx_readings_field_ts ON readings (field_id, ts DESC)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_readings_ts ON readings (ts DESC)`;

  await sql`
    CREATE TABLE IF NOT EXISTS alert_state (
      channel TEXT PRIMARY KEY,
      severity TEXT NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;

  // Insert default settings
  const defaults: Record<string, string> = {
    soc_threshold: "10",
    data_loss_minutes: "5",
    pv_zero_minutes: "15",
    pv_window_start: "9",
    pv_window_end: "19",
  };

  for (const [key, value] of Object.entries(defaults)) {
    await sql`
      INSERT INTO settings (key, value) VALUES (${key}, ${value})
      ON CONFLICT (key) DO NOTHING
    `;
  }

  // Create user
  const hash = await bcrypt.hash(password, 10);

  await sql`
    INSERT INTO users (email, password_hash, name)
    VALUES (${email}, ${hash}, ${email.split("@")[0]})
    ON CONFLICT (email) DO UPDATE SET password_hash = ${hash}
  `;

  console.log(`User created/updated: ${email}`);
  console.log(`Password: ${password}`);
  console.log(`Tables created: users, readings, alert_state, settings`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
