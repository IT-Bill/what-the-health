DO $$ BEGIN
  CREATE TYPE "FriendshipStatus" AS ENUM ('pending', 'accepted', 'blocked');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "ShareableContent" AS ENUM ('weeklyReport', 'monthlyReport', 'insights', 'goals', 'moodHistory', 'posts');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "friendships" (
    "id" TEXT NOT NULL,
    "requesterId" TEXT NOT NULL,
    "addresseeId" TEXT NOT NULL,
    "status" "FriendshipStatus" NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "friendships_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "friend_permissions" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "friendId" TEXT NOT NULL,
    "content" "ShareableContent" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "friend_permissions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "friendships_addresseeId_status_idx" ON "friendships"("addresseeId", "status");
CREATE UNIQUE INDEX IF NOT EXISTS "friendships_requesterId_addresseeId_key" ON "friendships"("requesterId", "addresseeId");
CREATE INDEX IF NOT EXISTS "friend_permissions_ownerId_friendId_idx" ON "friend_permissions"("ownerId", "friendId");
CREATE UNIQUE INDEX IF NOT EXISTS "friend_permissions_ownerId_friendId_content_key" ON "friend_permissions"("ownerId", "friendId", "content");

ALTER TABLE "friendships" DROP CONSTRAINT IF EXISTS "friendships_requesterId_fkey";
ALTER TABLE "friendships" ADD CONSTRAINT "friendships_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "friendships" DROP CONSTRAINT IF EXISTS "friendships_addresseeId_fkey";
ALTER TABLE "friendships" ADD CONSTRAINT "friendships_addresseeId_fkey" FOREIGN KEY ("addresseeId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "friend_permissions" DROP CONSTRAINT IF EXISTS "friend_permissions_ownerId_fkey";
ALTER TABLE "friend_permissions" ADD CONSTRAINT "friend_permissions_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "friend_permissions" DROP CONSTRAINT IF EXISTS "friend_permissions_friendId_fkey";
ALTER TABLE "friend_permissions" ADD CONSTRAINT "friend_permissions_friendId_fkey" FOREIGN KEY ("friendId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
