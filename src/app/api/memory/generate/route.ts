import { getAuthCookie, verifyToken } from "@/lib/auth";
import { generateWellnessReportForUser } from "@/lib/report/service";

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

    const { report } = await generateWellnessReportForUser({
      userId,
      periodType,
      periodStart,
      signal: request.signal,
    });

    return Response.json({
      status: "generated",
      report,
    });
  } catch (err) {
    console.error("[memory/generate] Error:", err);
    const message = err instanceof Error ? err.message : "生成报告失败";
    return Response.json({ error: message }, { status: 500 });
  }
}
