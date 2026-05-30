import { completeSimple } from "@earendil-works/pi-ai";
import type { Model } from "@earendil-works/pi-ai";
import type { AgentMessage } from "@earendil-works/pi-agent-core";
import { prisma } from "@/lib/prisma";
import {
  type UserPersonaData,
  createEmptyPersona,
  parsePersona,
  personaToSystemPromptText,
} from "./persona-types";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const MEMORY_MODEL: Model<"openai-completions"> = {
  id: "GLM-5.1",
  name: "GLM-5.1 (AI Ping)",
  api: "openai-completions",
  provider: "aiping",
  baseUrl: "https://aiping.cn/api/v1",
  reasoning: false,
  input: ["text"],
  cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
  contextWindow: 128000,
  maxTokens: 8000,
};

const EXTRA_BODY = {
  enable_thinking: false,
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

const MAX_ITEMS_PER_FIELD = 30;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const json = (v: unknown): any => v;

// ---------------------------------------------------------------------------
// Read / Build System Prompt
// ---------------------------------------------------------------------------

export async function getUserPersona(userId: string): Promise<UserPersonaData | null> {
  const row = await prisma.userPersona.findUnique({ where: { userId } });
  if (!row) return null;
  return parsePersona({
    identity: row.identity,
    behavior: row.behavior,
    expression: row.expression,
    preferences: row.preferences,
  });
}

export async function getOrCreatePersona(userId: string): Promise<UserPersonaData> {
  const existing = await getUserPersona(userId);
  if (existing) return existing;
  const empty = createEmptyPersona();
  await prisma.userPersona.create({
    data: {
      userId,
      identity: json(empty.identity),
      behavior: json(empty.behavior),
      expression: json(empty.expression),
      preferences: json(empty.preferences),
    },
  });
  return empty;
}

/**
 * Build the full system prompt including persona injection.
 * Called at the start of each conversation.
 */
export async function buildSystemPrompt(
  basePrompt: string,
  userId: string
): Promise<string> {
  const persona = await getUserPersona(userId);
  if (!persona) return basePrompt;

  const personaText = personaToSystemPromptText(persona);
  if (!personaText) return basePrompt;

  return `${basePrompt}\n\n${personaText}\n\n请记住以上用户画像，在回复中体现对用户的了解。`;
}

// ---------------------------------------------------------------------------
// Memory Extraction Pipeline (P2)
// ---------------------------------------------------------------------------

/**
 * Main entry point for the memory write pipeline.
 * Called AFTER the conversation ends (agent_end) to prevent self-reinforcement.
 *
 * This function is fire-and-forget — it does NOT block the SSE stream.
 */
export async function extractAndUpdatePersona(
  userId: string,
  conversationMessages: AgentMessage[],
  apiKey: string
): Promise<void> {
  try {
    const conversationText = serializeConversation(conversationMessages);
    if (conversationText.length < 50) return;

    const currentPersona = await getOrCreatePersona(userId);

    const hasNewInfo = await checkForNewInfo(conversationText, currentPersona, apiKey);
    if (!hasNewInfo) return;

    const updates = await extractPersonaUpdates(conversationText, currentPersona, apiKey);

    let merged = mergePersonaUpdates(currentPersona, updates);

    merged = capPersonaArrays(merged);

    await prisma.userPersona.update({
      where: { userId },
      data: {
        identity: json(merged.identity),
        behavior: json(merged.behavior),
        expression: json(merged.expression),
        preferences: json(merged.preferences),
        version: { increment: 1 },
      },
    });
  } catch (err) {
    console.error("[Persona] Extraction failed:", err);
  }
}

// ---------------------------------------------------------------------------
// Step 1: Lightweight check for new info
// ---------------------------------------------------------------------------

async function checkForNewInfo(
  conversationText: string,
  currentPersona: UserPersonaData,
  apiKey: string
): Promise<boolean> {
  const currentPersonaText = personaToSystemPromptText(currentPersona);
  const prompt = `你是一个高效的信息筛选助手。你的任务是判断一段对话是否包含值得记录到用户画像中的新信息。

当前已记录的用户画像：
${currentPersonaText || "（尚无记录）"}

对话内容：
${conversationText}

请只回答 "YES" 或 "NO"：
- YES：对话中包含当前画像未记录的新事实（生活方式、习惯、偏好、表达方式等）
- NO：对话中没有值得记录的新信息，或只是重复已知信息`;

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
// Step 2: Extract structured updates
// ---------------------------------------------------------------------------

async function extractPersonaUpdates(
  conversationText: string,
  currentPersona: UserPersonaData,
  apiKey: string
): Promise<Partial<UserPersonaData>> {
  const currentPersonaJson = JSON.stringify(currentPersona, null, 2);
  const prompt = `你是一个用户画像提取助手。请从对话中提取关于用户的新事实，并以结构化 JSON 输出。

当前用户画像：
${currentPersonaJson}

对话内容：
${conversationText}

请提取新信息，输出格式必须是可以直接解析的 JSON：
{
  "identity": { "lifestyleTags": [], "role": "", "demographics": [], "notes": [] },
  "behavior": { "routines": [], "habitPatterns": [], "stressCoping": [], "triggers": [] },
  "expression": { "languageStyle": [], "tonePreferences": [], "patterns": [] },
  "preferences": { "responseStyle": [], "focusAreas": [], "avoid": [], "depth": [] }
}

规则：
1. 只包含对话中明确体现或强烈暗示的新信息
2. 如果某维度没有新信息，保留空数组
3. 每个条目应该是一个完整、自包含的事实陈述
4. 不要重复当前画像中已存在的信息
5. 输出必须是纯 JSON，不要 markdown 代码块`;

  const response = await completeSimple(
    MEMORY_MODEL,
    {
      systemPrompt:
        "你是一个用户画像提取助手。只输出纯 JSON，不要 markdown 代码块，不要解释。",
      messages: [{ role: "user", content: prompt, timestamp: Date.now() }],
    },
    {
      maxTokens: 4000,
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
    .replace(/```\s*$/, "")
    .trim();

  try {
    return JSON.parse(jsonText) as Partial<UserPersonaData>;
  } catch {
    return {};
  }
}

// ---------------------------------------------------------------------------
// Deduplication (P3)
// ---------------------------------------------------------------------------

/**
 * Simple string containment dedup:
 * - If existing contains new → skip new
 * - If new contains existing → replace existing with new
 * - Otherwise → append new
 */
function dedupStrings(existing: string[], incoming: string[]): string[] {
  const result = [...existing];

  for (const newItem of incoming) {
    const newNorm = newItem.toLowerCase().trim();
    if (!newNorm) continue;
    let handled = false;

    for (let i = 0; i < result.length; i++) {
      const oldNorm = result[i].toLowerCase().trim();
      if (!oldNorm) continue;

      if (oldNorm.includes(newNorm)) {
        handled = true;
        break;
      }

      if (newNorm.includes(oldNorm) && newNorm.length > oldNorm.length) {
        result[i] = newItem;
        handled = true;
        break;
      }
    }

    if (!handled) {
      result.push(newItem);
    }
  }

  return result;
}

function mergePersonaUpdates(
  current: UserPersonaData,
  updates: Partial<UserPersonaData>
): UserPersonaData {
  return {
    identity: {
      lifestyleTags: dedupStrings(
        current.identity.lifestyleTags,
        updates.identity?.lifestyleTags ?? []
      ),
      role: updates.identity?.role ?? current.identity.role,
      demographics: dedupStrings(
        current.identity.demographics ?? [],
        updates.identity?.demographics ?? []
      ),
      notes: dedupStrings(
        current.identity.notes ?? [],
        updates.identity?.notes ?? []
      ),
    },
    behavior: {
      routines: dedupStrings(
        current.behavior.routines,
        updates.behavior?.routines ?? []
      ),
      habitPatterns: dedupStrings(
        current.behavior.habitPatterns,
        updates.behavior?.habitPatterns ?? []
      ),
      stressCoping: dedupStrings(
        current.behavior.stressCoping,
        updates.behavior?.stressCoping ?? []
      ),
      triggers: dedupStrings(
        current.behavior.triggers ?? [],
        updates.behavior?.triggers ?? []
      ),
    },
    expression: {
      languageStyle: dedupStrings(
        current.expression.languageStyle,
        updates.expression?.languageStyle ?? []
      ),
      tonePreferences: dedupStrings(
        current.expression.tonePreferences,
        updates.expression?.tonePreferences ?? []
      ),
      patterns: dedupStrings(
        current.expression.patterns ?? [],
        updates.expression?.patterns ?? []
      ),
    },
    preferences: {
      responseStyle: dedupStrings(
        current.preferences.responseStyle,
        updates.preferences?.responseStyle ?? []
      ),
      focusAreas: dedupStrings(
        current.preferences.focusAreas,
        updates.preferences?.focusAreas ?? []
      ),
      avoid: dedupStrings(
        current.preferences.avoid ?? [],
        updates.preferences?.avoid ?? []
      ),
      depth: dedupStrings(
        current.preferences.depth ?? [],
        updates.preferences?.depth ?? []
      ),
    },
  };
}

function capPersonaArrays(persona: UserPersonaData): UserPersonaData {
  return {
    identity: {
      lifestyleTags: persona.identity.lifestyleTags.slice(-MAX_ITEMS_PER_FIELD),
      role: persona.identity.role,
      demographics: (persona.identity.demographics ?? []).slice(-MAX_ITEMS_PER_FIELD),
      notes: (persona.identity.notes ?? []).slice(-MAX_ITEMS_PER_FIELD),
    },
    behavior: {
      routines: persona.behavior.routines.slice(-MAX_ITEMS_PER_FIELD),
      habitPatterns: persona.behavior.habitPatterns.slice(-MAX_ITEMS_PER_FIELD),
      stressCoping: persona.behavior.stressCoping.slice(-MAX_ITEMS_PER_FIELD),
      triggers: (persona.behavior.triggers ?? []).slice(-MAX_ITEMS_PER_FIELD),
    },
    expression: {
      languageStyle: persona.expression.languageStyle.slice(-MAX_ITEMS_PER_FIELD),
      tonePreferences: persona.expression.tonePreferences.slice(-MAX_ITEMS_PER_FIELD),
      patterns: (persona.expression.patterns ?? []).slice(-MAX_ITEMS_PER_FIELD),
    },
    preferences: {
      responseStyle: persona.preferences.responseStyle.slice(-MAX_ITEMS_PER_FIELD),
      focusAreas: persona.preferences.focusAreas.slice(-MAX_ITEMS_PER_FIELD),
      avoid: (persona.preferences.avoid ?? []).slice(-MAX_ITEMS_PER_FIELD),
      depth: (persona.preferences.depth ?? []).slice(-MAX_ITEMS_PER_FIELD),
    },
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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
