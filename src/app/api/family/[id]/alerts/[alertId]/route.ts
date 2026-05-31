import { prisma } from "@/lib/prisma";
import { getAuthCookie, verifyToken } from "@/lib/auth";
import { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * PATCH /api/family/[id]/alerts/[alertId] — 标记预警已处理
 */
export async function PATCH(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; alertId: string }> }
) {
  const token = await getAuthCookie();
  if (!token) return Response.json({ error: "未登录" }, { status: 401 });
  const payload = await verifyToken(token);
  if (!payload) return Response.json({ error: "登录已过期" }, { status: 401 });

  const { id: familyId, alertId } = await params;

  const membership = await prisma.familyMember.findUnique({
    where: { familyId_userId: { familyId, userId: payload.userId } },
  });
  if (!membership) return Response.json({ error: "无权访问" }, { status: 403 });

  const alert = await prisma.familyAlert.findUnique({ where: { id: alertId } });
  if (!alert || alert.familyId !== familyId) {
    return Response.json({ error: "预警不存在" }, { status: 404 });
  }

  const updated = await prisma.familyAlert.update({
    where: { id: alertId },
    data: {
      resolved: true,
      resolvedBy: payload.userId,
      resolvedAt: new Date(),
    },
  });

  return Response.json(updated);
}
