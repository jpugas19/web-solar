import { NextResponse } from "next/server";
import { Pool } from "pg";

export const runtime = "nodejs";

const RETENTION_DAYS = 7;
const BUCKET_MINUTES = 30;

export async function GET() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL!,
    ssl: { rejectUnauthorized: false },
  });
  const client = await pool.connect();

  try {
    // 1. Get cutoff
    const maxRes = await client.query("SELECT MAX(ts) as m FROM readings");
    if (!maxRes.rows[0]?.m) {
      return NextResponse.json({ ok: true, message: "No data to clean" });
    }

    const cutoff = new Date(maxRes.rows[0].m);
    cutoff.setDate(cutoff.getDate() - RETENTION_DAYS);
    const cutoffIso = cutoff.toISOString();

    // 2. Count old rows
    const oldRes = await client.query("SELECT COUNT(*) as c FROM readings WHERE ts < $1", [cutoffIso]);
    if (Number(oldRes.rows[0].c) === 0) {
      return NextResponse.json({ ok: true, message: "Nothing to clean", deleted: 0 });
    }

    // 3. Create downsampled temp table
    const bMin = BUCKET_MINUTES;
    await client.query("DROP TABLE IF EXISTS readings_ds");
    await client.query(`
      CREATE TABLE readings_ds AS
      SELECT DISTINCT ON (
        date_trunc('hour', ts) + (floor(date_part('minute', ts) / $1) * $1 || ' minutes')::interval,
        source, field_id
      )
        (date_trunc('hour', ts) + (floor(date_part('minute', ts) / $1) * $1 || ' minutes')::interval) AS ts,
        source, field_id, title, unit, val, val_text
      FROM readings
      WHERE ts < $2
      ORDER BY
        (date_trunc('hour', ts) + (floor(date_part('minute', ts) / $1) * $1 || ' minutes')::interval),
        source, field_id, ts
    `, [bMin, cutoffIso]);

    const dsRes = await client.query("SELECT COUNT(*) as c FROM readings_ds");

    // 4. Delete old rows
    await client.query("DELETE FROM readings WHERE ts < $1", [cutoffIso]);

    // 5. Insert downsampled rows
    await client.query(`
      INSERT INTO readings (ts, source, field_id, title, unit, val, val_text)
      SELECT ts, source, field_id, title, unit, val, val_text FROM readings_ds
      ON CONFLICT (ts, source, field_id) DO UPDATE SET
        title = EXCLUDED.title, unit = EXCLUDED.unit, val = EXCLUDED.val, val_text = EXCLUDED.val_text
    `);

    // 6. Drop temp table
    await client.query("DROP TABLE readings_ds");

    // 7. CLUSTER to reclaim disk space
    try {
      await client.query("CLUSTER readings USING readings_pkey");
    } catch (e) {
      console.warn("CLUSTER failed (non-fatal):", e);
    }

    // 8. Final stats
    const statsRes = await client.query(`
      SELECT COUNT(*) as total, pg_size_pretty(pg_total_relation_size('readings')) as size FROM readings
    `);

    return NextResponse.json({
      ok: true,
      cutoff: cutoffIso,
      deleted: Number(oldRes.rows[0].c),
      downsampled: Number(dsRes.rows[0].c),
      total: Number(statsRes.rows[0].total),
      size: statsRes.rows[0].size,
    });
  } catch (err) {
    console.error("Cleanup error:", err);
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  } finally {
    client.release();
    await pool.end();
  }
}
