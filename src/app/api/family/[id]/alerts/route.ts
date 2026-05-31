import { prisma } from "@/lib/prisma";
import { getAuthCookie, verifyToken } from "@/lib/auth";
import { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/family/[id]/alerts — 家庭预警列表
 * Query: ?resolved=false (默认只看未处理)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const token = await getAuthCookie();
  if (!token) return Response.json({ error: "未登录" }, { status: 401 });
  const payload = await verifyToken(token);
  if (!payload) return Response.json({ error: "登录已过期" }, { status: 401 });

  const { id: familyId } = await params;

  const membership = await prisma.familyMember.findUnique({
    where: { familyId_userId: { familyId, userId: payload.userId } },
  });
  if (!membership) return Response.json({ error: "无权访问" }, { status: 403 });

  const showResolved = request.nextUrl.searchParams.get("resolved") === "true";

  const alerts = await prisma.familyAlert.findMany({
    where: { familyId, ...(showResolved ? {} : { resolved: false }) },
    include: {
      sourceUser: { select: { id: true, name: true, avatarUrl: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return Response.json(alerts);
}
