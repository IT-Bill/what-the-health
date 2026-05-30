import { prisma } from "@/lib/prisma";
import { getAuthCookie, verifyToken } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/health/records?metric=steps&from=2024-01-01&to=2024-01-31&limit=1000
// Query imported health records with filters.
export async function GET(request: Request) {
  const token = await getAuthCookie();
  if (!token) return Response.json({ error: "未登录" }, { status: 401 });
  const payload = await verifyToken(token);
  if (!payload) return Response.json({ error: "登录已过期" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const metric = searchParams.get("metric");
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const limit = Math.min(parseInt(searchParams.get("limit") || "500"), 5000);

  const where: Record<string, unknown> = { userId: payload.userId };

  if (metric) {
    where.metric = metric;
  }

  if (from || to) {
    const dateFilter: Record<string, Date> = {};
    if (from) dateFilter.gte = new Date(from);
    if (to) dateFilter.lte = new Date(to);
    where.startDate = dateFilter;
  }

  const records = await prisma.healthRecord.findMany({
    where,
    orderBy: { startDate: "desc" },
    take: limit,
    select: {
      id: true,
      metric: true,
      value: true,
      unit: true,
      startDate: true,
      endDate: true,
      metadata: true,
      sourceName: true,
      source: true,
    },
  });

  // Also return aggregate stats
  const stats = await prisma.healthRecord.groupBy({
    by: ["metric"],
    where: { userId: payload.userId, ...(from || to ? { startDate: where.startDate as object } : {}) },
    _count: true,
    _avg: { value: true },
    _min: { startDate: true, value: true },
    _max: { startDate: true, value: true },
  });

  return Response.json({ records, stats });
}
