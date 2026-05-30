import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/posts?category=mindfulness
// Returns published posts with author, like/comment counts.
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const category = searchParams.get("category");

  const where: Record<string, unknown> = { published: true };
  if (category && category !== "all") {
    where.category = category;
  }

  const posts = await prisma.post.findMany({
    where,
    orderBy: { publishedAt: "desc" },
    select: {
      id: true,
      title: true,
      excerpt: true,
      category: true,
      categoryIcon: true,
      coverImage: true,
      readMinutes: true,
      viewCount: true,
      publishedAt: true,
      author: {
        select: { id: true, name: true, avatarUrl: true },
      },
      _count: {
        select: { likes: true, comments: true },
      },
    },
  });

  return Response.json(posts);
}
