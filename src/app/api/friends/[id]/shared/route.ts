import { prisma } from "@/lib/prisma";
import { getAuthCookie, verifyToken } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/friends/[id]/shared — view content a friend has shared with me
// [id] is the friend's userId
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const token = await getAuthCookie();
  if (!token) return Response.json({ error: "未登录" }, { status: 401 });
  const payload = await verifyToken(token);
  if (!payload) return Response.json({ error: "登录已过期" }, { status: 401 });

  const { id: friendId } = await params;
  const userId = payload.userId;

  // Verify friendship
  const friendship = await prisma.friendship.findFirst({
    where: {
      status: "accepted",
      OR: [
        { requesterId: userId, addresseeId: friendId },
        { requesterId: friendId, addresseeId: userId },
      ],
    },
  });

  if (!friendship) {
    return Response.json({ error: "你们不是好友" }, { status: 403 });
  }

  // Get what this friend has shared with me
  const permissions = await prisma.friendPermission.findMany({
    where: { ownerId: friendId, friendId: userId },
    select: { content: true },
  });
  const allowed = new Set(permissions.map((p) => p.content));

  // Fetch friend's basic info
  const friend = await prisma.user.findUnique({
    where: { id: friendId },
    select: { id: true, username: true, name: true, avatarUrl: true },
  });

  if (!friend) {
    return Response.json({ error: "用户不存在" }, { status: 404 });
  }

  // Build response based on allowed content
  const result: Record<string, unknown> = {
    friend,
    permissions: Array.from(allowed),
  };

  // Weekly report
  if (allowed.has("weeklyReport")) {
    const report = await prisma.report.findFirst({
      where: { userId: friendId, periodType: "weekly" },
      orderBy: { periodStart: "desc" },
      select: { id: true, periodStart: true, periodEnd: true, summary: true, data: true },
    });
    result.weeklyReport = report;
  }

  // Monthly report
  if (allowed.has("monthlyReport")) {
    const report = await prisma.report.findFirst({
      where: { userId: friendId, periodType: "monthly" },
      orderBy: { periodStart: "desc" },
      select: { id: true, periodStart: true, periodEnd: true, summary: true, data: true },
    });
    result.monthlyReport = report;
  }

  // Insights
  if (allowed.has("insights")) {
    const insights = await prisma.insight.findMany({
      where: { userId: friendId, dismissed: false },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { id: true, type: true, title: true, content: true, createdAt: true },
    });
    result.insights = insights;
  }

  // Goals
  if (allowed.has("goals")) {
    const goals = await prisma.goal.findMany({
      where: { userId: friendId, archived: false },
      orderBy: { sortOrder: "asc" },
      include: {
        completions: {
          where: { completedAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } },
          select: { forDate: true },
        },
      },
    });
    result.goals = goals.map((g) => ({
      id: g.id,
      title: g.title,
      icon: g.icon,
      completionsThisWeek: g.completions.length,
    }));
  }

  // Mood history
  if (allowed.has("moodHistory")) {
    const moods = await prisma.moodCheckin.findMany({
      where: { userId: friendId },
      orderBy: { createdAt: "desc" },
      take: 14,
      select: { mood: true, createdAt: true },
    });
    result.moodHistory = moods;
  }

  // Posts
  if (allowed.has("posts")) {
    const posts = await prisma.post.findMany({
      where: { authorId: friendId, published: true },
      orderBy: { publishedAt: "desc" },
      take: 10,
      select: { id: true, title: true, excerpt: true, category: true, coverImage: true, publishedAt: true },
    });
    result.posts = posts;
  }

  return Response.json(result);
}
