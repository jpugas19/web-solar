import { ValueCloudsClient, flattenReadings, flattenSPMicro, flattenFlow } from "../src/lib/valueclouds";

async function main() {
  console.log("Testing ValueClouds API connection...");

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

  console.log("Logging in...");
  await client.login();
  console.log("Login OK");

  console.log("\nFetching oneData...");
  const onedata = await client.oneData();
  const flat1 = flattenReadings(onedata);
  console.log(`  oneData: ${flat1.length} fields`);
  const pvField = flat1.find((f) => f.field_id === "pv_output_power");
  if (pvField) console.log(`  PV Output: ${pvField.val} ${pvField.unit}`);

  console.log("\nFetching spMicroLastData...");
  const spmicro = await client.spMicroLastData();
  const flat2 = flattenSPMicro(spmicro);
  console.log(`  spMicro: ${flat2.length} fields`);

  console.log("\nFetching energyFlow...");
  const flow = await client.energyFlow();
  const flat3 = flattenFlow(flow);
  console.log(`  flow: ${flat3.length} fields`);

  console.log("\nAll API tests passed!");
}

main().catch((err) => {
  console.error("API test failed:", err);
  process.exit(1);
});
