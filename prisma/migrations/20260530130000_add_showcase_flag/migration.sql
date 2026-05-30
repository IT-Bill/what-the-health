-- AlterTable: add isShowcase flag to users
ALTER TABLE "users" ADD COLUMN "isShowcase" BOOLEAN NOT NULL DEFAULT false;
