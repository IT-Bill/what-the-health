/**
 * LLM-powered report narrative and insight generation.
 * Uses AI Ping's OpenAI-compatible chat completions endpoint with Kimi-K2.6.
 */
import type { AggregatedPeriodData } from "./aggregator";
import { calculateOverallScore } from "./aggregator";

const REPORT_MODEL_ID = "Kimi-K2.6";
const REPORT_API_URL = "https://aiping.cn/api/v1/chat/completions";

const EXTRA_BODY = {
  enable_thinking: true,
  provider: {
    only: [],
    order: [],
    sort: null,
    input_price_range: [],
    output_price_range: [],
    input_length_range: [],
    output_length_range: [],
    throughput_range: [],
    latency_range: [],
  },
};

const DEFAULT_REPORT_LLM_TIMEOUT_MS = 180_000;

function getReportLlmTimeoutMs(): number {
  const configured = Number(process.env.REPORT_LLM_TIMEOUT_MS);
  return Number.isFinite(configured) && configured > 0
    ? configured
    : DEFAULT_REPORT_LLM_TIMEOUT_MS;
}

function createTimeoutSignal(parent?: AbortSignal): { signal: AbortSignal; cleanup: () => void } {
  const controller = new AbortController();
  const timeout = setTimeout(() => {
    controller.abort(new Error("Report LLM generation timed out"));
  }, getReportLlmTimeoutMs());

  const onAbort = () => controller.abort(parent?.reason);
  if (parent?.aborted) {
    onAbort();
  } else {
    parent?.addEventListener("abort", onAbort, { once: true });
  }

  return {
    signal: controller.signal,
    cleanup: () => {
      clearTimeout(timeout);
      parent?.removeEventListener("abort", onAbort);
    },
  };
}

interface ReportStats {
  icon: string;
  label: string;
  value: string;
  change: string;
  positive: boolean;
}

interface ReportHighlight {
  icon: string;
  label: string;
  value: string;
}

interface ReportAchievement {
  icon: string;
  title: string;
  date: string;
}

interface GeneratedInsight {
  type: "pattern" | "prediction" | "correlation" | "milestone";
  title: string;
  content: string;
  metadata: Record<string, unknown>;
}

export interface GeneratedReport {
  data: {
    moodEmojis: string[];
    stats: ReportStats[];
    sleepData: (number | null)[];
    highlights: ReportHighlight[];
    achievements: ReportAchievement[];
    overallScore: number;
  };
  summary: string;
  insights: GeneratedInsight[];
}

/**
 * Build the report data structure from aggregated data.
 * Stats and sleep data are computed purely from aggregation results.
 */
function buildReportData(agg: AggregatedPeriodData) {
  const stats: ReportStats[] = [];

  if (agg.sleep.avg !== null) {
    const change = agg.sleep.prevAvg !== null ? agg.sleep.avg - agg.sleep.prevAvg : 0;
    stats.push({
      icon: "bedtime",
      label: "睡眠均值",
      value: `${agg.sleep.avg}h`,
      change: change !== 0 ? `${change > 0 ? "↑" : "↓"}${Math.abs(change).toFixed(1)}h` : "",
      positive: change >= 0,
    });
  }

  if (agg.steps.avg !== null) {
    const change = agg.steps.prevAvg !== null ? agg.steps.avg - agg.steps.prevAvg : 0;
    stats.push({
      icon: "directions_walk",
      label: "日均步数",
      value: `${Math.round(agg.steps.avg).toLocaleString()}`,
      change: change !== 0 ? `${change > 0 ? "↑" : "↓"}${Math.abs(Math.round(change)).toLocaleString()}` : "",
      positive: change >= 0,
    });
  }

  if (agg.heartRate.avg !== null) {
    const change = agg.heartRate.prevAvg !== null ? agg.heartRate.avg - agg.heartRate.prevAvg : 0;
    stats.push({
      icon: "favorite",
      label: agg.heartRate.resting ? "静息心率" : "平均心率",
      value: `${agg.heartRate.resting || agg.heartRate.avg} bpm`,
      change: change !== 0 ? `${change > 0 ? "↑" : "↓"}${Math.abs(change)} bpm` : "",
      positive: change <= 0,
    });
  }

  if (agg.workout.count > 0 || agg.workout.prevCount > 0) {
    const change = agg.workout.count - agg.workout.prevCount;
    stats.push({
      icon: "fitness_center",
      label: "运动次数",
      value: `${agg.workout.count}次`,
      change: change !== 0 ? `${change > 0 ? "↑" : "↓"}${Math.abs(change)}次` : "",
      positive: change >= 0,
    });
  }

  if (agg.habits.totalGoals > 0) {
    const change = agg.habits.completionRate - agg.habits.prevCompletionRate;
    stats.push({
      icon: "check_circle",
      label: "习惯完成率",
      value: `${agg.habits.completionRate}%`,
      change: change !== 0 ? `${change > 0 ? "↑" : "↓"}${Math.abs(change)}%` : "",
      positive: change >= 0,
    });
  }

  if (agg.weight.latest !== null && agg.weight.change !== null && agg.weight.change !== 0) {
    stats.push({
      icon: "monitor_weight",
      label: "体重变化",
      value: `${agg.weight.latest}kg`,
      change: `${agg.weight.change > 0 ? "+" : ""}${agg.weight.change}kg`,
      positive: Math.abs(agg.weight.change) < 2,
    });
  }

  const overallScore = calculateOverallScore(agg);

  return {
    moodEmojis: agg.mood.emojis,
    stats,
    sleepData: agg.sleep.daily,
    highlights: [] as ReportHighlight[],
    achievements: [] as ReportAchievement[],
    overallScore,
  };
}

/**
 * Call LLM directly via AI Ping's OpenAI-compatible API.
 */
async function callLLM(
  systemPrompt: string,
  userPrompt: string,
  apiKey: string,
  signal?: AbortSignal
): Promise<string> {
  const response = await fetch(REPORT_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: REPORT_MODEL_ID,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      max_tokens: 16000,
      stream: false,
      ...EXTRA_BODY,
    }),
    signal,
  });

  const text = await response.text();
  if (!response.ok) {
    throw new Error(`AI Ping report generation failed (${response.status}): ${text.slice(0, 500)}`);
  }

  const json = JSON.parse(text) as {
    choices?: Array<{
      message?: {
        content?: string;
      };
    }>;
  };
  const content = json.choices?.[0]?.message?.content?.trim();
  if (!content) {
    throw new Error("AI Ping report generation returned empty content");
  }

  return content;
}

/**
 * Generate narrative summary, highlights, achievements, and insights via LLM.
 */
async function generateWithLLM(
  agg: AggregatedPeriodData,
  personaContext: string | null,
  signal?: AbortSignal,
  extraContext?: string | null
): Promise<{ summary: string; highlights: ReportHighlight[]; achievements: ReportAchievement[]; insights: GeneratedInsight[] }> {
  const apiKey = process.env.AIPING_API_KEY;
  if (!apiKey) {
    throw new Error("AIPING_API_KEY 未配置，无法生成 AI 健康报告。");
  }

  const periodLabel = agg.period.type === "weekly"
    ? `${agg.period.start.toISOString().slice(0, 10)} ~ ${new Date(agg.period.end.getTime() - 86400000).toISOString().slice(0, 10)} 周报`
    : `${agg.period.start.toISOString().slice(0, 7)} 月报`;

  const dataContext = JSON.stringify({
    period: periodLabel,
    sleep: agg.sleep.avg !== null ? { avg: agg.sleep.avg, prevAvg: agg.sleep.prevAvg } : null,
    steps: agg.steps.avg !== null ? { avg: agg.steps.avg, prevAvg: agg.steps.prevAvg } : null,
    heartRate: agg.heartRate.avg !== null ? agg.heartRate : null,
    workout: agg.workout.count > 0 ? agg.workout : null,
    weight: agg.weight.latest !== null ? agg.weight : null,
    mood: agg.mood.emojis.length > 0 ? agg.mood.distribution : null,
    habits: agg.habits.totalGoals > 0 ? { completionRate: agg.habits.completionRate, streaks: agg.habits.streaks, allCompleteDays: agg.habits.allCompleteDays } : null,
    engagement: agg.engagement,
    chat: agg.chat.sessionCount > 0 ? {
      sessionCount: agg.chat.sessionCount,
      messageCount: agg.chat.messageCount,
      memoryHighlights: agg.chat.memoryNotes.slice(0, 8),
    } : null,
    overallScore: calculateOverallScore(agg),
  }, null, 2);

  const systemPrompt = `你是一个温暖专业的健康报告分析师。根据用户的健康数据生成个性化报告内容。

要求：
- 语言简洁温暖，像朋友一样鼓励用户
- 基于数据说话，不编造没有的数据
- 如果某项数据为null，完全忽略该维度
- highlights 是本期最值得注意的3个亮点
- achievements 是本期达成的成就（streak、新纪录、显著改善等），没有就返回空数组
- insights 是AI洞察（模式发现、趋势预警、因素关联、里程碑），生成2-4条
- summary 是2-3句话的整体总结叙事

${personaContext ? `用户画像：\n${personaContext}\n` : ""}
${extraContext ? `已注入的用户上下文：\n${extraContext}\n` : ""}`;

  const userPrompt = `请根据以下健康数据生成报告内容：

${dataContext}

请严格返回以下JSON格式（不要包含markdown代码块标记）：
{
  "summary": "2-3句整体总结",
  "highlights": [
    {"icon": "material_icon_name", "label": "标签", "value": "具体数值或描述"}
  ],
  "achievements": [
    {"icon": "emoji", "title": "成就描述", "date": "YYYY-MM-DD"}
  ],
  "insights": [
    {"type": "pattern|prediction|correlation|milestone", "title": "标题", "content": "详细描述", "metadata": {"confidence": 0.8}}
  ]
}`;

  const timeoutSignal = createTimeoutSignal(signal);
  try {
    const content = await callLLM(systemPrompt, userPrompt, apiKey, timeoutSignal.signal);
    const text = content.trim().replace(/^```json?\n?|\n?```$/g, "");

    if (!text) throw new Error("Report AI returned empty JSON");

    const parsed = JSON.parse(text);

    return {
      summary: parsed.summary || "",
      highlights: Array.isArray(parsed.highlights) ? parsed.highlights : [],
      achievements: Array.isArray(parsed.achievements) ? parsed.achievements : [],
      insights: Array.isArray(parsed.insights) ? parsed.insights : [],
    };
  } catch (err) {
    if (timeoutSignal.signal.aborted) {
      throw new Error("AI 报告生成超时，请稍后重试。");
    }
    console.error("[report-ai] LLM generation failed:", err);
    throw err;
  } finally {
    timeoutSignal.cleanup();
  }
}

/**
 * Generate a complete report from aggregated data.
 */
export async function generateReport(
  agg: AggregatedPeriodData,
  personaContext: string | null,
  signal?: AbortSignal,
  extraContext?: string | null
): Promise<GeneratedReport> {
  const data = buildReportData(agg);

  // The report is considered generated only when the narrative AI step succeeds.
  const llm = await generateWithLLM(agg, personaContext, signal, extraContext);

  data.highlights = llm.highlights;
  data.achievements = llm.achievements;

  return {
    data,
    summary: llm.summary,
    insights: llm.insights,
  };
}
