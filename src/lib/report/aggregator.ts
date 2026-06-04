/**
 * Report data aggregation layer.
 * Pure database queries — no LLM dependencies.
 */
import { prisma } from "@/lib/prisma";

export type PeriodType = "weekly" | "monthly";

export interface PeriodRange {
  type: PeriodType;
  start: Date;
  end: Date;
  prevStart: Date;
  prevEnd: Date;
}

export interface SleepData {
  daily: (number | null)[]; // hours per day (null = no data)
  avg: number | null;
  prevAvg: number | null;
}

export interface StepsData {
  daily: number[];
  avg: number | null;
  prevAvg: number | null;
}

export interface HeartRateData {
  avg: number | null;
  resting: number | null;
  prevAvg: number | null;
}

export interface WorkoutData {
  count: number;
  totalMinutes: number;
  prevCount: number;
}

export interface WeightData {
  latest: number | null;
  earliest: number | null;
  change: number | null;
}

export interface MoodData {
  emojis: string[]; // one per day in period
  distribution: { calm: number; anxious: number; fatigued: number };
  prevDistribution: { calm: number; anxious: number; fatigued: number };
}

export interface HabitData {
  completionRate: number; // 0-100
  prevCompletionRate: number;
  streaks: { goalTitle: string; current: number; longest: number }[];
  allCompleteDays: number;
  totalGoals: number;
}

export interface EngagementData {
  activeDays: number;
  chatSessions: number;
  creditsEarned: number;
  prevActiveDays: number;
}

export interface ChatData {
  messageCount: number;
  sessionCount: number;
  memoryNotes: string[]; // snippets from Memory records created in period
}

export interface AggregatedPeriodData {
  period: PeriodRange;
  sleep: SleepData;
  steps: StepsData;
  heartRate: HeartRateData;
  workout: WorkoutData;
  weight: WeightData;
  mood: MoodData;
  habits: HabitData;
  engagement: EngagementData;
  chat: ChatData;
  hasAnyData: boolean;
}

const MOOD_EMOJI: Record<string, string> = {
  calm: "😊",
  anxious: "😰",
  fatigued: "😴",
};

/**
 * Compute the period range (current + previous for comparison).
 * Default: current ongoing period (this week / this month).
 */
export function computePeriod(type: PeriodType, periodStart?: Date): PeriodRange {
  const now = new Date();
  let start: Date;
  let end: Date;

  if (type === "weekly") {
    if (periodStart) {
      start = new Date(periodStart);
    } else {
      // Current week (Monday of this week)
      const dayOfWeek = now.getDay() || 7; // Sunday=7
      start = new Date(now);
      start.setDate(now.getDate() - dayOfWeek + 1);
      start.setHours(0, 0, 0, 0);
    }
    end = new Date(start);
    end.setDate(start.getDate() + 7);
  } else {
    if (periodStart) {
      start = new Date(periodStart);
    } else {
      // Current month
      start = new Date(now.getFullYear(), now.getMonth(), 1);
    }
    end = new Date(start.getFullYear(), start.getMonth() + 1, 1);
  }

  // Previous period (same duration, immediately before)
  const durationMs = end.getTime() - start.getTime();
  const prevStart = new Date(start.getTime() - durationMs);
  const prevEnd = new Date(start);

  return { type, start, end, prevStart, prevEnd };
}

/**
 * Aggregate all data sources for a period.
 */
export async function aggregatePeriodData(
  userId: string,
  period: PeriodRange
): Promise<AggregatedPeriodData> {
  const [sleep, steps, heartRate, workout, weight, mood, habits, engagement, chat] = await Promise.all([
    aggregateSleep(userId, period),
    aggregateSteps(userId, period),
    aggregateHeartRate(userId, period),
    aggregateWorkout(userId, period),
    aggregateWeight(userId, period),
    aggregateMood(userId, period),
    aggregateHabits(userId, period),
    aggregateEngagement(userId, period),
    aggregateChat(userId, period),
  ]);

  const hasAnyData =
    sleep.avg !== null ||
    steps.avg !== null ||
    heartRate.avg !== null ||
    workout.count > 0 ||
    mood.emojis.length > 0 ||
    habits.totalGoals > 0 ||
    engagement.activeDays > 0 ||
    chat.sessionCount > 0;

  return { period, sleep, steps, heartRate, workout, weight, mood, habits, engagement, chat, hasAnyData };
}

/** Get number of days in the period. */
function periodDays(period: PeriodRange): number {
  return Math.round((period.end.getTime() - period.start.getTime()) / (86400 * 1000));
}

/** Generate array of dates in the period. */
function periodDateArray(period: PeriodRange): Date[] {
  const days: Date[] = [];
  const d = new Date(period.start);
  while (d < period.end) {
    days.push(new Date(d));
    d.setDate(d.getDate() + 1);
  }
  return days;
}

// ─── Sleep ──────────────────────────────────────────────────────────

async function aggregateSleep(userId: string, period: PeriodRange): Promise<SleepData> {
  const records = await prisma.healthRecord.findMany({
    where: { userId, metric: "sleepAnalysis", startDate: { gte: period.start, lt: period.end } },
    select: { startDate: true, value: true, unit: true },
    orderBy: { startDate: "asc" },
  });

  const prevRecords = await prisma.healthRecord.findMany({
    where: { userId, metric: "sleepAnalysis", startDate: { gte: period.prevStart, lt: period.prevEnd } },
    select: { value: true, unit: true },
  });

  // Group by date, sum durations
  const days = periodDateArray(period);
  const dailyMap = new Map<string, number>();
  for (const r of records) {
    const dateKey = r.startDate.toISOString().slice(0, 10);
    const hours = r.unit === "min" ? r.value / 60 : r.value;
    dailyMap.set(dateKey, (dailyMap.get(dateKey) || 0) + hours);
  }

  const daily = days.map((d) => {
    const key = d.toISOString().slice(0, 10);
    return dailyMap.has(key) ? Math.round(dailyMap.get(key)! * 10) / 10 : null;
  });

  const validDays = daily.filter((v) => v !== null) as number[];
  const avg = validDays.length > 0 ? Math.round((validDays.reduce((a, b) => a + b, 0) / validDays.length) * 10) / 10 : null;

  const prevHours = prevRecords.map((r) => (r.unit === "min" ? r.value / 60 : r.value));
  const prevAvg = prevHours.length > 0 ? Math.round((prevHours.reduce((a, b) => a + b, 0) / prevHours.length) * 10) / 10 : null;

  return { daily, avg, prevAvg };
}

// ─── Steps ──────────────────────────────────────────────────────────

async function aggregateSteps(userId: string, period: PeriodRange): Promise<StepsData> {
  const records = await prisma.healthRecord.findMany({
    where: { userId, metric: "steps", startDate: { gte: period.start, lt: period.end } },
    select: { startDate: true, value: true },
    orderBy: { startDate: "asc" },
  });

  const prevRecords = await prisma.healthRecord.findMany({
    where: { userId, metric: "steps", startDate: { gte: period.prevStart, lt: period.prevEnd } },
    select: { value: true },
  });

  const days = periodDateArray(period);
  const dailyMap = new Map<string, number>();
  for (const r of records) {
    const key = r.startDate.toISOString().slice(0, 10);
    dailyMap.set(key, (dailyMap.get(key) || 0) + r.value);
  }

  const daily = days.map((d) => dailyMap.get(d.toISOString().slice(0, 10)) || 0);
  const nonZero = daily.filter((v) => v > 0);
  const avg = nonZero.length > 0 ? Math.round(nonZero.reduce((a, b) => a + b, 0) / nonZero.length) : null;

  const prevNonZero = prevRecords.map((r) => r.value).filter((v) => v > 0);
  const prevAvg = prevNonZero.length > 0 ? Math.round(prevNonZero.reduce((a, b) => a + b, 0) / prevNonZero.length) : null;

  return { daily, avg, prevAvg };
}

// ─── Heart Rate ─────────────────────────────────────────────────────

async function aggregateHeartRate(userId: string, period: PeriodRange): Promise<HeartRateData> {
  const avgResult = await prisma.healthRecord.aggregate({
    where: { userId, metric: "heartRate", startDate: { gte: period.start, lt: period.end } },
    _avg: { value: true },
  });

  const restingResult = await prisma.healthRecord.aggregate({
    where: { userId, metric: "restingHR", startDate: { gte: period.start, lt: period.end } },
    _avg: { value: true },
  });

  const prevResult = await prisma.healthRecord.aggregate({
    where: { userId, metric: "heartRate", startDate: { gte: period.prevStart, lt: period.prevEnd } },
    _avg: { value: true },
  });

  return {
    avg: avgResult._avg.value ? Math.round(avgResult._avg.value) : null,
    resting: restingResult._avg.value ? Math.round(restingResult._avg.value) : null,
    prevAvg: prevResult._avg.value ? Math.round(prevResult._avg.value) : null,
  };
}

// ─── Workout ────────────────────────────────────────────────────────

async function aggregateWorkout(userId: string, period: PeriodRange): Promise<WorkoutData> {
  const records = await prisma.healthRecord.findMany({
    where: { userId, metric: "workout", startDate: { gte: period.start, lt: period.end } },
    select: { value: true, unit: true },
  });

  const prevRecords = await prisma.healthRecord.findMany({
    where: { userId, metric: "workout", startDate: { gte: period.prevStart, lt: period.prevEnd } },
    select: { value: true },
  });

  const totalMinutes = records.reduce((sum, r) => sum + (r.unit === "sec" ? r.value / 60 : r.value), 0);

  return {
    count: records.length,
    totalMinutes: Math.round(totalMinutes),
    prevCount: prevRecords.length,
  };
}

// ─── Weight ─────────────────────────────────────────────────────────

async function aggregateWeight(userId: string, period: PeriodRange): Promise<WeightData> {
  const records = await prisma.healthRecord.findMany({
    where: { userId, metric: "weight", startDate: { gte: period.start, lt: period.end } },
    select: { value: true, startDate: true },
    orderBy: { startDate: "asc" },
  });

  if (records.length === 0) return { latest: null, earliest: null, change: null };

  const earliest = records[0].value;
  const latest = records[records.length - 1].value;
  return { latest, earliest, change: Math.round((latest - earliest) * 10) / 10 };
}

// ─── Mood ───────────────────────────────────────────────────────────

async function aggregateMood(userId: string, period: PeriodRange): Promise<MoodData> {
  const checkins = await prisma.moodCheckin.findMany({
    where: { userId, createdAt: { gte: period.start, lt: period.end } },
    select: { mood: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });

  const prevCheckins = await prisma.moodCheckin.findMany({
    where: { userId, createdAt: { gte: period.prevStart, lt: period.prevEnd } },
    select: { mood: true },
  });

  // Build emoji array (one per day, use last checkin of the day)
  const days = periodDateArray(period);
  const dayMap = new Map<string, string>();
  for (const c of checkins) {
    dayMap.set(c.createdAt.toISOString().slice(0, 10), MOOD_EMOJI[c.mood] || "😐");
  }
  const emojis = days.map((d) => dayMap.get(d.toISOString().slice(0, 10)) || "").filter(Boolean);

  const distribution = { calm: 0, anxious: 0, fatigued: 0 };
  for (const c of checkins) distribution[c.mood as keyof typeof distribution]++;

  const prevDistribution = { calm: 0, anxious: 0, fatigued: 0 };
  for (const c of prevCheckins) prevDistribution[c.mood as keyof typeof prevDistribution]++;

  return { emojis, distribution, prevDistribution };
}

// ─── Habits ─────────────────────────────────────────────────────────

async function aggregateHabits(userId: string, period: PeriodRange): Promise<HabitData> {
  const goals = await prisma.goal.findMany({
    where: { userId, archived: false },
    select: { id: true, title: true },
  });

  if (goals.length === 0) {
    return { completionRate: 0, prevCompletionRate: 0, streaks: [], allCompleteDays: 0, totalGoals: 0 };
  }

  const goalIds = goals.map((g) => g.id);
  const days = periodDays(period);

  // Current period completions
  const completions = await prisma.habitCompletion.findMany({
    where: { userId, forDate: { gte: period.start, lt: period.end }, goalId: { in: goalIds } },
    select: { goalId: true, forDate: true },
  });

  // Previous period completions
  const prevCompletions = await prisma.habitCompletion.findMany({
    where: { userId, forDate: { gte: period.prevStart, lt: period.prevEnd }, goalId: { in: goalIds } },
    select: { goalId: true },
  });

  const totalPossible = goals.length * days;
  const completionRate = totalPossible > 0 ? Math.round((completions.length / totalPossible) * 100) : 0;
  const prevTotalPossible = goals.length * days;
  const prevCompletionRate = prevTotalPossible > 0 ? Math.round((prevCompletions.length / prevTotalPossible) * 100) : 0;

  // Compute streaks (all time, up to period end)
  const streaks: HabitData["streaks"] = [];
  for (const goal of goals) {
    const allCompletions = await prisma.habitCompletion.findMany({
      where: { goalId: goal.id, forDate: { lt: period.end } },
      select: { forDate: true },
      orderBy: { forDate: "desc" },
    });

    let current = 0;
    let longest = 0;
    let streak = 0;
    const dates = allCompletions.map((c) => c.forDate.toISOString().slice(0, 10));

    // Current streak (consecutive days ending at period.end - 1 day)
    const endDate = new Date(period.end);
    endDate.setDate(endDate.getDate() - 1);
    const checkDate = new Date(endDate);
    while (dates.includes(checkDate.toISOString().slice(0, 10))) {
      current++;
      checkDate.setDate(checkDate.getDate() - 1);
    }

    // Longest streak
    if (dates.length > 0) {
      streak = 1;
      longest = 1;
      const sorted = [...new Set(dates)].sort();
      for (let i = 1; i < sorted.length; i++) {
        const prev = new Date(sorted[i - 1]);
        const curr = new Date(sorted[i]);
        const diff = (curr.getTime() - prev.getTime()) / 86400000;
        if (diff === 1) {
          streak++;
          longest = Math.max(longest, streak);
        } else {
          streak = 1;
        }
      }
    }

    if (current > 0 || longest > 0) {
      streaks.push({ goalTitle: goal.title, current, longest });
    }
  }

  // Days where ALL goals were completed
  const dayCompletionCount = new Map<string, number>();
  for (const c of completions) {
    const key = c.forDate.toISOString().slice(0, 10);
    dayCompletionCount.set(key, (dayCompletionCount.get(key) || 0) + 1);
  }
  const allCompleteDays = [...dayCompletionCount.values()].filter((v) => v >= goals.length).length;

  return { completionRate, prevCompletionRate, streaks, allCompleteDays, totalGoals: goals.length };
}

// ─── Engagement ─────────────────────────────────────────────────────

async function aggregateEngagement(userId: string, period: PeriodRange): Promise<EngagementData> {
  const transactions = await prisma.creditTransaction.findMany({
    where: { userId, direction: "earn", createdAt: { gte: period.start, lt: period.end } },
    select: { createdAt: true, amount: true },
  });

  const prevTransactions = await prisma.creditTransaction.findMany({
    where: { userId, direction: "earn", createdAt: { gte: period.prevStart, lt: period.prevEnd } },
    select: { createdAt: true },
  });

  const chatSessions = await prisma.chatSession.count({
    where: { userId, createdAt: { gte: period.start, lt: period.end } },
  });

  const activeDays = new Set(transactions.map((t) => t.createdAt.toISOString().slice(0, 10))).size;
  const prevActiveDays = new Set(prevTransactions.map((t) => t.createdAt.toISOString().slice(0, 10))).size;
  const creditsEarned = transactions.reduce((sum, t) => sum + t.amount, 0);

  return { activeDays, chatSessions, creditsEarned, prevActiveDays };
}

// ─── Chat & Memories ────────────────────────────────────────────────

async function aggregateChat(userId: string, period: PeriodRange): Promise<ChatData> {
  const [sessionCount, messageCount, memories] = await Promise.all([
    prisma.chatSession.count({
      where: { userId, createdAt: { gte: period.start, lt: period.end } },
    }),
    prisma.chatMessage.count({
      where: {
        session: { userId },
        createdAt: { gte: period.start, lt: period.end },
      },
    }),
    prisma.memory.findMany({
      where: { userId, createdAt: { gte: period.start, lt: period.end } },
      select: { note: true },
      orderBy: { createdAt: "asc" },
      take: 20,
    }),
  ]);

  const memoryNotes = memories
    .map((m) => m.note?.trim())
    .filter((n): n is string => !!n && n.length > 0);

  return { sessionCount, messageCount, memoryNotes };
}



/**
 * Calculate overall wellness score (0-100).
 * Weighted: sleep 30%, workout 25%, mood 20%, habits 25%.
 */
export function calculateOverallScore(data: AggregatedPeriodData): number {
  let score = 0;
  let totalWeight = 0;

  // Sleep score (7-9h = 100, <5h or >10h = 0)
  if (data.sleep.avg !== null) {
    const sleepScore = data.sleep.avg >= 7 && data.sleep.avg <= 9
      ? 100
      : data.sleep.avg >= 6
      ? 70
      : data.sleep.avg >= 5
      ? 40
      : 20;
    score += sleepScore * 0.3;
    totalWeight += 0.3;
  }

  // Workout score (3+/week = 100, 0 = 20)
  if (data.workout.count > 0 || data.period.type === "weekly") {
    const weeklyWorkouts = data.period.type === "weekly" ? data.workout.count : data.workout.count / 4;
    const workoutScore = weeklyWorkouts >= 3 ? 100 : weeklyWorkouts >= 2 ? 75 : weeklyWorkouts >= 1 ? 50 : 20;
    score += workoutScore * 0.25;
    totalWeight += 0.25;
  }

  // Mood score (% calm)
  const totalMood = data.mood.distribution.calm + data.mood.distribution.anxious + data.mood.distribution.fatigued;
  if (totalMood > 0) {
    const moodScore = Math.round((data.mood.distribution.calm / totalMood) * 100);
    score += moodScore * 0.2;
    totalWeight += 0.2;
  }

  // Habit score (completion rate)
  if (data.habits.totalGoals > 0) {
    score += data.habits.completionRate * 0.25;
    totalWeight += 0.25;
  }

  // Normalize if not all weights contributed
  return totalWeight > 0 ? Math.round(score / totalWeight) : 0;
}
