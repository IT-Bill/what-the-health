import { embedTextWithBailian } from "@/lib/embeddings/bailian";
import { getPrimaryGoalLabels } from "@/lib/primary-goals";
import { prisma } from "@/lib/prisma";
import { searchVectorDocuments } from "@/lib/vector/pgvector";
import { MEMORY_VECTOR_NAMESPACE } from "./constants";

type HealthRecordForContext = {
  metric: string;
  value: number;
  unit: string | null;
  startDate: Date;
  sourceName: string | null;
};

type ChatMessageForContext = {
  role: "user" | "assistant";
  content: string;
  createdAt: Date;
};

type VectorMemoryForContext = {
  content: string;
  similarity: number;
};

type InteractionMemoryForContext = {
  source: string | null;
  note: string | null;
  metadata?: unknown;
  createdAt: Date;
};

type DietaryLogForContext = {
  mealType: string;
  rawInput: string;
  totalCalories: number | null;
};

export interface AnswerReferenceContextInput {
  healthGoal: string | null;
  activeGoals: string[];
  healthRecords: HealthRecordForContext[];
  chatMessages: ChatMessageForContext[];
  vectorMemories: VectorMemoryForContext[];
  interactionMemories?: InteractionMemoryForContext[];
  dietaryLogs?: DietaryLogForContext[];
  now?: Date;
}

const DAY_MS = 24 * 60 * 60 * 1000;

export function formatAnswerReferenceContext(input: AnswerReferenceContextInput): string {
  const now = input.now ?? new Date();
  const last24h = input.healthRecords.filter(
    (record) => now.getTime() - record.startDate.getTime() <= DAY_MS
  );

  const lines: string[] = [
    "## 回答前必须参考的个性化依据",
    "请先综合以下依据，再回答用户；不要逐条复述，除非用户要求。",
    "",
    "## 健康目标",
    `- 主目标：${input.healthGoal ?? "暂未设置"}`,
    `- 当前习惯目标：${input.activeGoals.length ? input.activeGoals.join("；") : "暂无活跃目标"}`,
    "",
    "## 1-7天内健康设备监测数据",
  ];

  if (last24h.length > 0) {
    lines.push("- 24h内数据：");
    last24h.slice(0, 12).forEach((record) => {
      lines.push(`  - ${formatHealthRecord(record)}`);
    });
  } else {
    lines.push("- 24h内数据：暂无");
  }

  const olderRecords = input.healthRecords.filter((record) => !last24h.includes(record));
  if (olderRecords.length > 0) {
    lines.push("- 近7天其他数据：");
    olderRecords.slice(0, 20).forEach((record) => {
      lines.push(`  - ${formatHealthRecord(record)}`);
    });
  }

  lines.push("", "## 24h内chat聊天上下文");
  if (input.chatMessages.length > 0) {
    input.chatMessages.slice(-30).forEach((message) => {
      lines.push(`- ${message.role === "user" ? "用户" : "助手"}：${message.content}`);
    });
  } else {
    lines.push("- 暂无");
  }

  lines.push("", "## 今日饮食记录");
  if (input.dietaryLogs?.length) {
    input.dietaryLogs.forEach((log) => {
      const mealLabel = getMealTypeLabel(log.mealType);
      let text = `- ${mealLabel}: ${log.rawInput}`;
      if (log.totalCalories) {
        text += `（约 ${Math.round(log.totalCalories)} kcal）`;
      }
      lines.push(text);
    });
  } else {
    lines.push("- 今日尚未记录饮食");
  }

  lines.push("", "## 近期互动偏好/点赞历史");
  if (input.interactionMemories?.length) {
    input.interactionMemories.slice(0, 12).forEach((memory) => {
      const source = memory.source ? `${memory.source}：` : "";
      const summary = getInteractionSummary(memory.metadata);
      lines.push(`- ${source}${memory.note ?? ""}${summary ? ` 摘要：${summary}` : ""}`);
    });
  } else {
    lines.push("- 暂无");
  }

  lines.push("", "## 相关向量记忆");
  if (input.vectorMemories.length > 0) {
    input.vectorMemories.forEach((memory) => {
      lines.push(`- (${memory.similarity.toFixed(2)}) ${memory.content}`);
    });
  } else {
    lines.push("- 暂无");
  }

  return lines.join("\n");
}

export async function buildAnswerReferenceContext(userId: string, query: string): Promise<string> {
  const now = new Date();
  const since24h = new Date(now.getTime() - DAY_MS);
  const since7d = new Date(now.getTime() - 7 * DAY_MS);

  const [user, activeGoals, healthRecords, chatMessages, interactionMemories, vectorMemories, dietaryLogs] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { primaryGoal: true, primaryGoals: true },
    }),
    prisma.goal.findMany({
      where: { userId, archived: false },
      orderBy: { sortOrder: "asc" },
      take: 8,
      select: { title: true },
    }),
    prisma.healthRecord.findMany({
      where: { userId, startDate: { gte: since7d } },
      orderBy: { startDate: "desc" },
      take: 80,
      select: {
        metric: true,
        value: true,
        unit: true,
        startDate: true,
        sourceName: true,
      },
    }),
    prisma.chatMessage.findMany({
      where: {
        createdAt: { gte: since24h },
        session: { userId },
      },
      orderBy: { createdAt: "asc" },
      take: 40,
      select: { role: true, content: true, createdAt: true },
    }),
    prisma.memory.findMany({
      where: {
        userId,
        source: { in: ["post-like", "post-favorite", "post-comment", "comment-like", "comment-favorite"] },
      },
      orderBy: { createdAt: "desc" },
      take: 12,
      select: { source: true, note: true, metadata: true, createdAt: true },
    }),
    searchRelevantMemories(userId, query),
    prisma.dietaryLog.findMany({
      where: {
        userId,
        logDate: { gte: since24h },
      },
      orderBy: { loggedAt: "desc" },
      take: 10,
      select: { mealType: true, rawInput: true, totalCalories: true },
    }),
  ]);

  return formatAnswerReferenceContext({
    healthGoal: user ? getPrimaryGoalLabels(user.primaryGoals, user.primaryGoal).join("、") || null : null,
    activeGoals: activeGoals.map((goal) => goal.title),
    healthRecords,
    chatMessages: chatMessages.map((message) => ({
      role: message.role.toLowerCase() as "user" | "assistant",
      content: message.content,
      createdAt: message.createdAt,
    })),
    vectorMemories,
    interactionMemories,
    dietaryLogs: dietaryLogs.map((log) => ({
      mealType: log.mealType,
      rawInput: log.rawInput,
      totalCalories: log.totalCalories,
    })),
    now,
  });
}

async function searchRelevantMemories(userId: string, query: string): Promise<VectorMemoryForContext[]> {
  try {
    const embedding = await embedTextWithBailian(query || "用户健康目标 健康数据 聊天上下文 偏好");
    const results = await searchVectorDocuments({
      namespace: MEMORY_VECTOR_NAMESPACE,
      userId,
      embedding,
      limit: 6,
    });
    return results.map((result) => ({
      content: result.content,
      similarity: result.similarity,
    }));
  } catch (error) {
    console.warn("[Memory] Vector recall skipped:", error);
    return [];
  }
}

function formatHealthRecord(record: HealthRecordForContext): string {
  const value = `${record.metric}: ${record.value}${record.unit ? ` ${record.unit}` : ""}`;
  const time = record.startDate.toISOString();
  const source = record.sourceName ? `，来源：${record.sourceName}` : "";
  return `${value}，时间：${time}${source}`;
}

function getInteractionSummary(metadata: unknown): string | null {
  if (!metadata || typeof metadata !== "object") return null;
  const summary = (metadata as Record<string, unknown>).summary;
  if (typeof summary !== "string") return null;
  const trimmed = summary.trim();
  if (!trimmed) return null;
  return trimmed.length > 180 ? `${trimmed.slice(0, 180)}...` : trimmed;
}

function getMealTypeLabel(mealType: string): string {
  switch (mealType) {
    case "breakfast": return "早餐";
    case "lunch": return "午餐";
    case "dinner": return "晚餐";
    case "snack": return "加餐";
    default: return mealType;
  }
}
