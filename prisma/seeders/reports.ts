import type { PrismaClient } from "../../src/generated/prisma/client";
import type { SeededUser } from "./users";

function weekStart(d: Date): Date {
  const dt = new Date(d);
  const day = dt.getUTCDay();
  const diff = day === 0 ? 6 : day - 1;
  dt.setUTCDate(dt.getUTCDate() - diff);
  return new Date(Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth(), dt.getUTCDate()));
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setUTCDate(r.getUTCDate() + n);
  return r;
}

export async function seedReports(prisma: PrismaClient, user: SeededUser) {
  await prisma.insight.deleteMany({ where: { userId: user.id } });
  await prisma.report.deleteMany({ where: { userId: user.id } });

  const thisWeekStart = weekStart(new Date());
  const lastWeekStart = addDays(thisWeekStart, -7);
  const twoWeeksAgoStart = addDays(thisWeekStart, -14);

  // Current week
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

  // Last week
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

  // Two weeks ago
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
        highlights: [{ icon: "trending_up", label: "开始正念", value: "建立每日呼吸习惯" }],
        achievements: [{ icon: "🌱", title: "首次连续3天正念打卡", date: twoWeeksAgoStart.toISOString().slice(0, 10) }],
        overallScore: 70,
      },
    },
  });

  // Monthly: May
  const mayStart = new Date(Date.UTC(2025, 4, 1));
  const juneStart = new Date(Date.UTC(2025, 5, 1));
  const aprStart = new Date(Date.UTC(2025, 3, 1));

  const mayReport = await prisma.report.create({
    data: {
      userId: user.id,
      periodType: "monthly",
      periodStart: mayStart,
      periodEnd: juneStart,
      summary: "5月是充满成长的一个月。睡眠质量显著改善，运动频率上升，异常次数大幅下降。",
      data: {
        moodEmojis: ["😊","😊","😐","😊","😴","😊","😊","😊","😐","😊","😊","😊","😊","😴","😊","😊","😊","😐","😊","😊","😊","😊","😴","😊","😊","😊","😊","😐","😊","😊"],
        stats: [
          { icon: "bedtime", label: "睡眠均值", value: "6.9h", change: "↑0.4h", positive: true },
          { icon: "fitness_center", label: "运动频次", value: "4次/周", change: "↑1次", positive: true },
          { icon: "warning", label: "异常总次数", value: "8次", change: "↓12次", positive: true },
          { icon: "psychology", label: "新发现模式", value: "2个", change: "", positive: true },
        ],
        sleepData: [6.2,7.1,6.5,5.8,6.9,7.2,7.0,6.3,6.8,7.5,6.0,6.4,7.1,6.9,7.3,6.1,6.7,7.0,7.2,6.8,5.5,6.9,7.4,7.1,6.6,7.0,6.8,7.3,7.0,7.2],
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

  // Monthly: April
  await prisma.report.create({
    data: {
      userId: user.id,
      periodType: "monthly",
      periodStart: aprStart,
      periodEnd: mayStart,
      summary: "4月过渡期，刚开始使用Mindful。建立了基础数据和初步习惯。",
      data: {
        moodEmojis: ["😐","😐","😴","😐","😊","😐","😴","😊","😐","😐","😊","😐","😊","😊","😐","😴","😊","😐","😊","😊","😐","😊","😊","😐","😊","😐","😊","😊","😊","😊"],
        stats: [
          { icon: "bedtime", label: "睡眠均值", value: "6.5h", change: "", positive: true },
          { icon: "fitness_center", label: "运动频次", value: "3次/周", change: "", positive: true },
          { icon: "warning", label: "异常总次数", value: "20次", change: "", positive: false },
          { icon: "psychology", label: "新发现模式", value: "0个", change: "", positive: true },
        ],
        sleepData: [6.0,5.8,6.2,6.5,5.5,6.8,6.5,6.0,6.2,6.5,5.8,6.0,6.8,6.5,6.2,5.5,6.0,6.5,6.8,6.2,5.8,6.5,6.8,7.0,6.5,6.2,6.5,6.8,6.5,7.0],
        highlights: [
          { icon: "flag", label: "里程碑", value: "开始使用Mindful" },
          { icon: "self_improvement", label: "首次正念", value: "完成第一次深呼吸练习" },
        ],
        achievements: [{ icon: "🌱", title: "开始你的健康之旅", date: "2025-04-01" }],
        overallScore: 58,
      },
    },
  });

  // --- Insights ---
  await prisma.insight.createMany({
    data: [
      { userId: user.id, reportId: currentWeekReport.id, type: "pattern", title: "周三低状态模式", content: "你周三的状态总是最差，可能和周二晚上熬夜有关。建议周二设置一个22:30的入睡提醒。", metadata: { confidence: 0.85, relatedFactors: ["周二熬夜", "周三工作压力"], severity: "medium" } },
      { userId: user.id, reportId: currentWeekReport.id, type: "prediction", title: "睡眠下降预警", content: "连续3天睡眠下降趋势，历史数据显示这通常会在48h后引发头痛。今晚试试提前30分钟上床？", metadata: { confidence: 0.72, triggerWindow: "48h", historicalOccurrences: 4 } },
      { userId: user.id, reportId: mayReport.id, type: "correlation", title: "运动提升情绪", content: "运动后的情绪评分平均高出30%。你的最佳运动时间是早上7-8点。", metadata: { confidence: 0.88, strength: 85, factor: "exercise", effect: "mood_boost" } },
      { userId: user.id, reportId: mayReport.id, type: "correlation", title: "睡眠不足引发头痛", content: "睡眠不足6小时的第二天，头痛概率是平时的3倍。本月有4次符合这个模式。", metadata: { confidence: 0.78, strength: 72, factor: "sleep_deficit", effect: "headache" } },
      { userId: user.id, reportId: null, type: "correlation", title: "下午咖啡因影响入睡", content: "下午3点后摄入咖啡因时，当晚入睡时间平均延后45分钟。", metadata: { confidence: 0.65, strength: 65, factor: "caffeine_afternoon", effect: "sleep_onset_delay" } },
      { userId: user.id, reportId: null, type: "correlation", title: "正念缓解焦虑", content: "做完正念练习后，焦虑相关对话减少60%。坚持每天5分钟效果最好。", metadata: { confidence: 0.70, strength: 60, factor: "mindfulness", effect: "anxiety_reduction" } },
      { userId: user.id, reportId: lastWeekReport.id, type: "milestone", title: "异常频率下降", content: "相比上月同期，本周异常上报减少了40%。你的健康状况正在稳步改善。", metadata: { improvement: 40, comparedTo: "last_month_same_week" } },
    ],
  });
}
