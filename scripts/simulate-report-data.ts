/**
 * Memory report data simulator — writes one or more days of data directly to DB.
 *
 * Usage:
 *   pnpm exec tsx -r dotenv/config scripts/simulate-report-data.ts --list
 *   pnpm exec tsx -r dotenv/config scripts/simulate-report-data.ts --user bill2 --date 2026-06-03 --scenario sleep-low
 *   pnpm exec tsx -r dotenv/config scripts/simulate-report-data.ts --user bill2 --date 2026-06-01 --days 7 --scenario active
 *
 * Defaults:
 *   --user bill2
 *   --date today (UTC)
 *   --scenario balanced
 *   --replace true (removes this simulator's rows for the target date first)
 */

import { config } from "dotenv";
import { prisma } from "@/lib/prisma";
import type { CreditAction, HealthMetricType, Mood, Prisma } from "@/generated/prisma/client";

config({ path: ".env" });
config({ path: ".env.local", override: true });

// ---------------------------------------------------------------------------
// CLI args
// ---------------------------------------------------------------------------

const argv = process.argv.slice(2);
const flag = (name: string) => argv.includes(name);
const opt = (name: string, def: string) => {
  const i = argv.indexOf(name);
  return i !== -1 && argv[i + 1] ? argv[i + 1] : def;
};

const USER = opt("--user", "bill2");
const DATE = opt("--date", new Date().toISOString().slice(0, 10));
const SCENARIO = opt("--scenario", "balanced");
const DAYS = Math.max(1, Number.parseInt(opt("--days", "1"), 10) || 1);
const LIST = flag("--list");
const REPLACE = !flag("--no-replace");

const SOURCE_NAME = "Report Data Simulator";
const MEMORY_SOURCE = "report-simulator";
const CHAT_TITLE_PREFIX = "[sim-report]";
const MOOD_NOTE_PREFIX = "[sim-report]";
const CREDIT_NOTE_PREFIX = "[sim-report]";

// ---------------------------------------------------------------------------
// Scenario definitions
// ---------------------------------------------------------------------------

type MoodValue = "calm" | "anxious" | "fatigued";

interface ScenarioDay {
  sleepHours: number | null;
  steps: number | null;
  heartRate: number | null;
  restingHR: number | null;
  workoutMinutes: number | null;
  weightKg?: number | null;
  mood: MoodValue | null;
  habitCompletions: number;
  creditsEarned: number;
  chatMessages: number;
  memoryNote: string | null;
}

interface Scenario {
  name: string;
  description: string;
  day: ScenarioDay;
}

const SCENARIOS: Scenario[] = [
  {
    name: "balanced",
    description: "基础健康日：睡眠、步数、轻运动、平稳情绪都有记录",
    day: {
      sleepHours: 7.4,
      steps: 8200,
      heartRate: 72,
      restingHR: 62,
      workoutMinutes: 28,
      weightKg: null,
      mood: "calm",
      habitCompletions: 2,
      creditsEarned: 12,
      chatMessages: 2,
      memoryNote: "今天状态比较稳定，按计划完成了基础活动。",
    },
  },
  {
    name: "sleep-low",
    description: "睡眠不足：睡眠少、步数少、疲惫情绪，适合测试睡眠下滑洞察",
    day: {
      sleepHours: 3.6,
      steps: 2600,
      heartRate: 82,
      restingHR: 70,
      workoutMinutes: 0,
      mood: "fatigued",
      habitCompletions: 0,
      creditsEarned: 4,
      chatMessages: 2,
      memoryNote: "昨晚睡得很少，白天明显有些疲惫。",
    },
  },
  {
    name: "active",
    description: "运动多：高步数、较长运动、平稳心率，适合测试运动亮点",
    day: {
      sleepHours: 7.1,
      steps: 14500,
      heartRate: 76,
      restingHR: 58,
      workoutMinutes: 55,
      mood: "calm",
      habitCompletions: 3,
      creditsEarned: 24,
      chatMessages: 1,
      memoryNote: "今天运动量很足，散步和训练都完成了。",
    },
  },
  {
    name: "stressed",
    description: "压力偏高：睡眠偏短、心率偏高、焦虑情绪",
    day: {
      sleepHours: 5.2,
      steps: 4300,
      heartRate: 92,
      restingHR: 76,
      workoutMinutes: 0,
      mood: "anxious",
      habitCompletions: 0,
      creditsEarned: 6,
      chatMessages: 3,
      memoryNote: "今天压力比较大，晚上需要更早停下来休息。",
    },
  },
  {
    name: "recovery",
    description: "恢复日：睡眠改善、轻活动、正向情绪",
    day: {
      sleepHours: 8.2,
      steps: 6800,
      heartRate: 68,
      restingHR: 57,
      workoutMinutes: 18,
      mood: "calm",
      habitCompletions: 2,
      creditsEarned: 16,
      chatMessages: 2,
      memoryNote: "今天有意识放慢节奏，睡眠和精神状态都有恢复。",
    },
  },
  {
    name: "quiet",
    description: "安静日：只写少量对话/记忆，不写核心健康指标",
    day: {
      sleepHours: null,
      steps: null,
      heartRate: null,
      restingHR: null,
      workoutMinutes: null,
      mood: null,
      habitCompletions: 0,
      creditsEarned: 2,
      chatMessages: 2,
      memoryNote: "今天只是简单记录了一下近况。",
    },
  },
];

// ---------------------------------------------------------------------------
// Date helpers
// ---------------------------------------------------------------------------

function utcDay(dateText: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateText)) {
    throw new Error(`Invalid --date "${dateText}". Expected YYYY-MM-DD.`);
  }
  return new Date(`${dateText}T00:00:00.000Z`);
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function atHour(day: Date, hour: number, minute = 0): Date {
  return new Date(Date.UTC(
    day.getUTCFullYear(),
    day.getUTCMonth(),
    day.getUTCDate(),
    hour,
    minute,
    0,
    0
  ));
}

function dateKey(day: Date): string {
  return day.toISOString().slice(0, 10);
}

// ---------------------------------------------------------------------------
// Data writing
// ---------------------------------------------------------------------------

function printList() {
  console.log("Available scenarios:\n");
  const pad = Math.max(...SCENARIOS.map((s) => s.name.length));
  for (const scenario of SCENARIOS) {
    const d = scenario.day;
    console.log(`  ${scenario.name.padEnd(pad)}  ${scenario.description}`);
    console.log(
      `  ${"".padEnd(pad)}  sleep=${d.sleepHours ?? "-"}h steps=${d.steps ?? "-"} workout=${d.workoutMinutes ?? "-"}min mood=${d.mood ?? "-"} habits=${d.habitCompletions}`
    );
    console.log();
  }
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
  const end = addDays(day, 1);

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
      title: { startsWith: `${CHAT_TITLE_PREFIX} ${dateKey(day)}` },
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
  const startDate = atHour(input.day, input.hour);
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
      createdAt: atHour(day, 20),
    },
  });
  await prisma.user.update({ where: { id: userId }, data: { credits: balance } });
}

async function createChatActivity(userId: string, day: Date, messageCount: number, scenario: string) {
  if (messageCount <= 0) return;
  const session = await prisma.chatSession.create({
    data: {
      userId,
      title: `${CHAT_TITLE_PREFIX} ${dateKey(day)} ${scenario}`,
      createdAt: atHour(day, 19),
      updatedAt: atHour(day, 19, Math.min(59, messageCount * 3)),
    },
  });

  for (let i = 0; i < messageCount; i++) {
    await prisma.chatMessage.create({
      data: {
        sessionId: session.id,
        role: i % 2 === 0 ? "user" : "assistant",
        content: i % 2 === 0 ? "今天记录一下身体状态。" : "我会帮你把这些变化记下来。",
        createdAt: atHour(day, 19, i * 3),
      },
    });
  }
}

async function writeDay(userId: string, day: Date, scenario: Scenario) {
  const d = scenario.day;
  if (REPLACE) await clearSimulatedDay(userId, day);

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
        createdAt: atHour(day, 21),
      },
    });
  }

  const goals = await ensureHabits(userId);
  const completeCount = Math.min(d.habitCompletions, goals.length);
  for (const goal of goals.slice(0, completeCount)) {
    await prisma.habitCompletion.upsert({
      where: { goalId_forDate: { goalId: goal.id, forDate: day } },
      update: { completedAt: atHour(day, 20) },
      create: {
        userId,
        goalId: goal.id,
        forDate: day,
        completedAt: atHour(day, 20),
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
        metadata: { scenario: scenario.name, date: dateKey(day) },
        createdAt: atHour(day, 21, 30),
      },
    });
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  if (LIST) {
    printList();
    return;
  }

  const scenario = SCENARIOS.find((s) => s.name === SCENARIO);
  if (!scenario) {
    console.error(`Unknown scenario "${SCENARIO}". Run --list to see options.`);
    process.exit(1);
  }

  const user = await prisma.user.findUnique({
    where: { username: USER },
    select: { id: true, username: true },
  });
  if (!user) {
    console.error(`User "${USER}" not found.`);
    process.exit(1);
  }

  const start = utcDay(DATE);
  console.log(`User     : ${user.username}`);
  console.log(`Scenario : ${scenario.name} - ${scenario.description}`);
  console.log(`Dates    : ${dateKey(start)}${DAYS > 1 ? ` + ${DAYS - 1} day(s)` : ""}`);
  console.log(`Replace  : ${REPLACE ? "yes" : "no"}`);
  console.log();

  for (let i = 0; i < DAYS; i++) {
    const day = addDays(start, i);
    await writeDay(user.id, day, scenario);
    console.log(`✓ wrote ${dateKey(day)}`);
  }

  console.log("\nDone. Regenerate the Memory weekly/monthly report to see the simulated data.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
