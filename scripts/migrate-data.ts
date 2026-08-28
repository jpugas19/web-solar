import pg from "pg";

const localDsn = process.env.DATABASE_URL_LOCAL;
const neonDsn = process.env.DATABASE_URL_NEON;

if (!localDsn || !neonDsn) {
  console.error("Set DATABASE_URL_LOCAL and DATABASE_URL_NEON env vars");
  process.exit(1);
}

const localPool = new pg.Pool({ connectionString: localDsn });
const neonPool = new pg.Pool({ connectionString: neonDsn, ssl: { rejectUnauthorized: false } });

async function main() {
  // Find latest timestamp in Neon
  const neonClient = await neonPool.connect();
  const { rows: latestRows } = await neonClient.query("SELECT MAX(ts) as latest FROM readings");
  const latestTs = latestRows[0].latest;
  console.log(`Neon latest: ${latestTs || "empty"}`);

  // Export from local (only rows after Neon's latest)
  let query = "SELECT ts, source, field_id, title, unit, val, val_text FROM readings";
  const params: any[] = [];
  if (latestTs) {
    query += " WHERE ts > $1";
    params.push(latestTs);
  }
  query += " ORDER BY ts";

  console.log("Exporting remaining rows from local...");
  const { rows } = await localPool.query(query, params);
  console.log(`Remaining: ${rows.length} rows to import`);

  if (rows.length === 0) {
    console.log("Nothing to migrate");
    await neonClient.release();
    await localPool.end();
    await neonPool.end();
    return;
  }

  const BATCH = 2000;
  let imported = 0;

  for (let i = 0; i < rows.length; i += BATCH) {
    const chunk = rows.slice(i, i + BATCH);
    const values: any[] = [];
    const placeholders: string[] = [];
    let idx = 1;

    for (const row of chunk) {
      const ts = row.ts instanceof Date ? row.ts.toISOString() : String(row.ts);
      placeholders.push(
        `($${idx}, $${idx+1}, $${idx+2}, $${idx+3}, $${idx+4}, $${idx+5}, $${idx+6})`
      );
      values.push(ts, row.source, row.field_id, row.title, row.unit, row.val, row.val_text);
      idx += 7;
    }

    const insertQuery = `
      INSERT INTO readings (ts, source, field_id, title, unit, val, val_text)
      VALUES ${placeholders.join(", ")}
      ON CONFLICT (ts, source, field_id) DO NOTHING
    `;

    await neonClient.query(insertQuery, values);
    imported += chunk.length;
    process.stdout.write(`\r  ${imported}/${rows.length} rows (${((imported/rows.length)*100).toFixed(1)}%)`);
  }

  console.log(`\nMigration complete: ${imported} rows imported`);
  await neonClient.release();
  await localPool.end();
  await neonPool.end();
}

main().catch((err) => {
  console.error("Migration error:", err);
  process.exit(1);
});
