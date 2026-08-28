import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";

export async function GET(request: NextRequest) {
  const field = request.nextUrl.searchParams.get("field");
  const hours = parseInt(request.nextUrl.searchParams.get("hours") || "6", 10);

  if (!field) {
    return NextResponse.json(
      { error: "field parameter required" },
      { status: 400 }
    );
  }

  try {
    const data = await sql`
      SELECT ts, val, val_text
      FROM readings
      WHERE field_id = ${field}
        AND ts > now() - (${hours} || ' hours')::interval
      ORDER BY ts ASC
    `;

    return NextResponse.json({ data });
  } catch (err) {
    console.error("Readings query error:", err);
    return NextResponse.json(
      { error: String(err) },
      { status: 500 }
    );
  }
}
