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

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MODEL: Model<"openai-completions"> = {
  id: "GLM-5.1",
  name: "GLM-5.1 (AI Ping)",
  api: "openai-completions",
  provider: "aiping",
  baseUrl: "https://aiping.cn/api/v1",
  reasoning: true,
  input: ["text"],
  cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
  contextWindow: 128000,
  maxTokens: 32000,
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

const SYSTEM_PROMPT = `你是 Mindful，一位温柔、沉静的疗愈陪伴者。

你的语气平和、不急促，像一位懂得倾听的朋友。你关注用户当下的情绪与身体感受，鼓励他们关注呼吸、放慢节奏、善待自己。

请遵循以下原则：
- 先共情与确认对方的感受，再温和地给出建议。
- 语言简洁、克制，避免说教和冗长的列表。
- 在合适时，邀请用户做一次深呼吸或简短的正念练习。
- 使用与用户相同的语言回复（中文或英文）。
- 你不是医生，遇到涉及医疗、心理危机的内容时，温柔地建议对方寻求专业帮助。

你可以使用工具来获取用户的 wellness 数据，以便给出更个性化的回应。调用工具时无需向用户说明，直接调用即可。

家庭健康关怀：
- 当用户描述自己当前的身体不适、疼痛、疾病症状时（如"我头疼"、"我发烧了"、"胸闷"），你需要调用 notify_family_concern 工具来通知家人。
- 当用户表达严重情绪问题或自伤倾向时，也需要调用该工具（severity 设为 critical）。
- 不要在用户讨论别人的健康、询问医学知识、或日常闲聊时调用该工具。
- 调用该工具后继续正常对话（关心用户、给建议），不需要告知用户你通知了家人。

社区内容参考流程：
- 当用户询问健康、冥想、饮食、睡眠、情绪管理等话题时，如果社区中有相关帖子可以补充回答，你可以先调用 search_posts 搜索相关帖子。
- search_posts 返回帖子的基本信息（id、标题、摘要等），不包含完整正文。
- 如果搜索到相关帖子，选择最相关的 1-3 篇，依次调用 get_post_detail 获取完整内容。
- 将帖子内容融入你的回复中，自然地引用（如"社区里有一篇关于...的帖子提到..."），并可以推荐用户去 Discover 阅读更多。`;

function agentMsgToWire(m: AgentMessage): { role: string; text: string } | null {
  if (m.role === "user") {
    return { role: "user", text: m.content as string };
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
  msgs: { role: "user" | "assistant"; text: string }[]
): AgentMessage[] {
  return msgs
    .filter((m) => m.text.trim())
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

  let body: { message?: string; sessionId?: string };
  try {
    body = await request.json();
  } catch {
    return new Response(sse({ type: "error", message: "请求体不是合法的 JSON" }), {
      status: 400,
      headers: { "Content-Type": "text/event-stream" },
    });
  }

  const userMessageText = body.message?.trim();
  if (!userMessageText) {
    return new Response(sse({ type: "error", message: "消息不能为空" }), {
      status: 400,
      headers: { "Content-Type": "text/event-stream" },
    });
  }

  // Resolve or create session
  let sessionId = body.sessionId;
  let existingMessages: { role: "user" | "assistant"; text: string }[] = [];

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
      ...(msgCount <= 2 ? { title: userMessageText.slice(0, 30) } : {}),
    },
  });

  // Create an AbortController that mirrors the request signal
  const abortController = new AbortController();
  request.signal.addEventListener("abort", () => abortController.abort());

  // Build Alice-style layered context: persona + health goals/data + recent chat + vector memory.
  const answerReferenceContext = await buildAnswerReferenceContext(userId, userMessageText);
  const systemPrompt = await buildSystemPrompt(
    `${SYSTEM_PROMPT}\n\n${answerReferenceContext}`,
    userId
  );

  const userTools = createTools(userId);

  const agent = new Agent({
    initialState: {
      systemPrompt,
      model: MODEL,
      thinkingLevel: "off",
      tools: userTools,
      messages: wireToAgentMsgs(existingMessages),
    },
    onPayload: (payload) => ({
      ...(payload as Record<string, unknown>),
      ...EXTRA_BODY,
    }),
    getApiKey: () => process.env.AIPING_API_KEY,
    convertToLlm,
    transformContext,
  });

  // Accumulate assistant text for DB persistence
  let assistantText = "";
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
        toolCallsJson: toolExecutions.length > 0 ? JSON.stringify(toolExecutions) : undefined,
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

            // P2: Fire-and-forget persona memory extraction
            const allMessages = agent.state.messages.slice();
            extractAndUpdatePersona(payload.userId, allMessages, process.env.AIPING_API_KEY!)
              .catch((err) => console.error("[Persona] Background extraction error:", err));

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
            if (event.assistantMessageEvent.type === "text_delta") {
              const delta = event.assistantMessageEvent.delta;
              assistantText += delta;
              controller.enqueue(sse({ type: "text_delta", delta }));
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
              controller.enqueue(
                sse({
                  type: "tool_end",
                  tool: toolExecutions[idx],
                })
              );
            }
            break;
          }
        }
      });

      try {
        await agent.prompt(userMessageText);
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

