import { prisma } from "@/lib/prisma";
import { getAuthCookie, verifyToken } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// PATCH /api/notifications/[id] — mark as read or dismiss
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const token = await getAuthCookie();
  if (!token) return Response.json({ error: "未登录" }, { status: 401 });
  const payload = await verifyToken(token);
  if (!payload) return Response.json({ error: "登录已过期" }, { status: 401 });

  const { id } = await params;
  const body = await request.json();
  const { action } = body;

  if (!["read", "dismiss", "readAll"].includes(action)) {
    return Response.json({ error: "action 必须是 read/dismiss/readAll" }, { status: 400 });
  }

  // Special case: mark all as read
  if (action === "readAll") {
    await prisma.notification.updateMany({
      where: { recipientId: payload.userId, read: false },
      data: { read: true },
    });
    return Response.json({ message: "全部已读" });
  }

  const notification = await prisma.notification.findUnique({ where: { id } });
  if (!notification || notification.recipientId !== payload.userId) {
    return Response.json({ error: "通知不存在" }, { status: 404 });
  }

  await prisma.notification.update({
    where: { id },
    data: action === "read" ? { read: true } : { dismissed: true },
  });

  return Response.json({ message: action === "read" ? "已读" : "已忽略" });
}
