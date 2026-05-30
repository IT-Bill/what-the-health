import AdmZip from "adm-zip";
import type { HealthParser, ParsedRecord, ParseResult, HealthMetric } from "./types";

/**
 * Google Fit (via Google Takeout) export parser.
 * Google Takeout Fit data is a ZIP containing JSON files:
 * - Fit/Daily activity metrics/YYYY-MM-DD.json
 * - Fit/All Sessions/ (workout sessions)
 * - Fit/Raw Data/ (detailed sensor data)
 *
 * Daily activity JSON structure:
 * { "bucket": [...], "dataSource": [...] }
 * or simpler per-day files with data points.
 */

const GOOGLE_FIT_DATA_TYPES: Record<string, { metric: HealthMetric; unit: string }> = {
  "com.google.step_count.delta": { metric: "steps", unit: "count" },
  "com.google.heart_rate.bpm": { metric: "heartRate", unit: "bpm" },
  "com.google.calories.expended": { metric: "calories", unit: "kcal" },
  "com.google.distance.delta": { metric: "distance", unit: "km" },
  "com.google.weight": { metric: "weight", unit: "kg" },
  "com.google.blood_pressure": { metric: "bloodPressure", unit: "mmHg" },
  "com.google.oxygen_saturation": { metric: "bloodOxygen", unit: "%" },
  "com.google.sleep.segment": { metric: "sleepAnalysis", unit: "min" },
  "com.google.activity.segment": { metric: "workout", unit: "min" },
  "com.google.heart_rate_variability": { metric: "hrv", unit: "ms" },
};

export const googleFitParser: HealthParser = {
  source: "googleFit",

  detect(fileNames: string[]): boolean {
    return fileNames.some(
      (f) =>
        f.toLowerCase().includes("fit/") ||
        f.toLowerCase().includes("google_fit/") ||
        f.includes("Daily activity metrics") ||
        f.includes("All Sessions")
    );
  },

  async parse(zipBuffer: Buffer): Promise<ParseResult> {
    const zip = new AdmZip(zipBuffer);
    const entries = zip.getEntries();
    const records: ParsedRecord[] = [];
    const summary: Partial<Record<HealthMetric, number>> = {};
    let dataFrom: Date | null = null;
    let dataTo: Date | null = null;

    for (const entry of entries) {
      if (entry.isDirectory || !entry.entryName.endsWith(".json")) continue;

      let parsed: unknown;
      try {
        const content = entry.getData().toString("utf8");
        parsed = JSON.parse(content);
      } catch {
        continue;
      }

      // Handle different Google Fit JSON structures
      if (typeof parsed === "object" && parsed !== null) {
        const obj = parsed as Record<string, unknown>;

        // Structure 1: { "Data Points": [...] } (Raw Data files)
        if (Array.isArray(obj["Data Points"])) {
          parseDataPoints(obj["Data Points"] as unknown[], entry.entryName, records, summary);
        }
        // Structure 2: array of data points directly
        else if (Array.isArray(parsed)) {
          parseDataPoints(parsed, entry.entryName, records, summary);
        }
        // Structure 3: { "bucket": [...] } (aggregated)
        else if (Array.isArray(obj.bucket)) {
          for (const bucket of obj.bucket as unknown[]) {
            const b = bucket as Record<string, unknown>;
            if (Array.isArray(b.dataset)) {
              for (const ds of b.dataset as unknown[]) {
                const d = ds as Record<string, unknown>;
                if (Array.isArray(d.point)) {
                  parseDataPoints(d.point, entry.entryName, records, summary);
                }
              }
            }
          }
        }
      }
    }

    // Calculate date range
    for (const r of records) {
      if (!dataFrom || r.startDate < dataFrom) dataFrom = r.startDate;
      if (!dataTo || r.endDate > dataTo) dataTo = r.endDate;
    }

    if (records.length === 0) {
      throw new Error("未能从 Google Fit 数据中解析出有效记录。请确认文件来源。");
    }

    return { source: "googleFit", records, summary, dataFrom, dataTo };
  },
};

function parseDataPoints(
  points: unknown[],
  fileName: string,
  records: ParsedRecord[],
  summary: Partial<Record<HealthMetric, number>>
) {
  for (const point of points) {
    const p = point as Record<string, unknown>;

    // Determine metric from dataTypeName or file path
    let mapping: { metric: HealthMetric; unit: string } | null = null;

    const dataType = String(p.dataTypeName ?? p.originDataSourceId ?? "");
    for (const [key, m] of Object.entries(GOOGLE_FIT_DATA_TYPES)) {
      if (dataType.includes(key) || fileName.toLowerCase().includes(key.replace("com.google.", ""))) {
        mapping = m;
        break;
      }
    }

    // Try detecting from file name if no match yet
    if (!mapping) {
      const fn = fileName.toLowerCase();
      if (fn.includes("step")) mapping = { metric: "steps", unit: "count" };
      else if (fn.includes("heart")) mapping = { metric: "heartRate", unit: "bpm" };
      else if (fn.includes("sleep")) mapping = { metric: "sleepAnalysis", unit: "min" };
      else if (fn.includes("calorie")) mapping = { metric: "calories", unit: "kcal" };
      else if (fn.includes("weight")) mapping = { metric: "weight", unit: "kg" };
      else if (fn.includes("distance")) mapping = { metric: "distance", unit: "km" };
    }

    if (!mapping) continue;

    // Parse timestamps
    const startNanos = p.startTimeNanos ?? p.startTime;
    const endNanos = p.endTimeNanos ?? p.endTime;
    const startDate = parseGoogleDate(startNanos);
    const endDate = parseGoogleDate(endNanos);
    if (!startDate) continue;

    // Parse value
    let value = 0;
    if (Array.isArray(p.value)) {
      // Google Fit values are arrays: [{ fpVal: 72.0 }] or [{ intVal: 500 }]
      const v = (p.value as Record<string, unknown>[])[0];
      if (v) {
        value = parseFloat(String(v.fpVal ?? v.intVal ?? v.value ?? 0));
      }
    } else if (typeof p.value === "number") {
      value = p.value;
    } else if (p.fitValue) {
      // Alternative structure
      const fv = (Array.isArray(p.fitValue) ? p.fitValue[0] : p.fitValue) as Record<string, unknown>;
      value = parseFloat(String(fv?.value ?? 0));
    }

    if (isNaN(value) || value === 0) continue;

    // Sleep: convert nanos duration to minutes
    if (mapping.metric === "sleepAnalysis" && startDate && endDate) {
      value = (endDate.getTime() - startDate.getTime()) / 60000;
    }

    records.push({
      metric: mapping.metric,
      value,
      unit: mapping.unit,
      startDate,
      endDate: endDate ?? new Date(startDate.getTime() + 60000),
      sourceName: "Google Fit",
      metadata: p.activityType ? { activityType: String(p.activityType) } : undefined,
    });
    summary[mapping.metric] = (summary[mapping.metric] || 0) + 1;
  }
}

/** Parse Google Fit date: nanoseconds since epoch, milliseconds, or ISO string. */
function parseGoogleDate(val: unknown): Date | null {
  if (!val) return null;
  if (typeof val === "string") {
    const num = Number(val);
    if (!isNaN(num)) {
      // Nanoseconds (> 10^15) vs milliseconds (> 10^12) vs seconds
      if (num > 1e15) return new Date(num / 1e6);
      if (num > 1e12) return new Date(num);
      if (num > 1e9) return new Date(num * 1000);
    }
    const d = new Date(val);
    return isNaN(d.getTime()) ? null : d;
  }
  if (typeof val === "number") {
    if (val > 1e15) return new Date(val / 1e6);
    if (val > 1e12) return new Date(val);
    if (val > 1e9) return new Date(val * 1000);
  }
  return null;
}
