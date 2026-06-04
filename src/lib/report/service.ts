import { prisma } from "@/lib/prisma";
import { computePeriod, aggregatePeriodData } from "./aggregator";
import { generateReport } from "./generator";
import type { PeriodType as ReportPeriodType } from "./aggregator";
import type { PeriodType as PrismaPeriodType, InsightType, Prisma } from "@/generated/prisma/client";
import { buildAnswerReferenceContext } from "@/lib/memory/answer-context";
import {
  buildDietaryContext,
  buildHealthProfileContext,
  buildTimeContext,
  buildWearableContext,
} from "@/lib/dietary-context";
import { buildRoleSystemPrompt, isValidAgentRole } from "@/lib/agent-role";
import { buildGoalParameterSetupState } from "@/lib/goal-parameter-setup";
import { formatSkillsForSystemPrompt, loadChatSkills } from "@/lib/chat/skills";

export interface GenerateWellnessReportInput {
  userId: string;
  periodType: ReportPeriodType;
  periodStart?: Date;
  signal?: AbortSignal;
  onProgress?: (message: string) => void;
}

async function buildReportContext(userId: string, query: string): Promise<string> {
  const [userPrefs, answerReferenceContext, dietaryContext, wearableContext, healthProfileContext, skills] =
    await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: {
          agentRole: true,
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
        },
      }),
      buildAnswerReferenceContext(userId, query),
      buildDietaryContext(userId),
      buildWearableContext(userId),
      buildHealthProfileContext(userId),
      loadChatSkills(),
    ]);

  const agentRole = userPrefs?.agentRole;
  const rolePrompt = buildRoleSystemPrompt(agentRole && isValidAgentRole(agentRole) ? agentRole : null);
  const goalParameterSetup = userPrefs ? buildGoalParameterSetupState(userPrefs) : null;
  const goalPrompt = goalParameterSetup?.requiresParameters
    ? [
        "目标参数状态：",
        goalParameterSetup.missingPrerequisiteFields.length > 0
          ? `缺少基础信息：${goalParameterSetup.missingPrerequisiteFields.join(", ")}。`
          : null,
        goalParameterSetup.missingParameterFields.length > 0
          ? `缺少目标参数：${goalParameterSetup.missingParameterFields.join(", ")}。`
          : null,
      ].filter(Boolean).join("\n")
    : null;

  const skillsText = formatSkillsForSystemPrompt(skills);
  return [
    buildTimeContext(),
    rolePrompt,
    goalPrompt,
    wearableContext || null,
    dietaryContext,
    healthProfileContext || null,
    answerReferenceContext,
    skillsText || null,
  ].filter(Boolean).join("\n\n");
}

export async function generateWellnessReportForUser(input: GenerateWellnessReportInput) {
  const period = computePeriod(input.periodType, input.periodStart);

  const latestReport = await prisma.report.findFirst({
    where: {
      userId: input.userId,
      periodType: input.periodType as PrismaPeriodType,
      periodStart: period.start,
    },
    orderBy: { version: "desc" },
    select: { version: true },
  });
  const nextVersion = (latestReport?.version ?? 0) + 1;

  input.onProgress?.("正在聚合本周期健康、情绪、习惯、活跃和对话数据。");
  const aggregated = await aggregatePeriodData(input.userId, period);
  if (!aggregated.hasAnyData) {
    throw new Error("该周期暂无数据，无法生成报告。请先导入健康数据、记录情绪或完成习惯。");
  }

  input.onProgress?.("正在加载用户画像和聊天同款上下文。");
  let personaContext: string | null = null;
  const persona = await prisma.userPersona.findUnique({ where: { userId: input.userId } });
  if (persona) {
    const { personaToSystemPromptText } = await import("@/lib/persona-types");
    personaContext = personaToSystemPromptText(
      persona as unknown as Parameters<typeof personaToSystemPromptText>[0]
    );
  }
  const reportContext = await buildReportContext(
    input.userId,
    `${input.periodType === "monthly" ? "生成月报" : "生成周报"} ${period.start.toISOString().slice(0, 10)}`
  );

  input.onProgress?.("正在通过主报告提示词生成摘要、亮点、成就和洞察。");
  const generated = await generateReport(aggregated, personaContext, input.signal, reportContext);

  input.onProgress?.("正在保存新的报告版本。");
  const report = await prisma.report.create({
    data: {
      userId: input.userId,
      periodType: input.periodType as PrismaPeriodType,
      periodStart: period.start,
      periodEnd: period.end,
      version: nextVersion,
      data: generated.data as unknown as Prisma.InputJsonValue,
      summary: generated.summary || null,
    },
  });

  const insightRecords = [];
  for (const insight of generated.insights) {
    const record = await prisma.insight.create({
      data: {
        userId: input.userId,
        reportId: report.id,
        type: insight.type as InsightType,
        title: insight.title,
        content: insight.content,
        metadata: (insight.metadata || {}) as Prisma.InputJsonValue,
      },
    });
    insightRecords.push(record);
  }

  return {
    period,
    report: { ...report, insights: insightRecords },
  };
}
