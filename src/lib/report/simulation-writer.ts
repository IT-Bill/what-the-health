import { prisma } from "@/lib/prisma";
import type { CreditAction, HealthMetricType, Mood, Prisma } from "@/generated/prisma/client";
import {
  addUtcDays,
  atUtcHour,
  getReportSimulationScenario,
  parseUtcDay,
  utcDateKey,
  type ReportSimulationScenario,
} from "@/lib/report/simulation-scenarios";

const SOURCE_NAME = "Report Data Simulator";
const MEMORY_SOURCE = "report-simulator";
const CHAT_TITLE_PREFIX = "[sim-report]";
const MOOD_NOTE_PREFIX = "[sim-report]";
const CREDIT_NOTE_PREFIX = "[sim-report]";

export interface WriteReportSimulationDataInput {
  username: string;
  date: string;
  scenario: string;
  days: number;
  replace: boolean;
}

export interface WriteReportSimulationDataResult {
  username: string;
  scenario: string;
  description: string;
  startDate: string;
  days: number;
  replace: boolean;
  wrote: string[];
}

async function ensureHabits(userId: string) {
  const existing = await prisma.goal.findMany({
    where: { userId, archived: false },
    orderBy: { sortOrder: "asc" },
    take: 3,
  });

  if (existing.length >= 3) return existing;

  const defaults = [
    { title: "Sleep Routine", description: "保持规律睡眠", icon: "bedtime" },
    { title: "Daily Walk", description: "完成基础活动量", icon: "directions_walk" },
    { title: "Mindful Breath", description: "短暂正念呼吸", icon: "self_improvement" },
  ];

  for (let i = existing.length; i < 3; i++) {
    const item = defaults[i];
    const goal = await prisma.goal.create({
      data: {
        userId,
        title: item.title,
        description: item.description,
        icon: item.icon,
        sortOrder: i,
      },
    });
    existing.push(goal);
  }

  return existing;
}

async function clearSimulatedDay(userId: string, day: Date) {
  const start = day;
  const end = addUtcDays(day, 1);

  await prisma.healthRecord.deleteMany({
    where: {
      userId,
      sourceName: SOURCE_NAME,
      startDate: { gte: start, lt: end },
    },
  });
  await prisma.moodCheckin.deleteMany({
    where: {
      userId,
      note: { startsWith: MOOD_NOTE_PREFIX },
      createdAt: { gte: start, lt: end },
    },
  });
  await prisma.memory.deleteMany({
    where: {
      userId,
      source: MEMORY_SOURCE,
      createdAt: { gte: start, lt: end },
    },
  });
  await prisma.creditTransaction.deleteMany({
    where: {
      userId,
      note: { startsWith: CREDIT_NOTE_PREFIX },
      createdAt: { gte: start, lt: end },
    },
  });
  await prisma.chatSession.deleteMany({
    where: {
      userId,
      title: { startsWith: `${CHAT_TITLE_PREFIX} ${utcDateKey(day)}` },
      createdAt: { gte: start, lt: end },
    },
  });
}

async function createHealthRecord(input: {
  userId: string;
  day: Date;
  metric: HealthMetricType;
  value: number;
  unit: string;
  hour: number;
  durationMinutes?: number;
  metadata?: Record<string, unknown>;
}) {
  const startDate = atUtcHour(input.day, input.hour);
  const endDate = new Date(startDate.getTime() + (input.durationMinutes ?? 1) * 60_000);
  await prisma.healthRecord.create({
    data: {
      userId: input.userId,
      source: "manual",
      metric: input.metric,
      value: input.value,
      unit: input.unit,
      startDate,
      endDate,
      metadata: (input.metadata ?? {}) as Prisma.InputJsonValue,
      sourceName: SOURCE_NAME,
    },
  });
}

async function createCredit(userId: string, day: Date, amount: number, action: CreditAction, note: string) {
  if (amount <= 0) return;
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { credits: true } });
  const balance = (user?.credits ?? 0) + amount;
  await prisma.creditTransaction.create({
    data: {
      userId,
      action,
      direction: "earn",
      amount,
      balance,
      note: `${CREDIT_NOTE_PREFIX} ${note}`,
      createdAt: atUtcHour(day, 20),
    },
  });
  await prisma.user.update({ where: { id: userId }, data: { credits: balance } });
}

async function createChatActivity(userId: string, day: Date, messageCount: number, scenario: string) {
  if (messageCount <= 0) return;
  const session = await prisma.chatSession.create({
    data: {
      userId,
      title: `${CHAT_TITLE_PREFIX} ${utcDateKey(day)} ${scenario}`,
      createdAt: atUtcHour(day, 19),
      updatedAt: atUtcHour(day, 19, Math.min(59, messageCount * 3)),
    },
  });

  for (let i = 0; i < messageCount; i++) {
    await prisma.chatMessage.create({
      data: {
        sessionId: session.id,
        role: i % 2 === 0 ? "user" : "assistant",
        content: i % 2 === 0 ? "今天记录一下身体状态。" : "我会帮你把这些变化记下来。",
        createdAt: atUtcHour(day, 19, i * 3),
      },
    });
  }
}

async function writeDay(userId: string, day: Date, scenario: ReportSimulationScenario, replace: boolean) {
  const d = scenario.day;
  if (replace) await clearSimulatedDay(userId, day);

  if (d.sleepHours !== null) {
    await createHealthRecord({
      userId,
      day,
      metric: "sleepAnalysis",
      value: d.sleepHours,
      unit: "h",
      hour: 6,
      durationMinutes: Math.round(d.sleepHours * 60),
      metadata: { scenario: scenario.name },
    });
  }
  if (d.steps !== null) {
    await createHealthRecord({ userId, day, metric: "steps", value: d.steps, unit: "count", hour: 18 });
  }
  if (d.heartRate !== null) {
    await createHealthRecord({ userId, day, metric: "heartRate", value: d.heartRate, unit: "bpm", hour: 12 });
  }
  if (d.restingHR !== null) {
    await createHealthRecord({ userId, day, metric: "restingHR", value: d.restingHR, unit: "bpm", hour: 7 });
  }
  if (d.workoutMinutes !== null && d.workoutMinutes > 0) {
    await createHealthRecord({
      userId,
      day,
      metric: "workout",
      value: d.workoutMinutes,
      unit: "min",
      hour: 17,
      durationMinutes: d.workoutMinutes,
      metadata: { workoutType: "mixed", scenario: scenario.name },
    });
  }
  if (d.weightKg !== null && d.weightKg !== undefined) {
    await createHealthRecord({ userId, day, metric: "weight", value: d.weightKg, unit: "kg", hour: 8 });
  }

  if (d.mood) {
    await prisma.moodCheckin.create({
      data: {
        userId,
        mood: d.mood as Mood,
        note: `${MOOD_NOTE_PREFIX} ${scenario.description}`,
        createdAt: atUtcHour(day, 21),
      },
    });
  }

  const goals = await ensureHabits(userId);
  const completeCount = Math.min(d.habitCompletions, goals.length);
  for (const goal of goals.slice(0, completeCount)) {
    await prisma.habitCompletion.upsert({
      where: { goalId_forDate: { goalId: goal.id, forDate: day } },
      update: { completedAt: atUtcHour(day, 20) },
      create: {
        userId,
        goalId: goal.id,
        forDate: day,
        completedAt: atUtcHour(day, 20),
      },
    });
  }

  await createCredit(userId, day, d.creditsEarned, d.mood ? "moodCheckin" : "dailyCheckin", scenario.name);
  await createChatActivity(userId, day, d.chatMessages, scenario.name);

  if (d.memoryNote) {
    await prisma.memory.create({
      data: {
        userId,
        note: d.memoryNote,
        source: MEMORY_SOURCE,
        metadata: { scenario: scenario.name, date: utcDateKey(day) },
        createdAt: atUtcHour(day, 21, 30),
      },
    });
  }
}

export async function writeReportSimulationData(input: WriteReportSimulationDataInput): Promise<WriteReportSimulationDataResult> {
  const scenario = getReportSimulationScenario(input.scenario);
  if (!scenario) {
    throw new Error(`Unknown scenario "${input.scenario}".`);
  }

  const days = Math.max(1, Math.trunc(input.days) || 1);
  const start = parseUtcDay(input.date);
  const username = input.username.trim();
  if (!username) {
    throw new Error("username is required.");
  }

  const user = await prisma.user.findUnique({
    where: { username },
    select: { id: true, username: true },
  });
  if (!user) {
    throw new Error(`User "${username}" not found.`);
  }

  const wrote: string[] = [];
  for (let i = 0; i < days; i++) {
    const day = addUtcDays(start, i);
    await writeDay(user.id, day, scenario, input.replace);
    wrote.push(utcDateKey(day));
  }

  return {
    username: user.username,
    scenario: scenario.name,
    description: scenario.description,
    startDate: utcDateKey(start),
    days,
    replace: input.replace,
    wrote,
  };
}
