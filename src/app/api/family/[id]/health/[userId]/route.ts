import { prisma } from "@/lib/prisma";
import { getAuthCookie, verifyToken } from "@/lib/auth";
import { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/family/[id]/health/[userId] — 查看家庭成员的健康数据
 * Query: ?days=7 (默认7天)
 *
 * 权限检查：
 * - 调用者必须是该家庭成员
 * - 目标用户必须是该家庭成员且 shareHealthData=true
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; userId: string }> }
) {
  const token = await getAuthCookie();
  if (!token) return Response.json({ error: "未登录" }, { status: 401 });
  const payload = await verifyToken(token);
  if (!payload) return Response.json({ error: "登录已过期" }, { status: 401 });

  const { id: familyId, userId: targetUserId } = await params;
  const days = parseInt(request.nextUrl.searchParams.get("days") || "7", 10);

  // Verify caller is a family member
  const callerMembership = await prisma.familyMember.findUnique({
    where: { familyId_userId: { familyId, userId: payload.userId } },
  });
  if (!callerMembership) return Response.json({ error: "无权访问" }, { status: 403 });

  // Verify target user is a family member with sharing enabled
  const targetMembership = await prisma.familyMember.findUnique({
    where: { familyId_userId: { familyId, userId: targetUserId } },
    include: { user: { select: { id: true, name: true, avatarUrl: true } } },
  });
  if (!targetMembership) {
    return Response.json({ error: "该用户不在此家庭中" }, { status: 404 });
  }

  // Self-view is always allowed
  const isSelf = targetUserId === payload.userId;
  if (!isSelf && !targetMembership.shareHealthData) {
    return Response.json({ error: "该成员未开启健康数据共享" }, { status: 403 });
  }

  const since = new Date();
  since.setDate(since.getDate() - days);

  // Fetch health records
  const healthRecords = await prisma.healthRecord.findMany({
    where: { userId: targetUserId, startDate: { gte: since } },
    select: { metric: true, value: true, unit: true, startDate: true, endDate: true, metadata: true, sourceName: true },
    orderBy: { startDate: "desc" },
  });

  // Aggregate by metric for summary
  const summary: Record<string, { count: number; avg: number; min: number; max: number; latest: number; unit: string }> = {};
  for (const r of healthRecords) {
    if (!summary[r.metric]) {
      summary[r.metric] = { count: 0, avg: 0, min: Infinity, max: -Infinity, latest: r.value, unit: r.unit };
    }
    const s = summary[r.metric];
    s.count++;
    s.avg += r.value;
    s.min = Math.min(s.min, r.value);
    s.max = Math.max(s.max, r.value);
  }
  for (const key of Object.keys(summary)) {
    summary[key].avg = Math.round((summary[key].avg / summary[key].count) * 10) / 10;
    if (summary[key].min === Infinity) summary[key].min = 0;
  }

  // Fetch mood history if allowed
  let moodHistory: { mood: string; note: string | null; createdAt: Date }[] = [];
  if (isSelf || targetMembership.shareMoodHistory) {
    moodHistory = await prisma.moodCheckin.findMany({
      where: { userId: targetUserId, createdAt: { gte: since } },
      select: { mood: true, note: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    });
  }

  // Fetch recent reports
  const reports = await prisma.report.findMany({
    where: { userId: targetUserId },
    orderBy: [{ periodStart: "desc" }, { version: "desc" }],
    take: 3,
    select: { id: true, periodType: true, periodStart: true, summary: true },
  });

  return Response.json({
    user: targetMembership.user,
    nickname: targetMembership.nickname,
    role: targetMembership.role,
    period: { days, since: since.toISOString() },
    summary,
    records: healthRecords.slice(0, 200),
    moodHistory,
    reports,
  });
}
