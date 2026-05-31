import sax from "sax";
import { Readable } from "stream";
import type { HealthParser, ParsedRecord, ParseResult, HealthMetric } from "./types";
import type { ZipDirectory } from "./index";

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

const SLEEP_VALUES: Record<string, string> = {
  HKCategoryValueSleepAnalysisInBed: "inBed",
  HKCategoryValueSleepAnalysisAsleepUnspecified: "asleep",
  HKCategoryValueSleepAnalysisAsleepCore: "core",
  HKCategoryValueSleepAnalysisAsleepDeep: "deep",
  HKCategoryValueSleepAnalysisAsleepREM: "rem",
  HKCategoryValueSleepAnalysisAwake: "awake",
};

function parseAppleDate(dateStr: string): Date {
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

  async parse(directory: ZipDirectory): Promise<ParseResult> {
    const exportFile = directory.files.find(
      (f) => f.path === "export.xml" || f.path.endsWith("/export.xml")
    );

    if (!exportFile) {
      throw new Error("未找到 export.xml 文件。请确认这是 Apple Health 导出的 ZIP 文件。");
    }

    const xmlContent = await exportFile.buffer();

    return new Promise((resolve, reject) => {
      const records: ParsedRecord[] = [];
      const summary: Partial<Record<HealthMetric, number>> = {};
      let dataFrom: Date | null = null;
      let dataTo: Date | null = null;

      const stream = Readable.from(xmlContent);
      const parser = sax.createStream(true, { trim: true });

      parser.on("opentag", (node) => {
        if (node.name === "Record") {
          const attrs = node.attributes as Record<string, string>;
          const typeId = attrs.type;
          const mapping = TYPE_MAP[typeId];
          if (!mapping) return;

          const value = parseFloat(attrs.value);
          const startDate = parseAppleDate(attrs.startDate);
          const endDate = parseAppleDate(attrs.endDate);

          if (isNaN(value) && mapping.metric !== "sleepAnalysis") return;
          if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) return;

          const record: ParsedRecord = {
            metric: mapping.metric,
            value: mapping.metric === "sleepAnalysis"
              ? (endDate.getTime() - startDate.getTime()) / 60000
              : value,
            unit: mapping.unit,
            startDate,
            endDate,
            sourceName: attrs.sourceName || undefined,
          };

          if (mapping.metric === "sleepAnalysis" && attrs.value) {
            record.metadata = { stage: SLEEP_VALUES[attrs.value] || attrs.value };
          }
          if (typeId === "HKQuantityTypeIdentifierBloodPressureSystolic") {
            record.metadata = { ...record.metadata, type: "systolic" };
          } else if (typeId === "HKQuantityTypeIdentifierBloodPressureDiastolic") {
            record.metadata = { ...record.metadata, type: "diastolic" };
          }
          if (typeId === "HKQuantityTypeIdentifierBasalEnergyBurned") {
            record.metadata = { ...record.metadata, type: "basal" };
          }

          records.push(record);
          summary[mapping.metric] = (summary[mapping.metric] || 0) + 1;
          if (!dataFrom || startDate < dataFrom) dataFrom = startDate;
          if (!dataTo || endDate > dataTo) dataTo = endDate;
        }

        if (node.name === "Workout") {
          const attrs = node.attributes as Record<string, string>;
          const duration = parseFloat(attrs.duration);
          const startDate = parseAppleDate(attrs.startDate);
          const endDate = parseAppleDate(attrs.endDate);
          if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) return;

          records.push({
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
          });
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
