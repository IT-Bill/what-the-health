ALTER TABLE "users"
ADD COLUMN "primaryGoals" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

UPDATE "users"
SET "primaryGoals" = ARRAY["primaryGoal"::text]
WHERE "primaryGoal" IS NOT NULL
  AND COALESCE(array_length("primaryGoals", 1), 0) = 0;