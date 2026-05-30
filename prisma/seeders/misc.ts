import type { PrismaClient } from "../../src/generated/prisma/client";
import type { SeededUser } from "./users";

export async function seedMisc(prisma: PrismaClient, user: SeededUser) {
  // --- Mood check-in ---
  await prisma.moodCheckin.deleteMany({ where: { userId: user.id } });
  await prisma.moodCheckin.create({
    data: { userId: user.id, mood: "fatigued", note: "今天工作很多，一直没有停下来深呼吸的时间。" },
  });

  // --- Health connections ---
  await prisma.healthConnection.deleteMany({ where: { userId: user.id } });
  await prisma.healthConnection.createMany({
    data: [
      { userId: user.id, provider: "appleHealth", status: "connected", connectedAt: new Date() },
      { userId: user.id, provider: "garmin", status: "disconnected" },
      { userId: user.id, provider: "oura", status: "connected", connectedAt: new Date() },
    ],
  });

  // --- Memory + reactions ---
  await prisma.memoryReaction.deleteMany({ where: { memory: { userId: user.id } } });
  await prisma.memory.deleteMany({ where: { userId: user.id } });
  const memory = await prisma.memory.create({
    data: { userId: user.id, prompt: "A Quiet Conclusion", note: "今天学会了用更温柔的方式对待自己。" },
  });
  await prisma.memoryReaction.createMany({
    data: [
      { memoryId: memory.id, type: "inspired" },
      { memoryId: memory.id, type: "resonate" },
    ],
  });

  // --- Chat session ---
  await prisma.chatMessage.deleteMany({ where: { session: { userId: user.id } } });
  await prisma.chatSession.deleteMany({ where: { userId: user.id } });
  const session = await prisma.chatSession.create({
    data: { userId: user.id, title: "今天" },
  });
  await prisma.chatMessage.createMany({
    data: [
      { sessionId: session.id, role: "assistant", content: "欢迎回来。在这个当下，你感觉如何？", model: "GLM-5.1" },
      { sessionId: session.id, role: "user", content: "有点疲惫。今天工作很多，一直没有停下来深呼吸的时间。" },
    ],
  });
}
