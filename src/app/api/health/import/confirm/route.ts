import { prisma } from "@/lib/prisma";
import { getAuthCookie, verifyToken } from "@/lib/auth";
import { getPreview, deletePreview } from "@/lib/health-parsers/preview-cache";
import type { HealthDataSource, HealthMetricType, Prisma } from "@/generated/prisma/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/health/import/confirm
 * Confirm import with a selected time range. Reads from preview cache
 * and writes only records within the specified date range to DB.
 */
export async function POST(request: Request) {
  const token = await getAuthCookie();
  if (!token) return Response.json({ error: "未登录" }, { status: 401 });
  const payload = await verifyToken(token);
  if (!payload) return Response.json({ error: "登录已过期" }, { status: 401 });

  const userId = payload.userId;

  let body: { previewId: string; dateFrom: string; dateTo: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "请求格式错误" }, { status: 400 });
  }

  const { previewId, dateFrom, dateTo } = body;
  if (!previewId) return Response.json({ error: "缺少 previewId" }, { status: 400 });

  const entry = getPreview(previewId, userId);
  if (!entry) {
    return Response.json({ error: "预览已过期，请重新上传文件" }, { status: 410 });
  }

  // Filter records by date range
  const from = dateFrom ? new Date(dateFrom) : null;
  const to = dateTo ? new Date(dateTo) : null;

  const filtered = entry.records.filter((r) => {
    if (from && r.startDate < from) return false;
    if (to && r.endDate > to) return false;
    return true;
  });

  if (filtered.length === 0) {
    return Response.json({ error: "所选时间范围内没有数据" }, { status: 400 });
  }

  // Create import record
  const importRecord = await prisma.healthImport.create({
    data: {
      userId,
      source: entry.source,
      fileName: `import_${entry.source}`,
      fileSize: 0,
      status: "processing",
    },
  });

  try {
    // Batch insert (500 per batch)
    const BATCH_SIZE = 500;
    let inserted = 0;

    for (let i = 0; i < filtered.length; i += BATCH_SIZE) {
      const batch = filtered.slice(i, i + BATCH_SIZE);
      await prisma.healthRecord.createMany({
        data: batch.map((r) => ({
          userId,
          source: entry.source as HealthDataSource,
          metric: r.metric as HealthMetricType,
          value: r.value,
          unit: r.unit,
          startDate: r.startDate,
          endDate: r.endDate,
          metadata: (r.metadata ?? undefined) as Prisma.InputJsonValue | undefined,
          sourceName: r.sourceName ?? null,
          importId: importRecord.id,
        })),
      });
      inserted += batch.length;
    }

    // Calculate date range of imported records
    let dataFrom: Date | null = null;
    let dataTo: Date | null = null;
    for (const r of filtered) {
      if (!dataFrom || r.startDate < dataFrom) dataFrom = r.startDate;
      if (!dataTo || r.endDate > dataTo) dataTo = r.endDate;
    }

    // Build summary
    const summary: Record<string, number> = {};
    for (const r of filtered) {
      summary[r.metric] = (summary[r.metric] || 0) + 1;
    }

    // Mark as completed
    await prisma.healthImport.update({
      where: { id: importRecord.id },
      data: {
        status: "completed",
        recordCount: inserted,
        dataFrom,
        dataTo,
        summary,
        completedAt: new Date(),
      },
    });

    // Clean up cache
    deletePreview(previewId);

    return Response.json({
      importId: importRecord.id,
      status: "completed",
      source: entry.source,
      recordCount: inserted,
      dataFrom,
      dataTo,
      summary,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "导入失败";
    await prisma.healthImport.update({
      where: { id: importRecord.id },
      data: { status: "failed", error: message, completedAt: new Date() },
    });
    return Response.json({ importId: importRecord.id, status: "failed", error: message }, { status: 500 });
  }
}
