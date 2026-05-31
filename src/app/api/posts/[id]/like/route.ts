import { getSessionUser } from "@/lib/session-user";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function getActor() {
  const sessionUser = await getSessionUser();
  if (!sessionUser) {
    return null;
  }

  return prisma.user.findUnique({
    where: { id: sessionUser.userId },
    select: { id: true, name: true },
  });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const actor = await getActor();
  if (!actor) {
    return Response.json({ error: "未登录" }, { status: 401 });
  }

  const { id } = await params;
  const result = await prisma.$transaction(async (tx) => {
    const post = await tx.post.findUnique({
      where: { id },
      select: { id: true, title: true, authorId: true },
    });

    if (!post) {
      return null;
    }

    await tx.like.upsert({
      where: { postId_authorId: { postId: id, authorId: actor.id } },
      create: { postId: id, authorId: actor.id },
      update: {},
    });

    if (post.authorId !== actor.id) {
      await tx.notification.create({
        data: {
          userId: post.authorId,
          title: `${actor.name} 赞了你的帖子`,
          body: `《${post.title}》收到了一个新的赞。`,
          source: "post-like",
          actionUrl: `/discover/${post.id}`,
          metadata: {
            actorId: actor.id,
            postId: post.id,
            targetType: "post",
            kind: "like",
          },
        },
      });
    }

    const likeCount = await tx.like.count({ where: { postId: id } });
    return { liked: true, likeCount };
  });

  if (!result) {
    return Response.json({ error: "文章不存在" }, { status: 404 });
  }

  return Response.json(result);
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const actor = await getActor();
  if (!actor) {
    return Response.json({ error: "未登录" }, { status: 401 });
  }

  const { id } = await params;
  const result = await prisma.$transaction(async (tx) => {
    const post = await tx.post.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!post) {
      return null;
    }

    await tx.like.deleteMany({
      where: { postId: id, authorId: actor.id },
    });

    const likeCount = await tx.like.count({ where: { postId: id } });
    return { liked: false, likeCount };
  });

  if (!result) {
    return Response.json({ error: "文章不存在" }, { status: 404 });
  }

  return Response.json(result);
}