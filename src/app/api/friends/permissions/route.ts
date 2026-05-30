import { prisma } from "@/lib/prisma";
import { getAuthCookie, verifyToken } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/friends/permissions?friendId=xxx — get permissions I've granted to a friend
export async function GET(request: Request) {
  const token = await getAuthCookie();
  if (!token) return Response.json({ error: "未登录" }, { status: 401 });
  const payload = await verifyToken(token);
  if (!payload) return Response.json({ error: "登录已过期" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const friendId = searchParams.get("friendId");

  if (!friendId) {
    return Response.json({ error: "需要提供 friendId" }, { status: 400 });
  }

  // Verify they are actually friends
  const friendship = await prisma.friendship.findFirst({
    where: {
      status: "accepted",
      OR: [
        { requesterId: payload.userId, addresseeId: friendId },
        { requesterId: friendId, addresseeId: payload.userId },
      ],
    },
  });

  if (!friendship) {
    return Response.json({ error: "你们不是好友" }, { status: 403 });
  }

  // Get permissions I've granted to this friend
  const granted = await prisma.friendPermission.findMany({
    where: { ownerId: payload.userId, friendId },
    select: { id: true, content: true },
  });

  // Get permissions this friend has granted to me
  const received = await prisma.friendPermission.findMany({
    where: { ownerId: friendId, friendId: payload.userId },
    select: { id: true, content: true },
  });

  return Response.json({
    granted: granted.map((p) => p.content),
    received: received.map((p) => p.content),
  });
}

// PUT /api/friends/permissions — update permissions I grant to a friend
// Body: { friendId: string, permissions: ShareableContent[] }
export async function PUT(request: Request) {
  const token = await getAuthCookie();
  if (!token) return Response.json({ error: "未登录" }, { status: 401 });
  const payload = await verifyToken(token);
  if (!payload) return Response.json({ error: "登录已过期" }, { status: 401 });

  const body = await request.json();
  const { friendId, permissions } = body;

  if (!friendId || !Array.isArray(permissions)) {
    return Response.json({ error: "需要提供 friendId 和 permissions 数组" }, { status: 400 });
  }

  const validPermissions = [
    "weeklyReport", "monthlyReport", "insights", "goals", "moodHistory", "posts",
  ];
  const filtered = permissions.filter((p: string) => validPermissions.includes(p));

  // Verify friendship
  const friendship = await prisma.friendship.findFirst({
    where: {
      status: "accepted",
      OR: [
        { requesterId: payload.userId, addresseeId: friendId },
        { requesterId: friendId, addresseeId: payload.userId },
      ],
    },
  });

  if (!friendship) {
    return Response.json({ error: "你们不是好友" }, { status: 403 });
  }

  // Replace all permissions: delete existing, create new ones
  await prisma.friendPermission.deleteMany({
    where: { ownerId: payload.userId, friendId },
  });

  if (filtered.length > 0) {
    await prisma.friendPermission.createMany({
      data: filtered.map((content: string) => ({
        ownerId: payload.userId,
        friendId,
        content: content as "weeklyReport" | "monthlyReport" | "insights" | "goals" | "moodHistory" | "posts",
      })),
    });
  }

  return Response.json({
    message: "权限已更新",
    permissions: filtered,
  });
}
