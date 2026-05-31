import { Pool } from "pg";

export const VECTOR_DIMENSIONS = 1024;
export const DEFAULT_VECTOR_LIMIT = 5;
export const MAX_VECTOR_LIMIT = 20;

type JsonRecord = Record<string, unknown>;

export interface VectorDocumentInput {
  namespace: string;
  sourceId: string;
  userId?: string | null;
  title?: string | null;
  content: string;
  metadata?: JsonRecord;
}

export interface VectorSearchOptions {
  namespace: string;
  userId?: string;
  embedding: number[];
  limit?: number;
  metadata?: Record<string, string | number | boolean | null | undefined>;
}

export interface VectorSearchResult<TMetadata extends JsonRecord = JsonRecord> {
  id: string;
  namespace: string;
  sourceId: string;
  userId: string | null;
  title: string | null;
  content: string;
  metadata: TMetadata;
  similarity: number;
}

const globalForVectorPool = globalThis as unknown as {
  vectorPool?: Pool;
};

export function getVectorPool(): Pool {
  if (globalForVectorPool.vectorPool) return globalForVectorPool.vectorPool;

  const connectionString = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("Missing DATABASE_URL for pgvector.");
  }

  const pool = new Pool({ connectionString });
  if (process.env.NODE_ENV !== "production") {
    globalForVectorPool.vectorPool = pool;
  }
  return pool;
}

export async function closeVectorPool(): Promise<void> {
  const pool = globalForVectorPool.vectorPool;
  if (!pool) return;
  delete globalForVectorPool.vectorPool;
  await pool.end();
}

export function toPgVectorLiteral(embedding: number[], expectedDimensions = VECTOR_DIMENSIONS): string {
  if (embedding.length !== expectedDimensions) {
    throw new Error(`Expected embedding dimension ${expectedDimensions}, got ${embedding.length}.`);
  }

  for (const value of embedding) {
    if (!Number.isFinite(value)) {
      throw new Error("Embedding values must be finite numbers.");
    }
  }

  return `[${embedding.join(",")}]`;
}

export function normalizeVectorLimit(limit: number | undefined): number {
  if (limit === undefined || Number.isNaN(limit)) return DEFAULT_VECTOR_LIMIT;
  return Math.min(Math.max(Math.trunc(limit), 1), MAX_VECTOR_LIMIT);
}

export function vectorMetadataWhereClause(
  metadata: VectorSearchOptions["metadata"] = {},
  firstPlaceholderIndex: number
): { sql: string; values: string[] } {
  const clauses: string[] = [];
  const values: string[] = [];
  let placeholderIndex = firstPlaceholderIndex;

  for (const [key, value] of Object.entries(metadata)) {
    if (value === undefined || value === null) continue;
    clauses.push(`metadata->>$${placeholderIndex} = $${placeholderIndex + 1}`);
    values.push(key, String(value));
    placeholderIndex += 2;
  }

  return {
    sql: clauses.length ? ` AND ${clauses.join(" AND ")}` : "",
    values,
  };
}

export async function upsertVectorDocument(
  document: VectorDocumentInput,
  embedding: number[],
  pool = getVectorPool()
): Promise<void> {
  const vector = toPgVectorLiteral(embedding);
  const metadata = JSON.stringify(document.metadata ?? {});

  await pool.query(
    `
      INSERT INTO vector_documents (
        id, namespace, source_id, user_id, title, content, metadata, embedding, updated_at
      )
      VALUES (
        gen_random_uuid()::text, $1, $2, $3, $4, $5, $6::jsonb, $7::vector, now()
      )
      ON CONFLICT (namespace, source_id)
      DO UPDATE SET
        user_id = EXCLUDED.user_id,
        title = EXCLUDED.title,
        content = EXCLUDED.content,
        metadata = EXCLUDED.metadata,
        embedding = EXCLUDED.embedding,
        updated_at = now()
    `,
    [
      document.namespace,
      document.sourceId,
      document.userId ?? null,
      document.title ?? null,
      document.content,
      metadata,
      vector,
    ]
  );
}

export async function findExistingVectorSourceIds(
  namespace: string,
  sourceIds: string[],
  pool = getVectorPool()
): Promise<Set<string>> {
  if (sourceIds.length === 0) return new Set();

  const result = await pool.query<{ source_id: string }>(
    `
      SELECT source_id
      FROM vector_documents
      WHERE namespace = $1 AND source_id = ANY($2::text[])
    `,
    [namespace, sourceIds]
  );

  return new Set(result.rows.map((row) => row.source_id));
}

export async function searchVectorDocuments<TMetadata extends JsonRecord = JsonRecord>(
  options: VectorSearchOptions,
  pool = getVectorPool()
): Promise<Array<VectorSearchResult<TMetadata>>> {
  const vector = toPgVectorLiteral(options.embedding);
  const limit = normalizeVectorLimit(options.limit);
  const userWhere = options.userId ? " AND user_id = $4" : "";
  const metadataWhere = vectorMetadataWhereClause(options.metadata, options.userId ? 5 : 4);

  const result = await pool.query<{
    id: string;
    namespace: string;
    source_id: string;
    user_id: string | null;
    title: string | null;
    content: string;
    metadata: TMetadata;
    similarity: string | number;
  }>(
    `
      SELECT
        id,
        namespace,
        source_id,
        user_id,
        title,
        content,
        metadata,
        1 - (embedding <=> $1::vector) AS similarity
      FROM vector_documents
      WHERE namespace = $2${userWhere}${metadataWhere.sql}
      ORDER BY embedding <=> $1::vector
      LIMIT $3
    `,
    [
      vector,
      options.namespace,
      limit,
      ...(options.userId ? [options.userId] : []),
      ...metadataWhere.values,
    ]
  );

  return result.rows.map((row) => ({
    id: row.id,
    namespace: row.namespace,
    sourceId: row.source_id,
    userId: row.user_id,
    title: row.title,
    content: row.content,
    metadata: row.metadata,
    similarity: Number(row.similarity),
  }));
}
