import { getSessionUser } from "@/lib/session-user";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type LoadedComment = {
  id: string;
  body: string;
  createdAt: Date;
  updatedAt: Date;
  parentId: string | null;
  postId: string;
  authorId: string;
  author: {
    id: string;
    name: string;
    avatarUrl: string | null;
  };
  likes: { id: string }[];
  favorites: { id: string }[];
  _count: {
    likes: number;
    favorites: number;
  };
};

type CommentNode = Omit<LoadedComment, "likes" | "favorites"> & {
  liked: boolean;
  favorited: boolean;
  replies: CommentNode[];
};

function buildCommentTree(
  comments: LoadedComment[],
  parentId: string | null
): CommentNode[] {
  return comments
    .filter((comment) => comment.parentId === parentId)
    .map(({ likes, favorites, ...comment }) => ({
      ...comment,
      liked: likes.length > 0,
      favorited: favorites.length > 0,
      replies: buildCommentTree(comments, comment.id),
    }));
}

// GET /api/posts/[id] — full post detail with comments
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const sessionUser = await getSessionUser();
  const viewerId = sessionUser?.userId ?? "__anonymous__";

  const post = await prisma.post.findUnique({
    where: { id },
    include: {
      author: { select: { id: true, name: true, avatarUrl: true } },
      likes: {
        where: { authorId: viewerId },
        select: { id: true },
      },
      favorites: {
        where: { authorId: viewerId },
        select: { id: true },
      },
      comments: {
        orderBy: { createdAt: "asc" },
        include: {
          author: { select: { id: true, name: true, avatarUrl: true } },
          likes: {
            where: { authorId: viewerId },
            select: { id: true },
          },
          favorites: {
            where: { authorId: viewerId },
            select: { id: true },
          },
          _count: {
            select: { likes: true, favorites: true },
          },
        },
      },
      _count: { select: { likes: true, comments: true, favorites: true } },
    },
  });

  if (!post) {
    return Response.json({ error: "Post not found" }, { status: 404 });
  }

  prisma.post
    .update({ where: { id }, data: { viewCount: { increment: 1 } } })
    .catch(() => {});

  const { likes, favorites, comments, ...postData } = post;

  return Response.json({
    ...postData,
    liked: likes.length > 0,
    favorited: favorites.length > 0,
    comments: buildCommentTree(comments as LoadedComment[], null),
  });
}
