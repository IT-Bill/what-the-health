-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('female', 'male', 'nonBinary', 'undisclosed');

-- CreateEnum
CREATE TYPE "Mood" AS ENUM ('calm', 'anxious', 'fatigued');

-- CreateEnum
CREATE TYPE "GoalType" AS ENUM ('buildMuscle', 'loseWeight', 'healthyHabits');

-- CreateEnum
CREATE TYPE "HabitCadence" AS ENUM ('daily', 'weekly', 'custom');

-- CreateEnum
CREATE TYPE "ChatRole" AS ENUM ('user', 'assistant');

-- CreateEnum
CREATE TYPE "JourneyCategory" AS ENUM ('mindfulness', 'nutrition', 'reflection', 'sleep');

-- CreateEnum
CREATE TYPE "ReactionType" AS ENUM ('inspired', 'resonate', 'willTry');

-- CreateEnum
CREATE TYPE "HealthProvider" AS ENUM ('appleHealth', 'garmin', 'oura');

-- CreateEnum
CREATE TYPE "ConnectionStatus" AS ENUM ('connected', 'disconnected');

-- CreateEnum
CREATE TYPE "RedemptionStatus" AS ENUM ('pending', 'fulfilled', 'cancelled');

-- CreateEnum
CREATE TYPE "CreditAction" AS ENUM ('dailyCheckin', 'habitComplete', 'allHabitsComplete', 'moodCheckin', 'streakWeekly', 'mindfulness', 'postPublish', 'postLiked', 'redemption', 'adminAdjust');

-- CreateEnum
CREATE TYPE "CreditDirection" AS ENUM ('earn', 'spend');

-- CreateEnum
CREATE TYPE "FriendshipStatus" AS ENUM ('pending', 'accepted', 'blocked');

-- CreateEnum
CREATE TYPE "ShareableContent" AS ENUM ('weeklyReport', 'monthlyReport', 'insights', 'goals', 'moodHistory', 'posts');

-- CreateEnum
CREATE TYPE "PeriodType" AS ENUM ('weekly', 'monthly');

-- CreateEnum
CREATE TYPE "InsightType" AS ENUM ('pattern', 'prediction', 'correlation', 'milestone');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT,
    "name" TEXT NOT NULL,
    "avatarUrl" TEXT,
    "gender" "Gender",
    "birthday" DATE,
    "heightCm" INTEGER,
    "weightKg" DOUBLE PRECISION,
    "memberSince" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notificationsEnabled" BOOLEAN NOT NULL DEFAULT true,
    "credits" INTEGER NOT NULL DEFAULT 0,
    "primaryGoal" "GoalType",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "friendships" (
    "id" TEXT NOT NULL,
    "requesterId" TEXT NOT NULL,
    "addresseeId" TEXT NOT NULL,
    "status" "FriendshipStatus" NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "friendships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "friend_permissions" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "friendId" TEXT NOT NULL,
    "content" "ShareableContent" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "friend_permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mood_checkins" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "mood" "Mood" NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mood_checkins_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "goals" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "icon" TEXT,
    "cadence" "HabitCadence" NOT NULL DEFAULT 'daily',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "goals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "habit_completions" (
    "id" TEXT NOT NULL,
    "goalId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "forDate" DATE NOT NULL,

    CONSTRAINT "habit_completions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chat_sessions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "chat_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chat_messages" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "role" "ChatRole" NOT NULL,
    "content" TEXT NOT NULL,
    "reasoning" TEXT,
    "model" TEXT,
    "inputTokens" INTEGER,
    "outputTokens" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chat_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "posts" (
    "id" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "excerpt" TEXT,
    "body" TEXT NOT NULL,
    "category" "JourneyCategory" NOT NULL,
    "categoryIcon" TEXT,
    "coverImage" TEXT,
    "readMinutes" INTEGER NOT NULL DEFAULT 5,
    "published" BOOLEAN NOT NULL DEFAULT true,
    "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "posts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "comments" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "parentId" TEXT,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "likes" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "likes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "memories" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "note" TEXT,
    "prompt" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "memories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "memory_reactions" (
    "id" TEXT NOT NULL,
    "memoryId" TEXT NOT NULL,
    "type" "ReactionType" NOT NULL,

    CONSTRAINT "memory_reactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "health_connections" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" "HealthProvider" NOT NULL,
    "status" "ConnectionStatus" NOT NULL DEFAULT 'disconnected',
    "connectedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "health_connections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "products" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "image" TEXT,
    "priceCredits" INTEGER NOT NULL,
    "available" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "redemptions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "creditsSpent" INTEGER NOT NULL,
    "status" "RedemptionStatus" NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "redemptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "credit_rules" (
    "id" TEXT NOT NULL,
    "action" "CreditAction" NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "dailyCap" INTEGER NOT NULL DEFAULT 0,
    "icon" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "credit_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "credit_transactions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "action" "CreditAction" NOT NULL,
    "direction" "CreditDirection" NOT NULL,
    "amount" INTEGER NOT NULL,
    "balance" INTEGER NOT NULL,
    "refId" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "credit_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reports" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "periodType" "PeriodType" NOT NULL,
    "periodStart" DATE NOT NULL,
    "periodEnd" DATE NOT NULL,
    "data" JSONB NOT NULL,
    "summary" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "insights" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "reportId" TEXT,
    "type" "InsightType" NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "metadata" JSONB,
    "dismissed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "insights_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE INDEX "friendships_addresseeId_status_idx" ON "friendships"("addresseeId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "friendships_requesterId_addresseeId_key" ON "friendships"("requesterId", "addresseeId");

-- CreateIndex
CREATE INDEX "friend_permissions_ownerId_friendId_idx" ON "friend_permissions"("ownerId", "friendId");

-- CreateIndex
CREATE UNIQUE INDEX "friend_permissions_ownerId_friendId_content_key" ON "friend_permissions"("ownerId", "friendId", "content");

-- CreateIndex
CREATE INDEX "mood_checkins_userId_createdAt_idx" ON "mood_checkins"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "goals_userId_archived_idx" ON "goals"("userId", "archived");

-- CreateIndex
CREATE INDEX "habit_completions_userId_forDate_idx" ON "habit_completions"("userId", "forDate");

-- CreateIndex
CREATE UNIQUE INDEX "habit_completions_goalId_forDate_key" ON "habit_completions"("goalId", "forDate");

-- CreateIndex
CREATE INDEX "chat_sessions_userId_updatedAt_idx" ON "chat_sessions"("userId", "updatedAt");

-- CreateIndex
CREATE INDEX "chat_messages_sessionId_createdAt_idx" ON "chat_messages"("sessionId", "createdAt");

-- CreateIndex
CREATE INDEX "posts_category_published_publishedAt_idx" ON "posts"("category", "published", "publishedAt");

-- CreateIndex
CREATE INDEX "posts_authorId_idx" ON "posts"("authorId");

-- CreateIndex
CREATE INDEX "comments_postId_createdAt_idx" ON "comments"("postId", "createdAt");

-- CreateIndex
CREATE INDEX "comments_parentId_idx" ON "comments"("parentId");

-- CreateIndex
CREATE INDEX "likes_postId_idx" ON "likes"("postId");

-- CreateIndex
CREATE UNIQUE INDEX "likes_postId_authorId_key" ON "likes"("postId", "authorId");

-- CreateIndex
CREATE INDEX "memories_userId_createdAt_idx" ON "memories"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "memory_reactions_memoryId_type_key" ON "memory_reactions"("memoryId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "health_connections_userId_provider_key" ON "health_connections"("userId", "provider");

-- CreateIndex
CREATE INDEX "redemptions_userId_createdAt_idx" ON "redemptions"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "credit_rules_action_key" ON "credit_rules"("action");

-- CreateIndex
CREATE INDEX "credit_transactions_userId_createdAt_idx" ON "credit_transactions"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "credit_transactions_userId_action_createdAt_idx" ON "credit_transactions"("userId", "action", "createdAt");

-- CreateIndex
CREATE INDEX "reports_userId_periodType_periodStart_idx" ON "reports"("userId", "periodType", "periodStart");

-- CreateIndex
CREATE UNIQUE INDEX "reports_userId_periodType_periodStart_key" ON "reports"("userId", "periodType", "periodStart");

-- CreateIndex
CREATE INDEX "insights_userId_createdAt_idx" ON "insights"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "insights_reportId_idx" ON "insights"("reportId");

-- AddForeignKey
ALTER TABLE "friendships" ADD CONSTRAINT "friendships_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "friendships" ADD CONSTRAINT "friendships_addresseeId_fkey" FOREIGN KEY ("addresseeId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "friend_permissions" ADD CONSTRAINT "friend_permissions_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "friend_permissions" ADD CONSTRAINT "friend_permissions_friendId_fkey" FOREIGN KEY ("friendId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mood_checkins" ADD CONSTRAINT "mood_checkins_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goals" ADD CONSTRAINT "goals_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "habit_completions" ADD CONSTRAINT "habit_completions_goalId_fkey" FOREIGN KEY ("goalId") REFERENCES "goals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "habit_completions" ADD CONSTRAINT "habit_completions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_sessions" ADD CONSTRAINT "chat_sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "chat_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "posts" ADD CONSTRAINT "posts_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comments" ADD CONSTRAINT "comments_postId_fkey" FOREIGN KEY ("postId") REFERENCES "posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comments" ADD CONSTRAINT "comments_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comments" ADD CONSTRAINT "comments_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "comments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "likes" ADD CONSTRAINT "likes_postId_fkey" FOREIGN KEY ("postId") REFERENCES "posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "likes" ADD CONSTRAINT "likes_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "memories" ADD CONSTRAINT "memories_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "memory_reactions" ADD CONSTRAINT "memory_reactions_memoryId_fkey" FOREIGN KEY ("memoryId") REFERENCES "memories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "health_connections" ADD CONSTRAINT "health_connections_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "redemptions" ADD CONSTRAINT "redemptions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "redemptions" ADD CONSTRAINT "redemptions_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_transactions" ADD CONSTRAINT "credit_transactions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "insights" ADD CONSTRAINT "insights_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "insights" ADD CONSTRAINT "insights_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "reports"("id") ON DELETE SET NULL ON UPDATE CASCADE;

