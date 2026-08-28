import { neon } from "@neondatabase/serverless";

const localDsn = process.env.DATABASE_URL_LOCAL;
const neonDsn = process.env.DATABASE_URL_NEON;

if (!localDsn || !neonDsn) {
  console.error("Set DATABASE_URL_LOCAL and DATABASE_URL_NEON env vars");
  process.exit(1);
}

const localSql = neon(localDsn);
const neonSql = neon(neonDsn);

async function main() {
  console.log("Exporting from local database...");
  const rows = await localSql`SELECT ts, source, field_id, title, unit, val, val_text FROM readings ORDER BY ts`;
  console.log(`Exported ${rows.length} rows`);

  if (rows.length === 0) {
    console.log("No data to migrate");
    return;
  }

  const first = rows[0].ts;
  const last = rows[rows.length - 1].ts;
  console.log(`Range: ${first} → ${last}`);

  console.log("Importing to Neon...");
  const CHUNK = 500;
  let imported = 0;

  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK);
    for (const row of chunk) {
      await neonSql`
        INSERT INTO readings (ts, source, field_id, title, unit, val, val_text)
        VALUES (${row.ts}, ${row.source}, ${row.field_id}, ${row.title}, ${row.unit}, ${row.val}, ${row.val_text})
        ON CONFLICT (ts, source, field_id)
        DO UPDATE SET title = ${row.title}, unit = ${row.unit}, val = ${row.val}, val_text = ${row.val_text}
      `;
      imported++;
    }
    process.stdout.write(`\r  ${imported}/${rows.length} rows`);
  }

  console.log(`\nMigration complete: ${imported} rows imported`);
}

main().catch((err) => {
  console.error("Migration error:", err);
  process.exit(1);
});
