import { getSessionUser } from "@/lib/session-user";
import { prisma } from "@/lib/prisma";
import { rememberPostInteraction } from "@/lib/memory/interaction-memory";

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
      select: { id: true, title: true, excerpt: true, category: true, authorId: true },
    });

    if (!post) {
      return null;
    }

    await tx.postFavorite.upsert({
      where: { postId_authorId: { postId: id, authorId: actor.id } },
      create: { postId: id, authorId: actor.id },
      update: {},
    });

    if (post.authorId !== actor.id) {
      await tx.notification.create({
        data: {
          userId: post.authorId,
          title: `${actor.name} 收藏了你的帖子`,
          body: `《${post.title}》被加入了收藏。`,
          source: "post-favorite",
          actionUrl: `/discover/${post.id}`,
          metadata: {
            actorId: actor.id,
            postId: post.id,
            targetType: "post",
            kind: "favorite",
          },
        },
      });
    }

    const favoriteCount = await tx.postFavorite.count({ where: { postId: id } });
    return { favorited: true, favoriteCount, memory: { post } };
  });

  if (!result) {
    return Response.json({ error: "文章不存在" }, { status: 404 });
  }

  const { memory, ...response } = result;
  rememberPostInteraction({ userId: actor.id, action: "favorite", post: memory.post });
  return Response.json(response);
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

    await tx.postFavorite.deleteMany({
      where: { postId: id, authorId: actor.id },
    });

    const favoriteCount = await tx.postFavorite.count({ where: { postId: id } });
    return { favorited: false, favoriteCount };
  });

  if (!result) {
    return Response.json({ error: "文章不存在" }, { status: 404 });
  }

  return Response.json(result);
}
