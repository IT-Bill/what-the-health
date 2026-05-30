/** Base interface for all health data parsers. */

export type HealthMetric =
  | "steps"
  | "heartRate"
  | "restingHR"
  | "sleepAnalysis"
  | "workout"
  | "weight"
  | "bloodPressure"
  | "bloodOxygen"
  | "calories"
  | "distance"
  | "hrv"
  | "stress"
  | "mindfulSession"
  | "flightsClimbed"
  | "respiratoryRate";

export type HealthSource =
  | "appleHealth"
  | "huaweiHealth"
  | "xiaomiHealth"
  | "samsungHealth"
  | "googleFit"
  | "oppoHealth"
  | "manual";

/** A single parsed health record (before DB insertion). */
export interface ParsedRecord {
  metric: HealthMetric;
  value: number;
  unit: string;
  startDate: Date;
  endDate: Date;
  metadata?: Record<string, unknown>;
  sourceName?: string;
}

/** Result from a parser run. */
export interface ParseResult {
  source: HealthSource;
  records: ParsedRecord[];
  /** Per-metric count summary */
  summary: Partial<Record<HealthMetric, number>>;
  dataFrom: Date | null;
  dataTo: Date | null;
}

/** Interface all health parsers must implement. */
export interface HealthParser {
  /** The source this parser handles. */
  source: HealthSource;
  /** Check if the given ZIP file names indicate this source. */
  detect(fileNames: string[]): boolean;
  /** Parse the ZIP buffer and return all records. */
  parse(zipBuffer: Buffer): Promise<ParseResult>;
}
