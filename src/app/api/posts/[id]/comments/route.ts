import { getSessionUser } from "@/lib/session-user";
import { prisma } from "@/lib/prisma";
import { rememberPostInteraction } from "@/lib/memory/interaction-memory";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type CreateCommentBody = {
  body?: string;
  parentId?: string | null;
};

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const sessionUser = await getSessionUser();
  if (!sessionUser) {
    return Response.json({ error: "未登录" }, { status: 401 });
  }

  const { id } = await params;

  let body: CreateCommentBody;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "请求体不是合法 JSON" }, { status: 400 });
  }

  const content = body.body?.trim();
  if (!content) {
    return Response.json({ error: "评论内容不能为空" }, { status: 400 });
  }

  const parentId = body.parentId ?? null;

  const result = await prisma.$transaction(async (tx) => {
    const post = await tx.post.findUnique({
      where: { id },
      select: { id: true, title: true, excerpt: true, category: true, authorId: true },
    });

    if (!post) {
      return { error: "文章不存在", status: 404 as const };
    }

    let parentCommentAuthorId: string | null = null;
    if (parentId) {
      const parentComment = await tx.comment.findUnique({
        where: { id: parentId },
        select: { postId: true, authorId: true },
      });

      if (!parentComment || parentComment.postId !== id) {
        return { error: "回复目标不存在", status: 400 as const };
      }
      parentCommentAuthorId = parentComment.authorId;
    }

    const comment = await tx.comment.create({
      data: {
        postId: id,
        authorId: sessionUser.userId,
        parentId,
        body: content,
      },
      include: {
        author: {
          select: { id: true, name: true, avatarUrl: true },
        },
      },
    });

    // Notify post author (skip if commenting on own post)
    if (post.authorId !== sessionUser.userId) {
      await tx.notification.create({
        data: {
          userId: post.authorId,
          title: `${comment.author.name} 评论了你的帖子`,
          body: `《${post.title}》：${content.slice(0, 50)}${content.length > 50 ? "…" : ""}`,
          source: "post-comment",
          actionUrl: `/discover/post/${id}#comment-${comment.id}`,
          metadata: {
            actorId: sessionUser.userId,
            postId: id,
            commentId: comment.id,
            targetType: "post",
            kind: "comment",
          },
        },
      });
    }

    // If replying to someone else's comment, also notify that comment's author
    if (parentId && parentCommentAuthorId && parentCommentAuthorId !== sessionUser.userId && parentCommentAuthorId !== post.authorId) {
      await tx.notification.create({
        data: {
          userId: parentCommentAuthorId,
          title: `${comment.author.name} 回复了你的评论`,
          body: `在《${post.title}》中：${content.slice(0, 50)}${content.length > 50 ? "…" : ""}`,
          source: "post-comment-reply",
          actionUrl: `/discover/post/${id}#comment-${comment.id}`,
          metadata: {
            actorId: sessionUser.userId,
            postId: id,
            commentId: comment.id,
            parentCommentId: parentId,
            targetType: "comment",
            kind: "reply",
          },
        },
      });
    }

    return {
      comment: {
        ...comment,
        liked: false,
        favorited: false,
        _count: {
          likes: 0,
          favorites: 0,
        },
        replies: [],
      },
      status: 201 as const,
      memory: { post, commentBody: content },
    };
  });

  if ("error" in result) {
    return Response.json({ error: result.error }, { status: result.status });
  }

  rememberPostInteraction({
    userId: sessionUser.userId,
    action: "comment",
    post: result.memory.post,
    commentBody: result.memory.commentBody,
  });

  return Response.json({ comment: result.comment }, { status: result.status });
}
