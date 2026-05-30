import AdmZip from "adm-zip";
import type { HealthParser, ParsedRecord, ParseResult, HealthMetric } from "./types";

/**
 * Huawei Health export parser.
 * Huawei exports a ZIP containing JSON files in directories like:
 * - motion/step/ (step data)
 * - motion/heartrate/ (heart rate)
 * - sleep/ (sleep data)
 * - sport/ (workout data)
 * - stress/ (stress data)
 * - spo2/ (blood oxygen)
 *
 * Each JSON file contains arrays of records with startTime/endTime/value.
 */
export const huaweiHealthParser: HealthParser = {
  source: "huaweiHealth",

  detect(fileNames: string[]): boolean {
    // Huawei exports typically have a "motion" directory or specific path patterns
    return fileNames.some(
      (f) =>
        f.includes("motion/") ||
        f.includes("sport/") ||
        (f.includes("step") && f.endsWith(".json") && !f.includes("export.xml"))
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

      let data: unknown[];
      try {
        const content = entry.getData().toString("utf8");
        const parsed = JSON.parse(content);
        data = Array.isArray(parsed) ? parsed : parsed.data ?? parsed.records ?? [];
        if (!Array.isArray(data)) continue;
      } catch {
        continue;
      }

      const name = entry.entryName.toLowerCase();
      let metric: HealthMetric | null = null;
      let unit = "";

      if (name.includes("step")) {
        metric = "steps"; unit = "count";
      } else if (name.includes("heartrate") || name.includes("heart_rate")) {
        metric = "heartRate"; unit = "bpm";
      } else if (name.includes("sleep")) {
        metric = "sleepAnalysis"; unit = "min";
      } else if (name.includes("sport") || name.includes("workout") || name.includes("exercise")) {
        metric = "workout"; unit = "min";
      } else if (name.includes("stress")) {
        metric = "stress"; unit = "score";
      } else if (name.includes("spo2") || name.includes("oxygen")) {
        metric = "bloodOxygen"; unit = "%";
      } else if (name.includes("weight") || name.includes("body")) {
        metric = "weight"; unit = "kg";
      } else if (name.includes("calorie")) {
        metric = "calories"; unit = "kcal";
      } else if (name.includes("distance")) {
        metric = "distance"; unit = "km";
      }

      if (!metric) continue;

      for (const item of data) {
        const rec = item as Record<string, unknown>;
        const startDate = parseHuaweiDate(rec.startTime ?? rec.start_time ?? rec.time ?? rec.dateTime);
        const endDate = parseHuaweiDate(rec.endTime ?? rec.end_time ?? rec.time ?? rec.dateTime) ?? startDate;

        if (!startDate) continue;

        const value = parseFloat(String(rec.value ?? rec.step ?? rec.heartRate ?? rec.score ?? rec.duration ?? 0));
        if (isNaN(value)) continue;

        const record: ParsedRecord = {
          metric,
          value: metric === "sleepAnalysis" && rec.duration
            ? parseFloat(String(rec.duration)) / 60000 // ms to min
            : value,
          unit,
          startDate,
          endDate: endDate ?? startDate,
          sourceName: "Huawei Health",
          metadata: rec.type ? { type: String(rec.type) } : undefined,
        };

        records.push(record);
        summary[metric] = (summary[metric] || 0) + 1;

        if (!dataFrom || startDate < dataFrom) dataFrom = startDate;
        if (!dataTo || (endDate ?? startDate) > dataTo) dataTo = endDate ?? startDate;
      }
    }

    if (records.length === 0) {
      throw new Error("未能从华为健康数据中解析出有效记录。请确认文件来源。");
    }

    return { source: "huaweiHealth", records, summary, dataFrom, dataTo };
  },
};

/** Parse Huawei date formats: epoch ms, epoch seconds, or ISO string. */
function parseHuaweiDate(val: unknown): Date | null {
  if (!val) return null;
  if (typeof val === "number") {
    // Epoch: if > 10^12, it's milliseconds; otherwise seconds
    return new Date(val > 1e12 ? val : val * 1000);
  }
  if (typeof val === "string") {
    const d = new Date(val);
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
}
