import { getSessionUser } from "@/lib/session-user";
import { prisma } from "@/lib/prisma";

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
      select: { id: true },
    });

    if (!post) {
      return { error: "文章不存在", status: 404 as const };
    }

    if (parentId) {
      const parentComment = await tx.comment.findUnique({
        where: { id: parentId },
        select: { postId: true },
      });

      if (!parentComment || parentComment.postId !== id) {
        return { error: "回复目标不存在", status: 400 as const };
      }
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
    };
  });

  if ("error" in result) {
    return Response.json({ error: result.error }, { status: result.status });
  }

  return Response.json({ comment: result.comment }, { status: result.status });
}