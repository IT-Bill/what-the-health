import "dotenv/config";
import { backfillChatMessagesToVectorMemory } from "@/lib/memory/chat-vector-memory";
import { prisma } from "@/lib/prisma";
import { closeVectorPool } from "@/lib/vector/pgvector";

const limit = Number(process.argv[2] ?? 500);

backfillChatMessagesToVectorMemory(limit)
  .then((count) => {
    console.log(`Indexed ${count} chat message vectors.`);
  })
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await Promise.all([prisma.$disconnect(), closeVectorPool()]);
  });
