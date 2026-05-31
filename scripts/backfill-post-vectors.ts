import "dotenv/config";
import { syncPublishedPostsToVectorStore } from "@/lib/posts/post-vector-search";
import { prisma } from "@/lib/prisma";
import { closeVectorPool } from "@/lib/vector/pgvector";

const limit = Number(process.argv[2] ?? 200);

syncPublishedPostsToVectorStore(limit)
  .then((count) => {
    console.log(`Indexed ${count} post vectors.`);
  })
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await Promise.all([prisma.$disconnect(), closeVectorPool()]);
  });
