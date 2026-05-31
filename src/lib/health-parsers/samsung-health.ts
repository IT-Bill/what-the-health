import type { HealthParser, ParsedRecord, ParseResult, HealthMetric } from "./types";
import type { ZipDirectory } from "./index";

/**
 * Samsung Health export parser.
 * CSV files named: com.samsung.health.step_count.XXXXXX.csv, etc.
 */

const SAMSUNG_FILE_MAP: Record<string, { metric: HealthMetric; unit: string; valueCol: string }> = {
  "step_count": { metric: "steps", unit: "count", valueCol: "count" },
  "heart_rate": { metric: "heartRate", unit: "bpm", valueCol: "heart_rate" },
  "sleep": { metric: "sleepAnalysis", unit: "min", valueCol: "duration" },
  "exercise": { metric: "workout", unit: "min", valueCol: "duration" },
  "body_weight": { metric: "weight", unit: "kg", valueCol: "weight" },
  "blood_pressure": { metric: "bloodPressure", unit: "mmHg", valueCol: "systolic" },
  "oxygen_saturation": { metric: "bloodOxygen", unit: "%", valueCol: "oxygen_saturation" },
  "floors_climbed": { metric: "flightsClimbed", unit: "count", valueCol: "floor" },
};

export const samsungHealthParser: HealthParser = {
  source: "samsungHealth",

  detect(fileNames: string[]): boolean {
    return fileNames.some((f) => f.includes("com.samsung.health."));
  },

  async parse(directory: ZipDirectory): Promise<ParseResult> {
    const records: ParsedRecord[] = [];
    const summary: Partial<Record<HealthMetric, number>> = {};
    let dataFrom: Date | null = null;
    let dataTo: Date | null = null;

    for (const file of directory.files) {
      if (file.type === "Directory" || !file.path.endsWith(".csv")) continue;
      const name = file.path.toLowerCase();

      let mapping: { metric: HealthMetric; unit: string; valueCol: string } | null = null;
      for (const [key, m] of Object.entries(SAMSUNG_FILE_MAP)) {
        if (name.includes(`com.samsung.health.${key}`)) {
          mapping = m;
          break;
        }
      }
      if (!mapping) continue;

      const content = (await file.buffer()).toString("utf8");
      const lines = content.split("\n").filter((l) => l.trim());
      if (lines.length < 2) continue;

      const rawHeaders = lines[0].split(",").map((h) => h.trim().replace(/"/g, ""));
      const headers = rawHeaders.map((h) => {
        const parts = h.split(".");
        return parts[parts.length - 1].toLowerCase();
      });

      const startIdx = headers.findIndex((h) => h === "start_time" || h === "start_date" || h === "create_time");
      const endIdx = headers.findIndex((h) => h === "end_time" || h === "end_date");
      const valueIdx = headers.findIndex((h) => h.includes(mapping!.valueCol));

      if (startIdx === -1 || valueIdx === -1) continue;

      for (let i = 1; i < lines.length; i++) {
        const cols = parseCsvLine(lines[i]);
        if (cols.length <= Math.max(startIdx, valueIdx)) continue;

        const startDate = parseSamsungDate(cols[startIdx]);
        if (!startDate) continue;

        const endDate = endIdx >= 0 ? parseSamsungDate(cols[endIdx]) : null;
        const rawValue = parseFloat(cols[valueIdx]);
        if (isNaN(rawValue)) continue;

        const value = mapping.metric === "sleepAnalysis" ? rawValue / 60000 : rawValue;

        const record: ParsedRecord = {
          metric: mapping.metric,
          value,
          unit: mapping.unit,
          startDate,
          endDate: endDate ?? new Date(startDate.getTime() + 60000),
          sourceName: "Samsung Health",
        };

        if (mapping.metric === "bloodPressure") {
          const diastolicIdx = headers.findIndex((h) => h.includes("diastolic"));
          if (diastolicIdx >= 0) {
            record.metadata = { type: "systolic", diastolic: parseFloat(cols[diastolicIdx]) || undefined };
          }
        }

        records.push(record);
        summary[mapping.metric] = (summary[mapping.metric] || 0) + 1;

        if (!dataFrom || startDate < dataFrom) dataFrom = startDate;
        const end = endDate ?? startDate;
        if (!dataTo || end > dataTo) dataTo = end;
      }
    }

    if (records.length === 0) {
      throw new Error("未能从 Samsung Health 数据中解析出有效记录。请确认文件来源。");
    }

    return { source: "samsungHealth", records, summary, dataFrom, dataTo };
  },
};

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (const char of line) {
    if (char === '"') { inQuotes = !inQuotes; }
    else if (char === "," && !inQuotes) { result.push(current.trim()); current = ""; }
    else { current += char; }
  }
  result.push(current.trim());
  return result;
}

function parseSamsungDate(val: string): Date | null {
  if (!val || val === "null" || val === "") return null;
  const num = Number(val);
  if (!isNaN(num) && num > 1e9) {
    return new Date(num > 1e12 ? num : num * 1000);
  }
  const d = new Date(val.replace(" ", "T"));
  return isNaN(d.getTime()) ? null : d;
}
