import { NextResponse } from "next/server";
import { processAlerts } from "@/lib/alerts";

export const runtime = "edge";

export async function GET() {
  try {
    const results = await processAlerts();
    return NextResponse.json({ ok: true, alerts: results });
  } catch (err) {
    console.error("Alerts error:", err);
    return NextResponse.json(
      { ok: false, error: String(err) },
      { status: 500 }
    );
  }
}
