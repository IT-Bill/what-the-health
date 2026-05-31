import { getAuthCookie, verifyToken } from "@/lib/auth";
import { parseHealthExport, PasswordRequiredError, PasswordIncorrectError } from "@/lib/health-parsers";
import { storePreview } from "@/lib/health-parsers/preview-cache";
import type { HealthMetric } from "@/lib/health-parsers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/health/import/preview
 * Parse a health ZIP without writing to DB. Returns a preview summary
 * so the user can choose a time range before confirming.
 */
export async function POST(request: Request) {
  const token = await getAuthCookie();
  if (!token) return Response.json({ error: "未登录" }, { status: 401 });
  const payload = await verifyToken(token);
  if (!payload) return Response.json({ error: "登录已过期" }, { status: 401 });

  const userId = payload.userId;

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return Response.json({ error: "请求格式错误" }, { status: 400 });
  }

  const file = formData.get("file") as File | null;
  if (!file) return Response.json({ error: "请选择要上传的文件" }, { status: 400 });

  if (file.size > 500 * 1024 * 1024) {
    return Response.json({ error: "文件大小不能超过 500MB" }, { status: 400 });
  }
  if (!file.name.endsWith(".zip")) {
    return Response.json({ error: "请上传 ZIP 格式的文件" }, { status: 400 });
  }

  const password = formData.get("password") as string | null;

  try {
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const result = await parseHealthExport(buffer, password || undefined);

    // Store in cache
    const previewId = storePreview(result.records, result.source, userId);

    // Build monthly breakdown for frontend time range selection
    const monthlyBreakdown: Record<string, Partial<Record<HealthMetric, number>>> = {};
    for (const r of result.records) {
      const month = `${r.startDate.getFullYear()}-${String(r.startDate.getMonth() + 1).padStart(2, "0")}`;
      if (!monthlyBreakdown[month]) monthlyBreakdown[month] = {};
      monthlyBreakdown[month][r.metric] = (monthlyBreakdown[month][r.metric] || 0) + 1;
    }

    return Response.json({
      previewId,
      source: result.source,
      totalRecords: result.records.length,
      dataFrom: result.dataFrom,
      dataTo: result.dataTo,
      summary: result.summary,
      monthlyBreakdown,
    });
  } catch (err) {
    if (err instanceof PasswordRequiredError) {
      return Response.json({ code: "PASSWORD_REQUIRED", error: err.message }, { status: 422 });
    }
    if (err instanceof PasswordIncorrectError) {
      return Response.json({ code: "PASSWORD_INCORRECT", error: err.message }, { status: 422 });
    }
    const message = err instanceof Error ? err.message : "解析失败";
    return Response.json({ error: message }, { status: 422 });
  }
}
