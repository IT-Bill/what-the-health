// 将 DietaryLog 记录索引到 pgvector 向量数据库，用于语义检索

import { embedTextWithBailian } from "@/lib/embeddings/bailian";
import { upsertVectorDocument } from "@/lib/vector/pgvector";

export const DIETARY_VECTOR_NAMESPACE = "dietary-log";

export interface DietaryLogVectorInput {
  id: string;
  userId: string;
  mealType: string;
  logDate: Date;
  rawInput: string;
  totalCalories?: number | null;
  aiEvaluation?: Record<string, unknown> | null;
}

export function indexDietaryLogInBackground(input: DietaryLogVectorInput): void {
  indexDietaryLogVector(input).catch((error) => {
    console.error("[Memory] Dietary log vector index failed:", error);
  });
}

export async function indexDietaryLogVector(input: DietaryLogVectorInput): Promise<void> {
  const content = buildDietaryLogVectorContent(input);
  const embedding = await embedTextWithBailian(content);
  await upsertVectorDocument(
    {
      namespace: DIETARY_VECTOR_NAMESPACE,
      sourceId: input.id,
      userId: input.userId,
      title: `${input.mealType}-${input.logDate.toISOString().slice(0, 10)}`,
      content,
      metadata: {
        source: "dietary-log",
        mealType: input.mealType,
        logDate: input.logDate.toISOString(),
        totalCalories: input.totalCalories ?? null,
      },
    },
    embedding
  );
}

export function buildDietaryLogVectorContent(input: DietaryLogVectorInput): string {
  const lines: string[] = [
    "来源：dietary-log",
    `餐段：${input.mealType}`,
    `日期：${input.logDate.toISOString().slice(0, 10)}`,
    `内容：${input.rawInput.trim()}`,
  ];

  if (input.totalCalories != null) {
    lines.push(`总热量：约 ${input.totalCalories} kcal`);
  }

  if (input.aiEvaluation) {
    const score = input.aiEvaluation.score;
    if (typeof score === "number") {
      lines.push(`评估：评分 ${score}/10`);
    }
    const feedback = input.aiEvaluation.feedback;
    if (typeof feedback === "string" && feedback.trim()) {
      lines.push(`反馈：${feedback.trim()}`);
    }
  }

  return lines.join("\n");
}
