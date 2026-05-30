import { config } from "dotenv";
config({ override: true });
import { defineConfig } from "prisma/config";

// Prisma 7 moves connection URLs and seed config out of schema.prisma.
// Migrations/introspection use the DIRECT (non-pooled) Neon connection;
// the app runtime uses the pooled DATABASE_URL via the driver adapter
// (see src/lib/prisma.ts).
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: process.env.DIRECT_URL ?? process.env.DATABASE_URL ?? "",
  },
});
