import { NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";

export const runtime = "nodejs";

const RETENTION_DAYS = 7;
const BUCKET_MINUTES = 30;

export async function GET() {
  const sql = neon(process.env.DATABASE_URL!);

  try {
    const [maxRow] = await sql`SELECT MAX(ts) as m FROM readings`;
    if (!maxRow?.m) {
      return NextResponse.json({ ok: true, message: "No data to clean" });
    }

    const cutoff = new Date(maxRow.m);
    cutoff.setDate(cutoff.getDate() - RETENTION_DAYS);

    const [oldCount] = await sql`SELECT COUNT(*) as c FROM readings WHERE ts < ${cutoff}`;
    if (Number(oldCount.c) === 0) {
      return NextResponse.json({ ok: true, message: "Nothing to clean", deleted: 0 });
    }

    // Downsample via subquery: compute bucket in inner, SELECT DISTINCT ON in outer
    const cutoffIso = cutoff.toISOString();
    const bucketExpr = `date_trunc('hour', ts) + (floor(date_part('minute', ts) / ${BUCKET_MINUTES}) * ${BUCKET_MINUTES} || ' minutes')::interval`;

    await sql`DROP TABLE IF EXISTS readings_ds`;
    await sql.unsafe(`CREATE TABLE readings_ds AS
      SELECT DISTINCT ON (${bucketExpr}, source, field_id)
        (${bucketExpr}) AS ts, source, field_id, title, unit, val, val_text
      FROM readings
      WHERE ts < '${cutoffIso}'
      ORDER BY ${bucketExpr}, source, field_id, ts`);

    const [dsCount] = await sql`SELECT COUNT(*) as c FROM readings_ds`;

    await sql`DELETE FROM readings WHERE ts < ${cutoff}`;

    await sql`
      INSERT INTO readings (ts, source, field_id, title, unit, val, val_text)
      SELECT ts, source, field_id, title, unit, val, val_text FROM readings_ds
      ON CONFLICT (ts, source, field_id) DO UPDATE SET
        title = EXCLUDED.title, unit = EXCLUDED.unit, val = EXCLUDED.val, val_text = EXCLUDED.val_text
    `;

    await sql`DROP TABLE readings_ds`;

    try {
      await sql`CLUSTER readings USING readings_pkey`;
    } catch (e) {
      console.warn("CLUSTER failed (non-fatal):", e);
    }

    const [stats] = await sql`
      SELECT COUNT(*) as total, pg_size_pretty(pg_total_relation_size('readings')) as size
      FROM readings
    `;

    return NextResponse.json({
      ok: true,
      cutoff: cutoffIso,
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
