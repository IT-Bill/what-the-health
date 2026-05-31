import type { PrismaClient } from "../../src/generated/prisma/client";
import type { SeededUser } from "./users";

/**
 * Seeds a family with the first user as owner and remaining users as caregivers.
 */
export async function seedFamily(prisma: PrismaClient, users: SeededUser[]) {
  if (users.length < 2) return;

  const owner = users[0];
  const members = users.slice(1);

  // Clean existing family data for all users
  const userIds = users.map((u) => u.id);
  await prisma.familyAlert.deleteMany({ where: { sourceUserId: { in: userIds } } });
  await prisma.familyMember.deleteMany({ where: { userId: { in: userIds } } });
  // Delete families that have no members left
  const emptyFamilies = await prisma.family.findMany({
    where: { members: { none: {} } },
    select: { id: true },
  });
  if (emptyFamilies.length > 0) {
    await prisma.family.deleteMany({ where: { id: { in: emptyFamilies.map((f) => f.id) } } });
  }

  // Create a family
  const family = await prisma.family.create({
    data: {
      name: `${owner.username}的家庭`,
      description: "通过家庭功能，远方的牵挂变成实时的守护",
      members: {
        create: [
          {
            userId: owner.id,
            role: "owner",
            shareHealthData: true,
            shareAlerts: true,
          },
          ...members.map((m) => ({
            userId: m.id,
            role: "caregiver" as const,
            shareHealthData: true,
            shareAlerts: true,
          })),
        ],
      },
    },
  });

  console.log(`    family: "${family.name}" (${1 + members.length} members)`);
}
