import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";

export async function GET(request: NextRequest) {
  const field = request.nextUrl.searchParams.get("field");
  const hours = request.nextUrl.searchParams.get("hours");
  const from = request.nextUrl.searchParams.get("from");
  const to = request.nextUrl.searchParams.get("to");

  if (!field) {
    return NextResponse.json(
      { error: "field parameter required" },
      { status: 400 }
    );
  }

  try {
    let data;

    if (from && to) {
      data = await sql`
        SELECT ts, val, val_text
        FROM readings
        WHERE field_id = ${field}
          AND ts >= ${from}::timestamptz
          AND ts <= ${to}::timestamptz
        ORDER BY ts ASC
      `;
    } else {
      const h = parseInt(hours || "6", 10);
      data = await sql`
        SELECT ts, val, val_text
        FROM readings
        WHERE field_id = ${field}
          AND ts > now() - (${h} || ' hours')::interval
        ORDER BY ts ASC
      `;
    }

    return NextResponse.json({ data });
  } catch (err) {
    console.error("Readings query error:", err);
    return NextResponse.json(
      { error: String(err) },
      { status: 500 }
    );
  }
}
