import { Agent } from "@earendil-works/pi-agent-core";
import type {
  AgentEvent,
  AgentMessage,
  AgentToolResult,
} from "@earendil-works/pi-agent-core";
import type { Model, Message } from "@earendil-works/pi-ai";
import { prisma } from "@/lib/prisma";
import { getAuthCookie, verifyToken } from "@/lib/auth";
import { createTools } from "./tools";

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

你可以使用工具来获取用户的 wellness 数据，以便给出更个性化的回应。在调用工具前先简单说明你在做什么。`;

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
      where: { id: sessionId, userId: payload.userId },
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
      data: { userId: payload.userId, title: userMessageText.slice(0, 30) },
    });
    sessionId = newSession.id;
  }

  // Persist user message
  await prisma.chatMessage.create({
    data: {
      sessionId,
      role: "user",
      content: userMessageText,
    },
  });

  // Update session title if first message
  const msgCount = await prisma.chatMessage.count({ where: { sessionId } });
  if (msgCount <= 2) {
    await prisma.chatSession.update({
      where: { id: sessionId },
      data: { title: userMessageText.slice(0, 30) },
    });
  }

  // Create an AbortController that mirrors the request signal
  const abortController = new AbortController();
  request.signal.addEventListener("abort", () => abortController.abort());

  const userTools = createTools(payload.userId);

  const agent = new Agent({
    initialState: {
      systemPrompt: SYSTEM_PROMPT,
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
  });

  // Accumulate assistant text for DB persistence
  let assistantText = "";
  let assistantModel = "";
  let assistantTokens = { input: 0, output: 0 };

  // Track tool executions for UI display
  const toolExecutions: Array<{
    id: string;
    name: string;
    label: string;
    status: "running" | "done" | "error";
    result?: string;
  }> = [];

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
            if (assistantText.trim()) {
              await prisma.chatMessage.create({
                data: {
                  sessionId: sessionId!,
                  role: "assistant",
                  content: assistantText.trim(),
                  model: assistantModel || undefined,
                  inputTokens: assistantTokens.input || undefined,
                  outputTokens: assistantTokens.output || undefined,
                },
              });
              await prisma.chatSession.update({
                where: { id: sessionId! },
                data: { updatedAt: new Date() },
              });
            }
            controller.enqueue(sse({ type: "agent_end" }));
            controller.close();
            break;
          }
          case "turn_start": {
            controller.enqueue(sse({ type: "turn_start" }));
            break;
          }
          case "turn_end": {
            controller.enqueue(sse({ type: "turn_end" }));
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
