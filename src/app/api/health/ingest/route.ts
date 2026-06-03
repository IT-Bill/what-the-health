import { prisma } from "@/lib/prisma";
import { checkHealthAnomalies } from "@/lib/family-alerts";
import { Prisma } from "@/generated/prisma/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VALID_METRICS = new Set([
  "steps", "heartRate", "restingHR", "sleepAnalysis", "workout",
  "weight", "bloodPressure", "diastolicBP", "bloodOxygen", "calories", "distance",
  "hrv", "stress", "mindfulSession", "flightsClimbed", "respiratoryRate",
]);

function verifySecret(request: Request): boolean {
  const expected = process.env.DEVICE_API_SECRET;
  if (!expected) return false;
  const auth = request.headers.get("authorization");
  const token = auth?.startsWith("Bearer ") ? auth.slice(7) : request.headers.get("x-device-secret");
  return token === expected;
}

interface IngestRecord {
  metric: string;
  value: number;
  unit: string;
  timestamp?: string;
  endTimestamp?: string;
  metadata?: Record<string, unknown>;
}

/**
 * POST /api/health/ingest
 *
 * Accepts real-time health data from wearables or simulation scripts.
 * Auth: Bearer <DEVICE_API_SECRET> or X-Device-Secret header.
 *
 * Body:
 *   { "username": "bill", "sourceName": "Simulated Band", "records": [...] }
 *   { "userId": "<id>", "records": [...] }
 *
 * Each record: { metric, value, unit, timestamp?, endTimestamp?, metadata? }
 */
export async function POST(request: Request) {
  if (!verifySecret(request)) {
    return Response.json({ error: "无效的设备密钥" }, { status: 401 });
  }

  let body: {
    userId?: string;
    username?: string;
    sourceName?: string;
    records: IngestRecord[];
  };

  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "请求体不是合法 JSON" }, { status: 400 });
  }

  if (!body.records?.length) {
    return Response.json({ error: "records 不能为空" }, { status: 400 });
  }

  // Resolve user
  const user = body.userId
    ? await prisma.user.findUnique({ where: { id: body.userId }, select: { id: true } })
    : body.username
      ? await prisma.user.findUnique({ where: { username: body.username }, select: { id: true } })
      : null;

  if (!user) {
    return Response.json({ error: "用户不存在" }, { status: 404 });
  }

  const sourceName = body.sourceName?.trim() || "Wearable";
  const now = new Date();

  const validRecords = body.records.filter((r) => {
    if (!VALID_METRICS.has(r.metric)) return false;
    if (typeof r.value !== "number" || !isFinite(r.value)) return false;
    if (!r.unit?.trim()) return false;
    return true;
  });

  if (validRecords.length === 0) {
    return Response.json({ error: "没有合法的 records" }, { status: 400 });
  }

  await prisma.healthRecord.createMany({
    data: validRecords.map((r) => {
      const start = r.timestamp ? new Date(r.timestamp) : now;
      const end = r.endTimestamp ? new Date(r.endTimestamp) : start;
      return {
        userId: user.id,
        source: "manual" as const,
        metric: r.metric as Parameters<typeof prisma.healthRecord.create>[0]["data"]["metric"],
        value: r.value,
        unit: r.unit.trim(),
        startDate: start,
        endDate: end,
        sourceName,
        metadata: r.metadata ? (r.metadata as Prisma.InputJsonValue) : Prisma.JsonNull,
      };
    }),
  });

  // Async anomaly check — don't block the response
  void checkHealthAnomalies(user.id).catch(console.error);

  return Response.json({ inserted: validRecords.length }, { status: 201 });
}
