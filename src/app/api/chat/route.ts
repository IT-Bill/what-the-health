import { stream, type Context, type Message, type Model } from "@earendil-works/pi-ai";

// pi-ai uses Node-only APIs (SDK clients, http agents) — force the Node runtime.
export const runtime = "nodejs";
// Always run at request time; never cache chat completions.
export const dynamic = "force-dynamic";

// AI Ping — OpenAI-compatible endpoint serving GLM-5.1.
// Defined as a custom model since it is not a built-in pi-ai provider.
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

// Extra request-body fields the AI Ping API accepts (mirrors the documented
// Python `extra_body`). Merged into the OpenAI payload via `onPayload`.
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

// Wire format exchanged with the client. We keep it minimal (role + text) and
// rebuild the richer pi-ai Context on the server.
export interface ChatWireMessage {
  role: "user" | "assistant";
  text: string;
}

const SYSTEM_PROMPT = `你是 Mindful，一位温柔、沉静的疗愈陪伴者。

你的语气平和、不急促，像一位懂得倾听的朋友。你关注用户当下的情绪与身体感受，鼓励他们关注呼吸、放慢节奏、善待自己。

请遵循以下原则：
- 先共情与确认对方的感受，再温和地给出建议。
- 语言简洁、克制，避免说教和冗长的列表。
- 在合适时，邀请用户做一次深呼吸或简短的正念练习。
- 使用与用户相同的语言回复（中文或英文）。
- 你不是医生，遇到涉及医疗、心理危机的内容时，温柔地建议对方寻求专业帮助。`;

function toPiMessages(messages: ChatWireMessage[]): Message[] {
  return messages
    .filter((m) => m.text.trim().length > 0)
    .map((m) =>
      m.role === "user"
        ? { role: "user", content: m.text, timestamp: Date.now() }
        : {
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
          }
    ) as Message[];
}

export async function POST(request: Request) {
  if (!process.env.AIPING_API_KEY) {
    return new Response(
      JSON.stringify({ error: "服务端未配置 AIPING_API_KEY，无法连接到模型。" }),
      { status: 503, headers: { "Content-Type": "application/json" } }
    );
  }

  let body: { messages?: ChatWireMessage[] };
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: "请求体不是合法的 JSON。" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const messages = body.messages ?? [];
  if (!Array.isArray(messages) || messages.length === 0) {
    return new Response(JSON.stringify({ error: "messages 不能为空。" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const context: Context = {
    systemPrompt: SYSTEM_PROMPT,
    messages: toPiMessages(messages),
  };

  const encoder = new TextEncoder();
  // Propagate client disconnects to the upstream request.
  const abortController = new AbortController();
  request.signal.addEventListener("abort", () => abortController.abort());

  const readable = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        const s = stream(MODEL, context, {
          apiKey: process.env.AIPING_API_KEY,
          signal: abortController.signal,
          // Merge AI Ping's extra_body fields into the OpenAI request payload.
          onPayload: (payload) => ({
            ...(payload as Record<string, unknown>),
            ...EXTRA_BODY,
          }),
        });
        for await (const event of s) {
          if (event.type === "text_delta") {
            controller.enqueue(encoder.encode(event.delta));
          } else if (event.type === "error") {
            const msg = event.error.errorMessage ?? "生成回复时出错。";
            controller.enqueue(encoder.encode(`\n\n⚠️ ${msg}`));
          }
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : "未知错误";
        controller.enqueue(encoder.encode(`\n\n⚠️ ${msg}`));
      } finally {
        controller.close();
      }
    },
    cancel() {
      abortController.abort();
    },
  });

  return new Response(readable, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}
