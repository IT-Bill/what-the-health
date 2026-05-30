import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client.ts";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DIRECT_URL ?? process.env.DATABASE_URL }),
});

// Data mirrors what the pages currently hardcode, so the UI can be wired to the
// database without visual changes.

const JOURNEYS = [
  {
    title: "上班族如何平缓度过减脂平台期",
    quote: "“从焦虑到接纳：小王的四周饮食记录”",
    category: "mindfulness" as const,
    categoryIcon: "spa",
    authorName: "Xiao Wang",
    readMinutes: 4,
    coverImage:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuDrbmsXLYiSOteMdlrNGNJlhW7a2qFB-aL73C0EiFktcnJEEze9oOM1ISJYYa_XTWMSgoVYp_CLIujeiJncs1UcCEHFKa8IWd9qpay6YwuGngo1w5IMtarjhGP5uA8gkoP_2mz7cHqJnWcP2xy6VExf8GR7lkaYQ7t2iZ0QNM36oJFPxPdwXHA2SA55BobYQLakAKPSiVmtTbeWZfi7wYu9DwMJn8t37ZzSLj9TdxmD8T95IV3fr8QffSmfiFmALefx3x_FMTg2oXo",
  },
  {
    title: "The Architecture of a Quiet Evening",
    quote:
      "“Reclaiming my nights from digital noise: A 30-day experiment in analog living.”",
    category: "reflection" as const,
    categoryIcon: "edit_note",
    authorName: "Marcus L.",
    readMinutes: 6,
    coverImage:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuBcJu1ooXwW1MLb-KSvybTdCNTyHRMtNB-5UNLBA1g0gsKOLwmddzQkOAUA7k_hdfOgpc6Mz1ekLz7iYFdGE3wQ6S9Vi0GOoZZn960pbzdn-TlrpzVKeyzhab5aBokSA5wLBfEl5YjbQfwDtJRcNIHyO-0t1IQCL93-NBMW6FsMDFUUy6X4amdm4Uz7b-vMz_kqt9f5onpfj34JQd0ezUkdb7mc58vqOSDBNLvZaXrPumW91ZIUwxSNUyTyXyZEIeosvpYVw3hLaAc",
  },
  {
    title: "Finding Balance Without Restriction",
    quote: "“Learning to listen to my body instead of counting macros.”",
    category: "nutrition" as const,
    categoryIcon: "restaurant_menu",
    authorName: "Sarah J.",
    readMinutes: 5,
    coverImage:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuCPP02i2HR4CCVgIFydvZ86zcxyiPibwltISdQcmqIbNMhE_YbBKHTaUdALvxp8dK7etipdHysd6MOmIL2fpV8isPswp7yMoejaC4GvH-xLp1bqS95Xog5rIOd2X-j8OxTyt_1Ep49YJEmTls5U9NC0wCO3YjQq_jvpqyT0CXRNY-Y0EA2h8bVlJD1R-zWGg48NhZ-awsBOqpWQCVsxINX2TpgbLISZwuH5UVlx_daAs7dO3wt4zHh-9irv2HWLhz3SZRfRtmk_VJ0",
  },
];

const PRODUCTS = [
  { name: "Smart Watch", description: "Seamlessly track your vitals and daily movement with understated elegance.", priceCredits: 1200, sortOrder: 0, image: "https://lh3.googleusercontent.com/aida-public/AB6AXuBdYwvnSRAot7aGsVxuxexq-hFhV9RvfMXy-O6d6ZY9XzFtCQkraCJQCVPWN4l9gfEvzallUbyuw_eIOYQer6e3ybtqznDBA89bR61tJBwfJQx8tTVWQeaM2D6sURd02817gkV5YQY55VyfXxdCUbNwwo9VkgC9gg5FabcP0_cIhztiB5F3aPvIrEiexarwPhhUWzFoOVDHpziwmwHq64jHCzWThOrAA2U_0f5HCI0LAFim36YxwZNN8lSLF6zPbJr2VJ5lKhEBWK0" },
  { name: "Oura Ring", description: "Discreet sleep and recovery insights housed in a minimal titanium band.", priceCredits: 850, sortOrder: 1, image: "https://lh3.googleusercontent.com/aida-public/AB6AXuDgToyXPhU2hCsNiMmFVuiDB1qlES2-PoZRMP7XzGC6vnqzIAl6-gVtkCH_4aXhn2PLFBhJ_k84844bhK3qDRZ3vQpPGWYJm5WKDvkXjNOqgYNf9jk8VRrymm5ejIh8IDOlmIVJ7TQpVAbnsnqqCAwEar4l4y9hQtDTGFGE2HA73bnbO503ajj51lCxbNBg140SzXYxxIXM086GVQQn1lUvgb6zkXwRz_YUjRQpf0dd1fsnjbO4ThMbP6vDFZtWai22jOLOreumz2g" },
  { name: "Organic Granola", description: "Small-batch roasted oats, nuts, and seeds sweetened with raw honey.", priceCredits: 50, sortOrder: 2, image: "https://lh3.googleusercontent.com/aida-public/AB6AXuCEvkFa4s98NX8lvz-rlJVw2DHal2RtsnQ1WKux5RWikXqfbdKkr8Bhf64PqjD12PX_3oxgN3VOW71ttymrNHTZJxCzDDnq5fFenl8wPmbhYpDRXmpxO3tt0BAZBLnPco5T9mFgzUjvmVlkdm-L3UGBL3LTivOBEaK4feNsuRdoLvH2oTKv7VFeplnK9F5Nqx5HFm-RXxJxtHl1dOa-o5B_Zm_D3kcg3YlZfS8fo53eBDC-5v6ZoOh9lZGpfKFwvsEVVxcQ3rvIWlA" },
  { name: "Artisan Bread", description: "Freshly baked, stone-ground whole wheat sourdough for a nourishing start.", priceCredits: 30, sortOrder: 3, image: "https://lh3.googleusercontent.com/aida-public/AB6AXuALM9Qp-7kffqXeIoIxamqU0r0QJ06p9p_Iz0WJKhM3Bw5adJ6Gpohm5vBDyffClNwpaWevXWWJ_nML_0T4BV6OyHpO_l-BLnugqjoDI46OsLCDYRAF-e8wLB3sLxj95H_s5JPX7pJJy_bhry7GeMp1kdAD_SooAXPojxsP7OUF51qdHOGeRhDNbEtZIWnYAFXaEx0CYLfdadUAlR11P-RpdKvaUTf8HMVbNun61eegu6yMCNPLIolv_BTc9ahDhAH-iEomfVfAjDY" },
  { name: "Smart Scale", description: "Comprehensive body composition metrics presented through a pristine glass surface.", priceCredits: 450, sortOrder: 4, image: "https://lh3.googleusercontent.com/aida-public/AB6AXuDkpxmFZ3TQRjeUywB7GNOsXrvyMNspR7-oPUufnUb308pSOOYxRYYIpj-lCQ9GhznyxxqM1SgiOwXIfvPq0VfQcY0V66h1t3KwOhe-ezZiTPvNwGKM2wE_8SXcJ8bwzup_LS4U02604wucaWdg6vZFN9yo_5OsuM5itY5pRFetv2LGMZJM_TphKODBve-cfFZJEr8uayrFBUI2M-FGbhDYDf1Gp3yVHilB874pLbh0HxCyiFSmOFKNWsJHvNSYb8e8jAZTGGDq3Ww" },
  { name: "Stone Diffuser", description: "Scent your sanctuary with this handcrafted matte ceramic ultrasonic diffuser.", priceCredits: 120, sortOrder: 5, image: "https://lh3.googleusercontent.com/aida-public/AB6AXuDXpEYMtYdtoHmouHGZKkNlsHjO8tdaysA5pSr8hQMjhVxfvlxhhLKoVcYoonB6TdaovJlYVpKu0mapHpzvdxPxdmR57aipfzugWTIXsU_axMGUQOhRxx0t3DChhZQEU2RU_DhW2wqRJQmsKmrhv9cugDxHlWCi2MA6WAsInmeOMgcWWmRA841rt947E21hLUckqK2GUWOqXJSnHVs5bohz6QIRkWDZu1KurGwzN9lLp2MHWRozg3Jh3FqNiu2ebYNIVb7VArkO9sQ" },
];

const GOALS = [
  { title: "Mindful Breath", icon: "air", description: "Take 5 minutes to focus solely on your inhalations and exhalations, grounding yourself in the present moment.", done: true },
  { title: "Hydration", icon: "water_drop", description: "Drink your morning glass of warm lemon water to awaken your digestive system gracefully.", done: true },
  { title: "Evening Stillness", icon: "nightlight", description: "Disconnect from all screens 30 minutes before bed to allow your mind to naturally transition to rest.", done: false },
  { title: "Nourishment", icon: "restaurant", description: "Prepare a plant-forward lunch, eating slowly and savoring each bite without distractions.", done: false },
];

function todayUtc(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

async function main() {
  // --- Global catalogs (idempotent on natural keys) ---
  for (const j of JOURNEYS) {
    const existing = await prisma.journey.findFirst({ where: { title: j.title } });
    if (existing) await prisma.journey.update({ where: { id: existing.id }, data: j });
    else await prisma.journey.create({ data: j });
  }

  for (const p of PRODUCTS) {
    const existing = await prisma.product.findFirst({ where: { name: p.name } });
    if (existing) await prisma.product.update({ where: { id: existing.id }, data: p });
    else await prisma.product.create({ data: p });
  }

  // --- Demo user (design _5 profile: Elena Rostova) ---
  const user = await prisma.user.upsert({
    where: { email: "elena@mindful.app" },
    update: {},
    create: {
      email: "elena@mindful.app",
      name: "Elena Rostova",
      gender: "female",
      birthday: new Date("1990-10-12"),
      heightCm: 170,
      weightKg: 62,
      memberSince: new Date("2021-01-01"),
      credits: 2450,
      primaryGoal: "healthyHabits",
      avatarUrl:
        "https://lh3.googleusercontent.com/aida-public/AB6AXuCu1L5PhcyvXkq-if97lnZrMAo_0or3u9KDmFjRvDiT50M3M-8zyJjqK8EU62PW6jQkW1qoW0oaXuMM1nRHGWeimOOQpKZgfehK-YXk0_aaiyB34NNj_5U7n7S2grOXOf7OFUOUdyo3NK37rC-cgotBgf7frr5AHzFiAvj_DqGJx9s-CeELcS18ZYK6IvgZ-589Lb4-A6CsD69GFJF3KJjWErWGUso1KZ2vSvUR_r2ZXWBCnpduXK8_XspZEPol1gtTSxA5Tw3Nsjw",
    },
  });

  // Reset the demo user's per-user data so re-running seed is deterministic.
  await prisma.habitCompletion.deleteMany({ where: { userId: user.id } });
  await prisma.goal.deleteMany({ where: { userId: user.id } });
  await prisma.moodCheckin.deleteMany({ where: { userId: user.id } });
  await prisma.memoryReaction.deleteMany({ where: { memory: { userId: user.id } } });
  await prisma.memory.deleteMany({ where: { userId: user.id } });
  await prisma.chatMessage.deleteMany({ where: { session: { userId: user.id } } });
  await prisma.chatSession.deleteMany({ where: { userId: user.id } });
  await prisma.healthConnection.deleteMany({ where: { userId: user.id } });

  // Goals + today's completions (design _4)
  const today = todayUtc();
  for (let i = 0; i < GOALS.length; i++) {
    const g = GOALS[i];
    const goal = await prisma.goal.create({
      data: {
        userId: user.id,
        title: g.title,
        description: g.description,
        icon: g.icon,
        sortOrder: i,
      },
    });
    if (g.done) {
      await prisma.habitCompletion.create({
        data: { goalId: goal.id, userId: user.id, forDate: today },
      });
    }
  }

  // Mood check-in (design _1)
  await prisma.moodCheckin.create({
    data: { userId: user.id, mood: "fatigued", note: "今天工作很多，一直没有停下来深呼吸的时间。" },
  });

  // Health connections (design _5)
  await prisma.healthConnection.createMany({
    data: [
      { userId: user.id, provider: "appleHealth", status: "connected", connectedAt: new Date() },
      { userId: user.id, provider: "garmin", status: "disconnected" },
      { userId: user.id, provider: "oura", status: "connected", connectedAt: new Date() },
    ],
  });

  // A memory with reactions (design _2)
  const memory = await prisma.memory.create({
    data: {
      userId: user.id,
      prompt: "A Quiet Conclusion",
      note: "今天学会了用更温柔的方式对待自己。",
    },
  });
  await prisma.memoryReaction.createMany({
    data: [
      { memoryId: memory.id, type: "inspired" },
      { memoryId: memory.id, type: "resonate" },
    ],
  });

  // A chat session seeded with the opening exchange (design 10)
  const session = await prisma.chatSession.create({
    data: { userId: user.id, title: "今天" },
  });
  await prisma.chatMessage.createMany({
    data: [
      { sessionId: session.id, role: "assistant", content: "欢迎回来。在这个当下，你感觉如何？", model: "GLM-5.1" },
      { sessionId: session.id, role: "user", content: "有点疲惫。今天工作很多，一直没有停下来深呼吸的时间。" },
    ],
  });

  console.log("Seed complete:");
  console.log(`  user: ${user.email} (${user.id})`);
  console.log(`  journeys: ${await prisma.journey.count()}`);
  console.log(`  products: ${await prisma.product.count()}`);
  console.log(`  goals: ${await prisma.goal.count({ where: { userId: user.id } })}`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
