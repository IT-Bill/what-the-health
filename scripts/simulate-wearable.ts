/**
 * Wearable simulator — POSTs realistic health data to /api/health/ingest every minute.
 *
 * Usage:
 *   pnpm exec tsx scripts/simulate-wearable.ts [options]
 *
 * Options:
 *   --user <username>     Target user (default: bill)
 *   --url <base>          Base URL (default: http://localhost:3000)
 *   --interval <secs>     Upload interval in seconds (default: 60)
 *   --profile <name>      Data profile: adult (default) | elderly
 *   --anomaly             Force anomalous values to test family alerts
 *   --once                Upload one batch then exit
 */

import { config } from "dotenv";
config({ path: ".env" });
config({ path: ".env.local", override: true });

const args = process.argv.slice(2);
const flag = (name: string) => args.includes(name);
const opt = (name: string, def: string) => {
  const i = args.indexOf(name);
  return i !== -1 && args[i + 1] ? args[i + 1] : def;
};

const USER = opt("--user", "bill");
const BASE_URL = opt("--url", "http://localhost:3000");
const INTERVAL_S = parseInt(opt("--interval", "60"), 10);
const PROFILE = opt("--profile", "adult") as "adult" | "elderly";
const FORCE_ANOMALY = flag("--anomaly");
const ONCE = flag("--once");
const SECRET = process.env.DEVICE_API_SECRET ?? "dev-device-secret-local";

// ---------------------------------------------------------------------------
// Simulation helpers
// ---------------------------------------------------------------------------

function rand(min: number, max: number, decimals = 0): number {
  const v = Math.random() * (max - min) + min;
  return decimals > 0 ? parseFloat(v.toFixed(decimals)) : Math.round(v);
}

/** Returns the current simulated "context" based on wall clock hour. */
function getContext() {
  const h = new Date().getHours();
  const sleeping = h >= 23 || h < 7;
  const morning = h >= 7 && h < 9;
  const exercise = (h >= 7 && h < 8) || (h >= 18 && h < 19);
  const active = morning || (h >= 9 && h < 18);
  return { sleeping, morning, exercise, active, h };
}

function buildRecords(now: Date, profile: "adult" | "elderly", forceAnomaly: boolean) {
  const ctx = getContext();
  const ts = now.toISOString();

  const records: Array<{
    metric: string;
    value: number;
    unit: string;
    timestamp: string;
    endTimestamp: string;
    metadata?: Record<string, unknown>;
  }> = [];

  if (profile === "elderly") {
    // ── Elderly profile (高血压老人) ──────────────────────────────────────
    // Heart rate: resting higher, prone to bradycardia from medication
    let hr: number;
    if (forceAnomaly) {
      hr = rand(42, 48); // triggers low HR warning (medication overdose simulation)
    } else if (ctx.sleeping) {
      hr = rand(55, 68);
    } else if (ctx.active) {
      hr = rand(78, 98);
    } else {
      hr = rand(68, 85);
    }
    records.push({ metric: "heartRate", value: hr, unit: "bpm", timestamp: ts, endTimestamp: ts });

    // Systolic blood pressure — chronically elevated
    let sbp: number;
    if (forceAnomaly) {
      sbp = rand(168, 188); // triggers critical/warning
    } else if (ctx.morning) {
      sbp = rand(148, 165); // morning surge common in elderly hypertensives
    } else if (ctx.sleeping) {
      sbp = rand(128, 142);
    } else {
      sbp = rand(138, 158);
    }
    records.push({ metric: "bloodPressure", value: sbp, unit: "mmHg", timestamp: ts, endTimestamp: ts });

    // Diastolic blood pressure
    const dbp = forceAnomaly ? rand(95, 112) : rand(78, 92);
    records.push({ metric: "diastolicBP", value: dbp, unit: "mmHg", timestamp: ts, endTimestamp: ts });

    // Blood oxygen — slightly lower baseline due to age-related lung changes
    const spo2 = forceAnomaly ? rand(88, 92) : ctx.sleeping ? rand(93, 96) : rand(95, 98);
    records.push({ metric: "bloodOxygen", value: spo2, unit: "%", timestamp: ts, endTimestamp: ts });

    // Steps — much fewer, mostly slow walking
    if (!ctx.sleeping) {
      const steps = ctx.active ? rand(5, 30) : rand(0, 8);
      if (steps > 0) records.push({ metric: "steps", value: steps, unit: "count", timestamp: ts, endTimestamp: ts });
    }

    // HRV — lower in elderly, especially with hypertension
    if (ctx.sleeping || !ctx.active) {
      records.push({ metric: "hrv", value: rand(12, 32), unit: "ms", timestamp: ts, endTimestamp: ts });
    }

    // Sleep quality — fragmented, short
    if (ctx.sleeping && Math.random() < 0.1) {
      // Occasional sleep duration report (hours)
      records.push({ metric: "sleepAnalysis", value: rand(3, 6, 1), unit: "h", timestamp: ts, endTimestamp: ts });
    }

    // Respiratory rate — slightly elevated
    if (ctx.sleeping) {
      records.push({ metric: "respiratoryRate", value: rand(14, 22), unit: "breaths/min", timestamp: ts, endTimestamp: ts });
    }

    // Resting HR — once per ~hour
    if (!ctx.exercise && Math.random() < 1 / 60) {
      records.push({ metric: "restingHR", value: rand(65, 80), unit: "bpm", timestamp: ts, endTimestamp: ts });
    }

  } else {
    // ── Adult profile (default) ───────────────────────────────────────────
    let hr: number;
    if (forceAnomaly) {
      hr = rand(130, 155);
    } else if (ctx.exercise) {
      hr = rand(110, 145);
    } else if (ctx.sleeping) {
      hr = rand(48, 58);
    } else if (ctx.active) {
      hr = rand(65, 88);
    } else {
      hr = rand(58, 72);
    }
    records.push({ metric: "heartRate", value: hr, unit: "bpm", timestamp: ts, endTimestamp: ts });

    const spo2 = forceAnomaly ? rand(88, 92) : ctx.sleeping ? rand(95, 98) : rand(97, 99);
    records.push({ metric: "bloodOxygen", value: spo2, unit: "%", timestamp: ts, endTimestamp: ts });

    if (!ctx.sleeping) {
      const steps = ctx.exercise ? rand(80, 160) : ctx.active ? rand(20, 80) : rand(0, 20);
      if (steps > 0) records.push({ metric: "steps", value: steps, unit: "count", timestamp: ts, endTimestamp: ts });
    }

    const cals = ctx.exercise ? rand(8, 14, 1) : ctx.active ? rand(1, 4, 1) : rand(0.8, 1.5, 1);
    records.push({ metric: "calories", value: cals, unit: "kcal", timestamp: ts, endTimestamp: ts });

    if (ctx.sleeping || (!ctx.active && !ctx.exercise)) {
      records.push({ metric: "hrv", value: rand(28, 65), unit: "ms", timestamp: ts, endTimestamp: ts });
    }

    if (ctx.sleeping) {
      records.push({ metric: "respiratoryRate", value: rand(12, 18), unit: "breaths/min", timestamp: ts, endTimestamp: ts });
    }

    if (!ctx.exercise && Math.random() < 1 / 60) {
      records.push({ metric: "restingHR", value: rand(52, 68), unit: "bpm", timestamp: ts, endTimestamp: ts });
    }

    if (ctx.active && Math.random() < 0.3) {
      records.push({ metric: "stress", value: rand(15, forceAnomaly ? 85 : 55), unit: "score", timestamp: ts, endTimestamp: ts });
    }
  }

  return records;
}

// ---------------------------------------------------------------------------
// Upload
// ---------------------------------------------------------------------------

async function upload(profile: "adult" | "elderly", forceAnomaly: boolean) {
  const now = new Date();
  const records = buildRecords(now, profile, forceAnomaly);

  const summary = records.map((r) => `${r.metric}=${r.value}${r.unit}`).join(", ");
  process.stdout.write(`[${now.toLocaleTimeString()}] uploading ${records.length} records: ${summary} ... `);

  try {
    const res = await fetch(`${BASE_URL}/api/health/ingest`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SECRET}`,
      },
      body: JSON.stringify({
        username: USER,
        sourceName: profile === "elderly" ? "Simulated Elder Band" : "Simulated Band",
        records,
      }),
    });

    const data = await res.json() as Record<string, unknown>;
    if (res.ok) {
      console.log(`✓ inserted ${data.inserted}`);
    } else {
      console.log(`✗ ${res.status} ${JSON.stringify(data)}`);
    }
  } catch (err) {
    console.log(`✗ network error: ${err instanceof Error ? err.message : String(err)}`);
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

console.log(`Wearable simulator → ${BASE_URL}/api/health/ingest`);
console.log(`  user: ${USER}  profile: ${PROFILE}  interval: ${INTERVAL_S}s  anomaly: ${FORCE_ANOMALY}  once: ${ONCE}`);
console.log("Press Ctrl+C to stop.\n");

async function main() {
  await upload(PROFILE, FORCE_ANOMALY);
  if (!ONCE) {
    setInterval(() => void upload(PROFILE, FORCE_ANOMALY), INTERVAL_S * 1000);
  }
}

main().catch((err) => { console.error(err); process.exit(1); });
