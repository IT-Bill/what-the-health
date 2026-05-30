import type { PrismaClient } from "../../src/generated/prisma/client";
import type { SeededUser } from "./users";

const GOALS = [
  { title: "Mindful Breath", icon: "air", description: "Take 5 minutes to focus solely on your inhalations and exhalations, grounding yourself in the present moment.", done: true },
  { title: "Hydration", icon: "water_drop", description: "Drink your morning glass of warm lemon water to awaken your digestive system gracefully.", done: true },
  { title: "Evening Stillness", icon: "nightlight", description: "Disconnect from all screens 30 minutes before bed to allow your mind to naturally transition to rest.", done: false },
  { title: "Nourishment", icon: "restaurant", description: "Prepare a plant-forward lunch, eating slowly and savoring each bite without distractions.", done: false },
];

function todayUtc(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

export async function seedGoals(prisma: PrismaClient, user: SeededUser) {
  await prisma.habitCompletion.deleteMany({ where: { userId: user.id } });
  await prisma.goal.deleteMany({ where: { userId: user.id } });

  const today = todayUtc();
  for (let i = 0; i < GOALS.length; i++) {
    const g = GOALS[i];
    const goal = await prisma.goal.create({
      data: {
        userId: user.id,
        title: g.title,
        description: g.description,
        icon: g.icon,
        sortOrder: i,
      },
    });
    if (g.done) {
      await prisma.habitCompletion.create({
        data: { goalId: goal.id, userId: user.id, forDate: today },
      });
    }
  }
}
