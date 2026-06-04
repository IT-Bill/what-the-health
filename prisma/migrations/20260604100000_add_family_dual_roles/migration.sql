ALTER TABLE "family_members" ADD COLUMN "is_caregiver" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "family_members" ADD COLUMN "is_cared_for" BOOLEAN NOT NULL DEFAULT false;

-- Backfill from existing role values
UPDATE "family_members" SET "is_caregiver" = true WHERE role = 'caregiver';
UPDATE "family_members" SET "is_cared_for" = true  WHERE role = 'member';
