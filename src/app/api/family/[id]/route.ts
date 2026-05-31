import { prisma } from "@/lib/prisma";
import { getAuthCookie, verifyToken } from "@/lib/auth";
import { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/family/[id] — 获取家庭详情
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const token = await getAuthCookie();
  if (!token) return Response.json({ error: "未登录" }, { status: 401 });
  const payload = await verifyToken(token);
  if (!payload) return Response.json({ error: "登录已过期" }, { status: 401 });

  const { id } = await params;

  // Verify membership
  const membership = await prisma.familyMember.findUnique({
    where: { familyId_userId: { familyId: id, userId: payload.userId } },
  });
  if (!membership) return Response.json({ error: "无权访问" }, { status: 403 });

  const family = await prisma.family.findUnique({
    where: { id },
    include: {
      members: {
        include: {
          user: { select: { id: true, username: true, name: true, avatarUrl: true } },
        },
        orderBy: { joinedAt: "asc" },
      },
      alerts: {
        where: { resolved: false },
        orderBy: { createdAt: "desc" },
        take: 20,
        include: {
          sourceUser: { select: { id: true, name: true, avatarUrl: true } },
        },
      },
    },
  });

  if (!family) return Response.json({ error: "家庭不存在" }, { status: 404 });

  return Response.json({ ...family, myRole: membership.role });
}

/**
 * PATCH /api/family/[id] — 更新家庭信息（仅owner）
 * Body: { name?, description? }
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const token = await getAuthCookie();
  if (!token) return Response.json({ error: "未登录" }, { status: 401 });
  const payload = await verifyToken(token);
  if (!payload) return Response.json({ error: "登录已过期" }, { status: 401 });

  const { id } = await params;

  const membership = await prisma.familyMember.findUnique({
    where: { familyId_userId: { familyId: id, userId: payload.userId } },
  });
  if (!membership || membership.role !== "owner") {
    return Response.json({ error: "仅管理员可修改家庭信息" }, { status: 403 });
  }

  const body = await request.json();
  const data: Record<string, unknown> = {};
  if (body.name) data.name = body.name.trim();
  if (body.description !== undefined) data.description = body.description?.trim() || null;

  const updated = await prisma.family.update({ where: { id }, data });
  return Response.json(updated);
}

/**
 * DELETE /api/family/[id] — 解散家庭（仅owner）
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const token = await getAuthCookie();
  if (!token) return Response.json({ error: "未登录" }, { status: 401 });
  const payload = await verifyToken(token);
  if (!payload) return Response.json({ error: "登录已过期" }, { status: 401 });

  const { id } = await params;

  const membership = await prisma.familyMember.findUnique({
    where: { familyId_userId: { familyId: id, userId: payload.userId } },
  });
  if (!membership || membership.role !== "owner") {
    return Response.json({ error: "仅管理员可解散家庭" }, { status: 403 });
  }

  await prisma.family.delete({ where: { id } });
  return Response.json({ ok: true });
}
