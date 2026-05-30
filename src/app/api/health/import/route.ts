import { prisma } from "@/lib/prisma";
import { getAuthCookie, verifyToken } from "@/lib/auth";
import { parseHealthExport } from "@/lib/health-parsers";
import type { HealthDataSource, HealthMetricType, Prisma } from "@/generated/prisma/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/health/import — upload and parse a health data ZIP file
export async function POST(request: Request) {
  const token = await getAuthCookie();
  if (!token) return Response.json({ error: "未登录" }, { status: 401 });
  const payload = await verifyToken(token);
  if (!payload) return Response.json({ error: "登录已过期" }, { status: 401 });

  const userId = payload.userId;

  // Parse multipart form data
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return Response.json({ error: "请求格式错误，需要 multipart/form-data" }, { status: 400 });
  }

  const file = formData.get("file") as File | null;
  if (!file) {
    return Response.json({ error: "请选择要上传的文件" }, { status: 400 });
  }

  // Validate file
  if (file.size > 500 * 1024 * 1024) {
    return Response.json({ error: "文件大小不能超过 500MB" }, { status: 400 });
  }

  if (!file.name.endsWith(".zip")) {
    return Response.json({ error: "请上传 ZIP 格式的文件" }, { status: 400 });
  }

  // Create import record
  const importRecord = await prisma.healthImport.create({
    data: {
      userId,
      source: "appleHealth", // will be updated after detection
      fileName: file.name,
      fileSize: file.size,
      status: "processing",
    },
  });

  try {
    // Read file into buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Parse (auto-detects format)
    const result = await parseHealthExport(buffer);

    // Update import record with detected source
    await prisma.healthImport.update({
      where: { id: importRecord.id },
      data: { source: result.source },
    });

    // Batch insert records (500 per batch)
    const BATCH_SIZE = 500;
    let inserted = 0;

    for (let i = 0; i < result.records.length; i += BATCH_SIZE) {
      const batch = result.records.slice(i, i + BATCH_SIZE);
      await prisma.healthRecord.createMany({
        data: batch.map((r) => ({
          userId,
          source: result.source as HealthDataSource,
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

    // Mark as completed
    await prisma.healthImport.update({
      where: { id: importRecord.id },
      data: {
        status: "completed",
        recordCount: inserted,
        dataFrom: result.dataFrom,
        dataTo: result.dataTo,
        summary: result.summary as Record<string, number>,
        completedAt: new Date(),
      },
    });

    return Response.json({
      importId: importRecord.id,
      status: "completed",
      source: result.source,
      recordCount: inserted,
      dataFrom: result.dataFrom,
      dataTo: result.dataTo,
      summary: result.summary,
    });
  } catch (err) {
    // Mark import as failed
    const message = err instanceof Error ? err.message : "解析失败";
    await prisma.healthImport.update({
      where: { id: importRecord.id },
      data: { status: "failed", error: message, completedAt: new Date() },
    });

    return Response.json({ importId: importRecord.id, status: "failed", error: message }, { status: 422 });
  }
}

// GET /api/health/import — list user's import history
export async function GET() {
  const token = await getAuthCookie();
  if (!token) return Response.json({ error: "未登录" }, { status: 401 });
  const payload = await verifyToken(token);
  if (!payload) return Response.json({ error: "登录已过期" }, { status: 401 });

  const imports = await prisma.healthImport.findMany({
    where: { userId: payload.userId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      source: true,
      fileName: true,
      fileSize: true,
      status: true,
      recordCount: true,
      dataFrom: true,
      dataTo: true,
      summary: true,
      error: true,
      createdAt: true,
      completedAt: true,
    },
  });

  return Response.json(imports);
}
