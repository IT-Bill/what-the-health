# Agent 开发指南

本项目使用 `@earendil-works/pi-agent-core` + `@earendil-works/pi-ai` 构建 AI 对话系统。本文档覆盖 Agent 的完整用法，包括工具开发、上下文管理、事件处理等。

## 架构概览

```
用户消息 → POST /api/chat
         → 加载 Session + 历史消息
         → buildSystemPrompt（注入 Persona）
         → new Agent({ initialState, tools, ... })
         → agent.subscribe(event => SSE)
         → agent.prompt(text)
         → Agent 循环：LLM → 工具调用 → LLM → ... → 最终回复
         → 持久化助手消息
         → fire-and-forget: Persona 提取
```

## 核心依赖

| 包 | 版本 | 用途 |
|---|---|---|
| `@earendil-works/pi-ai` | 0.78.0 | LLM 统一抽象层（支持 20+ provider） |
| `@earendil-works/pi-agent-core` | 0.78.0 | 有状态 Agent 框架（工具循环、事件流、上下文压缩） |

## Model 配置

```typescript
import type { Model } from "@earendil-works/pi-ai";

const MODEL: Model<"openai-completions"> = {
  id: "GLM-5.1",
  name: "GLM-5.1 (AI Ping)",
  api: "openai-completions",       // OpenAI Chat Completions 协议
  provider: "aiping",
  baseUrl: "https://aiping.cn/api/v1",
  reasoning: true,                  // 该模型支持 reasoning
  input: ["text"],                  // 支持的输入类型
  cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
  contextWindow: 128000,
  maxTokens: 32000,
};
```

**注意**：`reasoning: true` 的模型会消耗大量 token 在 reasoning 上。如果只需要简单回答（如 YES/NO 判断），可以单独定义一个 `reasoning: false` 的模型配置（参见 persona-service.ts 中的 `MEMORY_MODEL`）。

## Agent 实例化

```typescript
import { Agent } from "@earendil-works/pi-agent-core";

const agent = new Agent({
  initialState: {
    systemPrompt,          // 系统提示词（含 Persona）
    model: MODEL,
    thinkingLevel: "off",  // 关闭思考展示
    tools: userTools,      // AgentTool[] 数组
    messages: existingMessages, // 历史对话消息
  },
  onPayload: (payload) => ({    // 注入额外请求参数
    ...(payload as Record<string, unknown>),
    ...EXTRA_BODY,
  }),
  getApiKey: () => process.env.AIPING_API_KEY,
  convertToLlm,           // 消息转换钩子
  transformContext,        // 上下文压缩钩子
});
```

### 关键选项说明

| 选项 | 类型 | 用途 |
|------|------|------|
| `initialState.systemPrompt` | `string` | Agent 的角色设定和行为指引 |
| `initialState.tools` | `AgentTool[]` | Agent 可调用的工具列表 |
| `initialState.messages` | `AgentMessage[]` | 历史对话（种子上下文） |
| `onPayload` | `(payload) => payload` | 在每次 LLM 请求前修改 request body |
| `getApiKey` | `() => string` | API key 提供函数 |
| `convertToLlm` | `(AgentMessage[]) => Message[]` | 发送给 LLM 前的消息转换 |
| `transformContext` | `(AgentMessage[]) => AgentMessage[]` | 上下文超长时的压缩策略 |

## 工具开发（AgentTool）

### 基本结构

```typescript
import { Type } from "@sinclair/typebox";
import type { AgentTool } from "@earendil-works/pi-agent-core";

const myTool: AgentTool = {
  name: "tool_name",               // LLM 调用时的标识符
  label: "工具显示名",              // 前端 UI 展示
  description: "告诉 LLM 什么时候该使用这个工具，以及它能做什么。",
  parameters: Type.Object({        // TypeBox JSON Schema
    param1: Type.String({ description: "参数说明" }),
    param2: Type.Optional(Type.Number({ description: "可选参数" })),
  }),
  execute: async (toolCallId, params, signal?, onUpdate?) => {
    // params 已按 parameters schema 验证
    const { param1, param2 } = params as { param1: string; param2?: number };

    // 执行逻辑（DB 查询、API 调用等）
    const result = await doSomething(param1);

    return {
      content: [{ type: "text", text: JSON.stringify(result) }],  // 返回给 LLM
      details: result,  // 日志/UI 用
    };
  },
};
```

### 返回值

```typescript
interface AgentToolResult<T> {
  content: (TextContent | ImageContent)[];  // 必须。LLM 会看到的内容
  details: T;                               // 可选。结构化数据（给日志/前端）
  terminate?: boolean;                      // 可选。true = 终止 Agent 循环
}
```

**`content`** 是 LLM 看到的工具执行结果。通常是 JSON 字符串。LLM 会根据这个内容决定下一步（继续调工具、还是生成最终回复）。

### 参数 Schema（TypeBox）

```typescript
import { Type } from "@sinclair/typebox";

// 基本类型
Type.String({ description: "..." })
Type.Number({ description: "..." })
Type.Boolean()
Type.Optional(Type.String())      // 可选参数

// 枚举
Type.Union([
  Type.Literal("weekly"),
  Type.Literal("monthly"),
])

// 嵌套对象
Type.Object({
  query: Type.Optional(Type.String()),
  limit: Type.Number({ default: 10 }),
})
```

### 工具设计原则

1. **description 决定一切**：LLM 完全基于 description 决定何时调用工具。写清楚触发条件和预期行为。
2. **返回有用的信息**：content 应包含 LLM 可以用来生成回复的数据。
3. **读写分离**：大多数工具是只读查询。写操作工具（如 `create_journal_entry`、`notify_family_concern`）要在 description 中明确说明副作用。
4. **不要在 execute 中做 LLM 调用**：Agent 循环本身就是 LLM 驱动的，工具应该是确定性操作。
5. **静默调用**：System prompt 中告诉 Agent"调用工具时无需向用户说明"，让体验自然。

### 示例：只读查询工具

```typescript
const getRecentMoodCheckinsTool: AgentTool = {
  name: "get_recent_mood_checkins",
  label: "获取情绪记录",
  description: "获取用户最近的情绪打卡记录，了解其近期的情绪变化趋势。",
  parameters: Type.Object({
    limit: Type.Number({ description: "获取条数，默认 7", default: 7 }),
  }),
  execute: async (_toolCallId, params) => {
    const { limit } = params as { limit: number };
    const checkins = await prisma.moodCheckin.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
    return {
      content: [{ type: "text", text: JSON.stringify(checkins) }],
      details: checkins,
    };
  },
};
```

### 示例：写操作工具

```typescript
const notifyFamilyConcernTool: AgentTool = {
  name: "notify_family_concern",
  label: "通知家人健康关注",
  description:
    "当用户在对话中表达了自身的健康问题、身体不适、或严重情绪问题时，调用此工具通知其家庭成员。" +
    "只在用户确实在描述自己当前的健康状况时使用。" +
    "severity: info=轻微不适, warning=明确症状, critical=紧急/自伤",
  parameters: Type.Object({
    title: Type.String({ description: "15字以内的简短标题" }),
    content: Type.String({ description: "50字以内的说明，给家人看" }),
    severity: Type.Union([
      Type.Literal("info"),
      Type.Literal("warning"),
      Type.Literal("critical"),
    ]),
  }),
  execute: async (_toolCallId, params) => {
    const { title, content, severity } = params as { ... };
    // ... 创建 alert + 发送 notification ...
    return {
      content: [{ type: "text", text: `已通知 ${count} 位家庭成员。` }],
      details: { notified: true, count },
    };
  },
};
```

## System Prompt 设计

System prompt 决定了 Agent 的行为模式。关键设计：

```typescript
const SYSTEM_PROMPT = `你是 Mindful，一位温柔、沉静的疗愈陪伴者。

<!-- 角色设定 -->
你的语气平和、不急促，像一位懂得倾听的朋友。

<!-- 行为规则 -->
请遵循以下原则：
- 先共情与确认对方的感受，再温和地给出建议。
- 使用与用户相同的语言回复。

<!-- 工具使用指引 -->
你可以使用工具来获取用户的 wellness 数据。调用工具时无需向用户说明，直接调用即可。

<!-- 特定工具的触发条件 -->
家庭健康关怀：
- 当用户描述自己的身体不适时，调用 notify_family_concern 通知家人。
- 不要在用户讨论别人的健康问题时调用。
- 调用后继续正常对话，不需要告知用户。

<!-- 社区帖子引用流程 -->
社区内容参考流程：
- 先 search_posts → 再 get_post_detail → 融入回复`;
```

### Prompt 设计原则

1. **角色 → 规则 → 工具指引**：从大到小，先定义谁，再定义怎么做，最后定义什么时候用工具。
2. **工具触发条件要具体**：不要只说"在需要时调用"，要写清楚具体场景和反例。
3. **Persona 追加注入**：`buildSystemPrompt()` 会在基础 prompt 末尾追加用户画像信息。

## 上下文管理

### 三层压缩策略

当对话历史超过 context window 时，`transformContext` 自动压缩：

```
┌─────────────────────────────────────────────────┐
│ Layer 3 (最早)  │ Layer 2 (中间)   │ Layer 1 (最近)   │
│ ~20k tokens     │ ~30k tokens      │ ~40k tokens      │
│ 极度压缩→1句话  │ LLM摘要→500字    │ 原文保留          │
└─────────────────────────────────────────────────┘
```

配置：
```typescript
const COMPRESSION_SETTINGS = {
  enabled: true,
  reserveTokens: 28000,        // 为回复预留的 token
  layer1KeepTokens: 40000,     // 最近的对话保留多少
  layer2SummarizeTokens: 30000,// 中间部分用 LLM 摘要
  layer3CompressTokens: 20000, // 最早部分极度压缩
};
```

### convertToLlm 优化

Agent 在对话中调用工具时可能生成"让我查一下..."之类的过渡文本。这些文本在后续轮次中浪费 token。`convertToLlm` 函数在发送给 LLM 前剥离这些内容：

```typescript
function convertToLlm(messages: AgentMessage[]): Message[] {
  return messages.map((m) => {
    if (m.role === "assistant") {
      const hasToolCall = m.content.some((c) => c.type === "toolCall");
      if (hasToolCall) {
        // 只保留 toolCall 块，丢弃 text/thinking
        return { ...m, content: m.content.filter((c) => c.type === "toolCall") };
      }
    }
    return m;
  });
}
```

## 事件系统（SSE 流）

Agent 运行期间产生事件，通过 SSE 推送给前端：

| 事件类型 | 时机 | 前端处理 |
|---------|------|---------|
| `session` | 首次（stream 开始前） | 获取 sessionId |
| `agent_start` | Agent 开始推理 | 显示 loading |
| `text_delta` | 流式文本增量 | 逐字渲染回复 |
| `reasoning_delta` | 思考过程增量 | 展示思考过程（可选） |
| `tool_start` | 工具开始执行 | 显示"正在查询..." |
| `tool_end` | 工具执行完毕 | 隐藏工具状态 |
| `turn_end` | 一轮结束 | 更新轮次计数 |
| `agent_end` | Agent 完成回复 | 结束 loading |
| `error` | 出错 | 显示错误提示 |

### 前端消费示例

```typescript
const res = await fetch("/api/chat", { method: "POST", body: ... });
const reader = res.body.getReader();
const decoder = new TextDecoder();

while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  const chunk = decoder.decode(value);
  for (const line of chunk.split("\n")) {
    if (!line.startsWith("data: ")) continue;
    const event = JSON.parse(line.slice(6));
    switch (event.type) {
      case "text_delta": appendText(event.text); break;
      case "tool_start": showToolStatus(event.name); break;
      case "agent_end": finishLoading(); break;
    }
  }
}
```

## Persona 系统

### 自动提取流程

每次对话结束后，fire-and-forget 执行：

```
对话内容 → checkForNewInfo(YES/NO?) → extractPersonaUpdates(JSON)
         → mergePersonaUpdates(去重) → capPersonaArrays(上限30)
         → 写入 UserPersona 表
```

### Persona 数据结构

```typescript
interface UserPersonaData {
  identity: {
    lifestyleTags?: string[];  // 如 ["上班族", "运动爱好者"]
    role?: string;
    demographics?: string[];
    notes?: string[];
  };
  behavior: {
    routines?: string[];       // 如 ["早起跑步", "睡前冥想"]
    habitPatterns?: string[];
    stressCoping?: string[];
    triggers?: string[];
  };
  expression: {
    languageStyle?: string[];  // 如 ["简洁", "偏好中文"]
    tonePreferences?: string[];
    patterns?: string[];
  };
  preferences: {
    responseStyle?: string[];  // 如 ["不要太长", "给具体建议"]
    focusAreas?: string[];
    avoid?: string[];
    depth?: string[];
  };
}
```

### 在 System Prompt 中注入

```typescript
const systemPrompt = await buildSystemPrompt(SYSTEM_PROMPT, userId);
// 结果：SYSTEM_PROMPT + "\n\n## 用户画像\n### 你是谁\n- ..." 
```

## 在 Agent 外使用 LLM（completeSimple）

对于简单的 LLM 调用（不需要工具循环），直接用 `completeSimple`：

```typescript
import { completeSimple } from "@earendil-works/pi-ai";

const response = await completeSimple(
  MODEL,
  {
    systemPrompt: "你是一个分类助手。只回答 YES 或 NO。",
    messages: [{ role: "user", content: "...", timestamp: Date.now() }],
  },
  {
    maxTokens: 10,
    apiKey: process.env.AIPING_API_KEY,
    onPayload: (payload) => ({ ...payload, ...EXTRA_BODY }),
  }
);

// response.content 是 (TextContent | ThinkingContent | ToolCall)[] 数组
const text = response.content
  .filter((c) => c.type === "text")
  .map((c) => c.text)
  .join("");
```

**注意**：GLM-5.1 是 reasoning 模型，即使设置 `enable_thinking: false`，仍会消耗大量 token 在 reasoning 上。`completeSimple` 返回时 content 数组可能为空（reasoning 吃掉了所有 token）。解决方案：
1. 给足够的 `maxTokens`（至少 2000+）
2. 或者直接用 `fetch` 调用 API（绕过 pi-ai 的 response 解析问题，参见 `src/lib/report/generator.ts`）

## 直接调用 AI Ping API（备选方案）

当 `completeSimple` 的 response 解析有问题时（如 reasoning 模型返回空 content），可以直接 fetch：

```typescript
const res = await fetch("https://aiping.cn/api/v1/chat/completions", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${process.env.AIPING_API_KEY}`,
  },
  body: JSON.stringify({
    model: "GLM-5.1",
    messages: [
      { role: "system", content: "..." },
      { role: "user", content: "..." },
    ],
    max_tokens: 16000,
  }),
});

const json = await res.json();
const content = json.choices[0].message.content; // 直接拿到 string
```

这个模式用在 `src/lib/report/generator.ts` 中（周报/月报生成），因为 pi-ai 对 reasoning 模型的 response 解析存在 bug（content 数组为空）。

## 错误处理

| 场景 | 处理方式 |
|------|---------|
| LLM 调用失败 | SSE 发送 `{ type: "error", message }` 然后关闭流 |
| 工具执行失败 | 错误信息作为 `content` 返回给 LLM，LLM 可能重试或告知用户 |
| 超过 MAX_TURNS (20) | 发送错误提示，调用 `agent.abort()` |
| 用户断开连接 | `agent.abort()` + 保存已有的部分回复 |
| 上下文压缩失败 | 跳过压缩，使用原始消息（可能导致截断） |
| Persona 提取失败 | 静默记录日志，不影响主流程 |

## 文件结构

```
src/app/api/chat/
├── route.ts           # Agent 主入口（实例化、事件处理、SSE）
├── tools.ts           # 12 个 Agent 工具定义
└── sessions/          # Session 管理 API

src/lib/
├── persona-service.ts # Persona 提取/注入/buildSystemPrompt
├── persona-types.ts   # PersonaData 类型 + personaToSystemPromptText
├── family-alerts.ts   # 家庭预警服务（checkHealthAnomalies, triggerChatConcernAlert）
└── report/
    ├── aggregator.ts  # 报告数据聚合
    └── generator.ts   # LLM 报告生成（直接 fetch）
```

## 开发新工具的步骤

1. 在 `src/app/api/chat/tools.ts` 的 `createTools()` 中定义新工具
2. 写好 `description`（决定 LLM 何时调用）
3. 定义 `parameters`（TypeBox schema）
4. 实现 `execute`（DB 操作 / API 调用）
5. 在 `return [...]` 数组中添加新工具
6. 如需特定触发条件，在 `SYSTEM_PROMPT` 中加入指引
7. 测试：发送相关消息，观察 Agent 是否正确调用工具

## 开发新的 Agent 使用场景

如果需要在非 chat 场景使用 Agent（如定时任务、后台分析）：

```typescript
import { Agent } from "@earendil-works/pi-agent-core";

const agent = new Agent({
  initialState: {
    systemPrompt: "你是一个健康数据分析师...",
    model: MODEL,
    tools: [dataTool1, dataTool2],
    messages: [],
  },
  getApiKey: () => process.env.AIPING_API_KEY,
  onPayload: (p) => ({ ...p, ...EXTRA_BODY }),
});

agent.subscribe((event) => {
  if (event.type === "agent_end") {
    const finalMessages = event.messages;
    // 提取最终回复
  }
});

await agent.prompt("分析用户最近一周的健康数据，找出异常模式");
```
