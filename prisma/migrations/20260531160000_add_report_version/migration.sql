-- Add version column to reports table
ALTER TABLE "reports" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1;

-- Drop old unique constraint/index and create new one with version
DROP INDEX IF EXISTS "reports_userId_periodType_periodStart_key";
ALTER TABLE "reports" DROP CONSTRAINT IF EXISTS "reports_userId_periodType_periodStart_key";
ALTER TABLE "reports" ADD CONSTRAINT "reports_userId_periodType_periodStart_version_key" UNIQUE ("userId", "periodType", "periodStart", "version");
