import { neonConfig } from "@neondatabase/serverless";
import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaClient } from "@/generated/prisma/client";
import ws from "ws";

neonConfig.webSocketConstructor = ws;

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient(): PrismaClient {
  const adapter = new PrismaNeon({
    connectionString: process.env.DATABASE_URL,
  });
  return new PrismaClient({ adapter });
}

function getPrismaClient(): PrismaClient {
  const cached = globalForPrisma.prisma;
  if (cached && "users" in cached) {
    return cached;
  }
  const fresh = createPrismaClient();
  if (process.env.NODE_ENV !== "production") {
    globalForPrisma.prisma = fresh;
  }
  return fresh;
}

export const prisma = getPrismaClient();
