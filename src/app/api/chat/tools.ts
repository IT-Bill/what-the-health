import { Type } from "@sinclair/typebox";
import type { AgentTool } from "@earendil-works/pi-agent-core";
import { prisma } from "@/lib/prisma";

// ---------------------------------------------------------------------------
// Wellness Tools for Mindful Agent
// Each tool gives the agent access to the user's wellness data or the
// ability to create journal entries.
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function p(params: unknown): Record<string, any> {
  return params as Record<string, any>;
}

export function createTools(userId: string): AgentTool[] {
  const getUserProfileTool: AgentTool = {
    name: "get_user_profile",
    label: "获取用户资料",
    description:
      "获取当前用户的基本资料，包括姓名、性别、身高、体重、会员时间、健康目标等。",
    parameters: Type.Object({}),
    execute: async () => {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          name: true,
          gender: true,
          birthday: true,
          heightCm: true,
          weightKg: true,
          memberSince: true,
          primaryGoal: true,
        },
      });
      if (!user) throw new Error("用户不存在");
      return {
        content: [{ type: "text" as const, text: JSON.stringify(user, null, 2) }],
        details: user,
      };
    },
  };

  const getRecentMoodCheckinsTool: AgentTool = {
    name: "get_recent_mood_checkins",
    label: "获取情绪记录",
    description:
      "获取用户最近的情绪打卡记录，包括情绪类型和备注。可用于了解用户近期的情绪趋势。",
    parameters: Type.Object({
      limit: Type.Number({
        description: "返回多少条记录（默认7条）",
        default: 7,
        minimum: 1,
        maximum: 30,
      }),
    }),
    execute: async (_toolCallId, params) => {
      const checkins = await prisma.moodCheckin.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        take: p(params).limit ?? 7,
        select: { mood: true, note: true, createdAt: true },
      });
      return {
        content: [
          {
            type: "text" as const,
            text:
              checkins.length === 0
                ? "用户暂无情绪记录。"
                : JSON.stringify(checkins, null, 2),
          },
        ],
        details: checkins,
      };
    },
  };

  const getGoalsAndHabitsTool: AgentTool = {
    name: "get_goals_and_habits",
    label: "获取目标与习惯",
    description:
      "获取用户当前的目标和习惯列表，包括完成状态、打卡频率等。",
    parameters: Type.Object({
      includeArchived: Type.Boolean({
        description: "是否包含已归档的目标（默认 false）",
        default: false,
      }),
    }),
    execute: async (_toolCallId, params) => {
      const goals = await prisma.goal.findMany({
        where: {
          userId,
          archived: p(params).includeArchived ? undefined : false,
        },
        orderBy: [{ archived: "asc" }, { sortOrder: "asc" }],
        select: {
          id: true,
          title: true,
          description: true,
          icon: true,
          cadence: true,
          archived: true,
          _count: { select: { completions: true } },
        },
      });
      return {
        content: [
          {
            type: "text" as const,
            text:
              goals.length === 0
                ? "用户暂无目标或习惯。"
                : JSON.stringify(goals, null, 2),
          },
        ],
        details: goals,
      };
    },
  };

  const getWellnessReportsTool: AgentTool = {
    name: "get_wellness_reports",
    label: "获取健康报告",
    description:
      "获取用户最近的周期性健康报告（周报/月报），包含情绪趋势、睡眠数据、成就等。",
    parameters: Type.Object({
      periodType: Type.String({
        description: "报告周期类型：weekly 或 monthly",
        enum: ["weekly", "monthly"],
      }),
      limit: Type.Number({ description: "返回多少份报告（默认3）", default: 3, minimum: 1, maximum: 10 }),
    }),
    execute: async (_toolCallId, params) => {
      const reports = await prisma.report.findMany({
        where: { userId, periodType: p(params).periodType as "weekly" | "monthly" },
        orderBy: { periodStart: "desc" },
        take: p(params).limit ?? 3,
        include: {
          insights: { where: { dismissed: false }, orderBy: { createdAt: "desc" } },
        },
      });
      return {
        content: [
          {
            type: "text" as const,
            text:
              reports.length === 0
                ? "用户暂无该周期的健康报告。"
                : JSON.stringify(reports, null, 2),
          },
        ],
        details: reports,
      };
    },
  };

  const getInsightsTool: AgentTool = {
    name: "get_insights",
    label: "获取AI洞察",
    description:
      "获取用户最近未关闭的AI洞察，包括情绪模式、健康关联、里程碑等。",
    parameters: Type.Object({
      limit: Type.Number({ description: "返回多少条洞察（默认5）", default: 5, minimum: 1, maximum: 20 }),
    }),
    execute: async (_toolCallId, params) => {
      const insights = await prisma.insight.findMany({
        where: { userId, dismissed: false },
        orderBy: { createdAt: "desc" },
        take: p(params).limit ?? 5,
        select: { type: true, title: true, content: true, createdAt: true },
      });
      return {
        content: [
          {
            type: "text" as const,
            text:
              insights.length === 0
                ? "用户暂无未关闭的洞察。"
                : JSON.stringify(insights, null, 2),
          },
        ],
        details: insights,
      };
    },
  };

  const createJournalEntryTool: AgentTool = {
    name: "create_journal_entry",
    label: "创建日记条目",
    description:
      "帮用户创建一条日记/反思记录，保存到 Memory 中。内容可以是用户分享的感受、想法，或你引导用户写下的反思。",
    parameters: Type.Object({
      note: Type.String({ description: "日记内容（用户的感受、想法或反思）" }),
      prompt: Type.Optional(
        Type.String({ description: "可选：这条日记回应的主题或提示词" })
      ),
    }),
    execute: async (_toolCallId, params) => {
      const memory = await prisma.memory.create({
        data: {
          userId,
          note: p(params).note,
          prompt: p(params).prompt ?? null,
        },
      });
      return {
        content: [
          {
            type: "text" as const,
            text: `日记已成功保存。`,
          },
        ],
        details: memory,
      };
    },
  };

  const getRecentMemoriesTool: AgentTool = {
    name: "get_recent_memories",
    label: "获取近期回忆",
    description:
      "获取用户最近的日记/反思记录。",
    parameters: Type.Object({
      limit: Type.Number({ description: "返回多少条记录（默认5）", default: 5, minimum: 1, maximum: 20 }),
    }),
    execute: async (_toolCallId, params) => {
      const memories = await prisma.memory.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        take: p(params).limit ?? 5,
        select: { note: true, prompt: true, createdAt: true },
      });
      return {
        content: [
          {
            type: "text" as const,
            text:
              memories.length === 0
                ? "用户暂无日记记录。"
                : JSON.stringify(memories, null, 2),
          },
        ],
        details: memories,
      };
    },
  };

  const getHabitCompletionsTool: AgentTool = {
    name: "get_habit_completions",
    label: "获取习惯打卡记录",
    description:
      "获取用户最近的习惯打卡完成情况。",
    parameters: Type.Object({
      days: Type.Number({ description: "查询最近多少天的记录（默认7）", default: 7, minimum: 1, maximum: 30 }),
    }),
    execute: async (_toolCallId, params) => {
      const since = new Date();
      since.setDate(since.getDate() - (p(params).days ?? 7));
      const completions = await prisma.habitCompletion.findMany({
        where: { userId, forDate: { gte: since } },
        orderBy: { forDate: "desc" },
        include: { goal: { select: { title: true } } },
      });
      return {
        content: [
          {
            type: "text" as const,
            text:
              completions.length === 0
                ? "用户最近暂无习惯打卡记录。"
                : JSON.stringify(completions, null, 2),
          },
        ],
        details: completions,
      };
    },
  };

  return [
    getUserProfileTool,
    getRecentMoodCheckinsTool,
    getGoalsAndHabitsTool,
    getWellnessReportsTool,
    getInsightsTool,
    createJournalEntryTool,
    getRecentMemoriesTool,
    getHabitCompletionsTool,
  ];
}
