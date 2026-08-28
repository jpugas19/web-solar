import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import {
  ValueCloudsClient,
  flattenReadings,
  flattenSPMicro,
  flattenFlow,
} from "@/lib/valueclouds";

export const runtime = "edge";

export async function GET() {
  try {
    const client = new ValueCloudsClient(
      process.env.VALUECLOUDS_ACCOUNT!,
      process.env.VALUECLOUDS_PASSWORD!,
      {
        pn: process.env.DEVICE_PN!,
        sn: process.env.DEVICE_SN!,
        devcode: process.env.DEVICE_DEVCODE!,
        devaddr: process.env.DEVICE_DEVADDR!,
      }
    );

    await client.login();

    const ts = new Date().toISOString();
    let totalRows = 0;

    // Source 1: onedata (~115 fields)
    const onedata = await client.oneData();
    const onedaRows = flattenReadings(onedata);
    if (onedaRows.length > 0) {
      await insertBatch(ts, "onedata", onedaRows);
      totalRows += onedaRows.length;
    }

    // Source 2: spmicro (grid/load summary)
    const spmicro = await client.spMicroLastData();
    const spRows = flattenSPMicro(spmicro);
    if (spRows.length > 0) {
      await insertBatch(ts, "spmicro", spRows);
      totalRows += spRows.length;
    }

    // Source 3: flow (power flow kW)
    const flow = await client.energyFlow();
    const flowRows = flattenFlow(flow);
    if (flowRows.length > 0) {
      await insertBatch(ts, "flow", flowRows);
      totalRows += flowRows.length;
    }

    return NextResponse.json({ ok: true, ts, count: totalRows });
  } catch (err) {
    console.error("Capture error:", err);
    return NextResponse.json(
      { ok: false, error: String(err) },
      { status: 500 }
    );
  }
}

async function insertBatch(
  ts: string,
  source: string,
  rows: Array<{
    field_id: string;
    title: string;
    unit: string;
    val: number | null;
    val_text: string | null;
  }>
) {
  // Batch insert in chunks of 100
  const CHUNK = 100;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK);
    for (const row of chunk) {
      await sql`
        INSERT INTO readings (ts, source, field_id, title, unit, val, val_text)
        VALUES (${ts}, ${source}, ${row.field_id}, ${row.title}, ${row.unit}, ${row.val}, ${row.val_text})
        ON CONFLICT (ts, source, field_id)
        DO UPDATE SET title = ${row.title}, unit = ${row.unit}, val = ${row.val}, val_text = ${row.val_text}
      `;
    }
  }
}
