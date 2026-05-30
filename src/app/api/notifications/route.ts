import { prisma } from "@/lib/prisma";
import { getAuthCookie, verifyToken } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/notifications — get user's notifications (unread first)
export async function GET(request: Request) {
  const token = await getAuthCookie();
  if (!token) return Response.json({ error: "未登录" }, { status: 401 });
  const payload = await verifyToken(token);
  if (!payload) return Response.json({ error: "登录已过期" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 100);
  const unreadOnly = searchParams.get("unread") === "true";

  const where: Record<string, unknown> = {
    recipientId: payload.userId,
    dismissed: false,
  };
  if (unreadOnly) where.read = false;

  const [notifications, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where,
      orderBy: [{ read: "asc" }, { createdAt: "desc" }],
      take: limit,
      include: {
        sender: { select: { id: true, name: true, username: true, avatarUrl: true } },
      },
    }),
    prisma.notification.count({
      where: { recipientId: payload.userId, read: false, dismissed: false },
    }),
  ]);

  return Response.json({ notifications, unreadCount });
}
