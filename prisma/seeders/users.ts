import type { PrismaClient } from "../../src/generated/prisma/client";
import bcrypt from "bcryptjs";

export interface SeedUserConfig {
  username: string;
  password: string;
}

/**
 * Parse SEED_USERS env var.
 * Format: "username1:password1,username2:password2"
 * Falls back to individual SEED_USERNAME/SEED_PASSWORD for backward compat.
 */
export function parseSeedUsers(): SeedUserConfig[] {
  const seedUsers = process.env.SEED_USERS;
  if (seedUsers) {
    return seedUsers.split(",").map((pair) => {
      const [username, password] = pair.trim().split(":");
      if (!username || !password) {
        throw new Error(`Invalid SEED_USERS format. Expected "user1:pass1,user2:pass2", got: "${pair}"`);
      }
      return { username, password };
    });
  }
  // Fallback to legacy single-user env vars
  return [{
    username: process.env.SEED_USERNAME || "elena",
    password: process.env.SEED_PASSWORD || "123456",
  }];
}

export interface SeededUser {
  id: string;
  username: string;
}

export async function seedUsers(prisma: PrismaClient, configs: SeedUserConfig[]): Promise<SeededUser[]> {
  const users: SeededUser[] = [];

  for (const config of configs) {
    const passwordHash = await bcrypt.hash(config.password, 10);
    const user = await prisma.user.upsert({
      where: { username: config.username },
      update: { passwordHash },
      create: {
        username: config.username,
        passwordHash,
        name: config.username.charAt(0).toUpperCase() + config.username.slice(1),
        memberSince: new Date("2021-01-01"),
        credits: 2450,
        primaryGoal: "healthyHabits",
      },
    });
    users.push({ id: user.id, username: user.username });
  }

  return users;
}
