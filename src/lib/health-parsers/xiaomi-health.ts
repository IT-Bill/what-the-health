import type { HealthParser, ParsedRecord, ParseResult, HealthMetric } from "./types";
import type { ZipDirectory } from "./index";

/**
 * Xiaomi Health / Mi Fitness / Zepp Life export parser.
 *
 * Mi Fitness exports a ZIP containing CSV files:
 * - *_MiFitness_hlth_center_fitness_data.csv (main data: heart_rate, steps, sleep, calories)
 * - *_MiFitness_hlth_center_sport_record.csv (workout sessions)
 * - *_MiFitness_hlth_center_aggregated_fitness_data.csv (daily aggregates: stress, etc.)
 *
 * CSV format: Uid,Sid,Key,Time,Value,UpdateTime
 * The Value column contains JSON strings with the actual measurements.
 *
 * Older Zepp Life/MiFit exports may use JSON files in directories.
 */
export const xiaomiHealthParser: HealthParser = {
  source: "xiaomiHealth",

  detect(fileNames: string[]): boolean {
    const lower = fileNames.map((f) => f.toLowerCase());
    return lower.some(
      (f) =>
        f.includes("mifitness") ||
        f.includes("mifit") ||
        f.includes("zepp") ||
        f.includes("miwear") ||
        (f.includes("activity/") && !f.includes("export.xml") && !f.includes("com.samsung.health"))
    );
  },

  async parse(directory: ZipDirectory): Promise<ParseResult> {
    const records: ParsedRecord[] = [];
    const summary: Partial<Record<HealthMetric, number>> = {};
    let dataFrom: Date | null = null;
    let dataTo: Date | null = null;

    for (const file of directory.files) {
      if (file.type === "Directory") continue;
      const name = file.path.toLowerCase();

      if (name.endsWith(".csv")) {
        const content = (await file.buffer()).toString("utf8");
        if (name.includes("fitness_data")) {
          parseMiFitnessData(content, records, summary);
        } else if (name.includes("sport_record")) {
          parseMiFitnessSport(content, records, summary);
        } else if (name.includes("aggregated_fitness_data")) {
          parseMiFitnessAggregated(content, records, summary);
        }
      } else if (name.endsWith(".json")) {
        const content = (await file.buffer()).toString("utf8");
        parseLegacyJson(content, name, records, summary);
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

/**
 * Parse the main fitness_data CSV.
 * Format: Uid,Sid,Key,Time,Value,UpdateTime
 * Value is a JSON string.
 */
function parseMiFitnessData(
  content: string,
  records: ParsedRecord[],
  summary: Partial<Record<HealthMetric, number>>
) {
  const lines = content.split("\n");
  if (lines.length < 2) return;

  // Parse header
  const headers = lines[0].split(",").map((h) => h.trim());
  const keyIdx = headers.indexOf("Key");
  const timeIdx = headers.indexOf("Time");
  const valueIdx = headers.indexOf("Value");

  if (keyIdx === -1 || timeIdx === -1 || valueIdx === -1) return;

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // Parse CSV line carefully (Value contains JSON with commas)
    const cols = parseCsvLine(line);
    if (cols.length <= Math.max(keyIdx, timeIdx, valueIdx)) continue;

    const key = cols[keyIdx];
    const time = parseInt(cols[timeIdx]);
    const valueStr = cols[valueIdx];

    if (!key || isNaN(time)) continue;

    let valueObj: Record<string, unknown>;
    try {
      valueObj = JSON.parse(valueStr);
    } catch {
      continue;
    }

    const startDate = new Date(time * 1000);
    if (isNaN(startDate.getTime())) continue;

    switch (key) {
      case "heart_rate":
      case "single_heart_rate": {
        const bpm = Number(valueObj.bpm);
        if (!bpm || bpm <= 0) break;
        records.push({
          metric: "heartRate",
          value: bpm,
          unit: "bpm",
          startDate,
          endDate: startDate,
          sourceName: "Mi Fitness",
        });
        summary.heartRate = (summary.heartRate || 0) + 1;
        break;
      }
      case "resting_heart_rate": {
        const bpm = Number(valueObj.bpm);
        if (!bpm || bpm <= 0) break;
        records.push({
          metric: "restingHR",
          value: bpm,
          unit: "bpm",
          startDate,
          endDate: startDate,
          sourceName: "Mi Fitness",
        });
        summary.restingHR = (summary.restingHR || 0) + 1;
        break;
      }
      case "steps": {
        const steps = Number(valueObj.steps);
        if (!steps || steps <= 0) break;
        records.push({
          metric: "steps",
          value: steps,
          unit: "count",
          startDate,
          endDate: startDate,
          sourceName: "Mi Fitness",
          metadata: {
            distance: valueObj.distance ? Number(valueObj.distance) : undefined,
            calories: valueObj.calories ? Number(valueObj.calories) : undefined,
          },
        });
        summary.steps = (summary.steps || 0) + 1;
        break;
      }
      case "calories": {
        const cal = Number(valueObj.calories);
        if (!cal || cal <= 0) break;
        records.push({
          metric: "calories",
          value: cal,
          unit: "kcal",
          startDate,
          endDate: startDate,
          sourceName: "Mi Fitness",
        });
        summary.calories = (summary.calories || 0) + 1;
        break;
      }
      case "sleep": {
        const bedtime = Number(valueObj.bedtime);
        const wakeUp = Number(valueObj.wake_up_time);
        const duration = Number(valueObj.duration); // minutes
        if (!bedtime || !wakeUp) break;
        records.push({
          metric: "sleepAnalysis",
          value: duration || (wakeUp - bedtime) / 60,
          unit: "min",
          startDate: new Date(bedtime * 1000),
          endDate: new Date(wakeUp * 1000),
          sourceName: "Mi Fitness",
          metadata: {
            deepDuration: valueObj.sleep_deep_duration,
            lightDuration: valueObj.sleep_light_duration,
            remDuration: valueObj.sleep_rem_duration,
            awakeDuration: valueObj.sleep_awake_duration,
            avgHr: valueObj.avg_hr,
            minHr: valueObj.min_hr,
            maxHr: valueObj.max_hr,
          },
        });
        summary.sleepAnalysis = (summary.sleepAnalysis || 0) + 1;
        break;
      }
    }
  }
}

/**
 * Parse sport_record CSV.
 * Format: Uid,Sid,Key,Time,Category,Value,UpdateTime
 */
function parseMiFitnessSport(
  content: string,
  records: ParsedRecord[],
  summary: Partial<Record<HealthMetric, number>>
) {
  const lines = content.split("\n");
  if (lines.length < 2) return;

  const headers = lines[0].split(",").map((h) => h.trim());
  const valueIdx = headers.indexOf("Value");
  if (valueIdx === -1) return;

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const cols = parseCsvLine(line);
    if (cols.length <= valueIdx) continue;

    let valueObj: Record<string, unknown>;
    try {
      valueObj = JSON.parse(cols[valueIdx]);
    } catch {
      continue;
    }

    const startTime = Number(valueObj.start_time);
    const endTime = Number(valueObj.end_time);
    const duration = Number(valueObj.duration); // seconds
    if (!startTime || !endTime) continue;

    records.push({
      metric: "workout",
      value: duration ? duration / 60 : (endTime - startTime) / 60,
      unit: "min",
      startDate: new Date(startTime * 1000),
      endDate: new Date(endTime * 1000),
      sourceName: "Mi Fitness",
      metadata: {
        sportType: valueObj.sport_type,
        calories: valueObj.calories,
        avgHr: valueObj.avg_hrm,
        maxHr: valueObj.max_hrm,
        minHr: valueObj.min_hrm,
      },
    });
    summary.workout = (summary.workout || 0) + 1;
  }
}

/**
 * Parse aggregated_fitness_data CSV (stress, daily aggregates).
 * Format: Uid,Sid,Tag,Key,Time,Value,UpdateTime
 */
function parseMiFitnessAggregated(
  content: string,
  records: ParsedRecord[],
  summary: Partial<Record<HealthMetric, number>>
) {
  const lines = content.split("\n");
  if (lines.length < 2) return;

  const headers = lines[0].split(",").map((h) => h.trim());
  const keyIdx = headers.indexOf("Key");
  const timeIdx = headers.indexOf("Time");
  const valueIdx = headers.indexOf("Value");
  if (keyIdx === -1 || timeIdx === -1 || valueIdx === -1) return;

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const cols = parseCsvLine(line);
    if (cols.length <= Math.max(keyIdx, timeIdx, valueIdx)) continue;

    const key = cols[keyIdx];
    const time = parseInt(cols[timeIdx]);
    if (!key || isNaN(time)) continue;

    let valueObj: Record<string, unknown>;
    try {
      valueObj = JSON.parse(cols[valueIdx]);
    } catch {
      continue;
    }

    const startDate = new Date(time * 1000);

    if (key === "stress") {
      const avgStress = Number(valueObj.avg_stress);
      if (!avgStress || avgStress <= 0) continue;
      records.push({
        metric: "stress",
        value: avgStress,
        unit: "score",
        startDate,
        endDate: startDate,
        sourceName: "Mi Fitness",
        metadata: {
          maxStress: valueObj.max_stress,
          minStress: valueObj.min_stress,
        },
      });
      summary.stress = (summary.stress || 0) + 1;
    }
  }
}

/**
 * Parse legacy Zepp/MiFit JSON files (older export format).
 */
function parseLegacyJson(
  content: string,
  name: string,
  records: ParsedRecord[],
  summary: Partial<Record<HealthMetric, number>>
) {
  const mapping = detectMetricFromName(name);
  if (!mapping) return;

  let data: unknown[];
  try {
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
    if (isNaN(value) || value <= 0) continue;

    const endTimestamp = rec.endTime ?? rec.end_time;
    const endDate = parseDate(endTimestamp) ?? new Date(startDate.getTime() + 60000);

    records.push({
      metric: mapping.metric,
      value,
      unit: mapping.unit,
      startDate,
      endDate,
      sourceName: "Xiaomi/Zepp",
    });
    summary[mapping.metric] = (summary[mapping.metric] || 0) + 1;
  }
}

function detectMetricFromName(name: string): { metric: HealthMetric; unit: string } | null {
  if (name.includes("step") || name.includes("activity")) return { metric: "steps", unit: "count" };
  if (name.includes("heartrate") || name.includes("heart_rate")) return { metric: "heartRate", unit: "bpm" };
  if (name.includes("sleep")) return { metric: "sleepAnalysis", unit: "min" };
  if (name.includes("sport") || name.includes("workout")) return { metric: "workout", unit: "min" };
  if (name.includes("weight")) return { metric: "weight", unit: "kg" };
  if (name.includes("calorie")) return { metric: "calories", unit: "kcal" };
  if (name.includes("spo2") || name.includes("oxygen")) return { metric: "bloodOxygen", unit: "%" };
  return null;
}

/** Parse CSV line handling quoted fields with escaped double-quotes. */
function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && i + 1 < line.length && line[i + 1] === '"') {
        // Escaped double-quote inside quoted field: "" → "
        current += '"';
        i++; // skip next quote
      } else {
        // Toggle quote state
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current);
  return result;
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
