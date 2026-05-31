import { embedTextWithBailian } from "@/lib/embeddings/bailian";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { upsertVectorDocument } from "@/lib/vector/pgvector";
import { MEMORY_VECTOR_NAMESPACE } from "./constants";

export { MEMORY_VECTOR_NAMESPACE };

type JsonRecord = Record<string, unknown>;

export interface RecordMemoryEventInput {
  userId: string;
  note: string;
  prompt?: string | null;
  source: string;
  sourceId?: string | null;
  metadata?: JsonRecord;
  updatePersona?: boolean;
}

export function rememberInBackground(input: RecordMemoryEventInput): void {
  recordMemoryEvent(input).catch((error) => {
    console.error("[Memory] Background record failed:", error);
  });
}

export async function recordMemoryEvent(input: RecordMemoryEventInput) {
  const memory = await prisma.memory.create({
    data: {
      userId: input.userId,
      note: input.note,
      prompt: input.prompt ?? null,
      source: input.source,
      sourceId: input.sourceId ?? null,
      metadata: (input.metadata ?? {}) as Prisma.InputJsonValue,
    },
  });

  try {
    const content = buildMemoryVectorContent({
      note: input.note,
      prompt: input.prompt,
      source: input.source,
      metadata: input.metadata,
    });
    const embedding = await embedTextWithBailian(content);
    await upsertVectorDocument(
      {
        namespace: MEMORY_VECTOR_NAMESPACE,
        sourceId: memory.id,
        userId: input.userId,
        title: input.source,
        content,
        metadata: {
          memoryId: memory.id,
          source: input.source,
          sourceId: input.sourceId,
          ...(input.metadata ?? {}),
        },
      },
      embedding
    );
  } catch (error) {
    console.warn("[Memory] Vector index skipped:", error);
  }

  if (input.updatePersona !== false && process.env.AIPING_API_KEY) {
    import("@/lib/persona-service")
      .then(({ extractAndUpdatePersonaFromText }) =>
        extractAndUpdatePersonaFromText(input.userId, input.note, process.env.AIPING_API_KEY!)
      )
      .catch((error) => {
        console.error("[Persona] Interaction update failed:", error);
      });
  }

  return memory;
}

export function buildMemoryVectorContent(input: {
  note: string;
  prompt?: string | null;
  source: string;
  metadata?: JsonRecord;
}): string {
  const metadataText = input.metadata ? JSON.stringify(input.metadata) : "";
  return [
    `来源：${input.source}`,
    input.prompt ? `触发：${input.prompt}` : null,
    `内容：${input.note}`,
    metadataText ? `元数据：${metadataText}` : null,
  ]
    .filter(Boolean)
    .join("\n");
}
