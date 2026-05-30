import { prisma } from "@/lib/prisma";
import { getAuthCookie, verifyToken } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/health/import/[id] — get status of a specific import
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const token = await getAuthCookie();
  if (!token) return Response.json({ error: "未登录" }, { status: 401 });
  const payload = await verifyToken(token);
  if (!payload) return Response.json({ error: "登录已过期" }, { status: 401 });

  const { id } = await params;

  const importRecord = await prisma.healthImport.findUnique({
    where: { id },
    select: {
      id: true,
      userId: true,
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

  if (!importRecord || importRecord.userId !== payload.userId) {
    return Response.json({ error: "未找到该导入记录" }, { status: 404 });
  }

  return Response.json(importRecord);
}

// DELETE /api/health/import/[id] — delete an import and all its records
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const token = await getAuthCookie();
  if (!token) return Response.json({ error: "未登录" }, { status: 401 });
  const payload = await verifyToken(token);
  if (!payload) return Response.json({ error: "登录已过期" }, { status: 401 });

  const { id } = await params;

  const importRecord = await prisma.healthImport.findUnique({
    where: { id },
    select: { id: true, userId: true },
  });

  if (!importRecord || importRecord.userId !== payload.userId) {
    return Response.json({ error: "未找到该导入记录" }, { status: 404 });
  }

  // Delete all records from this import first
  await prisma.healthRecord.deleteMany({ where: { importId: id } });
  // Then delete the import itself
  await prisma.healthImport.delete({ where: { id } });

  return Response.json({ message: "已删除该导入及其所有数据" });
}
