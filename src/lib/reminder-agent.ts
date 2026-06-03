import { completeSimple } from "@earendil-works/pi-ai";
import { prisma } from "./prisma";

const REMINDER_MODEL = {
  id: "Kimi-K2.6",
  name: "Kimi K2.6 (AI Ping)",
  api: "openai-completions" as const,
  provider: "aiping" as const,
  baseUrl: "https://aiping.cn/api/v1",
  reasoning: false,
  input: ["text"] as ("text" | "image")[],
  cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
  contextWindow: 256000,
  maxTokens: 2000,
};

const EXTRA_BODY = {
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

type ReminderType = "medication" | "vital_sign" | "follow_up" | "check_in";

interface ReminderContext {
  userId: string;
  userName: string;
  reminderType: ReminderType;
  title: string;
  description?: string | null;
  frequency: string;
}

const TYPE_LABELS: Record<ReminderType, string> = {
  medication: "用药提醒",
  vital_sign: "指标监测",
  follow_up: "复诊提醒",
  check_in: "恢复询问",
};

const FALLBACK_TITLES: Record<ReminderType, string> = {
  medication: "该吃药啦",
  vital_sign: "测一下",
  follow_up: "复诊提醒",
  check_in: "今天感觉怎么样？",
};

const FALLBACK_BODIES: Record<ReminderType, string> = {
  medication: "记得按时服药，身体会慢慢好起来的。",
  vital_sign: "该记录了，坚持监测对身体管理很重要。",
  follow_up: "别忘了预约，医生在等着你呢。",
  check_in: "想问问你最近恢复得怎么样？有任何不舒服都可以告诉我。",
};

export async function generateReminderMessage(
  context: ReminderContext
): Promise<{ title: string; body: string }> {
  const userProfile = await prisma.userHealthProfile.findUnique({
    where: { userId: context.userId },
    select: {
      foodAllergies: true,
      medicalConditions: true,
      medications: true,
    },
  });

  const systemPrompt = `你是 Mindful，一位温柔沉静的健康陪伴助手。
你的任务是根据用户的健康档案和提醒类型，生成一句温暖、简短、个性化的提醒消息。

要求：
- 语气像朋友关心一样，不要机械
- 控制在 30 字以内
- 如果是用药提醒，温和地提醒按时服药
- 如果是指标监测，轻松地提醒测量
- 如果是复诊提醒，温暖地提醒预约
- 如果是恢复询问，真诚地关心恢复情况

用户健康档案：
${userProfile?.medicalConditions ? `慢性病：${userProfile.medicalConditions.join(", ")}` : ""}
${userProfile?.medications ? `正在服用：${userProfile.medications.join(", ")}` : ""}`;

  const userPrompt = `提醒类型：${TYPE_LABELS[context.reminderType]}
提醒内容：${context.title}${context.description ? `（${context.description}）` : ""}
频率：${context.frequency}

请生成一条温暖的提醒消息，格式为：
标题：xxx
内容：xxx`;

  try {
    const response = await completeSimple(
      REMINDER_MODEL,
      {
        systemPrompt,
        messages: [
          {
            role: "user",
            content: userPrompt,
            timestamp: Date.now(),
          },
        ],
      },
      {
        maxTokens: 200,
        apiKey: process.env.AIPING_API_KEY,
        onPayload: (p) => ({ ...(p as Record<string, unknown>), ...EXTRA_BODY }),
      }
    );

    const text = response.content
      .filter((c) => c.type === "text")
      .map((c) => (c as { text: string }).text)
      .join("")
      .trim();

    // Parse "标题：xxx\n内容：xxx" format
    const titleMatch = text.match(/标题[：:]\s*(.+)/);
    const bodyMatch = text.match(/内容[：:]\s*(.+)/);

    const title = titleMatch?.[1]?.trim() || `${FALLBACK_TITLES[context.reminderType]}：${context.title}`;
    const body = bodyMatch?.[1]?.trim() || text.slice(0, 60) || `${FALLBACK_BODIES[context.reminderType]}（${context.title}）`;

    return { title, body };
  } catch (err) {
    return {
      title: `${FALLBACK_TITLES[context.reminderType]}：${context.title}`,
      body: `${FALLBACK_BODIES[context.reminderType]}（${context.title}）`,
    };
  }
}
