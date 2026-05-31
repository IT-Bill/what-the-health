export const BAILIAN_EMBEDDING_MODEL = "text-embedding-v4";
export const BAILIAN_EMBEDDING_DIMENSIONS = 1024;

const DEFAULT_BASE_URL = "https://dashscope.aliyuncs.com/compatible-mode/v1";

interface BailianEmbeddingResponse {
  data?: Array<{ embedding?: number[] }>;
  error?: { message?: string };
}

export interface EmbedTextOptions {
  apiKey?: string;
  baseUrl?: string;
  model?: string;
  dimensions?: number;
}

export async function embedTextWithBailian(
  input: string,
  options: EmbedTextOptions = {}
): Promise<number[]> {
  const apiKey =
    options.apiKey ??
    process.env.ALIYUN_BAILIAN_API_KEY ??
    process.env.DASHSCOPE_API_KEY ??
    process.env.BAILIAN_API_KEY;

  if (!apiKey) {
    throw new Error("Missing ALIYUN_BAILIAN_API_KEY for Bailian embeddings.");
  }

  const trimmed = input.trim();
  if (!trimmed) {
    throw new Error("Cannot create an embedding for empty input.");
  }

  const baseUrl = (options.baseUrl ?? process.env.BAILIAN_BASE_URL ?? DEFAULT_BASE_URL).replace(/\/$/, "");
  const response = await fetch(`${baseUrl}/embeddings`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: options.model ?? BAILIAN_EMBEDDING_MODEL,
      input: trimmed,
      dimensions: options.dimensions ?? BAILIAN_EMBEDDING_DIMENSIONS,
    }),
  });

  const payload = (await response.json().catch(() => ({}))) as BailianEmbeddingResponse;
  if (!response.ok) {
    throw new Error(payload.error?.message ?? `Bailian embedding request failed: ${response.status}`);
  }

  const embedding = payload.data?.[0]?.embedding;
  if (!embedding?.length) {
    throw new Error("Bailian embedding response did not include an embedding.");
  }

  return embedding;
}
