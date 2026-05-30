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

  // Check auth
  const token = await getAuthCookie();
  const payload = token ? await verifyToken(token) : null;

  if (payload) {
    // --- Authenticated mode: return user's own data ---
    return handleAuthenticatedRequest(payload.userId, periodType, periodStartParam);
  } else {
    // --- Demo mode: return showcase users' data ---
    return handleDemoRequest(periodType);
  }
}

async function handleAuthenticatedRequest(
  userId: string,
  periodType: "weekly" | "monthly",
  periodStartParam: string | null
) {
  let report;
  if (periodStartParam) {
    report = await prisma.report.findUnique({
      where: {
        userId_periodType_periodStart: {
          userId,
          periodType: periodType as "weekly" | "monthly",
          periodStart: new Date(periodStartParam),
        },
      },
      include: { insights: { where: { dismissed: false }, orderBy: { createdAt: "desc" } } },
    });
  } else {
    report = await prisma.report.findFirst({
      where: { userId, periodType },
      orderBy: { periodStart: "desc" },
      include: { insights: { where: { dismissed: false }, orderBy: { createdAt: "desc" } } },
    });
  }

  if (!report) {
    return Response.json({ report: null, globalInsights: [], available: [], demo: false });
  }

  const globalInsights = await prisma.insight.findMany({
    where: { userId, reportId: null, dismissed: false },
    orderBy: { createdAt: "desc" },
  });

  const available = await prisma.report.findMany({
    where: { userId, periodType },
    select: { periodStart: true },
    orderBy: { periodStart: "desc" },
  });

  return Response.json({
    report,
    globalInsights,
    available: available.map((a) => a.periodStart),
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
