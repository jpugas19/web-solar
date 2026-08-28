import { NextResponse } from "next/server";
import { sql } from "@/lib/db";

export async function GET() {
  try {
    const data = await sql`
      SELECT DISTINCT ON (field_id)
        ts, source, field_id, title, unit, val, val_text
      FROM readings
      ORDER BY field_id, (source = 'onedata') DESC, ts DESC
    `;

    return NextResponse.json({ data });
  } catch (err) {
    console.error("Latest query error:", err);
    return NextResponse.json(
      { error: String(err) },
      { status: 500 }
    );
  }
}
