import { prisma } from "@/lib/prisma";
import { toNotificationItem } from "@/lib/notifications";
import { getSessionUser } from "@/lib/session-user";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const sessionUser = await getSessionUser();
  if (!sessionUser) {
    return Response.json({ error: "未登录" }, { status: 401 });
  }

  const { id } = await params;

  let body: { action?: "read" | "unread" };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "请求体不是合法 JSON" }, { status: 400 });
  }

  const existing = await prisma.notification.findFirst({
    where: { id, userId: sessionUser.userId },
  });

  if (!existing) {
    return Response.json({ error: "通知不存在" }, { status: 404 });
  }

  const action = body.action === "unread" ? "unread" : "read";
  const notification = await prisma.notification.update({
    where: { id },
    data: {
      readAt: action === "read" ? existing.readAt ?? new Date() : null,
    },
  });

  return Response.json({ notification: toNotificationItem(notification) });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const sessionUser = await getSessionUser();
  if (!sessionUser) {
    return Response.json({ error: "未登录" }, { status: 401 });
  }

  const { id } = await params;
  const deleted = await prisma.notification.deleteMany({
    where: {
      id,
      userId: sessionUser.userId,
    },
  });

  if (deleted.count === 0) {
    return Response.json({ error: "通知不存在" }, { status: 404 });
  }

  return Response.json({ ok: true });
}