import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/memory?type=weekly|monthly&periodStart=2025-05-26
// Returns the report + related insights for the given period.
// If no periodStart, returns the most recent report of that type.
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const periodType = searchParams.get("type") === "monthly" ? "monthly" : "weekly";
  const periodStartParam = searchParams.get("periodStart");

  // For the demo, use a hardcoded userId (first user).
  // Replace with auth session in production.
  const user = await prisma.user.findFirst();
  if (!user) {
    return Response.json({ error: "No user found" }, { status: 404 });
  }

  let report;
  if (periodStartParam) {
    report = await prisma.report.findUnique({
      where: {
        userId_periodType_periodStart: {
          userId: user.id,
          periodType,
          periodStart: new Date(periodStartParam),
        },
      },
      include: { insights: { where: { dismissed: false }, orderBy: { createdAt: "desc" } } },
    });
  } else {
    report = await prisma.report.findFirst({
      where: { userId: user.id, periodType },
      orderBy: { periodStart: "desc" },
      include: { insights: { where: { dismissed: false }, orderBy: { createdAt: "desc" } } },
    });
  }

  if (!report) {
    return Response.json({ report: null, insights: [], available: [] });
  }

  // Also fetch global (non-report-linked) insights for the insights tab
  const globalInsights = await prisma.insight.findMany({
    where: { userId: user.id, reportId: null, dismissed: false },
    orderBy: { createdAt: "desc" },
  });

  // Fetch available period starts so the frontend can show nav arrows
  const available = await prisma.report.findMany({
    where: { userId: user.id, periodType },
    select: { periodStart: true },
    orderBy: { periodStart: "desc" },
  });

  return Response.json({
    report,
    globalInsights,
    available: available.map((a) => a.periodStart),
  });
}
