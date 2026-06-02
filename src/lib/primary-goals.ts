import type { GoalType } from "@/generated/prisma/client";

export const PRIMARY_GOAL_OPTIONS = [
  {
    id: "buildMuscle",
    title: "增肌塑形",
    description: "增强力量与身体韧性。",
    icon: "fitness_center",
  },
  {
    id: "loseWeight",
    title: "减重管理",
    description: "找回轻盈与可持续的节奏。",
    icon: "scale",
  },
  {
    id: "healthyHabits",
    title: "健康习惯",
    description: "建立稳定、长期可坚持的日常习惯。",
    icon: "self_care",
  },
  {
    id: "betterSleep",
    title: "改善睡眠",
    description: "调节作息，获得更深层的休息。",
    icon: "bedtime",
  },
  {
    id: "stressRelief",
    title: "缓解压力",
    description: "降低紧绷感，恢复身心平衡。",
    icon: "self_improvement",
  },
  {
    id: "mindfulEating",
    title: "正念饮食",
    description: "更温和地照顾饮食与身体感受。",
    icon: "restaurant",
  },
  {
    id: "dailyMovement",
    title: "每日活动",
    description: "让运动自然融入你的生活节奏。",
    icon: "directions_walk",
  },
  {
    id: "mentalClarity",
    title: "提升专注",
    description: "减少杂音，保持清晰与稳定。",
    icon: "psychology",
  },
] as const;

export const BODY_COMPOSITION_GOAL_IDS = ["loseWeight", "buildMuscle"] as const;
export const ACTIVITY_GOAL_IDS = ["healthyHabits", "dailyMovement"] as const;

export type PrimaryGoalId = (typeof PRIMARY_GOAL_OPTIONS)[number]["id"];

const VALID_PRIMARY_GOAL_IDS = new Set<string>(
  PRIMARY_GOAL_OPTIONS.map((goal) => goal.id),
);

const PRIMARY_GOAL_LABELS = Object.fromEntries(
  PRIMARY_GOAL_OPTIONS.map((goal) => [goal.id, goal.title]),
) as Record<PrimaryGoalId, string>;

export function isValidPrimaryGoalId(value: string): value is PrimaryGoalId {
  return VALID_PRIMARY_GOAL_IDS.has(value);
}

export function normalizePrimaryGoals(
  values: readonly string[] | null | undefined,
): PrimaryGoalId[] {
  const seen = new Set<string>();
  const normalized: PrimaryGoalId[] = [];

  for (const value of values ?? []) {
    if (!isValidPrimaryGoalId(value) || seen.has(value)) {
      continue;
    }
    seen.add(value);
    normalized.push(value);
  }

  return normalized;
}

export function getStoredPrimaryGoals(
  primaryGoals: readonly string[] | null | undefined,
  primaryGoal: string | null | undefined,
): PrimaryGoalId[] {
  const normalized = normalizePrimaryGoals(primaryGoals);
  if (normalized.length > 0) {
    return normalized;
  }
  return primaryGoal && isValidPrimaryGoalId(primaryGoal) ? [primaryGoal] : [];
}

export function hasStoredPrimaryGoals(
  primaryGoals: readonly string[] | null | undefined,
  primaryGoal: string | null | undefined,
): boolean {
  return getStoredPrimaryGoals(primaryGoals, primaryGoal).length > 0;
}

export function getPrimaryGoalLabels(
  primaryGoals: readonly string[] | null | undefined,
  primaryGoal: string | null | undefined,
): string[] {
  return getStoredPrimaryGoals(primaryGoals, primaryGoal).map(
    (goalId) => PRIMARY_GOAL_LABELS[goalId],
  );
}

export function hasPrimaryGoalGroup(
  primaryGoals: readonly string[] | null | undefined,
  primaryGoal: string | null | undefined,
  goalGroup: readonly PrimaryGoalId[],
): boolean {
  const storedPrimaryGoals = getStoredPrimaryGoals(primaryGoals, primaryGoal);
  return goalGroup.some((goalId) => storedPrimaryGoals.includes(goalId));
}

export function requiresPrimaryGoalParameters(
  primaryGoals: readonly string[] | null | undefined,
  primaryGoal: string | null | undefined,
): boolean {
  return (
    hasPrimaryGoalGroup(primaryGoals, primaryGoal, BODY_COMPOSITION_GOAL_IDS) ||
    hasPrimaryGoalGroup(primaryGoals, primaryGoal, ACTIVITY_GOAL_IDS)
  );
}

export function toLegacyPrimaryGoal(
  primaryGoals: readonly string[] | null | undefined,
): GoalType | null {
  const normalized = normalizePrimaryGoals(primaryGoals);

  for (const goalId of normalized) {
    if (
      goalId === "buildMuscle" ||
      goalId === "loseWeight" ||
      goalId === "healthyHabits"
    ) {
      return goalId;
    }
  }

  return null;
}