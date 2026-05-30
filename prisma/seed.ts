import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { parseSeedUsers, seedUsers } from "./seeders/users";
import { seedProducts } from "./seeders/products";
import { seedPosts } from "./seeders/posts";
import { seedGoals } from "./seeders/goals";
import { seedCredits } from "./seeders/credits";
import { seedReports } from "./seeders/reports";
import { seedMisc } from "./seeders/misc";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DIRECT_URL ?? process.env.DATABASE_URL }),
});

async function main() {
  // --- Global catalogs (shared across all users) ---
  await seedProducts(prisma);

  // --- Users (from env: SEED_USERS="user1:pass1,user2:pass2") ---
  const configs = parseSeedUsers();
  const users = await seedUsers(prisma, configs);

  console.log(`\nSeeding ${users.length} user(s)...`);

  // --- Per-user data ---
  for (const user of users) {
    console.log(`\n  [${user.username}]`);

    await seedPosts(prisma, user);
    await seedGoals(prisma, user);
    await seedCredits(prisma, user);
    await seedReports(prisma, user);
    await seedMisc(prisma, user);

    console.log(`    posts: ${await prisma.post.count({ where: { authorId: user.id } })}`);
    console.log(`    goals: ${await prisma.goal.count({ where: { userId: user.id } })}`);
    console.log(`    reports: ${await prisma.report.count({ where: { userId: user.id } })}`);
    console.log(`    insights: ${await prisma.insight.count({ where: { userId: user.id } })}`);
    console.log(`    credit_txns: ${await prisma.creditTransaction.count({ where: { userId: user.id } })}`);
  }

  // --- Summary ---
  console.log("\n--- Seed complete ---");
  console.log(`  users: ${await prisma.user.count()}`);
  console.log(`  products: ${await prisma.product.count()}`);
  console.log(`  credit_rules: ${await prisma.creditRule.count()}`);
  console.log(`  total posts: ${await prisma.post.count()}`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
