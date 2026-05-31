ALTER TABLE "memories"
  ADD COLUMN "source" TEXT,
  ADD COLUMN "sourceId" TEXT,
  ADD COLUMN "metadata" JSONB;

CREATE INDEX "memories_userId_source_createdAt_idx"
  ON "memories"("userId", "source", "createdAt");
