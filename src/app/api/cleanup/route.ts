import { NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";

export const runtime = "nodejs";

const CLEANUP_RETENTION_DAYS = 7;
const DOWNSAMPLE_MINUTES = 30;

export async function GET() {
  const sql = neon(process.env.DATABASE_URL!);

  try {
    // 1. Get cutoff
    const [maxRow] = await sql`SELECT MAX(ts) as m FROM readings`;
    if (!maxRow?.m) {
      return NextResponse.json({ ok: true, message: "No data to clean" });
    }

    const cutoff = new Date(maxRow.m);
    cutoff.setDate(cutoff.getDate() - CLEANUP_RETENTION_DAYS);

    // 2. Count old rows
    const [oldCount] = await sql`SELECT COUNT(*) as c FROM readings WHERE ts < ${cutoff}`;
    if (Number(oldCount.c) === 0) {
      return NextResponse.json({ ok: true, message: "Nothing to clean", deleted: 0 });
    }

    // 3. Create downsampled temp table
    await sql`DROP TABLE IF EXISTS readings_ds`;
    await sql`
      CREATE TABLE readings_ds AS
      SELECT DISTINCT ON (bucket, source, field_id)
        bucket, source, field_id, title, unit, val, val_text
      FROM (
        SELECT
          (date_trunc('hour', ts) + (floor(date_part('minute', ts) / ${DOWNSAMPLE_MINUTES}) * ${DOWNSAMPLE_MINUTES} || ' minutes')::interval) as bucket,
          source, field_id, title, unit, val, val_text,
          ROW_NUMBER() OVER (PARTITION BY
            date_trunc('hour', ts) + (floor(date_part('minute', ts) / ${DOWNSAMPLE_MINUTES}) * ${DOWNSAMPLE_MINUTES} || ' minutes')::interval,
            source, field_id
            ORDER BY ts
          ) as rn
        FROM readings
        WHERE ts < ${cutoff}
      ) sub
      WHERE rn = 1
    `;

    const [dsCount] = await sql`SELECT COUNT(*) as c FROM readings_ds`;

    // 4. Delete old rows
    const delResult = await sql`DELETE FROM readings WHERE ts < ${cutoff}`;

    // 5. Insert downsampled
    await sql`
      INSERT INTO readings (ts, source, field_id, title, unit, val, val_text)
      SELECT ts, source, field_id, title, unit, val, val_text FROM readings_ds
      ON CONFLICT (ts, source, field_id) DO UPDATE SET
        title = EXCLUDED.title, unit = EXCLUDED.unit, val = EXCLUDED.val, val_text = EXCLUDED.val_text
    `;

    // 6. Drop temp table
    await sql`DROP TABLE readings_ds`;

    // 7. CLUSTER to reclaim space
    try {
      await sql`CLUSTER readings USING readings_pkey`;
    } catch (e) {
      // CLUSTER may not be supported on all Neon plans — not fatal
      console.warn("CLUSTER failed (non-fatal):", e);
    }

    // 8. Final stats
    const [stats] = await sql`
      SELECT COUNT(*) as total, pg_size_pretty(pg_total_relation_size('readings')) as size
      FROM readings
    `;

    return NextResponse.json({
      ok: true,
      cutoff: cutoff.toISOString(),
      deleted: Number(oldCount.c),
      downsampled: Number(dsCount.c),
      total: Number(stats.total),
      size: stats.size,
    });
  } catch (err) {
    console.error("Cleanup error:", err);
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
