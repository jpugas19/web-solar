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
  console.log("Exporting from local database...");
  const { rows } = await localPool.query(
    "SELECT ts, source, field_id, title, unit, val, val_text FROM readings ORDER BY ts"
  );
  console.log(`Exported ${rows.length} rows`);

  if (rows.length === 0) {
    console.log("No data to migrate");
    await localPool.end();
    await neonPool.end();
    return;
  }

  const first = rows[0].ts;
  const last = rows[rows.length - 1].ts;
  console.log(`Range: ${first} → ${last}`);

  // Use COPY for bulk insert
  console.log("Importing to Neon via COPY...");

  const client = await neonPool.connect();
  try {
    // Create a readable stream from the rows
    const { Readable } = await import("stream");

    // Use COPY for fast bulk insert
    const copySQL = `COPY readings (ts, source, field_id, title, unit, val, val_text) FROM STDIN`;

    const inputStream = new Readable({
      read() {
        for (const row of rows) {
          const ts = row.ts instanceof Date ? row.ts.toISOString() : String(row.ts);
          const line = [
            ts,
            row.source,
            row.field_id,
            row.title || "\\N",
            row.unit || "\\N",
            row.val !== null ? String(row.val) : "\\N",
            row.val_text || "\\N",
          ].join("\t") + "\n";
          this.push(line);
        }
        this.push(null);
      },
    });

    await client.query(copySQL, [], (err: any, res: any) => {
      if (err) console.error("COPY error:", err.message);
    });

    // Since node-postgres COPY doesn't support streams easily, use batched INSERT
    console.log("Using batched INSERT instead...");
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

      const query = `
        INSERT INTO readings (ts, source, field_id, title, unit, val, val_text)
        VALUES ${placeholders.join(", ")}
        ON CONFLICT (ts, source, field_id) DO NOTHING
      `;

      await client.query(query, values);
      imported += chunk.length;
      process.stdout.write(`\r  ${imported}/${rows.length} rows (${((imported/rows.length)*100).toFixed(1)}%)`);
    }

    console.log(`\nMigration complete: ${imported} rows imported`);
  } finally {
    client.release();
  }

  await localPool.end();
  await neonPool.end();
}

main().catch((err) => {
  console.error("Migration error:", err);
  process.exit(1);
});
