import type { PrismaClient } from "../../src/generated/prisma/client";
import type { SeededUser } from "./users";

/**
 * Seed realistic mood checkins, habit completions, and health records
 * for the past 3 weeks to make report generation meaningful.
 */
export async function seedMisc(prisma: PrismaClient, user: SeededUser) {
  // --- Mood check-ins (past 21 days) ---
  await prisma.moodCheckin.deleteMany({ where: { userId: user.id } });

  const moods: ("calm" | "anxious" | "fatigued")[] = [
    "calm", "calm", "fatigued", "calm", "anxious", "calm", "calm",
    "calm", "fatigued", "calm", "calm", "calm", "anxious", "calm",
    "fatigued", "calm", "calm", "calm", "calm", "fatigued", "calm",
  ];
  const moodNotes = [
    "早起晨跑后心情很好",
    "冥想10分钟后感觉平静",
    "昨晚没睡好，今天有点累",
    "和朋友聊天后心情不错",
    "工作deadline临近，有些焦虑",
    "散步回来神清气爽",
    "周末放松了一天，感觉很好",
    "今天状态很棒",
    "连续加班两天，身体有点吃不消",
    "做了瑜伽后身心舒畅",
    null, null, null, null, null, null, null, null, null, null, null,
  ];

  for (let i = 0; i < 21; i++) {
    const date = new Date();
    date.setDate(date.getDate() - (20 - i));
    date.setHours(8 + Math.floor(Math.random() * 4), Math.floor(Math.random() * 60), 0, 0);
    await prisma.moodCheckin.create({
      data: {
        userId: user.id,
        mood: moods[i],
        note: moodNotes[i] || null,
        createdAt: date,
      },
    });
  }

  // --- Health connections ---
  await prisma.healthConnection.deleteMany({ where: { userId: user.id } });
  await prisma.healthConnection.createMany({
    data: [
      { userId: user.id, provider: "appleHealth", status: "connected", connectedAt: new Date() },
      { userId: user.id, provider: "garmin", status: "disconnected" },
      { userId: user.id, provider: "oura", status: "connected", connectedAt: new Date() },
    ],
  });

  // --- Habit completions (past 21 days) ---
  const goals = await prisma.goal.findMany({ where: { userId: user.id, archived: false } });
  await prisma.habitCompletion.deleteMany({ where: { userId: user.id } });

  // Simulate realistic completion patterns (not perfect every day)
  const completionPatterns: Record<number, boolean[]> = {
    0: [true, true, true, true, false, true, true, true, true, true, false, true, true, true, true, true, true, false, true, true, true], // ~85%
    1: [true, false, true, true, true, false, true, true, false, true, true, true, false, true, true, false, true, true, true, true, false], // ~71%
    2: [false, true, false, true, true, true, false, false, true, true, true, false, true, true, false, true, true, true, false, true, true], // ~67%
    3: [true, true, true, true, true, true, true, true, true, true, true, true, true, true, true, true, true, true, true, true, true], // 100% streak!
  };

  for (let goalIdx = 0; goalIdx < goals.length && goalIdx < 4; goalIdx++) {
    const pattern = completionPatterns[goalIdx];
    for (let day = 0; day < 21; day++) {
      if (!pattern[day]) continue;
      const date = new Date();
      date.setDate(date.getDate() - (20 - day));
      date.setHours(0, 0, 0, 0);
      await prisma.habitCompletion.create({
        data: {
          goalId: goals[goalIdx].id,
          userId: user.id,
          forDate: date,
          completedAt: new Date(date.getTime() + Math.random() * 86400000),
        },
      });
    }
  }

  // --- Health Records (past 21 days: steps, heartRate, sleepAnalysis, calories) ---
  await prisma.healthRecord.deleteMany({ where: { userId: user.id, source: "manual" } });

  for (let day = 0; day < 21; day++) {
    const date = new Date();
    date.setDate(date.getDate() - (20 - day));
    date.setHours(0, 0, 0, 0);

    // Steps (6000-12000 range)
    const steps = 6000 + Math.floor(Math.random() * 6000);
    await prisma.healthRecord.create({
      data: {
        userId: user.id,
        source: "manual",
        metric: "steps",
        value: steps,
        unit: "count",
        startDate: date,
        endDate: new Date(date.getTime() + 86400000),
      },
    });

    // Heart rate (resting: 58-72 bpm)
    const hr = 58 + Math.floor(Math.random() * 14);
    await prisma.healthRecord.create({
      data: {
        userId: user.id,
        source: "manual",
        metric: "restingHR",
        value: hr,
        unit: "bpm",
        startDate: date,
        endDate: date,
      },
    });

    // Sleep (5.5-8.5 hours)
    const sleepHours = 5.5 + Math.random() * 3;
    await prisma.healthRecord.create({
      data: {
        userId: user.id,
        source: "manual",
        metric: "sleepAnalysis",
        value: Math.round(sleepHours * 60), // stored in minutes
        unit: "min",
        startDate: new Date(date.getTime() - 8 * 3600000), // sleep start ~previous evening
        endDate: date,
      },
    });

    // Calories (1600-2400)
    const calories = 1600 + Math.floor(Math.random() * 800);
    await prisma.healthRecord.create({
      data: {
        userId: user.id,
        source: "manual",
        metric: "calories",
        value: calories,
        unit: "kcal",
        startDate: date,
        endDate: new Date(date.getTime() + 86400000),
      },
    });

    // Workouts (3-4 per week, ~30-60min)
    if (day % 7 < 3 + Math.floor(Math.random() * 2)) {
      if (Math.random() > 0.4) {
        const duration = 30 + Math.floor(Math.random() * 30);
        await prisma.healthRecord.create({
          data: {
            userId: user.id,
            source: "manual",
            metric: "workout",
            value: duration,
            unit: "min",
            startDate: new Date(date.getTime() + 7 * 3600000),
            endDate: new Date(date.getTime() + 7 * 3600000 + duration * 60000),
            metadata: { type: ["running", "yoga", "strength", "cycling"][Math.floor(Math.random() * 4)] },
          },
        });
      }
    }
  }

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
