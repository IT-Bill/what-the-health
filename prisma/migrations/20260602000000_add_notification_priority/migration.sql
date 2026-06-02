-- CreateEnum
CREATE TYPE "NotificationPriority" AS ENUM ('normal', 'urgent');

-- AlterTable
ALTER TABLE "notifications" ADD COLUMN "priority" "NotificationPriority" NOT NULL DEFAULT 'normal';
