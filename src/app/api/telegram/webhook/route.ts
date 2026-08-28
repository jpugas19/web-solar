import { NextResponse } from "next/server";
import { sql } from "@/lib/db";

export const runtime = "nodejs";

interface TelegramUpdate {
  update_id?: number;
  message?: {
    chat?: { id?: number };
    text?: string;
    from?: { username?: string; first_name?: string };
  };
}

async function getLatest(
  fieldId: string,
  source = "onedata"
): Promise<{ val: number | null; val_text: string | null; unit: string | null } | null> {
  const rows = await sql`
    SELECT val, val_text, unit FROM readings
    WHERE field_id = ${fieldId} AND source = ${source}
    ORDER BY ts DESC LIMIT 1
  `;
  if (rows.length === 0) return { val: null, val_text: null, unit: null };
  return {
    val: rows[0].val,
    val_text: rows[0].val_text,
    unit: rows[0].unit,
  };
}

async function sendMessage(token: string, chatId: number, text: string) {
  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
    }),
  });
  return res.ok;
}

async function buildStatusText(): Promise<string> {
  const soc = await getLatest("bt_battery_capacity", "onedata");
  const batteryVoltage = await getLatest("battery_voltage", "onedata");
  const pv = await getLatest("pv_output_power", "onedata");
  const batteryPower = await getLatest("battery_active_discharging_power", "onedata");
  const load = await getLatest("load_active_power", "onedata");
  const grid = await getLatest("grid_active_power", "flow");

  const pvW = pv?.val ?? 0;
  const batW = batteryPower?.val ?? 0;
  const gridkW = grid?.val ?? 0;
  const loadW = load?.val ?? 0;

  const pvKw = pvW / 1000;
  const batKw = batW / 1000;
  const loadKw = loadW / 1000;
  const gridKw = gridkW;

  const vals = [pvKw, batKw, gridKw, loadKw].filter(v => v !== null && v !== undefined);
  const useKw = vals.some(v => Math.abs(v) >= 1.0);

  const fmt = (v: number | null | undefined) => {
    if (v === null || v === undefined) return "n/d";
    if (useKw) return `${v.toFixed(2)} kW`;
    return `${(v * 1000).toFixed(0)} W`;
  };

  const batFormatted = fmt(batKw);
  const batDetail = batKw !== null && batKw !== undefined && Math.abs(batKw) > 0.005
    ? ` ${batKw > 0 ? "(descarga)" : "(carga)"}`
    : "";

  const pvSrc = Math.abs(pvW) > 20 ? "SOLAR" :
    Math.abs(batW) > 20 ? "BATERIA" :
    Math.abs(gridkW * 1000) > 20 ? "RED" : "SIN FUENTE";

  const socS = soc?.val !== null && soc?.val !== undefined ? `${soc.val.toFixed(0)}%` : "n/d";
  const voltS = batteryVoltage?.val !== null && batteryVoltage?.val !== undefined
    ? `${batteryVoltage.val.toFixed(1)} V` : "n/d";

  return (
    `☀️ Paneles: ${fmt(pvKw)}\n` +
    `🔋 Batería: ${batFormatted}${batDetail}\n` +
    `⚡ Red: ${fmt(gridKw)}\n` +
    `🏠 Carga: ${fmt(loadKw)}\n` +
    `🔌 Alimentando: ${pvSrc}\n` +
    `Batería ${socS} ${voltS}`
  );
}

export async function POST(request: Request) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    console.error("webhook: TELEGRAM_BOT_TOKEN no configurado");
    return NextResponse.json({ ok: false, error: "Telegram not configured" }, { status: 500 });
  }

  let update: TelegramUpdate;
  try {
    update = await request.json();
  } catch (err) {
    console.error("webhook: JSON parse error:", err);
    return new NextResponse("ok", { status: 200 });
  }

  const text = (update.message?.text || "").trim().toLowerCase();
  const chatId = update.message?.chat?.id;

  console.log("webhook: update recibido chatId=", chatId, "text=", JSON.stringify(text));

  if (!chatId || !text) {
    console.log("webhook: sin chatId o texto, se ignora");
    return new NextResponse("ok", { status: 200 });
  }

  const isStatusCommand =
    text === "/estado" ||
    text === "estado" ||
    text.includes("/estado") ||
    (text.includes("estado") && !text.includes("alertas"));

  if (isStatusCommand) {
    try {
      console.log("webhook: procesando estado para chat", chatId);
      const statusText = await buildStatusText();
      console.log("webhook: statusText construido, longitud=", statusText.length);
      const sent = await sendMessage(token, chatId, statusText);
      console.log("webhook: sendMessage resultado=", sent);
      return NextResponse.json({ ok: true, sent, chatId });
    } catch (err) {
      console.error("webhook: error al procesar/send:", err);
      return NextResponse.json({ ok: false, error: String(err) }, { status: 200 });
    }
  }

  console.log("webhook: texto no reconocido como comando");
  return new NextResponse("ok", { status: 200 });
}

export async function GET() {
  return NextResponse.json({ ok: true, message: "Telegram webhook endpoint" });
}
