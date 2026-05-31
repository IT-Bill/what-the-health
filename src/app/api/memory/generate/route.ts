import { prisma } from "@/lib/prisma";
import { getAuthCookie, verifyToken } from "@/lib/auth";
import { computePeriod, aggregatePeriodData } from "@/lib/report/aggregator";
import { generateReport } from "@/lib/report/generator";
import type { PeriodType as PrismaPeriodType, InsightType, Prisma } from "@/generated/prisma/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/memory/generate
 * Generate a wellness report for a given period.
 * Body: { type: "weekly" | "monthly", periodStart?: string (ISO date) }
 */
export async function POST(request: Request) {
  try {
    const token = await getAuthCookie();
    if (!token) return Response.json({ error: "未登录" }, { status: 401 });
    const payload = await verifyToken(token);
    if (!payload) return Response.json({ error: "登录已过期" }, { status: 401 });

    const userId = payload.userId;

    let body: { type?: string; periodStart?: string };
    try {
      body = await request.json();
    } catch {
      body = {};
    }

    const periodType = (body.type === "monthly" ? "monthly" : "weekly") as "weekly" | "monthly";
    const periodStart = body.periodStart ? new Date(body.periodStart) : undefined;

    // Compute period range
    const period = computePeriod(periodType, periodStart);

    // Find latest version for this period (if any)
    const latestReport = await prisma.report.findFirst({
      where: {
        userId,
        periodType: periodType as PrismaPeriodType,
        periodStart: period.start,
      },
      orderBy: { version: "desc" },
      select: { version: true },
    });
    const nextVersion = (latestReport?.version ?? 0) + 1;

    // Aggregate data
    const aggregated = await aggregatePeriodData(userId, period);

    if (!aggregated.hasAnyData) {
      return Response.json({
        status: "no_data",
        message: "该周期暂无数据，无法生成报告。请先导入健康数据、记录情绪或完成习惯。",
      }, { status: 400 });
    }

    // Get persona context for personalized generation
    let personaContext: string | null = null;
    try {
      const persona = await prisma.userPersona.findUnique({ where: { userId } });
      if (persona) {
        const { personaToSystemPromptText } = await import("@/lib/persona-types");
        personaContext = personaToSystemPromptText(persona as unknown as Parameters<typeof personaToSystemPromptText>[0]);
      }
    } catch {
      // Persona not available — proceed without it
    }

    // Generate report (aggregation + LLM)
    const generated = await generateReport(aggregated, personaContext);

    // Save report to DB
    const report = await prisma.report.create({
      data: {
        userId,
        periodType: periodType as PrismaPeriodType,
        periodStart: period.start,
        periodEnd: period.end,
        version: nextVersion,
        data: generated.data as unknown as Prisma.InputJsonValue,
        summary: generated.summary || null,
      },
    });

    // Save insights
    const insightRecords = [];
    for (const insight of generated.insights) {
      const record = await prisma.insight.create({
        data: {
          userId,
          reportId: report.id,
          type: insight.type as InsightType,
          title: insight.title,
          content: insight.content,
          metadata: (insight.metadata || {}) as Prisma.InputJsonValue,
        },
      });
      insightRecords.push(record);
    }

    return Response.json({
      status: "generated",
      report: { ...report, insights: insightRecords },
    });
  } catch (err) {
    console.error("[memory/generate] Error:", err);
    const message = err instanceof Error ? err.message : "生成报告失败";
    return Response.json({ error: message }, { status: 500 });
  }
}
