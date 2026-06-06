/**
 * Memory report data simulator — writes one or more days of data through the app API.
 *
 * Usage:
 *   pnpm simulate:report:list
 *   pnpm simulate:report --user bill2 --date 2026-06-03 --scenario sleep-low
 *   pnpm simulate:report --user bill2 --date 2026-06-01 --days 7 --scenario active
 *   pnpm simulate:report --url https://example.com --user bill2 --date 2026-06-01 --scenario balanced
 *
 * Defaults:
 *   --url http://localhost:3000
 *   --user bill2
 *   --date today (UTC)
 *   --scenario balanced
 *   --replace true (removes this simulator's rows for the target date first)
 */

import { config } from "dotenv";
import { REPORT_SIMULATION_SCENARIOS } from "@/lib/report/simulation-scenarios";

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

const BASE_URL = opt("--url", "http://localhost:3000").replace(/\/+$/, "");
const USER = opt("--user", "bill2");
const DATE = opt("--date", new Date().toISOString().slice(0, 10));
const SCENARIO = opt("--scenario", "balanced");
const DAYS = Math.max(1, Number.parseInt(opt("--days", "1"), 10) || 1);
const LIST = flag("--list");
const REPLACE = !flag("--no-replace");
const SECRET = opt("--secret", process.env.DEVICE_API_SECRET ?? "dev-device-secret-local");

function printList() {
  console.log("Available scenarios:\n");
  const pad = Math.max(...REPORT_SIMULATION_SCENARIOS.map((s) => s.name.length));
  for (const scenario of REPORT_SIMULATION_SCENARIOS) {
    const d = scenario.day;
    console.log(`  ${scenario.name.padEnd(pad)}  ${scenario.description}`);
    console.log(
      `  ${"".padEnd(pad)}  sleep=${d.sleepHours ?? "-"}h steps=${d.steps ?? "-"} workout=${d.workoutMinutes ?? "-"}min mood=${d.mood ?? "-"} habits=${d.habitCompletions}`
    );
    console.log();
  }
}

async function main() {
  if (LIST) {
    printList();
    return;
  }

  const scenario = REPORT_SIMULATION_SCENARIOS.find((s) => s.name === SCENARIO);
  if (!scenario) {
    console.error(`Unknown scenario "${SCENARIO}". Run --list to see options.`);
    process.exit(1);
  }

  const endpoint = `${BASE_URL}/api/memory/simulate-report-data`;
  console.log(`User     : ${USER}`);
  console.log(`Scenario : ${scenario.name} - ${scenario.description}`);
  console.log(`Dates    : ${DATE}${DAYS > 1 ? ` + ${DAYS - 1} day(s)` : ""}`);
  console.log(`Replace  : ${REPLACE ? "yes" : "no"}`);
  console.log(`Endpoint : ${endpoint}`);
  console.log();

  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${SECRET}`,
    },
    body: JSON.stringify({
      username: USER,
      date: DATE,
      scenario: SCENARIO,
      days: DAYS,
      replace: REPLACE,
    }),
  });

  const data = await res.json() as { error?: string; wrote?: string[] };
  if (!res.ok) {
    console.error(`✗ ${res.status}`, JSON.stringify(data));
    process.exit(1);
  }

  for (const day of data.wrote ?? []) {
    console.log(`✓ wrote ${day}`);
  }
  console.log("\nDone. Regenerate the Memory weekly/monthly report to see the simulated data.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
