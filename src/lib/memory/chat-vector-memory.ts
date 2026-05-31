import { embedTextWithBailian } from "@/lib/embeddings/bailian";
import { prisma } from "@/lib/prisma";
import { upsertVectorDocument } from "@/lib/vector/pgvector";
import { MEMORY_VECTOR_NAMESPACE } from "./constants";

type ChatVectorRole = "user" | "assistant";

export interface ChatMessageVectorInput {
  id?: string;
  userId?: string;
  sessionId: string;
  role: ChatVectorRole;
  content: string;
  createdAt: Date;
}

export function indexChatMessageInBackground(input: Required<ChatMessageVectorInput>): void {
  indexChatMessageVector(input).catch((error) => {
    console.error("[Memory] Chat vector index failed:", error);
  });
}

export async function indexChatMessageVector(input: Required<ChatMessageVectorInput>): Promise<void> {
  const content = buildChatMessageVectorContent(input);
  const embedding = await embedTextWithBailian(content);
  await upsertVectorDocument(
    {
      namespace: MEMORY_VECTOR_NAMESPACE,
      sourceId: input.id,
      userId: input.userId,
      title: `chat-${input.role}`,
      content,
      metadata: {
        source: "chat-message",
        chatMessageId: input.id,
        sessionId: input.sessionId,
        role: input.role,
        createdAt: input.createdAt.toISOString(),
      },
    },
    embedding
  );
}

export async function backfillChatMessagesToVectorMemory(limit = 500): Promise<number> {
  const messages = await prisma.chatMessage.findMany({
    where: {
      content: { not: "" },
      role: { in: ["user", "assistant"] },
    },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      sessionId: true,
      role: true,
      content: true,
      createdAt: true,
      session: {
        select: { userId: true },
      },
    },
  });

  let indexed = 0;
  for (const message of messages) {
    const text = message.content.trim();
    if (!text) continue;
    await indexChatMessageVector({
      id: message.id,
      userId: message.session.userId,
      sessionId: message.sessionId,
      role: message.role.toLowerCase() as ChatVectorRole,
      content: text,
      createdAt: message.createdAt,
    });
    indexed += 1;
  }
  return indexed;
}

export function buildChatMessageVectorContent(input: ChatMessageVectorInput): string {
  const text = input.content.trim();
  return [
    "来源：chat-message",
    `会话：${input.sessionId}`,
    `角色：${input.role}`,
    `时间：${input.createdAt.toISOString()}`,
    `内容：${text.length > 4000 ? `${text.slice(0, 4000)}...` : text}`,
  ].join("\n");
}
