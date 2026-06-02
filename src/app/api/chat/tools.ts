import { Type } from "@sinclair/typebox";
import type { AgentTool } from "@earendil-works/pi-agent-core";
import { prisma } from "@/lib/prisma";
import { getOrCreatePersona } from "@/lib/persona-service";
import { searchPostsByVector } from "@/lib/posts/post-vector-search";

// ---------------------------------------------------------------------------
// Wellness Tools for Mindful Agent
// Each tool gives the agent access to the user's wellness data or the
// ability to create journal entries.
// ---------------------------------------------------------------------------

type ToolParams = {
  category?: "mindfulness" | "nutrition" | "reflection" | "sleep";
  days?: number;
  includeArchived?: boolean;
  limit?: number;
  note?: string;
  periodType?: "weekly" | "monthly";
  postId?: string;
  prompt?: string | null;
  query?: string;
  topic?: string;
};

function p(params: unknown): ToolParams {
  return params as ToolParams;
}

export function createTools(userId: string): AgentTool[] {
  const getUserPersonaTool: AgentTool = {
    name: "get_user_persona",
    label: "获取用户画像",
    description:
      "获取当前用户的完整画像信息，包括身份、行为模式、表达方式和偏好。这是最高优先级的个性化信息来源。",
    parameters: Type.Object({}),
    execute: async () => {
      const persona = await getOrCreatePersona(userId);
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(persona, null, 2),
          },
        ],
        details: persona,
      };
    },
  };

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

  const searchPostsTool: AgentTool = {
    name: "search_posts",
    label: "搜索帖子",
    description:
      "在 Discover 社区中用向量语义检索已发布的健康/疗愈相关帖子，返回帖子的基本信息（id、标题、摘要、分类、相似度等）。当你认为需要参考社区内容来回答用户问题时，先用这个工具搜索相关帖子，获取帖子 id 列表。注意：这个工具返回的是基本信息，如果需要某篇帖子的完整内容，请再调用 get_post_detail。",
    parameters: Type.Object({
      query: Type.Optional(
        Type.String({ description: "搜索语义 query（可选），会转成向量后匹配标题、摘要和正文" })
      ),
      category: Type.Optional(
        Type.String({
          description: "分类筛选：mindfulness（冥想正念）、nutrition（营养饮食）、sleep（睡眠）、reflection（反思成长）",
          enum: ["mindfulness", "nutrition", "sleep", "reflection"],
        })
      ),
      limit: Type.Number({ description: "返回多少条帖子（默认3，最多3条）", default: 3, minimum: 1, maximum: 3 }),
    }),
    execute: async (_toolCallId, params) => {
      const { query, category, limit } = p(params);
      const posts = await searchPostsByVector({ query, category, limit });

      return {
        content: [
          {
            type: "text" as const,
            text:
              posts.length === 0
                ? "未找到相关帖子。"
                : JSON.stringify(posts, null, 2),
          },
        ],
        details: posts,
      };
    },
  };

  const getPostDetailTool: AgentTool = {
    name: "get_post_detail",
    label: "获取帖子详情",
    description:
      "根据帖子 id 获取单篇帖子的完整内容（包括完整的正文、评论等）。在 search_posts 找到相关帖子后，调用此工具获取完整内容以供参考。",
    parameters: Type.Object({
      postId: Type.String({ description: "帖子 id" }),
    }),
    execute: async (_toolCallId, params) => {
      const { postId } = p(params);
      const post = await prisma.post.findUnique({
        where: { id: postId, published: true },
        select: {
          id: true,
          title: true,
          excerpt: true,
          body: true,
          category: true,
          categoryIcon: true,
          readMinutes: true,
          publishedAt: true,
          viewCount: true,
          author: { select: { name: true } },
          _count: { select: { likes: true, comments: true } },
        },
      });

      if (!post) {
        return {
          content: [{ type: "text" as const, text: "帖子不存在或已被删除。" }],
          details: null,
        };
      }

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(post, null, 2),
          },
        ],
        details: post,
      };
    },
  };

  const notifyFamilyConcernTool: AgentTool = {
    name: "notify_family_concern",
    label: "通知家人健康关注",
    description:
      "当用户在对话中表达了自身的健康问题、身体不适、或严重情绪问题时，调用此工具通知其家庭成员。" +
      "只在用户确实在描述自己当前的健康状况时使用（不是讨论别人、不是询问知识）。" +
      "severity: info=轻微不适, warning=明确症状, critical=紧急/自伤",
    parameters: Type.Object({
      title: Type.String({ description: "15字以内的简短标题，概括健康关注点" }),
      content: Type.String({ description: "50字以内的说明，给家人看的" }),
      severity: Type.Union([
        Type.Literal("info"),
        Type.Literal("warning"),
        Type.Literal("critical"),
      ], { description: "严重程度" }),
    }),
    execute: async (_toolCallId, params) => {
      const { title, content, severity } = p(params) as { title: string; content: string; severity: "info" | "warning" | "critical" };

      // Check if user is in any family with alerts enabled
      const memberships = await prisma.familyMember.findMany({
        where: { userId, shareAlerts: true },
        include: { family: { include: { members: true } } },
      });

      if (memberships.length === 0) {
        return {
          content: [{ type: "text" as const, text: "用户未加入任何家庭或未开启预警，无需通知。" }],
          details: { notified: false, reason: "no_family" },
        };
      }

      const sourceUser = await prisma.user.findUnique({
        where: { id: userId },
        select: { name: true },
      });

      let notifiedCount = 0;
      for (const membership of memberships) {
        // Create family alert
        const alert = await prisma.familyAlert.create({
          data: {
            familyId: membership.familyId,
            sourceUserId: userId,
            alertType: "chat-concern",
            severity,
            title,
            content,
          },
        });

        // Notify caregivers and owners (not the user themselves)
        const caregivers = membership.family.members.filter(
          (m) => m.userId !== userId && (m.role === "owner" || m.role === "caregiver")
        );

        for (const caregiver of caregivers) {
          await prisma.notification.create({
            data: {
              userId: caregiver.userId,
              title: `🔔 ${membership.nickname || sourceUser?.name || "家人"}的健康关注`,
              body: content,
              source: "family-chat-concern",
              actionUrl: `/discover/family/${membership.familyId}`,
              priority: "urgent",
              metadata: {
                alertId: alert.id,
                familyId: membership.familyId,
                sourceUserId: userId,
                severity,
              },
            },
          });
          notifiedCount++;
        }
      }

      return {
        content: [{ type: "text" as const, text: `已通知 ${notifiedCount} 位家庭成员关注。` }],
        details: { notified: true, count: notifiedCount },
      };
    },
  };

  const webSearchTool: AgentTool = {
    name: "web_search",
    label: "搜索网络",
    description:
      "搜索互联网获取最新信息。适用于：查询最新健康研究、营养知识、运动科学、药物信息、医疗建议等需要实时或专业外部信息的问题。不要用于查询用户个人数据。",
    parameters: Type.Object({
      query: Type.String({ description: "搜索关键词，建议使用中文或英文专业术语" }),
      topic: Type.Optional(
        Type.Union([
          Type.Literal("general"),
          Type.Literal("news"),
        ], { description: "搜索类型：general（通用）或 news（新闻）" })
      ),
    }),
    execute: async (_toolCallId, params) => {
      const { query, topic = "general" } = p(params);
      if (!query) throw new Error("query is required");

      const apiKey = process.env.TAVILY_API_KEY;
      if (!apiKey) throw new Error("TAVILY_API_KEY not configured");

      const res = await fetch("https://api.tavily.com/search", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          query,
          topic,
          search_depth: "basic",
          max_results: 5,
          include_answer: true,
        }),
      });

      if (!res.ok) {
        throw new Error(`Tavily search failed: ${res.status}`);
      }

      const data = await res.json() as {
        answer?: string;
        results: { title: string; url: string; content: string; score: number }[];
      };

      const summary = [
        data.answer ? `**摘要**: ${data.answer}\n` : "",
        data.results
          .map((r, i) => `[${i + 1}] **${r.title}**\n${r.content}\n来源: [${r.url}](${r.url})`)
          .join("\n\n"),
      ].filter(Boolean).join("\n");

      return {
        content: [{ type: "text" as const, text: summary }],
        details: { answer: data.answer, results: data.results },
      };
    },
  };

  return [
    getUserPersonaTool,
    getUserProfileTool,
    getRecentMoodCheckinsTool,
    getGoalsAndHabitsTool,
    getWellnessReportsTool,
    getInsightsTool,
    createJournalEntryTool,
    getRecentMemoriesTool,
    getHabitCompletionsTool,
    searchPostsTool,
    getPostDetailTool,
    notifyFamilyConcernTool,
    webSearchTool,
  ];
}
