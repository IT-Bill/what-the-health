import { prisma } from "@/lib/prisma";
import { getAuthCookie, verifyToken } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/friends — list current user's friends (accepted) + pending requests
export async function GET() {
  const token = await getAuthCookie();
  if (!token) return Response.json({ error: "未登录" }, { status: 401 });
  const payload = await verifyToken(token);
  if (!payload) return Response.json({ error: "登录已过期" }, { status: 401 });

  const userId = payload.userId;

  // Accepted friends (both directions)
  const friendships = await prisma.friendship.findMany({
    where: {
      status: "accepted",
      OR: [{ requesterId: userId }, { addresseeId: userId }],
    },
    include: {
      requester: { select: { id: true, username: true, name: true, avatarUrl: true } },
      addressee: { select: { id: true, username: true, name: true, avatarUrl: true } },
    },
  });

  const friends = friendships.map((f) => {
    const friend = f.requesterId === userId ? f.addressee : f.requester;
    return { ...friend, friendshipId: f.id, since: f.updatedAt };
  });

  // Pending requests received
  const pendingReceived = await prisma.friendship.findMany({
    where: { addresseeId: userId, status: "pending" },
    include: {
      requester: { select: { id: true, username: true, name: true, avatarUrl: true } },
    },
  });

  // Pending requests sent
  const pendingSent = await prisma.friendship.findMany({
    where: { requesterId: userId, status: "pending" },
    include: {
      addressee: { select: { id: true, username: true, name: true, avatarUrl: true } },
    },
  });

  return Response.json({
    friends,
    pendingReceived: pendingReceived.map((f) => ({
      friendshipId: f.id,
      user: f.requester,
      createdAt: f.createdAt,
    })),
    pendingSent: pendingSent.map((f) => ({
      friendshipId: f.id,
      user: f.addressee,
      createdAt: f.createdAt,
    })),
  });
}

// POST /api/friends — send a friend request
// Body: { username: string } or { userId: string }
export async function POST(request: Request) {
  const token = await getAuthCookie();
  if (!token) return Response.json({ error: "未登录" }, { status: 401 });
  const payload = await verifyToken(token);
  if (!payload) return Response.json({ error: "登录已过期" }, { status: 401 });

  const userId = payload.userId;
  const body = await request.json();
  const { username, userId: targetId } = body;

  if (!username && !targetId) {
    return Response.json({ error: "请提供 username 或 userId" }, { status: 400 });
  }

  // Find target user
  let target;
  if (targetId) {
    target = await prisma.user.findUnique({ where: { id: targetId }, select: { id: true, username: true } });
  } else {
    target = await prisma.user.findUnique({ where: { username }, select: { id: true, username: true } });
  }

  if (!target) {
    return Response.json({ error: "用户不存在" }, { status: 404 });
  }

  if (target.id === userId) {
    return Response.json({ error: "不能添加自己为好友" }, { status: 400 });
  }

  // Check if friendship already exists (either direction)
  const existing = await prisma.friendship.findFirst({
    where: {
      OR: [
        { requesterId: userId, addresseeId: target.id },
        { requesterId: target.id, addresseeId: userId },
      ],
    },
  });

  if (existing) {
    if (existing.status === "accepted") {
      return Response.json({ error: "你们已经是好友了" }, { status: 409 });
    }
    if (existing.status === "pending") {
      return Response.json({ error: "好友请求已存在，等待对方确认" }, { status: 409 });
    }
    if (existing.status === "blocked") {
      return Response.json({ error: "无法添加该用户" }, { status: 403 });
    }
  }

  const friendship = await prisma.friendship.create({
    data: { requesterId: userId, addresseeId: target.id, status: "pending" },
  });

  return Response.json({ friendship, message: "好友请求已发送" }, { status: 201 });
}
