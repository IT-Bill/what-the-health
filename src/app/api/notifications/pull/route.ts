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

  const notification = await prisma.$transaction(async (tx) => {
    const pending = await tx.notification.findFirst({
      where: {
        userId: sessionUser.userId,
        deliveredAt: null,
      },
      orderBy: { createdAt: "asc" },
    });

    if (!pending) {
      return null;
    }

    return tx.notification.update({
      where: { id: pending.id },
      data: { deliveredAt: new Date() },
    });
  });

  return Response.json({
    notification: notification ? toNotificationItem(notification) : null,
  });
}