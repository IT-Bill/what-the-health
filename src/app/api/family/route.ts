import { prisma } from "@/lib/prisma";
import { getAuthCookie, verifyToken } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/family — 创建家庭
 * Body: { name, description? }
 */
export async function POST(request: Request) {
  const token = await getAuthCookie();
  if (!token) return Response.json({ error: "未登录" }, { status: 401 });
  const payload = await verifyToken(token);
  if (!payload) return Response.json({ error: "登录已过期" }, { status: 401 });

  const body = await request.json();
  const { name, description } = body;

  if (!name || typeof name !== "string" || name.trim().length === 0) {
    return Response.json({ error: "请输入家庭名称" }, { status: 400 });
  }

  const family = await prisma.family.create({
    data: {
      name: name.trim(),
      description: description?.trim() || null,
      members: {
        create: {
          userId: payload.userId,
          role: "owner",
          nickname: null,
        },
      },
    },
    include: { members: { include: { user: { select: { id: true, username: true, name: true, avatarUrl: true } } } } },
  });

  return Response.json(family, { status: 201 });
}

/**
 * GET /api/family — 获取我所在的所有家庭
 */
export async function GET() {
  const token = await getAuthCookie();
  if (!token) return Response.json({ error: "未登录" }, { status: 401 });
  const payload = await verifyToken(token);
  if (!payload) return Response.json({ error: "登录已过期" }, { status: 401 });

  const memberships = await prisma.familyMember.findMany({
    where: { userId: payload.userId },
    include: {
      family: {
        include: {
          members: {
            include: {
              user: { select: { id: true, username: true, name: true, avatarUrl: true } },
            },
          },
        },
      },
    },
    orderBy: { joinedAt: "asc" },
  });

  const families = memberships.map((m) => ({
    ...m.family,
    myRole: m.role,
    myMemberId: m.id,
  }));

  return Response.json(families);
}
