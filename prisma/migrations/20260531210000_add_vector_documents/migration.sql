CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE "vector_documents" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "namespace" TEXT NOT NULL,
  "source_id" TEXT NOT NULL,
  "user_id" TEXT,
  "title" TEXT,
  "content" TEXT NOT NULL,
  "metadata" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "embedding" vector(1024) NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT "vector_documents_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "vector_documents_namespace_source_id_key"
  ON "vector_documents"("namespace", "source_id");

CREATE INDEX "vector_documents_namespace_idx"
  ON "vector_documents"("namespace");

CREATE INDEX "vector_documents_metadata_gin_idx"
  ON "vector_documents" USING GIN ("metadata");

CREATE INDEX "vector_documents_embedding_hnsw_idx"
  ON "vector_documents" USING hnsw ("embedding" vector_cosine_ops);
