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
      orderBy: { periodStart: "desc" },
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

  // Compute AI understanding level from persona data
  let aiUnderstanding = { level: 0, percentage: 0, conversationCount: 0 };
  const persona = await prisma.userPersona.findUnique({ where: { userId } });
  if (persona) {
    const fields = [persona.identity, persona.behavior, persona.expression, persona.preferences];
    const totalItems = fields.reduce((sum: number, f) => {
      if (!f || typeof f !== "object") return sum;
      return sum + Object.values(f as Record<string, unknown>).reduce<number>((s, v) => s + (Array.isArray(v) ? v.length : v ? 1 : 0), 0);
    }, 0);
    const percentage = Math.min(100, Math.round((totalItems / 60) * 100));
    const level = percentage < 20 ? 1 : percentage < 40 ? 2 : percentage < 60 ? 3 : percentage < 80 ? 4 : 5;
    aiUnderstanding = { level, percentage, conversationCount: persona.version };
  }

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
