/**
 * Wearable demo simulator — posts a single scenario batch to /api/health/ingest.
 *
 * Usage:
 *   pnpm simulate:wearable --list
 *   pnpm simulate:wearable --scenario <name> [--normal] [--user <u>] [--url <base>]
 *
 * Each scenario has two variants:
 *   (default)  anomalous value that triggers the alert rule
 *   --normal   healthy baseline that does NOT trigger any rule
 *
 * Scenarios:
 *   hr-critical    心率严重异常  heartRate > 120
 *   hr-low         心率严重异常  heartRate < 45
 *   bp-critical    血压危急      bloodPressure > 180
 *   spo2-critical  血氧过低      bloodOxygen < 90
 *   sleep-warning  睡眠不足      sleepAnalysis < 4 h
 */

import { config } from "dotenv";
config({ path: ".env" });
config({ path: ".env.local", override: true });

// ---------------------------------------------------------------------------
// CLI args
// ---------------------------------------------------------------------------

const argv = process.argv.slice(2);
const flag = (name: string) => argv.includes(name);
const opt = (name: string, def: string) => {
  const i = argv.indexOf(name);
  return i !== -1 && argv[i + 1] ? argv[i + 1] : def;
};

const USER     = opt("--user", "bill");
const BASE_URL = opt("--url", "http://localhost:3000");
const SCENARIO = opt("--scenario", "");
const NORMAL   = flag("--normal");
const LIST     = flag("--list");
const SECRET   = process.env.DEVICE_API_SECRET ?? "dev-device-secret-local";

// ---------------------------------------------------------------------------
// Scenario definitions
// ---------------------------------------------------------------------------

interface HealthRecord {
  metric: string;
  value: number;
  unit: string;
  timestamp: string;
  endTimestamp: string;
}

interface Scenario {
  name: string;
  rule: string;
  severity: "critical" | "warning" | "info";
  description: string;
  alert: Omit<HealthRecord, "timestamp" | "endTimestamp">[];
  normal: Omit<HealthRecord, "timestamp" | "endTimestamp">[];
}

const SCENARIOS: Scenario[] = [
  {
    name: "hr-critical",
    rule: "心率严重异常",
    severity: "critical",
    description: "heartRate > 120  →  触发 critical 心率严重异常",
    alert:  [{ metric: "heartRate", value: 128, unit: "bpm" }],
    normal: [{ metric: "heartRate", value: 72,  unit: "bpm" }],
  },
  {
    name: "hr-low",
    rule: "心率严重异常（偏低）",
    severity: "critical",
    description: "heartRate < 45  →  触发 critical 心率严重异常",
    alert:  [{ metric: "heartRate", value: 42, unit: "bpm" }],
    normal: [{ metric: "heartRate", value: 68, unit: "bpm" }],
  },
  {
    name: "bp-critical",
    rule: "血压危急",
    severity: "critical",
    description: "bloodPressure > 180  →  触发 critical 血压危急",
    alert:  [
      { metric: "bloodPressure", value: 185, unit: "mmHg" },
      { metric: "diastolicBP",   value: 112, unit: "mmHg" },
    ],
    normal: [
      { metric: "bloodPressure", value: 118, unit: "mmHg" },
      { metric: "diastolicBP",   value: 76,  unit: "mmHg" },
    ],
  },
  {
    name: "spo2-critical",
    rule: "血氧过低",
    severity: "critical",
    description: "bloodOxygen < 90  →  触发 critical 血氧过低",
    alert:  [{ metric: "bloodOxygen", value: 87, unit: "%" }],
    normal: [{ metric: "bloodOxygen", value: 98, unit: "%" }],
  },
  {
    name: "sleep-warning",
    rule: "睡眠不足",
    severity: "warning",
    description: "sleepAnalysis < 4 h  →  触发 warning 睡眠不足",
    alert:  [{ metric: "sleepAnalysis", value: 3.2, unit: "h" }],
    normal: [{ metric: "sleepAnalysis", value: 7.5, unit: "h" }],
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function printList() {
  console.log("Available scenarios:\n");
  const pad = Math.max(...SCENARIOS.map((s) => s.name.length));
  for (const s of SCENARIOS) {
    const sev = s.severity === "critical" ? "🔴 critical" : s.severity === "warning" ? "🟡 warning" : "🔵 info";
    console.log(`  ${s.name.padEnd(pad)}  ${sev}  ${s.rule}`);
    console.log(`  ${"".padEnd(pad)}  ${s.description}`);
    const alertVals  = s.alert.map((r)  => `${r.metric}=${r.value}${r.unit}`).join(", ");
    const normalVals = s.normal.map((r) => `${r.metric}=${r.value}${r.unit}`).join(", ");
    console.log(`  ${"".padEnd(pad)}  alert : ${alertVals}`);
    console.log(`  ${"".padEnd(pad)}  normal: ${normalVals}`);
    console.log();
  }
}

async function runScenario(scenario: Scenario, useNormal: boolean) {
  const ts = new Date().toISOString();
  const variant = useNormal ? "normal" : "alert";
  const rawRecords = useNormal ? scenario.normal : scenario.alert;

  const records: HealthRecord[] = rawRecords.map((r) => ({
    ...r,
    timestamp:    ts,
    endTimestamp: ts,
  }));

  const vals = records.map((r) => `${r.metric}=${r.value}${r.unit}`).join(", ");
  console.log(`Scenario : ${scenario.name} (${variant})`);
  console.log(`Rule     : ${scenario.rule}`);
  console.log(`Values   : ${vals}`);
  console.log(`User     : ${USER}`);
  console.log(`Endpoint : ${BASE_URL}/api/health/ingest`);
  console.log();

  const res = await fetch(`${BASE_URL}/api/health/ingest`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${SECRET}`,
    },
    body: JSON.stringify({
      username:   USER,
      sourceName: "Demo Simulator",
      records,
    }),
  });

  const data = await res.json() as Record<string, unknown>;
  if (res.ok) {
    console.log(`✓ inserted ${data.inserted} record(s)`);
    if (!useNormal) {
      console.log(`  → family alert should fire for: ${scenario.rule}`);
    } else {
      console.log(`  → no alert expected (healthy baseline)`);
    }
  } else {
    console.error(`✗ ${res.status}`, JSON.stringify(data));
    process.exit(1);
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  if (LIST) {
    printList();
    return;
  }

  if (!SCENARIO) {
    console.error("Error: --scenario <name> is required. Run with --list to see options.");
    process.exit(1);
  }

  const scenario = SCENARIOS.find((s) => s.name === SCENARIO);
  if (!scenario) {
    console.error(`Error: unknown scenario "${SCENARIO}". Run with --list to see options.`);
    process.exit(1);
  }

  await runScenario(scenario, NORMAL);
}

main().catch((err) => { console.error(err); process.exit(1); });
