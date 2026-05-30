import { prisma } from "@/lib/prisma";
import { getAuthCookie, verifyToken } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/health/dedup — remove duplicate health records.
 * Duplicates are defined as records with the same (userId, metric, startDate, endDate, value).
 * Keeps the oldest record, deletes newer duplicates.
 */
export async function POST() {
  const token = await getAuthCookie();
  if (!token) return Response.json({ error: "未登录" }, { status: 401 });
  const payload = await verifyToken(token);
  if (!payload) return Response.json({ error: "登录已过期" }, { status: 401 });

  const userId = payload.userId;

  // Find duplicates using raw SQL (Prisma doesn't support GROUP BY HAVING directly for this)
  // Strategy: find all records that share (metric, startDate, endDate, value) with another record,
  // keep the one with the earliest createdAt, delete the rest.
  const duplicates = await prisma.$queryRaw<Array<{ id: string }>>`
    WITH ranked AS (
      SELECT id,
             ROW_NUMBER() OVER (
               PARTITION BY "userId", "metric", "startDate", "endDate", "value"
               ORDER BY "createdAt" ASC
             ) AS rn
      FROM "health_records"
      WHERE "userId" = ${userId}
    )
    SELECT id FROM ranked WHERE rn > 1
  `;

  if (duplicates.length === 0) {
    return Response.json({ removed: 0, message: "没有发现重复记录" });
  }

  const ids = duplicates.map((d) => d.id);

  // Delete in batches
  const BATCH = 1000;
  let removed = 0;
  for (let i = 0; i < ids.length; i += BATCH) {
    const batch = ids.slice(i, i + BATCH);
    const result = await prisma.healthRecord.deleteMany({
      where: { id: { in: batch } },
    });
    removed += result.count;
  }

  return Response.json({ removed, message: `已删除 ${removed} 条重复记录` });
}
