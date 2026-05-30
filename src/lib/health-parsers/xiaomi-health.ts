import AdmZip from "adm-zip";
import type { HealthParser, ParsedRecord, ParseResult, HealthMetric } from "./types";

/**
 * Xiaomi Health / Zepp Life export parser.
 * Xiaomi/Zepp exports a ZIP containing JSON or CSV files with patterns:
 * - ACTIVITY/ or activity/ (steps, calories)
 * - HEARTRATE/ or heartrate/ (heart rate)
 * - SLEEP/ or sleep/ (sleep data)
 * - SPORT/ or sport/ (workouts)
 */
export const xiaomiHealthParser: HealthParser = {
  source: "xiaomiHealth",

  detect(fileNames: string[]): boolean {
    const lower = fileNames.map((f) => f.toLowerCase());
    // Xiaomi/Zepp has ACTIVITY directory or specific Zepp markers
    return lower.some(
      (f) =>
        f.includes("activity/") ||
        f.includes("zepp") ||
        f.includes("mifit") ||
        (f.includes("heartrate") && (f.endsWith(".json") || f.endsWith(".csv")))
    ) && !lower.some((f) => f.includes("export.xml") || f.includes("motion/")); // exclude Apple/Huawei
  },

  async parse(zipBuffer: Buffer): Promise<ParseResult> {
    const zip = new AdmZip(zipBuffer);
    const entries = zip.getEntries();
    const records: ParsedRecord[] = [];
    const summary: Partial<Record<HealthMetric, number>> = {};
    let dataFrom: Date | null = null;
    let dataTo: Date | null = null;

    for (const entry of entries) {
      if (entry.isDirectory) continue;
      const name = entry.entryName.toLowerCase();

      if (name.endsWith(".json")) {
        parseJsonEntry(entry, name, records, summary);
      } else if (name.endsWith(".csv")) {
        parseCsvEntry(entry, name, records, summary);
      }
    }

    // Calculate date range
    for (const r of records) {
      if (!dataFrom || r.startDate < dataFrom) dataFrom = r.startDate;
      if (!dataTo || r.endDate > dataTo) dataTo = r.endDate;
    }

    if (records.length === 0) {
      throw new Error("未能从小米/Zepp 数据中解析出有效记录。请确认文件来源。");
    }

    return { source: "xiaomiHealth", records, summary, dataFrom, dataTo };
  },
};

function detectMetric(name: string): { metric: HealthMetric; unit: string } | null {
  if (name.includes("step") || name.includes("activity")) return { metric: "steps", unit: "count" };
  if (name.includes("heartrate") || name.includes("heart_rate")) return { metric: "heartRate", unit: "bpm" };
  if (name.includes("sleep")) return { metric: "sleepAnalysis", unit: "min" };
  if (name.includes("sport") || name.includes("workout")) return { metric: "workout", unit: "min" };
  if (name.includes("weight")) return { metric: "weight", unit: "kg" };
  if (name.includes("calorie")) return { metric: "calories", unit: "kcal" };
  if (name.includes("distance")) return { metric: "distance", unit: "km" };
  if (name.includes("spo2") || name.includes("oxygen")) return { metric: "bloodOxygen", unit: "%" };
  return null;
}

function parseJsonEntry(
  entry: AdmZip.IZipEntry,
  name: string,
  records: ParsedRecord[],
  summary: Partial<Record<HealthMetric, number>>
) {
  const mapping = detectMetric(name);
  if (!mapping) return;

  let data: unknown[];
  try {
    const content = entry.getData().toString("utf8");
    const parsed = JSON.parse(content);
    data = Array.isArray(parsed) ? parsed : parsed.data ?? [];
    if (!Array.isArray(data)) return;
  } catch {
    return;
  }

  for (const item of data) {
    const rec = item as Record<string, unknown>;
    const timestamp = rec.timestamp ?? rec.time ?? rec.date ?? rec.startTime;
    const startDate = parseDate(timestamp);
    if (!startDate) continue;

    const value = parseFloat(String(rec.value ?? rec.steps ?? rec.heartRate ?? rec.hr ?? rec.duration ?? 0));
    if (isNaN(value)) continue;

    const endTimestamp = rec.endTime ?? rec.end_time;
    const endDate = parseDate(endTimestamp) ?? new Date(startDate.getTime() + 60000);

    records.push({
      metric: mapping.metric,
      value,
      unit: mapping.unit,
      startDate,
      endDate,
      sourceName: "Xiaomi/Zepp",
      metadata: rec.type ? { type: String(rec.type) } : undefined,
    });
    summary[mapping.metric] = (summary[mapping.metric] || 0) + 1;
  }
}

function parseCsvEntry(
  entry: AdmZip.IZipEntry,
  name: string,
  records: ParsedRecord[],
  summary: Partial<Record<HealthMetric, number>>
) {
  const mapping = detectMetric(name);
  if (!mapping) return;

  const content = entry.getData().toString("utf8");
  const lines = content.split("\n").filter((l) => l.trim());
  if (lines.length < 2) return;

  const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());
  const dateIdx = headers.findIndex((h) => h.includes("date") || h.includes("time") || h.includes("timestamp"));
  const valueIdx = headers.findIndex((h) => h.includes("value") || h.includes("step") || h.includes("hr") || h.includes("heart"));

  if (dateIdx === -1 || valueIdx === -1) return;

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(",");
    if (cols.length <= Math.max(dateIdx, valueIdx)) continue;

    const startDate = parseDate(cols[dateIdx].trim());
    if (!startDate) continue;

    const value = parseFloat(cols[valueIdx].trim());
    if (isNaN(value)) continue;

    records.push({
      metric: mapping.metric,
      value,
      unit: mapping.unit,
      startDate,
      endDate: new Date(startDate.getTime() + 60000),
      sourceName: "Xiaomi/Zepp",
    });
    summary[mapping.metric] = (summary[mapping.metric] || 0) + 1;
  }
}

function parseDate(val: unknown): Date | null {
  if (!val) return null;
  if (typeof val === "number") return new Date(val > 1e12 ? val : val * 1000);
  if (typeof val === "string") {
    const d = new Date(val);
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
}
