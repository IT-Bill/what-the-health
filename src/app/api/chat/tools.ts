import { Type } from "@sinclair/typebox";
import type { AgentTool } from "@earendil-works/pi-agent-core";
import { getPrimaryGoalLabels } from "@/lib/primary-goals";
import {
  buildGoalParameterRecommendations,
  buildGoalParameterSetupState,
  type GoalParameterField,
} from "@/lib/goal-parameter-setup";
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
          primaryGoals: true,
        },
      });
      if (!user) throw new Error("用户不存在");
      const primaryGoalLabels = getPrimaryGoalLabels(user.primaryGoals, user.primaryGoal);
      return {
        content: [{ type: "text" as const, text: JSON.stringify({ ...user, primaryGoalLabels }, null, 2) }],
        details: { ...user, primaryGoalLabels },
      };
    },
  };

  const manageGoalParameterSetupTool: AgentTool = {
    name: "manage_goal_parameter_setup",
    label: "设置目标参数",
    description:
      "帮助用户在聊天里完成目标参数设置。先用 inspect 查看用户当前缺少哪些信息。" +
      "如果主要目标需要参数，但缺少身高或体重，先向用户提问并拿到 cm / kg 数字，再用 save 保存。" +
      "一旦身高、体重和主要目标齐全，就可以在 save 时把 applyRecommendations 设为 true，自动为仍为空的目标参数填入推荐值。" +
      "除非用户明确要求覆盖，否则不要覆盖已有参数。",
    parameters: Type.Object({
      action: Type.Union([Type.Literal("inspect"), Type.Literal("save")]),
      heightCm: Type.Optional(Type.Number({ description: "身高，单位 cm" })),
      weightKg: Type.Optional(Type.Number({ description: "体重，单位 kg" })),
      targetWeightKg: Type.Optional(Type.Number({ description: "目标体重，单位 kg" })),
      targetBodyFatPct: Type.Optional(Type.Number({ description: "目标体脂，单位 %" })),
      dailyActiveCalories: Type.Optional(Type.Number({ description: "每日活动热量，单位 kcal" })),
      dailyExerciseMinutes: Type.Optional(Type.Number({ description: "每日运动时间，单位 min" })),
      dailyStepGoal: Type.Optional(Type.Number({ description: "每日步数" })),
      dailyActiveHours: Type.Optional(Type.Number({ description: "每日活动小时数，单位 h" })),
      applyRecommendations: Type.Optional(
        Type.Boolean({
          description: "保存后，是否自动为仍为空的参数填入推荐值",
          default: true,
        }),
      ),
      overwriteExisting: Type.Optional(
        Type.Boolean({
          description: "是否覆盖已有参数。默认 false。",
          default: false,
        }),
      ),
    }),
    execute: async (_toolCallId, params) => {
      const input = params as {
        action: "inspect" | "save";
        heightCm?: number;
        weightKg?: number;
        targetWeightKg?: number;
        targetBodyFatPct?: number;
        dailyActiveCalories?: number;
        dailyExerciseMinutes?: number;
        dailyStepGoal?: number;
        dailyActiveHours?: number;
        applyRecommendations?: boolean;
        overwriteExisting?: boolean;
      };

      const select = {
        id: true,
        gender: true,
        heightCm: true,
        weightKg: true,
        targetWeightKg: true,
        targetBodyFatPct: true,
        dailyActiveCalories: true,
        dailyExerciseMinutes: true,
        dailyStepGoal: true,
        dailyActiveHours: true,
        primaryGoal: true,
        primaryGoals: true,
      } as const;

      const currentUser = await prisma.user.findUnique({
        where: { id: userId },
        select,
      });

      if (!currentUser) {
        throw new Error("用户不存在");
      }

      if (input.action === "inspect") {
        const setup = buildGoalParameterSetupState(currentUser);
        return {
          content: [{ type: "text" as const, text: JSON.stringify(setup, null, 2) }],
          details: setup,
        };
      }

      const explicitFields: Partial<Record<GoalParameterField | "heightCm" | "weightKg", number | null>> = {};
      if (input.heightCm !== undefined) explicitFields.heightCm = input.heightCm > 0 ? Math.round(input.heightCm) : null;
      if (input.weightKg !== undefined) explicitFields.weightKg = input.weightKg > 0 ? input.weightKg : null;
      if (input.targetWeightKg !== undefined) explicitFields.targetWeightKg = input.targetWeightKg > 0 ? input.targetWeightKg : null;
      if (input.targetBodyFatPct !== undefined) explicitFields.targetBodyFatPct = input.targetBodyFatPct > 0 ? input.targetBodyFatPct : null;
      if (input.dailyActiveCalories !== undefined) explicitFields.dailyActiveCalories = input.dailyActiveCalories > 0 ? Math.round(input.dailyActiveCalories) : null;
      if (input.dailyExerciseMinutes !== undefined) explicitFields.dailyExerciseMinutes = input.dailyExerciseMinutes > 0 ? Math.round(input.dailyExerciseMinutes) : null;
      if (input.dailyStepGoal !== undefined) explicitFields.dailyStepGoal = input.dailyStepGoal > 0 ? Math.round(input.dailyStepGoal) : null;
      if (input.dailyActiveHours !== undefined) explicitFields.dailyActiveHours = input.dailyActiveHours > 0 ? input.dailyActiveHours : null;

      const candidateProfile = {
        ...currentUser,
        ...explicitFields,
      };

      const explicitGoalFields = new Set(Object.keys(explicitFields));
      const autoFilledRecommendations: GoalParameterField[] = [];
      const data: Record<string, number | null> = { ...explicitFields };

      if (input.applyRecommendations !== false) {
        for (const recommendation of buildGoalParameterRecommendations(candidateProfile)) {
          const currentValue = candidateProfile[recommendation.field];
          const shouldApply =
            !explicitGoalFields.has(recommendation.field) &&
            (input.overwriteExisting === true || currentValue == null);

          if (!shouldApply) {
            continue;
          }

          data[recommendation.field] = recommendation.value;
          autoFilledRecommendations.push(recommendation.field);
        }
      }

      if (Object.keys(data).length === 0) {
        const setup = buildGoalParameterSetupState(currentUser);
        return {
          content: [{ type: "text" as const, text: JSON.stringify({ updated: false, setup }, null, 2) }],
          details: { updated: false, setup },
        };
      }

      const updatedUser = await prisma.user.update({
        where: { id: userId },
        data,
        select,
      });

      const setup = buildGoalParameterSetupState(updatedUser);
      const recommendations = buildGoalParameterRecommendations(updatedUser).filter((item) =>
        autoFilledRecommendations.includes(item.field),
      );

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                updated: true,
                savedFields: Object.keys(data),
                autoFilledRecommendations: recommendations,
                setup,
              },
              null,
              2,
            ),
          },
        ],
        details: {
          updated: true,
          savedFields: Object.keys(data),
          autoFilledRecommendations: recommendations,
          setup,
        },
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
          (m) => m.userId !== userId && (m.role === "owner" || m.isCaregiver)
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

  const manageOnboardingTool: AgentTool = {
    name: "manage_onboarding",
    label: "管理入职档案",
    description:
      "帮助用户完成健康档案收集。先用 inspect 查看还缺哪些信息，" +
      "然后每次只追问最缺的 1-2 项。用户回复后用 save 保存。" +
      "收集的信息包括：饮食偏好、过敏、健康限制、职业类型、作息、烹饪习惯等。",
    parameters: Type.Object({
      action: Type.Union([Type.Literal("inspect"), Type.Literal("save")]),
      dietaryPreference: Type.Optional(Type.String({ description: "饮食偏好：omnivore, vegetarian, vegan, keto 等" })),
      foodAllergies: Type.Optional(Type.Array(Type.String(), { description: "食物过敏列表" })),
      foodIntolerances: Type.Optional(Type.Array(Type.String(), { description: "不耐受列表" })),
      tastePreferences: Type.Optional(Type.Array(Type.String(), { description: "口味偏好：辣、甜、清淡等" })),
      dislikedFoods: Type.Optional(Type.Array(Type.String(), { description: "不喜欢的食物" })),
      medicalConditions: Type.Optional(Type.Array(Type.String(), { description: "健康状况" })),
      medications: Type.Optional(Type.Array(Type.String(), { description: "正在服用的药物" })),
      exerciseConstraints: Type.Optional(Type.Array(Type.String(), { description: "运动限制/伤病" })),
      occupationType: Type.Optional(Type.String({ description: "职业强度：sedentary, light, moderate, heavy" })),
      workSchedule: Type.Optional(Type.String({ description: "作息：day, night, shift, flexible" })),
      cookingSkill: Type.Optional(Type.String({ description: "烹饪水平：beginner, intermediate, advanced" })),
      cookingFrequency: Type.Optional(Type.String({ description: "做饭频率：daily, few_times_week, rarely" })),
      hasWearable: Type.Optional(Type.Boolean({ description: "是否有可穿戴设备" })),
    }),
    execute: async (_toolCallId, params) => {
      const input = params as {
        action: "inspect" | "save";
        dietaryPreference?: string;
        foodAllergies?: string[];
        foodIntolerances?: string[];
        tastePreferences?: string[];
        dislikedFoods?: string[];
        medicalConditions?: string[];
        medications?: string[];
        exerciseConstraints?: string[];
        occupationType?: string;
        workSchedule?: string;
        cookingSkill?: string;
        cookingFrequency?: string;
        hasWearable?: boolean;
      };

      if (input.action === "inspect") {
        const profile = await prisma.userHealthProfile.findUnique({
          where: { userId },
        });

        const fieldPriority = [
          "dietaryPreference",
          "foodAllergies",
          "medicalConditions",
          "occupationType",
          "cookingSkill",
          "workSchedule",
          "cookingFrequency",
          "tastePreferences",
          "dislikedFoods",
          "medications",
          "exerciseConstraints",
          "hasWearable",
          "foodIntolerances",
        ] as const;

        const missingFields: string[] = [];
        for (const field of fieldPriority) {
          const value = profile?.[field];
          const isEmpty = value === null || value === undefined ||
            (Array.isArray(value) && value.length === 0);
          if (isEmpty) {
            missingFields.push(field);
          }
        }

        const totalFields = fieldPriority.length;
        const filledFields = totalFields - missingFields.length;
        const completionPercentage = Math.round((filledFields / totalFields) * 100);

        let nextQuestion: string | null = null;
        if (missingFields.length > 0) {
          const nextField = missingFields[0];
          const questionMap: Record<string, string> = {
            dietaryPreference: "您的饮食偏好是什么？（如 omnivore 杂食、vegetarian 素食、vegan 纯素、keto 生酮等）",
            foodAllergies: "您对哪些食物过敏？",
            medicalConditions: "您目前有什么健康状况或慢性病吗？",
            occupationType: "您的工作强度如何？（sedentary 久坐、light 轻度、moderate 中度、heavy 重度）",
            cookingSkill: "您的烹饪水平如何？（beginner 新手、intermediate 中级、advanced 高级）",
            workSchedule: "您的作息是怎样的？（day 白天、night 夜间、shift 轮班、flexible 灵活）",
            cookingFrequency: "您做饭的频率如何？（daily 每天、few_times_week 每周几次、rarely 很少）",
            tastePreferences: "您喜欢什么口味？（如辣、甜、清淡等）",
            dislikedFoods: "您有什么不喜欢吃的食物吗？",
            medications: "您目前在服用什么药物吗？",
            exerciseConstraints: "您有什么运动限制或伤病吗？",
            hasWearable: "您有佩戴智能手表或运动手环等可穿戴设备吗？",
            foodIntolerances: "您对哪些食物不耐受？",
          };
          nextQuestion = questionMap[nextField] ?? `请提供您的 ${nextField}`;
        }

        const result = {
          profile,
          missingFields,
          completionPercentage,
          nextQuestion,
        };

        return {
          content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
          details: result,
        };
      }

      // save action
      const updateData: Record<string, unknown> = {};
      if (input.dietaryPreference !== undefined) updateData.dietaryPreference = input.dietaryPreference;
      if (input.foodAllergies !== undefined) updateData.foodAllergies = input.foodAllergies;
      if (input.foodIntolerances !== undefined) updateData.foodIntolerances = input.foodIntolerances;
      if (input.tastePreferences !== undefined) updateData.tastePreferences = input.tastePreferences;
      if (input.dislikedFoods !== undefined) updateData.dislikedFoods = input.dislikedFoods;
      if (input.medicalConditions !== undefined) updateData.medicalConditions = input.medicalConditions;
      if (input.medications !== undefined) updateData.medications = input.medications;
      if (input.exerciseConstraints !== undefined) updateData.exerciseConstraints = input.exerciseConstraints;
      if (input.occupationType !== undefined) updateData.occupationType = input.occupationType;
      if (input.workSchedule !== undefined) updateData.workSchedule = input.workSchedule;
      if (input.cookingSkill !== undefined) updateData.cookingSkill = input.cookingSkill;
      if (input.cookingFrequency !== undefined) updateData.cookingFrequency = input.cookingFrequency;
      if (input.hasWearable !== undefined) updateData.hasWearable = input.hasWearable;

      const savedFields = Object.keys(updateData);

      const profile = await prisma.userHealthProfile.upsert({
        where: { userId },
        create: {
          userId,
          ...updateData,
        },
        update: updateData,
      });

      const result = {
        updated: true,
        savedFields,
        profile,
      };

      return {
        content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
        details: result,
      };
    },
  };

  const recordDietaryLogTool: AgentTool = {
    name: "record_dietary_log",
    label: "记录饮食",
    description:
      "当用户描述自己吃了什么、喝了什么时，调用此工具解析并记录。" +
      "工具会自动调用 AI 解析食物结构并估算热量。",
    parameters: Type.Object({
      rawInput: Type.String({ description: "用户原始描述，如'中午吃了红烧肉和米饭'" }),
      mealType: Type.Union([
        Type.Literal("breakfast"),
        Type.Literal("lunch"),
        Type.Literal("dinner"),
        Type.Literal("snack"),
      ], { description: "餐段" }),
      cookingMethod: Type.Optional(Type.Union([
        Type.Literal("home_cooked"),
        Type.Literal("takeout"),
        Type.Literal("cafeteria"),
      ], { description: "做饭方式" })),
      location: Type.Optional(Type.String({ description: "用餐地点：home, office, restaurant 等" })),
    }),
    execute: async (_toolCallId, params) => {
      const input = params as {
        rawInput: string;
        mealType: "breakfast" | "lunch" | "dinner" | "snack";
        cookingMethod?: "home_cooked" | "takeout" | "cafeteria";
        location?: string;
      };

      const log = await prisma.dietaryLog.create({
        data: {
          userId,
          rawInput: input.rawInput,
          mealType: input.mealType,
          logDate: new Date(),
          cookingMethod: input.cookingMethod ?? null,
          location: input.location ?? null,
        },
      });

      return {
        content: [{ type: "text" as const, text: `饮食记录已保存：${input.rawInput}` }],
        details: log,
      };
    },
  };

  const generateHealthPlanTool: AgentTool = {
    name: "generate_health_plan",
    label: "生成健康方案",
    description:
      "当用户基础信息（身高、体重、主要目标）和健康档案都收集完成后，" +
      "调用此工具生成个性化健康方案。工具会读取所有用户数据，" +
      "调用 AI 生成结构化方案并保存。",
    parameters: Type.Object({}),
    execute: async () => {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          heightCm: true,
          weightKg: true,
          primaryGoal: true,
          targetWeightKg: true,
          targetBodyFatPct: true,
          dailyActiveCalories: true,
          dailyExerciseMinutes: true,
          dailyStepGoal: true,
          dailyActiveHours: true,
          gender: true,
          birthday: true,
        },
      });

      if (!user) {
        throw new Error("用户不存在");
      }

      const healthProfile = await prisma.userHealthProfile.findUnique({
        where: { userId },
      });

      const recentDiet = await prisma.dietaryLog.findMany({
        where: { userId },
        orderBy: { loggedAt: "desc" },
        take: 3,
        select: {
          mealType: true,
          rawInput: true,
          loggedAt: true,
          totalCalories: true,
        },
      });

      const recommendations = buildGoalParameterRecommendations(user);
      const recMap: Record<string, number> = {};
      for (const r of recommendations) {
        recMap[r.field] = r.value;
      }

      const planData = {
        userBasics: {
          heightCm: user.heightCm,
          weightKg: user.weightKg,
          primaryGoal: user.primaryGoal,
        },
        targets: {
          targetWeightKg: user.targetWeightKg ?? recMap.targetWeightKg ?? null,
          targetBodyFatPct: user.targetBodyFatPct ?? recMap.targetBodyFatPct ?? null,
          dailyActiveCalories: user.dailyActiveCalories ?? recMap.dailyActiveCalories ?? null,
          dailyExerciseMinutes: user.dailyExerciseMinutes ?? recMap.dailyExerciseMinutes ?? null,
          dailyStepGoal: user.dailyStepGoal ?? recMap.dailyStepGoal ?? null,
        },
        healthProfile: healthProfile
          ? {
              dietaryPreference: healthProfile.dietaryPreference,
              foodAllergies: healthProfile.foodAllergies,
              foodIntolerances: healthProfile.foodIntolerances,
              tastePreferences: healthProfile.tastePreferences,
              dislikedFoods: healthProfile.dislikedFoods,
              medicalConditions: healthProfile.medicalConditions,
              medications: healthProfile.medications,
              exerciseConstraints: healthProfile.exerciseConstraints,
              occupationType: healthProfile.occupationType,
              workSchedule: healthProfile.workSchedule,
              cookingSkill: healthProfile.cookingSkill,
              cookingFrequency: healthProfile.cookingFrequency,
              hasWearable: healthProfile.hasWearable,
            }
          : null,
        recentDiet,
        generatedAt: new Date().toISOString(),
      };

      const plan = await prisma.healthPlan.create({
        data: {
          userId,
          planData,
          isActive: true,
        },
      });

      const summaryLines = [
        "健康方案已生成并保存。",
        "",
        "【用户基础信息】",
        `- 身高: ${user.heightCm ?? "未设置"} cm`,
        `- 体重: ${user.weightKg ?? "未设置"} kg`,
        `- 主要目标: ${user.primaryGoal ?? "未设置"}`,
        "",
        "【目标参数】",
        `- 目标体重: ${planData.targets.targetWeightKg ?? "未设置"} kg`,
        `- 目标体脂: ${planData.targets.targetBodyFatPct ?? "未设置"} %`,
        `- 每日活动热量: ${planData.targets.dailyActiveCalories ?? "未设置"} kcal`,
        `- 每日运动时间: ${planData.targets.dailyExerciseMinutes ?? "未设置"} min`,
        `- 每日步数: ${planData.targets.dailyStepGoal ?? "未设置"}`,
        "",
        healthProfile
          ? "【健康档案】已收集，包含饮食偏好、过敏信息、健康状况等。"
          : "【健康档案】尚未收集，建议先完成健康档案收集。",
        "",
        `【最近饮食记录】${recentDiet.length} 条`,
        ...recentDiet.map((d) => `- ${d.mealType}: ${d.rawInput}`),
      ];

      const summaryText = summaryLines.join("\n");

      return {
        content: [{ type: "text" as const, text: summaryText }],
        details: { planId: plan.id, planData },
      };
    },
  };

  // ---------------------------------------------------------------------------
  // Symptom Triage Tools
  // ---------------------------------------------------------------------------

  const saveSymptomRecordTool: AgentTool = {
    name: "save_symptom_record",
    label: "保存症状记录",
    description:
      "将用户在症状问诊流程中描述的症状信息结构化保存到数据库。" +
      "在 Phase 3（信息确认后）调用。",
    parameters: Type.Object({
      symptomDescription: Type.String({ description: "用户描述的核心症状" }),
      bodyPart: Type.Optional(Type.String({ description: "身体部位" })),
      duration: Type.Optional(Type.String({ description: "持续时间" })),
      severity: Type.Optional(Type.Union(
        [Type.Literal("mild"), Type.Literal("moderate"), Type.Literal("severe")],
        { description: "严重程度" }
      )),
      triggers: Type.Optional(Type.Array(Type.String(), { description: "诱发/缓解因素" })),
      associatedSymptoms: Type.Optional(Type.Array(Type.String(), { description: "伴随症状" })),
      notes: Type.Optional(Type.String({ description: "完整病史摘要" })),
    }),
    execute: async (_toolCallId, params) => {
      const input = params as {
        symptomDescription: string;
        bodyPart?: string;
        duration?: string;
        severity?: "mild" | "moderate" | "severe";
        triggers?: string[];
        associatedSymptoms?: string[];
        notes?: string;
      };

      const record = await prisma.symptomRecord.create({
        data: {
          userId,
          symptomDescription: input.symptomDescription,
          bodyPart: input.bodyPart ?? null,
          duration: input.duration ?? null,
          severity: input.severity ?? null,
          triggers: input.triggers ?? [],
          associatedSymptoms: input.associatedSymptoms ?? [],
          notes: input.notes ?? null,
        },
      });

      return {
        content: [{ type: "text" as const, text: `症状记录已保存 (id: ${record.id})` }],
        details: record,
      };
    },
  };

  const getRecentSymptomRecordsTool: AgentTool = {
    name: "get_recent_symptom_records",
    label: "获取近期症状记录",
    description: "获取用户最近的症状记录，用于生成病历或回顾病史。",
    parameters: Type.Object({
      limit: Type.Number({ description: "返回多少条（默认5）", default: 5, minimum: 1, maximum: 20 }),
      activeOnly: Type.Boolean({ description: "仅返回当前活跃的症状", default: true }),
    }),
    execute: async (_toolCallId, params) => {
      const input = params as { limit?: number; activeOnly?: boolean };
      const records = await prisma.symptomRecord.findMany({
        where: {
          userId,
          ...(input.activeOnly !== false ? { isActive: true } : {}),
        },
        orderBy: { createdAt: "desc" },
        take: input.limit ?? 5,
      });

      return {
        content: [
          {
            type: "text" as const,
            text: records.length === 0
              ? "用户暂无症状记录。"
              : JSON.stringify(records, null, 2),
          },
        ],
        details: records,
      };
    },
  };

  const generateMedicalRecordTool: AgentTool = {
    name: "generate_medical_record",
    label: "生成病历",
    description:
      "根据用户症状记录和基本信息，生成结构化的病历文档并保存。" +
      "当用户要求'整理病历'、'生成病情描述'时调用。",
    parameters: Type.Object({
      title: Type.String({ description: "病历标题，如'胸痛问诊记录'" }),
      chiefComplaint: Type.String({ description: "主诉" }),
      presentIllness: Type.Optional(Type.String({ description: "现病史 JSON 字符串" })),
      pastHistory: Type.Optional(Type.String({ description: "既往史" })),
      recommendedDepartments: Type.Optional(Type.Array(Type.String(), { description: "推荐科室" })),
      formattedRecord: Type.String({ description: "完整格式化的病历文本" }),
      symptomRecordIds: Type.Optional(Type.Array(Type.String(), { description: "关联症状记录 ID" })),
    }),
    execute: async (_toolCallId, params) => {
      const input = params as {
        title: string;
        chiefComplaint: string;
        presentIllness?: string;
        pastHistory?: string;
        recommendedDepartments?: string[];
        formattedRecord: string;
        symptomRecordIds?: string[];
      };

      const record = await prisma.medicalRecord.create({
        data: {
          userId,
          title: input.title,
          chiefComplaint: input.chiefComplaint,
          presentIllness: input.presentIllness ? JSON.parse(input.presentIllness) : undefined,
          pastHistory: input.pastHistory ?? null,
          recommendedDepartments: input.recommendedDepartments ?? [],
          formattedRecord: input.formattedRecord,
          symptomRecordIds: input.symptomRecordIds ?? [],
        },
      });

      return {
        content: [
          {
            type: "text" as const,
            text: `病历已生成并保存 (id: ${record.id})\n\n${input.formattedRecord}`,
          },
        ],
        details: record,
      };
    },
  };

  // ---------------------------------------------------------------------------
  // Compliance Management Tools
  // ---------------------------------------------------------------------------

  const saveTreatmentPlanTool: AgentTool = {
    name: "save_treatment_plan",
    label: "保存治疗方案",
    description:
      "保存用户的诊断结果、治疗方案、用药信息、忌口禁忌等。" +
      "当用户提到诊断结果或医嘱时调用。",
    parameters: Type.Object({
      diagnosis: Type.String({ description: "诊断名称" }),
      treatment: Type.String({ description: "治疗方案/医嘱描述" }),
      medications: Type.Optional(Type.String({ description: "用药信息 JSON 字符串 [{name, dosage, frequency, duration, notes}]" })),
      dietaryRestrictions: Type.Optional(Type.Array(Type.String(), { description: "忌口列表" })),
      activityRestrictions: Type.Optional(Type.Array(Type.String(), { description: "活动禁忌" })),
      followUpInstructions: Type.Optional(Type.String({ description: "复诊说明" })),
      durationDays: Type.Optional(Type.Number({ description: "预计疗程天数" })),
      nextFollowUpDate: Type.Optional(Type.String({ description: "下次复诊日期 (ISO 格式)" })),
    }),
    execute: async (_toolCallId, params) => {
      const input = params as {
        diagnosis: string;
        treatment: string;
        medications?: string;
        dietaryRestrictions?: string[];
        activityRestrictions?: string[];
        followUpInstructions?: string;
        durationDays?: number;
        nextFollowUpDate?: string;
      };

      const endDate = input.durationDays
        ? new Date(Date.now() + input.durationDays * 24 * 60 * 60 * 1000)
        : undefined;

      const plan = await prisma.treatmentPlan.create({
        data: {
          userId,
          diagnosis: input.diagnosis,
          treatment: input.treatment,
          medications: input.medications ? JSON.parse(input.medications) : undefined,
          dietaryRestrictions: input.dietaryRestrictions ?? [],
          activityRestrictions: input.activityRestrictions ?? [],
          followUpInstructions: input.followUpInstructions ?? null,
          durationDays: input.durationDays ?? null,
          startDate: new Date(),
          endDate: endDate ?? null,
          nextFollowUpDate: input.nextFollowUpDate ? new Date(input.nextFollowUpDate) : null,
        },
      });

      return {
        content: [{ type: "text" as const, text: `治疗方案已保存 (id: ${plan.id})` }],
        details: plan,
      };
    },
  };

  const getActiveTreatmentPlansTool: AgentTool = {
    name: "get_active_treatment_plans",
    label: "获取活跃治疗方案",
    description:
      "获取用户当前进行中的治疗方案。在提供饮食/运动建议前调用，" +
      "以检查是否有医嘱约束需要遵守。",
    parameters: Type.Object({}),
    execute: async () => {
      const plans = await prisma.treatmentPlan.findMany({
        where: {
          userId,
          status: "active",
        },
        orderBy: { createdAt: "desc" },
      });

      return {
        content: [
          {
            type: "text" as const,
            text:
              plans.length === 0
                ? "用户当前没有进行中的治疗方案。"
                : JSON.stringify(plans, null, 2),
          },
        ],
        details: plans,
      };
    },
  };

  const setMedicationReminderTool: AgentTool = {
    name: "set_medication_reminder",
    label: "设置健康提醒",
    description:
      "为用户设置健康相关的定时提醒。当用户在对话中提到任何需要定期关注或按时执行的健康行为时，主动调用此工具创建提醒，不需要等用户明确说'设个提醒'。\n\n" +
      "适用场景：\n" +
      "1. 用药提醒：用户提到医生开了药、正在服药、或需要按时吃药（如'每天一片降压药'）。\n" +
      "2. 指标监测：用户提到需要定期测量血压、血糖、体温等（如'我最近血压有点高，要每天测'）。\n" +
      "3. 复诊/复查：用户提到要去看医生、复查、或预约检查（如'下周三要复诊'、'一个月后复查'）。\n" +
      "4. 恢复关怀：用户提到刚做完手术、生病、或身体不适需要恢复（如'上周做了小手术，还在恢复中'）。\n\n" +
      "规则：\n" +
      "- 起始时间：以用户提到的相关时间为起点。如果是'从今天开始'，startDate 用今天。\n" +
      "- 周期：如果是周期性行为（每天/每周），设定对应 frequency 和 reminderTimes。\n" +
      "- 单次：如果是明确日期的一次性事件（如下周三复诊），用 weekly 或 custom，endDate 设为该日期。\n" +
      "- 设置后告诉用户已帮ta设好提醒，用自然语言说明时间和频率。",
    parameters: Type.Object({
      title: Type.String({ description: "提醒标题，如'服用降压药'、'测血压'、'周三复诊'、'术后恢复关怀'" }),
      description: Type.Optional(Type.String({ description: "补充说明，如剂量、科室、注意事项" })),
      frequency: Type.Union(
        [
          Type.Literal("daily"),
          Type.Literal("twice_daily"),
          Type.Literal("three_times_daily"),
          Type.Literal("weekly"),
          Type.Literal("custom"),
        ],
        { description: "提醒频率。daily=每天一次, twice_daily=每天两次, three_times_daily=每天三次, weekly=每周, custom=自定义" }
      ),
      reminderTimes: Type.Array(Type.String(), { description: "提醒时间数组 [\"08:00\", \"20:00\"]。根据用户生活习惯推断合理时间" }),
      startDate: Type.String({ description: "开始日期 (ISO 格式 YYYY-MM-DD)，默认今天" }),
      endDate: Type.Optional(Type.String({ description: "结束日期 (ISO 格式)。明确日期的一次性事件设此字段" })),
      treatmentPlanId: Type.Optional(Type.String({ description: "关联治疗方案 ID" })),
    }),
    execute: async (_toolCallId, params) => {
      const input = params as {
        title: string;
        description?: string;
        frequency: "daily" | "twice_daily" | "three_times_daily" | "weekly" | "custom";
        reminderTimes: string[];
        startDate: string;
        endDate?: string;
        treatmentPlanId?: string;
      };

      // Validate title
      if (!input.title?.trim()) {
        throw new Error("提醒标题不能为空");
      }

      // Validate frequency
      const validFrequencies = ["daily", "twice_daily", "three_times_daily", "weekly", "custom"];
      if (!validFrequencies.includes(input.frequency)) {
        throw new Error(`无效的频率: ${input.frequency}。必须是 daily/twice_daily/three_times_daily/weekly/custom 之一`);
      }

      // Validate reminderTimes format (must be HH:MM)
      const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
      if (!Array.isArray(input.reminderTimes) || input.reminderTimes.length === 0) {
        throw new Error("reminderTimes 必须是非空数组");
      }
      for (const t of input.reminderTimes) {
        if (!timeRegex.test(t)) {
          throw new Error(`提醒时间格式错误: "${t}"。必须使用 HH:MM 格式，如 "08:00"`);
        }
      }

      // Validate startDate
      const startDate = new Date(input.startDate);
      if (isNaN(startDate.getTime())) {
        throw new Error(`开始日期格式错误: "${input.startDate}"。必须使用 YYYY-MM-DD 格式，如 "2026-06-03"`);
      }

      // Validate endDate if provided
      let endDate: Date | null = null;
      if (input.endDate) {
        endDate = new Date(input.endDate);
        if (isNaN(endDate.getTime())) {
          throw new Error(`结束日期格式错误: "${input.endDate}"。必须使用 YYYY-MM-DD 格式`);
        }
      }

      try {
        const reminder = await prisma.medicationReminder.create({
          data: {
            userId,
            title: input.title.trim(),
            description: input.description?.trim() ?? null,
            frequency: input.frequency,
            reminderTimes: input.reminderTimes,
            startDate,
            endDate,
            treatmentPlanId: input.treatmentPlanId ?? null,
          },
        });

        const freqText: Record<string, string> = {
          daily: "每天",
          twice_daily: "每天两次",
          three_times_daily: "每天三次",
          weekly: "每周",
          custom: "自定义",
        };

        console.log(`[set_medication_reminder] Created reminder: ${reminder.id} for user ${userId}`);

        return {
          content: [{ type: "text" as const, text: `已设置提醒「${input.title}」，${freqText[input.frequency]} ${input.reminderTimes.join("、")} 提醒。` }],
          details: reminder,
        };
      } catch (err) {
        console.error("[set_medication_reminder] DB error:", err);
        throw new Error(`数据库写入失败: ${err instanceof Error ? err.message : String(err)}`);
      }
    },
  };

  const askForMoreInfoTool: AgentTool = {
    name: "ask_for_more_info",
    label: "追问用户",
    description:
      "当你需要更多信息才能给出准确回答时调用。提供 2-4 个简洁的快捷选项让用户快速回复。" +
      "例如：询问症状部位、饮食偏好、目标类型等。" +
      "调用后，这些选项会以可点击按钮的形式出现在你的回复下方。" +
      "同时在你的回复文本中自然地提出问题，选项作为辅助。",
    parameters: Type.Object({
      question: Type.String({ description: "你想追问的问题（会体现在你的回复文本中，不需要重复显示）" }),
      options: Type.Array(
        Type.String({ description: "简短选项文本，最多50个字" }),
        { description: "2-4 个快捷回复选项", minItems: 2, maxItems: 4 }
      ),
    }),
    execute: async (_toolCallId, params) => {
      const input = params as { question: string; options: string[] };
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({ question: input.question, options: input.options }),
          },
        ],
        details: { question: input.question, options: input.options },
      };
    },
  };

  return [
    getUserPersonaTool,
    getUserProfileTool,
    manageGoalParameterSetupTool,
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
    manageOnboardingTool,
    recordDietaryLogTool,
    generateHealthPlanTool,
    saveSymptomRecordTool,
    getRecentSymptomRecordsTool,
    generateMedicalRecordTool,
    saveTreatmentPlanTool,
    getActiveTreatmentPlansTool,
    setMedicationReminderTool,
    askForMoreInfoTool,
  ];
}
