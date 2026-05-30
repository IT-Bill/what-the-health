-- CreateEnum: ActivityType
CREATE TYPE "ActivityType" AS ENUM ('milestone', 'goalAchieved', 'sleepImproved', 'productPurchased', 'postBookmarked', 'streakReached', 'reportHighScore');

-- CreateEnum: NotificationType
CREATE TYPE "NotificationType" AS ENUM ('system', 'friendRequest', 'friendActivity', 'creditEarned', 'reportReady', 'aiInsight', 'reminder', 'leaderboard');

-- AlterEnum: add 'purchases' to ShareableContent
ALTER TYPE "ShareableContent" ADD VALUE 'purchases';

-- CreateTable: friend_activities
CREATE TABLE "friend_activities" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "ActivityType" NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "refType" TEXT,
    "refId" TEXT,
    "visible" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "friend_activities_pkey" PRIMARY KEY ("id")
);

-- CreateTable: notifications
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "recipientId" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "icon" TEXT,
    "refType" TEXT,
    "refId" TEXT,
    "senderId" TEXT,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "dismissed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable: weekly_leaderboards
CREATE TABLE "weekly_leaderboards" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "weekStart" DATE NOT NULL,
    "score" INTEGER NOT NULL DEFAULT 0,
    "totalSteps" INTEGER NOT NULL DEFAULT 0,
    "workoutCount" INTEGER NOT NULL DEFAULT 0,
    "mindfulCount" INTEGER NOT NULL DEFAULT 0,
    "rank" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "weekly_leaderboards_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "friend_activities_userId_visible_createdAt_idx" ON "friend_activities"("userId", "visible", "createdAt");
CREATE INDEX "notifications_recipientId_read_createdAt_idx" ON "notifications"("recipientId", "read", "createdAt");
CREATE UNIQUE INDEX "weekly_leaderboards_userId_weekStart_key" ON "weekly_leaderboards"("userId", "weekStart");
CREATE INDEX "weekly_leaderboards_weekStart_idx" ON "weekly_leaderboards"("weekStart");

-- AddForeignKey
ALTER TABLE "friend_activities" ADD CONSTRAINT "friend_activities_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "weekly_leaderboards" ADD CONSTRAINT "weekly_leaderboards_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
