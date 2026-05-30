import type { PrismaClient } from "../../src/generated/prisma/client";
import type { SeededUser } from "./users";

export async function seedNotifications(prisma: PrismaClient, users: SeededUser[]) {
  // Clean existing
  const userIds = users.map((u) => u.id);
  await prisma.notification.deleteMany({ where: { recipientId: { in: userIds } } });
  await prisma.friendActivity.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.weeklyLeaderboard.deleteMany({ where: { userId: { in: userIds } } });

  if (users.length < 2) return;

  const [elena, bill] = users;

  // --- Friend Activities (elena's achievements) ---
  await prisma.friendActivity.createMany({
    data: [
      { userId: elena.id, type: "streakReached", title: "连续21天达标", content: "连续21天完成呼吸练习目标", refType: "goal", visible: true },
      { userId: elena.id, type: "reportHighScore", title: "周报高分", content: "本周健康评分82分", refType: "report", visible: true },
      { userId: elena.id, type: "sleepImproved", title: "睡眠改善", content: "睡眠质量连续一周提升，均值从6.5h提高到7.2h", visible: true },
      { userId: bill.id, type: "goalAchieved", title: "完成目标", content: "完成了「每日正念5分钟」目标", refType: "goal", visible: true },
      { userId: bill.id, type: "postBookmarked", title: "收藏文章", content: "收藏了「与焦虑共处的艺术」并多次浏览", refType: "post", visible: true },
    ],
  });

  // --- Notifications for elena (from bill + system) ---
  await prisma.notification.createMany({
    data: [
      {
        recipientId: elena.id,
        type: "friendActivity",
        title: "好友动态",
        message: "完成了「每日正念5分钟」目标，想看看TA的计划吗？",
        icon: "emoji_events",
        refType: "friend",
        refId: bill.id,
        senderId: bill.id,
        read: false,
      },
      {
        recipientId: elena.id,
        type: "friendActivity",
        title: "好友收藏",
        message: "收藏了「与焦虑共处的艺术」并多次浏览，查看详情？",
        icon: "bookmark",
        refType: "post",
        senderId: bill.id,
        read: false,
      },
      {
        recipientId: elena.id,
        type: "reportReady",
        title: "周报已生成",
        message: "你的本周健康报告已生成，综合评分 76 分",
        icon: "analytics",
        refType: "report",
        read: false,
      },
      {
        recipientId: elena.id,
        type: "aiInsight",
        title: "新发现",
        message: "AI 发现了一个新模式：你周三的状态总是最差，可能和周二晚上熬夜有关",
        icon: "psychology",
        refType: "insight",
        read: true,
      },
      {
        recipientId: elena.id,
        type: "creditEarned",
        title: "获得积分",
        message: "连续7天完成目标，奖励 +50 Cr",
        icon: "stars",
        read: true,
      },
      {
        recipientId: elena.id,
        type: "reminder",
        title: "健康提醒",
        message: "今天还没有做正念练习哦，花5分钟深呼吸吧",
        icon: "self_improvement",
        read: true,
      },
    ],
  });

  // --- Notifications for bill (from elena + system) ---
  await prisma.notification.createMany({
    data: [
      {
        recipientId: bill.id,
        type: "friendActivity",
        title: "好友成就",
        message: "连续21天完成了呼吸练习，想看看TA的计划吗？",
        icon: "local_fire_department",
        refType: "friend",
        refId: elena.id,
        senderId: elena.id,
        read: false,
      },
      {
        recipientId: bill.id,
        type: "friendActivity",
        title: "好友进步",
        message: "最近用规律作息显著提高了睡眠质量，是否需要了解详情？",
        icon: "bedtime",
        refType: "friend",
        refId: elena.id,
        senderId: elena.id,
        read: false,
      },
      {
        recipientId: bill.id,
        type: "leaderboard",
        title: "排行榜",
        message: "本周好友排行榜已更新，你排名第2",
        icon: "leaderboard",
        read: false,
      },
      {
        recipientId: bill.id,
        type: "system",
        title: "欢迎",
        message: "欢迎加入 Mindful！开始你的健康之旅吧",
        icon: "waving_hand",
        read: true,
      },
    ],
  });

  // --- Weekly Leaderboard ---
  const thisWeekStart = getWeekStart(new Date());
  await prisma.weeklyLeaderboard.createMany({
    data: [
      { userId: elena.id, weekStart: thisWeekStart, score: 82, totalSteps: 56000, workoutCount: 4, mindfulCount: 7, rank: 1 },
      { userId: bill.id, weekStart: thisWeekStart, score: 76, totalSteps: 42000, workoutCount: 3, mindfulCount: 5, rank: 2 },
    ],
  });
}

function getWeekStart(d: Date): Date {
  const dt = new Date(d);
  const day = dt.getUTCDay();
  const diff = day === 0 ? 6 : day - 1;
  dt.setUTCDate(dt.getUTCDate() - diff);
  return new Date(Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth(), dt.getUTCDate()));
}
