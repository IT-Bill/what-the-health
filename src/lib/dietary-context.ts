// src/lib/dietary-context.ts
// Builds dietary, wearable, time, and health-profile context blocks for AI system prompts.
// These XML-formatted strings are injected into the system prompt to give the model
// awareness of the user's current day diet, wearable state, time-of-day context,
// and personal health preferences.

import { prisma } from "@/lib/prisma";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getStartOfDay(date: Date = new Date()): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function getEndOfDay(date: Date = new Date()): Date {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

function getMealPeriodLabel(hour: number): string {
  if (hour >= 6 && hour <= 10) return "早餐时间";
  if (hour >= 11 && hour <= 14) return "午餐时间";
  if (hour >= 17 && hour <= 21) return "晚餐时间";
  if (hour >= 21 || hour <= 2) return "夜宵时间";
  return "非用餐时间";
}

// ---------------------------------------------------------------------------
// 1. Dietary context — today's meals
// ---------------------------------------------------------------------------

export async function buildDietaryContext(userId: string): Promise<string> {
  const todayStart = getStartOfDay();
  const todayEnd = getEndOfDay();

  const logs = await prisma.dietaryLog.findMany({
    where: {
      userId,
      logDate: {
        gte: todayStart,
        lte: todayEnd,
      },
    },
    orderBy: { loggedAt: "desc" },
    select: {
      mealType: true,
      rawInput: true,
      totalCalories: true,
      aiEvaluation: true,
    },
  });

  if (logs.length === 0) {
    return `<user_today_diet>\n今日尚未记录任何餐食\n</user_today_diet>`;
  }

  const totalCalories = logs.reduce((sum, log) => sum + (log.totalCalories ?? 0), 0);
  const mealCount = logs.length;

  const lines: string[] = [
    `今日已记录 ${mealCount} 餐，总热量约 ${Math.round(totalCalories)} kcal`,
  ];

  // Show the most recent 3 meals
  logs.slice(0, 3).forEach((log) => {
    const mealLabel = getMealTypeLabel(log.mealType);
    let entry = `- ${mealLabel}: ${log.rawInput}`;

    if (log.totalCalories) {
      entry += `（约 ${Math.round(log.totalCalories)} kcal）`;
    }

    // Briefly show AI evaluation score if available
    const score = extractAiScore(log.aiEvaluation);
    if (score !== null) {
      entry += ` [AI评分: ${score}/10]`;
    }

    lines.push(entry);
  });

  return `<user_today_diet>\n${lines.join("\n")}\n</user_today_diet>`;
}

function getMealTypeLabel(mealType: string): string {
  switch (mealType) {
    case "breakfast":
      return "早餐";
    case "lunch":
      return "午餐";
    case "dinner":
      return "晚餐";
    case "snack":
      return "加餐";
    default:
      return mealType;
  }
}

function extractAiScore(aiEvaluation: unknown): number | null {
  if (!aiEvaluation || typeof aiEvaluation !== "object") return null;
  const score = (aiEvaluation as Record<string, unknown>).score;
  if (typeof score === "number") return score;
  return null;
}

// ---------------------------------------------------------------------------
// 2. Wearable context — today's health records
// ---------------------------------------------------------------------------

export async function buildWearableContext(userId: string): Promise<string> {
  const todayStart = getStartOfDay();

  const records = await prisma.healthRecord.findMany({
    where: {
      userId,
      startDate: {
        gte: todayStart,
      },
    },
    select: {
      metric: true,
      value: true,
      unit: true,
      startDate: true,
      metadata: true,
    },
  });

  if (records.length === 0) {
    return "";
  }

  // Aggregate metrics
  const stepsRecords = records.filter((r) => r.metric === "steps");
  const totalSteps = stepsRecords.reduce((sum, r) => sum + r.value, 0);

  const caloriesRecords = records.filter((r) => r.metric === "calories");
  const totalCalories = caloriesRecords.reduce((sum, r) => sum + r.value, 0);

  const heartRateRecords = records.filter((r) => r.metric === "heartRate");
  const avgHeartRate =
    heartRateRecords.length > 0
      ? heartRateRecords.reduce((sum, r) => sum + r.value, 0) / heartRateRecords.length
      : null;

  // Sleep: take the latest sleepAnalysis record of the day
  const sleepRecords = records
    .filter((r) => r.metric === "sleepAnalysis")
    .sort((a, b) => b.startDate.getTime() - a.startDate.getTime());
  const latestSleep = sleepRecords[0] ?? null;

  const lines: string[] = [];

  if (totalSteps > 0) {
    lines.push(`- 今日步数: ${Math.round(totalSteps)} 步`);
  }
  if (totalCalories > 0) {
    lines.push(`- 活动热量: ${Math.round(totalCalories)} kcal`);
  }
  if (avgHeartRate !== null) {
    lines.push(`- 平均心率: ${Math.round(avgHeartRate)} bpm`);
  }
  if (latestSleep) {
    const sleepValue = latestSleep.value;
    const sleepUnit = latestSleep.unit || "小时";
    lines.push(`- 最新睡眠: ${sleepValue} ${sleepUnit}`);

    // If metadata contains sleep stages or quality, append briefly
    const sleepQuality = extractSleepQuality(latestSleep.metadata);
    if (sleepQuality) {
      lines[lines.length - 1] += `（睡眠质量: ${sleepQuality}）`;
    }
  }

  if (lines.length === 0) {
    return "";
  }

  return `<user_wearable_state>\n${lines.join("\n")}\n</user_wearable_state>`;
}

function extractSleepQuality(metadata: unknown): string | null {
  if (!metadata || typeof metadata !== "object") return null;
  const meta = metadata as Record<string, unknown>;

  if (typeof meta.quality === "string") return meta.quality;
  if (typeof meta.sleepScore === "number") return `${meta.sleepScore}`;
  if (typeof meta.efficiency === "number") return `${meta.efficiency}%`;

  return null;
}

// ---------------------------------------------------------------------------
// 3. Time context — current time and meal period
// ---------------------------------------------------------------------------

export function buildTimeContext(): string {
  const now = new Date();
  const hour = now.getHours();
  const minute = now.getMinutes();
  const timeStr = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
  const periodLabel = getMealPeriodLabel(hour);

  return `<current_context>\n当前时间: ${timeStr}，${periodLabel}\n</current_context>`;
}

// ---------------------------------------------------------------------------
// 4. Health profile context — user preferences & constraints
// ---------------------------------------------------------------------------

export async function buildHealthProfileContext(userId: string): Promise<string> {
  const profile = await prisma.userHealthProfile.findUnique({
    where: { userId },
    select: {
      dietaryPreference: true,
      foodAllergies: true,
      foodIntolerances: true,
      tastePreferences: true,
      dislikedFoods: true,
      medicalConditions: true,
      medications: true,
      exerciseConstraints: true,
      occupationType: true,
      workSchedule: true,
      cookingSkill: true,
      cookingFrequency: true,
      hasWearable: true,
    },
  });

  if (!profile) {
    return "";
  }

  const lines: string[] = [];

  if (profile.dietaryPreference) {
    lines.push(`- 饮食偏好: ${profile.dietaryPreference}`);
  }
  if (profile.foodAllergies.length > 0) {
    lines.push(`- 食物过敏: ${profile.foodAllergies.join("、")}`);
  }
  if (profile.foodIntolerances.length > 0) {
    lines.push(`- 不耐受: ${profile.foodIntolerances.join("、")}`);
  }
  if (profile.tastePreferences.length > 0) {
    lines.push(`- 口味偏好: ${profile.tastePreferences.join("、")}`);
  }
  if (profile.dislikedFoods.length > 0) {
    lines.push(`- 不喜欢: ${profile.dislikedFoods.join("、")}`);
  }
  if (profile.medicalConditions.length > 0) {
    lines.push(`- 健康状况: ${profile.medicalConditions.join("、")}`);
  }
  if (profile.medications.length > 0) {
    lines.push(`- 用药: ${profile.medications.join("、")}`);
  }
  if (profile.exerciseConstraints.length > 0) {
    lines.push(`- 运动限制: ${profile.exerciseConstraints.join("、")}`);
  }
  if (profile.occupationType) {
    lines.push(`- 职业类型: ${profile.occupationType}`);
  }
  if (profile.workSchedule) {
    lines.push(`- 工作作息: ${profile.workSchedule}`);
  }
  if (profile.cookingSkill) {
    lines.push(`- 烹饪水平: ${profile.cookingSkill}`);
  }
  if (profile.cookingFrequency) {
    lines.push(`- 烹饪频率: ${profile.cookingFrequency}`);
  }
  lines.push(`- 可穿戴设备: ${profile.hasWearable ? "已绑定" : "未绑定"}`);

  if (lines.length === 0) {
    return "";
  }

  return `<user_health_profile>\n${lines.join("\n")}\n</user_health_profile>`;
}
