import { prisma } from "@/lib/prisma";
import { getAuthCookie, verifyToken } from "@/lib/auth";

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
        select: { likes: true, comments: true, favorites: true },
      },
    },
  });

  return Response.json(posts);
}

// POST /api/posts — create a new post (requires auth)
export async function POST(request: Request) {
  const token = await getAuthCookie();
  if (!token) return Response.json({ error: "未登录" }, { status: 401 });
  const payload = await verifyToken(token);
  if (!payload) return Response.json({ error: "登录已过期" }, { status: 401 });

  const body = await request.json();
  const { title, excerpt, body: postBody, category, coverImage } = body;

  if (!title?.trim() || !postBody?.trim()) {
    return Response.json({ error: "标题和正文不能为空" }, { status: 400 });
  }

  const validCategories = ["mindfulness", "nutrition", "sleep", "reflection"];
  if (!validCategories.includes(category)) {
    return Response.json({ error: "无效的分类" }, { status: 400 });
  }

  // Estimate read time (~200 chars/min for Chinese, ~200 words/min for English)
  const readMinutes = Math.max(1, Math.round(postBody.length / 400));

  const categoryIcons: Record<string, string> = {
    mindfulness: "spa",
    nutrition: "restaurant_menu",
    sleep: "bedtime",
    reflection: "edit_note",
  };

  const post = await prisma.post.create({
    data: {
      authorId: payload.userId,
      title: title.trim(),
      excerpt: excerpt?.trim() || null,
      body: postBody.trim(),
      category,
      categoryIcon: categoryIcons[category] || null,
      coverImage: coverImage || null,
      readMinutes,
    },
  });

  return Response.json({ id: post.id }, { status: 201 });
}
