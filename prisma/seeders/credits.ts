import type { PrismaClient } from "../../src/generated/prisma/client";
import type { SeededUser } from "./users";

export async function seedCredits(prisma: PrismaClient, user: SeededUser) {
  // --- Credit Rules (global, idempotent) ---
  await prisma.creditRule.deleteMany({});
  await prisma.creditRule.createMany({
    data: [
      { action: "dailyCheckin", name: "每日签到", description: "每天和Mindful对话即可获得", amount: 5, dailyCap: 1, icon: "waving_hand", sortOrder: 0 },
      { action: "habitComplete", name: "完成习惯目标", description: "每完成一个今日习惯目标获得", amount: 10, dailyCap: 0, icon: "check_circle", sortOrder: 1 },
      { action: "allHabitsComplete", name: "全部目标完成", description: "当天所有习惯目标全部完成的额外奖励", amount: 20, dailyCap: 1, icon: "stars", sortOrder: 2 },
      { action: "moodCheckin", name: "情绪记录", description: "完成每日情绪打卡", amount: 5, dailyCap: 1, icon: "mood", sortOrder: 3 },
      { action: "streakWeekly", name: "连续7天达标", description: "连续7天完成至少一个习惯目标", amount: 50, dailyCap: 1, icon: "local_fire_department", sortOrder: 4 },
      { action: "mindfulness", name: "正念练习", description: "完成一次正念/冥想/深呼吸练习", amount: 10, dailyCap: 3, icon: "self_improvement", sortOrder: 5 },
      { action: "postPublish", name: "发布文章", description: "在发现页发布一篇原创文章", amount: 30, dailyCap: 2, icon: "edit_note", sortOrder: 6 },
      { action: "postLiked", name: "文章被赞", description: "你的文章每获得一个赞", amount: 2, dailyCap: 0, icon: "favorite", sortOrder: 7 },
    ],
  });

  // --- Credit Transactions (per-user demo history) ---
  await prisma.creditTransaction.deleteMany({ where: { userId: user.id } });
  const txns = [
    { action: "dailyCheckin" as const, direction: "earn" as const, amount: 5, note: "每日签到" },
    { action: "habitComplete" as const, direction: "earn" as const, amount: 10, note: "完成: Mindful Breath" },
    { action: "habitComplete" as const, direction: "earn" as const, amount: 10, note: "完成: Hydration" },
    { action: "allHabitsComplete" as const, direction: "earn" as const, amount: 20, note: "今日全部目标完成" },
    { action: "moodCheckin" as const, direction: "earn" as const, amount: 5, note: "情绪记录: 平静" },
    { action: "mindfulness" as const, direction: "earn" as const, amount: 10, note: "5分钟深呼吸练习" },
    { action: "streakWeekly" as const, direction: "earn" as const, amount: 50, note: "连续7天完成目标!" },
    { action: "postPublish" as const, direction: "earn" as const, amount: 30, note: "发布文章: 与焦虑共处的艺术" },
    { action: "postLiked" as const, direction: "earn" as const, amount: 2, note: "文章被赞 x1" },
    { action: "postLiked" as const, direction: "earn" as const, amount: 2, note: "文章被赞 x1" },
    { action: "redemption" as const, direction: "spend" as const, amount: -50, note: "兑换: Organic Granola" },
    { action: "dailyCheckin" as const, direction: "earn" as const, amount: 5, note: "每日签到" },
    { action: "mindfulness" as const, direction: "earn" as const, amount: 10, note: "10分钟冥想" },
  ];

  // Net of these txns is +109. User credits is 2450, so start balance was 2341.
  let balance = 2341;
  for (const tx of txns) {
    balance += tx.amount;
    await prisma.creditTransaction.create({
      data: {
        userId: user.id,
        action: tx.action,
        direction: tx.direction,
        amount: Math.abs(tx.amount),
        balance,
        note: tx.note,
      },
    });
  }
}
