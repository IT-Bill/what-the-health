import { prisma } from "@/lib/prisma";
import { getAuthCookie, verifyToken } from "@/lib/auth";
import { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * PATCH /api/family/[id]/members/[memberId] — 更新成员信息
 * Body: { isCaregiver?, isCaredFor?, nickname?, alertLevel?, shareHealthData?, shareAlerts?, shareMoodHistory? }
 *
 * Roles (isCaregiver / isCaredFor) can be combined; observer is set via role field.
 * - Owner 可修改任何成员（包括自己的身份）
 * - 成员自己可修改自己的共享设置和昵称
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; memberId: string }> }
) {
  const token = await getAuthCookie();
  if (!token) return Response.json({ error: "未登录" }, { status: 401 });
  const payload = await verifyToken(token);
  if (!payload) return Response.json({ error: "登录已过期" }, { status: 401 });

  const { id: familyId, memberId } = await params;

  // Verify caller is a family member
  const callerMembership = await prisma.familyMember.findUnique({
    where: { familyId_userId: { familyId, userId: payload.userId } },
  });
  if (!callerMembership) return Response.json({ error: "无权访问" }, { status: 403 });

  // Find the target member
  const targetMember = await prisma.familyMember.findUnique({ where: { id: memberId } });
  if (!targetMember || targetMember.familyId !== familyId) {
    return Response.json({ error: "成员不存在" }, { status: 404 });
  }

  const isOwner = callerMembership.role === "owner";
  const isSelf = targetMember.userId === payload.userId;

  if (!isOwner && !isSelf) {
    return Response.json({ error: "无权修改该成员" }, { status: 403 });
  }

  const body = await request.json();
  const data: Record<string, unknown> = {};

  // Owner can change isCaregiver/isCaredFor for any member, including themselves.
  // observer is set via role field and is mutually exclusive with caregiver/caredFor.
  if (isOwner) {
    if (body.isCaregiver !== undefined) data.isCaregiver = Boolean(body.isCaregiver);
    if (body.isCaredFor !== undefined) data.isCaredFor = Boolean(body.isCaredFor);
    // Switching to observer clears the dual-role flags
    if (body.role === "observer") {
      data.role = "observer";
      data.isCaregiver = false;
      data.isCaredFor = false;
    }
  }

  // Anyone can update their own settings, owner can update anyone's
  if (body.nickname !== undefined) data.nickname = body.nickname?.trim() || null;
  if (body.alertLevel !== undefined && ["low", "medium", "high"].includes(body.alertLevel)) {
    data.alertLevel = body.alertLevel;
  }
  if (body.shareHealthData !== undefined) data.shareHealthData = Boolean(body.shareHealthData);
  if (body.shareAlerts !== undefined) data.shareAlerts = Boolean(body.shareAlerts);
  if (body.shareMoodHistory !== undefined) data.shareMoodHistory = Boolean(body.shareMoodHistory);

  const updated = await prisma.familyMember.update({
    where: { id: memberId },
    data,
    include: { user: { select: { id: true, username: true, name: true, avatarUrl: true } } },
  });

  return Response.json(updated);
}

/**
 * DELETE /api/family/[id]/members/[memberId] — 移除成员或退出家庭
 *
 * - Owner 可移除任何人（除自己）
 * - 任何成员可退出（删除自己）
 * - Owner 退出时需先转让 owner 或解散家庭
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; memberId: string }> }
) {
  const token = await getAuthCookie();
  if (!token) return Response.json({ error: "未登录" }, { status: 401 });
  const payload = await verifyToken(token);
  if (!payload) return Response.json({ error: "登录已过期" }, { status: 401 });

  const { id: familyId, memberId } = await params;

  const callerMembership = await prisma.familyMember.findUnique({
    where: { familyId_userId: { familyId, userId: payload.userId } },
  });
  if (!callerMembership) return Response.json({ error: "无权访问" }, { status: 403 });

  const targetMember = await prisma.familyMember.findUnique({ where: { id: memberId } });
  if (!targetMember || targetMember.familyId !== familyId) {
    return Response.json({ error: "成员不存在" }, { status: 404 });
  }

  const isOwner = callerMembership.role === "owner";
  const isSelf = targetMember.userId === payload.userId;

  if (!isOwner && !isSelf) {
    return Response.json({ error: "无权移除该成员" }, { status: 403 });
  }

  // Owner cannot remove themselves (must transfer or disband)
  if (isOwner && isSelf) {
    return Response.json({ error: "管理员不能退出家庭，请先转让管理员或解散家庭" }, { status: 400 });
  }

  await prisma.familyMember.delete({ where: { id: memberId } });

  // Notify about removal (if not self-exit)
  if (!isSelf) {
    const family = await prisma.family.findUnique({ where: { id: familyId }, select: { name: true } });
    await prisma.notification.create({
      data: {
        userId: targetMember.userId,
        title: "家庭成员变动",
        body: `你已被移出「${family?.name || "家庭"}」`,
        source: "system-family",
      },
    });
  }

  return Response.json({ ok: true });
}
