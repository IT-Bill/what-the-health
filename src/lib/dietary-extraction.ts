import { completeSimple } from "@earendil-works/pi-ai";
import type { Model } from "@earendil-works/pi-ai";
import type { AgentMessage } from "@earendil-works/pi-agent-core";
import { prisma } from "@/lib/prisma";
import { indexDietaryLogInBackground } from "@/lib/memory/dietary-vector-memory";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const MEMORY_MODEL: Model<"openai-completions"> = {
  id: "Kimi-K2.6",
  name: "Kimi K2.6 (AI Ping)",
  api: "openai-completions",
  provider: "aiping",
  baseUrl: "https://aiping.cn/api/v1",
  reasoning: true,
  input: ["text"],
  cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
  contextWindow: 256000,
  maxTokens: 32000,
};

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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const json = (v: unknown): any => v;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DietaryFoodItem {
  name: string;
  amount: string;
  unit: string;
  estimatedCalories: number;
}

export interface DietaryExtraction {
  rawDescription: string;
  mealTime: string;
  cookingMethod: "home_cooked" | "takeout" | "cafeteria" | null;
  location: "home" | "office" | "restaurant" | null;
  foods: DietaryFoodItem[];
  estimatedTotalCalories: number;
}

export interface NutritionBalance {
  protein: string;
  carb: string;
  fat: string;
}

export interface DietaryEvaluation {
  score: number;
  feedback: string;
  suggestions: string[];
  nutritionBalance: NutritionBalance;
}

// ---------------------------------------------------------------------------
// Main Entry Point
// ---------------------------------------------------------------------------

/**
 * Main entry point for the dietary extraction pipeline.
 * Called AFTER the conversation ends to extract and save dietary information.
 *
 * This function is fire-and-forget — it does NOT block the SSE stream.
 */
export async function extractAndUpdateDietaryLog(
  userId: string,
  conversationMessages: AgentMessage[],
  apiKey: string
): Promise<void> {
  try {
    const conversationText = serializeConversation(conversationMessages);
    if (conversationText.length < 30) return;

    const hasDietaryInfo = await checkForDietaryInfo(conversationText, apiKey);
    if (!hasDietaryInfo) return;

    const extracted = await extractDietaryInfo(conversationText, apiKey);
    if (!extracted) return;

    const evaluation = await evaluateDietaryLog(extracted, userId, apiKey);

    const dietaryLog = await prisma.dietaryLog.create({
      data: {
        userId,
        mealType: inferMealType(extracted.mealTime),
        logDate: new Date(),
        rawInput: extracted.rawDescription,
        parsedFoods: json(extracted.foods),
        totalCalories: extracted.estimatedTotalCalories || null,
        cookingMethod: extracted.cookingMethod || null,
        location: extracted.location || null,
        aiEvaluation: evaluation ? json(evaluation) : null,
      },
    });

    // Background vector indexing — fire and forget (errors handled internally)
    void indexDietaryLogInBackground({
      id: dietaryLog.id,
      userId,
      mealType: inferMealType(extracted.mealTime),
      logDate: new Date(),
      rawInput: extracted.rawDescription,
      totalCalories: extracted.estimatedTotalCalories || null,
      aiEvaluation: evaluation ? { score: evaluation.score, feedback: evaluation.feedback } : null,
    });
  } catch (err) {
    console.error("[Dietary] Extraction failed:", err);
  }
}

// ---------------------------------------------------------------------------
// Step 1: Lightweight check for dietary info
// ---------------------------------------------------------------------------

export async function checkForDietaryInfo(
  conversationText: string,
  apiKey: string
): Promise<boolean> {
  const prompt = `判断以下对话是否包含用户描述自己吃了什么、喝了什么、或者计划吃什么的信息。

对话内容：
${conversationText}

请只回答 "YES" 或 "NO"：
- YES：对话中包含用户描述的饮食信息（吃了什么、喝了什么、计划吃什么）
- NO：对话中没有饮食相关信息`;

  const response = await completeSimple(
    MEMORY_MODEL,
    {
      systemPrompt: "你只回答 YES 或 NO，不要解释。",
      messages: [{ role: "user", content: prompt, timestamp: Date.now() }],
    },
    {
      maxTokens: 10,
      apiKey,
      onPayload: (payload) => ({
        ...(payload as Record<string, unknown>),
        ...EXTRA_BODY,
      }),
    }
  );

  const text = response.content
    .filter((c) => c.type === "text")
    .map((c) => c.text)
    .join("")
    .trim()
    .toUpperCase();

  return text.includes("YES");
}

// ---------------------------------------------------------------------------
// Step 2: Extract structured dietary information
// ---------------------------------------------------------------------------

export async function extractDietaryInfo(
  conversationText: string,
  apiKey: string
): Promise<DietaryExtraction | null> {
  const prompt = `从以下对话中提取用户的饮食信息，并以结构化 JSON 输出。

对话内容：
${conversationText}

请提取饮食信息，输出格式必须是可以直接解析的 JSON：
{
  "rawDescription": "用户描述饮食的原话摘要",
  "mealTime": "早餐/午餐/晚餐/加餐",
  "cookingMethod": "home_cooked|takeout|cafeteria|null",
  "location": "home|office|restaurant|null",
  "foods": [
    { "name": "食物名称", "amount": "数量描述", "unit": "份/碗/克等", "estimatedCalories": 0 }
  ],
  "estimatedTotalCalories": 0
}

规则：
1. 只包含对话中明确提到的食物和饮品
2. 如果某项信息无法确定，使用 null
3. 每种食物都要估算热量（千卡）
4. 输出必须是纯 JSON，不要 markdown 代码块`;

  const response = await completeSimple(
    MEMORY_MODEL,
    {
      systemPrompt: "你是一个饮食信息提取助手。只输出纯 JSON，不要 markdown 代码块，不要解释。",
      messages: [{ role: "user", content: prompt, timestamp: Date.now() }],
    },
    {
      maxTokens: 2000,
      apiKey,
      onPayload: (payload) => ({
        ...(payload as Record<string, unknown>),
        ...EXTRA_BODY,
      }),
    }
  );

  const text = response.content
    .filter((c) => c.type === "text")
    .map((c) => c.text)
    .join("")
    .trim();

  const jsonText = text
    .replace(/^```json\s*/, "")
    .replace(/^```\s*/, "")
    .replace(/```\s*$/, "")
    .trim();

  try {
    return JSON.parse(jsonText) as DietaryExtraction;
  } catch {
    console.error("[Dietary] Failed to parse extraction JSON:", jsonText);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Step 3: AI Evaluation
// ---------------------------------------------------------------------------

export async function evaluateDietaryLog(
  extracted: DietaryExtraction,
  userId: string,
  apiKey: string
): Promise<DietaryEvaluation | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      primaryGoal: true,
      targetWeightKg: true,
      dailyActiveCalories: true,
    },
  });

  const healthProfile = await prisma.userHealthProfile.findUnique({
    where: { userId },
    select: {
      dietaryPreference: true,
      foodAllergies: true,
      foodIntolerances: true,
      medicalConditions: true,
      occupationType: true,
    },
  });

  const userContext = {
    primaryGoal: user?.primaryGoal ?? "unknown",
    targetWeightKg: user?.targetWeightKg ?? null,
    dailyActiveCalories: user?.dailyActiveCalories ?? null,
    dietaryPreference: healthProfile?.dietaryPreference ?? null,
    foodAllergies: healthProfile?.foodAllergies ?? [],
    foodIntolerances: healthProfile?.foodIntolerances ?? [],
    medicalConditions: healthProfile?.medicalConditions ?? [],
    occupationType: healthProfile?.occupationType ?? null,
  };

  const prompt = `请对以下饮食记录进行专业评估。

用户健康背景：
${JSON.stringify(userContext, null, 2)}

饮食记录：
- 餐段：${extracted.mealTime}
- 烹饪方式：${extracted.cookingMethod ?? "未知"}
- 地点：${extracted.location ?? "未知"}
- 食物：${extracted.foods.map((f) => `${f.name} ${f.amount}${f.unit} (~${f.estimatedCalories}kcal)`).join("，")}
- 总热量：约 ${extracted.estimatedTotalCalories} kcal

请输出评估结果，格式为纯 JSON：
{
  "score": 1-10,
  "feedback": "简短评价",
  "suggestions": ["建议1", "建议2"],
  "nutritionBalance": { "protein": "adequate/low/high", "carb": "adequate/low/high", "fat": "adequate/low/high" }
}

规则：
1. score 为 1-10 的整数，10 为最佳
2. feedback 不超过 100 字
3. suggestions 提供 1-3 条具体建议
4. nutritionBalance 评估蛋白质、碳水、脂肪的摄入是否均衡
5. 考虑用户的健康目标和饮食偏好
6. 输出必须是纯 JSON，不要 markdown 代码块`;

  const response = await completeSimple(
    MEMORY_MODEL,
    {
      systemPrompt: "你是一个专业营养师。只输出纯 JSON，不要 markdown 代码块，不要解释。",
      messages: [{ role: "user", content: prompt, timestamp: Date.now() }],
    },
    {
      maxTokens: 1500,
      apiKey,
      onPayload: (payload) => ({
        ...(payload as Record<string, unknown>),
        ...EXTRA_BODY,
      }),
    }
  );

  const text = response.content
    .filter((c) => c.type === "text")
    .map((c) => c.text)
    .join("")
    .trim();

  const jsonText = text
    .replace(/^```json\s*/, "")
    .replace(/^```\s*/, "")
    .replace(/```\s*$/, "")
    .trim();

  try {
    return JSON.parse(jsonText) as DietaryEvaluation;
  } catch {
    console.error("[Dietary] Failed to parse evaluation JSON:", jsonText);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function inferMealType(mealTime: string): "breakfast" | "lunch" | "dinner" | "snack" {
  const normalized = mealTime.trim().toLowerCase();

  if (normalized.includes("早") || normalized.includes("breakfast")) return "breakfast";
  if (normalized.includes("午") || normalized.includes("lunch")) return "lunch";
  if (normalized.includes("晚") || normalized.includes("dinner")) return "dinner";
  if (normalized.includes("加") || normalized.includes("snack") || normalized.includes("点")) return "snack";

  // Default fallback based on time of day
  const hour = new Date().getHours();
  if (hour < 10) return "breakfast";
  if (hour < 14) return "lunch";
  if (hour < 20) return "dinner";
  return "snack";
}

function serializeConversation(messages: AgentMessage[]): string {
  return messages
    .map((m) => {
      if (m.role === "user") {
        return `用户：${m.content}`;
      }
      if (m.role === "assistant") {
        const text = m.content
          .filter((c) => c.type === "text")
          .map((c) => (c as { text: string }).text)
          .join("");
        return `助手：${text}`;
      }
      if (m.role === "toolResult") {
        const text = m.content
          .filter((c) => c.type === "text")
          .map((c) => (c as { text: string }).text)
          .join("");
        return `工具结果：${text}`;
      }
      return "";
    })
    .filter(Boolean)
    .join("\n\n");
}

