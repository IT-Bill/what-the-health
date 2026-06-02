import { prisma } from "@/lib/prisma";
import { toNotificationItem } from "@/lib/notifications";
import { getSessionUser } from "@/lib/session-user";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  const sessionUser = await getSessionUser();
  if (!sessionUser) {
    return Response.json({ error: "未登录" }, { status: 401 });
  }

  const pending = await prisma.notification.findFirst({
    where: {
      userId: sessionUser.userId,
      deliveredAt: null,
      priority: "urgent",
    },
    orderBy: { createdAt: "asc" },
  });

  if (!pending) {
    return Response.json({ notification: null });
  }

  const notification = await prisma.notification.update({
    where: { id: pending.id },
    data: { deliveredAt: new Date() },
  });

  return Response.json({
    notification: notification ? toNotificationItem(notification) : null,
  });
}