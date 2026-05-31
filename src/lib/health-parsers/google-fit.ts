import type { HealthParser, ParsedRecord, ParseResult, HealthMetric } from "./types";
import type { ZipDirectory } from "./index";

/**
 * Google Fit (via Google Takeout) export parser.
 * JSON files in Fit/ directory structure.
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

  async parse(directory: ZipDirectory): Promise<ParseResult> {
    const records: ParsedRecord[] = [];
    const summary: Partial<Record<HealthMetric, number>> = {};
    let dataFrom: Date | null = null;
    let dataTo: Date | null = null;

    for (const file of directory.files) {
      if (file.type === "Directory" || !file.path.endsWith(".json")) continue;

      let parsed: unknown;
      try {
        const content = (await file.buffer()).toString("utf8");
        parsed = JSON.parse(content);
      } catch {
        continue;
      }

      if (typeof parsed === "object" && parsed !== null) {
        const obj = parsed as Record<string, unknown>;

        if (Array.isArray(obj["Data Points"])) {
          parseDataPoints(obj["Data Points"] as unknown[], file.path, records, summary);
        } else if (Array.isArray(parsed)) {
          parseDataPoints(parsed, file.path, records, summary);
        } else if (Array.isArray(obj.bucket)) {
          for (const bucket of obj.bucket as unknown[]) {
            const b = bucket as Record<string, unknown>;
            if (Array.isArray(b.dataset)) {
              for (const ds of b.dataset as unknown[]) {
                const d = ds as Record<string, unknown>;
                if (Array.isArray(d.point)) {
                  parseDataPoints(d.point, file.path, records, summary);
                }
              }
            }
          }
        }
      }
    }

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

    let mapping: { metric: HealthMetric; unit: string } | null = null;
    const dataType = String(p.dataTypeName ?? p.originDataSourceId ?? "");
    for (const [key, m] of Object.entries(GOOGLE_FIT_DATA_TYPES)) {
      if (dataType.includes(key) || fileName.toLowerCase().includes(key.replace("com.google.", ""))) {
        mapping = m;
        break;
      }
    }

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

    const startDate = parseGoogleDate(p.startTimeNanos ?? p.startTime);
    const endDate = parseGoogleDate(p.endTimeNanos ?? p.endTime);
    if (!startDate) continue;

    let value = 0;
    if (Array.isArray(p.value)) {
      const v = (p.value as Record<string, unknown>[])[0];
      if (v) value = parseFloat(String(v.fpVal ?? v.intVal ?? v.value ?? 0));
    } else if (typeof p.value === "number") {
      value = p.value;
    } else if (p.fitValue) {
      const fv = (Array.isArray(p.fitValue) ? p.fitValue[0] : p.fitValue) as Record<string, unknown>;
      value = parseFloat(String(fv?.value ?? 0));
    }

    if (isNaN(value) || value === 0) continue;

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

function parseGoogleDate(val: unknown): Date | null {
  if (!val) return null;
  if (typeof val === "string") {
    const num = Number(val);
    if (!isNaN(num)) {
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
