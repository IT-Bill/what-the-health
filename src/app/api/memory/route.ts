import { prisma } from "@/lib/prisma";
import { getAuthCookie, verifyToken } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/memory?type=weekly|monthly&periodStart=2025-05-26
// - Authenticated: returns the current user's report
// - Unauthenticated: returns showcase users' reports as demo
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const periodType = searchParams.get("type") === "monthly" ? "monthly" as const : "weekly" as const;
  const periodStartParam = searchParams.get("periodStart");
  const versionParam = searchParams.get("version");

  // Check auth
  const token = await getAuthCookie();
  const payload = token ? await verifyToken(token) : null;

  if (payload) {
    // --- Authenticated mode: return user's own data ---
    return handleAuthenticatedRequest(payload.userId, periodType, periodStartParam, versionParam);
  } else {
    // --- Demo mode: return showcase users' data ---
    return handleDemoRequest(periodType);
  }
}

async function handleAuthenticatedRequest(
  userId: string,
  periodType: "weekly" | "monthly",
  periodStartParam: string | null,
  versionParam: string | null
) {
  let report;
  if (periodStartParam) {
    // Get specific period, optionally specific version
    const where: Record<string, unknown> = {
      userId,
      periodType: periodType as "weekly" | "monthly",
      periodStart: new Date(periodStartParam),
    };
    if (versionParam) where.version = parseInt(versionParam, 10);

    report = await prisma.report.findFirst({
      where,
      orderBy: { version: "desc" },
      include: { insights: { where: { dismissed: false }, orderBy: { createdAt: "desc" } } },
    });
  } else {
    report = await prisma.report.findFirst({
      where: { userId, periodType },
      orderBy: [{ periodStart: "desc" }, { version: "desc" }],
      include: { insights: { where: { dismissed: false }, orderBy: { createdAt: "desc" } } },
    });
  }

  const globalInsights = await prisma.insight.findMany({
    where: { userId, reportId: null, dismissed: false },
    orderBy: { createdAt: "desc" },
  });

  const allReports = await prisma.report.findMany({
    where: { userId, periodType },
    select: { periodStart: true, version: true, createdAt: true },
    orderBy: [{ periodStart: "desc" }, { version: "desc" }],
  });

  // Deduplicated period list (for left/right navigation)
  const available = [...new Set(allReports.map((r) => r.periodStart.toISOString()))];

  // Versions for the current report's period (with createdAt for display)
  const currentPeriodStart = report?.periodStart;
  const versions = currentPeriodStart
    ? allReports
        .filter((r) => r.periodStart.toISOString() === currentPeriodStart.toISOString())
        .map((r) => ({ version: r.version, createdAt: r.createdAt.toISOString() }))
        .sort((a, b) => b.version - a.version)
    : [];

  // Compute AI understanding level from multiple data dimensions
  let aiUnderstanding: {
    level: number; percentage: number; conversationCount: number;
    breakdown: { dimension: string; weight: number; score: number; filled: string[]; missing: string[] }[];
  } = { level: 1, percentage: 0, conversationCount: 0, breakdown: [] };

  const [persona, user, healthProfile, behaviorCounts, healthRecordCount] = await Promise.all([
    prisma.userPersona.findUnique({ where: { userId } }),
    prisma.user.findUnique({
      where: { id: userId },
      select: { heightCm: true, weightKg: true, gender: true, birthday: true, primaryGoal: true, primaryGoals: true },
    }),
    prisma.userHealthProfile.findUnique({ where: { userId } }),
    prisma.$transaction([
      prisma.moodCheckin.count({ where: { userId } }),
      prisma.habitCompletion.count({ where: { userId } }),
      prisma.memory.count({ where: { userId } }),
      prisma.dietaryLog.count({ where: { userId } }),
    ]),
    prisma.healthRecord.count({
      where: { userId, startDate: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } },
    }),
  ]);

  // --- 25%: 基础档案 ---
  const profileItems = [
    { label: "身高", value: user?.heightCm },
    { label: "体重", value: user?.weightKg },
    { label: "性别", value: user?.gender },
    { label: "生日", value: user?.birthday },
    { label: "健康目标", value: (user?.primaryGoals?.length ?? 0) > 0 || user?.primaryGoal },
  ];
  const profileFilled = profileItems.filter(i => i.value).map(i => i.label);
  const profileMissing = profileItems.filter(i => !i.value).map(i => i.label);
  const profileScore = (profileFilled.length / profileItems.length) * 25;

  // --- 20%: 健康档案 ---
  const hpItems = [
    { label: "饮食偏好", value: healthProfile?.dietaryPreference },
    { label: "食物过敏", value: (healthProfile?.foodAllergies as string[] | null)?.length },
    { label: "健康状况", value: (healthProfile?.medicalConditions as string[] | null)?.length },
    { label: "职业强度", value: healthProfile?.occupationType },
    { label: "烹饪水平", value: healthProfile?.cookingSkill },
    { label: "作息类型", value: healthProfile?.workSchedule },
    { label: "做饭频率", value: healthProfile?.cookingFrequency },
    { label: "口味偏好", value: (healthProfile?.tastePreferences as string[] | null)?.length },
  ];
  const hpFilled = hpItems.filter(i => i.value).map(i => i.label);
  const hpMissing = hpItems.filter(i => !i.value).map(i => i.label);
  const healthProfileScore = (hpFilled.length / hpItems.length) * 20;

  // --- 30%: 对话深度 ---
  let personaScore = 0;
  const personaFilled: string[] = [];
  const personaMissing: string[] = [];
  if (persona) {
    const fields = [persona.identity, persona.behavior, persona.expression, persona.preferences];
    const totalItems = fields.reduce((sum: number, f) => {
      if (!f || typeof f !== "object") return sum;
      return sum + Object.values(f as Record<string, unknown>).reduce<number>(
        (s, v) => s + (Array.isArray(v) ? v.length : v ? 1 : 0), 0
      );
    }, 0);
    const fillRatio = Math.min(1, totalItems / 40);
    const versionRatio = Math.min(1, (persona.version ?? 0) / 10);
    personaScore = (fillRatio * 0.7 + versionRatio * 0.3) * 30;

    const personaLabels = [
      { label: "生活方式标签", v: (persona.identity as Record<string, unknown>)?.lifestyleTags },
      { label: "角色/身份", v: (persona.identity as Record<string, unknown>)?.role },
      { label: "日常规律", v: (persona.behavior as Record<string, unknown>)?.routines },
      { label: "习惯模式", v: (persona.behavior as Record<string, unknown>)?.habitPatterns },
      { label: "语言风格", v: (persona.expression as Record<string, unknown>)?.languageStyle },
      { label: "偏好焦点", v: (persona.preferences as Record<string, unknown>)?.focusAreas },
    ];
    for (const { label, v } of personaLabels) {
      if (Array.isArray(v) ? v.length > 0 : !!v) personaFilled.push(label);
      else personaMissing.push(label);
    }
    if ((persona.version ?? 0) > 0) personaFilled.push(`对话更新 ${persona.version} 次`);
    else personaMissing.push("尚未开始对话");
  } else {
    personaMissing.push("未开始对话", "生活方式标签", "角色/身份", "日常规律", "语言风格");
  }

  // --- 15%: 行为数据 ---
  const [moodCount, habitCount, journalCount, dietCount] = behaviorCounts;
  const behaviorScore = Math.min(15,
    Math.min(5, moodCount / 3) +
    Math.min(5, habitCount / 6) +
    Math.min(2.5, journalCount / 2) +
    Math.min(2.5, dietCount / 4)
  );
  const behaviorFilled: string[] = [];
  const behaviorMissing: string[] = [];
  if (moodCount > 0) behaviorFilled.push(`情绪打卡 ${moodCount} 次`); else behaviorMissing.push("情绪打卡（建议 15 次）");
  if (habitCount > 0) behaviorFilled.push(`习惯完成 ${habitCount} 次`); else behaviorMissing.push("习惯打卡（建议 30 次）");
  if (journalCount > 0) behaviorFilled.push(`日记 ${journalCount} 条`); else behaviorMissing.push("日记记录");
  if (dietCount > 0) behaviorFilled.push(`饮食记录 ${dietCount} 条`); else behaviorMissing.push("饮食记录");

  // --- 10%: 健康数据 ---
  const wearableScore = Math.min(10, healthRecordCount / 3);
  const wearableFilled = healthRecordCount > 0 ? [`近 30 天健康记录 ${healthRecordCount} 条`] : [];
  const wearableMissing = healthRecordCount === 0 ? ["可穿戴设备数据（近 30 天，建议 30 条）"] : [];

  const breakdown = [
    { dimension: "基础档案", weight: 25, score: Math.round(profileScore), filled: profileFilled, missing: profileMissing },
    { dimension: "健康档案", weight: 20, score: Math.round(healthProfileScore), filled: hpFilled, missing: hpMissing },
    { dimension: "对话深度", weight: 30, score: Math.round(personaScore), filled: personaFilled, missing: personaMissing },
    { dimension: "行为数据", weight: 15, score: Math.round(behaviorScore), filled: behaviorFilled, missing: behaviorMissing },
    { dimension: "健康数据", weight: 10, score: Math.round(wearableScore), filled: wearableFilled, missing: wearableMissing },
  ];

  const percentage = Math.min(100, Math.round(
    profileScore + healthProfileScore + personaScore + behaviorScore + wearableScore
  ));
  const level = percentage < 20 ? 1 : percentage < 40 ? 2 : percentage < 60 ? 3 : percentage < 80 ? 4 : 5;
  aiUnderstanding = { level, percentage, conversationCount: persona?.version ?? 0, breakdown };

  return Response.json({
    report: report || null,
    globalInsights,
    available,
    versions,
    aiUnderstanding,
    demo: false,
  });
}

async function handleDemoRequest(periodType: "weekly" | "monthly") {
  // Find showcase users
  const showcaseUsers = await prisma.user.findMany({
    where: { isShowcase: true },
    select: { id: true, username: true, name: true, avatarUrl: true },
  });

  if (showcaseUsers.length === 0) {
    return Response.json({ demos: [], demo: true });
  }

  // For each showcase user, fetch their latest report of the requested type
  const demos = await Promise.all(
    showcaseUsers.map(async (user) => {
      const report = await prisma.report.findFirst({
        where: { userId: user.id, periodType },
        orderBy: { periodStart: "desc" },
        select: {
          id: true,
          periodType: true,
          periodStart: true,
          periodEnd: true,
          summary: true,
          data: true,
        },
      });

      const insights = await prisma.insight.findMany({
        where: { userId: user.id, dismissed: false },
        orderBy: { createdAt: "desc" },
        take: 3,
        select: { id: true, type: true, title: true, content: true },
      });

      return {
        user,
        report,
        insights,
      };
    })
  );

  return Response.json({ demos, demo: true });
}
