import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

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

  // --- Reports & Insights (Memory page) ---
  await prisma.insight.deleteMany({ where: { userId: user.id } });
  await prisma.report.deleteMany({ where: { userId: user.id } });

  // Helper: week start (Mon) for a given date
  function weekStart(d: Date): Date {
    const dt = new Date(d);
    const day = dt.getUTCDay();
    const diff = day === 0 ? 6 : day - 1; // Mon=0
    dt.setUTCDate(dt.getUTCDate() - diff);
    return new Date(Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth(), dt.getUTCDate()));
  }
  function addDays(d: Date, n: number): Date {
    const r = new Date(d);
    r.setUTCDate(r.getUTCDate() + n);
    return r;
  }

  const thisWeekStart = weekStart(new Date());
  const lastWeekStart = addDays(thisWeekStart, -7);
  const twoWeeksAgoStart = addDays(thisWeekStart, -14);

  // Current week report
  const currentWeekReport = await prisma.report.create({
    data: {
      userId: user.id,
      periodType: "weekly",
      periodStart: thisWeekStart,
      periodEnd: addDays(thisWeekStart, 7),
      summary: "整体状态平稳向好，睡眠有明显改善。周三状态偏低需留意。",
      data: {
        moodEmojis: ["😊", "😊", "😐", "😊", "😴", "😊", "😊"],
        stats: [
          { icon: "bedtime", label: "睡眠均值", value: "6.8h", change: "↑0.3h", positive: true },
          { icon: "warning", label: "异常上报", value: "2次", change: "↓3次", positive: true },
          { icon: "check_circle", label: "修复采纳率", value: "100%", change: "", positive: true },
          { icon: "self_improvement", label: "正念练习", value: "5次", change: "↑2次", positive: true },
        ],
        sleepData: [6.3, 6.8, 5.5, 6.9, 7.0, 7.2, 7.4],
        highlights: [
          { icon: "trending_up", label: "最大改善", value: "入睡时间提前30分钟" },
          { icon: "fitness_center", label: "运动", value: "3次/周" },
          { icon: "psychology", label: "新洞察", value: "1个" },
        ],
        achievements: [
          { icon: "🏆", title: "连续7天完成呼吸练习", date: thisWeekStart.toISOString().slice(0, 10) },
        ],
        overallScore: 76,
      },
    },
  });

  // Last week report
  const lastWeekReport = await prisma.report.create({
    data: {
      userId: user.id,
      periodType: "weekly",
      periodStart: lastWeekStart,
      periodEnd: thisWeekStart,
      summary: "上周整体疲劳感较重，异常5次。周末通过运动有所恢复。",
      data: {
        moodEmojis: ["😐", "😴", "😐", "😊", "😴", "😊", "😊"],
        stats: [
          { icon: "bedtime", label: "睡眠均值", value: "6.5h", change: "↓0.2h", positive: false },
          { icon: "warning", label: "异常上报", value: "5次", change: "↑2次", positive: false },
          { icon: "check_circle", label: "修复采纳率", value: "80%", change: "↓20%", positive: false },
          { icon: "self_improvement", label: "正念练习", value: "3次", change: "↓1次", positive: false },
        ],
        sleepData: [6.0, 5.8, 6.2, 6.5, 5.5, 7.0, 7.2],
        highlights: [
          { icon: "trending_down", label: "关注项", value: "连续3天睡眠不足6h" },
          { icon: "fitness_center", label: "运动", value: "2次/周" },
        ],
        achievements: [],
        overallScore: 62,
      },
    },
  });

  // Two weeks ago report
  await prisma.report.create({
    data: {
      userId: user.id,
      periodType: "weekly",
      periodStart: twoWeeksAgoStart,
      periodEnd: lastWeekStart,
      summary: "平稳的一周，正念习惯开始建立。",
      data: {
        moodEmojis: ["😊", "😊", "😊", "😐", "😊", "😊", "😐"],
        stats: [
          { icon: "bedtime", label: "睡眠均值", value: "6.7h", change: "", positive: true },
          { icon: "warning", label: "异常上报", value: "3次", change: "", positive: true },
          { icon: "check_circle", label: "修复采纳率", value: "100%", change: "", positive: true },
          { icon: "self_improvement", label: "正念练习", value: "4次", change: "", positive: true },
        ],
        sleepData: [6.5, 6.8, 7.0, 6.2, 6.9, 7.1, 6.7],
        highlights: [
          { icon: "trending_up", label: "开始正念", value: "建立每日呼吸习惯" },
        ],
        achievements: [
          { icon: "🌱", title: "首次连续3天正念打卡", date: twoWeeksAgoStart.toISOString().slice(0, 10) },
        ],
        overallScore: 70,
      },
    },
  });

  // Monthly reports (May + April)
  const mayStart = new Date(Date.UTC(2025, 4, 1)); // May 2025
  const juneStart = new Date(Date.UTC(2025, 5, 1));
  const aprStart = new Date(Date.UTC(2025, 3, 1));

  const mayReport = await prisma.report.create({
    data: {
      userId: user.id,
      periodType: "monthly",
      periodStart: mayStart,
      periodEnd: juneStart,
      summary: "5月是充满成长的一个月。睡眠质量显著改善，运动频率上升，异常次数大幅下降。AI发现了2个新的身体模式。",
      data: {
        moodEmojis: [
          "😊","😊","😐","😊","😴","😊","😊",
          "😊","😐","😊","😊","😊","😊","😴",
          "😊","😊","😊","😐","😊","😊","😊",
          "😊","😴","😊","😊","😊","😊","😐",
          "😊","😊",
        ],
        stats: [
          { icon: "bedtime", label: "睡眠均值", value: "6.9h", change: "↑0.4h", positive: true },
          { icon: "fitness_center", label: "运动频次", value: "4次/周", change: "↑1次", positive: true },
          { icon: "warning", label: "异常总次数", value: "8次", change: "↓12次", positive: true },
          { icon: "psychology", label: "新发现模式", value: "2个", change: "", positive: true },
        ],
        sleepData: [
          6.2, 7.1, 6.5, 5.8, 6.9, 7.2, 7.0, 6.3, 6.8, 7.5,
          6.0, 6.4, 7.1, 6.9, 7.3, 6.1, 6.7, 7.0, 7.2, 6.8,
          5.5, 6.9, 7.4, 7.1, 6.6, 7.0, 6.8, 7.3, 7.0, 7.2,
        ],
        highlights: [
          { icon: "trending_up", label: "最大改善", value: "睡眠质量 +12%" },
          { icon: "fitness_center", label: "运动频次", value: "4次/周 (↑1次)" },
          { icon: "trending_down", label: "异常频次", value: "8次 (↓12次)" },
          { icon: "psychology", label: "新发现模式", value: "2个" },
        ],
        achievements: [
          { icon: "🏆", title: "连续21天早睡", date: "2025-05-28" },
          { icon: "🎯", title: "头痛频率下降60%", date: "2025-05-20" },
          { icon: "🔍", title: "发现2个身体模式", date: "2025-05-15" },
          { icon: "💪", title: "连续4周每周3次运动", date: "2025-05-10" },
        ],
        overallScore: 82,
      },
    },
  });

  await prisma.report.create({
    data: {
      userId: user.id,
      periodType: "monthly",
      periodStart: aprStart,
      periodEnd: mayStart,
      summary: "4月过渡期，刚开始使用Mindful。建立了基础数据和初步习惯。",
      data: {
        moodEmojis: [
          "😐","😐","😴","😐","😊","😐","😴",
          "😊","😐","😐","😊","😐","😊","😊",
          "😐","😴","😊","😐","😊","😊","😐",
          "😊","😊","😐","😊","😐","😊","😊",
          "😊","😊",
        ],
        stats: [
          { icon: "bedtime", label: "睡眠均值", value: "6.5h", change: "", positive: true },
          { icon: "fitness_center", label: "运动频次", value: "3次/周", change: "", positive: true },
          { icon: "warning", label: "异常总次数", value: "20次", change: "", positive: false },
          { icon: "psychology", label: "新发现模式", value: "0个", change: "", positive: true },
        ],
        sleepData: [
          6.0, 5.8, 6.2, 6.5, 5.5, 6.8, 6.5, 6.0, 6.2, 6.5,
          5.8, 6.0, 6.8, 6.5, 6.2, 5.5, 6.0, 6.5, 6.8, 6.2,
          5.8, 6.5, 6.8, 7.0, 6.5, 6.2, 6.5, 6.8, 6.5, 7.0,
        ],
        highlights: [
          { icon: "flag", label: "里程碑", value: "开始使用Mindful" },
          { icon: "self_improvement", label: "首次正念", value: "完成第一次深呼吸练习" },
        ],
        achievements: [
          { icon: "🌱", title: "开始你的健康之旅", date: "2025-04-01" },
        ],
        overallScore: 58,
      },
    },
  });

  // --- Insights ---
  await prisma.insight.createMany({
    data: [
      {
        userId: user.id,
        reportId: currentWeekReport.id,
        type: "pattern",
        title: "周三低状态模式",
        content: "你周三的状态总是最差，可能和周二晚上熬夜有关。建议周二设置一个22:30的入睡提醒。",
        metadata: { confidence: 0.85, relatedFactors: ["周二熬夜", "周三工作压力"], severity: "medium" },
      },
      {
        userId: user.id,
        reportId: currentWeekReport.id,
        type: "prediction",
        title: "睡眠下降预警",
        content: "连续3天睡眠下降趋势，历史数据显示这通常会在48h后引发头痛。今晚试试提前30分钟上床？",
        metadata: { confidence: 0.72, triggerWindow: "48h", historicalOccurrences: 4 },
      },
      {
        userId: user.id,
        reportId: mayReport.id,
        type: "correlation",
        title: "运动提升情绪",
        content: "运动后的情绪评分平均高出30%。你的最佳运动时间是早上7-8点。",
        metadata: { confidence: 0.88, strength: 85, factor: "exercise", effect: "mood_boost" },
      },
      {
        userId: user.id,
        reportId: mayReport.id,
        type: "correlation",
        title: "睡眠不足引发头痛",
        content: "睡眠不足6小时的第二天，头痛概率是平时的3倍。本月有4次符合这个模式。",
        metadata: { confidence: 0.78, strength: 72, factor: "sleep_deficit", effect: "headache" },
      },
      {
        userId: user.id,
        reportId: null,
        type: "correlation",
        title: "下午咖啡因影响入睡",
        content: "下午3点后摄入咖啡因时，当晚入睡时间平均延后45分钟。",
        metadata: { confidence: 0.65, strength: 65, factor: "caffeine_afternoon", effect: "sleep_onset_delay" },
      },
      {
        userId: user.id,
        reportId: null,
        type: "correlation",
        title: "正念缓解焦虑",
        content: "做完正念练习后，焦虑相关对话减少60%。坚持每天5分钟效果最好。",
        metadata: { confidence: 0.70, strength: 60, factor: "mindfulness", effect: "anxiety_reduction" },
      },
      {
        userId: user.id,
        reportId: lastWeekReport.id,
        type: "milestone",
        title: "异常频率下降",
        content: "相比上月同期，本周异常上报减少了40%。你的健康状况正在稳步改善。",
        metadata: { improvement: 40, comparedTo: "last_month_same_week" },
      },
    ],
  });

  console.log("Seed complete:");
  console.log(`  user: ${user.email} (${user.id})`);
  console.log(`  journeys: ${await prisma.journey.count()}`);
  console.log(`  products: ${await prisma.product.count()}`);
  console.log(`  goals: ${await prisma.goal.count({ where: { userId: user.id } })}`);
  console.log(`  reports: ${await prisma.report.count({ where: { userId: user.id } })}`);
  console.log(`  insights: ${await prisma.insight.count({ where: { userId: user.id } })}`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
