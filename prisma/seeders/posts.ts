import type { PrismaClient } from "../../src/generated/prisma/client";
import type { SeededUser } from "./users";

const POSTS = [
  {
    title: "上班族如何平缓度过减脂平台期",
    excerpt: "从焦虑到接纳：小王的四周饮食记录",
    body: `减脂平台期让人焦虑，但其实它是身体在适应新的代谢状态。\n\n经过四周的记录，我发现问题不在于"吃得不够少"，而在于压力导致的皮质醇升高。当我开始接纳平台期，转而关注睡眠和压力管理后，体重反而自然下降了。\n\n## 我的三个关键转变\n\n1. **停止每天称重** — 改为每周一次\n2. **增加休息日** — 从每周6练改为4练\n3. **关注非体重指标** — 腰围、精力、睡眠质量\n\n平台期不是失败，是身体在告诉你：慢下来。`,
    category: "mindfulness" as const,
    categoryIcon: "spa",
    readMinutes: 4,
    coverImage: "/api/assets/static/posts/post-1.jpg",
    viewCount: 234,
  },
  {
    title: "The Architecture of a Quiet Evening",
    excerpt: "Reclaiming my nights from digital noise: A 30-day experiment in analog living.",
    body: `For thirty days, I put my phone in a drawer at 8 PM. No exceptions.\n\nThe first week was brutal. I reached for the phantom device constantly. By the second week, I rediscovered reading physical books. By the third, I was falling asleep 40 minutes earlier without trying.\n\n## What I learned\n\nThe evening is not dead time between work and sleep. It's a transition ritual that deserves architecture — intentional lighting, deliberate quiet, the slow unwinding of the mind.\n\nMy sleep score improved by 23%. But more importantly, I started looking forward to evenings again.`,
    category: "reflection" as const,
    categoryIcon: "edit_note",
    readMinutes: 6,
    coverImage: "/api/assets/static/posts/post-2.jpg",
    viewCount: 187,
  },
  {
    title: "Finding Balance Without Restriction",
    excerpt: "Learning to listen to my body instead of counting macros.",
    body: `我曾经是一个严格计算每一克碳水的人。直到有一天，我发现自己因为"超标"了50卡而焦虑到失眠。\n\n那一刻我知道，这不是健康。\n\n## 直觉饮食的开始\n\n放下计算器后的第一周很恐惧。但当我开始问自己"我现在真的饿吗？"而不是"我还剩多少配额？"时，一切开始改变。\n\n三个月后：\n- 体重几乎没变（±1kg）\n- 焦虑感消失了\n- 重新享受和朋友吃饭\n\n身体比你想象的更聪明。学会信任它。`,
    category: "nutrition" as const,
    categoryIcon: "restaurant_menu",
    readMinutes: 5,
    coverImage: "/api/assets/static/posts/post-3.jpg",
    viewCount: 312,
  },
  {
    title: "晨间5分钟：改变一天的微习惯",
    excerpt: "不需要4点起床，只需要在醒来后做对一件事。",
    body: `每天早上醒来后的前5分钟，你在做什么？刷手机？看消息？\n\n我用了60天实验一个极简的晨间仪式：醒来后闭眼做10次深呼吸，然后喝一杯温水。就这么简单。\n\n## 60天后的变化\n\n- 起床后的焦虑感减少了70%\n- 不再需要闹钟（身体自然醒）\n- 上午的专注力提升明显\n\n关键不是做多少，而是在对的时间做对的事。早晨的大脑就像一张白纸，你选择写什么，决定了一天的底色。`,
    category: "mindfulness" as const,
    categoryIcon: "self_improvement",
    readMinutes: 3,
    coverImage: "/api/assets/static/posts/post-4.jpg",
    viewCount: 456,
  },
  {
    title: "Sleep Debt Is Real: How I Recovered",
    excerpt: "A two-month journey from 5 hours to 7.5 hours of quality sleep.",
    body: `I wore my sleep deficit like a badge of honor for years. "I only need 5 hours" was my mantra. Until my body started sending invoices.\n\n## The wake-up call\n\nThree months of constant brain fog, two colds in 6 weeks, and a resting heart rate that climbed 8 bpm. My doctor said: "You're not sick. You're exhausted."\n\n## The recovery protocol\n\n1. **Fixed wake time** — 6:30 AM, no exceptions, even weekends\n2. **Sleep window expansion** — moved bedtime 15 min earlier each week\n3. **No caffeine after 1 PM** — this alone saved 30 min of sleep onset\n4. **Bedroom temperature** — 18C, no negotiation\n\nTwo months later: RHR down 6 bpm, zero sick days, brain fog gone. Sleep is not a luxury. It's infrastructure.`,
    category: "sleep" as const,
    categoryIcon: "bedtime",
    readMinutes: 7,
    coverImage: "/api/assets/static/posts/post-5.jpg",
    viewCount: 289,
  },
  {
    title: "与焦虑共处的艺术",
    excerpt: "焦虑不是敌人，它是你身体的信使。",
    body: `我花了三年试图"消灭"焦虑。冥想、运动、呼吸法……每一种都有用，但焦虑总会回来。\n\n转折点是一位心理咨询师对我说："你不需要让焦虑消失。你需要学会在它存在的时候，继续做你想做的事。"\n\n## 共处而非对抗\n\n当焦虑来临时，我现在会：\n1. 承认它："我注意到我在焦虑"\n2. 定位它：身体哪里紧绷？（通常是胸口和肩膀）\n3. 给它空间：不试图改变，只是观察\n4. 继续行动：带着这份感受，做下一件该做的事\n\n这不是放弃治疗。这是接纳人类本来就有不适感受的事实，然后选择不被它绑架。`,
    category: "mindfulness" as const,
    categoryIcon: "psychology",
    readMinutes: 5,
    coverImage: "/api/assets/static/posts/post-6.jpg",
    viewCount: 523,
  },
];

export async function seedPosts(prisma: PrismaClient, user: SeededUser) {
  await prisma.like.deleteMany({ where: { authorId: user.id } });
  await prisma.comment.deleteMany({ where: { authorId: user.id } });
  await prisma.post.deleteMany({ where: { authorId: user.id } });

  const createdPosts = [];
  for (const p of POSTS) {
    const post = await prisma.post.create({
      data: { authorId: user.id, ...p },
    });
    createdPosts.push(post);
  }

  // Comments
  const commentTexts = [
    { body: "太有共鸣了，我也经历过类似的阶段。谢谢分享！", postIdx: 0 },
    { body: "这个方法我试了一周，确实有效。入睡时间提前了20分钟。", postIdx: 1 },
    { body: "直觉饮食改变了我的生活，终于不再为每一口食物焦虑。", postIdx: 2 },
    { body: "请问呼吸练习有推荐的app或指导吗？", postIdx: 3 },
    { body: "Sleep debt这个概念之前不了解，原来身体真的在记账。", postIdx: 4 },
    { body: "第三点'给焦虑空间'对我很有启发。", postIdx: 5 },
  ];
  for (const c of commentTexts) {
    await prisma.comment.create({
      data: { postId: createdPosts[c.postIdx].id, authorId: user.id, body: c.body },
    });
  }

  // Likes (first 4 posts)
  for (let i = 0; i < 4; i++) {
    await prisma.like.create({
      data: { postId: createdPosts[i].id, authorId: user.id },
    });
  }

  return createdPosts;
}
