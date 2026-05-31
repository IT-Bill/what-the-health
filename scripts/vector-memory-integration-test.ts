import "dotenv/config";
import assert from "node:assert/strict";
import { embedTextWithBailian } from "@/lib/embeddings/bailian";
import { rememberPostInteraction } from "@/lib/memory/interaction-memory";
import { MEMORY_VECTOR_NAMESPACE } from "@/lib/memory/constants";
import { recordMemoryEvent } from "@/lib/memory/vector-memory";
import { prisma } from "@/lib/prisma";
import { POST_VECTOR_NAMESPACE, searchPostsByVector } from "@/lib/posts/post-vector-search";
import {
  closeVectorPool,
  searchVectorDocuments,
  upsertVectorDocument,
} from "@/lib/vector/pgvector";

const QA_NAMESPACE = "__qa_vector";

async function poll<T>(fn: () => Promise<T | null>, label: string, attempts = 12): Promise<T> {
  for (let i = 0; i < attempts; i++) {
    const value = await fn();
    if (value) return value;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`Timed out waiting for ${label}`);
}

async function main() {
  assert.ok(process.env.ALIYUN_BAILIAN_API_KEY, "ALIYUN_BAILIAN_API_KEY is required");

  const user = await prisma.user.findFirst({
    orderBy: { createdAt: "asc" },
    select: { id: true, username: true },
  });
  assert.ok(user, "Expected at least one user");

  const post = await prisma.post.findFirst({
    where: { published: true },
    orderBy: { publishedAt: "desc" },
    select: { id: true, title: true, excerpt: true, category: true },
  });
  assert.ok(post, "Expected at least one published post");

  const embedding = await embedTextWithBailian("睡眠、压力和健康习惯的向量测试");
  assert.equal(embedding.length, 1024, "Bailian text-embedding-v4 should return 1024 dimensions");

  const qaSourceId = `qa-${Date.now()}`;
  await upsertVectorDocument(
    {
      namespace: QA_NAMESPACE,
      sourceId: qaSourceId,
      userId: user.id,
      title: "QA vector document",
      content: "用户关注睡眠、压力、咖啡和晚间习惯。",
      metadata: { kind: "qa" },
    },
    embedding
  );

  const qaResults = await searchVectorDocuments({
    namespace: QA_NAMESPACE,
    userId: user.id,
    embedding,
    limit: 1,
    metadata: { kind: "qa" },
  });
  assert.equal(qaResults[0]?.sourceId, qaSourceId, "Generic PGVector search should return inserted QA doc");

  const searchResult = await searchPostsByVector({
    query: "睡眠不足和咖啡影响",
    limit: 3,
  });
  assert.ok(Array.isArray(searchResult), "search_posts vector adapter should return an array");
  assert.ok(searchResult.length > 0, "search_posts vector search should return posts");
  assert.ok(
    searchResult.every((item: { similarity?: number }) => typeof item.similarity === "number"),
    "search_posts results should include similarity"
  );

  const postVectors = await searchVectorDocuments({
    namespace: POST_VECTOR_NAMESPACE,
    embedding,
    limit: 3,
  });
  assert.ok(postVectors.length > 0, "Post vector namespace should have indexed documents");

  const memory = await recordMemoryEvent({
    userId: user.id,
    source: "qa-memory",
    sourceId: qaSourceId,
    note: "用户在测试中表达了对睡眠、咖啡和晚间节律的关注。",
    metadata: { kind: "qa" },
    updatePersona: false,
  });
  const memoryEmbedding = await embedTextWithBailian("睡眠 咖啡 晚间节律");
  const memoryResults = await searchVectorDocuments({
    namespace: MEMORY_VECTOR_NAMESPACE,
    userId: user.id,
    embedding: memoryEmbedding,
    limit: 5,
    metadata: { kind: "qa" },
  });
  assert.equal(memoryResults[0]?.sourceId, memory.id, "Memory vector search should return inserted memory");

  const beforeLikeMemoryCount = await prisma.memory.count({
    where: { userId: user.id, source: "post-like", sourceId: post.id },
  });
  rememberPostInteraction({
    userId: user.id,
    action: "like",
    post,
  });

  const likeMemory = await poll(
    async () =>
      prisma.memory.findFirst({
        where: {
          userId: user.id,
          source: "post-like",
          sourceId: post.id,
          createdAt: { gte: new Date(Date.now() - 60_000) },
        },
        orderBy: { createdAt: "desc" },
        select: { id: true, note: true },
      }),
    "post-like memory"
  );
  assert.ok(likeMemory.note?.includes(post.title), "Post like memory should mention the liked post title");

  await poll(
    async () => {
      const rows = await searchVectorDocuments({
        namespace: MEMORY_VECTOR_NAMESPACE,
        userId: user.id,
        embedding: await embedTextWithBailian(post.title),
        limit: 10,
        metadata: { source: "post-like", postId: post.id },
      });
      return rows.find((row) => row.sourceId === likeMemory.id) ?? null;
    },
    "post-like memory vector"
  );

  const afterLikeMemoryCount = await prisma.memory.count({
    where: { userId: user.id, source: "post-like", sourceId: post.id },
  });
  assert.ok(
    afterLikeMemoryCount > beforeLikeMemoryCount,
    "Post like interaction should create a new memory row"
  );

  console.log(
    JSON.stringify(
      {
        ok: true,
        user: user.username,
        embeddingDimensions: embedding.length,
        searchPostsReturned: searchResult.length,
        postVectorHits: postVectors.length,
        memoryId: memory.id,
        likeMemoryId: likeMemory.id,
      },
      null,
      2
    )
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await Promise.all([prisma.$disconnect(), closeVectorPool()]);
  });
