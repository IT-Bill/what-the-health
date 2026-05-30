import { prisma } from "@/lib/prisma";
import { getAuthCookie, verifyToken } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// PATCH /api/friends/[id] — accept/reject/block a friend request
// Body: { action: "accept" | "reject" | "block" }
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const token = await getAuthCookie();
  if (!token) return Response.json({ error: "未登录" }, { status: 401 });
  const payload = await verifyToken(token);
  if (!payload) return Response.json({ error: "登录已过期" }, { status: 401 });

  const { id } = await params;
  const userId = payload.userId;
  const body = await request.json();
  const { action } = body;

  if (!["accept", "reject", "block"].includes(action)) {
    return Response.json({ error: "action 必须是 accept/reject/block" }, { status: 400 });
  }

  const friendship = await prisma.friendship.findUnique({ where: { id } });
  if (!friendship) {
    return Response.json({ error: "好友关系不存在" }, { status: 404 });
  }

  // Only the addressee can accept/reject; either party can block
  if (action === "accept" || action === "reject") {
    if (friendship.addresseeId !== userId) {
      return Response.json({ error: "只有被请求方可以接受或拒绝" }, { status: 403 });
    }
    if (friendship.status !== "pending") {
      return Response.json({ error: "该请求已处理" }, { status: 409 });
    }
  }

  if (action === "block") {
    if (friendship.requesterId !== userId && friendship.addresseeId !== userId) {
      return Response.json({ error: "无权操作" }, { status: 403 });
    }
  }

  if (action === "reject") {
    await prisma.friendship.delete({ where: { id } });
    return Response.json({ message: "已拒绝" });
  }

  const updated = await prisma.friendship.update({
    where: { id },
    data: { status: action === "accept" ? "accepted" : "blocked" },
  });

  return Response.json({ friendship: updated });
}

// DELETE /api/friends/[id] — unfriend (remove friendship + permissions)
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const token = await getAuthCookie();
  if (!token) return Response.json({ error: "未登录" }, { status: 401 });
  const payload = await verifyToken(token);
  if (!payload) return Response.json({ error: "登录已过期" }, { status: 401 });

  const { id } = await params;
  const userId = payload.userId;

  const friendship = await prisma.friendship.findUnique({ where: { id } });
  if (!friendship) {
    return Response.json({ error: "好友关系不存在" }, { status: 404 });
  }

  if (friendship.requesterId !== userId && friendship.addresseeId !== userId) {
    return Response.json({ error: "无权操作" }, { status: 403 });
  }

  const friendId = friendship.requesterId === userId ? friendship.addresseeId : friendship.requesterId;

  // Remove permissions in both directions
  await prisma.friendPermission.deleteMany({
    where: {
      OR: [
        { ownerId: userId, friendId },
        { ownerId: friendId, friendId: userId },
      ],
    },
  });

  // Delete friendship
  await prisma.friendship.delete({ where: { id } });

  return Response.json({ message: "已解除好友关系" });
}
