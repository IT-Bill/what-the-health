-- Add pinned column to chat_sessions
ALTER TABLE "chat_sessions" ADD COLUMN "pinned" BOOLEAN NOT NULL DEFAULT false;

-- Update index to include pinned for efficient pinned-first ordering
DROP INDEX "chat_sessions_userId_updatedAt_idx";
CREATE INDEX "chat_sessions_userId_pinned_updatedAt_idx" ON "chat_sessions"("userId", "pinned", "updatedAt");
