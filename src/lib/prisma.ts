import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

// Prisma 7 connects through a driver adapter rather than a built-in engine.
// In local development Neon pooled connections can reset during TLS setup, so
// prefer the direct URL there and keep pooled connections for production.
const runtimeConnectionString =
  process.env.NODE_ENV === "production"
    ? process.env.DATABASE_URL ?? process.env.DIRECT_URL
    : process.env.DIRECT_URL ?? process.env.DATABASE_URL;

const createPrismaClient = () =>
  new PrismaClient({
    adapter: new PrismaPg({ connectionString: runtimeConnectionString }),
  });

// Reuse a single client across hot reloads in development to avoid exhausting
// database connections (Next.js re-evaluates modules on every change).
const globalForPrisma = globalThis as unknown as {
  prisma?: ReturnType<typeof createPrismaClient>;
};

function getPrismaClient(): PrismaClient {
  const cached = globalForPrisma.prisma;
  if (cached && "user" in cached) {
    return cached;
  }
  const fresh = createPrismaClient();
  if (process.env.NODE_ENV !== "production") {
    globalForPrisma.prisma = fresh;
  }
  return fresh;
}

export const prisma = getPrismaClient();
