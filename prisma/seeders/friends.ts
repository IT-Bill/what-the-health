import type { PrismaClient } from "../../src/generated/prisma/client";
import type { SeededUser } from "./users";

/**
 * Seeds friendships between all seeded users (first user sends requests, others accept).
 * Also sets default permissions: weekly/monthly reports + posts are shared.
 */
export async function seedFriends(prisma: PrismaClient, users: SeededUser[]) {
  if (users.length < 2) return;

  // Clean existing friendships and permissions for all users
  const userIds = users.map((u) => u.id);
  await prisma.friendPermission.deleteMany({
    where: { OR: [{ ownerId: { in: userIds } }, { friendId: { in: userIds } }] },
  });
  await prisma.friendship.deleteMany({
    where: { OR: [{ requesterId: { in: userIds } }, { addresseeId: { in: userIds } }] },
  });

  // Create accepted friendships between all pairs
  for (let i = 0; i < users.length; i++) {
    for (let j = i + 1; j < users.length; j++) {
      await prisma.friendship.create({
        data: {
          requesterId: users[i].id,
          addresseeId: users[j].id,
          status: "accepted",
        },
      });

      // Default permissions: both users share reports + posts with each other
      const defaultPermissions: Array<"weeklyReport" | "monthlyReport" | "posts" | "goals"> = [
        "weeklyReport",
        "monthlyReport",
        "posts",
        "goals",
      ];

      for (const content of defaultPermissions) {
        // user[i] allows user[j] to see their content
        await prisma.friendPermission.create({
          data: { ownerId: users[i].id, friendId: users[j].id, content },
        });
        // user[j] allows user[i] to see their content
        await prisma.friendPermission.create({
          data: { ownerId: users[j].id, friendId: users[i].id, content },
        });
      }
    }
  }
}
