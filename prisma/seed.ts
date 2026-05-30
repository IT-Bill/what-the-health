import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DIRECT_URL ?? process.env.DATABASE_URL }),
});

// Data mirrors what the pages currently hardcode, so the UI can be wired to the
// database without visual changes.

const POSTS = [
  {
    title: "上班族如何平缓度过减脂平台期",
    excerpt: "从焦虑到接纳：小王的四周饮食记录",
    body: `减脂平台期让人焦虑，但其实它是身体在适应新的代谢状态。\n\n经过四周的记录，我发现问题不在于"吃得不够少"，而在于压力导致的皮质醇升高。当我开始接纳平台期，转而关注睡眠和压力管理后，体重反而自然下降了。\n\n## 我的三个关键转变\n\n1. **停止每天称重** — 改为每周一次\n2. **增加休息日** — 从每周6练改为4练\n3. **关注非体重指标** — 腰围、精力、睡眠质量\n\n平台期不是失败，是身体在告诉你：慢下来。`,
    category: "mindfulness" as const,
    categoryIcon: "spa",
    readMinutes: 4,
    coverImage: "https://lh3.googleusercontent.com/aida-public/AB6AXuDrbmsXLYiSOteMdlrNGNJlhW7a2qFB-aL73C0EiFktcnJEEze9oOM1ISJYYa_XTWMSgoVYp_CLIujeiJncs1UcCEHFKa8IWd9qpay6YwuGngo1w5IMtarjhGP5uA8gkoP_2mz7cHqJnWcP2xy6VExf8GR7lkaYQ7t2iZ0QNM36oJFPxPdwXHA2SA55BobYQLakAKPSiVmtTbeWZfi7wYu9DwMJn8t37ZzSLj9TdxmD8T95IV3fr8QffSmfiFmALefx3x_FMTg2oXo",
    viewCount: 234,
  },
  {
    title: "The Architecture of a Quiet Evening",
    excerpt: "Reclaiming my nights from digital noise: A 30-day experiment in analog living.",
    body: `For thirty days, I put my phone in a drawer at 8 PM. No exceptions.\n\nThe first week was brutal. I reached for the phantom device constantly. By the second week, I rediscovered reading physical books. By the third, I was falling asleep 40 minutes earlier without trying.\n\n## What I learned\n\nThe evening is not dead time between work and sleep. It's a transition ritual that deserves architecture — intentional lighting, deliberate quiet, the slow unwinding of the mind.\n\nMy sleep score improved by 23%. But more importantly, I started looking forward to evenings again.`,
    category: "reflection" as const,
    categoryIcon: "edit_note",
    readMinutes: 6,
    coverImage: "https://lh3.googleusercontent.com/aida-public/AB6AXuBcJu1ooXwW1MLb-KSvybTdCNTyHRMtNB-5UNLBA1g0gsKOLwmddzQkOAUA7k_hdfOgpc6Mz1ekLz7iYFdGE3wQ6S9Vi0GOoZZn960pbzdn-TlrpzVKeyzhab5aBokSA5wLBfEl5YjbQfwDtJRcNIHyO-0t1IQCL93-NBMW6FsMDFUUy6X4amdm4Uz7b-vMz_kqt9f5onpfj34JQd0ezUkdb7mc58vqOSDBNLvZaXrPumW91ZIUwxSNUyTyXyZEIeosvpYVw3hLaAc",
    viewCount: 187,
  },
  {
    title: "Finding Balance Without Restriction",
    excerpt: "Learning to listen to my body instead of counting macros.",
    body: `我曾经是一个严格计算每一克碳水的人。直到有一天，我发现自己因为"超标"了50卡而焦虑到失眠。\n\n那一刻我知道，这不是健康。\n\n## 直觉饮食的开始\n\n放下计算器后的第一周很恐惧。但当我开始问自己"我现在真的饿吗？"而不是"我还剩多少配额？"时，一切开始改变。\n\n三个月后：\n- 体重几乎没变（±1kg）\n- 焦虑感消失了\n- 重新享受和朋友吃饭\n\n身体比你想象的更聪明。学会信任它。`,
    category: "nutrition" as const,
    categoryIcon: "restaurant_menu",
    readMinutes: 5,
    coverImage: "https://lh3.googleusercontent.com/aida-public/AB6AXuCPP02i2HR4CCVgIFydvZ86zcxyiPibwltISdQcmqIbNMhE_YbBKHTaUdALvxp8dK7etipdHysd6MOmIL2fpV8isPswp7yMoejaC4GvH-xLp1bqS95Xog5rIOd2X-j8OxTyt_1Ep49YJEmTls5U9NC0wCO3YjQq_jvpqyT0CXRNY-Y0EA2h8bVlJD1R-zWGg48NhZ-awsBOqpWQCVsxINX2TpgbLISZwuH5UVlx_daAs7dO3wt4zHh-9irv2HWLhz3SZRfRtmk_VJ0",
    viewCount: 312,
  },
  {
    title: "晨间5分钟：改变一天的微习惯",
    excerpt: "不需要4点起床，只需要在醒来后做对一件事。",
    body: `每天早上醒来后的前5分钟，你在做什么？刷手机？看消息？\n\n我用了60天实验一个极简的晨间仪式：醒来后闭眼做10次深呼吸，然后喝一杯温水。就这么简单。\n\n## 60天后的变化\n\n- 起床后的焦虑感减少了70%\n- 不再需要闹钟（身体自然醒）\n- 上午的专注力提升明显\n\n关键不是做多少，而是在对的时间做对的事。早晨的大脑就像一张白纸，你选择写什么，决定了一天的底色。`,
    category: "mindfulness" as const,
    categoryIcon: "self_improvement",
    readMinutes: 3,
    coverImage: "https://lh3.googleusercontent.com/aida-public/AB6AXuDE_qoSpDao7VMBAeiSLqxL7LV_VVHjhlL5Lc2WQH4XrSaTTmwYgBIHO1PtbOkupTo871LmM0AmQRxugOp6At3lAg2YRc6mtf6oQ9VqDEcumkOg3qGhV53ozLiXaP_-8MNJnl9BCYdWiwyvDTySJIsqa9m_Mw_qt76_apAZZpzBj6yXpt5ai2LyI21XcoKUQI7zzzkHOqh0YpRtNlr-0FDzPo0pifDsuoHk91Ep6dIRJZ7m1hhHhBupyfZqRfOOJLbQyt53LfQ0g_U",
    viewCount: 456,
  },
  {
    title: "Sleep Debt Is Real: How I Recovered",
    excerpt: "A two-month journey from 5 hours to 7.5 hours of quality sleep.",
    body: `I wore my sleep deficit like a badge of honor for years. "I only need 5 hours" was my mantra. Until my body started sending invoices.\n\n## The wake-up call\n\nThree months of constant brain fog, two colds in 6 weeks, and a resting heart rate that climbed 8 bpm. My doctor said: "You're not sick. You're exhausted."\n\n## The recovery protocol\n\n1. **Fixed wake time** — 6:30 AM, no exceptions, even weekends\n2. **Sleep window expansion** — moved bedtime 15 min earlier each week\n3. **No caffeine after 1 PM** — this alone saved 30 min of sleep onset\n4. **Bedroom temperature** — 18°C, no negotiation\n\nTwo months later: RHR down 6 bpm, zero sick days, brain fog gone. Sleep is not a luxury. It's infrastructure.`,
    category: "sleep" as const,
    categoryIcon: "bedtime",
    readMinutes: 7,
    coverImage: "https://lh3.googleusercontent.com/aida-public/AB6AXuAMyX9cJtfOwxThdhr4mBqRGV1dHxAP7TpD6WligWDidUkURRDn6HsRaxIjt2K3wCZuLOimovmAdkTorTcOQEpHapkZEnIiloU9qb1tOt3kI9iZZlPa2_AbVrVNv0R9bCtjXNDyBg2a52vV9z-GrWdZe7GPPWYbDPGaHxksVdMlEn4pCqkK3wTN79LS9sHA0xBAeHEf9vxMt9HTmwIYbyi0CrTN1Ptxq4B_dgzSKTHaqqLq1xDqDQF51IjvRcpqaTa3g4756N8WzfI",
    viewCount: 289,
  },
  {
    title: "与焦虑共处的艺术",
    excerpt: "焦虑不是敌人，它是你身体的信使。",
    body: `我花了三年试图"消灭"焦虑。冥想、运动、呼吸法……每一种都有用，但焦虑总会回来。\n\n转折点是一位心理咨询师对我说："你不需要让焦虑消失。你需要学会在它存在的时候，继续做你想做的事。"\n\n## 共处而非对抗\n\n当焦虑来临时，我现在会：\n1. 承认它："我注意到我在焦虑"\n2. 定位它：身体哪里紧绷？（通常是胸口和肩膀）\n3. 给它空间：不试图改变，只是观察\n4. 继续行动：带着这份感受，做下一件该做的事\n\n这不是放弃治疗。这是接纳人类本来就有不适感受的事实，然后选择不被它绑架。`,
    category: "mindfulness" as const,
    categoryIcon: "psychology",
    readMinutes: 5,
    coverImage: "https://lh3.googleusercontent.com/aida-public/AB6AXuAOytiVKcjHhk6OVZPIIJwyIGAuX5IARCMXg5mZQ1hWh4AjOHMg77wiJn7Rnsf7Hpp_yWraNcNfzJ1IcR3WN6zZXxpm-tey0AMYp7qopQnnSpZKHy7bWDOTTx7Hi1iVMGZl2gA9gz1yy6JF1cNRU3R_JeDBxaAEn6CzfVnLZ8xSbT66FrHsGs8ngo3cOhfj-Jvg-ZyTBCCeEs5PG-gOEjS5AcQgMpkMVVvIIdAQbFxH655GDh90YVoYfFOx5tD2AHx5ssfR9BHv9sg",
    viewCount: 523,
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
  // --- Products (global catalog, idempotent) ---
  for (const p of PRODUCTS) {
    const existing = await prisma.product.findFirst({ where: { name: p.name } });
    if (existing) await prisma.product.update({ where: { id: existing.id }, data: p });
    else await prisma.product.create({ data: p });
  }

  // --- Demo user (design _5 profile: Elena Rostova) ---
  const user = await prisma.user.upsert({
    where: { username: "elena" },
    update: {},
    create: {
      username: "elena",
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
  await prisma.like.deleteMany({ where: { authorId: user.id } });
  await prisma.comment.deleteMany({ where: { authorId: user.id } });
  await prisma.post.deleteMany({ where: { authorId: user.id } });
  await prisma.habitCompletion.deleteMany({ where: { userId: user.id } });
  await prisma.goal.deleteMany({ where: { userId: user.id } });
  await prisma.moodCheckin.deleteMany({ where: { userId: user.id } });
  await prisma.memoryReaction.deleteMany({ where: { memory: { userId: user.id } } });
  await prisma.memory.deleteMany({ where: { userId: user.id } });
  await prisma.chatMessage.deleteMany({ where: { session: { userId: user.id } } });
  await prisma.chatSession.deleteMany({ where: { userId: user.id } });
  await prisma.healthConnection.deleteMany({ where: { userId: user.id } });

  // --- Posts (Discover page) ---
  const createdPosts = [];
  for (const p of POSTS) {
    const post = await prisma.post.create({
      data: {
        authorId: user.id,
        title: p.title,
        excerpt: p.excerpt,
        body: p.body,
        category: p.category,
        categoryIcon: p.categoryIcon,
        coverImage: p.coverImage,
        readMinutes: p.readMinutes,
        viewCount: p.viewCount,
      },
    });
    createdPosts.push(post);
  }

  // Add comments to the first 3 posts
  const commentTexts = [
    { body: "太有共鸣了，我也经历过类似的阶段。谢谢分享！", postIdx: 0 },
    { body: "这个方法我试了一周，确实有效。入睡时间提前了20分钟。", postIdx: 1 },
    { body: "直觉饮食改变了我的生活，终于不再为每一口食物焦虑。", postIdx: 2 },
    { body: "请问呼吸练习有推荐的app或指导吗？", postIdx: 3 },
    { body: "Sleep debt这个概念之前不了解，原来身体真的在记账。", postIdx: 4 },
    { body: "第三点 '给焦虑空间' 对我很有启发。", postIdx: 5 },
  ];
  for (const c of commentTexts) {
    await prisma.comment.create({
      data: {
        postId: createdPosts[c.postIdx].id,
        authorId: user.id,
        body: c.body,
      },
    });
  }

  // Add likes (user likes the first 4 posts)
  for (let i = 0; i < 4; i++) {
    await prisma.like.create({
      data: { postId: createdPosts[i].id, authorId: user.id },
    });
  }

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
  console.log(`  user: ${user.username} (${user.id})`);
  console.log(`  posts: ${await prisma.post.count({ where: { authorId: user.id } })}`);
  console.log(`  comments: ${await prisma.comment.count({ where: { authorId: user.id } })}`);
  console.log(`  likes: ${await prisma.like.count({ where: { authorId: user.id } })}`);
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
