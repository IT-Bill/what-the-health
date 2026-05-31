import { prisma } from "@/lib/prisma";
import { getAuthCookie, verifyToken } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/family/join — 通过邀请码加入家庭
 * Body: { inviteCode, nickname?, role?: "caregiver" | "member" }
 */
export async function POST(request: Request) {
  const token = await getAuthCookie();
  if (!token) return Response.json({ error: "未登录" }, { status: 401 });
  const payload = await verifyToken(token);
  if (!payload) return Response.json({ error: "登录已过期" }, { status: 401 });

  const body = await request.json();
  const { inviteCode, nickname, role } = body;

  if (!inviteCode || typeof inviteCode !== "string") {
    return Response.json({ error: "请输入邀请码" }, { status: 400 });
  }

  // Find family by invite code
  const family = await prisma.family.findUnique({
    where: { inviteCode: inviteCode.trim() },
  });

  if (!family) {
    return Response.json({ error: "邀请码无效，请检查后重试" }, { status: 404 });
  }

  // Check if already a member
  const existing = await prisma.familyMember.findUnique({
    where: { familyId_userId: { familyId: family.id, userId: payload.userId } },
  });

  if (existing) {
    return Response.json({ error: "你已经是该家庭的成员" }, { status: 409 });
  }

  // Validate role (default to caregiver for joiners — typical use case is child joining to watch over parent)
  const memberRole = role === "member" ? "member" : "caregiver";

  const member = await prisma.familyMember.create({
    data: {
      familyId: family.id,
      userId: payload.userId,
      role: memberRole,
      nickname: nickname?.trim() || null,
    },
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
  });

  // Notify existing family members
  const otherMembers = await prisma.familyMember.findMany({
    where: { familyId: family.id, userId: { not: payload.userId } },
    select: { userId: true },
  });

  const joiner = await prisma.user.findUnique({
    where: { id: payload.userId },
    select: { name: true },
  });

  for (const m of otherMembers) {
    await prisma.notification.create({
      data: {
        userId: m.userId,
        title: "新成员加入家庭",
        body: `${joiner?.name || "新成员"} 加入了「${family.name}」`,
        source: "system-family",
        actionUrl: `/discover/family/${family.id}`,
        metadata: { actorId: payload.userId, familyId: family.id },
      },
    });
  }

  return Response.json(member.family, { status: 201 });
}
