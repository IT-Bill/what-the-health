import { prisma } from "@/lib/prisma";
import { getAuthCookie, verifyToken } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ZIP import is temporarily unavailable. Do not read or parse request bodies.
export async function POST() {
  return Response.json(
    { code: "HEALTH_IMPORT_DISABLED", error: "健康数据文件导入暂未开放" },
    { status: 503 },
  );
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
