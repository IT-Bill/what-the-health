// Shared types for Memory feature.
// Prisma-generated types are re-exported for convenience.
// The ReportData type defines the structure of Report.data (Json field).

export type {
  Report,
  Insight,
  PeriodType,
  InsightType,
} from "@/generated/prisma/client";

// --- Report.data JSON structure ---

export interface ReportStat {
  icon: string;
  label: string;
  value: string;
  change: string;
  positive: boolean;
}

export interface ReportHighlight {
  icon: string;
  label: string;
  value: string;
}

export interface ReportAchievement {
  icon: string;
  title: string;
  date: string;
}

/** The shape of the `data` JSON column in the Report table. */
export interface ReportData {
  moodEmojis?: string[];
  stats?: ReportStat[];
  sleepData?: number[];
  highlights?: ReportHighlight[];
  achievements?: ReportAchievement[];
  overallScore?: number;
}

// --- API response types ---

export interface ReportWithInsights {
  id: string;
  periodType: string;
  periodStart: string;
  periodEnd: string;
  version: number;
  summary: string | null;
  data: ReportData;
  insights: InsightRecord[];
}

export interface InsightRecord {
  id: string;
  type: string;
  title: string;
  content: string;
  metadata: Record<string, unknown> | null;
}

export interface AiUnderstandingBreakdown {
  dimension: string;
  weight: number;
  score: number;
  filled: string[];
  missing: string[];
}

export interface MemoryApiResponse {
  report: ReportWithInsights | null;
  globalInsights: InsightRecord[];
  available: string[];
  versions: { version: number; createdAt: string }[];
  aiUnderstanding: {
    level: number;
    percentage: number;
    conversationCount: number;
    breakdown: AiUnderstandingBreakdown[];
  };
}
