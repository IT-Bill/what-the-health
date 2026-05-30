import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/posts/[id] — full post detail with comments
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const post = await prisma.post.findUnique({
    where: { id },
    include: {
      author: { select: { id: true, name: true, avatarUrl: true } },
      comments: {
        orderBy: { createdAt: "asc" },
        include: {
          author: { select: { id: true, name: true, avatarUrl: true } },
        },
      },
      _count: { select: { likes: true, comments: true } },
    },
  });

  if (!post) {
    return Response.json({ error: "Post not found" }, { status: 404 });
  }

  // Increment view count (fire and forget)
  prisma.post.update({ where: { id }, data: { viewCount: { increment: 1 } } }).catch(() => {});

  // Check if current demo user has liked (simplified: first user)
  const user = await prisma.user.findFirst();
  const liked = user
    ? (await prisma.like.findUnique({
        where: { postId_authorId: { postId: id, authorId: user.id } },
      })) !== null
    : false;

  // Nest replies under parent comments
  const topLevel = post.comments.filter((c) => !c.parentId);
  const replies = post.comments.filter((c) => c.parentId);
  const commentsNested = topLevel.map((c) => ({
    ...c,
    replies: replies.filter((r) => r.parentId === c.id),
  }));

  return Response.json({
    ...post,
    liked,
    comments: commentsNested,
  });
}
