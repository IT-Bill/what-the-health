import AdmZip from "adm-zip";
import sax from "sax";
import { Readable } from "stream";
import type { HealthParser, ParsedRecord, ParseResult, HealthMetric } from "./types";

/** Mapping from Apple HK type identifiers to our metric types. */
const TYPE_MAP: Record<string, { metric: HealthMetric; unit: string }> = {
  HKQuantityTypeIdentifierStepCount: { metric: "steps", unit: "count" },
  HKQuantityTypeIdentifierHeartRate: { metric: "heartRate", unit: "bpm" },
  HKQuantityTypeIdentifierRestingHeartRate: { metric: "restingHR", unit: "bpm" },
  HKCategoryTypeIdentifierSleepAnalysis: { metric: "sleepAnalysis", unit: "category" },
  HKQuantityTypeIdentifierBodyMass: { metric: "weight", unit: "kg" },
  HKQuantityTypeIdentifierBloodPressureSystolic: { metric: "bloodPressure", unit: "mmHg" },
  HKQuantityTypeIdentifierBloodPressureDiastolic: { metric: "bloodPressure", unit: "mmHg" },
  HKQuantityTypeIdentifierOxygenSaturation: { metric: "bloodOxygen", unit: "%" },
  HKQuantityTypeIdentifierActiveEnergyBurned: { metric: "calories", unit: "kcal" },
  HKQuantityTypeIdentifierBasalEnergyBurned: { metric: "calories", unit: "kcal" },
  HKQuantityTypeIdentifierDistanceWalkingRunning: { metric: "distance", unit: "km" },
  HKQuantityTypeIdentifierHeartRateVariabilitySDNN: { metric: "hrv", unit: "ms" },
  HKQuantityTypeIdentifierFlightsClimbed: { metric: "flightsClimbed", unit: "count" },
  HKQuantityTypeIdentifierRespiratoryRate: { metric: "respiratoryRate", unit: "breaths/min" },
  HKCategoryTypeIdentifierMindfulSession: { metric: "mindfulSession", unit: "min" },
};

/** Sleep value mapping (Apple's category values → readable metadata). */
const SLEEP_VALUES: Record<string, string> = {
  HKCategoryValueSleepAnalysisInBed: "inBed",
  HKCategoryValueSleepAnalysisAsleepUnspecified: "asleep",
  HKCategoryValueSleepAnalysisAsleepCore: "core",
  HKCategoryValueSleepAnalysisAsleepDeep: "deep",
  HKCategoryValueSleepAnalysisAsleepREM: "rem",
  HKCategoryValueSleepAnalysisAwake: "awake",
};

/** Parse Apple Health date string: "2024-01-15 07:45:00 +0800" */
function parseAppleDate(dateStr: string): Date {
  // Format: "YYYY-MM-DD HH:MM:SS ±HHMM"
  // Convert to ISO: "YYYY-MM-DDTHH:MM:SS±HH:MM"
  const iso = dateStr.replace(
    /^(\d{4}-\d{2}-\d{2})\s(\d{2}:\d{2}:\d{2})\s([+-]\d{2})(\d{2})$/,
    "$1T$2$3:$4"
  );
  return new Date(iso);
}

export const appleHealthParser: HealthParser = {
  source: "appleHealth",

  detect(fileNames: string[]): boolean {
    return fileNames.some(
      (f) => f === "export.xml" || f.endsWith("/export.xml") || f === "apple_health_export/export.xml"
    );
  },

  parse(zipBuffer: Buffer): Promise<ParseResult> {
    return new Promise((resolve, reject) => {
      const zip = new AdmZip(zipBuffer);
      const entries = zip.getEntries();

      // Find export.xml
      const exportEntry = entries.find(
        (e) => e.entryName === "export.xml" || e.entryName.endsWith("/export.xml")
      );

      if (!exportEntry) {
        reject(new Error("未找到 export.xml 文件。请确认这是 Apple Health 导出的 ZIP 文件。"));
        return;
      }

      const records: ParsedRecord[] = [];
      const summary: Partial<Record<HealthMetric, number>> = {};
      let dataFrom: Date | null = null;
      let dataTo: Date | null = null;

      const xmlContent = exportEntry.getData();
      const stream = Readable.from(xmlContent);
      const parser = sax.createStream(true, { trim: true });

      parser.on("opentag", (node) => {
        if (node.name === "Record") {
          const attrs = node.attributes as Record<string, string>;
          const typeId = attrs.type;
          const mapping = TYPE_MAP[typeId];
          if (!mapping) return; // Skip unsupported types

          const value = parseFloat(attrs.value);
          const startDate = parseAppleDate(attrs.startDate);
          const endDate = parseAppleDate(attrs.endDate);

          if (isNaN(value) && mapping.metric !== "sleepAnalysis") return;
          if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) return;

          const record: ParsedRecord = {
            metric: mapping.metric,
            value: mapping.metric === "sleepAnalysis"
              ? (endDate.getTime() - startDate.getTime()) / 60000 // duration in minutes
              : value,
            unit: mapping.unit,
            startDate,
            endDate,
            sourceName: attrs.sourceName || undefined,
          };

          // Add sleep stage metadata
          if (mapping.metric === "sleepAnalysis" && attrs.value) {
            record.metadata = {
              stage: SLEEP_VALUES[attrs.value] || attrs.value,
            };
          }

          // Blood pressure metadata (track systolic vs diastolic)
          if (typeId === "HKQuantityTypeIdentifierBloodPressureSystolic") {
            record.metadata = { ...record.metadata, type: "systolic" };
          } else if (typeId === "HKQuantityTypeIdentifierBloodPressureDiastolic") {
            record.metadata = { ...record.metadata, type: "diastolic" };
          }

          // Calories metadata (active vs basal)
          if (typeId === "HKQuantityTypeIdentifierBasalEnergyBurned") {
            record.metadata = { ...record.metadata, type: "basal" };
          }

          records.push(record);
          summary[mapping.metric] = (summary[mapping.metric] || 0) + 1;

          // Track date range
          if (!dataFrom || startDate < dataFrom) dataFrom = startDate;
          if (!dataTo || endDate > dataTo) dataTo = endDate;
        }

        if (node.name === "Workout") {
          const attrs = node.attributes as Record<string, string>;
          const duration = parseFloat(attrs.duration);
          const startDate = parseAppleDate(attrs.startDate);
          const endDate = parseAppleDate(attrs.endDate);

          if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) return;

          const record: ParsedRecord = {
            metric: "workout",
            value: duration || (endDate.getTime() - startDate.getTime()) / 60000,
            unit: "min",
            startDate,
            endDate,
            sourceName: attrs.sourceName || undefined,
            metadata: {
              activityType: attrs.workoutActivityType?.replace("HKWorkoutActivityType", "") || "Unknown",
              totalDistance: attrs.totalDistance ? parseFloat(attrs.totalDistance) : undefined,
              totalDistanceUnit: attrs.totalDistanceUnit || undefined,
              totalEnergyBurned: attrs.totalEnergyBurned ? parseFloat(attrs.totalEnergyBurned) : undefined,
              totalEnergyBurnedUnit: attrs.totalEnergyBurnedUnit || undefined,
            },
          };

          records.push(record);
          summary.workout = (summary.workout || 0) + 1;

          if (!dataFrom || startDate < dataFrom) dataFrom = startDate;
          if (!dataTo || endDate > dataTo) dataTo = endDate;
        }
      });

      parser.on("end", () => {
        resolve({ source: "appleHealth", records, summary, dataFrom, dataTo });
      });

      parser.on("error", (err) => {
        reject(new Error(`XML 解析错误: ${err.message}`));
      });

      stream.pipe(parser);
    });
  },
};
