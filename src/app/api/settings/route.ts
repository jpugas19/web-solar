import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";

export async function GET() {
  try {
    const data = await sql`SELECT key, value, updated_at FROM settings ORDER BY key`;
    return NextResponse.json({ data });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { key, value } = await request.json();
    if (!key || value === undefined) {
      return NextResponse.json(
        { error: "key and value required" },
        { status: 400 }
      );
    }

    await sql`
      INSERT INTO settings (key, value, updated_at)
      VALUES (${key}, ${String(value)}, now())
      ON CONFLICT (key) DO UPDATE SET value = ${String(value)}, updated_at = now()
    `;

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
