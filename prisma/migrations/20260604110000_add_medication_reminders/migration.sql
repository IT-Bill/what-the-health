CREATE TYPE "ReminderFrequency" AS ENUM ('daily', 'twice_daily', 'three_times_daily', 'weekly', 'custom');

CREATE TABLE "medication_reminders" (
  "id"               TEXT NOT NULL,
  "userId"           TEXT NOT NULL,
  "title"            TEXT NOT NULL,
  "description"      TEXT,
  "frequency"        "ReminderFrequency" NOT NULL,
  "reminderTimes"    TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "startDate"        DATE NOT NULL,
  "endDate"          DATE,
  "isActive"         BOOLEAN NOT NULL DEFAULT true,
  "lastRemindedAt"   TIMESTAMP(3),
  "treatmentPlanId"  TEXT,
  "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"        TIMESTAMP(3) NOT NULL,

  CONSTRAINT "medication_reminders_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "medication_reminders_userId_isActive_startDate_idx"
  ON "medication_reminders"("userId", "isActive", "startDate");

ALTER TABLE "medication_reminders"
  ADD CONSTRAINT "medication_reminders_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
