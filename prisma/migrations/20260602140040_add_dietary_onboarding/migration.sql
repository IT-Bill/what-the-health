-- CreateEnum
CREATE TYPE "MealType" AS ENUM ('breakfast', 'lunch', 'dinner', 'snack');

-- CreateEnum
CREATE TYPE "CookingMethod" AS ENUM ('home_cooked', 'takeout', 'cafeteria');

-- DropIndex
DROP INDEX "vector_documents_embedding_hnsw_idx";

-- DropIndex
DROP INDEX "vector_documents_metadata_gin_idx";

-- AlterTable
ALTER TABLE "vector_documents" ALTER COLUMN "id" SET DEFAULT gen_random_uuid()::text,
ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updated_at" DROP DEFAULT,
ALTER COLUMN "updated_at" SET DATA TYPE TIMESTAMP(3);

-- CreateTable
CREATE TABLE "user_health_profiles" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "dietaryPreference" TEXT,
    "foodAllergies" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "foodIntolerances" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "tastePreferences" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "dislikedFoods" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "medicalConditions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "medications" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "exerciseConstraints" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "occupationType" TEXT,
    "workSchedule" TEXT,
    "cookingSkill" TEXT,
    "cookingFrequency" TEXT,
    "hasWearable" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_health_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dietary_logs" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "mealType" "MealType" NOT NULL,
    "logDate" DATE NOT NULL,
    "loggedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "rawInput" TEXT NOT NULL,
    "parsedFoods" JSONB,
    "totalCalories" DOUBLE PRECISION,
    "cookingMethod" "CookingMethod",
    "location" TEXT,
    "aiEvaluation" JSONB,
    "wearableSnapshot" JSONB,

    CONSTRAINT "dietary_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "health_plans" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "planData" JSONB NOT NULL,
    "planText" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "health_plans_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_health_profiles_userId_key" ON "user_health_profiles"("userId");

-- CreateIndex
CREATE INDEX "dietary_logs_userId_logDate_idx" ON "dietary_logs"("userId", "logDate");

-- CreateIndex
CREATE INDEX "dietary_logs_userId_mealType_logDate_idx" ON "dietary_logs"("userId", "mealType", "logDate");

-- CreateIndex
CREATE INDEX "health_plans_userId_isActive_idx" ON "health_plans"("userId", "isActive");

-- AddForeignKey
ALTER TABLE "user_health_profiles" ADD CONSTRAINT "user_health_profiles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dietary_logs" ADD CONSTRAINT "dietary_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "health_plans" ADD CONSTRAINT "health_plans_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
