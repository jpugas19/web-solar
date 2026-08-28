import { sendTelegram, evaluateAlerts } from "../src/lib/alerts";

async function main() {
  console.log("Testing alert system...");

  console.log("\nEvaluating alert conditions...");
  const alerts = await evaluateAlerts();
  for (const a of alerts) {
    const icon = a.severity === "CRITICAL" ? "🔴" : a.severity === "WARNING" ? "🟡" : "🟢";
    console.log(`  ${icon} ${a.channel}: ${a.severity} ${a.message}`);
  }

  if (process.argv.includes("--test-telegram")) {
    console.log("\nSending test Telegram message...");
    const sent = await sendTelegram("🧪 Test de alertas - Solar Monitor funciona correctamente!");
    console.log(`  Sent: ${sent}`);
  } else {
    console.log("\n(Use --test-telegram to send a test message)");
  }

  console.log("\nAlert tests passed!");
}

main().catch((err) => {
  console.error("Alert test failed:", err);
  process.exit(1);
});
