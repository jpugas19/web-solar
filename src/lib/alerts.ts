import { sql } from "./db";

interface AlertChannel {
  channel: string;
  severity: string;
  message: string;
}

export async function getLatestVal(
  source: string,
  fieldId?: string
): Promise<{ ts: string; val: number | null } | null> {
  let rows;
  if (fieldId) {
    rows = await sql`
      SELECT ts, val FROM readings
      WHERE source = ${source} AND field_id = ${fieldId}
      ORDER BY ts DESC LIMIT 1
    `;
  } else {
    rows = await sql`
      SELECT ts, val FROM readings
      WHERE source = ${source}
      ORDER BY ts DESC LIMIT 1
    `;
  }
  if (rows.length === 0) return null;
  return { ts: rows[0].ts, val: rows[0].val };
}

export async function getLatestAny(
  fieldId: string
): Promise<{ ts: string; val: number | null; val_text: string | null } | null> {
  const rows = await sql`
    SELECT ts, val, val_text FROM readings
    WHERE field_id = ${fieldId}
    ORDER BY ts DESC LIMIT 1
  `;
  if (rows.length === 0) return null;
  return { ts: rows[0].ts, val: rows[0].val, val_text: rows[0].val_text };
}

export async function evaluateAlerts(): Promise<AlertChannel[]> {
  const alerts: AlertChannel[] = [];

  // Get settings
  const settingsRows = await sql`SELECT key, value FROM settings`;
  const settings: Record<string, string> = {};
  for (const row of settingsRows) {
    settings[row.key] = row.value;
  }

  const socThreshold = parseFloat(settings.soc_threshold || "10");
  const dataLossMinutes = parseInt(settings.data_loss_minutes || "5", 10);
  const pvZeroMinutes = parseInt(settings.pv_zero_minutes || "15", 10);
  const pvWindowStart = parseInt(settings.pv_window_start || "9", 10);
  const pvWindowEnd = parseInt(settings.pv_window_end || "19", 10);

  // 1. Data loss check
  const lastReading = await sql`
    SELECT ts FROM readings ORDER BY ts DESC LIMIT 1
  `;
  if (lastReading.length === 0) {
    alerts.push({
      channel: "data",
      severity: "CRITICAL",
      message: "Sin datos en la base de datos",
    });
  } else {
    const lastTs = new Date(lastReading[0].ts);
    const diffMinutes = (Date.now() - lastTs.getTime()) / 60000;
    if (diffMinutes > dataLossMinutes) {
      alerts.push({
        channel: "data",
        severity: "CRITICAL",
        message: `Sin lecturas por ${diffMinutes.toFixed(0)} min`,
      });
    } else {
      alerts.push({ channel: "data", severity: "OK", message: "" });
    }
  }

  // 2. SOC check
  const socData = await getLatestAny("bt_battery_capacity");
  if (socData && socData.val !== null) {
    const tsDiff =
      (Date.now() - new Date(socData.ts).getTime()) / 60000;
    if (tsDiff < 10 && socData.val < socThreshold) {
      alerts.push({
        channel: "soc",
        severity: "CRITICAL",
        message: `SOC: ${socData.val.toFixed(1)}% (umbral: ${socThreshold}%)`,
      });
    } else {
      alerts.push({ channel: "soc", severity: "OK", message: "" });
    }

    // Critical levels
    for (const level of [3, 2, 1]) {
      if (socData.val < level) {
        alerts.push({
          channel: `soc${level}`,
          severity: "CRITICAL",
          message: `SOC critico: ${socData.val.toFixed(1)}%`,
        });
      } else {
        alerts.push({ channel: `soc${level}`, severity: "OK", message: "" });
      }
    }
  }

  // 3. PV zero during solar hours
  const pvData = await getLatestAny("pv_output_power");
  if (pvData && pvData.val !== null) {
    const now = new Date();
    const hour = now.getHours();
    if (hour >= pvWindowStart && hour < pvWindowEnd) {
      const tsDiff =
        (Date.now() - new Date(pvData.ts).getTime()) / 60000;
      if (pvData.val === 0 && tsDiff > pvZeroMinutes) {
        alerts.push({
          channel: "pv",
          severity: "WARNING",
          message: `PV en 0W por ${tsDiff.toFixed(0)} min (horario solar)`,
        });
      } else {
        alerts.push({ channel: "pv", severity: "OK", message: "" });
      }
    }
  }

  return alerts;
}

export async function sendTelegram(text: string): Promise<boolean> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!token || !chatId) {
    console.error("Telegram credentials not configured");
    return false;
  }

  try {
    const res = await fetch(
      `https://api.telegram.org/bot${token}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text,
          parse_mode: "HTML",
        }),
      }
    );
    return res.ok;
  } catch (err) {
    console.error("Telegram error:", err);
    return false;
  }
}

export async function processAlerts(): Promise<
  { channel: string; severity: string; sent: boolean }[]
> {
  const alerts = await evaluateAlerts();
  const results: { channel: string; severity: string; sent: boolean }[] = [];

  for (const alert of alerts) {
    // Get previous state
    const prev = await sql`
      SELECT severity FROM alert_state WHERE channel = ${alert.channel}
    `;
    const prevSeverity = prev.length > 0 ? prev[0].severity : null;

    // Only notify on state transition
    if (prevSeverity !== alert.severity && alert.severity !== "OK") {
      const emoji = alert.severity === "CRITICAL" ? "🔴" : "🟡";
      const text = `${emoji} <b>${alert.channel.toUpperCase()}</b>\n${alert.message}`;
      const sent = await sendTelegram(text);
      results.push({
        channel: alert.channel,
        severity: alert.severity,
        sent,
      });
    } else if (alert.severity === "OK" && prevSeverity !== "OK") {
      // Recovery notification
      const text = `🟢 <b>${alert.channel.toUpperCase()}</b> recuperado`;
      const sent = await sendTelegram(text);
      results.push({ channel: alert.channel, severity: "OK", sent });
    }

    // Update state
    await sql`
      INSERT INTO alert_state (channel, severity, updated_at)
      VALUES (${alert.channel}, ${alert.severity}, now())
      ON CONFLICT (channel) DO UPDATE SET severity = ${alert.severity}, updated_at = now()
    `;
  }

  return results;
}
