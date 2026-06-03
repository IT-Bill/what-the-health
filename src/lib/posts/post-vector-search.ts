import type { JourneyCategory } from "@/generated/prisma/enums";
import { embedTextWithBailian } from "@/lib/embeddings/bailian";
import { prisma } from "@/lib/prisma";
import {
  findExistingVectorSourceIds,
  normalizeVectorLimit,
  searchVectorDocuments,
  upsertVectorDocument,
} from "@/lib/vector/pgvector";

export const POST_VECTOR_NAMESPACE = "post";
export const MAX_POST_VECTOR_RESULTS = 3;

export function clampPostVectorLimit(limit: number | undefined): number {
  return Math.min(normalizeVectorLimit(limit ?? MAX_POST_VECTOR_RESULTS), MAX_POST_VECTOR_RESULTS);
}

type PostVectorCategory = JourneyCategory | "mindfulness" | "nutrition" | "reflection" | "sleep";

interface PostVectorRow {
  id: string;
  authorId: string;
  title: string;
  excerpt: string | null;
  body: string;
  category: JourneyCategory;
  categoryIcon: string | null;
  readMinutes: number;
  publishedAt: Date;
}

export function buildPostVectorContent(post: Pick<PostVectorRow, "title" | "excerpt" | "body" | "category">): string {
  const body = post.body.length > 6000 ? `${post.body.slice(0, 6000)}...` : post.body;
  return [
    `标题：${post.title}`,
    post.excerpt ? `摘要：${post.excerpt}` : null,
    `分类：${post.category}`,
    `正文：${body}`,
  ]
    .filter(Boolean)
    .join("\n");
}

export async function syncPublishedPostsToVectorStore(limit = 50): Promise<number> {
  const posts = await prisma.post.findMany({
    where: { published: true },
    orderBy: { updatedAt: "desc" },
    take: limit,
    select: {
      id: true,
      authorId: true,
      title: true,
      excerpt: true,
      body: true,
      category: true,
      categoryIcon: true,
      readMinutes: true,
      publishedAt: true,
    },
  });

  const existingIds = await findExistingVectorSourceIds(
    POST_VECTOR_NAMESPACE,
    posts.map((post) => post.id)
  );

  let indexed = 0;
  for (const post of posts) {
    if (existingIds.has(post.id)) continue;

    const content = buildPostVectorContent(post);
    const embedding = await embedTextWithBailian(content);
    await upsertVectorDocument(
      {
        namespace: POST_VECTOR_NAMESPACE,
        sourceId: post.id,
        userId: post.authorId,
        title: post.title,
        content,
        metadata: {
          category: post.category,
          categoryIcon: post.categoryIcon,
          readMinutes: post.readMinutes,
          publishedAt: post.publishedAt.toISOString(),
        },
      },
      embedding
    );
    indexed += 1;
  }

  return indexed;
}

export async function searchPostsByVector(options: {
  query?: string;
  category?: PostVectorCategory;
  limit?: number;
}) {
  const take = clampPostVectorLimit(options.limit);
  await syncPublishedPostsToVectorStore();

  const queryText = options.query?.trim() || options.category || "健康 疗愈 正念 睡眠 饮食 情绪";
  const queryEmbedding = await embedTextWithBailian(queryText);
  const vectorResults = await searchVectorDocuments<{ category?: string }>({
    namespace: POST_VECTOR_NAMESPACE,
    embedding: queryEmbedding,
    limit: take,
    metadata: options.category ? { category: options.category } : undefined,
  });

  const ids = vectorResults.map((result) => result.sourceId);
  if (ids.length === 0) return [];

  const posts = await prisma.post.findMany({
    where: {
      id: { in: ids },
      published: true,
      category: options.category,
    },
    select: {
      id: true,
      title: true,
      excerpt: true,
      category: true,
      categoryIcon: true,
      coverImage: true,
      readMinutes: true,
      publishedAt: true,
      viewCount: true,
      author: { select: { name: true } },
      _count: { select: { likes: true, comments: true } },
    },
  });

  const byId = new Map(posts.map((post) => [post.id, post]));
  return vectorResults
    .map((result) => {
      const post = byId.get(result.sourceId);
      if (!post) return null;
      return {
        ...post,
        similarity: result.similarity,
      };
    })
    .filter((post): post is NonNullable<typeof post> => Boolean(post));
}
