import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { toNotificationItem, type CreateNotificationRequest } from "@/lib/notifications";
import { getSessionUser } from "@/lib/session-user";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function hasNotificationSecret(request: Request) {
  const expected = process.env.NOTIFICATION_API_SECRET;
  if (!expected) {
    return false;
  }

  const authHeader = request.headers.get("authorization");
  const bearerToken = authHeader?.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length)
    : null;
  const provided = bearerToken ?? request.headers.get("x-notification-secret");
  return provided === expected;
}

export async function GET(request: Request) {
  const sessionUser = await getSessionUser();
  if (!sessionUser) {
    return Response.json({ error: "未登录" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const unreadOnly = searchParams.get("unreadOnly") === "true";
  const limitParam = Number(searchParams.get("limit") ?? "50");
  const take = Number.isFinite(limitParam)
    ? Math.min(Math.max(Math.trunc(limitParam), 1), 100)
    : 50;

  const notifications = await prisma.notification.findMany({
    where: {
      userId: sessionUser.userId,
      ...(unreadOnly ? { readAt: null } : {}),
    },
    orderBy: { createdAt: "desc" },
    take,
  });

  return Response.json({
    notifications: notifications.map(toNotificationItem),
  });
}

export async function POST(request: Request) {
  let body: CreateNotificationRequest;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "请求体不是合法 JSON" }, { status: 400 });
  }

  const title = body.title?.trim();
  const message = body.body?.trim();
  if (!title || !message) {
    return Response.json({ error: "title 和 body 为必填项" }, { status: 400 });
  }

  const sessionUser = await getSessionUser();
  const trustedCaller = hasNotificationSecret(request);
  const targetsSelf =
    sessionUser &&
    ((!body.userId && !body.username) ||
      body.userId === sessionUser.userId ||
      body.username === sessionUser.username);

  if (!sessionUser && !trustedCaller) {
    return Response.json({ error: "需要登录或提供通知密钥" }, { status: 401 });
  }

  if (!targetsSelf && !trustedCaller) {
    return Response.json({ error: "无权向其他用户发送通知" }, { status: 403 });
  }

  const recipient = body.userId
    ? await prisma.user.findUnique({ where: { id: body.userId }, select: { id: true } })
    : body.username
      ? await prisma.user.findUnique({ where: { username: body.username }, select: { id: true } })
      : sessionUser
        ? { id: sessionUser.userId }
        : null;

  if (!recipient) {
    return Response.json({ error: "通知接收者不存在" }, { status: 404 });
  }

  const notification = await prisma.notification.create({
    data: {
      userId: recipient.id,
      title,
      body: message,
      source: body.source?.trim() || null,
      actionUrl: body.actionUrl?.trim() || null,
      metadata:
        typeof body.metadata === "undefined"
          ? undefined
          : body.metadata === null
            ? Prisma.JsonNull
            : (body.metadata as Prisma.InputJsonValue),
    },
  });

  return Response.json(
    { notification: toNotificationItem(notification) },
    { status: 201 }
  );
}