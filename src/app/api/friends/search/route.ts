import { prisma } from "@/lib/prisma";
import { getAuthCookie, verifyToken } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/friends/search?q=keyword — search users by username or name
export async function GET(request: Request) {
  const token = await getAuthCookie();
  if (!token) return Response.json({ error: "未登录" }, { status: 401 });
  const payload = await verifyToken(token);
  if (!payload) return Response.json({ error: "登录已过期" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim();

  if (!q || q.length < 1) {
    return Response.json({ error: "搜索关键词不能为空" }, { status: 400 });
  }

  const userId = payload.userId;

  // Search by exact username OR fuzzy name match (case-insensitive)
  const users = await prisma.user.findMany({
    where: {
      AND: [
        { id: { not: userId } }, // exclude self
        {
          OR: [
            { username: { equals: q, mode: "insensitive" } },
            { username: { contains: q, mode: "insensitive" } },
            { name: { contains: q, mode: "insensitive" } },
          ],
        },
      ],
    },
    select: {
      id: true,
      username: true,
      name: true,
      avatarUrl: true,
    },
    take: 20,
  });

  // For each result, check friendship status
  const results = await Promise.all(
    users.map(async (u) => {
      const friendship = await prisma.friendship.findFirst({
        where: {
          OR: [
            { requesterId: userId, addresseeId: u.id },
            { requesterId: u.id, addresseeId: userId },
          ],
        },
        select: { id: true, status: true, requesterId: true },
      });

      let friendshipStatus: string | null = null;
      if (friendship) {
        if (friendship.status === "accepted") friendshipStatus = "friend";
        else if (friendship.status === "pending") {
          friendshipStatus = friendship.requesterId === userId ? "pending_sent" : "pending_received";
        } else if (friendship.status === "blocked") friendshipStatus = "blocked";
      }

      return { ...u, friendshipStatus, friendshipId: friendship?.id ?? null };
    })
  );

  return Response.json(results);
}
