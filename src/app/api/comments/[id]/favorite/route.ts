import { getSessionUser } from "@/lib/session-user";
import { prisma } from "@/lib/prisma";
import { rememberCommentInteraction } from "@/lib/memory/interaction-memory";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function toSnippet(text: string) {
  return text.length > 36 ? `${text.slice(0, 36)}...` : text;
}

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
    const comment = await tx.comment.findUnique({
      where: { id },
      select: {
        id: true,
        body: true,
        postId: true,
        authorId: true,
        post: { select: { title: true } },
      },
    });

    if (!comment) {
      return null;
    }

    await tx.commentFavorite.upsert({
      where: { commentId_authorId: { commentId: id, authorId: actor.id } },
      create: { commentId: id, authorId: actor.id },
      update: {},
    });

    if (comment.authorId !== actor.id) {
      await tx.notification.create({
        data: {
          userId: comment.authorId,
          title: `${actor.name} 收藏了你的评论`,
          body: `《${comment.post.title}》下的评论“${toSnippet(comment.body)}”被加入了收藏。`,
          source: "comment-favorite",
          actionUrl: `/discover/${comment.postId}`,
          metadata: {
            actorId: actor.id,
            commentId: comment.id,
            postId: comment.postId,
            targetType: "comment",
            kind: "favorite",
          },
        },
      });
    }

    const favoriteCount = await tx.commentFavorite.count({ where: { commentId: id } });
    return {
      favorited: true,
      favoriteCount,
      memory: {
        comment: {
          id: comment.id,
          body: comment.body,
          postId: comment.postId,
          postTitle: comment.post.title,
        },
      },
    };
  });

  if (!result) {
    return Response.json({ error: "评论不存在" }, { status: 404 });
  }

  const { memory, ...response } = result;
  rememberCommentInteraction({ userId: actor.id, action: "favorite", comment: memory.comment });
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
    const comment = await tx.comment.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!comment) {
      return null;
    }

    await tx.commentFavorite.deleteMany({
      where: { commentId: id, authorId: actor.id },
    });

    const favoriteCount = await tx.commentFavorite.count({ where: { commentId: id } });
    return { favorited: false, favoriteCount };
  });

  if (!result) {
    return Response.json({ error: "评论不存在" }, { status: 404 });
  }

  return Response.json(result);
}
