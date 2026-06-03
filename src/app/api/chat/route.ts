import {
  Agent,
  estimateContextTokens,
  shouldCompact,
  estimateTokens,
} from "@earendil-works/pi-agent-core";
import type {
  AgentEvent,
  AgentMessage,
  AgentToolResult,
} from "@earendil-works/pi-agent-core";
import type { Model, Message } from "@earendil-works/pi-ai";
import { completeSimple } from "@earendil-works/pi-ai";
import { prisma } from "@/lib/prisma";
import { getAuthCookie, verifyToken } from "@/lib/auth";
import { createTools } from "./tools";
import {
  buildSystemPrompt,
  extractAndUpdatePersona,
} from "@/lib/persona-service";
import { buildAnswerReferenceContext } from "@/lib/memory/answer-context";
import { indexChatMessageInBackground } from "@/lib/memory/chat-vector-memory";
import { buildRoleSystemPrompt, isValidAgentRole } from "@/lib/agent-role";
import { buildGoalParameterSetupState } from "@/lib/goal-parameter-setup";
import {
  buildDietaryContext,
  buildWearableContext,
  buildTimeContext,
  buildHealthProfileContext,
} from "@/lib/dietary-context";
import { loadChatSkills, formatSkillsForSystemPrompt } from "@/lib/chat/skills";
import { extractAndUpdateDietaryLog } from "@/lib/dietary-extraction";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MODEL: Model<"openai-completions"> = {
  id: "Kimi-K2.6",
  name: "Kimi K2.6 (AI Ping)",
  api: "openai-completions",
  provider: "aiping",
  baseUrl: "https://aiping.cn/api/v1",
  reasoning: true,
  input: ["text", "image"],
  cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
  contextWindow: 256000,
  maxTokens: 32000,
  compat: {
    thinkingFormat: "qwen",
    supportsReasoningEffort: false,
  },
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


function agentMsgToWire(m: AgentMessage): { role: string; text: string } | null {
  if (m.role === "user") {
    const content = m.content;
    if (typeof content === "string") {
      return { role: "user", text: content };
    }
    // Array content: extract text parts
    if (Array.isArray(content)) {
      const text = content
        .filter((c) => c.type === "text")
        .map((c) => (c as { text: string }).text)
        .join("");
      return { role: "user", text };
    }
    return { role: "user", text: "" };
  }
  if (m.role === "assistant") {
    const text = m.content
      .filter((c) => c.type === "text")
      .map((c) => (c as { text: string }).text)
      .join("");
    return { role: "assistant", text };
  }
  if (m.role === "toolResult") {
    const text = m.content
      .filter((c) => c.type === "text")
      .map((c) => (c as { text: string }).text)
      .join("");
    return { role: "toolResult", text };
  }
  return null;
}

function wireToAgentMsgs(
  msgs: { role: "user" | "assistant"; text: string; imageUrl?: string | null }[]
): AgentMessage[] {
  return msgs
    .filter((m) => m.text.trim() || m.imageUrl)
    .map((m) => {
      if (m.role === "user") {
        return { role: "user", content: m.text, timestamp: Date.now() };
      }
      return {
        role: "assistant",
        content: [{ type: "text", text: m.text }],
        api: MODEL.api,
        provider: MODEL.provider,
        model: MODEL.id,
        usage: {
          input: 0,
          output: 0,
          cacheRead: 0,
          cacheWrite: 0,
          totalTokens: 0,
          cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
        },
        stopReason: "stop",
        timestamp: Date.now(),
      } as AgentMessage;
    });
}

async function imageUrlToBase64(imageUrl: string): Promise<{ data: string; mimeType: string } | null> {
  try {
    // imageUrl is like "/api/assets/chat/xxx.jpg"
    // Need to resolve to full URL for fetch
    const url = imageUrl.startsWith("http") ? imageUrl : `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}${imageUrl}`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const buffer = Buffer.from(await res.arrayBuffer());
    const base64 = buffer.toString("base64");
    const contentType = res.headers.get("content-type") || "image/jpeg";
    return { data: base64, mimeType: contentType };
  } catch {
    return null;
  }
}

function sse(data: unknown): string {
  return `data: ${JSON.stringify(data)}\n\n`;
}

// ---------------------------------------------------------------------------
// Agent Loop Helpers
// ---------------------------------------------------------------------------

/**
 * ConvertToLlm: Strip planning text from assistant messages that contain
 * tool calls. When the LLM says "让我查一下..." alongside a toolCall, the
 * text is useless for downstream reasoning but wastes tokens.
 */
function convertToLlm(messages: AgentMessage[]): Message[] {
  return messages.map((m) => {
    if (m.role === "assistant") {
      const hasToolCall = m.content.some((c) => c.type === "toolCall");
      if (hasToolCall) {
        // Keep only toolCall blocks, discard text/thinking blocks
        return {
          ...m,
          content: m.content.filter((c) => c.type === "toolCall"),
        } as Message;
      }
    }
    return m as Message;
  });
}

/**
 * Three-Layer Context Compression (P4)
 * Layer 1: Keep recent messages verbatim
 * Layer 2: Summarize middle messages
 * Layer 3: Compress oldest messages into one-liner
 */
const COMPRESSION_SETTINGS = {
  enabled: true,
  reserveTokens: 28000,
  layer1KeepTokens: 40000,
  layer2SummarizeTokens: 30000,
  layer3CompressTokens: 20000,
};

async function transformContext(
  messages: AgentMessage[],
  signal?: AbortSignal
): Promise<AgentMessage[]> {
  const estimate = estimateContextTokens(messages);
  const needsCompact = shouldCompact(
    estimate.tokens,
    MODEL.contextWindow,
    {
      enabled: COMPRESSION_SETTINGS.enabled,
      reserveTokens: COMPRESSION_SETTINGS.reserveTokens,
      keepRecentTokens: COMPRESSION_SETTINGS.layer1KeepTokens,
    }
  );

  if (!needsCompact) return messages;

  const partitions = partitionMessagesIntoLayers(messages);
  const layer1 = partitions.layer1;

  let layer2Result: AgentMessage[] = [];
  if (partitions.layer2.length > 0) {
    const summary = await summarizeMessages(partitions.layer2, signal);
    if (summary) {
      layer2Result = [
        {
          role: "user",
          content: `[对话摘要] ${summary}`,
          timestamp: Date.now(),
        } as AgentMessage,
      ];
    }
  }

  let layer3Result: AgentMessage[] = [];
  if (partitions.layer3.length > 0) {
    const compression = await compressMessages(partitions.layer3, signal);
    if (compression) {
      layer3Result = [
        {
          role: "user",
          content: `[历史概述] ${compression}`,
          timestamp: Date.now(),
        } as AgentMessage,
      ];
    }
  }

  if (signal?.aborted) return messages;
  return [...layer3Result, ...layer2Result, ...layer1];
}

function partitionMessagesIntoLayers(
  messages: AgentMessage[]
): {
  layer1: AgentMessage[];
  layer2: AgentMessage[];
  layer3: AgentMessage[];
} {
  let layer1Tokens = 0;
  let layer2Tokens = 0;
  const layer1: AgentMessage[] = [];
  const layer2: AgentMessage[] = [];
  const layer3: AgentMessage[] = [];

  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    const msgTokens = estimateTokens(msg);
    if (
      layer1Tokens + msgTokens <= COMPRESSION_SETTINGS.layer1KeepTokens ||
      layer1.length === 0
    ) {
      layer1.unshift(msg);
      layer1Tokens += msgTokens;
    } else {
      break;
    }
  }

  const layer1Start = messages.length - layer1.length;
  for (let i = layer1Start - 1; i >= 0; i--) {
    const msg = messages[i];
    const msgTokens = estimateTokens(msg);
    if (
      layer2Tokens + msgTokens <= COMPRESSION_SETTINGS.layer2SummarizeTokens ||
      layer2.length === 0
    ) {
      layer2.unshift(msg);
      layer2Tokens += msgTokens;
    } else {
      layer3.unshift(...messages.slice(0, i + 1));
      break;
    }
  }

  return { layer1, layer2, layer3 };
}

async function summarizeMessages(
  messages: AgentMessage[],
  signal?: AbortSignal
): Promise<string | null> {
  if (messages.length === 0 || signal?.aborted) return null;
  const text = messages
    .map((m) => {
      if (m.role === "user") return `用户：${m.content}`;
      if (m.role === "assistant") {
        return `助手：${m.content
          .filter((c) => c.type === "text")
          .map((c) => (c as { text: string }).text)
          .join("")}`;
      }
      return "";
    })
    .filter(Boolean)
    .join("\n\n");

  try {
    const response = await completeSimple(
      MODEL,
      {
        systemPrompt:
          "你是对话摘要助手。保留关键决策和结果，删除闲聊。只输出摘要。",
        messages: [
          {
            role: "user",
            content: `请摘要以下对话（不超过500字）：\n\n${text}`,
            timestamp: Date.now(),
          },
        ],
      },
      {
        maxTokens: 800,
        signal,
        apiKey: process.env.AIPING_API_KEY,
        onPayload: (p) => ({
          ...(p as Record<string, unknown>),
          ...EXTRA_BODY,
        }),
      }
    );
    if (response.stopReason !== "stop") return null;
    return response.content
      .filter((c) => c.type === "text")
      .map((c) => c.text)
      .join("")
      .trim();
  } catch {
    return null;
  }
}

async function compressMessages(
  messages: AgentMessage[],
  signal?: AbortSignal
): Promise<string | null> {
  if (messages.length === 0 || signal?.aborted) return null;
  const text = messages
    .map((m) => {
      if (m.role === "user") return `用户：${m.content}`;
      if (m.role === "assistant") {
        return `助手：${m.content
          .filter((c) => c.type === "text")
          .map((c) => (c as { text: string }).text)
          .join("")}`;
      }
      return "";
    })
    .filter(Boolean)
    .join("\n\n");

  try {
    const response = await completeSimple(
      MODEL,
      {
        systemPrompt: "你是极度压缩助手。只输出一句话概述。",
        messages: [
          {
            role: "user",
            content: `用一句话概括以下对话（不超过100字）：\n\n${text}`,
            timestamp: Date.now(),
          },
        ],
      },
      {
        maxTokens: 200,
        signal,
        apiKey: process.env.AIPING_API_KEY,
        onPayload: (p) => ({
          ...(p as Record<string, unknown>),
          ...EXTRA_BODY,
        }),
      }
    );
    if (response.stopReason !== "stop") return null;
    return response.content
      .filter((c) => c.type === "text")
      .map((c) => c.text)
      .join("")
      .trim();
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  const token = await getAuthCookie();
  if (!token) {
    return new Response(sse({ type: "error", message: "未登录" }), {
      status: 401,
      headers: { "Content-Type": "text/event-stream" },
    });
  }
  const payload = await verifyToken(token);
  if (!payload) {
    return new Response(sse({ type: "error", message: "登录已过期" }), {
      status: 401,
      headers: { "Content-Type": "text/event-stream" },
    });
  }

  // Verify user still exists in DB (handles DB resets)
  const userExists = await prisma.user.findUnique({
    where: { id: payload.userId },
    select: { id: true },
  });
  if (!userExists) {
    return new Response(sse({ type: "error", message: "登录已过期" }), {
      status: 401,
      headers: { "Content-Type": "text/event-stream" },
    });
  }
  const userId = payload.userId;

  let body: { message?: string; sessionId?: string; imageUrl?: string };
  try {
    body = await request.json();
  } catch {
    return new Response(sse({ type: "error", message: "请求体不是合法的 JSON" }), {
      status: 400,
      headers: { "Content-Type": "text/event-stream" },
    });
  }

  const userMessageText = body.message?.trim() || "";
  if (!userMessageText && !body.imageUrl) {
    return new Response(sse({ type: "error", message: "消息不能为空" }), {
      status: 400,
      headers: { "Content-Type": "text/event-stream" },
    });
  }

  // Resolve or create session
  let sessionId = body.sessionId;
  let existingMessages: { role: "user" | "assistant"; text: string; imageUrl?: string | null }[] = [];

  if (sessionId) {
    const session = await prisma.chatSession.findUnique({
      where: { id: sessionId, userId },
      include: {
        messages: { orderBy: { createdAt: "asc" } },
      },
    });
    if (session) {
      existingMessages = session.messages.map((m) => ({
        role: m.role.toLowerCase() as "user" | "assistant",
        text: m.content,
        imageUrl: m.imageUrl,
      }));
    } else {
      sessionId = undefined;
    }
  }

  if (!sessionId) {
    const newSession = await prisma.chatSession.create({
      data: { userId, title: userMessageText.slice(0, 30) },
    });
    sessionId = newSession.id;
  }

  // Persist user message
  const userMessage = await prisma.chatMessage.create({
    data: {
      sessionId,
      role: "user",
      content: userMessageText,
      imageUrl: body.imageUrl || undefined,
    },
  });
  indexChatMessageInBackground({
    id: userMessage.id,
    userId,
    sessionId,
    role: "user",
    content: userMessage.content,
    createdAt: userMessage.createdAt,
  });

  // Keep the session ordering aligned with the latest user-visible message.
  const msgCount = await prisma.chatMessage.count({ where: { sessionId } });
  await prisma.chatSession.update({
    where: { id: sessionId },
    data: {
      updatedAt: new Date(),
      ...(msgCount <= 2 ? { title: userMessageText.slice(0, 30) || "[图片]" } : {}),
    },
  });

  // Create an AbortController that mirrors the request signal
  const abortController = new AbortController();
  request.signal.addEventListener("abort", () => abortController.abort());

  // Fetch user's agent role preference (only for new sessions)
  const userPrefs = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      agentRole: true,
      gender: true,
      heightCm: true,
      weightKg: true,
      targetWeightKg: true,
      targetBodyFatPct: true,
      dailyActiveCalories: true,
      dailyExerciseMinutes: true,
      dailyStepGoal: true,
      dailyActiveHours: true,
      primaryGoal: true,
      primaryGoals: true,
    },
  });

  // Build Alice-style layered context: persona + health goals/data + recent chat + vector memory.
  const [
    answerReferenceContext,
    dietaryContext,
    wearableContext,
    healthProfileContext,
  ] = await Promise.all([
    buildAnswerReferenceContext(userId, userMessageText),
    buildDietaryContext(userId),
    buildWearableContext(userId),
    buildHealthProfileContext(userId),
  ]);
  const timeContext = buildTimeContext();

  const agentRole = userPrefs?.agentRole;
  let normalizedAgentRole: Parameters<typeof buildRoleSystemPrompt>[0] = null;
  if (agentRole && isValidAgentRole(agentRole)) {
    normalizedAgentRole = agentRole;
  }
  const rolePrompt = buildRoleSystemPrompt(normalizedAgentRole);
  const goalParameterSetup = userPrefs
    ? buildGoalParameterSetupState(userPrefs)
    : null;
  const goalParameterPrompt = goalParameterSetup && goalParameterSetup.requiresParameters
    ? goalParameterSetup.missingPrerequisiteFields.length > 0
      ? [
          "目标参数尚未设置完成。",
          "在继续常规建议前，先调用 manage_goal_parameter_setup 的 inspect 确认缺口，然后只追问当前最缺的 1 项基础信息。",
          `当前缺少的基础信息：${goalParameterSetup.missingPrerequisiteFields.join(", ")}。`,
          "等用户回复数字后，立刻调用 manage_goal_parameter_setup 的 save 保存；如果身高、体重和主要目标齐了，再把 applyRecommendations 设为 true。",
        ].join("\n")
      : goalParameterSetup.missingParameterFields.length > 0
        ? [
            "用户的主要目标已经确定，但目标参数还没补齐。",
            "在给深入建议前，先调用 manage_goal_parameter_setup 的 inspect，然后主动邀请用户现在完成剩余目标参数设置。",
            `当前缺少的目标参数：${goalParameterSetup.missingParameterFields.join(", ")}。`,
            "如果用户同意，就调用 manage_goal_parameter_setup 的 save，并优先用 applyRecommendations=true 自动补齐仍为空的参数。",
          ].join("\n")
        : ""
    : "";

  // Onboarding prompt: instruct model to proactively collect/update health profile
  const onboardingPrompt = healthProfileContext
    ? [
        "用户已有部分健康档案。当用户提到新的饮食偏好、过敏、健康状况、职业、作息、烹饪习惯等信息时，",
        "主动调用 manage_onboarding 工具的 save 更新档案；",
        "如果想查看当前档案完整度，可以调用 manage_onboarding 的 inspect。",
        "不要在回复中说'记下来了'却不调用工具——信息只有调用工具才能真正保存。",
      ].join("")
    : [
        "用户还没有健康档案。",
        "当用户提到饮食偏好、食物过敏、健康状况、职业类型、作息、烹饪习惯、口味偏好等个人信息时，",
        "主动调用 manage_onboarding 工具：先用 inspect 查看当前缺口，再追问最缺的 1-2 项，",
        "用户回复后立刻用 save 保存到健康档案。",
        "不要在回复中说'记下来了'却不调用工具——信息只有调用工具才能真正保存。",
      ].join("");

  // Reminder prompt: instruct model to proactively set reminders
  const reminderPrompt = [
    "主动提醒设置（强制）：",
    "当用户在对话中透露任何需要按时执行或定期关注的健康行为时，必须调用 set_medication_reminder 工具创建提醒。",
    "规则：",
    "1. 不要只在回复文本中说'我已经帮你设好了'——如果不调用工具，提醒不会真正创建。",
    "2. 只要用户提到相关内容，立即在回复中生成 toolCall 调用 set_medication_reminder。",
    "3. tool 调用成功后，再在回复文本中告诉用户已设好。",
    "4. startDate 格式必须是 YYYY-MM-DD，reminderTimes 格式必须是 HH:MM（如 08:00）。",
    "",
    "触发场景：",
    "- 用药：'医生给我开了降压药'、'每天要吃维生素' → 设 daily 用药提醒",
    "- 监测：'最近血压有点高，要每天测' → 设 daily 监测提醒",
    "- 复诊：'下周三要去复查'、'一个月后复诊' → 设 weekly/custom 提醒，endDate 为复诊日期",
    "- 恢复：'上周做了手术'、'感冒发烧了' → 设 daily/twice_daily 恢复关怀提醒",
    "- 健身/运动计划：'明早八点去健身' → 设 daily 运动提醒",
  ].join("\n");

  // Layered context blocks (ordered: time → role → goals → onboarding → reminder → wearable → dietary → profile → memories)
  const contextParts = [
    timeContext,
    rolePrompt,
    goalParameterPrompt || null,
    onboardingPrompt || null,
    reminderPrompt,
    wearableContext || null,
    dietaryContext,
    healthProfileContext || null,
    answerReferenceContext,
  ].filter(Boolean) as string[];

  // Load and inject skills into system prompt
  const skills = await loadChatSkills();
  const skillsText = formatSkillsForSystemPrompt(skills);
  if (skillsText) {
    contextParts.push(skillsText);
  }

  // Quick reply guidance
  contextParts.push(
    "当你需要用户提供更多信息才能给出准确建议时（例如：询问症状部位、饮食偏好、目标类型、时间安排等），" +
    "调用 ask_for_more_info 工具，提供 2-4 个简短选项。" +
    "在你的回复文本中自然地提出问题，选项会以按钮形式显示在回复下方供用户点击。" +
    "不要在回复文本中重复列举选项内容。"
  );

  const systemPrompt = await buildSystemPrompt(
    contextParts.join("\n\n"),
    userId
  );

  const userTools = createTools(userId);

  const agent = new Agent({
    initialState: {
      systemPrompt,
      model: MODEL,
      thinkingLevel: "medium",
      tools: userTools,
      messages: wireToAgentMsgs(existingMessages),
    },
    onPayload: (payload) => {
      const final = { ...(payload as Record<string, unknown>), ...EXTRA_BODY } as Record<string, unknown>;
      console.log("[API Payload] keys:", Object.keys(final).filter(k => k.includes('think') || k.includes('reason') || k.includes('enable')));
      console.log("[API Payload] enable_thinking:", final["enable_thinking"], "reasoning_effort:", final["reasoning_effort"], "thinkingFormat:", MODEL.compat?.thinkingFormat);
      return final;
    },
    onResponse: (response) => {
      console.log("[API Response] status:", response.status, "headers:", JSON.stringify(response.headers));
    },
    getApiKey: () => process.env.AIPING_API_KEY,
    convertToLlm,
    transformContext,
  });

  // Accumulate assistant text / reasoning for DB persistence
  let assistantText = "";
  let assistantReasoning = "";
  const collectedPostCards: unknown[] = [];
  let assistantModel = "";
  let assistantTokens = { input: 0, output: 0 };
  let persisted = false;

  async function persistAssistant() {
    if (persisted || !assistantText.trim()) return;
    persisted = true;
    const assistantMessage = await prisma.chatMessage.create({
      data: {
        sessionId: sessionId!,
        role: "assistant",
        content: assistantText.trim(),
        model: assistantModel || undefined,
        inputTokens: assistantTokens.input || undefined,
        outputTokens: assistantTokens.output || undefined,
        reasoning: assistantReasoning || undefined,
        toolCallsJson: toolExecutions.length > 0 ? JSON.stringify(toolExecutions) : undefined,
        postCardsJson: collectedPostCards.length > 0 ? JSON.stringify(collectedPostCards) : undefined,
      },
    });
    indexChatMessageInBackground({
      id: assistantMessage.id,
      userId,
      sessionId: sessionId!,
      role: "assistant",
      content: assistantMessage.content,
      createdAt: assistantMessage.createdAt,
    });
    await prisma.chatSession.update({
      where: { id: sessionId! },
      data: { updatedAt: new Date() },
    });
  }

  // Track tool executions for UI display
  const toolExecutions: Array<{
    id: string;
    name: string;
    label: string;
    status: "running" | "done" | "error";
    result?: string;
  }> = [];

  const MAX_TURNS = 20;
  let turnCount = 0;

  const readable = new ReadableStream<string>({
    async start(controller) {
      // Send session ID immediately
      controller.enqueue(sse({ type: "session", sessionId }));

      // Subscribe to agent events
      agent.subscribe(async (event: AgentEvent) => {
        switch (event.type) {
          case "agent_start": {
            controller.enqueue(sse({ type: "agent_start" }));
            break;
          }
          case "agent_end": {
            // Persist assistant message
            await persistAssistant();

            const allMessages = agent.state.messages.slice();
            const apiKey = process.env.AIPING_API_KEY!;

            // P2: Fire-and-forget persona memory extraction
            extractAndUpdatePersona(payload.userId, allMessages, apiKey)
              .catch((err) => console.error("[Persona] Background extraction error:", err));

            // P2-Dietary: Fire-and-forget dietary extraction + evaluation
            extractAndUpdateDietaryLog(payload.userId, allMessages, apiKey)
              .catch((err) => console.error("[Dietary] Background extraction error:", err));

            controller.enqueue(sse({ type: "agent_end" }));
            controller.close();
            break;
          }
          case "turn_start": {
            controller.enqueue(sse({ type: "turn_start" }));
            break;
          }
          case "turn_end": {
            turnCount++;
            controller.enqueue(sse({ type: "turn_end", turnCount }));
            if (turnCount >= MAX_TURNS) {
              controller.enqueue(
                sse({
                  type: "error",
                  message: `已达到最大对话轮次限制（${MAX_TURNS} 轮），请稍后重试。`,
                })
              );
              agent.abort();
            }
            break;
          }
          case "message_start": {
            const wire = agentMsgToWire(event.message);
            if (wire) {
              controller.enqueue(sse({ type: "message_start", message: wire }));
            }
            break;
          }
          case "message_update": {
            console.log("[msg_update]", event.assistantMessageEvent.type);
            if (event.assistantMessageEvent.type === "text_delta") {
              const delta = event.assistantMessageEvent.delta;
              assistantText += delta;
              controller.enqueue(sse({ type: "text_delta", delta }));
            }
            if (event.assistantMessageEvent.type === "thinking_delta") {
              const delta = (event.assistantMessageEvent as { delta: string }).delta;
              console.log("[thinking_delta]", delta.slice(0, 50));
              assistantReasoning += delta;
              controller.enqueue(sse({ type: "reasoning_delta", delta }));
            }
            if (event.assistantMessageEvent.type === "thinking_end") {
              const content = (event.assistantMessageEvent as { content: string }).content;
              console.log("[thinking_end]", content?.slice(0, 50));
              if (content && !assistantReasoning) {
                assistantReasoning = content;
              }
            }
            break;
          }
          case "message_end": {
            const wire = agentMsgToWire(event.message);
            if (wire?.role === "assistant") {
              const msg = event.message as Extract<AgentMessage, { role: "assistant" }>;
              assistantModel = msg.model ?? "";
              assistantTokens = {
                input: msg.usage?.input ?? 0,
                output: msg.usage?.output ?? 0,
              };
              // Fallback: extract thinking from message content if delta events missed it
              if (!assistantReasoning) {
                const thinkingParts = msg.content
                  .filter((c) => c.type === "thinking")
                  .map((c) => (c as { thinking: string }).thinking);
                if (thinkingParts.length > 0) {
                  assistantReasoning = thinkingParts.join("");
                }
              }
            }
            if (wire) {
              controller.enqueue(sse({ type: "message_end", message: wire }));
            }
            break;
          }
          case "tool_execution_start": {
            const tool = userTools.find((t) => t.name === event.toolName);
            const exec = {
              id: event.toolCallId,
              name: event.toolName,
              label: tool?.label ?? event.toolName,
              status: "running" as const,
            };
            toolExecutions.push(exec);
            controller.enqueue(sse({ type: "tool_start", tool: exec }));
            break;
          }
          case "tool_execution_end": {
            const idx = toolExecutions.findIndex((t) => t.id === event.toolCallId);
            if (idx !== -1) {
              toolExecutions[idx].status = event.isError ? "error" : "done";
              const result = event.result as AgentToolResult<unknown> | undefined;
              const text = result?.content
                ?.filter((c) => c.type === "text")
                .map((c) => (c as { text: string }).text)
                .join("")
                .slice(0, 200);
              toolExecutions[idx].result = text ?? "";
              const ssePayload: Record<string, unknown> = {
                type: "tool_end",
                tool: toolExecutions[idx],
              };
              // Pass web_search sources to the client for the sources drawer
              if (toolExecutions[idx].name === "web_search" && !event.isError) {
                const details = (result as { details?: { results?: unknown[] } } | undefined)?.details;
                if (details?.results) ssePayload.sources = details.results;
              }
              // Pass quick reply options to the client
              if (toolExecutions[idx].name === "ask_for_more_info" && !event.isError) {
                const details = (result as { details?: { options?: string[] } } | undefined)?.details;
                if (details?.options) ssePayload.quickReplies = details.options;
              }
              // Pass post cards to the client for inline rendering
              if (toolExecutions[idx].name === "search_posts" && !event.isError) {
                const posts = (result as { details?: unknown[] } | undefined)?.details;
                if (Array.isArray(posts) && posts.length > 0) {
                  ssePayload.postCards = posts;
                  collectedPostCards.push(...posts);
                }
              }
              controller.enqueue(sse(ssePayload));
            }
            break;
          }
        }
      });

      // Prepare image content for current message if present
      let imageContent: { type: "image"; data: string; mimeType: string }[] | undefined;
      if (body.imageUrl) {
        const img = await imageUrlToBase64(body.imageUrl);
        if (img) {
          imageContent = [{ type: "image", data: img.data, mimeType: img.mimeType }];
        }
      }

      try {
        await agent.prompt(userMessageText, imageContent);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "未知错误";
        controller.enqueue(sse({ type: "error", message: msg }));
        controller.close();
      }
    },
    cancel() {
      abortController.abort();
      agent.abort();
      persistAssistant().catch(console.error);
    },
  });

  return new Response(readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}

