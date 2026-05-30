-- CreateEnum: HealthDataSource
CREATE TYPE "HealthDataSource" AS ENUM ('appleHealth', 'huaweiHealth', 'xiaomiHealth', 'samsungHealth', 'googleFit', 'oppoHealth', 'manual');

-- CreateEnum: HealthMetricType
CREATE TYPE "HealthMetricType" AS ENUM ('steps', 'heartRate', 'restingHR', 'sleepAnalysis', 'workout', 'weight', 'bloodPressure', 'bloodOxygen', 'calories', 'distance', 'hrv', 'stress', 'mindfulSession', 'flightsClimbed', 'respiratoryRate');

-- CreateEnum: ImportStatus
CREATE TYPE "ImportStatus" AS ENUM ('processing', 'completed', 'failed');

-- CreateTable: health_imports
CREATE TABLE "health_imports" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "source" "HealthDataSource" NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "status" "ImportStatus" NOT NULL DEFAULT 'processing',
    "recordCount" INTEGER NOT NULL DEFAULT 0,
    "dataFrom" TIMESTAMP(3),
    "dataTo" TIMESTAMP(3),
    "error" TEXT,
    "summary" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "health_imports_pkey" PRIMARY KEY ("id")
);

-- CreateTable: health_records
CREATE TABLE "health_records" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "source" "HealthDataSource" NOT NULL,
    "metric" "HealthMetricType" NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "unit" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "metadata" JSONB,
    "sourceName" TEXT,
    "importId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "health_records_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "health_imports_userId_createdAt_idx" ON "health_imports"("userId", "createdAt");
CREATE INDEX "health_records_userId_metric_startDate_idx" ON "health_records"("userId", "metric", "startDate");
CREATE INDEX "health_records_userId_startDate_idx" ON "health_records"("userId", "startDate");
CREATE INDEX "health_records_importId_idx" ON "health_records"("importId");

-- AddForeignKey
ALTER TABLE "health_imports" ADD CONSTRAINT "health_imports_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "health_records" ADD CONSTRAINT "health_records_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "health_records" ADD CONSTRAINT "health_records_importId_fkey" FOREIGN KEY ("importId") REFERENCES "health_imports"("id") ON DELETE SET NULL ON UPDATE CASCADE;
